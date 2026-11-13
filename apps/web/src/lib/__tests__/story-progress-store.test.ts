import { describe, expect, it } from 'vitest';
import {
    mergeStoryProgressMaps,
    type StoryProgressMap,
} from '../story-progress';
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
        // Map and owner commit inside one wrapped blob — the raw stored
        // value is never a bare map anymore.
        expect(
            JSON.parse(storage.getItem(STORY_PROGRESS_KEY) as string)
        ).toEqual({ v: 2, owner: null, progress: merged });
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
        importSavedSessions(store, storage, 'en');
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

    describe('owner tag', () => {
        const LEGACY_OWNER_KEY = 'aquila:storyProgress:v1:owner';

        it('commits the owner inside the same blob as the map', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage);
            expect(store.setOwner('user-1')).toBe(true);
            const raw = JSON.parse(
                storage.getItem(STORY_PROGRESS_KEY) as string
            );
            expect(raw).toEqual({ v: 2, owner: 'user-1', progress: {} });
            expect(store.getOwner()).toBe('user-1');
        });

        it('keeps the owner across record() and update() writes', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 42);
            store.setOwner('user-1');
            store.record(
                {
                    storyId: 'elevator_game',
                    sceneId: 'act1',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-1'
            );
            expect(store.getOwner()).toBe('user-1');
            store.update(current => current);
            expect(store.getOwner()).toBe('user-1');
            expect(
                JSON.parse(storage.getItem(STORY_PROGRESS_KEY) as string).owner
            ).toBe('user-1');
        });

        it('retags atomically inside update() and fails the call when the write cannot land', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage);
            expect(store.update(current => current, 'user-1')).toBe(true);
            expect(store.getOwner()).toBe('user-1');

            const throwing = memoryStorage();
            throwing.setItem = () => {
                throw new Error('QuotaExceededError');
            };
            expect(
                new StoryProgressStore(throwing).update(
                    current => current,
                    'user-1'
                )
            ).toBe(false);
        });

        it('reads the pre-wrapper sidecar tag and drops it on the next write', () => {
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: JSON.stringify({
                    elevator_game: {
                        sceneId: 'act1',
                        dialogueIndex: 0,
                        updatedAt: 5,
                        finished: false,
                        endings: [],
                    },
                }),
                [LEGACY_OWNER_KEY]: 'user-a',
            });
            const store = new StoryProgressStore(storage);
            expect(store.getOwner()).toBe('user-a');
            expect(store.getAll()).toHaveProperty('elevator_game');

            store.record(
                {
                    storyId: 'train_adventure',
                    sceneId: 'act2',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-a'
            );
            // The write re-wraps the blob with its owner and clears the
            // sidecar so the two cannot disagree later.
            expect(storage.getItem(LEGACY_OWNER_KEY)).toBeNull();
            expect(store.getOwner()).toBe('user-a');
            expect(
                JSON.parse(storage.getItem(STORY_PROGRESS_KEY) as string)
            ).toMatchObject({ v: 2, owner: 'user-a' });
        });
    });

    describe('record with an account', () => {
        const position = {
            storyId: 'elevator_game',
            sceneId: 'act1',
            dialogueIndex: 3,
            atEnding: false,
        };

        it('quarantines a map tagged for another account before recording', () => {
            const storage = memoryStorage({
                [STORY_PROGRESS_KEY]: JSON.stringify({
                    the_seventh_mirror: {
                        sceneId: 'ch1_act1',
                        dialogueIndex: 0,
                        updatedAt: 10,
                        finished: false,
                        endings: [],
                    },
                }),
                // The evicted account's reader sessions leave with its map —
                // a later session import must not seed them into this
                // account's copy.
                'aquila:readerState:en': session(
                    'the_seventh_mirror',
                    'ch9_act3',
                    4
                ),
            });
            const store = new StoryProgressStore(storage, () => 99);
            store.setOwner('user-a');

            expect(store.record(position, 'user-b')).toBe(true);

            // The new record lands in a fresh map under this account's tag:
            // the previous owner's copy is sidelined — not deleted, not
            // merged — until that owner signs in again.
            expect(store.getAll()).toEqual({
                elevator_game: {
                    sceneId: 'act1',
                    dialogueIndex: 3,
                    updatedAt: 99,
                    finished: false,
                    endings: [],
                    visited: ['act1'],
                },
            });
            expect(store.getOwner()).toBe('user-b');
            expect(
                JSON.parse(
                    storage.getItem(
                        'aquila:storyProgress:v1:sidelined:user-a'
                    ) as string
                )
            ).toMatchObject({
                v: 2,
                owner: 'user-a',
                progress: {
                    the_seventh_mirror: { sceneId: 'ch1_act1' },
                },
            });
            expect(storage.getItem('aquila:readerState:en')).toBeNull();
        });

        it('restores a sidelined copy when its owner records again', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 50);
            store.setOwner('user-a');
            store.record(
                {
                    storyId: 'the_seventh_mirror',
                    sceneId: 'ch1_act1',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-a'
            );
            // user-b reads on the same browser — user-a's map is evicted.
            expect(store.record(position, 'user-b')).toBe(true);

            // user-a returns: its sidelined records merge back into the
            // active map instead of being lost to user-b's takeover.
            const back = {
                storyId: 'the_seventh_mirror',
                sceneId: 'ch5_act2',
                dialogueIndex: 9,
                atEnding: false,
            };
            expect(store.record(back, 'user-a')).toBe(true);

            const all = store.getAll();
            expect(Object.keys(all)).toEqual(['the_seventh_mirror']);
            expect(all.the_seventh_mirror).toMatchObject({
                sceneId: 'ch5_act2',
                visited: expect.arrayContaining(['ch1_act1', 'ch5_act2']),
            });
            expect(store.getOwner()).toBe('user-a');
            expect(
                storage.getItem('aquila:storyProgress:v1:sidelined:user-a')
            ).toBeNull();
            // user-b's active map was itself sidelined for its return —
            // each account's copy survives, isolated by owner.
            expect(
                storage.getItem('aquila:storyProgress:v1:sidelined:user-b')
            ).not.toBeNull();
        });

        it('leaves a sidelined copy waiting while the map is foreign', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 50);
            store.setOwner('user-a');
            store.record(
                {
                    storyId: 'the_seventh_mirror',
                    sceneId: 'ch1_act1',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-a'
            );
            store.record(position, 'user-b');
            // user-b's map is active; user-a's sidelined copy stays put.
            store.restoreSidelined('user-a');
            expect(
                storage.getItem('aquila:storyProgress:v1:sidelined:user-a')
            ).not.toBeNull();
            expect(store.get('the_seventh_mirror')).toBeNull();
            expect(store.getOwner()).toBe('user-b');
        });

        it('detaches a signed-out record from the previous account map', () => {
            // A signed-out write is unattributable — landing it in a map
            // still tagged for the last synced account would sideline it
            // under the wrong owner at the next sign-in.
            const storage = memoryStorage({
                'aquila:readerState:en': session(
                    'the_seventh_mirror',
                    'ch9_act3',
                    4
                ),
            });
            const store = new StoryProgressStore(storage, () => 99);
            store.record(
                {
                    storyId: 'the_seventh_mirror',
                    sceneId: 'ch1_act1',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-a'
            );

            expect(store.record(position)).toBe(true);

            // The anonymous record starts a fresh unowned map; the
            // displaced account's copy is sidelined intact and its reader
            // sessions leave with it, so they cannot seed the unowned copy.
            expect(store.getAll()).toEqual({
                elevator_game: {
                    sceneId: 'act1',
                    dialogueIndex: 3,
                    updatedAt: 99,
                    finished: false,
                    endings: [],
                    visited: ['act1'],
                },
            });
            expect(store.getOwner()).toBeNull();
            expect(store.get('the_seventh_mirror')).toBeNull();
            expect(
                JSON.parse(
                    storage.getItem(
                        'aquila:storyProgress:v1:sidelined:user-a'
                    ) as string
                )
            ).toMatchObject({
                v: 2,
                owner: 'user-a',
                progress: { the_seventh_mirror: { sceneId: 'ch1_act1' } },
            });
            expect(storage.getItem('aquila:readerState:en')).toBeNull();
        });

        it('lets the next signed-in account claim records written while signed out', () => {
            // A synced on this browser and signed out; anonymous reading
            // followed; B signs in — the anonymous records must land in
            // B's account, not disappear into A's sidelined copy.
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 50);
            store.record(
                {
                    storyId: 'the_seventh_mirror',
                    sceneId: 'ch1_act1',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-a'
            );
            expect(store.record(position)).toBe(true);

            expect(
                store.record(
                    {
                        storyId: 'train_adventure',
                        sceneId: 'act2',
                        dialogueIndex: 1,
                        atEnding: false,
                    },
                    'user-b'
                )
            ).toBe(true);

            // B claims the whole unowned copy; A's sidelined map waits.
            expect(Object.keys(store.getAll()).sort()).toEqual([
                'elevator_game',
                'train_adventure',
            ]);
            expect(store.getOwner()).toBe('user-b');
            expect(
                JSON.parse(
                    storage.getItem(
                        'aquila:storyProgress:v1:sidelined:user-a'
                    ) as string
                )
            ).toMatchObject({
                progress: { the_seventh_mirror: { sceneId: 'ch1_act1' } },
            });

            // A signs back in: its preserved copy returns; the records B
            // claimed stay sidelined for B's own return.
            expect(
                store.record(
                    {
                        storyId: 'the_seventh_mirror',
                        sceneId: 'ch5_act2',
                        dialogueIndex: 9,
                        atEnding: false,
                    },
                    'user-a'
                )
            ).toBe(true);
            expect(store.getOwner()).toBe('user-a');
            expect(store.get('the_seventh_mirror')).toMatchObject({
                sceneId: 'ch5_act2',
                visited: expect.arrayContaining(['ch1_act1', 'ch5_act2']),
            });
            expect(store.get('elevator_game')).toBeNull();
            expect(
                storage.getItem('aquila:storyProgress:v1:sidelined:user-b')
            ).not.toBeNull();
        });

        it('claims an anonymous map for the signing account', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 99);
            store.record({
                storyId: 'the_seventh_mirror',
                sceneId: 'ch1_act1',
                dialogueIndex: 0,
                atEnding: false,
            });

            expect(store.record(position, 'user-b')).toBe(true);

            // The anonymous records stay — they upload with this account's
            // first sync — but the tag lands immediately: a different
            // account signing in before that sync must not upload this
            // account's unsynced reading as its own.
            expect(store.get('the_seventh_mirror')).not.toBeNull();
            expect(store.get('elevator_game')).not.toBeNull();
            expect(store.getOwner()).toBe('user-b');
        });
    });

    describe('owner-aware reads and commit guards', () => {
        const position = {
            storyId: 'elevator_game',
            sceneId: 'act1',
            dialogueIndex: 3,
            atEnding: false,
        };

        it('reports map and owner together for sync', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 42);
            store.record(position, 'user-1');
            expect(store.getWithOwnerChecked()).toEqual({
                map: {
                    elevator_game: {
                        sceneId: 'act1',
                        dialogueIndex: 3,
                        updatedAt: 42,
                        finished: false,
                        endings: [],
                        visited: ['act1'],
                    },
                },
                owner: 'user-1',
            });
            expect(
                new StoryProgressStore(null).getWithOwnerChecked()
            ).toBeNull();
            const corrupt = memoryStorage({
                [STORY_PROGRESS_KEY]: '{not json',
            });
            expect(
                new StoryProgressStore(corrupt).getWithOwnerChecked()
            ).toBeNull();
        });

        it('reports a map as foreign only to a different signed-in account', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 42);
            store.record(position, 'user-a');
            expect(store.isForeignTo('user-b')).toBe(true);
            expect(store.isForeignTo('user-a')).toBe(false);
            // A signed-out reader keeps the local map it shares the
            // browser with — the tag only matters once an account is known.
            expect(store.isForeignTo(null)).toBe(false);
            expect(
                new StoryProgressStore(memoryStorage()).isForeignTo('user-b')
            ).toBe(false);
        });

        it('refuses an update commit when the stored owner changed', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 42);
            store.record(position, 'user-1');
            // The map was retagged mid-request — the merge must not land.
            store.record(
                {
                    storyId: 'train_adventure',
                    sceneId: 'act2',
                    dialogueIndex: 0,
                    atEnding: false,
                },
                'user-b'
            );
            expect(
                store.update(
                    current =>
                        mergeStoryProgressMaps(current, {
                            the_seventh_mirror: {
                                sceneId: 'ch1_act1',
                                dialogueIndex: 0,
                                updatedAt: 10,
                                finished: false,
                                endings: [],
                            },
                        }),
                    'user-1',
                    'user-1'
                )
            ).toBe(false);
            expect(store.get('the_seventh_mirror')).toBeNull();
            expect(store.get('train_adventure')).not.toBeNull();
            expect(store.getOwner()).toBe('user-b');
        });

        it('commits an update when the stored owner still matches', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 42);
            store.record(position, 'user-1');
            expect(store.update(current => current, 'user-1', 'user-1')).toBe(
                true
            );
            expect(store.getOwner()).toBe('user-1');
        });

        it('claims a tag only while the map is still unowned', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage);
            store.record(position);
            expect(store.setOwner('user-1', null)).toBe(true);
            expect(store.getOwner()).toBe('user-1');
            // A second claim under a different account is refused — the
            // tag already belongs to user-1.
            expect(store.setOwner('user-b', null)).toBe(false);
            expect(store.getOwner()).toBe('user-1');
        });

        it('sidelines the evicted map instead of deleting it on replaceAll', () => {
            const storage = memoryStorage();
            const store = new StoryProgressStore(storage, () => 42);
            store.record(position, 'user-a');
            const download: StoryProgressMap = {
                the_seventh_mirror: {
                    sceneId: 'ch1_act1',
                    dialogueIndex: 0,
                    updatedAt: 10,
                    finished: false,
                    endings: [],
                },
            };
            expect(store.replaceAll(download, 'user-b')).toBe(true);
            expect(store.getAll()).toEqual(download);
            expect(
                JSON.parse(
                    storage.getItem(
                        'aquila:storyProgress:v1:sidelined:user-a'
                    ) as string
                ).progress
            ).toHaveProperty('elevator_game');
        });
    });
});
