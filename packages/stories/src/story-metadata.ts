import type { Locale } from './translations';

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

export type StoryLocaleInput = string;

export const isRegisteredStoryId = (
    value: string
): value is RegisteredStoryId =>
    (REGISTERED_STORY_IDS as readonly string[]).includes(value);

export function normalizeStoryLocale(value: StoryLocaleInput): Locale | null {
    const normalized = value.toLowerCase();

    if (normalized === 'zh' || normalized.startsWith('zh-')) {
        return 'zh';
    }

    if (normalized === 'en' || normalized.startsWith('en-')) {
        return 'en';
    }

    return null;
}
