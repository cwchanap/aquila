<script lang="ts">
  import type {
    ChoiceDefinition,
    DialogueEntry,
    Locale,
    StoryFlowConfig,
    StoryPresentationMetadata,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import ActPanel from '@/components/ActPanel.svelte';
  import VisualBacklog from '@/components/VisualBacklog.svelte';
  import { resolveCharacterName } from '@/lib/character-name';
  import {
    getReaderAdvanceDecision,
    isReaderInteractiveTarget,
  } from '@/lib/reader-interaction';
  import { typeText } from '@/lib/typewriter';
  import type {
    VisualSnapshot,
    VisualStateController,
  } from '@/lib/visual-assets';
  import { onDestroy, onMount, tick } from 'svelte';

  type Props = {
    controller: VisualStateController | null;
    flow: StoryFlowConfig;
    dialogue: DialogueEntry[];
    dialogueIndex: number;
    storyId: string;
    currentSceneId: string;
    canGoNext: boolean;
    choice: ChoiceDefinition | null;
    locale: Locale;
    presentation: StoryPresentationMetadata | null;
    onChoice: (nextScene: string) => void;
    onBookmark: (dialogueNumber: number) => void;
    onNext: () => void;
    onNavigate: (sceneId: string) => void;
    onIndexChange: (index: number) => void;
    onVisualStatusChange?: (status: VisualSnapshot['status']) => void;
    showBookmarkButton: boolean;
    backUrl: string;
    isInitialMount: boolean;
    interactionDisabled: boolean;
  };

  const emptyLayer = {
    state: 'omitted' as const,
    identity: null,
    objectUrl: null,
    width: null,
    height: null,
  };

  const emptySnapshot: VisualSnapshot = {
    release: 'idle',
    activeBackground: emptyLayer,
    stagingBackground: emptyLayer,
    portrait: { ...emptyLayer, slot: 'center' },
    status: null,
  };

  let {
    controller,
    flow,
    dialogue,
    dialogueIndex,
    storyId,
    currentSceneId,
    canGoNext,
    choice,
    locale,
    presentation,
    onChoice,
    onBookmark,
    onNext,
    onNavigate,
    onIndexChange,
    onVisualStatusChange = () => {},
    showBookmarkButton,
    backUrl,
    isInitialMount,
    interactionDisabled,
  }: Props = $props();

  let snapshot = $state<VisualSnapshot>(emptySnapshot);
  let reducedMotion = $state(false);
  let isTyping = $state(false);
  let skipTyping = $state(false);
  let typingText = $state('');
  let sceneVersion = $state(0);
  let backlogOpen = $state(false);
  let actPanelOpen = $state(false);
  let historyButton: globalThis.HTMLButtonElement | null = $state(null);

  let t = $derived(getTranslations(locale));
  let currentDialogue = $derived(dialogue[dialogueIndex]);
  let currentName = $derived(resolveCharacterName(currentDialogue, t));
  let isLastDialogue = $derived(dialogueIndex >= dialogue.length - 1);
  let showChoices = $derived(
    !!currentDialogue && !!choice && !isTyping && isLastDialogue
  );
  let progressText = $derived(
    t.reader.pageDisplay
      .replace('{current}', String(dialogueIndex + 1))
      .replace('{total}', String(dialogue.length))
  );
  let lastDialogueRef: DialogueEntry[] | undefined;
  let lastIndex = dialogueIndex;
  let selfAdvanceTarget: number | null = null;

  $effect(() => {
    if (!controller) {
      snapshot = emptySnapshot;
      return;
    }
    return controller.subscribe((nextSnapshot) => {
      snapshot = nextSnapshot;
    });
  });

  $effect(() => {
    onVisualStatusChange(snapshot.status);
  });

  onMount(() => {
    const mediaQuery = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    );
    const handleMotionPreference = (
      event: globalThis.MediaQueryListEvent
    ): void => {
      reducedMotion = event.matches;
    };
    reducedMotion = mediaQuery?.matches ?? false;
    mediaQuery?.addEventListener('change', handleMotionPreference);

    return () => {
      mediaQuery?.removeEventListener('change', handleMotionPreference);
    };
  });

  onDestroy(() => {
    sceneVersion += 1;
    onVisualStatusChange(null);
  });

  $effect(() => {
    controller?.update({
      storyId,
      sceneId: currentSceneId,
      dialogue,
      dialogueIndex,
      flow,
      presentation,
    });
  });

  $effect(() => {
    if (
      reducedMotion &&
      snapshot.stagingBackground.state === 'ready'
    ) {
      controller?.commitBackgroundTransition();
    }
  });

  async function startTyping(index: number): Promise<void> {
    const entry = dialogue[index];
    if (!entry) {
      typingText = '';
      isTyping = false;
      return;
    }

    typingText = '';
    isTyping = true;
    skipTyping = false;
    const version = sceneVersion;
    const result = await typeText({
      text: entry.dialogue,
      speed: 30,
      onTick: (partial) => {
        typingText = partial;
      },
      isSkipped: () => skipTyping,
      isCancelled: () => version !== sceneVersion,
    });
    if (result === 'cancelled') return;
    typingText = entry.dialogue;
    isTyping = false;
  }

  $effect(() => {
    if (dialogue !== lastDialogueRef) {
      const firstMount = lastDialogueRef === undefined;
      const breakpointRemount = firstMount && !isInitialMount;
      const restoredNonzeroIndex = firstMount && dialogueIndex > 0;
      lastDialogueRef = dialogue;
      lastIndex = dialogueIndex;
      selfAdvanceTarget = null;
      sceneVersion += 1;
      isTyping = false;
      skipTyping = false;
      typingText = '';
      backlogOpen = false;
      actPanelOpen = false;

      if (
        dialogue.length > 0 &&
        !breakpointRemount &&
        !restoredNonzeroIndex
      ) {
        void startTyping(dialogueIndex);
      }
    }
  });

  $effect(() => {
    if (dialogue === lastDialogueRef && dialogueIndex !== lastIndex) {
      const selfAdvanced = selfAdvanceTarget === dialogueIndex;
      selfAdvanceTarget = null;
      sceneVersion += 1;
      if (selfAdvanced) {
        void startTyping(dialogueIndex);
      } else {
        isTyping = false;
        typingText = '';
      }
    }
    lastIndex = dialogueIndex;
  });

  function advance(): void {
    if (interactionDisabled || backlogOpen || actPanelOpen) return;
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
    if (decision === 'advance-scene') onNext();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || interactionDisabled) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isReaderInteractiveTarget(event.target ?? document.activeElement)) return;
    event.preventDefault();
    advance();
  }

  function handlePointer(event: globalThis.PointerEvent): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.isPrimary === false) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isReaderInteractiveTarget(event.target)) return;
    advance();
  }

  async function closeBacklog(): Promise<void> {
    backlogOpen = false;
    await tick();
    historyButton?.focus();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main
  data-testid="visual-novel-reader"
  data-reader-mode="visual"
  data-visual-release-state={snapshot.release}
  class="visual-novel-reader"
  style="height: 100dvh; min-height: 0;"
  onpointerup={handlePointer}
>
  <img
    class="background-layer"
    data-bg-layer="active"
    data-bg-state={snapshot.activeBackground.state}
    src={snapshot.activeBackground.objectUrl ?? undefined}
    alt=""
  />
  <img
    class:background-staging--transition={!reducedMotion}
    class="background-layer background-staging"
    data-bg-layer="staging"
    data-bg-state={snapshot.stagingBackground.state}
    src={snapshot.stagingBackground.objectUrl ?? undefined}
    style:opacity={snapshot.stagingBackground.state === 'ready' ? 1 : 0}
    ontransitionend={() => controller?.commitBackgroundTransition()}
    alt=""
  />
  <img
    data-testid="visual-portrait"
    class="visual-portrait"
    data-portrait-state={snapshot.portrait.state}
    data-portrait-slot={snapshot.portrait.slot}
    src={snapshot.portrait.objectUrl ?? undefined}
    alt=""
  />

  <div
    data-testid="visual-reader-content"
    class="visual-reader-content"
    inert={backlogOpen}
  >
    <aside class="act-panel" data-reader-interactive>
      <ActPanel
        {flow}
        {storyId}
        {currentSceneId}
        open={actPanelOpen}
        {locale}
        onToggle={() => (actPanelOpen = !actPanelOpen)}
        onNavigate={(sceneId) => {
          if (sceneId !== currentSceneId) onNavigate(sceneId);
        }}
      />
    </aside>

    <nav class="reader-controls">
      <a href={backUrl} data-reader-interactive>{t.common.backToHome}</a>
      <button
        bind:this={historyButton}
        type="button"
        data-reader-interactive
        onclick={() => (backlogOpen = true)}
      >
        {t.reader.openHistory}
      </button>
      {#if showBookmarkButton}
        <button
          type="button"
          data-reader-interactive
          onclick={() => onBookmark(dialogueIndex + 1)}
        >
          {t.reader.bookmark}
        </button>
      {/if}
    </nav>

    <section class="dialogue-box" aria-live="off">
      {#if currentName}
        <p class="speaker">{currentName}</p>
      {/if}

      {#if currentDialogue}
        <p class="dialogue-text">
          {#if isTyping}
            {typingText}<span
              data-testid="visual-typewriter-cursor"
              class="typewriter-cursor"
              aria-hidden="true"
            ></span>
          {:else}
            {currentDialogue.dialogue}
          {/if}
        </p>
      {/if}

      {#if showChoices}
        <div class="choices">
          <p>{choice?.prompt}</p>
          {#each choice?.options ?? [] as option (option.id)}
            <button
              type="button"
              data-reader-interactive
              onclick={() => onChoice(option.nextScene)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {:else if !isTyping && currentDialogue}
        <button
          type="button"
          class="next-control"
          data-reader-interactive
          onclick={advance}
        >
          {#if !isLastDialogue}
            {t.reader.continue}
          {:else if canGoNext}
            {t.reader.nextScene}
          {:else}
            {t.reader.complete}
          {/if}
        </button>
      {/if}

      {#if dialogue.length > 0}
        <p class="progress">{progressText}</p>
      {/if}
    </section>
  </div>

  {#if backlogOpen}
    <VisualBacklog
      {dialogue}
      {dialogueIndex}
      {locale}
      trigger={historyButton}
      onClose={closeBacklog}
    />
  {/if}
</main>

<style>
  .visual-novel-reader {
    position: relative;
    width: 100%;
    overflow: hidden;
    color: #f8fafc;
    background: #020617;
    isolation: isolate;
    touch-action: manipulation;
  }

  .background-layer {
    position: absolute;
    inset: 0;
    z-index: -3;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .background-staging {
    z-index: -2;
  }

  .background-staging--transition {
    transition: opacity 420ms ease;
  }

  .visual-portrait {
    position: absolute;
    bottom: clamp(12rem, 28vh, 20rem);
    z-index: -1;
    display: block;
    width: auto;
    max-width: min(48vw, 42rem);
    height: auto;
    max-height: calc(100dvh - clamp(14rem, 32vh, 22rem));
    object-fit: contain;
    object-position: bottom;
    filter: drop-shadow(0 1rem 2rem rgb(0 0 0 / 0.45));
  }

  .visual-portrait[data-portrait-slot='left'] {
    left: max(3vw, env(safe-area-inset-left));
  }

  .visual-portrait[data-portrait-slot='center'] {
    left: 50%;
    transform: translateX(-50%);
  }

  .visual-portrait[data-portrait-slot='right'] {
    right: max(3vw, env(safe-area-inset-right));
  }

  .visual-reader-content {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    width: 100%;
    height: 100%;
    padding-top: max(1rem, env(safe-area-inset-top));
    padding-right: max(1rem, env(safe-area-inset-right));
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
    padding-left: max(1rem, env(safe-area-inset-left));
    box-sizing: border-box;
  }

  .act-panel {
    z-index: 20;
    min-width: 3rem;
    margin: -1rem 0 -1rem -1rem;
  }

  .reader-controls {
    position: absolute;
    top: max(1rem, env(safe-area-inset-top));
    right: max(1rem, env(safe-area-inset-right));
    z-index: 20;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .reader-controls a,
  .reader-controls button,
  .next-control,
  .choices button {
    min-height: 2.75rem;
    padding: 0.65rem 1rem;
    color: inherit;
    font: inherit;
    font-weight: 700;
    background: rgb(15 23 42 / 0.78);
    border: 1px solid rgb(255 255 255 / 0.28);
    border-radius: 999px;
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 0.25);
    backdrop-filter: blur(0.75rem);
    cursor: pointer;
  }

  .reader-controls a {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .reader-controls :is(a, button):focus-visible,
  .next-control:focus-visible,
  .choices button:focus-visible {
    outline: 3px solid #7dd3fc;
    outline-offset: 2px;
  }

  .dialogue-box {
    position: absolute;
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
    left: max(4rem, env(safe-area-inset-left));
    z-index: 10;
    max-width: 72rem;
    padding: clamp(1rem, 2.5vw, 2rem);
    margin-inline: auto;
    color: #f8fafc;
    background: rgb(15 23 42 / 0.88);
    border: 1px solid rgb(255 255 255 / 0.24);
    border-radius: clamp(1rem, 2vw, 1.5rem);
    box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.48);
    backdrop-filter: blur(1rem);
  }

  .speaker,
  .dialogue-text,
  .progress,
  .choices p {
    margin: 0;
  }

  .speaker {
    margin-bottom: 0.5rem;
    color: #7dd3fc;
    font-size: clamp(1rem, 2vw, 1.25rem);
    font-weight: 800;
  }

  .dialogue-text {
    min-height: 3.4em;
    font-size: clamp(1rem, 2.2vw, 1.35rem);
    line-height: 1.7;
  }

  .typewriter-cursor {
    display: inline-block;
    width: 0.45rem;
    height: 1.15em;
    margin-left: 0.2rem;
    vertical-align: -0.15em;
    background: #7dd3fc;
    animation: cursor-pulse 800ms ease-in-out infinite;
  }

  .next-control {
    display: block;
    margin: 1rem 0 0 auto;
  }

  .choices {
    display: grid;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .choices button {
    width: 100%;
    text-align: left;
    border-radius: 0.75rem;
  }

  .progress {
    margin-top: 0.75rem;
    color: rgb(226 232 240 / 0.72);
    font-size: 0.8rem;
    text-align: right;
  }

  @keyframes cursor-pulse {
    50% {
      opacity: 0.25;
    }
  }

  @media (max-width: 47.99rem) and (orientation: portrait) {
    .reader-controls {
      left: max(4rem, env(safe-area-inset-left));
    }

    .visual-portrait {
      bottom: min(42dvh, 22rem);
      max-width: 82vw;
      max-height: 52dvh;
    }

    .dialogue-box {
      max-height: 40dvh;
      overflow-y: auto;
    }
  }

  @media (max-height: 31rem) and (orientation: landscape) {
    .visual-portrait {
      bottom: 8.5rem;
      max-width: 42vw;
      max-height: calc(100dvh - 10rem);
    }

    .reader-controls {
      max-width: 70vw;
    }

    .dialogue-box {
      max-height: 9.5rem;
      padding-block: 0.75rem;
      overflow-y: auto;
    }

    .dialogue-text {
      min-height: 0;
      font-size: 1rem;
      line-height: 1.45;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .typewriter-cursor {
      animation: none;
    }
  }
</style>
