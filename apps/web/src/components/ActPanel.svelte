<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { getStoryFlow, getTranslations, type Locale } from '@aquila/stories';

  export let storyId: string;
  export let currentSceneId: string;
  export let onNavigate: (sceneId: string) => void;
  export let locale: Locale = 'en';

  $: t = getTranslations(locale);
  $: acts = computeActs(storyId);
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

  function computeActs(sid: string): ActInfo[] {
    const flow = getStoryFlow(sid);
    if (!flow) return [];

    const actMap = new SvelteMap<string, string>();

    for (const node of flow.nodes) {
      if (node.kind !== 'scene') continue;
      const match = node.sceneId.match(
        /(?:^|_)(act\d+|actFinal|actEpilogue)/
      );
      if (!match) continue;
      const actName = match[1];
      if (!actMap.has(actName)) {
        actMap.set(actName, node.sceneId);
      }
    }

    return Array.from(actMap.entries())
      .map(([rawName, sceneId]) => ({
        label: actLabel(rawName),
        sceneId,
        sortKey: actSortKey(rawName),
        rawName,
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }

  function handleSelect(sceneId: string) {
    onNavigate(sceneId);
  }
</script>

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
          <button
            on:click={() => handleSelect(act.sceneId)}
            class="w-full text-left px-4 py-3 rounded-xl transition-all duration-200 {act.rawName === currentAct
              ? 'bg-blue-500 text-white font-semibold shadow-md'
              : 'bg-white/60 hover:bg-blue-50 text-slate-700 hover:text-blue-600'}"
          >
            {act.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>
