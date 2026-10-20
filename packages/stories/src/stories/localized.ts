import type { Locale } from '../translations';
import {
    resolveStoryTextLocale,
    type RegisteredStoryId,
} from '../story-metadata';

/** Story content keyed by text locale; the zh source is always present. */
export type LocalizedContent<T> = Partial<Record<Locale, T>> & { zh: T };

/** Picks the content for a reader locale, falling back to the zh source when
 *  the story has no text in that locale (see STORY_TEXT_LOCALES). */
export function pickLocalized<T>(
    storyId: RegisteredStoryId,
    byLocale: LocalizedContent<T>,
    locale: string
): T {
    return byLocale[resolveStoryTextLocale(storyId, locale)] ?? byLocale.zh;
}
