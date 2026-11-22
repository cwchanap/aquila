<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    BookOpen,
    ChevronRight,
    Cloud,
    CloudCheck,
    CloudOff,
    MonitorSmartphone,
  } from 'lucide-svelte';
  import type { Locale, StoryNotesPayload } from '@aquila/stories';
  import { hasStoryNotes, loadStoryNotes } from '@aquila/stories/async';
  import { getTranslations } from '@aquila/stories/translations';
  import { STORY_CATALOG } from '@aquila/stories/catalog';
  import type { AuthState } from '@/lib/auth-utils';
  import { StoryProgressView } from '@/lib/story-progress-view.svelte';
  import {
    progressSyncPresentation,
    type CloudSyncStatus,
  } from '@/lib/sync-presentation';
  import {
    STORY_ACCENTS,
    storyIconFor,
  } from '@/lib/story-presentation';
  import { buildCards, fill } from '@/lib/story-select';
  import { selectCharacterNotes } from '@/lib/character-notes';
  import {
    lastReadLabel,
    startedStoryCards,
    summarizeProgress,
  } from '@/lib/progress-summary';

  let {
    locale,
    authState: serverAuthState,
    userId: serverUserId,
  }: { locale: Locale; authState: AuthState; userId: string | null } = $props();

  const view = new StoryProgressView(
    untrack(() => ({
      locale,
      authState: serverAuthState,
      userId: serverUserId,
    }))
  );

  let mounted = $state(false);
  let translations = $derived(getTranslations(locale));
  let t = $derived(translations.progress);
  let common = $derived(translations.common);
  let cards = $derived(
    buildCards(STORY_CATALOG, view.progress, locale, translations.stories)
  );
  let summary = $derived(summarizeProgress(cards));
  let rows = $derived(startedStoryCards(cards));
  let notStarted = $derived(summary.total - summary.started);
  let notesPayloads = $state<Record<string, StoryNotesPayload | null>>({});
  $effect(() => {
    if (!mounted) return;
    for (const card of rows) {
      const id = card.entry.id;
      if (!hasStoryNotes(id) || id in notesPayloads) continue;
      notesPayloads[id] = null;
      void loadStoryNotes(id).then(payload => {
        notesPayloads[id] = payload;
      }).catch(() => {
        // The link remains usable if its optional count cannot load.
      });
    }
  });
  let readyForEmpty = $derived(
    mounted && (view.authState === 'signed-out' || view.syncState !== 'idle')
  );

  let cloudState = $derived<CloudSyncStatus>(
    view.syncState === 'idle' ? 'syncing' : view.syncState
  );
  let cloudCard = $derived(progressSyncPresentation(t)[cloudState]);

  onMount(() => {
    mounted = true;
    return view.mount();
  });
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-6" data-testid="my-progress">
  {#if view.authState === 'signed-out'}
    <section data-testid="save-card" class="rounded-2xl border border-white/25 bg-slate-950/30 p-4 backdrop-blur-xl sm:p-5">
      <div class="flex items-center gap-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/85 sm:h-12 sm:w-12">
          <MonitorSmartphone class="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="font-serif text-base font-semibold text-white sm:text-lg">{t.localSaveTitle}</h2>
          <p class="text-sm text-white/75">{t.localSaveBody}</p>
        </div>
      </div>
      <div class="mt-4 flex flex-col gap-3 rounded-xl border border-cyan-200/40 bg-cyan-300/15 p-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-3">
        <Cloud class="hidden h-5 w-5 shrink-0 text-cyan-100 sm:block" aria-hidden="true" />
        <p class="flex-1 text-sm text-white"><span class="font-semibold">{t.signInTipTitle}</span> {t.signInTipBody}</p>
        <a
          href={`/${locale}/login`}
          class="shrink-0 rounded-full bg-white px-4 py-2 text-center text-sm font-semibold text-blue-900 transition-transform duration-300 motion-safe:hover:scale-105"
        >{t.signInTipAction}</a>
      </div>
    </section>
  {:else if view.authState === 'unavailable'}
    <section data-testid="save-card" class="flex items-center gap-4 rounded-2xl border border-white/25 bg-slate-950/30 p-4 backdrop-blur-xl sm:p-5">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/85 sm:h-12 sm:w-12">
        <MonitorSmartphone class="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="font-serif text-base font-semibold text-white sm:text-lg">{t.unavailableTitle}</h2>
        <p class="text-sm text-white/75">{t.unavailableBody}</p>
      </div>
    </section>
  {:else}
    <section data-testid="save-card" class="flex items-center gap-4 rounded-2xl border border-white/25 bg-slate-950/30 p-4 backdrop-blur-xl sm:p-5">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 {cloudCard.iconBoxClass}">
        {#if cloudCard.icon === 'check'}
          <CloudCheck class="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        {:else if cloudCard.icon === 'syncing'}
          <Cloud class="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        {:else}
          <CloudOff class="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
        {/if}
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="font-serif text-base font-semibold text-white sm:text-lg">{t.cloudSaveTitle}</h2>
        <p class="text-sm text-white/75">{cloudCard.body}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        {#if cloudState === 'failed'}
          <button
            type="button"
            onclick={() => void view.retry()}
            class="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
          >{common.retry}</button>
        {/if}
        <span role="status" class="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/85">
          <span class="h-1.5 w-1.5 rounded-full {cloudCard.dotClass}" aria-hidden="true"></span>{cloudCard.chip}
        </span>
      </div>
    </section>
  {/if}

  {#if view.localReadFailed}
    <div data-testid="read-error" role="status" class="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-amber-300/40 bg-slate-950/25 px-6 py-10 text-center backdrop-blur-xl">
      <CloudOff class="h-8 w-8 text-amber-200" aria-hidden="true" />
      <h2 class="font-serif text-lg font-semibold text-white">{t.readErrorTitle}</h2>
      <p class="text-sm text-white/75">{t.readErrorBody}</p>
    </div>
  {:else if summary.started === 0}
    {#if readyForEmpty}
      <div class="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/25 px-6 py-10 text-center backdrop-blur-xl">
        <BookOpen class="h-8 w-8 text-white/80" aria-hidden="true" />
        <h2 class="font-serif text-lg font-semibold text-white">{t.emptyTitle}</h2>
        <p class="text-sm text-white/75">{t.emptyBody}</p>
        <a
          href={`/${locale}/stories`}
          class="mt-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-blue-900 transition-transform duration-300 motion-safe:hover:scale-105"
        >{t.browseStories}</a>
      </div>
    {/if}
  {:else}
    <div class="grid grid-cols-3 gap-2 sm:gap-4">
      <div data-testid="count-started" class="rounded-xl border border-white/15 bg-slate-950/25 p-2.5 text-center backdrop-blur-xl sm:rounded-2xl sm:p-4">
        <p class="font-serif text-xl font-semibold text-white sm:text-3xl">{summary.started} <span class="text-sm text-white/60 sm:text-lg">/ {summary.total}</span></p>
        <p class="mt-1 text-[0.65rem] text-white/75 sm:text-xs sm:uppercase sm:tracking-[0.16em]">{t.storiesStarted}</p>
      </div>
      <div data-testid="count-finished" class="rounded-xl border border-white/15 bg-slate-950/25 p-2.5 text-center backdrop-blur-xl sm:rounded-2xl sm:p-4">
        <p class="font-serif text-xl font-semibold text-white sm:text-3xl">{summary.finished}</p>
        <p class="mt-1 text-[0.65rem] text-white/75 sm:text-xs sm:uppercase sm:tracking-[0.16em]">{t.finishedLabel}</p>
      </div>
      <div data-testid="count-endings" class="rounded-xl border border-white/15 bg-slate-950/25 p-2.5 text-center backdrop-blur-xl sm:rounded-2xl sm:p-4">
        <p class="font-serif text-xl font-semibold text-white sm:text-3xl">{summary.endingsFound} <span class="text-sm text-white/60 sm:text-lg">/ {summary.endingsTotal}</span></p>
        <p class="mt-1 text-[0.65rem] text-white/75 sm:text-xs sm:uppercase sm:tracking-[0.16em]">{t.endingsFoundLabel}</p>
      </div>
    </div>

    <section aria-labelledby="your-stories-heading" class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between">
        <h2 id="your-stories-heading" class="font-serif text-xl font-semibold text-white drop-shadow-[0_1px_8px_rgba(15,23,42,0.55)] sm:text-2xl">{t.yourStories}</h2>
        <p class="text-sm text-white/85">{t.mostRecentFirst}</p>
      </div>
      <ul class="flex flex-col gap-2.5 sm:gap-3">
        {#each rows as card (card.entry.id)}
          {@const accent = STORY_ACCENTS[card.entry.accent]}
          {@const Icon = storyIconFor(card.entry.id)}
          {@const lastRead = lastReadLabel(card.progress?.updatedAt ?? 0, locale)}
          <li>
            <a
              href={card.href}
              data-story-id={card.entry.id}
              aria-labelledby="progress-{card.entry.id}-title progress-{card.entry.id}-action"
              class="group flex items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/35 p-3 backdrop-blur-xl transition-all duration-300 sm:gap-4 sm:p-4 motion-safe:hover:-translate-y-0.5 {accent.ring}"
            >
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white sm:h-14 sm:w-14 {accent.cover}">
                <Icon class="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              </span>
              <span class="flex min-w-0 flex-1 flex-col gap-1">
                <span class="text-[0.65rem] font-medium uppercase tracking-[0.16em] {accent.text}">{card.entry.format === 'saga' ? t.formatSaga : t.formatShort} · {card.genre}</span>
                <span id="progress-{card.entry.id}-title" class="truncate font-serif text-base font-semibold text-white sm:text-lg">{card.title}</span>
                <span class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
                  {#if card.endingsTotal > 0}
                    <span class="flex gap-1" aria-hidden="true">
                      {#each Array.from({ length: card.endingsTotal }, (_, k) => k) as n (n)}
                        <span class="h-2 w-2 rounded-full border border-white/70 {n < card.endingsFound ? accent.dot : ''}"></span>
                      {/each}
                    </span>
                  {/if}
                  <span class="font-semibold text-white">{card.status}</span>
                  {#if lastRead}
                    <span class="text-white/60">{fill(t.lastRead, { when: lastRead })}</span>
                  {/if}
                </span>
                {#if card.fraction !== null}
                  <span class="mt-1 h-1 w-full max-w-md overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                    <span class="block h-full rounded-full {accent.bar}" style="width: {Math.max(4, Math.round(card.fraction * 100))}%"></span>
                  </span>
                {/if}
              </span>
              <span id="progress-{card.entry.id}-action" class="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold sm:px-4 sm:py-2 {card.action === 'continue' ? 'bg-white text-blue-900' : 'bg-white/15 text-white'}">{card.actionLabel}</span>
            </a>
            {#if hasStoryNotes(card.entry.id)}
              <a
                href={`/${locale}/notes?story=${encodeURIComponent(card.entry.id)}`}
                class="mt-2 inline-flex min-h-11 items-center rounded-full border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
              >
                {translations.notes.title}
                {#if notesPayloads[card.entry.id]}
                  <span class="ml-2">{selectCharacterNotes({ ...notesPayloads[card.entry.id]!, progress: card.progress, locale, t: translations }).metCount}</span>
                {/if}
              </a>
            {/if}
          </li>
        {/each}
      </ul>
      <a
        href={`/${locale}/stories`}
        data-testid="browse-stories"
        class="flex items-center justify-between rounded-2xl border border-dashed border-white/30 px-4 py-3 text-xs text-white/85 transition-colors duration-300 hover:border-white/50 sm:px-5 sm:py-4 sm:text-sm"
      >
        <span>{fill(t.notStartedYet, { n: notStarted })}</span>
        <span class="flex items-center gap-1 font-semibold text-white">{t.browseStories} <ChevronRight class="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" /></span>
      </a>
    </section>
  {/if}
</div>
