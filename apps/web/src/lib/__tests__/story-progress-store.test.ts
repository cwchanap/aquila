import { describe, expect, it } from 'vitest';
import {
    mergeStoryProgressMaps,
    type StoryProgressMap,
} from '../story-progress';
import {
    STORY_PROGRESS_KEY,
    StoryProgressStore,
    importSavedSessions,
    storyProgressKey,
} from '../story-progress-store';
import { readerSessionKey } from '../reader-session';

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
            visited: ['ch9_act3'],
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

    it('tracks each visited scene once, per story', () => {
        const store = new StoryProgressStore(memoryStorage());
        const at = (storyId: string, sceneId: string) =>
            store.record({
                storyId,
                sceneId,
                dialogueIndex: 0,
                atEnding: false,
            });
        at('elevator_game', 'act1');
        at('elevator_game', 'act2');
        at('elevator_game', 'act2');
        at('elevator_game', 'act3');
        at('train_adventure', 'act1');
        expect(store.get('elevator_game')?.visited).toEqual([
            'act1',
            'act2',
            'act3',
        ]);
        expect(store.get('train_adventure')?.visited).toEqual(['act1']);
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

    it('drops a malformed visited list but keeps the rest of the record', () => {
        for (const visited of [42, 'act1', ['act1', 7], {}]) {
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: JSON.stringify({
                    elevator_game: {
                        sceneId: 'act3',
                        dialogueIndex: 4,
                        updatedAt: 9,
                        finished: true,
                        endings: ['act3'],
                        visited,
                    },
                }),
            });
            const record = new StoryProgressStore(storage).get('elevator_game');
            expect(record).toEqual({
                sceneId: 'act3',
                dialogueIndex: 4,
                updatedAt: 9,
                finished: true,
                endings: ['act3'],
            });
        }
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
        importSavedSessions(store, storage, 'en', null);

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
        importSavedSessions(store, storage, 'en', null);
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
        importSavedSessions(store, storage, 'zh', null);
        expect(store.get('the_seventh_mirror')?.sceneId).toBe('ch2_act1');

        for (const raw of [
            '{not json',
            session('not_a_story', 'act1', 0),
            session('the_seventh_mirror', 'ch1_act1', -1),
            session('the_seventh_mirror', 'ch1_act1', 0, 'zh'),
        ]) {
            const other = memoryStorage({ 'aquila:readerState:en': raw });
            const fresh = new StoryProgressStore(other);
            importSavedSessions(fresh, other, 'en', null);
            expect(fresh.getAll()).toEqual({});
        }
        const empty = new StoryProgressStore(null);
        importSavedSessions(empty, null, 'en', null);
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

    it('commits a map merged against the freshest stored copy', () => {
        const storage = memoryStorage();
        const store = new StoryProgressStore(storage);
        const merged: StoryProgressMap = {
            elevator_game: {
                sceneId: 'act3',
                dialogueIndex: 4,
                updatedAt: 9,
                finished: true,
                endings: ['act3'],
                visited: ['act1', 'act3'],
            },
        };
        expect(store.update(() => merged)).toBe(true);
        // Stored value is a flat StoryProgressMap (rollback-compatible).
        expect(
            JSON.parse(storage.getItem(STORY_PROGRESS_KEY) as string)
        ).toEqual(merged);
        expect(store.getAll()).toEqual(merged);
    });

    it('merges into what another write left after the caller last read', () => {
        const storage = memoryStorage();
        const store = new StoryProgressStore(storage);
        // A line recorded after the pre-request snapshot must survive the
        // merge commit.
        storage.setItem(
            STORY_PROGRESS_KEY,
            JSON.stringify({
                elevator_game: {
                    sceneId: 'act2',
                    dialogueIndex: 3,
                    updatedAt: 40,
                    finished: false,
                    endings: [],
                },
            })
        );
        expect(
            store.update(current =>
                mergeStoryProgressMaps(current, {
                    elevator_game: {
                        sceneId: 'act1',
                        dialogueIndex: 0,
                        updatedAt: 9,
                        finished: false,
                        endings: [],
                    },
                })
            )
        ).toBe(true);
        expect(store.get('elevator_game')).toMatchObject({
            sceneId: 'act2',
            updatedAt: 40,
        });
    });

    it('reports a failed commit without throwing', () => {
        const merged: StoryProgressMap = {
            elevator_game: {
                sceneId: 'act1',
                dialogueIndex: 0,
                updatedAt: 1,
                finished: false,
                endings: [],
            },
        };
        expect(new StoryProgressStore(null).update(() => merged)).toBe(false);
        const unreadable = memoryStorage();
        unreadable.getItem = () => {
            throw new Error('SecurityError');
        };
        expect(new StoryProgressStore(unreadable).update(() => merged)).toBe(
            false
        );
        const throwing = memoryStorage();
        throwing.setItem = () => {
            throw new Error('QuotaExceededError');
        };
        expect(new StoryProgressStore(throwing).update(() => merged)).toBe(
            false
        );
    });

    describe('getAllChecked', () => {
        it('returns the stored map, and an empty map when nothing is stored', () => {
            const stored = {
                elevator_game: {
                    sceneId: 'act1',
                    dialogueIndex: 2,
                    updatedAt: 5,
                    finished: false,
                    endings: [],
                },
            };
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: JSON.stringify(stored),
            });
            expect(new StoryProgressStore(storage).getAllChecked()).toEqual(
                stored
            );
            expect(
                new StoryProgressStore(memoryStorage()).getAllChecked()
            ).toEqual({});
        });

        it('returns null when storage cannot be read, unlike getAll', () => {
            expect(new StoryProgressStore(null).getAllChecked()).toBeNull();

            const throwing = memoryStorage();
            throwing.getItem = () => {
                throw new Error('SecurityError');
            };
            expect(new StoryProgressStore(throwing).getAllChecked()).toBeNull();
            expect(new StoryProgressStore(throwing).getAll()).toEqual({});

            const corrupt = memoryStorage({
                [STORY_PROGRESS_KEY]: '{not json',
            });
            expect(new StoryProgressStore(corrupt).getAllChecked()).toBeNull();
            expect(new StoryProgressStore(corrupt).getAll()).toEqual({});
        });
    });

    it('keeps a legacy-imported place when the account has none for it', () => {
        const storage = memoryStorage({
            'aquila:readerState:en': session(
                'the_seventh_mirror',
                'ch9_act3',
                4
            ),
        });
        const store = new StoryProgressStore(storage, () => 50);
        importSavedSessions(store, storage, 'en', null);
        const remote: StoryProgressMap = {
            elevator_game: {
                sceneId: 'act1',
                dialogueIndex: 0,
                updatedAt: 900,
                finished: false,
                endings: [],
            },
        };
        expect(
            store.update(current => mergeStoryProgressMaps(current, remote))
        ).toBe(true);
        expect(store.get('the_seventh_mirror')).toMatchObject({
            sceneId: 'ch9_act3',
            dialogueIndex: 4,
            updatedAt: 0,
        });
        expect(store.get('elevator_game')?.updatedAt).toBe(900);
    });

    describe('per-owner key isolation', () => {
        it('stores anonymous and signed-in progress under distinct flat keys', () => {
            expect(storyProgressKey(null)).toBe(STORY_PROGRESS_KEY);
            expect(storyProgressKey('')).toBe(STORY_PROGRESS_KEY);
            expect(storyProgressKey('user-a')).toBe(
                `${STORY_PROGRESS_KEY}:user-a`
            );

            const storage = memoryStorage();
            const anon = new StoryProgressStore(storage, () => 10, null);
            const userA = new StoryProgressStore(storage, () => 20, 'user-a');
            const userB = new StoryProgressStore(storage, () => 30, 'user-b');

            anon.record({
                storyId: 'elevator_game',
                sceneId: 'act1',
                dialogueIndex: 1,
                atEnding: false,
            });
            userA.record({
                storyId: 'the_seventh_mirror',
                sceneId: 'ch2_act1',
                dialogueIndex: 4,
                atEnding: false,
            });
            userB.record({
                storyId: 'train_adventure',
                sceneId: 'act2',
                dialogueIndex: 0,
                atEnding: true,
            });

            expect(anon.get('elevator_game')?.sceneId).toBe('act1');
            expect(anon.get('the_seventh_mirror')).toBeNull();
            expect(userA.get('the_seventh_mirror')?.sceneId).toBe('ch2_act1');
            expect(userA.get('elevator_game')).toBeNull();
            expect(userB.get('train_adventure')?.endings).toEqual(['act2']);
            expect(userB.get('the_seventh_mirror')).toBeNull();

            // Stored blobs stay flat maps without wrapper metadata.
            expect(
                JSON.parse(
                    storage.getItem(storyProgressKey('user-a')) as string
                )
            ).toMatchObject({
                the_seventh_mirror: { sceneId: 'ch2_act1', dialogueIndex: 4 },
            });
        });

        it('keeps an account map intact when reading or writing signed out', () => {
            const storage = memoryStorage();
            const userA = new StoryProgressStore(storage, () => 10, 'user-a');
            userA.record({
                storyId: 'the_seventh_mirror',
                sceneId: 'ch4_act1',
                dialogueIndex: 2,
                atEnding: false,
            });

            const signedOut = new StoryProgressStore(storage, () => 20, null);
            signedOut.record({
                storyId: 'elevator_game',
                sceneId: 'act1',
                dialogueIndex: 0,
                atEnding: false,
            });

            expect(userA.getAll()).toEqual({
                the_seventh_mirror: {
                    sceneId: 'ch4_act1',
                    dialogueIndex: 2,
                    updatedAt: 10,
                    finished: false,
                    endings: [],
                    visited: ['ch4_act1'],
                },
            });
        });

        it('imports saved sessions only from the owner-scoped session keys', () => {
            const storage = memoryStorage({
                [readerSessionKey('en', null)]: session(
                    'elevator_game',
                    'act1',
                    1,
                    'en'
                ),
                [readerSessionKey('ja', 'user-a')]: session(
                    'the_seventh_mirror',
                    'ch2_act1',
                    3,
                    'ja'
                ),
            });
            const userA = new StoryProgressStore(storage, () => 10, 'user-a');
            importSavedSessions(userA, storage, 'en', 'user-a');

            expect(userA.get('the_seventh_mirror')?.sceneId).toBe('ch2_act1');
            expect(userA.get('elevator_game')).toBeNull();
        });

        it('refuses to seed when the stored map cannot be read', () => {
            const corrupt = memoryStorage({
                [storyProgressKey('user-a')]: '{not json',
            });
            expect(
                new StoryProgressStore(corrupt, () => 10, 'user-a').seed({
                    storyId: 'the_seventh_mirror',
                    sceneId: 'ch9_act3',
                    dialogueIndex: 4,
                })
            ).toBe(false);
            expect(corrupt.getItem(storyProgressKey('user-a'))).toBe(
                '{not json'
            );

            const throwing = memoryStorage();
            throwing.getItem = () => {
                throw new Error('SecurityError');
            };
            expect(
                new StoryProgressStore(throwing, () => 10, 'user-a').seed({
                    storyId: 's',
                    sceneId: 'act1',
                    dialogueIndex: 0,
                })
            ).toBe(false);
        });
    });

    describe('claimAnonymous', () => {
        it('merges anonymous progress and sessions into the account key and deletes anonymous keys', () => {
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: JSON.stringify({
                    elevator_game: {
                        sceneId: 'act3',
                        dialogueIndex: 5,
                        updatedAt: 50,
                        finished: true,
                        endings: ['act3'],
                    },
                    shared_story: {
                        sceneId: 'act1',
                        dialogueIndex: 1,
                        updatedAt: 10,
                        finished: false,
                        endings: [],
                    },
                }),
                [storyProgressKey('user-a')]: JSON.stringify({
                    shared_story: {
                        sceneId: 'act2',
                        dialogueIndex: 4,
                        updatedAt: 80,
                        finished: false,
                        endings: [],
                    },
                }),
                [readerSessionKey('en', null)]: session(
                    'the_seventh_mirror',
                    'ch3_act1',
                    2,
                    'en'
                ),
            });

            const userA = new StoryProgressStore(storage, () => 100, 'user-a');
            expect(userA.claimAnonymous('en')).toBe(true);

            expect(userA.get('elevator_game')).toMatchObject({
                sceneId: 'act3',
                dialogueIndex: 5,
                updatedAt: 50,
                finished: true,
                endings: ['act3'],
            });
            expect(userA.get('shared_story')).toMatchObject({
                sceneId: 'act2',
                dialogueIndex: 4,
                updatedAt: 80,
            });
            expect(userA.get('the_seventh_mirror')).toMatchObject({
                sceneId: 'ch3_act1',
                dialogueIndex: 2,
                updatedAt: 0,
            });
            // Anonymous keys were removed so another account will not claim them.
            expect(storage.getItem(STORY_PROGRESS_KEY)).toBeNull();
            expect(storage.getItem(readerSessionKey('en', null))).toBeNull();
            // Migrated session is saved under user-a's scoped session key.
            expect(
                JSON.parse(
                    storage.getItem(readerSessionKey('en', 'user-a')) as string
                )
            ).toMatchObject({
                storyId: 'the_seventh_mirror',
                sceneId: 'ch3_act1',
                dialogueIndex: 2,
            });
        });

        it('keeps anonymous keys intact when writing the account key fails', () => {
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: JSON.stringify({
                    elevator_game: {
                        sceneId: 'act2',
                        dialogueIndex: 2,
                        updatedAt: 25,
                        finished: false,
                        endings: [],
                    },
                }),
                [readerSessionKey('en', null)]: session(
                    'train_adventure',
                    'act1',
                    0,
                    'en'
                ),
            });
            const origSetItem = storage.setItem.bind(storage);
            storage.setItem = (key, value) => {
                if (key === storyProgressKey('user-a')) {
                    throw new Error('QuotaExceededError');
                }
                origSetItem(key, value);
            };

            const userA = new StoryProgressStore(storage, () => 100, 'user-a');
            expect(userA.claimAnonymous('en')).toBe(false);
            expect(storage.getItem(STORY_PROGRESS_KEY)).not.toBeNull();
            expect(
                storage.getItem(readerSessionKey('en', null))
            ).not.toBeNull();
        });

        it('tolerates corrupt anonymous JSON without losing existing account progress', () => {
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: '{not valid json',
                [storyProgressKey('user-a')]: JSON.stringify({
                    the_seventh_mirror: {
                        sceneId: 'ch1_act1',
                        dialogueIndex: 3,
                        updatedAt: 15,
                        finished: false,
                        endings: [],
                    },
                }),
            });

            const userA = new StoryProgressStore(storage, () => 100, 'user-a');
            expect(userA.claimAnonymous('en')).toBe(true);
            expect(userA.get('the_seventh_mirror')?.sceneId).toBe('ch1_act1');
            expect(storage.getItem(STORY_PROGRESS_KEY)).toBe('{not valid json');
        });
    });
});
