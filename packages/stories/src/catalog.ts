import type { RegisteredStoryId } from './story-metadata';
import type { StoryStats } from './story-stats';
import { trainAdventureStats } from './generated/trainAdventure/stats';
import { dontSaveMeBeforeMidnightStats } from './generated/dontSaveMeBeforeMidnight/stats';
import { theSeventhMirrorStats } from './generated/theSeventhMirror/stats';
import { elevatorGameStats } from './generated/elevatorGame/stats';
import { demonLordIsHiringStats } from './generated/demonLordIsHiring/stats';
import { threeAmLaundromatStats } from './generated/threeAmLaundromat/stats';
import { day4012Stats } from './generated/day4012/stats';
import { onePotBeforeDawnStats } from './generated/onePotBeforeDawn/stats';

export type { StoryStats } from './story-stats';
export { ZH_CHARS_PER_MINUTE, estimateReadingMinutes } from './story-stats';
export { hasStoryText } from './story-metadata';

/** Short stories are read in one sitting; sagas run across many chapters. */
export type StoryFormat = 'short' | 'saga';

/** Genre keys; display text lives under `stories.genres.<key>`. */
export type StoryGenre =
    'mystery' | 'fantasy' | 'horror' | 'romance' | 'scifi' | 'comedy' | 'wuxia';

/** Accent colour family used for a story's card. */
export type StoryAccent =
    | 'rose'
    | 'cyan'
    | 'indigo'
    | 'red'
    | 'pink'
    | 'violet'
    | 'amber'
    | 'emerald';

export interface StoryCatalogEntry {
    id: RegisteredStoryId;
    format: StoryFormat;
    genre: StoryGenre;
    accent: StoryAccent;
    /** Translation key prefix: `stories.<key>` is the title and
     *  `stories.<key>Desc` the one-line teaser. */
    translationKey: string;
    stats: StoryStats;
    /** Optional text-free cover: a path on the R2 asset host (`vn/covers/<id>.webp`). */
    coverImage?: string;
}

/** Every story in select-page order (the page groups them by format). */
export const STORY_CATALOG: readonly StoryCatalogEntry[] = [
    {
        id: 'elevator_game',
        coverImage: 'vn/covers/elevator_game.webp',
        format: 'short',
        genre: 'horror',
        accent: 'red',
        translationKey: 'elevatorGame',
        stats: elevatorGameStats,
    },
    {
        id: 'demon_lord_is_hiring',
        coverImage: 'vn/covers/demon_lord_is_hiring.webp',
        format: 'short',
        genre: 'comedy',
        accent: 'amber',
        translationKey: 'demonLordIsHiring',
        stats: demonLordIsHiringStats,
    },
    {
        id: 'three_am_laundromat',
        coverImage: 'vn/covers/three_am_laundromat.webp',
        format: 'short',
        genre: 'romance',
        accent: 'pink',
        translationKey: 'threeAmLaundromat',
        stats: threeAmLaundromatStats,
    },
    {
        id: 'day_4012',
        coverImage: 'vn/covers/day_4012.webp',
        format: 'short',
        genre: 'scifi',
        accent: 'violet',
        translationKey: 'day4012',
        stats: day4012Stats,
    },
    {
        id: 'one_pot_before_dawn',
        coverImage: 'vn/covers/one_pot_before_dawn.webp',
        format: 'short',
        genre: 'wuxia',
        accent: 'emerald',
        translationKey: 'onePotBeforeDawn',
        stats: onePotBeforeDawnStats,
    },
    {
        id: 'the_seventh_mirror',
        format: 'saga',
        genre: 'mystery',
        accent: 'rose',
        translationKey: 'theSeventhMirror',
        stats: theSeventhMirrorStats,
    },
    {
        id: 'train_adventure',
        format: 'saga',
        genre: 'fantasy',
        accent: 'cyan',
        translationKey: 'trainAdventure',
        stats: trainAdventureStats,
    },
    {
        id: 'dont_save_me_before_midnight',
        format: 'saga',
        genre: 'mystery',
        accent: 'indigo',
        translationKey: 'dontSaveMeBeforeMidnight',
        stats: dontSaveMeBeforeMidnightStats,
    },
];

export function getCatalogEntry(id: string): StoryCatalogEntry | undefined {
    return STORY_CATALOG.find(entry => entry.id === id);
}
