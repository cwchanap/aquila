<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Locale, StoryNotesPayload } from '@aquila/stories';
  import { hasStoryNotes, isRegisteredStoryId, loadStoryNotes } from '@aquila/stories/async';
  import { getTranslations } from '@aquila/stories/translations';
  import type { AuthState } from '@/lib/auth-utils';
  import { StoryProgressView } from '@/lib/story-progress-view.svelte';
  import { selectCharacterNotes } from '@/lib/character-notes';
  import Characters from './Characters.svelte';

  let { storyId, locale, authState, userId }: {
    storyId: string; locale: Locale; authState: AuthState; userId: string | null;
  } = $props();
  const progress = new StoryProgressView(untrack(() => ({ locale, authState, userId })));
  let supported = $derived(isRegisteredStoryId(storyId) && hasStoryNotes(storyId));
  let t = $derived(getTranslations(locale));
  let payload = $state.raw<StoryNotesPayload | null>(null);
  let failed = $state(false);
  onMount(() => {
    if (!supported) return;
    const cleanup = progress.mount();
    let active = true;
    loadStoryNotes(storyId).then(value => {
      if (active) payload = value;
    }).catch(() => {
      if (active) failed = true;
    });
    return () => { active = false; cleanup(); };
  });
  let model = $derived(payload ? selectCharacterNotes({
    ...payload, progress: progress.progress[storyId], locale, t,
  }) : null);
</script>

{#if !supported}
  <div class="rounded-2xl border border-white/20 bg-slate-950/40 p-8 text-center text-white">
    <p>{t.notes.chooseStory}</p>
    <a class="mt-4 inline-block rounded-full bg-white px-5 py-3 font-semibold text-slate-900" href={`/${locale}/stories`}>{t.notes.browseStories}</a>
  </div>
{:else if failed}
  <p role="alert" class="text-white">{t.notes.error}</p>
{:else if model}
  <Characters {model} {locale} />
{:else}
  <p role="status" class="text-white">{t.notes.loading}</p>
{/if}
