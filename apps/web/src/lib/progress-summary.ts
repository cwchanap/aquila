import type { Locale } from '@aquila/stories';
import { localeLangTag } from '@aquila/stories/translations';
import type { StoryCardModel } from './story-select';

export interface ProgressSummary {
    /** Stories in the catalog — the denominator for "started". */
    total: number;
    /** Cards with a saved place (progress is non-null). */
    started: number;
    /** Cards with at least one ending found — stays counted on a re-read. */
    finished: number;
    /** Sum of capped per-story endingsFound. */
    endingsFound: number;
    /** Sum of catalog endings — the denominator for "endings found". */
    endingsTotal: number;
}

export function summarizeProgress(cards: StoryCardModel[]): ProgressSummary {
    let started = 0;
    let finished = 0;
    let endingsFound = 0;
    let endingsTotal = 0;
    for (const card of cards) {
        if (card.progress) started += 1;
        if (card.endingsFound > 0) finished += 1;
        endingsFound += card.endingsFound;
        endingsTotal += card.endingsTotal;
    }
    return {
        total: cards.length,
        started,
        finished,
        endingsFound,
        endingsTotal,
    };
}

/** Started stories, most recently read first; a tie keeps catalog order
 *  (Array.prototype.sort is stable). */
export function startedStoryCards(cards: StoryCardModel[]): StoryCardModel[] {
    return cards
        .filter(card => card.progress !== null)
        .sort(
            (a, b) =>
                (b.progress?.updatedAt ?? 0) - (a.progress?.updatedAt ?? 0)
        );
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['week', 7 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
    ['second', 1000],
];

/** "1 hour ago" in the page language, or null for `updatedAt === 0`
 *  seeded/imported records that have no real read time. */
export function lastReadLabel(
    updatedAt: number,
    locale: Locale,
    now: number = Date.now()
): string | null {
    if (!(updatedAt > 0)) return null;
    const formatter = new Intl.RelativeTimeFormat(localeLangTag(locale), {
        numeric: 'auto',
    });
    const delta = updatedAt - now;
    for (const [unit, ms] of RELATIVE_UNITS) {
        const value = delta / ms;
        if (Math.abs(value) >= 1) {
            return formatter.format(Math.round(value), unit);
        }
    }
    return formatter.format(Math.round(delta / 1000), 'second');
}
