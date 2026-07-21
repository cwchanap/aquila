<script lang="ts">
  import { onDestroy } from 'svelte';
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
    StoryFlowConfig,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import { resolveCharacterName } from '@/lib/character-name';
  import { typeText as runTypewriter } from '@/lib/typewriter';
  import { cn } from '@/lib/utils';
  import MobileActDrawer from '@/components/MobileActDrawer.svelte';
  import MobileBacklogSheet from '@/components/MobileBacklogSheet.svelte';
  import { House, Layers, ChevronLeft, History, Bookmark } from 'lucide-svelte';
  import { longpress } from '@/lib/longpress';

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
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    backUrl = '/',
    showBookmarkButton = true,
    isInitialMount = true,
    interactionDisabled = false,
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
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    backUrl?: string;
    showBookmarkButton?: boolean;
    isInitialMount?: boolean;
    interactionDisabled?: boolean;
  } = $props();

  let t = $derived(getTranslations(locale as Locale));

  const typingSpeed = 30;

  // Component-local presentation state only.
  let isTyping = $state(false);
  let typingText = $state('');
  let skipTyping = $state(false);
  let sceneVersion = $state(0);

  // Mobile UI state.
  let chromeVisible = $state(false);
  let drawerOpen = $state(false);
  let backlogOpen = $state(false);
  let activeTooltip = $state<string | null>(null);
  // Viewport-space anchor (horizontal center + bottom edge of the held control)
  // so the tooltip bubble renders next to the icon that was long-pressed,
  // never at a fixed screen position.
  let tooltipAnchor = $state<{ left: number; bottom: number } | null>(null);

  // Two-signal typewriter bookkeeping (plain variables — must NOT be reactive,
  // otherwise writing them would re-trigger these effects).
  let lastDialogueRef: DialogueEntry[] | undefined = undefined;
  let lastIndex = dialogueIndex;
  // The exact index a self-initiated advance/goBack expects to land on, or null
  // when the next index change is external (popstate/restore/breakpoint swap).
  // Tying the flag to the TARGET index rather than a boolean fixes the
  // same-tick race where a popstate overrides the index between advance/goBack
  // and Signal 2: a boolean would still be true and animate the popstate's
  // line, but the target-index check fails (popstate's index !== target) and
  // snaps per spec §239-241.
  let selfAdvanceTarget: number | null = null;
  // Always-mounted menu toggle; passed to overlays as the focus-restore target
  // so closing a drawer/sheet lands focus on a stable control instead of <body>
  // (the opener icon unmounts with the chrome bar in the same batch as open).
  let menuToggleButton: HTMLElement | undefined = $state();

  // Derived view state — the visible reader is a pure function of the index.
  let currentDialogue = $derived(dialogue[dialogueIndex]);
  let isLastDialogue = $derived(dialogueIndex >= dialogue.length - 1);
  let currentName = $derived(resolveCharacterName(currentDialogue, t));
  let showChoices = $derived(!!choice && !isTyping && isLastDialogue);
  let hasOverlay = $derived(drawerOpen || backlogOpen);

  // Cancel any in-flight typewriter when the component unmounts so pending
  // onTick callbacks don't mutate state on a destroyed component.
  onDestroy(() => {
    sceneVersion++;
  });

  // Typewriter runner. Captures sceneVersion for cancellation when a new
  // scene or a new line supersedes the in-flight animation.
  async function startTyping(index: number): Promise<void> {
    const entry = dialogue[index];
    if (!entry) {
      isTyping = false;
      typingText = '';
      return;
    }
    typingText = '';
    isTyping = true;
    skipTyping = false;
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

  // Signal 1 — new scene (dialogue reference change): ALWAYS animate the line
  // at dialogueIndex, even at index 0. Reset all presentation state first.
  // EXCEPTIONS (snap — reveal the full line immediately, no animation):
  //   1. First mount (lastDialogueRef === undefined) with a nonzero
  //      dialogueIndex: the index came from a bookmark/deep-link restore or
  //      a responsive-breakpoint remount — the user expects the active line
  //      fully revealed, not re-typed.
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
      // New scene dismisses any open overlay (the old scene's acts/history no
      // longer apply).
      drawerOpen = false;
      backlogOpen = false;
      // Sync lastIndex so Signal 2 does not also fire for this same tick.
      lastIndex = dialogueIndex;
      if (dialogue.length > 0 && !(isRestoreAtNonzero || isBreakpointRemount)) {
        void startTyping(dialogueIndex);
      }
    }
  });

  // Signal 2 — index change within the SAME scene. selfAdvanceTarget
  // distinguishes a user-driven advance/goBack (animate) from an external
  // change like popstate (snap). The target is cleared BEFORE branching so a
  // same-tick popstate that overrides the index cannot see a stale target on a
  // later run; and the target-index check (=== dialogueIndex) ensures that
  // even if the popstate lands in the SAME effect batch as the advance, the
  // popstate's index won't match the advance's target → snap, per spec §239-241.
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

  function advance(): void {
    if (interactionDisabled) return;
    // An open overlay swallows the tap to close itself.
    if (hasOverlay) {
      if (backlogOpen) backlogOpen = false;
      else drawerOpen = false;
      return;
    }
    // First tap during typing only skips the animation; it must NOT advance
    // the index (the parent owns the index).
    if (isTyping) {
      skipTyping = true;
      return;
    }
    // A tap while chrome is showing dismisses it (does not advance).
    if (chromeVisible) {
      chromeVisible = false;
      return;
    }
    if (dialogueIndex < dialogue.length - 1) {
      selfAdvanceTarget = dialogueIndex + 1;
      onIndexChange(dialogueIndex + 1);
    } else if (canGoNext && !choice) {
      onNext();
    }
  }

  function goBack(): void {
    if (interactionDisabled) return;
    // Overlays own their own taps; never step the scene from under them.
    if (hasOverlay) return;
    // At the start of the scene there is nowhere to go back to.
    if (dialogueIndex <= 0) return;
    // Parent owns the index; emit and let Signal 2 animate the prior line.
    selfAdvanceTarget = dialogueIndex - 1;
    onIndexChange(dialogueIndex - 1);
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
    // Clear the anchor too so a stale rect can't leak into a future render
    // (the render guard at the bottom already hides the bubble, but keeping
    // orphan viewport coords around is just confusing state hygiene).
    tooltipAnchor = null;
  }

  function handleKeyPress(event: globalThis.KeyboardEvent): void {
    if (interactionDisabled) return;
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
      .replace('{current}', String(dialogueIndex + 1))
      .replace('{total}', String(dialogue.length))
  );

  let progressFraction = $derived(
    dialogue.length > 0
      ? ((dialogueIndex + 1) / dialogue.length) * 100
      : 0
  );

  let backlogLines = $derived(
    dialogue
      .slice(0, dialogueIndex + 1)
      .map(entry => ({
        characterName: resolveCharacterName(entry, t),
        text: entry.dialogue,
      }))
  );
