<script lang="ts">
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories';
  import { readerState } from '@/lib/reader-state.svelte';
  import { resolveCharacterName } from '@/lib/character-name';
  import { typeText as runTypewriter } from '@/lib/typewriter';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed by Task 8 (MobileActDrawer integration)
    onNavigate = () => {},
    showBookmarkButton = true,
    backUrl = '/',
    initialDialogueIndex = null,
    dialogue: dialogueProp = undefined,
    choice: choiceProp = undefined,
    storyId: storyIdProp = undefined,
    currentSceneId: currentSceneIdProp = undefined,
    canGoNext: canGoNextProp = undefined,
    locale: localeProp = undefined,
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    showBookmarkButton?: boolean;
    backUrl?: string;
    initialDialogueIndex?: number | null;
    dialogue?: DialogueEntry[];
    choice?: ChoiceDefinition | null;
    storyId?: string;
    currentSceneId?: string;
    canGoNext?: boolean;
    locale?: Locale;
  } = $props();

  let dialogue = $derived(
    dialogueProp !== undefined ? dialogueProp : readerState.dialogue
  );
  let choice = $derived(
    choiceProp !== undefined ? choiceProp : readerState.choice
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed by Task 8 (MobileActDrawer)
  let storyId = $derived(
    storyIdProp !== undefined ? storyIdProp : readerState.storyId
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- consumed by Task 8 (MobileActDrawer)
  let currentSceneId = $derived(
    currentSceneIdProp !== undefined
      ? currentSceneIdProp
      : readerState.currentSceneId
  );
  let canGoNext = $derived(
    canGoNextProp !== undefined ? canGoNextProp : readerState.canGoNext
  );
  let locale = $derived(
    (localeProp !== undefined ? localeProp : readerState.locale) as Locale
  );

  let t = $derived(getTranslations(locale));

  const typingSpeed = 30;

  let currentDialogueIndex = $state(0);
  let isTyping = $state(false);
  let typingText = $state('');
  let skipTyping = $state(false);
  let sceneVersion = $state(0);

  // Mobile UI state (Task 8 renders drawer/backlog from these flags).
  let chromeVisible = $state(false);
  let drawerOpen = $state(false);
  let backlogOpen = $state(false);

  // Plain (non-reactive) trackers.
  let lastDialogueRef: DialogueEntry[] | undefined = undefined;
  let initialBookmarkConsumed = false;

  let currentDialogue = $derived(dialogue[currentDialogueIndex]);
  let isLastDialogue = $derived(currentDialogueIndex >= dialogue.length - 1);
  let currentName = $derived(resolveCharacterName(currentDialogue, t));
  let showChoices = $derived(!!choice && !isTyping && isLastDialogue);
  let hasOverlay = $derived(drawerOpen || backlogOpen);

  // Initialize each scene when the dialogue array reference changes.
  $effect(() => {
    if (dialogue !== lastDialogueRef) {
      lastDialogueRef = dialogue;
      initScene();
    }
  });

  function initScene(): void {
    sceneVersion++;
    skipTyping = false;
    isTyping = false;
    drawerOpen = false;
    backlogOpen = false;

    if (
      !initialBookmarkConsumed &&
      initialDialogueIndex !== null &&
      initialDialogueIndex >= 0 &&
      dialogue.length > 0
    ) {
      const target = Math.min(initialDialogueIndex, dialogue.length - 1);
      currentDialogueIndex = target;
      typingText = dialogue[target]?.dialogue ?? '';
      initialBookmarkConsumed = true;
      return;
    }

    currentDialogueIndex = 0;
    typingText = '';
    void startTyping(0);
  }

  async function startTyping(index: number): Promise<void> {
    const entry = dialogue[index];
    if (!entry) {
      isTyping = false;
      typingText = '';
      return;
    }
    skipTyping = false;
    isTyping = true;
    typingText = '';
    const version = sceneVersion;

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

  function advance(): void {
    // An open overlay swallows the tap to close itself.
    if (hasOverlay) {
      if (backlogOpen) backlogOpen = false;
      else drawerOpen = false;
      return;
    }
    // First tap during typing completes the line.
    if (isTyping) {
      skipTyping = true;
      return;
    }
    // A tap while chrome is showing dismisses it (does not advance).
    if (chromeVisible) {
      chromeVisible = false;
      return;
    }
    if (currentDialogueIndex < dialogue.length - 1) {
      currentDialogueIndex++;
      void startTyping(currentDialogueIndex);
    } else if (canGoNext && !choice) {
      onNext();
    }
  }

  function handleKeyPress(event: globalThis.KeyboardEvent): void {
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

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
      if (interactiveTags.includes(tagName) || hasEditableAttr) return;
    }
    event.preventDefault();
    advance();
  }

  let progressText = $derived(
    t.reader.lineProgress
      .replace('{current}', String(currentDialogueIndex + 1))
      .replace('{total}', String(dialogue.length))
  );
</script>

<svelte:window onkeydown={handleKeyPress} />

<div
  class="mobile-reader relative h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400"
>
  <!-- Tap-to-advance layer (full screen, below chrome and overlays). -->
  <button
    type="button"
    class="absolute inset-0 z-10 h-full w-full cursor-default"
    aria-label={t.reader.tapToContinue}
    onclick={advance}
  ></button>

  <!-- Persistent menu toggle (above the tap layer). -->
  <button
    type="button"
    class="absolute left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-slate-700 shadow backdrop-blur-sm"
    style="top: calc(0.75rem + env(safe-area-inset-top));"
    aria-label={chromeVisible ? t.reader.closeMenu : t.reader.openMenu}
    aria-expanded={chromeVisible}
    onclick={() => (chromeVisible = !chromeVisible)}
  >
    {#if chromeVisible}✕{:else}☰{/if}
  </button>

  <!-- Auto-hiding chrome bar. -->
  {#if chromeVisible}
    <div
      class="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-white/80 px-3 py-2 pl-16 shadow backdrop-blur-md"
      style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
    >
      <a
        href={backUrl}
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
      >
        {t.common.backToHome}
      </a>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
        aria-label={t.reader.openActsPanel}
        onclick={() => (drawerOpen = true)}
      >
        {t.reader.actPanel}
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
        aria-label={t.reader.openHistory}
        onclick={() => (backlogOpen = true)}
      >
        {t.reader.historyTitle}
      </button>
      {#if showBookmarkButton}
        <button
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/60"
          onclick={() => onBookmark(currentDialogueIndex + 1)}
        >
          {t.reader.bookmark}
        </button>
      {/if}
      <span class="ml-auto text-xs font-medium text-slate-600">{progressText}</span>
    </div>
  {/if}

  <!-- Bottom text panel. pointer-events-none lets taps fall through to the
       advance layer except when choices need to be clickable. -->
  <div
    class="absolute inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-4 {showChoices
      ? 'pointer-events-auto'
      : 'pointer-events-none'}"
    style="padding-bottom: calc(1rem + env(safe-area-inset-bottom));"
  >
    {#if showChoices}
      <div class="space-y-3 rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        <p class="text-base font-semibold text-slate-700">{choice?.prompt}</p>
        {#each choice?.options ?? [] as option (option.id)}
          <button
            type="button"
            class="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-base font-semibold text-slate-800 hover:border-blue-300 hover:text-blue-600"
            onclick={() => onChoice(option.nextScene)}
          >
            {option.label}
          </button>
        {/each}
      </div>
    {:else}
      <div class="min-h-[7rem] rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        {#if currentName}
          <span
            class="mb-2 inline-block rounded-xl bg-blue-100/80 px-3 py-1 text-base font-bold text-blue-600"
          >
            {currentName}
          </span>
        {/if}
        <p class="text-lg leading-relaxed text-slate-800">
          {typingText}{#if isTyping}<span
              class="ml-0.5 inline-block h-5 w-2 animate-pulse bg-blue-600 align-middle"
            ></span>{/if}
        </p>
        {#if !isTyping}
          <div class="mt-2 text-right text-blue-500">
            {#if !isLastDialogue}
              <span class="inline-block motion-safe:animate-bounce" aria-hidden="true">▼</span>
            {:else if canGoNext}
              <span class="text-sm font-semibold">{t.reader.nextScene}</span>
            {:else}
              <span class="text-sm font-semibold">{t.reader.complete}</span>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .mobile-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
