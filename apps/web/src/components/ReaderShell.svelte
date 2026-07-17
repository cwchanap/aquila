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

{#if isMobile}
  <MobileNovelReader
    {dialogueIndex}
    initialDialogueIndex={dialogueIndex}
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
  />
{/if}
