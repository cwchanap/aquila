<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { Crosshair, Star, X } from 'lucide-svelte';
  import type {
    ChoiceMap,
    StoryFlowConfig,
    Translations,
  } from '@aquila/stories';
  import type { StoryProgress } from '@/lib/story-progress-store';
  import {
    buildStoryMap,
    layoutStoryMap,
    type StoryMapDecision,
    type StoryMapEnding,
    type StoryMapLayoutEdge,
    type StoryMapLayoutNode,
    type StoryMapMetrics,
    type StoryMapRun,
  } from '@/lib/story-map';
  import { actLabel, extractActName } from '@/lib/act-navigation';
  import { focusTrap } from '@/lib/focus-trap';
  import { cn } from '@/lib/utils';

  let {
    open,
    flow,
    choices,
    storyTitle,
    currentSceneId,
    dialogueIndex,
    lineCount,
    progress,
    t,
    onJump,
    onClose,
    restoreFocusTarget = null,
  }: {
    open: boolean;
    flow: StoryFlowConfig;
    choices: ChoiceMap;
    storyTitle: string;
    currentSceneId: string;
    dialogueIndex: number;
    lineCount: number;
    progress: StoryProgress | null;
    t: Translations;
    onJump: (sceneId: string, at?: 'start' | 'end') => void;
    onClose: () => void;
    restoreFocusTarget?: HTMLElement | null;
  } = $props();

  const MAP_METRICS: StoryMapMetrics = {
    paddingX: 56,
    paddingY: 56,
    rowHeight: 108,
    nodeHeight: 44,
    columnGap: 72,
    decisionGap: 148,
    trunkGap: 36,
    runWidth: 148,
    sceneWidth: 44,
    sceneGap: 16,
    decisionWidth: 44,
    markerWidth: 44,
  };

  let expandedRunIds = new SvelteSet<string>();
  let selectedId = $state<string | null>(null);
  let selectedKind = $state<StoryMapLayoutNode['kind'] | null>(null);
  let mapEl = $state<HTMLElement | null>(null);

  let view = $derived(
    buildStoryMap({ flow, choices, progress, currentSceneId, t })
  );
  let layout = $derived(layoutStoryMap(view, expandedRunIds, MAP_METRICS));
  let nodesById = $derived(new SvelteMap(layout.nodes.map(n => [n.id, n])));
  let sm = $derived(t.reader.storyMap);
  let stats = $derived([
    { label: sm.statsActs, count: view.stats.acts },
    { label: sm.statsDecisions, count: view.stats.decisions },
    { label: sm.statsEndings, count: view.stats.endings },
  ]);

  interface ViewIndex {
    runs: Map<string, StoryMapRun>;
    scenes: Map<string, StoryMapRun>;
    decisions: Map<
      string,
      { decision: StoryMapDecision; precedingSceneId: string | null }
    >;
    endings: Map<string, StoryMapEnding>;
    unknowns: Set<string>;
    context: Map<string, string>;
  }

  function indexView(root: StoryMapRun | null): ViewIndex {
    const runs = new SvelteMap<string, StoryMapRun>();
    const scenes = new SvelteMap<string, StoryMapRun>();
    const decisions = new SvelteMap<
      string,
      { decision: StoryMapDecision; precedingSceneId: string | null }
    >();
    const endings = new SvelteMap<string, StoryMapEnding>();
    const unknowns = new SvelteSet<string>();
    const context = new SvelteMap<string, string>();
    const walkRun = (run: StoryMapRun, branch?: string): void => {
      runs.set(run.id, run);
      if (branch) context.set(run.id, branch);
      for (const id of run.sceneIds) {
        scenes.set(id, run);
        if (branch) context.set(id, branch);
      }
      const next = run.next;
      if (!next) return;
      if (next.kind === 'decision') {
        decisions.set(next.id, {
          decision: next,
          precedingSceneId: run.sceneIds[run.sceneIds.length - 1] ?? null,
        });
        if (branch) context.set(next.id, branch);
        for (const o of next.options) {
          if (o.child.kind === 'run') walkRun(o.child, o.label);
          else {
            unknowns.add(o.child.id);
            context.set(o.child.id, o.label);
          }
        }
        return;
      }
      if (next.kind === 'ending') endings.set(next.id, next);
      else unknowns.add(next.id);
      if (branch) context.set(next.id, branch);
    };
    if (root) walkRun(root);
    return { runs, scenes, decisions, endings, unknowns, context };
  }

  let index = $derived(indexView(view.root));

  type Selection =
    | { kind: 'current' }
    | { kind: 'run'; run: StoryMapRun }
    | {
          kind: 'scene';
          sceneId: string;
          label: string;
          current: boolean;
      }
    | {
          kind: 'decision';
          decision: StoryMapDecision;
          precedingSceneId: string | null;
      }
    | { kind: 'ending'; ending: StoryMapEnding }
    | { kind: 'unknown' };

  function sceneLabel(sceneId: string, run: StoryMapRun | undefined): string {
    const raw = extractActName(sceneId);
    return (raw && actLabel(raw, t)) || run?.label || '?';
  }

  let selection = $derived.by((): Selection => {
    const id = selectedId;
    if (!id) return { kind: 'current' };
    const decision = selectedKind === 'decision' && index.decisions.get(id);
    if (decision) return { kind: 'decision', ...decision };
    const ending = selectedKind === 'ending' && index.endings.get(id);
    if (ending) return { kind: 'ending', ending };
    if (selectedKind === 'unknown' && index.unknowns.has(id)) {
      return { kind: 'unknown' };
    }
    const run = selectedKind === 'run' && index.runs.get(id);
    if (run) return { kind: 'run', run };
    const sceneRun = selectedKind === 'scene' && index.scenes.get(id);
    if (sceneRun) {
      return {
        kind: 'scene',
        sceneId: id,
        label: sceneLabel(id, sceneRun),
        current: id === currentSceneId,
      };
    }
    return { kind: 'current' };
  });

  let currentActLabel = $derived.by(() => {
    const raw = extractActName(currentSceneId);
    return (
      (raw && actLabel(raw, t)) ||
      index.scenes.get(currentSceneId)?.label ||
      ''
    );
  });

  let lineProgressText = $derived(
    t.reader.lineProgress
      .replace('{current}', String(dialogueIndex + 1))
      .replace('{total}', String(lineCount))
  );

  function statText(template: string, n: number): string {
    return template.replace('{n}', String(n));
  }

  function isExpanded(run: StoryMapRun): boolean {
    return run.current || expandedRunIds.has(run.id);
  }

  function canFold(run: StoryMapRun): boolean {
    return !run.current && run.sceneIds.length > 1;
  }

  function toggleFold(run: StoryMapRun): void {
    if (!canFold(run)) return;
    if (expandedRunIds.has(run.id)) expandedRunIds.delete(run.id);
    else expandedRunIds.add(run.id);
  }

  function activateNode(node: StoryMapLayoutNode): void {
    selectedId = node.id;
    selectedKind = node.kind;
    if (node.kind === 'run') {
      const run = index.runs.get(node.id);
      if (run && run.sceneIds.length > 1) expandedRunIds.add(node.id);
    }
  }

  function handleNodeKeydown(
    event: KeyboardEvent,
    node: StoryMapLayoutNode
  ): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    activateNode(node);
  }

  function contextual(id: string, base: string): string {
    const branch = index.context.get(id);
    if (!branch) return base;
    return sm.withBranch
      .replace('{label}', base)
      .replace('{branch}', branch);
  }

  function nodeLabel(node: StoryMapLayoutNode): string {
    if (node.kind === 'run') {
      const run = index.runs.get(node.id);
      const base =
        run && run.sceneIds.length > 1
          ? sm.expandRun.replace('{label}', node.label ?? '')
          : (node.label ?? '');
      return contextual(node.id, base);
    }
    if (node.kind === 'scene') {
      const base = sceneLabel(node.id, index.scenes.get(node.id));
      return contextual(
        node.id,
        node.current ? `${sm.currentPosition}: ${base}` : base
      );
    }
    if (node.kind === 'decision') {
      const n =
        index.decisions.get(node.id)?.decision.options.length ?? 0;
      return contextual(
        node.id,
        `${sm.decision} · ${statText(sm.options, n)}`
      );
    }
    if (node.kind === 'ending') {
      return contextual(
        node.id,
        sm.endingLabel.replace('{label}', node.label ?? '')
      );
    }
    return contextual(node.id, sm.unreadLabel);
  }

  function nodeClasses(node: StoryMapLayoutNode): string {
    const selected = selectedId === node.id && selectedKind === node.kind;
    if (node.kind === 'run') {
      return cn(
        'rounded-full',
        selected && 'outline-2 outline-dashed outline-blue-600'
      );
    }
    return cn(
      'rounded-full',
      selected && 'outline-2 outline-dashed outline-blue-600 outline-offset-[-2px]'
    );
  }

  function edgeStatus(
    edge: StoryMapLayoutEdge
  ): 'route' | 'explored' | 'unread' {
    if (edge.kind === 'trunk' || edge.kind === 'stub') {
      return (edge.serves ?? []).some(id => index.runs.has(id))
        ? 'explored'
        : 'unread';
    }
    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);
    if (!a || !b) return 'explored';
    if (a.status === 'unread' || b.status === 'unread') return 'unread';
    if (a.status === 'route' && b.status === 'route') return 'route';
    return 'explored';
  }

  function edgeLabelPos(
    edge: StoryMapLayoutEdge
  ): { x: number; y: number; width: number } | null {
    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);
    if (!a || !b) return null;
    const x = a.x + a.width + 6;
    return {
      x,
      y: b.y + b.height / 2 - 14,
      width: Math.max(0, b.x - x - 6),
    };
  }

  function scrollCurrentIntoView(): void {
    if (!mapEl) return;
    const el = mapEl.querySelector('[data-current="true"]');
    if (!(el instanceof HTMLElement)) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bounds = mapEl.getBoundingClientRect();
    const usableRight = bounds.left + mapEl.clientLeft + mapEl.clientWidth;
    const usableTop = bounds.top + mapEl.clientTop;
    const usableBottom = bounds.top + mapEl.clientTop + mapEl.clientHeight;
    const node = el.getBoundingClientRect();
    const caption = el.querySelector('[data-current-caption]');
    const captionBox = caption?.getBoundingClientRect() ?? node;
    const top = Math.min(node.top, captionBox.top);
    const bottom = Math.max(node.bottom, captionBox.bottom);
    // Leave room for the next visible marker without clipping the current pill.
    const context = Math.min(108, Math.max(0, mapEl.clientWidth - captionBox.width));
    const dx = Math.max(node.right, captionBox.right) + context - usableRight;
    let dy = 0;
    if (top < usableTop) dy = top - usableTop;
    else if (bottom > usableBottom) dy = bottom - usableBottom;
    mapEl.scrollTo({
      left: mapEl.scrollLeft + Math.ceil(dx),
      top: mapEl.scrollTop + Math.ceil(dy),
      behavior: reduce ? 'auto' : 'smooth',
    });
  }

  function locateCurrent(): void {
    selectedId = null;
    selectedKind = null;
    scrollCurrentIntoView();
  }

  function handleEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape' && open) onClose();
  }

  let wasOpen = false;
  $effect(() => {
    if (open === wasOpen) return;
    wasOpen = open;
    if (open) {
      selectedId = null;
      selectedKind = null;
      expandedRunIds.clear();
      void tick().then(() => scrollCurrentIntoView());
    }
  });
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]"
    aria-label={sm.close}
    onclick={onClose}
  ></button>
  <div
    class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center lg:p-8"
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-map-title"
      use:focusTrap={{ enabled: true, restoreFocus: restoreFocusTarget }}
      class="pointer-events-auto flex h-full w-full flex-col overflow-hidden bg-gradient-to-b from-[#bae6fd] via-[#7dd3fc] to-[#60a5fa] lg:h-[85vh] lg:max-w-5xl lg:rounded-3xl lg:shadow-2xl lg:ring-1 lg:ring-white/50"
    >
      <div class="flex items-start justify-between gap-3 px-4 pt-4 sm:px-6">
        <div class="min-w-0">
          <p
            id="story-map-title"
            class="text-xs font-bold uppercase tracking-widest text-blue-700"
          >
            {sm.title}
          </p>
          <h2 class="mt-1 truncate text-xl font-bold text-slate-800 sm:text-2xl">
            {storyTitle}
          </h2>
        </div>
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/85 text-slate-600 shadow-md hover:bg-white"
          aria-label={sm.close}
          onclick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6 lg:flex-row">
        <div
          class="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white/55 ring-1 ring-white/70 backdrop-blur-md"
        >
          <div
            bind:this={mapEl}
            data-testid="story-map-surface"
            class="relative flex min-h-0 flex-1 overflow-auto overscroll-contain"
          >
          <div
            class="relative m-auto shrink-0"
            style={`width:${layout.bounds.width}px;height:${layout.bounds.height}px`}
          >
            <svg
              class="absolute inset-0"
              width={layout.bounds.width}
              height={layout.bounds.height}
              viewBox={`0 0 ${layout.bounds.width} ${layout.bounds.height}`}
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="story-map-route"
                  gradientUnits="userSpaceOnUse"
                  x1={0}
                  y1={0}
                  x2={layout.bounds.width}
                  y2={0}
                >
                  <stop offset="0" stop-color="#3b82f6" />
                  <stop offset="1" stop-color="#22d3ee" />
                </linearGradient>
              </defs>
              {#each layout.edges as edge (edge.id)}
                {@const status = edgeStatus(edge)}
                <path
                  d={edge.d}
                  fill="none"
                  data-edge-kind={edge.kind}
                  data-edge-status={status}
                  stroke={status === 'route'
                    ? 'url(#story-map-route)'
                    : status === 'explored'
                      ? '#14b8a6'
                      : '#94a3b8'}
                  stroke-width={status === 'route'
                    ? 6
                    : status === 'explored'
                      ? 4.5
                      : 2.5}
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-dasharray={status === 'unread' ? '0.1 8' : undefined}
                />
              {/each}
            </svg>
            {#each layout.edges as edge (edge.id)}
              {#if edge.label}
                {@const pos = edgeLabelPos(edge)}
                {#if pos}
                  <div
                    aria-hidden="true"
                    data-edge-label
                    class={cn(
                      'pointer-events-none absolute flex items-end text-xs font-semibold leading-tight',
                      edgeStatus(edge) === 'route'
                        ? 'text-blue-700'
                        : edgeStatus(edge) === 'explored'
                          ? 'text-teal-700'
                          : 'text-slate-500'
                    )}
                    style={`left:${pos.x}px;top:${pos.y - 32}px;width:${pos.width}px;height:32px`}
                  >
                    <span class="line-clamp-2 break-words rounded bg-sky-100/90 px-1">{edge.label}</span>
                  </div>
                {/if}
              {/if}
            {/each}
            {#each layout.nodes as node (node.id)}
              {@const expandable =
                node.kind === 'run' &&
                (index.runs.get(node.id)?.sceneIds.length ?? 0) > 1}
              <button
                type="button"
                class={cn(
                  'absolute flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700',
                  nodeClasses(node)
                )}
                style={`left:${node.x}px;top:${node.y}px;width:${node.width}px;height:${node.height}px`}
                data-kind={node.kind}
                data-status={node.status}
                data-selected={selectedId === node.id && selectedKind === node.kind ? 'true' : undefined}
                data-current={node.current ? 'true' : undefined}
                aria-label={nodeLabel(node)}
                aria-pressed={selectedId === node.id && selectedKind === node.kind}
                aria-expanded={expandable ? 'false' : undefined}
                aria-current={node.current ? 'location' : undefined}
                onclick={() => activateNode(node)}
                onkeydown={e => handleNodeKeydown(e, node)}
              >
                {#if node.kind === 'run'}
                  <span
                    class={cn(
                      'flex h-[34px] w-full items-center justify-center truncate rounded-full border-2 bg-white px-3 text-[13px] font-semibold text-slate-800 shadow-sm',
                      node.status === 'route' ? 'border-blue-300' : 'border-teal-200'
                    )}
                    >{node.label}</span
                  >
                {:else if node.kind === 'scene'}
                  {#if node.current}
                    <span
                      aria-hidden="true"
                      class="absolute h-8 w-8 rounded-full bg-blue-400/40 motion-safe:animate-ping"
                    ></span>
                    <span
                      aria-hidden="true"
                      class="h-5 w-5 rounded-full bg-blue-500 shadow ring-[3px] ring-white"
                    ></span>
                    <span
                      aria-hidden="true"
                      data-current-caption
                      class="absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-bold leading-none text-white"
                    >
                      {sm.youAreHere}
                    </span>
                  {:else}
                    <span
                      aria-hidden="true"
                      class={cn(
                        'h-3.5 w-3.5 rounded-full bg-white shadow ring-[3px]',
                        node.status === 'route' ? 'ring-blue-500' : 'ring-teal-500'
                      )}
                    ></span>
                  {/if}
                  <span
                    aria-hidden="true"
                    class="absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap text-xs text-slate-500"
                    >{sceneLabel(node.id, index.scenes.get(node.id))}</span
                  >
                {:else if node.kind === 'decision'}
                  <span
                    aria-hidden="true"
                    class="h-5 w-5 rotate-45 rounded-sm border-[2.5px] border-amber-500 bg-amber-100"
                  ></span>
                {:else if node.kind === 'unknown'}
                  <span
                    aria-hidden="true"
                    class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-slate-400 text-sm font-bold text-slate-500"
                    >?</span
                  >
                {:else}
                  <span
                    aria-hidden="true"
                    class="flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-teal-500 bg-white shadow"
                  >
                    <Star
                      size={14}
                      fill="currentColor"
                      class="text-amber-400"
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    class="absolute left-full ml-1 whitespace-nowrap text-xs font-semibold text-teal-700"
                    >{sm.ending}</span
                  >
                {/if}
              </button>
            {/each}
            {#each [...index.runs.values()] as run (run.id)}
              {#if canFold(run) && isExpanded(run)}
                {@const first = nodesById.get(run.sceneIds[0])}
                {@const last = nodesById.get(run.sceneIds[run.sceneIds.length - 1])}
                {#if first && last}
                  <button
                    type="button"
                    aria-label={contextual(run.id, sm.collapseRun.replace('{label}', run.label))}
                    aria-expanded="true"
                    class="absolute flex h-11 items-center justify-center rounded text-xs font-semibold text-slate-500 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                    style={`left:${first.x}px;top:${first.y - 44}px;width:${last.x + last.width - first.x}px`}
                    onclick={() => {
                      selectedId = run.id;
                      selectedKind = 'run';
                      toggleFold(run);
                    }}
                  >
                    {run.label}
                  </button>
                {/if}
              {/if}
            {/each}
          </div>
          </div>
          <div class="flex shrink-0 items-end justify-between gap-2 p-3">
            <div
              role="group"
              aria-label={sm.legend}
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white/85 px-3 py-2 text-[11px] font-medium text-slate-600 shadow-sm sm:rounded-full"
            >
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true" class="h-1 w-5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"></span>
                {sm.yourRoute}
              </span>
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true" class="h-1 w-5 rounded-full bg-teal-500"></span>
                {sm.explored}
              </span>
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true" class="w-5 border-t-[3px] border-dotted border-slate-400"></span>
                {sm.unreadLabel}
              </span>
              <span class="flex items-center gap-1.5">
                <span aria-hidden="true" class="mx-1 h-2.5 w-2.5 rotate-45 border-2 border-amber-500 bg-amber-100"></span>
                {sm.decision}
              </span>
            </div>
            <button
              type="button"
              aria-label={sm.locateCurrent}
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/90 text-blue-600 shadow-md hover:bg-white"
              onclick={locateCurrent}
            >
              <Crosshair size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        <aside
          data-testid="story-map-details"
          aria-live="polite"
          class="flex max-h-[50%] w-full shrink-0 flex-col overflow-y-auto rounded-[20px] bg-white/92 p-5 text-slate-800 shadow-lg lg:max-h-none lg:w-60"
        >
          {#if selection.kind === 'current'}
            <h3
              class="text-xs font-bold uppercase tracking-widest text-blue-600"
            >
              {sm.youAreHere}
            </h3>
            <p class="mt-2 text-3xl font-bold">{currentActLabel}</p>
            {#if lineCount > 0}
              <p class="mt-1 text-sm text-slate-600">{lineProgressText}</p>
            {/if}
            <ul class="mt-4 grid grid-cols-3 gap-2 text-slate-600">
              {#each stats as stat (stat.label)}
                <li aria-label={statText(stat.label, stat.count)} class="border-t border-slate-200 pt-2">
                  <strong aria-hidden="true" class="block text-2xl font-bold text-slate-800">{stat.count}</strong>
                  <span aria-hidden="true" class="text-xs">{stat.label.replace('{n}', '').trim()}</span>
                </li>
              {/each}
            </ul>
          {:else if selection.kind === 'run'}
            {@const run = selection.run}
            <h3 class="text-lg font-bold">{run.label}</h3>
            {#if run.current}
              <p
                class="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700"
              >
                {sm.currentPosition}
              </p>
            {/if}
            <div class="mt-3 flex flex-col gap-2">
              <button
                type="button"
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-cyan-500"
                onclick={() => onJump(run.entrySceneId, 'start')}
              >
                {sm.jumpTo.replace('{label}', run.label)}
              </button>
              {#if canFold(run)}
                <button
                  type="button"
                  class="flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                  onclick={() => toggleFold(run)}
                >
                  {(isExpanded(run) ? sm.collapseRun : sm.expandRun).replace(
                    '{label}',
                    run.label
                  )}
                </button>
              {/if}
            </div>
          {:else if selection.kind === 'scene'}
            <h3 class="text-lg font-bold">{selection.label}</h3>
            {#if selection.current}
              <p
                class="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700"
              >
                {sm.currentPosition}
              </p>
            {/if}
            <div class="mt-3">
              <button
                type="button"
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-cyan-500"
                onclick={() => onJump(selection.sceneId, 'start')}
              >
                {sm.jumpTo.replace('{label}', selection.label)}
              </button>
            </div>
          {:else if selection.kind === 'decision'}
            {@const d = selection.decision}
            <h3 class="text-xs font-bold uppercase tracking-widest text-blue-600">{sm.decision}</h3>
            {#if choices[d.choiceId]?.prompt}
              <p class="mt-2 text-lg font-semibold leading-snug text-slate-700">
                {choices[d.choiceId].prompt}
              </p>
            {/if}
            <ul class="mt-4 space-y-3 text-sm">
              {#each d.options as option (option.id)}
                <li class="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    class={cn(
                      'mt-2 w-5 shrink-0',
                      option.child.kind === 'unknown'
                        ? 'border-t-[3px] border-dotted border-slate-400'
                        : option.child.status === 'route'
                          ? 'h-1 rounded-full bg-blue-500'
                          : 'h-1 rounded-full bg-teal-500'
                    )}
                  ></span>
                  <div class="min-w-0">
                    <span class="block font-semibold">{option.label}</span>
                    <span class="block text-xs text-slate-500">
                      <span>{option.child.kind === 'unknown'
                        ? sm.unreadLabel
                        : option.child.status === 'route'
                          ? sm.yourRoute
                          : sm.explored}</span>
                      {#if option.child.kind === 'run'}
                        <span aria-hidden="true"> &middot; </span>
                        <span>{option.child.label}</span>
                      {/if}
                    </span>
                  </div>
                </li>
              {/each}
            </ul>
            {#if selection.precedingSceneId}
              {@const preceding = selection.precedingSceneId}
              <div class="sticky bottom-0 mt-auto bg-[#f4f9fc] pt-3 lg:static lg:bg-transparent lg:pt-4">
                <button
                  type="button"
                  class="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-cyan-500"
                  onclick={() => onJump(preceding, 'end')}
                >
                  {sm.jumpToDecision}
                </button>
              </div>
            {/if}
          {:else if selection.kind === 'ending'}
            <h3 class="text-lg font-bold">
              {sm.endingLabel.replace('{label}', selection.ending.label)}
            </h3>
            <div class="sticky bottom-0 mt-auto bg-[#f4f9fc] pt-3 lg:static lg:bg-transparent lg:pt-4">
              <button
                type="button"
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-blue-600 hover:to-cyan-500"
                onclick={() => onJump(selection.ending.sceneId, 'start')}
              >
                {sm.jumpToEnding}
              </button>
            </div>
          {:else}
            <p class="text-sm italic text-slate-500">{sm.unreadLabel}</p>
          {/if}
        </aside>
      </div>
    </div>
  </div>
{/if}
