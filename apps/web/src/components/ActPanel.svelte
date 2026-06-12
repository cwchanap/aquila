<script lang="ts">
  import { getStoryFlow, getTranslations, type Locale } from '@aquila/stories';
  import Button from '@/components/ui/Button.svelte';

  let {
    storyId,
    currentSceneId,
    onNavigate,
    onToggle,
    open = false,
    locale = 'en',
  }: {
    storyId: string;
    currentSceneId: string;
    onNavigate: (sceneId: string) => void;
    onToggle: () => void;
    open?: boolean;
    locale?: Locale;
  } = $props();

  let expandedChapter: string | null = $state(null);
  let previousChapterKey: string | null = null;

  let t = $derived(getTranslations(locale));
  let chapterData = $derived(buildChapterData(storyId, currentSceneId));
  let currentAct = $derived(extractActName(currentSceneId));
  let currentChapterKey = $derived(extractChapterKey(currentSceneId));

  // Auto-expand the current chapter on scene change.
  // previousChapterKey is a plain let (not $state) intentionally — it's only
  // written here, never reactively read. The effect re-runs because
  // currentChapterKey ($derived) changes, and we compare against the stored
  // previous value to avoid re-expanding the same chapter.
  $effect(() => {
    if (currentChapterKey && currentChapterKey !== previousChapterKey) {
      expandedChapter = currentChapterKey;
      previousChapterKey = currentChapterKey;
    }
  });

  interface ActInfo {
    label: string;
    sceneId: string;
    sortKey: number;
    rawName: string;
  }

  interface ChapterGroup {
    chapterNum: number;
    label: string;
    acts: ActInfo[];
  }

  interface ChaptersResult {
    mode: 'chapters';
    chapters: ChapterGroup[];
  }

  interface BranchesResult {
    mode: 'branches';
    acts: ActInfo[];
  }

  type PanelData = ChaptersResult | BranchesResult;

  function extractChapterKey(sceneId: string): string | null {
    const match = sceneId.match(/^(ch\d+)_/);
    return match ? match[1] : null;
  }

  function extractChapterNum(sceneId: string): number | null {
    const match = sceneId.match(/^ch(\d+)_/);
    return match ? parseInt(match[1], 10) : null;
  }

  function extractActName(sceneId: string): string {
    const match = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
  }

  function actLabel(rawName: string): string {
    if (rawName === 'actFinal') return t.reader.actFinal;
    if (rawName === 'actEpilogue') return t.reader.actEpilogue;
    const numMatch = rawName.match(/act(\d+)/);
    if (numMatch) {
      return t.reader.actLabel.replace('{n}', numMatch[1]);
    }
    return rawName;
  }

  function actSortKey(rawName: string): number {
    if (rawName === 'actFinal') return 9998;
    if (rawName === 'actEpilogue') return 9999;
    const numMatch = rawName.match(/act(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : 0;
  }

  function extractBranchPrefix(sceneId: string): string {
    const match = sceneId.match(/^(.*?)(?:act\d+|actFinal|actEpilogue)/);
    return match ? match[1] : '';
  }

  function branchMatchScore(candidatePrefix: string, currentPrefix: string): number {
    if (!candidatePrefix && !currentPrefix) return 0;
    const cParts = candidatePrefix.split('_').filter(Boolean);
    const curParts = currentPrefix.split('_').filter(Boolean);
    let score = 0;
    for (let i = 0; i < Math.min(cParts.length, curParts.length); i++) {
      if (cParts[i] === curParts[i]) score++;
      else break;
    }
    return score;
  }

  function chapterLabel(num: number): string {
    return t.reader.chapterLabel.replace('{n}', String(num));
  }

  function buildChapterData(sid: string, sceneId: string): PanelData {
    const flow = getStoryFlow(sid);
    if (!flow) return { mode: 'branches', acts: [] };

    const hasChapters = flow.nodes.some(
      n => n.kind === 'scene' && /^ch\d+_/.test(n.sceneId)
    );

    if (hasChapters) {
      return buildChapters(flow);
    }

    return buildBranches(flow, sceneId);
  }

  function buildChapters(flow: { nodes: Array<{ kind: string; sceneId?: string }> }): ChaptersResult {
    const chapters: Record<number, Record<string, string>> = {};

    for (const node of flow.nodes) {
      if (node.kind !== 'scene') continue;
      if (!node.sceneId) continue;
      const sceneId = node.sceneId;
      const actMatch = sceneId.match(/(?:^|_)(act\d+|actFinal|actEpilogue)/);
      if (!actMatch) continue;

      const actName = actMatch[1];
      const chNum = extractChapterNum(sceneId);
      if (chNum === null) continue;

      if (!chapters[chNum]) {
        chapters[chNum] = {};
      }
      if (!chapters[chNum][actName]) {
        chapters[chNum][actName] = sceneId;
      }
    }

    const sorted = Object.entries(chapters)
      .map(([num, actsMap]) => ({
        chapterNum: Number(num),
        label: chapterLabel(Number(num)),
        acts: Object.entries(actsMap)
          .map(([rawName, sid]) => ({
            label: actLabel(rawName),
            sceneId: sid,
            sortKey: actSortKey(rawName),
            rawName,
          }))
          .sort((a, b) => a.sortKey - b.sortKey),
      }))
      .sort((a, b) => a.chapterNum - b.chapterNum);

    return { mode: 'chapters', chapters: sorted };
  }

  function buildBranches(flow: { nodes: Array<{ kind: string; sceneId?: string }> }, sceneId: string): BranchesResult {
    const actCandidates: Record<string, string[]> = {};

    for (const node of flow.nodes) {
      if (node.kind !== 'scene') continue;
      if (!node.sceneId) continue;
      const match = node.sceneId.match(
        /(?:^|_)(act\d+|actFinal|actEpilogue)/
      );
      if (!match) continue;
      const actName = match[1];
      if (!actCandidates[actName]) {
        actCandidates[actName] = [];
      }
      actCandidates[actName].push(node.sceneId);
    }

    const currentBranch = extractBranchPrefix(sceneId);
    const currentParts = currentBranch.split('_').filter(Boolean);

    function isOnBranch(candidatePrefix: string): boolean {
      if (!candidatePrefix && !currentBranch) return true;
      const candParts = candidatePrefix.split('_').filter(Boolean);
      const shorter = candParts.length <= currentParts.length ? candParts : currentParts;
      const longer = candParts.length <= currentParts.length ? currentParts : candParts;
      for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] !== longer[i]) return false;
      }
      return true;
    }

    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- plain Map is sufficient here because reactivity is already handled by the enclosing $derived.
    const actMap = new Map<string, string>();
    for (const [actName, candidates] of Object.entries(actCandidates)) {
      const onBranch = candidates.filter(c => isOnBranch(extractBranchPrefix(c)));
      if (onBranch.length === 0) continue;
      let bestScene = onBranch[0];
      let bestScore = branchMatchScore(extractBranchPrefix(bestScene), currentBranch);
      for (let i = 1; i < onBranch.length; i++) {
        const score = branchMatchScore(extractBranchPrefix(onBranch[i]), currentBranch);
        if (score > bestScore) {
          bestScore = score;
          bestScene = onBranch[i];
        }
      }
      actMap.set(actName, bestScene);
    }

    const acts = Array.from(actMap.entries())
      .map(([rawName, sid]) => ({
        label: actLabel(rawName),
        sceneId: sid,
        sortKey: actSortKey(rawName),
        rawName,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);

    return { mode: 'branches', acts };
  }

  function handleSelect(sceneId: string) {
    onNavigate(sceneId);
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onToggle();
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

<div
  class="h-full flex flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out {open ? 'w-[336px]' : 'w-12'}"
>
  <!-- Toggle tab -- always visible -->
  <button
    onclick={onToggle}
    class="w-12 h-full flex flex-col items-center shrink-0 justify-start pt-6 bg-white/95 backdrop-blur-xl border-r border-white/50 shadow-md hover:bg-white transition-colors"
    aria-label={open ? t.reader.closeActsPanel : t.reader.openActsPanel}
    aria-expanded={open}
  >
    {#if open}
      <svg
        class="w-5 h-5 text-slate-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
    {:else}
      <span
        class="text-sm font-bold text-slate-600 tracking-wider"
        style="writing-mode: vertical-rl;"
      >
        {t.reader.actPanel}
      </span>
    {/if}
  </button>

  <!-- Panel content -- pushes main content -->
  <div
    class="h-full w-72 overflow-y-auto flex-shrink-0 bg-white/95 backdrop-blur-xl border-r border-white/50 shadow-md transition-opacity duration-300 ease-in-out {open ? 'opacity-100' : 'opacity-0 pointer-events-none'}"
    aria-hidden={!open}
    inert={!open}
  >
    <div class="p-6">
      <h2 class="text-xl font-bold text-slate-800 mb-6">
        {t.reader.actPanel}
      </h2>

      {#if chapterData.mode === 'chapters'}
        <div class="space-y-1">
          {#each chapterData.chapters as chapter (chapter.chapterNum)}
            {@const chKey = 'ch' + chapter.chapterNum}
            {@const isExpanded = expandedChapter === chKey}
            {@const isCurrent = currentChapterKey === chKey}
            <div>
              <button
                class="w-full text-left px-3 py-2 rounded-lg font-semibold text-sm flex items-center justify-between {isCurrent
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                aria-expanded={isExpanded}
                aria-controls="chapter-{chapter.chapterNum}-acts"
                onclick={() => {
                  expandedChapter = expandedChapter === chKey ? null : chKey;
                }}
              >
                {chapter.label}
                <svg
                  class="w-4 h-4 motion-safe:transition-transform motion-safe:duration-200 {isExpanded ? 'rotate-180' : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {#if isExpanded}
                <div id="chapter-{chapter.chapterNum}-acts" class="ml-3 mt-1 space-y-1">
                  {#each chapter.acts as act (act.rawName)}
                    <Button
                      variant="menu"
                      onclick={() => handleSelect(act.sceneId)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 {act.rawName === currentAct && isCurrent
                        ? 'bg-blue-500 text-white font-semibold shadow-md text-sm tracking-normal normal-case hover:scale-100 border-transparent'
                        : 'bg-white/60 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-sm tracking-normal normal-case hover:scale-100 border-transparent'}"
                    >
                      {act.label}
                    </Button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="space-y-2">
          {#each chapterData.acts as act (act.rawName)}
            <Button
              variant="menu"
              onclick={() => handleSelect(act.sceneId)}
              className="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 {act.rawName === currentAct
                ? 'bg-blue-500 text-white font-semibold shadow-md text-base tracking-normal normal-case hover:scale-100 border-transparent'
                : 'bg-white/60 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-base tracking-normal normal-case hover:scale-100 border-transparent'}"
            >
              {act.label}
            </Button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
