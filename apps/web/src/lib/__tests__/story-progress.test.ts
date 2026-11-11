import { describe, expect, it } from 'vitest';
import {
    mergeStoryProgressMaps,
    normalizeStoryProgressMap,
    type StoryProgress,
    type StoryProgressMap,
} from '../story-progress';

function progress(over: Partial<StoryProgress> = {}): StoryProgress {
    return {
        sceneId: 'act1',
        dialogueIndex: 0,
        updatedAt: 1,
        finished: false,
        endings: [],
        ...over,
    };
}

function map(
    entries: Record<string, Partial<StoryProgress>>
): StoryProgressMap {
    return Object.fromEntries(
        Object.entries(entries).map(([id, over]) => [id, progress(over)])
    );
}

describe('normalizeStoryProgressMap', () => {
    it('keeps every valid record of a map', () => {
        const valid = map({
            elevator_game: { sceneId: 'act3', dialogueIndex: 4, updatedAt: 9 },
            train_adventure: {
                sceneId: 'act2',
                dialogueIndex: 7,
                updatedAt: 0,
                finished: true,
                endings: ['act2'],
                visited: ['act1', 'act2'],
            },
        });
        expect(normalizeStoryProgressMap(valid)).toEqual(valid);
    });

    it('returns an empty map for values that are not story maps', () => {
        for (const value of [null, undefined, [], 'progress', 42, true]) {
            expect(normalizeStoryProgressMap(value)).toEqual({});
        }
    });

    it('drops invalid records but keeps valid siblings', () => {
        const normalized = normalizeStoryProgressMap({
            good: progress({ updatedAt: 3 }),
            negativeIndex: { ...progress(), dialogueIndex: -1 },
            infiniteIndex: { ...progress(), dialogueIndex: Number.NaN },
            stringDate: { ...progress(), updatedAt: '3' },
            missingEndings: {
                sceneId: 'act1',
                dialogueIndex: 0,
                updatedAt: 1,
                finished: false,
            },
            badEndings: { ...progress(), endings: ['act1', 7] },
            notAnObject: 'act1',
            alsoNotAnObject: null,
        });
        expect(Object.keys(normalized)).toEqual(['good']);
    });

    it('keeps a record whose visited alone is malformed', () => {
        for (const visited of [42, 'act1', ['act1', 7], {}]) {
            const normalized = normalizeStoryProgressMap({
                elevator_game: { ...progress(), visited },
            });
            expect(normalized.elevator_game).toEqual(progress());
            expect('visited' in normalized.elevator_game).toBe(false);
        }
    });

    it('keeps a valid visited list', () => {
        const normalized = normalizeStoryProgressMap({
            elevator_game: progress({ visited: ['act1', 'act2'] }),
        });
        expect(normalized.elevator_game.visited).toEqual(['act1', 'act2']);
    });

    it('keeps a record imported from a legacy session at updatedAt 0', () => {
        const normalized = normalizeStoryProgressMap({
            the_seventh_mirror: { ...progress(), updatedAt: 0 },
        });
        expect(normalized.the_seventh_mirror.updatedAt).toBe(0);
    });

    it('keeps an untrusted __proto__ key as data without touching prototypes', () => {
        const parsed: unknown = JSON.parse(
            JSON.stringify(
                Object.fromEntries([
                    ['__proto__', progress()],
                    ['real', progress()],
                ])
            )
        );
        const normalized = normalizeStoryProgressMap(parsed);
        expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype);
        expect(Object.getPrototypeOf({})).toBe(Object.prototype);
        expect(normalized.real).toEqual(progress());
        expect(Object.hasOwn(normalized, '__proto__')).toBe(true);
    });
});

