<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { DialogueEntry } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import { readerState } from '@/lib/reader-state.svelte';
  import {
    readReaderMode,
    writeReaderMode,
    type ReaderMode,
  } from '@/lib/reader-mode';
  import {
    createVisualRuntime as createDefaultVisualRuntime,
    type VisualReaderRuntime,
  } from '@/lib/visual-assets';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';
  import VisualNovelReader from '@/components/VisualNovelReader.svelte';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    onIndexChange = () => {},
    getSceneDialogue = () => null,
    createVisualRuntime = createDefaultVisualRuntime,
    onRetry = () => {},
    showBookmarkButton = true,
    backUrl = '/',
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    onIndexChange?: (index: number) => void;
    getSceneDialogue?: (
      storyId: string,
      sceneId: string
    ) => readonly DialogueEntry[] | null;
    createVisualRuntime?: typeof createDefaultVisualRuntime;
    onRetry?: () => void;
    showBookmarkButton?: boolean;
    backUrl?: string;
  } = $props();

  // Full reactive store->props bridge: every progressive field is derived here.
  let dialogue = $derived(readerState.dialogue);
  let choice = $derived(readerState.choice);
  let storyId = $derived(readerState.storyId);
  let currentSceneId = $derived(readerState.currentSceneId);
  let canGoNext = $derived(readerState.canGoNext);
  let locale = $derived(readerState.locale);
  let dialogueIndex = $derived(readerState.dialogueIndex);
  let activeFlow = $derived(readerState.activeFlow);
  let presentation = $derived(readerState.presentation);
  let loadStatus = $derived(readerState.loadStatus);
  let loadError = $derived(readerState.loadError);
  let hasActivePayload = $derived(readerState.hasActivePayload);
  let isBlocking = $derived(
    loadStatus === 'loading' || loadStatus === 'error'
  );
  let t = $derived(getTranslations(locale));
  let readerReadyElement: HTMLElement | null = $state(null);
  let readerMode = $state(readReaderMode());
  let visualRuntime: VisualReaderRuntime | null = $state(null);
  let visualRuntimeStoryId: string | null = $state(null);
  let visualRuntimeAttempted = $state(false);
  let visualRuntimeTransitioning = $state(false);
  let runtimeGeneration = 0;
  let destroyed = false;
  let removeVisibilityListener = () => {};

  function setReaderMode(mode: ReaderMode): void {
    if (readerMode === mode) return;
    const retainedRuntime =
      mode === 'visual' &&
      visualRuntimeStoryId === storyId
        ? visualRuntime
        : null;
    readerMode = mode;
    writeReaderMode(mode);
    if (retainedRuntime) void retainedRuntime.softRevalidate();
  }

  function runtimeOrigin(): string {
    return globalThis.location?.origin ?? 'http://localhost';
  }

  function ensureVisualRuntime(activeStoryId: string): void {
    if (
      destroyed ||
      visualRuntimeTransitioning ||
      (visualRuntimeAttempted &&
        visualRuntimeStoryId === activeStoryId)
    ) {
      return;
    }
    visualRuntimeStoryId = activeStoryId;
    visualRuntimeAttempted = true;
    visualRuntime = createVisualRuntime(
      activeStoryId,
      runtimeOrigin(),
      getSceneDialogue
    );
  }

  async function disposeRuntimeForStoryChange(
    nextStoryId: string
  ): Promise<void> {
    const generation = ++runtimeGeneration;
    const runtime = visualRuntime;
    visualRuntime = null;
    visualRuntimeStoryId = nextStoryId;
    visualRuntimeAttempted = false;
    visualRuntimeTransitioning = true;
    await runtime?.dispose();
    if (destroyed || generation !== runtimeGeneration) return;
    visualRuntimeTransitioning = false;
  }

  $effect(() => {
    const activeStoryId = storyId;
    const wantsVisualRuntime =
      readerMode === 'visual' &&
      hasActivePayload &&
      activeFlow !== null;
    if (visualRuntimeTransitioning) return;
    if (
      visualRuntimeStoryId !== null &&
      visualRuntimeStoryId !== activeStoryId
    ) {
      void disposeRuntimeForStoryChange(activeStoryId);
      return;
    }
    if (wantsVisualRuntime) ensureVisualRuntime(activeStoryId);
  });

  let lastActiveLineKey: string | null = $state(null);
  $effect(() => {
    const activeLineKey =
      `${storyId}\u0000${currentSceneId}\u0000${dialogueIndex}`;
    if (lastActiveLineKey === null) {
      lastActiveLineKey = activeLineKey;
      return;
    }
    if (activeLineKey === lastActiveLineKey) return;
    lastActiveLineKey = activeLineKey;
    if (
      readerMode === 'visual' &&
      visualRuntime &&
      visualRuntimeStoryId === storyId
    ) {
      void visualRuntime.softRevalidate();
    }
  });

  // Svelte updates `inert` as a DOM property, which does not reflect to an
  // attribute in every runtime. Keep the actual attribute synchronized so
  // assistive technology, CSS selectors, and the inert polyfill all observe
  // the blocking state without replacing the mounted reader subtree.
  $effect(() => {
    if (!readerReadyElement) return;
    if (isBlocking) readerReadyElement.setAttribute('inert', '');
    else readerReadyElement.removeAttribute('inert');
  });

  function loadErrorMessage(): string {
    if (loadError?.code === 'unknown-story') return t.reader.unknownStory;
    if (loadError?.code === 'unsupported-locale') {
      return t.reader.unsupportedLocale;
    }
    return t.reader.storyLoadFailed;
  }

  const MOBILE_QUERY = '(max-width: 1023px)';
  function readMatch(): boolean {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }
    return window.matchMedia(MOBILE_QUERY).matches;
  }
  let isMobile = $state(readMatch());

  // Tracks whether ANY leaf reader has ever mounted in this ReaderShell
  // instance. The first leaf to mount sees `isInitialMount=true` (a genuine
  // fresh scene start — animate line 0 per spec). On a responsive-breakpoint
  // swap, the old leaf unmounts and a NEW leaf mounts; that new leaf sees
  // `isInitialMount=false` and snaps the current line instead of re-typing it,
  // even at index 0. Without this signal the leaf cannot distinguish a
  // breakpoint remount at index 0 from a fresh scene start at index 0.
  //
  // The flip waits for the first payload-backed leaf's mount effects to flush,
  // rather than ReaderShell's own mount. Task 7 mounts the shell before its
  // initial async payload exists; flipping on the shell mount would make that
  // eventual first leaf look like a responsive remount and incorrectly snap.
  let everMounted = $state(false);
  let isInitialMount = $derived(!everMounted);

  $effect(() => {
    if (everMounted || !hasActivePayload || !activeFlow) return;
    void tick().then(() => {
      if (readerState.hasActivePayload && readerState.activeFlow) {
        everMounted = true;
      }
    });
  });

  onMount(() => {
    const handleVisibility = (): void => {
      if (
        document.visibilityState === 'visible' &&
        readerMode === 'visual' &&
        visualRuntime &&
        visualRuntimeStoryId === storyId
      ) {
        void visualRuntime.softRevalidate();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    removeVisibilityListener = () =>
      document.removeEventListener('visibilitychange', handleVisibility);

    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = (e: globalThis.MediaQueryListEvent) => {
      isMobile = e.matches;
    };
    isMobile = mql.matches;
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  });

  onDestroy(() => {
    destroyed = true;
    runtimeGeneration += 1;
    removeVisibilityListener();
    const runtime = visualRuntime;
    visualRuntime = null;
    void runtime?.dispose();
  });
</script>

{#snippet loadSurface()}
  {#if loadStatus === 'error'}
    <div
      role="alert"
      class="flex flex-col items-center gap-4 rounded-2xl bg-slate-950/90 p-8 text-center text-white shadow-2xl"
    >
      <p>{loadErrorMessage()}</p>
      {#if loadError?.code === 'load-failed'}
        <button
          type="button"
          class="rounded-lg bg-white px-5 py-2 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          onclick={onRetry}
        >
          {t.reader.retry}
        </button>
      {:else}
        <a
          class="rounded-lg bg-white px-5 py-2 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          href={`/${locale}/stories`}
        >
          {t.reader.backToStories}
        </a>
      {/if}
    </div>
  {:else}
    <div
      role="status"
      class="rounded-2xl bg-slate-950/90 p-8 text-center text-white shadow-2xl"
    >
      {t.reader.loadingStory}
    </div>
  {/if}
{/snippet}

<div
  role="group"
  class="fixed z-[80]"
  style="top: calc(0.75rem + env(safe-area-inset-top)); right: calc(0.75rem + env(safe-area-inset-right));"
  data-reader-mode={readerMode}
  aria-label={t.reader.readerMode}
  data-reader-interactive
>
  <button
    type="button"
    aria-pressed={readerMode === 'text'}
    onclick={() => setReaderMode('text')}
  >
    {t.reader.textMode}
  </button>
  <button
    type="button"
    aria-pressed={readerMode === 'visual'}
    onclick={() => setReaderMode('visual')}
  >
    {t.reader.visualNovelMode}
  </button>
</div>

{#if hasActivePayload && activeFlow}
  <div class="relative min-h-screen">
    <div
      bind:this={readerReadyElement}
      data-testid="reader-ready"
      aria-hidden={isBlocking ? 'true' : undefined}
    >
      {#if readerMode === 'visual'}
        <VisualNovelReader
          controller={visualRuntimeStoryId === storyId
            ? visualRuntime?.controller ?? null
            : null}
          flow={activeFlow}
          {dialogueIndex}
          {onIndexChange}
          {dialogue}
          {choice}
          {storyId}
          {currentSceneId}
          {canGoNext}
          {locale}
          {presentation}
          {onChoice}
          {onBookmark}
          {onNext}
          {onNavigate}
          {backUrl}
          {showBookmarkButton}
          {isInitialMount}
          interactionDisabled={isBlocking}
        />
      {:else if isMobile}
        <MobileNovelReader
          flow={activeFlow}
          {dialogueIndex}
          {onIndexChange}
          {dialogue}
          {choice}
          {storyId}
          {currentSceneId}
          {canGoNext}
          {locale}
          {onChoice}
          {onBookmark}
          {onNext}
          {onNavigate}
          {backUrl}
          {showBookmarkButton}
          {isInitialMount}
          interactionDisabled={isBlocking}
        />
      {:else}
        <NovelReader
          flow={activeFlow}
          {dialogueIndex}
          {onIndexChange}
          {dialogue}
          {choice}
          {storyId}
          {currentSceneId}
          {canGoNext}
          {locale}
          {onChoice}
          {onBookmark}
          {onNext}
          {onNavigate}
          {backUrl}
          {showBookmarkButton}
          {isInitialMount}
          interactionDisabled={isBlocking}
        />
      {/if}
    </div>

    {#if isBlocking}
      <div class="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-6">
        {@render loadSurface()}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex min-h-screen items-center justify-center bg-slate-950 p-6">
    {@render loadSurface()}
  </div>
{/if}
