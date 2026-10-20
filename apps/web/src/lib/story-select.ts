import type { StoryCatalogEntry } from '@aquila/stories/catalog';
import {
    ZH_CHARS_PER_MINUTE,
    estimateReadingMinutes,
    hasStoryText,
} from '@aquila/stories/catalog';
import type { Translations } from '@aquila/stories';
import type { StoryProgress, StoryProgressMap } from './story-progress-store';

type StoriesText = Translations['stories'];

export type StoryAction = 'start' | 'continue' | 'readAgain';

export interface StoryCardModel {
    entry: StoryCatalogEntry;
    title: string;
    teaser: string;
    genre: string;
    /** "8 min" for a short story, "8 chapters · ~13 h" for a saga. */
    length: string;
    /** "New", "1 of 2 endings", "Chapter 9 of 28", "Finished", … */
    status: string;
    action: StoryAction;
    actionLabel: string;
    /** Where the card's main link goes: the saved place, or the beginning. */
    href: string;
    /** Set when there is a saved place to throw away. */
    startOverHref: string | null;
    endingsFound: number;
    endingsTotal: number;
    /** 0–1 when the chapter can be read from the scene id, else null. */
    fraction: number | null;
    progress: StoryProgress | null;
    /** "Chinese only" when the story has no text in the page's language and
     *  the reader will show the Chinese original, else null. */
    languageNote: string | null;
}

/** Fills `{name}` placeholders in a translation string. */
export function fill(
    template: string,
    values: Record<string, string | number>
): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        Object.hasOwn(values, key) ? String(values[key]) : match
    );
}

function hours(chars: number): number {
    return Math.max(1, Math.round(chars / ZH_CHARS_PER_MINUTE / 60));
}

/** Lengths come from the zh source in every locale. Sagas exist only in zh,
 *  and the English shorts were written to about the same reading time
 *  (1,900–2,200 words a path), so one figure serves both; showing a separate
 *  English length would need stats.ts to measure the en tree as well. */
export function lengthLabel(entry: StoryCatalogEntry, t: StoriesText): string {
    const { stats } = entry;
    if (entry.format === 'short') {
        return fill(t.minutes, {
            n: estimateReadingMinutes(stats.maxPathChars),
        });
    }
    const lo = hours(stats.minPathChars);
    const hi = hours(stats.maxPathChars);
    const duration =
        lo === hi
            ? fill(t.hours, { n: hi })
            : fill(t.hoursRange, { min: lo, max: hi });
    const size =
        stats.chapters > 0
            ? fill(t.chapters, { n: stats.chapters })
            : fill(t.endings, { n: stats.endings });
    return `${size} · ${duration}`;
}

/** Chapter number from a scene id such as `ch9_act3`, else null. */
export function chapterOf(sceneId: string): number | null {
    const match = /^ch(\d+)_/.exec(sceneId);
    return match ? Number(match[1]) : null;
}

export function readerHref(
    locale: string,
    storyId: string,
    position?: { sceneId: string; dialogueIndex: number }
): string {
    const params = new URLSearchParams({ story: storyId });
    if (position) {
        params.set('scene', position.sceneId);
        params.set('dialogue', String(position.dialogueIndex + 1));
    }
    return `/${locale}/reader?${params.toString()}`;
}

export function buildCard(
    entry: StoryCatalogEntry,
    progress: StoryProgress | null,
    locale: string,
    t: StoriesText
): StoryCardModel {
    const strings = t as unknown as Record<string, string>;
    const endingsTotal = entry.stats.endings;
    const endingsFound = Math.min(progress?.endings.length ?? 0, endingsTotal);
    const inProgress = !!progress && !progress.finished;
    const action: StoryAction = inProgress
        ? 'continue'
        : progress
          ? 'readAgain'
          : 'start';

    let status: string;
    let fraction: number | null = null;
    if (entry.format === 'short') {
        if (endingsFound >= endingsTotal && endingsTotal > 0) {
            status = t.allEndingsFound;
        } else if (endingsFound > 0) {
            status = fill(t.endingsFound, {
                found: endingsFound,
                total: endingsTotal,
            });
        } else {
            status = progress ? t.inProgress : t.new;
        }
    } else if (!progress) {
        status = t.notStarted;
    } else if (progress.finished) {
        // A branching saga is "finished" at any one ending, so say how many
        // of its endings have been found.
        status =
            endingsTotal > 1
                ? `${t.finished} · ${fill(t.endingsFound, {
                      found: endingsFound,
                      total: endingsTotal,
                  })}`
                : t.finished;
        fraction = 1;
    } else {
        const chapter = chapterOf(progress.sceneId);
        if (chapter !== null && entry.stats.chapters > 0) {
            status = fill(t.chapterOf, {
                n: chapter,
                total: entry.stats.chapters,
            });
            fraction = Math.min(1, (chapter - 1) / entry.stats.chapters);
        } else {
            status = t.inProgress;
        }
    }

    const actionLabel =
        action === 'continue'
            ? t.continue
            : action === 'readAgain'
              ? t.readAgain
              : t.start;

    return {
        entry,
        title: strings[entry.translationKey] ?? entry.translationKey,
        teaser: strings[`${entry.translationKey}Desc`] ?? '',
        genre: t.genres[entry.genre],
        length: lengthLabel(entry, t),
        status,
        action,
        actionLabel,
        href: inProgress
            ? readerHref(locale, entry.id, progress)
            : readerHref(locale, entry.id),
        startOverHref: inProgress ? readerHref(locale, entry.id) : null,
        endingsFound,
        endingsTotal,
        fraction,
        progress,
        languageNote: hasStoryText(entry.id, locale)
            ? null
            : t.originalLanguageOnly,
    };
}

/** The saga to offer under "Continue reading": the most recently read one
 *  that is not finished. Short stories never take this slot. */
export function pickContinueCard(
    cards: StoryCardModel[]
): StoryCardModel | null {
    let best: StoryCardModel | null = null;
    for (const card of cards) {
        if (card.entry.format !== 'saga' || card.action !== 'continue')
            continue;
        if (
            !best ||
            (card.progress?.updatedAt ?? 0) > (best.progress?.updatedAt ?? 0)
        ) {
            best = card;
        }
    }
    return best;
}

export function buildCards(
    catalog: readonly StoryCatalogEntry[],
    progress: StoryProgressMap,
    locale: string,
    t: StoriesText
): StoryCardModel[] {
    return catalog.map(entry =>
        buildCard(
            entry,
            Object.hasOwn(progress, entry.id) ? progress[entry.id] : null,
            locale,
            t
        )
    );
}
