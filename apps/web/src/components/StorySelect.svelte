<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Building2,
    Crown,
    CupSoda,
    Moon,
    Orbit,
    Sparkles,
    TrainFront,
    WashingMachine,
  } from 'lucide-svelte';
  import type { Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import { STORY_CATALOG, type StoryAccent } from '@aquila/stories/catalog';
  import { getBrowserStorage } from '@/lib/reader-mode';
  import {
    StoryProgressStore,
    importSavedSessions,
    type StoryProgressMap,
  } from '@/lib/story-progress-store';
  import { buildCards, pickContinueCard } from '@/lib/story-select';

  let { locale }: { locale: Locale } = $props();

  let t = $derived(getTranslations(locale).stories);
  // Server render (and the first client frame) shows every story as unread;
  // saved progress lives in this browser only and is applied on mount.
  let progress: StoryProgressMap = $state({});
  let cards = $derived(buildCards(STORY_CATALOG, progress, locale, t));
  let shorts = $derived(cards.filter(c => c.entry.format === 'short'));
  let sagas = $derived(cards.filter(c => c.entry.format === 'saga'));
  let continueCard = $derived(pickContinueCard(cards));

  const ACCENTS: Record<
    StoryAccent,
    { cover: string; ring: string; text: string; dot: string; bar: string }
  > = {
    rose: { cover: 'from-rose-500/50 to-amber-400/40', ring: 'hover:border-rose-300/50', text: 'text-rose-200', dot: 'bg-rose-200', bar: 'bg-rose-300' },
    cyan: { cover: 'from-cyan-500/50 to-blue-500/40', ring: 'hover:border-cyan-300/50', text: 'text-cyan-200', dot: 'bg-cyan-200', bar: 'bg-cyan-300' },
    indigo: { cover: 'from-indigo-500/50 to-violet-500/40', ring: 'hover:border-indigo-300/50', text: 'text-indigo-200', dot: 'bg-indigo-200', bar: 'bg-indigo-300' },
    red: { cover: 'from-red-950/90 to-rose-700/70', ring: 'hover:border-red-300/50', text: 'text-red-200', dot: 'bg-red-200', bar: 'bg-red-300' },
    pink: { cover: 'from-pink-400/70 to-amber-300/60', ring: 'hover:border-pink-300/50', text: 'text-pink-200', dot: 'bg-pink-200', bar: 'bg-pink-300' },
    violet: { cover: 'from-indigo-950/90 to-violet-600/70', ring: 'hover:border-violet-300/50', text: 'text-violet-200', dot: 'bg-violet-200', bar: 'bg-violet-300' },
    amber: { cover: 'from-amber-400/80 to-orange-600/70', ring: 'hover:border-amber-300/50', text: 'text-amber-200', dot: 'bg-amber-200', bar: 'bg-amber-300' },
    emerald: { cover: 'from-emerald-900/90 to-lime-300/50', ring: 'hover:border-emerald-300/50', text: 'text-emerald-200', dot: 'bg-emerald-200', bar: 'bg-emerald-300' },
  };

  const ICONS: Record<string, typeof Sparkles> = {
    the_seventh_mirror: Sparkles,
    train_adventure: TrainFront,
    dont_save_me_before_midnight: Moon,
    elevator_game: Building2,
    three_am_laundromat: WashingMachine,
    day_4012: Orbit,
    demon_lord_is_hiring: Crown,
    one_pot_before_dawn: CupSoda,
  };

  function iconFor(id: string) {
    return ICONS[id] ?? Sparkles;
  }

  function refresh(): void {
    const storage = getBrowserStorage();
    const store = new StoryProgressStore(storage);
    // Places saved before per-story progress existed live only in the
    // reader's per-locale session; carry them over once so an existing
    // reader still sees Continue.
    importSavedSessions(store, storage, locale === 'zh' ? ['zh', 'en'] : ['en', 'zh']);
    progress = store.getAll();
  }

  onMount(() => {
    refresh();
    // Returning with the Back button can restore this page from the
    // back/forward cache; re-read so the cards show the latest place.
    const onPageShow = (event: Event) => {
      if ((event as Event & { persisted?: boolean }).persisted) refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  });
</script>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-12" data-testid="story-select">
  {#if continueCard}
    {@const accent = ACCENTS[continueCard.entry.accent]}
    {@const Icon = iconFor(continueCard.entry.id)}
    <section aria-labelledby="continue-heading" class="motion-safe:animate-[fadeSlideUp_0.5s_ease_both]">
      <h2 id="continue-heading" class="sr-only">{t.continueReading}</h2>
      <a
        href={continueCard.href}
        data-testid="continue-reading"
        class="group flex items-center gap-4 rounded-2xl border border-white/25 bg-slate-950/30 p-4 backdrop-blur-xl transition-colors duration-300 hover:bg-slate-950/40 {accent.ring}"
      >
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br {accent.cover}">
          <Icon class="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col gap-1">
          <span class="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/60">{t.continueReading}</span>
          <span class="truncate font-serif text-lg font-semibold text-white">{continueCard.title}</span>
          <span class="text-xs text-white/70">{continueCard.status}</span>
          {#if continueCard.fraction !== null}
            <span class="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/20" aria-hidden="true">
              <span class="block h-full rounded-full {accent.bar}" style="width: {Math.round(continueCard.fraction * 100)}%"></span>
            </span>
          {/if}
        </span>
        <span class="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-900 transition-transform duration-300 motion-safe:group-hover:scale-105">
          {t.continue}
        </span>
      </a>
    </section>
  {/if}

  <section aria-labelledby="quick-reads-heading" class="flex flex-col gap-4" data-testid="quick-reads">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="quick-reads-heading" class="font-serif text-2xl font-semibold text-white drop-shadow-[0_1px_8px_rgba(15,23,42,0.55)]">{t.quickReads}</h2>
      <p class="text-sm text-white/85 drop-shadow-[0_1px_6px_rgba(15,23,42,0.6)]">{t.quickReadsHint}</p>
    </div>
    <ul class="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-5">
      {#each shorts as card, i (card.entry.id)}
        {@const accent = ACCENTS[card.entry.accent]}
        {@const Icon = iconFor(card.entry.id)}
        <li class="w-44 shrink-0 snap-start md:w-auto motion-safe:animate-[fadeSlideUp_0.5s_ease_both]" style="animation-delay: {0.05 * i}s">
          <a
            href={card.href}
            data-story-id={card.entry.id}
            aria-labelledby="story-{card.entry.id}-title"
            aria-describedby="story-{card.entry.id}-meta story-{card.entry.id}-desc"
            class="story-card group flex h-full flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/35 backdrop-blur-xl transition-all duration-300 motion-safe:hover:-translate-y-1 {accent.ring}"
          >
            <span class="relative flex h-24 items-center justify-center bg-linear-to-br {accent.cover}">
              <Icon class="h-8 w-8 text-white/90" aria-hidden="true" />
              <span class="absolute bottom-2 right-2 rounded-full bg-black/45 px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums text-white">
                {card.length}
              </span>
            </span>
            <div class="flex flex-1 flex-col gap-1.5 p-3">
              <span class="text-[0.65rem] font-medium uppercase tracking-[0.16em] {accent.text}">{card.genre}</span>
              <h3 id="story-{card.entry.id}-title" class="font-serif text-base font-semibold leading-snug text-white">{card.title}</h3>
              <p id="story-{card.entry.id}-desc" class="line-clamp-3 text-xs font-light leading-relaxed text-white/75">{card.teaser}</p>
              <span id="story-{card.entry.id}-meta" class="mt-auto flex items-center gap-1.5 pt-2 text-[0.7rem] text-white/75">
                <span class="sr-only">{card.length}.</span>
                <span class="flex gap-1" aria-hidden="true">
                  {#each Array.from({ length: card.endingsTotal }, (_, k) => k) as n (n)}
                    <span class="h-2 w-2 rounded-full border border-white/70 {n < card.endingsFound ? accent.dot : ''}"></span>
                  {/each}
                </span>
                <span>{card.status}</span>
              </span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section aria-labelledby="sagas-heading" class="flex flex-col gap-4" data-testid="sagas">
    <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id="sagas-heading" class="font-serif text-2xl font-semibold text-white drop-shadow-[0_1px_8px_rgba(15,23,42,0.55)]">{t.sagas}</h2>
      <p class="text-sm text-white/85 drop-shadow-[0_1px_6px_rgba(15,23,42,0.6)]">{t.sagasHint}</p>
    </div>
    <ul class="grid grid-cols-1 gap-4 md:grid-cols-3">
      {#each sagas as card, i (card.entry.id)}
        {@const accent = ACCENTS[card.entry.accent]}
        {@const Icon = iconFor(card.entry.id)}
        <li class="flex flex-col rounded-2xl border border-white/15 bg-slate-950/35 backdrop-blur-xl transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:animate-[fadeSlideUp_0.5s_ease_both] {accent.ring}" style="animation-delay: {0.1 + 0.05 * i}s">
          <a
            href={card.href}
            data-story-id={card.entry.id}
            aria-labelledby="story-{card.entry.id}-title"
            aria-describedby="story-{card.entry.id}-meta story-{card.entry.id}-desc"
            class="story-card group flex flex-1 flex-col gap-3 p-6"
          >
            <span class="flex items-start justify-between">
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br {accent.cover}">
                <Icon class="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span class="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white transition-colors duration-300 group-hover:bg-white group-hover:text-blue-900">
                {card.actionLabel}
              </span>
            </span>
            <span class="text-[0.65rem] font-medium uppercase tracking-[0.16em] {accent.text}">{card.genre}</span>
            <h3 id="story-{card.entry.id}-title" class="font-serif text-xl font-semibold leading-snug text-white">{card.title}</h3>
            <p id="story-{card.entry.id}-desc" class="text-sm font-light leading-relaxed text-white/75">{card.teaser}</p>
            <span id="story-{card.entry.id}-meta" class="mt-auto flex flex-col gap-2 pt-2">
              <span class="text-xs tabular-nums text-white/70">{card.length}</span>
              {#if card.fraction !== null}
                <span class="h-1 w-full overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                  <span class="block h-full rounded-full {accent.bar}" style="width: {Math.round(card.fraction * 100)}%"></span>
                </span>
              {/if}
              <span class="text-xs font-semibold text-white">{card.status}</span>
            </span>
          </a>
          {#if card.startOverHref}
            <a
              href={card.startOverHref}
              data-testid="start-over-{card.entry.id}"
              class="mx-6 mb-5 self-start text-xs text-white/70 underline-offset-4 hover:text-white hover:underline"
            >
              {t.startOver}
              <span class="sr-only">: {card.title}</span>
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
</div>
