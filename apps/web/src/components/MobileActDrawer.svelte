<script lang="ts">
  import { getTranslations, type Locale } from '@aquila/stories';
  import {
    buildChapterData,
    extractActName,
    extractChapterKey,
  } from '@/lib/act-navigation';
  import { ChevronDown, ChevronRight } from 'lucide-svelte';
  import { cn } from '@/lib/utils';
  import { focusTrap } from '@/lib/focus-trap';

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

  let expandedChapters = $state<number[]>([]);
  let seededFor: string | undefined = undefined;

  function isExpanded(num: number): boolean {
    return expandedChapters.includes(num);
  }

  function toggleChapter(num: number): void {
    expandedChapters = isExpanded(num)
      ? expandedChapters.filter(n => n !== num)
      : [...expandedChapters, num];
  }

  // Seed the open chapter once per current scene: expand the chapter that
  // holds the current act, collapse the rest. User toggles persist until the
  // current scene changes.
  $effect(() => {
    if (chapterData.mode !== 'chapters') return;
    if (seededFor === currentSceneId) return;
    seededFor = currentSceneId;
    expandedChapters = chapterData.chapters
      .filter(ch =>
        ch.acts.some(a => extractChapterKey(a.sceneId) === currentChapterKey)
      )
      .map(ch => ch.chapterNum);
  });

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

<div
  use:focusTrap={open}
  class={cn(
    'fixed inset-y-0 left-0 z-50 w-4/5 max-w-xs overflow-y-auto bg-white/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-in-out',
    open ? 'translate-x-0' : '-translate-x-full'
  )}
  role="dialog"
  aria-modal={open ? 'true' : undefined}
  aria-labelledby="acts-panel-title"
  aria-hidden={!open}
  inert={!open}
>
  <div class="p-6" style="padding-top: calc(1.5rem + env(safe-area-inset-top));">
    <div class="mb-6 flex items-center justify-between">
      <h2 id="acts-panel-title" class="text-xl font-bold text-slate-800">{t.reader.actPanel}</h2>
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
            <button
              type="button"
              class="flex w-full items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              aria-expanded={isExpanded(chapter.chapterNum)}
              aria-controls={`chapter-acts-${chapter.chapterNum}`}
              onclick={() => toggleChapter(chapter.chapterNum)}
            >
              <span>{chapter.label}</span>
              {#if isExpanded(chapter.chapterNum)}
                <ChevronDown size={18} aria-hidden="true" />
              {:else}
                <ChevronRight size={18} aria-hidden="true" />
              {/if}
            </button>
            {#if isExpanded(chapter.chapterNum)}
              <div
                id={`chapter-acts-${chapter.chapterNum}`}
                class="ml-3 mt-1 space-y-1"
              >
                {#each chapter.acts as act (act.rawName)}
                  {@const isActive =
                    act.rawName === currentAct &&
                    extractChapterKey(act.sceneId) === currentChapterKey}
                  <button
                    type="button"
                    class={cn(
                      'w-full rounded-lg px-3 py-3 text-left text-sm',
                      isActive
                        ? 'bg-blue-500 font-semibold text-white'
                        : 'bg-white/60 text-slate-700 hover:bg-blue-50'
                    )}
                    onclick={() => handleSelect(act.sceneId)}
                  >
                    {act.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-2">
        {#each chapterData.acts as act (act.rawName)}
          <button
            type="button"
            class={cn(
              'w-full rounded-xl px-4 py-3 text-left text-base',
              act.rawName === currentAct
                ? 'bg-blue-500 font-semibold text-white'
                : 'bg-white/60 text-slate-700 hover:bg-blue-50'
            )}
            onclick={() => handleSelect(act.sceneId)}
          >
            {act.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