describe('mergeStoryProgressMaps', () => {
    it('returns an empty map when both sides are empty', () => {
        expect(mergeStoryProgressMaps({}, {})).toEqual({});
    });

    it('keeps stories only one side has', () => {
        const local = map({ elevator_game: { sceneId: 'act2' } });
        const stored = map({
            train_adventure: { sceneId: 'act3', updatedAt: 5 },
        });
        expect(mergeStoryProgressMaps(local, {})).toEqual(local);
        expect(mergeStoryProgressMaps({}, stored)).toEqual(stored);
        expect(mergeStoryProgressMaps(local, stored)).toEqual({
            ...local,
            ...stored,
        });
    });

    it('takes the newer local position', () => {
        const local = map({
            elevator_game: {
                sceneId: 'act5',
                dialogueIndex: 8,
                updatedAt: 20,
                finished: true,
            },
        });
        const stored = map({
            elevator_game: { sceneId: 'act2', updatedAt: 10 },
        });
        expect(
            mergeStoryProgressMaps(local, stored).elevator_game
        ).toMatchObject({
            sceneId: 'act5',
            dialogueIndex: 8,
            updatedAt: 20,
            finished: true,
        });
    });

    it('takes the stored position on a tie', () => {
        const local = map({
            elevator_game: {
                sceneId: 'act2',
                dialogueIndex: 3,
                updatedAt: 20,
                finished: true,
            },
        });
        const stored = map({
            elevator_game: {
                sceneId: 'act3',
                dialogueIndex: 1,
                updatedAt: 20,
                finished: false,
            },
        });
        expect(
            mergeStoryProgressMaps(local, stored).elevator_game
        ).toMatchObject({
            sceneId: 'act3',
            dialogueIndex: 1,
            updatedAt: 20,
            finished: false,
        });
    });

    it('keeps the local position when the stored one is stale', () => {
        const local = map({
            elevator_game: { sceneId: 'act4', updatedAt: 30, finished: true },
        });
        const stored = map({
            elevator_game: { sceneId: 'act2', updatedAt: 10 },
        });
        expect(
            mergeStoryProgressMaps(local, stored).elevator_game
        ).toMatchObject({
            sceneId: 'act4',
            updatedAt: 30,
            finished: true,
        });
    });

    it('lets a newer but earlier position win while discoveries union', () => {
        const local = map({
            elevator_game: {
                sceneId: 'ch1_act1',
                dialogueIndex: 2,
                updatedAt: 5000,
                finished: false,
                endings: ['ending_b'],
                visited: ['ch1_act1'],
            },
        });
        const stored = map({
            elevator_game: {
                sceneId: 'ch9_act3',
                dialogueIndex: 40,
                updatedAt: 1000,
                finished: true,
                endings: ['ending_a'],
                visited: ['ch9_act3', 'ch1_act1'],
            },
        });
        expect(mergeStoryProgressMaps(local, stored).elevator_game).toEqual({
            sceneId: 'ch1_act1',
            dialogueIndex: 2,
            updatedAt: 5000,
            finished: false,
            endings: ['ending_b', 'ending_a'],
            visited: ['ch1_act1', 'ch9_act3'],
        });
    });

    it('unions endings selected-first without duplicates', () => {
        const local = map({
            elevator_game: { updatedAt: 20, endings: ['b', 'a'] },
        });
        const stored = map({
            elevator_game: { updatedAt: 20, endings: ['a', 'c'] },
        });
        expect(
            mergeStoryProgressMaps(local, stored).elevator_game.endings
        ).toEqual(['a', 'c', 'b']);
    });

    it('keeps visited optional when neither side has it', () => {
        const merged = mergeStoryProgressMaps(
            map({ elevator_game: { updatedAt: 2 } }),
            map({ elevator_game: { updatedAt: 1 } })
        );
        expect('visited' in merged.elevator_game).toBe(false);
    });

    it('unions visited when only the stored legacy side has it', () => {
        const local = map({ elevator_game: { visited: undefined } });
        const stored = map({
            elevator_game: { visited: ['act1', 'act2'] },
        });
        expect(
            mergeStoryProgressMaps(local, stored).elevator_game.visited
        ).toEqual(['act1', 'act2']);
    });

    it('is idempotent when merged again with either side', () => {
        const local = map({
            elevator_game: {
                updatedAt: 20,
                endings: ['b', 'a'],
                visited: ['ch1_act1'],
            },
        });
        const stored = map({
            elevator_game: {
                updatedAt: 10,
                endings: ['a', 'c'],
                visited: ['ch2_act1'],
            },
        });
        const once = mergeStoryProgressMaps(local, stored);
        expect(mergeStoryProgressMaps(once, stored)).toEqual(once);
        expect(mergeStoryProgressMaps(local, once)).toEqual(once);
        expect(mergeStoryProgressMaps(once, once)).toEqual(once);
    });

    it('does not mutate its inputs', () => {
        const local = map({
            elevator_game: {
                sceneId: 'act4',
                updatedAt: 20,
                endings: ['b'],
                visited: ['act1'],
            },
        });
        const stored = map({
            elevator_game: {
                sceneId: 'act2',
                updatedAt: 10,
                endings: ['a'],
                visited: ['act2'],
            },
        });
        const before = JSON.stringify({ local, stored });
        mergeStoryProgressMaps(local, stored);
        expect(JSON.stringify({ local, stored })).toBe(before);
    });

    it('handles an untrusted __proto__ key without touching prototypes', () => {
        const local = Object.fromEntries([
            ['__proto__', progress()],
            ['real', progress({ updatedAt: 2 })],
        ]);
        const merged = mergeStoryProgressMaps(local, {});
        expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
        expect(merged.real.updatedAt).toBe(2);
        expect(Object.hasOwn(merged, '__proto__')).toBe(true);
    });
});