</script>

<svelte:window onkeydown={handleKeyPress} />

<div
  class="mobile-reader relative h-[100dvh] w-full overflow-hidden bg-linear-to-b from-sky-200 via-sky-300 to-blue-400"
>
  <!-- Background content (reader + chrome). `inert` propagates to descendants,
       so we inert this wrapper — NOT the reader root — when an overlay is open.
       Inerting the root would disable the drawer/sheet too, since they mount as
       its children. This static wrapper is skipped as a containing block, so the
       absolutely-positioned children keep resolving against .mobile-reader. -->
  <div inert={hasOverlay}>
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
    bind:this={menuToggleButton}
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
            onclick={() => onBookmark(dialogueIndex + 1)}
            use:longpress={{
              onLongPress: (node) => showTooltip(node, t.reader.bookmark),
              onRelease: hideTooltip,
            }}
          >
            <Bookmark size={20} aria-hidden="true" />
          </button>
        {/if}
        {#if dialogue.length > 0}
          <span class="ml-auto pr-2 text-xs font-medium text-slate-600">{progressText}</span>
        {/if}
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
          disabled={dialogueIndex === 0}
          onclick={goBack}
          use:longpress={{
            onLongPress: (node) => showTooltip(node, t.reader.previousLine),
            onRelease: hideTooltip,
          }}
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
      </div>
      <!-- Fixed-height reading box: chip · scrollable text · pinned indicator.
           The box stays pointer-events-none (inherited from the panel) so taps
           on the chip/indicator fall through to the advance layer, but the
           scrollable text re-enables pointer events so overflowed lines can be
           scrolled. Its onclick forwards to advance() so a tap on the text
           still advances — scroll gestures don't fire click, so scrolling is
           unaffected. The local keydown mirrors the global <svelte:window>
           handler and calls preventDefault() so advance isn't triggered twice. -->
      <div class="flex h-52 flex-col rounded-3xl bg-white/90 p-5 shadow-2xl backdrop-blur-md">
        {#if currentName}
          <span
            class="mb-2 inline-block self-start rounded-xl bg-blue-100/80 px-3 py-1 text-base font-bold text-blue-600"
          >
            {currentName}
          </span>
        {/if}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <p
          class="pointer-events-auto flex-1 overflow-y-auto text-lg leading-relaxed text-slate-800"
          onclick={advance}
          onkeydown={(e) => {
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            advance();
          }}
        >
          {#if isTyping}{typingText}<span
            class="ml-0.5 inline-block h-5 w-2 motion-safe:animate-pulse bg-blue-600 align-middle"
          ></span>{:else}{currentDialogue?.dialogue}{/if}
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
       its bottom edge, so the label appears next to the icon that was held.
       Anchor coords are viewport-space (getBoundingClientRect), so the bubble
       uses position:fixed to match that coordinate system rather than relying
       on the reader happening to be full-bleed. -->
  {#if activeTooltip && tooltipAnchor}
    <div
      class="pointer-events-none fixed z-40 -translate-x-1/2 rounded-md bg-slate-900/90 px-3 py-1 text-sm font-medium text-white shadow-lg"
      style="left: {tooltipAnchor.left}px; top: calc({tooltipAnchor.bottom}px + 0.25rem);"
      aria-hidden="true"
    >
      {activeTooltip}
    </div>
  {/if}
  </div><!-- /background-inert wrapper -->

  {#if storyId !== undefined && currentSceneId !== undefined}
    <MobileActDrawer
      {flow}
      {storyId}
      {currentSceneId}
      open={drawerOpen}
      {locale}
      restoreFocusTarget={menuToggleButton ?? null}
      onNavigate={(sceneId: string) => {
        if (sceneId !== currentSceneId) {
          onNavigate(sceneId);
        }
      }}
      onClose={() => (drawerOpen = false)}
    />
  {/if}

  <MobileBacklogSheet
    lines={backlogLines}
    open={backlogOpen}
    {locale}
    restoreFocusTarget={menuToggleButton ?? null}
    onClose={() => (backlogOpen = false)}
  />
</div>

<style>
  .mobile-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
