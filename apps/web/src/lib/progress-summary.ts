import type { Locale } from '@aquila/stories';
import { localeLangTag } from '@aquila/stories/translations';
import type { StoryCardModel } from './story-select';

export interface ProgressSummary {
    /** Stories in the catalog — the denominator for "started". */
    total: number;
    /** Cards with a saved place (progress is non-null). */
    started: number;
    /** Cards with at least one ending found or marked finished. */
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
        if (card.endingsFound > 0 || card.progress?.finished) finished += 1;
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

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

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
    // Clamp future timestamps (e.g. another device's clock ahead) so the
    // label never reads "in N minutes", and promote rounded values at unit
    // boundaries so 23.6h reads "yesterday" rather than "24 hours ago".
    const elapsed = Math.max(0, now - updatedAt);
    const seconds = Math.round(elapsed / SECOND);
    if (seconds < 60) return formatter.format(-seconds, 'second');
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return formatter.format(-minutes, 'minute');
    const hours = Math.round(elapsed / HOUR);
    if (hours < 24) return formatter.format(-hours, 'hour');
    const days = Math.round(elapsed / DAY);
    if (days < 7) return formatter.format(-days, 'day');
    if (days < 30) return formatter.format(-Math.round(elapsed / WEEK), 'week');
    const months = Math.round(elapsed / MONTH);
    if (months < 12) return formatter.format(-months, 'month');
    return formatter.format(-Math.max(1, Math.round(elapsed / YEAR)), 'year');
}
