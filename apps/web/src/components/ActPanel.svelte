<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { getStoryFlow, getTranslations, type Locale } from '@aquila/stories';
  import Button from '@/components/ui/Button.svelte';

  export let storyId: string;
  export let currentSceneId: string;
  export let onNavigate: (sceneId: string) => void;
  export let locale: Locale = 'en';

  $: t = getTranslations(locale);
  $: acts = computeActs(storyId, currentSceneId);
  $: currentAct = extractActName(currentSceneId);

  interface ActInfo {
    label: string;
    sceneId: string;
    sortKey: number;
    rawName: string;
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

  function computeActs(sid: string, sceneId: string): ActInfo[] {
    const flow = getStoryFlow(sid);
    if (!flow) return [];

    // Collect all candidate scenes grouped by act name
    const actCandidates: Record<string, string[]> = {};

    for (const node of flow.nodes) {
      if (node.kind !== 'scene') continue;
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

    // For each act, pick the candidate whose branch prefix best matches the current scene
    const currentBranch = extractBranchPrefix(sceneId);

    const actMap = new SvelteMap<string, string>();
    for (const [actName, candidates] of Object.entries(actCandidates)) {
      let bestScene = candidates[0];
      let bestScore = branchMatchScore(extractBranchPrefix(bestScene), currentBranch);
      for (let i = 1; i < candidates.length; i++) {
        const score = branchMatchScore(extractBranchPrefix(candidates[i]), currentBranch);
        if (score > bestScore) {
          bestScore = score;
          bestScene = candidates[i];
        }
      }
      actMap.set(actName, bestScene);
    }

    return Array.from(actMap.entries())
      .map(([rawName, sid]) => ({
        label: actLabel(rawName),
        sceneId: sid,
        sortKey: actSortKey(rawName),
        rawName,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }

  function handleSelect(sceneId: string) {
    onNavigate(sceneId);
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onNavigate(currentSceneId);
    }
  }
</script>

<svelte:window on:keydown={handleEscape} />

<div class="fixed inset-0 z-50 flex justify-end" on:click|self={() => onNavigate(currentSceneId)}>
  <div
    class="w-80 max-w-[85vw] h-full bg-white/95 backdrop-blur-xl shadow-2xl border-l border-white/50 overflow-y-auto"
    on:click|stopPropagation
  >
    <div class="p-6">
      <h2 class="text-xl font-bold text-slate-800 mb-6">
        {t.reader.actPanel}
      </h2>

      <div class="space-y-2">
        {#each acts as act (act.rawName)}
          <Button
            variant="menu"
            on:click={() => handleSelect(act.sceneId)}
            className="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 {act.rawName === currentAct
              ? 'bg-blue-500 text-white font-semibold shadow-md text-base tracking-normal normal-case hover:scale-100 border-transparent'
              : 'bg-white/60 hover:bg-blue-50 text-slate-700 hover:text-blue-600 text-base tracking-normal normal-case hover:scale-100 border-transparent'}"
          >
            {act.label}
          </Button>
        {/each}
      </div>
    </div>
  </div>
</div>
