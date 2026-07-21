<script lang="ts">
  import type { Locale, StoryFlowConfig } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import Button from '@/components/ui/Button.svelte';
  import {
    buildChapterData,
    extractActName,
    extractChapterKey,
  } from '@/lib/act-navigation';

  let {
    flow,
    storyId,
    currentSceneId,
    onNavigate,
    onToggle,
    open = false,
    locale = 'en',
  }: {
    flow: StoryFlowConfig;
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
  let chapterData = $derived(buildChapterData(flow, currentSceneId, t));
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
  data-story-id={storyId}
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
