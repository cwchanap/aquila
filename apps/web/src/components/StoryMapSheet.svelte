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
    trunkGap: 36,
    runWidth: 148,
    sceneWidth: 44,
    sceneGap: 16,
    decisionWidth: 44,
    markerWidth: 44,
  };

  let expandedRunIds = new SvelteSet<string>();
  let selectedId = $state<string | null>(null);
  let mapEl = $state<HTMLElement | null>(null);

  let view = $derived(
    buildStoryMap({ flow, choices, progress, currentSceneId, t })
  );
  let layout = $derived(layoutStoryMap(view, expandedRunIds, MAP_METRICS));
  let nodesById = $derived(new SvelteMap(layout.nodes.map(n => [n.id, n])));
  let sm = $derived(t.reader.storyMap);

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
    const decision = index.decisions.get(id);
    if (decision) return { kind: 'decision', ...decision };
    const ending = index.endings.get(id);
    if (ending) return { kind: 'ending', ending };
    if (index.unknowns.has(id)) return { kind: 'unknown' };
    const run = index.runs.get(id);
    if (run) return { kind: 'run', run };
    const sceneRun = index.scenes.get(id);
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
    const selected = selectedId === node.id;
    if (node.kind === 'run') {
      return cn(
        'rounded-full bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-md ring-1 ring-sky-200 hover:bg-white',
        selected && 'ring-2 ring-blue-600'
      );
    }
    return cn(
      'rounded-full',
      selected && 'ring-2 ring-blue-700 ring-offset-1 ring-offset-sky-100'
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
  ): { x: number; y: number } | null {
    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);
    if (!a || !b) return null;
    return {
      x: (a.x + a.width + b.x) / 2,
      y: b.y + b.height / 2 - 14,
    };
  }

  function scrollCurrentIntoView(): void {
    if (!mapEl) return;
    const el = mapEl.querySelector('[data-current="true"]');
    if (!(el instanceof HTMLElement)) return;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const container = mapEl.getBoundingClientRect();
    const node = el.getBoundingClientRect();
    const caption = el.querySelector('[data-current-caption]');
    const captionBox = caption?.getBoundingClientRect() ?? node;
    const top = Math.min(node.top, captionBox.top);
    const bottom = Math.max(node.bottom, captionBox.bottom);
    const dx = Math.max(node.right, captionBox.right) - container.right;
    let dy = 0;
    if (top < container.top) dy = top - container.top;
    else if (bottom > container.bottom) dy = bottom - container.bottom;
    mapEl.scrollTo({
      left: mapEl.scrollLeft + Math.ceil(dx),
      top: mapEl.scrollTop + Math.ceil(dy),
      behavior: reduce ? 'auto' : 'smooth',
    });
  }

  function locateCurrent(): void {
    const current = layout.nodes.find(n => n.current);
    if (current) selectedId = current.id;
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
          <h2 id="story-map-title" class="text-xl font-bold text-slate-900">
            {sm.title}
          </h2>
          <p class="truncate text-sm text-slate-600">{storyTitle}</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="flex h-11 items-center gap-2 rounded-full bg-white/80 px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-white/70 backdrop-blur-sm hover:bg-white"
            onclick={locateCurrent}
          >
            <Crosshair size={16} aria-hidden="true" />
            {sm.locateCurrent}
          </button>
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-600 shadow-sm ring-1 ring-white/70 backdrop-blur-sm hover:bg-white"
            aria-label={sm.close}
            onclick={onClose}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6 lg:flex-row">
        <div
          bind:this={mapEl}
          data-testid="story-map-surface"
          class="relative min-h-0 flex-1 overflow-auto overscroll-contain rounded-2xl bg-white/55 ring-1 ring-white/70 backdrop-blur-md"
        >
          <div
            class="relative"
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
                  <stop offset="0" stop-color="#2563eb" />
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
                {#if edge.label}
                  {@const pos = edgeLabelPos(edge)}
                  {#if pos}
                    <text
                      x={pos.x}
                      y={pos.y}
                      text-anchor="middle"
                      font-size="11"
                      class="fill-slate-600 font-semibold"
                    >
                      {edge.label}
                    </text>
                  {/if}
                {/if}
              {/each}
            </svg>
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
                data-selected={selectedId === node.id ? 'true' : undefined}
                data-current={node.current ? 'true' : undefined}
                aria-label={nodeLabel(node)}
                aria-pressed={selectedId === node.id}
                aria-expanded={expandable ? 'false' : undefined}
                aria-current={node.current ? 'location' : undefined}
                onclick={() => activateNode(node)}
                onkeydown={e => handleNodeKeydown(e, node)}
              >
                {#if node.kind === 'run'}
                  <span class="truncate">{node.label}</span>
                {:else if node.kind === 'scene'}
                  {#if node.current}
                    <span
                      aria-hidden="true"
                      class="absolute h-8 w-8 rounded-full bg-blue-400/40 motion-safe:animate-ping"
                    ></span>
                    <span
                      aria-hidden="true"
                      class="h-4 w-4 rounded-full bg-blue-600 shadow ring-2 ring-white"
                    ></span>
                    <span
                      data-current-caption
                      class="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-blue-800"
                    >
                      {sm.currentPosition}
                    </span>
                  {:else}
                    <span
                      aria-hidden="true"
                      class="h-3.5 w-3.5 rounded-full bg-white shadow ring-2 ring-slate-400/60"
                    ></span>
                  {/if}
                {:else if node.kind === 'decision'}
                  <span
                    aria-hidden="true"
                    class="h-5 w-5 rotate-45 rounded-[5px] bg-amber-400 shadow ring-2 ring-amber-200"
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
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <aside
          data-testid="story-map-details"
          aria-live="polite"
          class="max-h-[38%] w-full shrink-0 overflow-y-auto rounded-2xl bg-white/90 p-4 text-slate-800 shadow-inner ring-1 ring-white/70 backdrop-blur-md lg:max-h-none lg:w-80"
        >
          {#if selection.kind === 'current'}
            <h3
              class="text-xs font-bold uppercase tracking-widest text-slate-500"
            >
              {sm.currentPosition}
            </h3>
            <p class="mt-2 text-lg font-semibold">{currentActLabel}</p>
            {#if lineCount > 0}
              <p class="mt-1 text-sm text-slate-600">{lineProgressText}</p>
            {/if}
            <ul class="mt-4 space-y-1 text-sm text-slate-600">
              <li>{statText(sm.statsActs, view.stats.acts)}</li>
              <li>{statText(sm.statsDecisions, view.stats.decisions)}</li>
              <li>{statText(sm.statsEndings, view.stats.endings)}</li>
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
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
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
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                onclick={() => onJump(selection.sceneId, 'start')}
              >
                {sm.jumpTo.replace('{label}', selection.label)}
              </button>
            </div>
          {:else if selection.kind === 'decision'}
            {@const d = selection.decision}
            <h3 class="text-lg font-bold">{sm.decision}</h3>
            {#if choices[d.choiceId]?.prompt}
              <p class="mt-1 text-sm text-slate-600">
                {choices[d.choiceId].prompt}
              </p>
            {/if}
            <ul class="mt-3 space-y-1.5 text-sm">
              {#each d.options as option (option.id)}
                <li class="flex items-center justify-between gap-2">
                  <span class="font-medium">{option.label}</span>
                  <span
                    class={option.child.kind === 'run'
                      ? 'text-slate-600'
                      : 'italic text-slate-400'}
                  >
                    {option.child.kind === 'run'
                      ? option.child.label
                      : sm.unreadLabel}
                  </span>
                </li>
              {/each}
            </ul>
            {#if selection.precedingSceneId}
              {@const preceding = selection.precedingSceneId}
              <div class="mt-3">
                <button
                  type="button"
                  class="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  onclick={() => onJump(preceding, 'end')}
                >
                  {sm.jumpTo.replace(
                    '{label}',
                    sceneLabel(preceding, index.scenes.get(preceding))
                  )}
                </button>
              </div>
            {/if}
          {:else if selection.kind === 'ending'}
            <h3 class="text-lg font-bold">
              {sm.endingLabel.replace('{label}', selection.ending.label)}
            </h3>
            <div class="mt-3">
              <button
                type="button"
                class="flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700"
                onclick={() => onJump(selection.ending.sceneId, 'start')}
              >
                {sm.jumpTo.replace('{label}', selection.ending.label)}
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
