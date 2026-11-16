// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getTranslations } from '@aquila/stories/translations';
import { STORY_CATALOG } from '@aquila/stories/catalog';
import { buildCards } from '../story-select';
import type { StoryProgressMap } from '../story-progress-store';
import {
    lastReadLabel,
    startedStoryCards,
    summarizeProgress,
} from '../progress-summary';

const NOW = new Date('2024-01-01T12:00:00.000Z').getTime();

function cardsFor(progress: StoryProgressMap) {
    return buildCards(
        STORY_CATALOG,
        progress,
        'en',
        getTranslations('en').stories
    );
}

describe('summarizeProgress', () => {
    it('counts only catalog-bound cards and caps endings at catalog totals', () => {
        const cards = cardsFor({
            elevator_game: {
                sceneId: 's1',
                dialogueIndex: 3,
                updatedAt: 5_000,
                finished: false,
                endings: ['e1'],
            },
            train_adventure: {
                sceneId: 'ch4_act2',
                dialogueIndex: 0,
                updatedAt: 4_000,
                finished: false,
                endings: ['a', 'b'],
            },
            ghost_story: {
                sceneId: 'x',
                dialogueIndex: 0,
                updatedAt: 9_999,
                finished: true,
                endings: ['a', 'b', 'c', 'd'],
            },
        });

        const summary = summarizeProgress(cards);
        expect(summary).toEqual({
            total: STORY_CATALOG.length,
            started: 2,
            finished: 2,
            endingsFound: 3,
            endingsTotal: STORY_CATALOG.reduce(
                (n, e) => n + e.stats.endings,
                0
            ),
        });
    });

    it('counts a story as finished whenever any ending is found, even mid re-read', () => {
        const cards = cardsFor({
            elevator_game: {
                sceneId: 's1',
                dialogueIndex: 1,
                updatedAt: 1_000,
                finished: false,
                endings: ['e1'],
            },
            demon_lord_is_hiring: {
                sceneId: 's2',
                dialogueIndex: 0,
                updatedAt: 2_000,
                finished: true,
                endings: [],
            },
        });

        const summary = summarizeProgress(cards);
        expect(summary.finished).toBe(1);
        expect(summary.started).toBe(2);
    });

    it('reports zeroes for an empty progress map', () => {
        const summary = summarizeProgress(cardsFor({}));
        expect(summary.started).toBe(0);
        expect(summary.finished).toBe(0);
        expect(summary.endingsFound).toBe(0);
        expect(summary.total).toBe(STORY_CATALOG.length);
    });
});

describe('startedStoryCards', () => {
    it('sorts by updatedAt descending and keeps catalog order on ties', () => {
        const cards = cardsFor({
            elevator_game: {
                sceneId: 's1',
                dialogueIndex: 3,
                updatedAt: 5_000,
                finished: false,
                endings: ['e1'],
            },
            the_seventh_mirror: {
                sceneId: 'ch2_act1',
                dialogueIndex: 0,
                updatedAt: 4_000,
                finished: false,
                endings: [],
            },
            train_adventure: {
                sceneId: 'ch9_act3',
                dialogueIndex: 0,
                updatedAt: 4_000,
                finished: false,
                endings: [],
            },
        });

        const ids = startedStoryCards(cards).map(card => card.entry.id);
        // the_seventh_mirror precedes train_adventure in the catalog, so it
        // wins the updatedAt tie.
        expect(ids).toEqual([
            'elevator_game',
            'the_seventh_mirror',
            'train_adventure',
        ]);
    });

    it('drops cards with no progress and ignores unknown story ids', () => {
        const cards = cardsFor({
            day_4012: {
                sceneId: 's1',
                dialogueIndex: 0,
                updatedAt: 100,
                finished: false,
                endings: [],
            },
            ghost_story: {
                sceneId: 'x',
                dialogueIndex: 0,
                updatedAt: 999,
                finished: true,
                endings: ['a'],
            },
        });

        const started = startedStoryCards(cards);
        expect(started).toHaveLength(1);
        expect(started[0].entry.id).toBe('day_4012');
    });
});

describe('lastReadLabel', () => {
    it('omits the label for seeded or imported records stamped at epoch', () => {
        expect(lastReadLabel(0, 'en', NOW)).toBeNull();
    });

    it('formats hours, days and yesterday with Intl.RelativeTimeFormat', () => {
        expect(lastReadLabel(NOW - 60 * 60 * 1000, 'en', NOW)).toBe(
            '1 hour ago'
        );
        expect(lastReadLabel(NOW - 3 * 24 * 60 * 60 * 1000, 'en', NOW)).toBe(
            '3 days ago'
        );
        expect(lastReadLabel(NOW - 24 * 60 * 60 * 1000, 'en', NOW)).toBe(
            'yesterday'
        );
    });

    it('localizes relative time for zh and ja', () => {
        expect(lastReadLabel(NOW - 60 * 60 * 1000, 'zh', NOW)).toBe('1 小時前');
        expect(lastReadLabel(NOW - 3 * 24 * 60 * 60 * 1000, 'ja', NOW)).toBe(
            '3 日前'
        );
    });
});
