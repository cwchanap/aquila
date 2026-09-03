import type { DialogueEntry } from '@aquila/stories';
import { describe, expect, it } from 'vitest';
import { projectPortraitStage } from '../portrait-stage';

const portraitLine = (
    characterId: string,
    expression = 'base'
): DialogueEntry => ({
    characterId,
    dialogue: characterId,
    portrait: `${characterId}/${expression}`,
});

const spokenLine = (characterId: string): DialogueEntry => ({
    characterId,
    dialogue: characterId,
});

const narratorLine: DialogueEntry = {
    characterId: 'narrator',
    dialogue: 'Narration',
};

describe('projectPortraitStage', () => {
    it('opens the left slot for the first portrait', () => {
        expect(projectPortraitStage([portraitLine('a')], 0)).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: null,
            activeSlot: 'left',
        });
    });

    it('fills the right slot for a second character', () => {
        expect(
            projectPortraitStage([portraitLine('a'), portraitLine('b')], 1)
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'right',
        });
    });

    it('moves activeSlot back to a visible speaker without restaging', () => {
        expect(
            projectPortraitStage(
                [portraitLine('a'), portraitLine('b'), spokenLine('a')],
                2
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'left',
        });
    });

    it('evicts the least recently spoken character when the stage is full', () => {
        const abc = [portraitLine('a'), portraitLine('b'), portraitLine('c')];
        expect(projectPortraitStage(abc, 2)).toEqual({
            left: { characterId: 'c', portrait: 'c/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'left',
        });
        expect(projectPortraitStage([...abc, portraitLine('a')], 3)).toEqual({
            left: { characterId: 'c', portrait: 'c/base' },
            right: { characterId: 'a', portrait: 'a/base' },
            activeSlot: 'right',
        });
    });

    it('keeps the stage during narration and restages on the next portrait', () => {
        const narrated = [portraitLine('a'), portraitLine('b'), narratorLine];
        expect(projectPortraitStage(narrated, 2)).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: null,
        });
        expect(
            projectPortraitStage([...narrated, portraitLine('c')], 3)
        ).toEqual({
            left: { characterId: 'c', portrait: 'c/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: 'left',
        });
    });

    it('returns an empty stage for empty dialogue', () => {
        expect(projectPortraitStage([], 0)).toEqual({
            left: null,
            right: null,
            activeSlot: null,
        });
    });

    it('clears the active slot on system lines without a character', () => {
        const systemLine: DialogueEntry = { dialogue: 'System text' };
        expect(
            projectPortraitStage(
                [portraitLine('a'), portraitLine('b'), systemLine],
                2
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: { characterId: 'b', portrait: 'b/base' },
            activeSlot: null,
        });
    });

    it('replaces the portrait when a visible character changes expression', () => {
        expect(
            projectPortraitStage(
                [portraitLine('a'), portraitLine('a', 'happy')],
                1
            )
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/happy' },
            right: null,
            activeSlot: 'left',
        });
    });

    it('does not stage an unseen speaker without a portrait', () => {
        expect(
            projectPortraitStage([portraitLine('a'), spokenLine('x')], 1)
        ).toEqual({
            left: { characterId: 'a', portrait: 'a/base' },
            right: null,
            activeSlot: null,
        });
    });

    it('depends only on the dialogue prefix', () => {
        const mixed = [
            portraitLine('a'),
            narratorLine,
            portraitLine('b'),
            spokenLine('a'),
            portraitLine('c'),
            portraitLine('a', 'happy'),
            { dialogue: 'System text' },
            portraitLine('b', 'sad'),
        ];
        for (let index = 0; index < mixed.length; index += 1) {
            expect(projectPortraitStage(mixed, index)).toEqual(
                projectPortraitStage(mixed.slice(0, index + 1), index)
            );
        }
    });
});
