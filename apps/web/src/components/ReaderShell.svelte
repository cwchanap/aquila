<script lang="ts">
  import { onMount } from 'svelte';
  import { readerState } from '@/lib/reader-state.svelte';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    onIndexChange = () => {},
    showBookmarkButton = true,
    backUrl = '/',
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string) => void;
    onIndexChange?: (index: number) => void;
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
  // The flip happens in onMount (NOT $effect) so it runs strictly AFTER the
  // first leaf's mount effects have flushed with `isInitialMount=true`. An
  // $effect could race with the leaf's Signal 1 effect and flip the prop
  // before the leaf read it, making the first mount snap instead of animate.
  let everMounted = $state(false);
  let isInitialMount = $derived(!everMounted);

  onMount(() => {
    everMounted = true;
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

{#if isMobile}
  <MobileNovelReader
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
  />
{:else}
  <NovelReader
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
  />
{/if}
