import { describe, expect, it } from 'vitest';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
} from '../story-progress-store';

function memoryStorage(initial: Record<string, string> = {}): Storage {
    const data = new Map(Object.entries(initial));
    return {
        get length() {
            return data.size;
        },
        clear: () => data.clear(),
        getItem: key => data.get(key) ?? null,
        key: i => [...data.keys()][i] ?? null,
        removeItem: key => void data.delete(key),
        setItem: (key, value) => void data.set(key, String(value)),
    };
}

describe('StoryProgressStore', () => {
    it('keeps a separate place for each story', () => {
        const store = new StoryProgressStore(memoryStorage(), () => 1000);
        store.record({
            storyId: 'the_seventh_mirror',
            sceneId: 'ch9_act3',
            dialogueIndex: 12,
            atEnding: false,
        });
        store.record({
            storyId: 'elevator_game',
            sceneId: 'act1',
            dialogueIndex: 0,
            atEnding: false,
        });
        expect(store.get('the_seventh_mirror')).toEqual({
            sceneId: 'ch9_act3',
            dialogueIndex: 12,
            updatedAt: 1000,
            finished: false,
            endings: [],
        });
        expect(store.get('elevator_game')?.sceneId).toBe('act1');
    });

    it('collects each ending once and clears finished when reading again', () => {
        const store = new StoryProgressStore(memoryStorage());
        const at = (sceneId: string, atEnding: boolean) =>
            store.record({
                storyId: 'elevator_game',
                sceneId,
                dialogueIndex: 4,
                atEnding,
            });
        at('b1a_act4', true);
        at('b1a_act4', true);
        expect(store.get('elevator_game')).toMatchObject({
            finished: true,
            endings: ['b1a_act4'],
        });
        at('act1', false);
        expect(store.get('elevator_game')).toMatchObject({
            finished: false,
            endings: ['b1a_act4'],
        });
        at('b1b_act4', true);
        expect(store.get('elevator_game')?.endings).toEqual([
            'b1a_act4',
            'b1b_act4',
        ]);
    });

    it('drops malformed records and survives corrupt JSON', () => {
        const storage = memoryStorage({
            [STORY_PROGRESS_KEY]: JSON.stringify({
                good: {
                    sceneId: 'act1',
                    dialogueIndex: 0,
                    updatedAt: 1,
                    finished: false,
                    endings: [],
                },
                bad: { sceneId: 'act1', dialogueIndex: -1 },
            }),
        });
        expect(Object.keys(new StoryProgressStore(storage).getAll())).toEqual([
            'good',
        ]);
        storage.setItem(STORY_PROGRESS_KEY, '{not json');
        expect(new StoryProgressStore(storage).getAll()).toEqual({});
    });

    it('does not inherit Object.prototype names as stories', () => {
        const store = new StoryProgressStore(memoryStorage());
        expect(store.get('toString')).toBeNull();
    });

    it('reports failure without throwing when storage is unavailable', () => {
        expect(
            new StoryProgressStore(null).record({
                storyId: 's',
                sceneId: 'act1',
                dialogueIndex: 0,
                atEnding: false,
            })
        ).toBe(false);
        const throwing = memoryStorage();
        throwing.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        expect(
            new StoryProgressStore(throwing).record({
                storyId: 's',
                sceneId: 'act1',
                dialogueIndex: Number.NaN,
                atEnding: false,
            })
        ).toBe(false);
    });
});
