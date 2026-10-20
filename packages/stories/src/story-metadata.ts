import { SUPPORTED_LOCALES, type Locale } from './translations';

export const REGISTERED_STORY_IDS = [
    'train_adventure',
    'dont_save_me_before_midnight',
    'the_seventh_mirror',
    'elevator_game',
    'demon_lord_is_hiring',
    'three_am_laundromat',
    'day_4012',
    'one_pot_before_dawn',
] as const;

export type RegisteredStoryId = (typeof REGISTERED_STORY_IDS)[number];

/** Stories whose acts name backgrounds and portraits but have no published
 *  visual release yet. The reader opens them in text mode whatever mode the
 *  reader last chose, until their artwork ships. */
export const TEXT_ONLY_STORY_IDS: readonly RegisteredStoryId[] = [
    'elevator_game',
    'demon_lord_is_hiring',
    'three_am_laundromat',
    'day_4012',
    'one_pot_before_dawn',
];

/** The source language every story is written in. */
export const SOURCE_LOCALE: Locale = 'zh';

/** Languages each story's text exists in. Translations are mirror trees
 *  (`raw/<story>/<locale>/`) that line up entry for entry with the zh source;
 *  a story read in a language it lacks shows the zh source instead. */
export const STORY_TEXT_LOCALES: Record<RegisteredStoryId, readonly Locale[]> =
    {
        train_adventure: ['zh'],
        dont_save_me_before_midnight: ['zh'],
        the_seventh_mirror: ['zh'],
        elevator_game: ['zh', 'en', 'ja'],
        demon_lord_is_hiring: ['zh', 'en', 'ja'],
        three_am_laundromat: ['zh', 'en', 'ja'],
        day_4012: ['zh', 'en', 'ja'],
        one_pot_before_dawn: ['zh', 'en', 'ja'],
    };

export function hasStoryText(storyId: string, locale: string): boolean {
    return isRegisteredStoryId(storyId)
        ? (STORY_TEXT_LOCALES[storyId] as readonly string[]).includes(locale)
        : false;
}

/** The language a story's text is actually shown in for a reader locale:
 *  that locale when the story has it, otherwise the zh source. A locale the
 *  site does not support at all gets English where the story has it, as the
 *  synchronous loaders always did. */
export function resolveStoryTextLocale(
    storyId: RegisteredStoryId,
    locale: string
): Locale {
    const available = STORY_TEXT_LOCALES[storyId];
    const normalized = normalizeStoryLocale(locale);
    if (!normalized) {
        return available.includes('en') ? 'en' : SOURCE_LOCALE;
    }
    return available.includes(normalized) ? normalized : SOURCE_LOCALE;
}

export const supportsVisualMode = (storyId: string): boolean =>
    !(TEXT_ONLY_STORY_IDS as readonly string[]).includes(storyId);

export type StoryLocaleInput = string;

export const isRegisteredStoryId = (
    value: string
): value is RegisteredStoryId =>
    (REGISTERED_STORY_IDS as readonly string[]).includes(value);

export function normalizeStoryLocale(value: StoryLocaleInput): Locale | null {
    const normalized = value.toLowerCase();

    return (
        SUPPORTED_LOCALES.find(
            locale =>
                normalized === locale || normalized.startsWith(`${locale}-`)
        ) ?? null
    );
}
