<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { getTranslations } from '@aquila/stories/translations';
  import { readerState } from '@/lib/reader-state.svelte';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    onIndexChange = () => {},
    onRetry = () => {},
    showBookmarkButton = true,
    backUrl = '/',
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    onIndexChange?: (index: number) => void;
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
  let loadStatus = $derived(readerState.loadStatus);
  let loadError = $derived(readerState.loadError);
  let hasActivePayload = $derived(readerState.hasActivePayload);
  let isBlocking = $derived(
    loadStatus === 'loading' || loadStatus === 'error'
  );
  let t = $derived(getTranslations(locale));
  let readerReadyElement: HTMLElement | null = $state(null);

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

{#if hasActivePayload && activeFlow}
  <div class="relative min-h-screen">
    <div
      bind:this={readerReadyElement}
      data-testid="reader-ready"
      aria-hidden={isBlocking ? 'true' : undefined}
    >
      {#if isMobile}
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
      <div class="absolute inset-0 z-60 flex items-center justify-center bg-slate-950/45 p-6">
        {@render loadSurface()}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex min-h-screen items-center justify-center bg-slate-950 p-6">
    {@render loadSurface()}
  </div>
{/if}
