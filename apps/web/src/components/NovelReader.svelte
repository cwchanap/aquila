<script lang="ts">
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories';
  import ActPanel from '@/components/ActPanel.svelte';
  import { typeText as runTypewriter } from '@/lib/typewriter';
  import { resolveCharacterName } from '@/lib/character-name';
  import { onDestroy } from 'svelte';

  // Pure controlled reader. All session state arrives via props; the only
  // outward signal is onIndexChange. No readerState import.
  let {
    dialogueIndex = 0,
    onIndexChange = () => {},
    dialogue = [],
    choice = null,
    storyId,
    currentSceneId,
    canGoNext = false,
    locale = 'en',
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    backUrl = '/',
    showBookmarkButton = true,
  }: {
    dialogueIndex?: number;
    onIndexChange?: (index: number) => void;
    dialogue?: DialogueEntry[];
    choice?: ChoiceDefinition | null;
    storyId?: string;
    currentSceneId?: string;
    canGoNext?: boolean;
    locale?: Locale;
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    backUrl?: string;
    showBookmarkButton?: boolean;
  } = $props();

  let t = $derived(getTranslations(locale as Locale));

  // Derived view state — the visible reader is a pure function of the index.
  let completedDialogues = $derived(dialogue.slice(0, dialogueIndex));
  let currentDialogue = $derived(dialogue[dialogueIndex]);
  let isLastDialogue = $derived(dialogueIndex >= dialogue.length - 1);

  // Component-local presentation state only.
  let isTyping = $state(false);
  let typingSpeed = 30;
  let skipTyping = $state(false);
  let typingText = $state('');
  let sceneVersion = $state(0);
  let showActPanel = $state(false);
  let dialogueContainer: HTMLElement | null = $state(null);
  // Tracked so onDestroy can clear a pending scroll-to-bottom; otherwise the
  // 50ms timer can fire after unmount and touch a nulled dialogueContainer.
  let scrollTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  // Cancel any in-flight typewriter when the component unmounts so pending
  // onTick callbacks don't mutate state on a destroyed component.
  onDestroy(() => {
    sceneVersion++;
    if (scrollTimer !== null) {
      globalThis.clearTimeout(scrollTimer);
      scrollTimer = null;
    }
  });

  // Two-signal typewriter bookkeeping (plain variables — must NOT be reactive,
  // otherwise writing them would re-trigger these effects).
  let lastDialogueRef: DialogueEntry[] | undefined = undefined;
  let lastIndex = dialogueIndex;
  // The exact index a self-initiated advance expects to land on, or null when
  // the next index change is external (popstate/restore/breakpoint swap). Tying
  // the flag to the TARGET index rather than a boolean fixes the same-tick
  // race where a popstate overrides the index between handleNext and Signal 2:
  // a boolean would still be true and animate the popstate's line, but the
  // target-index check fails (popstate's index !== target) and snaps per spec.
  let selfAdvanceTarget: number | null = null;

  function getCharacterName(dialogueEntry: DialogueEntry | undefined): string {
    return resolveCharacterName(dialogueEntry, t);
  }

  function scrollToBottom() {
    if (scrollTimer !== null) globalThis.clearTimeout(scrollTimer);
    scrollTimer = globalThis.setTimeout(() => {
      scrollTimer = null;
      if (dialogueContainer) {
        dialogueContainer.scrollTop = dialogueContainer.scrollHeight;
      }
    }, 50);
  }

  // Typewriter runner. Captures sceneVersion for cancellation when a new
  // scene or a new line supersedes the in-flight animation.
  async function startTyping(index: number) {
    const entry = dialogue[index];
    if (!entry) return;
    typingText = '';
    isTyping = true;
    skipTyping = false;
    const version = sceneVersion;
    scrollToBottom();
    const result = await runTypewriter({
      text: entry.dialogue,
      speed: typingSpeed,
      onTick: (partial: string) => {
        typingText = partial;
      },
      isSkipped: () => skipTyping,
      isCancelled: () => version !== sceneVersion,
    });
    if (result === 'cancelled') return;
    typingText = entry.dialogue;
    isTyping = false;
  }

  // Signal 1 — new scene (dialogue reference change): ALWAYS animate the line
  // at dialogueIndex, even at index 0. Reset all presentation state first.
  // EXCEPTION: on the very first mount (lastDialogueRef === undefined) with a
  // nonzero dialogueIndex, the index came from a bookmark/deep-link restore or
  // a responsive-breakpoint remount — the user expects the active line fully
  // revealed, not re-typed. Snapping (isTyping stays false) makes the template
  // render currentDialogue.dialogue directly. A first mount at index 0 is a
  // fresh scene and still animates per spec.
  $effect(() => {
    if (dialogue !== lastDialogueRef) {
      const isFirstMount = lastDialogueRef === undefined;
      lastDialogueRef = dialogue;
      sceneVersion++;
      isTyping = false;
      skipTyping = false;
      typingText = '';
      selfAdvanceTarget = null;
      // Sync lastIndex so Signal 2 does not also fire for this same tick.
      lastIndex = dialogueIndex;
      if (dialogue.length > 0) {
        if (isFirstMount && dialogueIndex > 0) {
          // Snap restore (bookmark/deep-link/breakpoint remount): reveal the
          // full line immediately (no animation) AND schedule a scroll so the
          // active line is visible inside the overflowing dialogue container
          // (max-h-[70vh] overflow-y-auto). startTyping — the only path that
          // calls scrollToBottom — is skipped here, so without this the
          // restored active line can remain below the viewport.
          scrollToBottom();
        } else {
          void startTyping(dialogueIndex);
        }
      }
    }
  });

  // Signal 2 — index change within the SAME scene. selfAdvanceTarget
  // distinguishes a user-driven advance (animate) from an external change like
  // popstate (snap). The target is cleared BEFORE branching so a same-tick
  // popstate that overrides the index cannot see a stale target on a later
  // run; and the target-index check (=== dialogueIndex) ensures that even if
  // the popstate lands in the SAME effect batch as the advance, the popstate's
  // index won't match the advance's target → snap, per spec §239-241.
  $effect(() => {
    if (dialogue === lastDialogueRef && dialogueIndex !== lastIndex) {
      const wasSelfAdvance = selfAdvanceTarget === dialogueIndex;
      selfAdvanceTarget = null;
      if (wasSelfAdvance) {
        sceneVersion++;
        void startTyping(dialogueIndex);
      } else {
        // External change: reveal the full line immediately, no animation.
        // (typingText write intentionally omitted — the template renders
        // currentDialogue.dialogue directly when isTyping === false.)
        sceneVersion++;
        isTyping = false;
      }
    }
    lastIndex = dialogueIndex;
  });

  function handleNext() {
    if (isTyping) {
      // First interaction during typing only skips the animation; it must NOT
      // advance the index (the parent owns the index).
      skipTyping = true;
      return;
    }
    if (dialogueIndex < dialogue.length - 1) {
      selfAdvanceTarget = dialogueIndex + 1;
      onIndexChange(dialogueIndex + 1);
      skipTyping = false;
    } else if (canGoNext && !choice) {
      onNext();
    }
  }

  function handleChoice(nextScene: string) {
    onChoice(nextScene);
  }

  function handleKeyPress(event: globalThis.KeyboardEvent) {
    if (event.defaultPrevented) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const activeElement = globalThis.document
      .activeElement as HTMLElement | null;
    const rawTarget = (event.target ?? activeElement) as unknown;
    const target = rawTarget instanceof HTMLElement ? rawTarget : activeElement;

    if (target) {
      const tagName = target.tagName.toLowerCase();
      const interactiveTags = ['input', 'textarea', 'select', 'option', 'button', 'a'];
      const hasEditableAttr =
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true';

      if (interactiveTags.includes(tagName) || hasEditableAttr) {
        return;
      }
    }
    event.preventDefault();
    handleNext();
  }
