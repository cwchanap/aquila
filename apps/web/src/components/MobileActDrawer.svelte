<script lang="ts">
  import { getTranslations, type Locale } from '@aquila/stories';
  import {
    buildChapterData,
    extractActName,
    extractChapterKey,
  } from '@/lib/act-navigation';

  let {
    storyId,
    currentSceneId,
    onNavigate,
    onClose,
    open = false,
    locale = 'en',
  }: {
    storyId: string;
    currentSceneId: string;
    onNavigate: (sceneId: string) => void;
    onClose: () => void;
    open?: boolean;
    locale?: Locale;
  } = $props();

  let t = $derived(getTranslations(locale));
  let chapterData = $derived(buildChapterData(storyId, currentSceneId, t));
  let currentAct = $derived(extractActName(currentSceneId));
  let currentChapterKey = $derived(extractChapterKey(currentSceneId));

  function handleSelect(sceneId: string) {
    onNavigate(sceneId);
    onClose();
  }

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
    aria-label={t.reader.closeActsPanel}
    onclick={onClose}
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-50 w-4/5 max-w-xs overflow-y-auto bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out {open
    ? 'translate-x-0'
    : '-translate-x-full'}"
  aria-hidden={!open}
  inert={!open}
>
  <div class="p-6" style="padding-top: calc(1.5rem + env(safe-area-inset-top));">
    <div class="mb-6 flex items-center justify-between">
      <h2 class="text-xl font-bold text-slate-800">{t.reader.actPanel}</h2>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label={t.reader.closeActsPanel}
        onclick={onClose}
      >
        ✕
      </button>
    </div>

    {#if chapterData.mode === 'chapters'}
      <div class="space-y-3">
        {#each chapterData.chapters as chapter (chapter.chapterNum)}
          <div>
            <p class="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              {chapter.label}
            </p>
            <div class="ml-3 mt-1 space-y-1">
              {#each chapter.acts as act (act.rawName)}
                {@const isActive =
                  act.rawName === currentAct &&
                  extractChapterKey(act.sceneId) === currentChapterKey}
                <button
                  type="button"
                  class="w-full rounded-lg px-3 py-3 text-left text-sm {isActive
                    ? 'bg-blue-500 font-semibold text-white'
                    : 'bg-white/60 text-slate-700 hover:bg-blue-50'}"
                  onclick={() => handleSelect(act.sceneId)}
                >
                  {act.label}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-2">
        {#each chapterData.acts as act (act.rawName)}
          <button
            type="button"
            class="w-full rounded-xl px-4 py-3 text-left text-base {act.rawName ===
            currentAct
              ? 'bg-blue-500 font-semibold text-white'
              : 'bg-white/60 text-slate-700 hover:bg-blue-50'}"
            onclick={() => handleSelect(act.sceneId)}
          >
            {act.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</aside>
