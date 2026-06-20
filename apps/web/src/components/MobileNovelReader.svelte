<script lang="ts">
  import { onDestroy } from 'svelte';
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories';
  import { readerState } from '@/lib/reader-state.svelte';
  import { resolveCharacterName } from '@/lib/character-name';
  import { typeText as runTypewriter } from '@/lib/typewriter';
  import { cn } from '@/lib/utils';
  import MobileActDrawer from '@/components/MobileActDrawer.svelte';
  import MobileBacklogSheet from '@/components/MobileBacklogSheet.svelte';
  import { House, Layers, ChevronLeft, History, Bookmark } from 'lucide-svelte';
  import { longpress } from '@/lib/longpress';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
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
  let storyId = $derived(
    storyIdProp !== undefined ? storyIdProp : readerState.storyId
  );
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
  let activeTooltip = $state<string | null>(null);
  // Viewport-space anchor (horizontal center + bottom edge of the held control)
  // so the tooltip bubble renders next to the icon that was long-pressed,
  // never at a fixed screen position.
  let tooltipAnchor = $state<{ left: number; bottom: number } | null>(null);

  // Plain (non-reactive) trackers.
  let lastDialogueRef: DialogueEntry[] | undefined = undefined;
  let initialBookmarkConsumed = false;

  let currentDialogue = $derived(dialogue[currentDialogueIndex]);
  let isLastDialogue = $derived(currentDialogueIndex >= dialogue.length - 1);
  let currentName = $derived(resolveCharacterName(currentDialogue, t));
  let showChoices = $derived(!!choice && !isTyping && isLastDialogue);
  let hasOverlay = $derived(drawerOpen || backlogOpen);

  // Cancel any in-flight typewriter when the component unmounts so pending
  // onTick callbacks don't mutate state on a destroyed component.
  onDestroy(() => {
    sceneVersion++;
  });

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

  function goBack(): void {
    // Overlays own their own taps; never step the scene from under them.
    if (hasOverlay) return;
    // At the start of the scene there is nowhere to go back to.
    if (currentDialogueIndex <= 0) return;
    skipTyping = false;
    isTyping = false;
    sceneVersion++; // cancel any in-flight typewriter for this scene
    currentDialogueIndex--;
    typingText = dialogue[currentDialogueIndex]?.dialogue ?? '';
  }

  // Long-press peek handlers: capture the held control's viewport rect so the
  // tooltip anchors next to that specific icon rather than at a fixed spot.
  function showTooltip(node: HTMLElement, label: string): void {
    const r = node.getBoundingClientRect();
    tooltipAnchor = { left: r.left + r.width / 2, bottom: r.bottom };
    activeTooltip = label;
  }
  function hideTooltip(): void {
    activeTooltip = null;
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

  let progressFraction = $derived(
    dialogue.length > 0
      ? ((currentDialogueIndex + 1) / dialogue.length) * 100
      : 0
  );

  let backlogLines = $derived(
    dialogue
      .slice(0, currentDialogueIndex + 1)
      .map(entry => ({
        characterName: resolveCharacterName(entry, t),
        text: entry.dialogue,
      }))
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

  <!-- Auto-hiding chrome bar (icon toolbar + slim progress). -->
  {#if chromeVisible}
    <div
      class="absolute inset-x-0 top-0 z-20 bg-white/80 shadow backdrop-blur-md"
      style="padding-top: calc(0.5rem + env(safe-area-inset-top));"
    >
      <div class="flex items-center gap-1 px-2 py-2 pl-16">
        <a
          href={backUrl}
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.common.backToHome}
          use:longpress={{
            onLongPress: (node) => showTooltip(node, t.common.backToHome),
            onRelease: hideTooltip,
          }}
        >
          <House size={20} aria-hidden="true" />
        </a>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.reader.openActsPanel}
          onclick={() => {
            drawerOpen = true;
            chromeVisible = false;
          }}
          use:longpress={{
            onLongPress: (node) => showTooltip(node, t.reader.openActsPanel),
            onRelease: hideTooltip,
          }}
        >
          <Layers size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.reader.openHistory}
          onclick={() => {
            backlogOpen = true;
            chromeVisible = false;
          }}
          use:longpress={{
            onLongPress: (node) => showTooltip(node, t.reader.openHistory),
            onRelease: hideTooltip,
          }}
        >
          <History size={20} aria-hidden="true" />
        </button>
        {#if showBookmarkButton}
          <button
            type="button"
            class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-white/60"
          aria-label={t.reader.bookmark}
          onclick={() => onBookmark(currentDialogueIndex + 1)}
          use:longpress={{
            onLongPress: (node) => showTooltip(node, t.reader.bookmark),
            onRelease: hideTooltip,
          }}
          >
            <Bookmark size={20} aria-hidden="true" />
          </button>
        {/if}
        <span class="ml-auto pr-2 text-xs font-medium text-slate-600">{progressText}</span>
      </div>
      <div class="h-1 w-full bg-slate-200/70" aria-hidden="true">
        <div
          class="h-full bg-blue-500 motion-safe:transition-[width] motion-safe:duration-200"
          style="width: {progressFraction}%;"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Bottom text panel. pointer-events-none lets taps fall through to the
       advance layer except when choices need to be clickable. -->
  <div
    class={cn(
      'absolute inset-x-0 bottom-0 z-20 mx-auto max-w-2xl px-4 pb-4',
      showChoices ? 'pointer-events-auto' : 'pointer-events-none'
    )}
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
      <!-- Persistent back-one-line control, above the dialogue box. Its own
           pointer-events-auto re-enables clicks (the panel is none while reading). -->
      <div class="pointer-events-auto mb-2 flex">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow backdrop-blur-sm disabled:opacity-40"
          aria-label={t.reader.previousLine}
          disabled={currentDialogueIndex === 0}
          onclick={goBack}
          use:longpress={{
            onLongPress: (node) => showTooltip(node, t.reader.previousLine),
            onRelease: hideTooltip,
          }}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      </div>
      <!-- Fixed-height reading box: chip · scrollable text · pinned indicator. -->
      <div class="flex h-52 flex-col rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        {#if currentName}
          <span
            class="mb-2 inline-block self-start rounded-xl bg-blue-100/80 px-3 py-1 text-base font-bold text-blue-600"
          >
            {currentName}
          </span>
        {/if}
        <p class="flex-1 overflow-y-auto text-lg leading-relaxed text-slate-800">
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

  <!-- Visual-only long-press tooltip. Controls already expose their name via
       aria-label, so this bubble is aria-hidden to avoid double-announcement.
       It is positioned at the held control's horizontal center and just below
       its bottom edge, so the label appears next to the icon that was held. -->
  {#if activeTooltip && tooltipAnchor}
    <div
      class="pointer-events-none absolute z-40 -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-1 text-sm font-medium text-white shadow-lg"
      style="left: {tooltipAnchor.left}px; top: calc({tooltipAnchor.bottom}px + 0.25rem);"
      aria-hidden="true"
    >
      {activeTooltip}
    </div>
  {/if}

  {#if storyId !== undefined && currentSceneId !== undefined}
    <MobileActDrawer
      {storyId}
      {currentSceneId}
      open={drawerOpen}
      {locale}
      onNavigate={(sceneId: string) => onNavigate(sceneId)}
      onClose={() => (drawerOpen = false)}
    />
  {/if}

  <MobileBacklogSheet
    lines={backlogLines}
    open={backlogOpen}
    {locale}
    onClose={() => (backlogOpen = false)}
  />
</div>

<style>
  .mobile-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
