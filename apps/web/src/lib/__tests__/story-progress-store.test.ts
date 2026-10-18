import { describe, expect, it } from 'vitest';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
    importSavedSessions,
} from '../story-progress-store';

function session(
    storyId: string,
    sceneId: string,
    dialogueIndex: number,
    locale = 'en'
): string {
    return JSON.stringify({
        storyId,
        sceneId,
        dialogueIndex,
        locale,
        version: 2,
    });
}

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

    it('ignores a stored value that is not a map of stories', () => {
        for (const raw of ['[]', 'null', '42']) {
            const store = new StoryProgressStore(
                memoryStorage({ [STORY_PROGRESS_KEY]: raw })
            );
            expect(store.getAll()).toEqual({});
        }
    });

    it('carries over a place saved before per-story progress, once', () => {
        const storage = memoryStorage({
            'aquila:readerState:en': session(
                'the_seventh_mirror',
                'ch9_act3',
                4
            ),
            'aquila:readerState:zh': session(
                'train_adventure',
                'act2',
                7,
                'zh'
            ),
        });
        const store = new StoryProgressStore(storage, () => 50);
        importSavedSessions(store, storage, 'en');

        expect(store.getAll()).toEqual({
            the_seventh_mirror: {
                sceneId: 'ch9_act3',
                dialogueIndex: 4,
                updatedAt: 0,
                finished: false,
                endings: [],
            },
            train_adventure: {
                sceneId: 'act2',
                dialogueIndex: 7,
                updatedAt: 0,
                finished: false,
                endings: [],
            },
        });

        // Newer progress is never replaced by the old session.
        store.record({
            storyId: 'the_seventh_mirror',
            sceneId: 'ch10_act1',
            dialogueIndex: 0,
            atEnding: false,
        });
        importSavedSessions(store, storage, 'en');
        expect(store.get('the_seventh_mirror')?.sceneId).toBe('ch10_act1');
    });

    it('prefers the first locale and skips sessions it cannot trust', () => {
        const storage = memoryStorage({
            'aquila:readerState:zh': session(
                'the_seventh_mirror',
                'ch2_act1',
                1,
                'zh'
            ),
            'aquila:readerState:en': session(
                'the_seventh_mirror',
                'ch5_act1',
                3
            ),
        });
        const store = new StoryProgressStore(storage);
        importSavedSessions(store, storage, 'zh');
        expect(store.get('the_seventh_mirror')?.sceneId).toBe('ch2_act1');

        for (const raw of [
            '{not json',
            session('not_a_story', 'act1', 0),
            session('the_seventh_mirror', 'ch1_act1', -1),
            session('the_seventh_mirror', 'ch1_act1', 0, 'zh'),
        ]) {
            const other = memoryStorage({ 'aquila:readerState:en': raw });
            const fresh = new StoryProgressStore(other);
            importSavedSessions(fresh, other, 'en');
            expect(fresh.getAll()).toEqual({});
        }
        const empty = new StoryProgressStore(null);
        importSavedSessions(empty, null, 'en');
        expect(
            empty.seed({ storyId: 's', sceneId: 'act1', dialogueIndex: 0 })
        ).toBe(false);
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
