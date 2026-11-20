<script lang="ts">
  import RubyText from '@/components/RubyText.svelte';
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
    StoryFlowConfig,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import ActPanel from '@/components/ActPanel.svelte';
  import { typeText as runTypewriter } from '@/lib/typewriter';
  import { resolveCharacterName } from '@/lib/character-name';
  import {
    getReaderAdvanceDecision,
    getReaderAdvanceLabel,
    isReaderInteractiveTarget,
  } from '@/lib/reader-interaction';
  import { onDestroy, untrack } from 'svelte';

  // Pure controlled reader. All session state arrives via props; the only
  // outward signal is onIndexChange. No readerState import.
  let {
    flow,
    dialogueIndex = 0,
    onIndexChange = () => {},
    dialogue = [],
    choice = null,
    storyId,
    currentSceneId,
    canGoNext = false,
    locale = 'en',
    onOpenChoice = () => {},
    onNext = () => {},
    onNavigate = () => {},
    isInitialMount = true,
    interactionDisabled = false,
    secondDialogue = null,
    textLang = undefined,
    secondLang = undefined,
    furigana = true,
    typingDelay = 30,
    visibleSceneIds,
    backUrl,
  }: {
    flow: StoryFlowConfig;
    dialogueIndex?: number;
    onIndexChange?: (index: number) => void;
    dialogue?: DialogueEntry[];
    choice?: ChoiceDefinition | null;
    storyId?: string;
    currentSceneId?: string;
    canGoNext?: boolean;
    locale?: Locale;
    onOpenChoice?: () => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    isInitialMount?: boolean;
    interactionDisabled?: boolean;
    /** Second-language lines aligned 1:1 with `dialogue`, or null when off. */
    secondDialogue?: DialogueEntry[] | null;
    textLang?: string;
    secondLang?: string;
    /** Show furigana over Japanese text that has it. */
    furigana?: boolean;
    typingDelay?: number;
    visibleSceneIds?: ReadonlySet<string>;
    backUrl?: string;
  } = $props();

  let t = $derived(getTranslations(locale as Locale));

  // Derived view state — the visible reader is a pure function of the index.
  let completedDialogues = $derived(dialogue.slice(0, dialogueIndex));
  let currentDialogue = $derived(dialogue[dialogueIndex]);
  let advanceLabel = $derived(
    getReaderAdvanceLabel(
      {
        index: dialogueIndex,
        length: dialogue.length,
        canGoNext,
        hasChoice: !!choice,
      },
      t.reader
    )
  );

  // Component-local presentation state only.
  let isTyping = $state(false);
  let skipTyping = $state(false);
  let typingText = $state('');
  let sceneVersion = $state(0);
  let showActPanel = $state(false);
  let dialogueContainer: HTMLElement | null = $state(null);
  let activeLineEl: HTMLElement | null = $state(null);
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

  function scrollToActiveLine() {
    if (scrollTimer !== null) globalThis.clearTimeout(scrollTimer);
    scrollTimer = globalThis.setTimeout(() => {
      scrollTimer = null;
      if (!dialogueContainer) return;
      const active = activeLineEl;
      if (active && active.offsetHeight > dialogueContainer.clientHeight) {
        // An active passage taller than the viewport reserves its full height
        // while typing, so bottom-aligning would push the typed prefix above
        // the visible region — pin the line's start instead.
        dialogueContainer.scrollTop +=
          active.getBoundingClientRect().top -
          dialogueContainer.getBoundingClientRect().top;
      } else {
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
    scrollToActiveLine();
    // The current delay must not become a dependency of the scene effect.
    const result = await untrack(() => runTypewriter({
      text: entry.dialogue,
      delay: () => typingDelay,
      onTick: (partial: string) => {
        typingText = partial;
      },
      isSkipped: () => skipTyping,
      isCancelled: () => version !== sceneVersion,
    }));
    if (result === 'cancelled') return;
    typingText = entry.dialogue;
    isTyping = false;
  }

  // Signal 1 — new scene (dialogue reference change): ALWAYS animate the line
  // at dialogueIndex, even at index 0. Reset all presentation state first.
  // EXCEPTIONS (snap — reveal the full line immediately, no animation):
  //   1. First mount (lastDialogueRef === undefined) with a nonzero
  //      dialogueIndex: the index came from a bookmark/deep-link restore — the
  //      user expects the active line fully revealed, not re-typed.
  //   2. First mount that is NOT the initial scene mount (`isInitialMount ===
  //      false`): this is a responsive-breakpoint remount — ReaderShell swapped
  //      desktop/mobile leaves across the 1023px breakpoint. The line at
  //      dialogueIndex was already visible (typed or revealed) on the prior
  //      leaf, so re-typing it — including at index 0 — would restart an
  //      already-completed animation. Snap preserves the user's reading
  //      position across the layout change.
  // A first mount at index 0 WITH `isInitialMount === true` is a genuine fresh
  // scene start and still animates per spec.
  $effect(() => {
    if (dialogue !== lastDialogueRef) {
      const isFirstMount = lastDialogueRef === undefined;
      const isBreakpointRemount = isFirstMount && !isInitialMount;
      const isRestoreAtNonzero = isFirstMount && dialogueIndex > 0;
      lastDialogueRef = dialogue;
      sceneVersion++;
      isTyping = false;
      skipTyping = false;
      typingText = '';
      selfAdvanceTarget = null;
      // Sync lastIndex so Signal 2 does not also fire for this same tick.
      lastIndex = dialogueIndex;
      if (dialogue.length > 0) {
        if (isRestoreAtNonzero || isBreakpointRemount) {
          // Snap restore (bookmark/deep-link/breakpoint remount): reveal the
          // full line immediately (no animation) AND schedule a scroll so the
          // active line is visible inside the overflowing dialogue container
          // (max-h-[70vh] overflow-y-auto). startTyping — the only path that
          // calls scrollToActiveLine — is skipped here, so without this the
          // restored active line can remain below the viewport.
          scrollToActiveLine();
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
    if (interactionDisabled) return;
    const decision = getReaderAdvanceDecision({
      isTyping,
      index: dialogueIndex,
      length: dialogue.length,
      canGoNext,
      hasChoice: !!choice,
    });
    if (decision === 'skip') {
      skipTyping = true;
      return;
    }
    if (decision === 'advance-line') {
      selfAdvanceTarget = dialogueIndex + 1;
      onIndexChange(dialogueIndex + 1);
      return;
    }
    if (decision === 'open-choice') {
      onOpenChoice();
      return;
    }
    if (decision === 'advance-scene' || decision === 'complete') onNext();
  }

  function handleKeyPress(event: globalThis.KeyboardEvent) {
    if (interactionDisabled) return;
    if (event.defaultPrevented) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    if (isReaderInteractiveTarget(event.target ?? document.activeElement)) return;
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
        {flow}
        {storyId}
        {currentSceneId}
        {visibleSceneIds}
        open={showActPanel}
        onToggle={() => (showActPanel = !showActPanel)}
        onNavigate={(sceneId: string) => {
          if (sceneId !== currentSceneId) {
            onNavigate(sceneId);
          }
        }}
        {locale}
        {backUrl}
      />
    {/if}
  </aside>

  <!-- Main content area -->
  <main class="flex-1 flex items-center justify-center p-6 relative min-w-0">
    <div class="w-full max-w-4xl">
    <!-- Main dialogue box with glassmorphism style -->
    <div class="bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/50">
    <div bind:this={dialogueContainer} class="reader-scroll max-h-[70vh] overflow-y-auto scroll-smooth">
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
              <span lang={textLang}><RubyText text={entry.dialogue} ruby={entry.ruby} show={furigana} /></span>
              {#if secondDialogue?.[index]}
                <span
                  class="second-line mt-1 block text-base text-slate-500"
                  lang={secondLang}
                  data-testid="second-line"
                >
                  <RubyText text={secondDialogue[index].dialogue} ruby={secondDialogue[index].ruby} show={furigana} />
                </span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      <!-- Active line (dialogue[dialogueIndex]): typing or fully revealed -->
      {#if currentDialogue}
        <div class="mb-6" bind:this={activeLineEl}>
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
            <div class="passage-grid flex-1 text-lg text-slate-800 leading-relaxed min-h-[60px] min-w-0">
              {#if isTyping}
                <div class="passage-reserve" aria-hidden="true">
                  <span lang={textLang}><RubyText text={currentDialogue.dialogue} ruby={currentDialogue.ruby} show={furigana} /></span><span class="inline-block w-2 h-5 ml-1" aria-hidden="true"></span>
                  {#if secondDialogue?.[dialogueIndex]}
                    <span class="mt-1 block text-base text-slate-500" lang={secondLang}><RubyText text={secondDialogue[dialogueIndex].dialogue} ruby={secondDialogue[dialogueIndex].ruby} show={furigana} /></span>
                  {/if}
                </div>
              {/if}
              <div class={['passage-visible', { 'typing-overlay': isTyping }]}>
              {#if isTyping}
                <span lang={textLang}>{typingText}</span><span class="inline-block w-2 h-5 bg-blue-600 ml-1 animate-pulse"
                ></span>
              {:else}
                <span lang={textLang}><RubyText text={currentDialogue.dialogue} ruby={currentDialogue.ruby} show={furigana} /></span>
                {#if secondDialogue?.[dialogueIndex]}
                  <span
                    class="second-line mt-1 block text-base text-slate-500"
                    lang={secondLang}
                    data-testid="second-line"
                  >
                    <RubyText text={secondDialogue[dialogueIndex].dialogue} ruby={secondDialogue[dialogueIndex].ruby} show={furigana} />
                  </span>
                {/if}
              {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>

      <!-- Continue indicator -->
      {#if isTyping || advanceLabel}
        <div class="mt-2 text-center">
          <button
            onclick={handleNext}
            class="group px-8 py-3 bg-linear-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            {isTyping ? t.reader.revealText : advanceLabel}
          </button>
        </div>
      {/if}
    </div>

    <!-- Action buttons -->
    <div class="mt-6 flex justify-end items-center">
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

  .passage-grid {
    display: grid;
    position: relative;
  }

  .passage-reserve,
  .passage-visible {
    grid-area: 1 / 1;
    min-width: 0;
  }

  .passage-reserve {
    visibility: hidden;
    pointer-events: none;
  }

  .typing-overlay {
    position: absolute;
    inset: 0;
  }
</style>