</script>

<svelte:window onkeydown={handleKeyPress} />

<div
  class="novel-reader min-h-screen bg-linear-to-b from-sky-200 via-sky-300 to-blue-400 flex overflow-hidden"
>
  <!-- Left panel — embedded toggle, slider animation -->
  <aside class="flex-shrink-0 h-screen">
    {#if storyId && currentSceneId}
      <ActPanel
        {storyId}
        {currentSceneId}
        open={showActPanel}
        onToggle={() => (showActPanel = !showActPanel)}
        onNavigate={(sceneId: string) => {
          if (sceneId !== currentSceneId) {
            onNavigate(sceneId);
          }
        }}
        {locale}
      />
    {/if}
  </aside>

  <!-- Main content area -->
  <main class="flex-1 flex items-center justify-center p-6 relative min-w-0">
    <!-- Back button at top right -->
    <div class="absolute top-6 right-6 z-10">
      <a
        href={backUrl}
        class="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
      >
        {t.common.backToHome}
      </a>
    </div>

    <div class="w-full max-w-4xl">
    <!-- Main dialogue box with glassmorphism style -->
    <div
      bind:this={dialogueContainer}
      class="bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/50 max-h-[70vh] overflow-y-auto scroll-smooth"
    >
      <!-- Completed history: every line strictly before dialogueIndex -->
      {#each completedDialogues as entry, index (index)}
        <div
          class="mb-6 {index < completedDialogues.length - 1 || isTyping || currentDialogue
            ? 'pb-6 border-b border-slate-200'
            : ''}"
        >
          <div class="flex gap-4 items-start">
            <div class="w-32 shrink-0">
              {#if getCharacterName(entry)}
                <span
                  class="text-xl font-bold text-blue-600 px-4 py-2 bg-blue-100/80 rounded-xl inline-block"
                >
                  {getCharacterName(entry)}
                </span>
              {/if}
            </div>
            <div class="flex-1 text-lg text-slate-800 leading-relaxed">
              {entry.dialogue}
            </div>
          </div>
        </div>
      {/each}

      <!-- Active line (dialogue[dialogueIndex]): typing or fully revealed -->
      {#if currentDialogue}
        <div class="mb-6">
          <div class="flex gap-4 items-start">
            <div class="w-32 shrink-0">
              {#if getCharacterName(currentDialogue)}
                <span
                  class="text-xl font-bold text-blue-600 px-4 py-2 bg-blue-100/80 rounded-xl inline-block"
                >
                  {getCharacterName(currentDialogue)}
                </span>
              {/if}
            </div>
            <div
              class="flex-1 text-lg text-slate-800 leading-relaxed min-h-[60px]"
            >
              {#if isTyping}
                {typingText}
                <span class="inline-block w-2 h-5 bg-blue-600 ml-1 animate-pulse"
                ></span>
              {:else}
                {currentDialogue.dialogue}
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <!-- Continue indicator -->
      {#if !isTyping && !choice}
        <div class="text-center">
          <button
            onclick={handleNext}
            class="group px-8 py-3 bg-linear-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            {#if isLastDialogue && canGoNext}
              {t.reader.nextScene}
            {:else if isLastDialogue}
              {t.reader.complete}
            {:else}
              {t.reader.continue}
            {/if}
          </button>
        </div>
      {/if}

      <!-- Choice options -->
      {#if choice && !isTyping && isLastDialogue}
        <div class="mt-6 space-y-4">
          <p class="text-lg font-semibold text-slate-700 mb-4">
            {choice.prompt}
          </p>
          {#each choice.options as option (option.id)}
            <button
              onclick={() => handleChoice(option.nextScene)}
              class="w-full p-4 bg-linear-to-r from-slate-100 to-white hover:from-blue-100 hover:to-cyan-50 text-slate-800 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] border-2 border-slate-200 hover:border-blue-300 text-left"
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Action buttons -->
    <div class="mt-6 flex justify-between items-center">
      <!-- Bookmark button -->
      {#if showBookmarkButton}
        <button
          onclick={() => onBookmark(dialogueIndex + 1)}
          class="px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-white/40"
        >
          {t.reader.bookmark}
        </button>
      {/if}

      <!-- Progress indicator -->
      <div class="text-white/90 text-sm font-medium">
        {t.reader.pageDisplay
          .replace('{current}', (dialogueIndex + 1).toString())
          .replace('{total}', dialogue.length.toString())}
      </div>
    </div>
    </div>
  </main>
</div>

<style>
  .novel-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
