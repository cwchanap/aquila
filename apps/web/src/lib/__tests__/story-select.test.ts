import { describe, expect, it } from 'vitest';
import { getTranslations } from '@aquila/stories/translations';
import type { StoryCatalogEntry } from '@aquila/stories/catalog';
import type { StoryProgress } from '../story-progress-store';
import {
    buildCard,
    buildCards,
    chapterOf,
    fill,
    lengthLabel,
    pickContinueCard,
    readerHref,
} from '../story-select';

const en = getTranslations('en').stories;
const zh = getTranslations('zh').stories;

const saga: StoryCatalogEntry = {
    id: 'the_seventh_mirror',
    format: 'saga',
    genre: 'mystery',
    accent: 'rose',
    translationKey: 'theSeventhMirror',
    stats: {
        scenes: 215,
        chapters: 28,
        endings: 1,
        minPathChars: 567_413,
        maxPathChars: 567_413,
    },
};

const branchingSaga: StoryCatalogEntry = {
    ...saga,
    id: 'train_adventure',
    genre: 'fantasy',
    translationKey: 'trainAdventure',
    stats: {
        scenes: 495,
        chapters: 0,
        endings: 30,
        minPathChars: 34_803,
        maxPathChars: 209_736,
    },
};

const short: StoryCatalogEntry = {
    ...saga,
    id: 'dont_save_me_before_midnight',
    format: 'short',
    stats: {
        scenes: 5,
        chapters: 0,
        endings: 2,
        minPathChars: 2990,
        maxPathChars: 3259,
    },
};

function progress(over: Partial<StoryProgress> = {}): StoryProgress {
    return {
        sceneId: 'ch9_act3',
        dialogueIndex: 4,
        updatedAt: 10,
        finished: false,
        endings: [],
        ...over,
    };
}

describe('fill', () => {
    it('replaces known placeholders and leaves unknown ones', () => {
        expect(fill('{n} of {total} {x}', { n: 1, total: 2 })).toBe(
            '1 of 2 {x}'
        );
    });
});

describe('lengthLabel', () => {
    it('shows minutes for a short story, from its longest path', () => {
        expect(lengthLabel(short, en)).toBe('8 min');
        expect(lengthLabel(short, zh)).toBe('8 分鐘');
    });

    it('shows chapters and hours for a chaptered saga', () => {
        expect(lengthLabel(saga, en)).toBe('28 chapters · ~24 h');
    });

    it('shows endings and an hour range for a branching saga', () => {
        expect(lengthLabel(branchingSaga, en)).toBe('30 endings · 1–9 h');
    });
});

describe('chapterOf / readerHref', () => {
    it('reads the chapter from chaptered scene ids only', () => {
        expect(chapterOf('ch12_act3')).toBe(12);
        expect(chapterOf('b1a_act4')).toBeNull();
    });

    it('links to the beginning or to a saved line (1-based)', () => {
        expect(readerHref('en', 'elevator_game')).toBe(
            '/en/reader?story=elevator_game'
        );
        expect(
            readerHref('zh', 'elevator_game', {
                sceneId: 'act2',
                dialogueIndex: 0,
            })
        ).toBe('/zh/reader?story=elevator_game&scene=act2&dialogue=1');
    });
});

describe('buildCard', () => {
    it('starts an unread story from the beginning', () => {
        const card = buildCard(saga, null, 'en', en);
        expect(card.action).toBe('start');
        expect(card.actionLabel).toBe('Start reading');
        expect(card.status).toBe('Not started');
        expect(card.href).toBe('/en/reader?story=the_seventh_mirror');
        expect(card.startOverHref).toBeNull();
        expect(card.title).toBe('The Seventh Mirror');
    });

    it('continues a saga in progress and offers a separate start over', () => {
        const card = buildCard(saga, progress(), 'en', en);
        expect(card.action).toBe('continue');
        expect(card.status).toBe('Chapter 9 of 28');
        expect(card.fraction).toBeCloseTo(8 / 28);
        expect(card.href).toBe(
            '/en/reader?story=the_seventh_mirror&scene=ch9_act3&dialogue=5'
        );
        expect(card.startOverHref).toBe('/en/reader?story=the_seventh_mirror');
    });

    it('offers a finished story again from the top', () => {
        const card = buildCard(
            saga,
            progress({ finished: true, endings: ['ch28_act9'] }),
            'en',
            en
        );
        expect(card.action).toBe('readAgain');
        expect(card.status).toBe('Finished');
        expect(card.href).toBe('/en/reader?story=the_seventh_mirror');
    });

    it('counts endings found on a short story', () => {
        expect(buildCard(short, null, 'en', en).status).toBe('New');
        const one = buildCard(
            short,
            progress({
                sceneId: 'b1a_act4',
                finished: true,
                endings: ['b1a_act4'],
            }),
            'en',
            en
        );
        expect(one.status).toBe('1 of 2 endings');
        expect(one.endingsFound).toBe(1);
        const all = buildCard(
            short,
            progress({ finished: true, endings: ['b1a_act4', 'b1b_act4'] }),
            'en',
            en
        );
        expect(all.status).toBe('All endings found');
    });
});

describe('pickContinueCard', () => {
    it('picks the most recently read unfinished saga, never a short story', () => {
        const cards = buildCards(
            [saga, branchingSaga, short],
            {
                the_seventh_mirror: progress({ updatedAt: 5 }),
                train_adventure: progress({ sceneId: 'act2', updatedAt: 9 }),
                dont_save_me_before_midnight: progress({
                    sceneId: 'act1',
                    updatedAt: 99,
                }),
            },
            'en',
            en
        );
        expect(pickContinueCard(cards)?.entry.id).toBe('train_adventure');
    });

    it('returns null when nothing is in progress', () => {
        expect(pickContinueCard(buildCards([saga], {}, 'en', en))).toBeNull();
    });
});
