<script lang="ts">
  import { onMount } from 'svelte';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';

  let props: {
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

  // Live dialogue index reported by whichever reader is currently mounted.
  // Once a layout swap has occurred, this takes precedence over the static
  // `initialDialogueIndex` prop so that swapping readers across the
  // mobile/desktop breakpoint re-seeds the newly mounted reader at the user's
  // current line rather than resetting to 0 or re-applying a stale bookmark
  // offset captured at first mount.
  //
  // `hasSwapped` gates the feedback loop: on the first mount we must NOT let
  // the reader's initial `onIndexChange(0)` report clobber a bookmark
  // `initialDialogueIndex` prop before the reader's own initial-index effect
  // has applied it. Only after the first media-query transition do we trust
  // `liveIndex` over the original prop.
  let liveIndex = $state<number | null>(null);
  let hasSwapped = $state(false);
  let effectiveInitialDialogueIndex = $derived(
    hasSwapped
      ? (liveIndex !== null ? liveIndex : (props.initialDialogueIndex ?? null))
      : (props.initialDialogueIndex ?? null)
  );

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
      hasSwapped = true;
    };
    isMobile = mql.matches;
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  });
</script>

{#if isMobile}
  <MobileNovelReader
    {...props}
    initialDialogueIndex={effectiveInitialDialogueIndex}
    onIndexChange={(index: number) => (liveIndex = index)}
  />
{:else}
  <NovelReader
    {...props}
    initialDialogueIndex={effectiveInitialDialogueIndex}
    onIndexChange={(index: number) => (liveIndex = index)}
  />
{/if}
