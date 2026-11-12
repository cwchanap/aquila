import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import * as schema from '../schema';
import { bookmarks, characterSetups, readingProgress, users } from '../schema';
import {
    BookmarkRepository,
    CharacterSetupRepository,
    ReadingProgressRepository,
    StoryRepository,
} from '../repositories';
import type { StoryProgressMap } from '../../story-progress';

// Real-Postgres checks are opt-in because they need a migrated database. CI
// turns this on after the existing migration step; local runs point
// DATABASE_URL at a disposable database.
const describeDb =
    process.env.AQUILA_PROGRESS_DB_TEST === '1' ? describe : describe.skip;

function progress(sceneId: string, updatedAt: number): StoryProgressMap {
    return {
        [sceneId]: {
            sceneId,
            dialogueIndex: 0,
            updatedAt,
            finished: false,
            endings: [],
        },
    };
}

describeDb('ReadingProgressRepository on real PostgreSQL', () => {
    let pool: Pool;
    let database: NodePgDatabase<typeof schema>;
    let userId: string;

    beforeAll(async () => {
        // The shared test setup installs fake timers for unit tests; real
        // network I/O needs real ones.
        vi.useRealTimers();
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error(
                'DATABASE_URL is required when AQUILA_PROGRESS_DB_TEST=1'
            );
        }
        pool = new Pool({ connectionString, max: 4 });
        database = drizzle(pool, { schema });
        userId = `hpa703-test-${randomUUID()}`;
        await database.insert(users).values({
            id: userId,
            email: `${userId}@example.invalid`,
        });
    }, 30_000);

    afterAll(async () => {
        // Deleting the user cascades to reading_progress, bookmarks and
        // character_setups, so the disposable database keeps no test data.
        if (database && userId) {
            await database.delete(users).where(eq(users.id, userId));
        }
        await pool?.end();
    }, 30_000);

    it('keeps both discoveries when two first-time merges race', async () => {
        const repo = new ReadingProgressRepository(database);

        const [first, second] = await Promise.all([
            repo.mergeForUser(userId, progress('story_a', 100)),
            repo.mergeForUser(userId, progress('story_b', 200)),
        ]);

        const [row] = await database
            .select()
            .from(readingProgress)
            .where(eq(readingProgress.userId, userId));

        expect(row).toBeDefined();
        expect(Object.keys(row.data).sort()).toEqual(['story_a', 'story_b']);
        // The serialized second caller sees the first caller's commit.
        expect(
            [Object.keys(first).length, Object.keys(second).length].sort()
        ).toEqual([1, 2]);
    }, 30_000);

    it('waits behind another FOR NO KEY UPDATE lock on the user row', async () => {
        const repo = new ReadingProgressRepository(database);
        const blocker = await pool.connect();
        let settled = false;
        let merge: Promise<StoryProgressMap> | undefined;

        try {
            await blocker.query('BEGIN');
            // Compatible with FK key-share checks but not with another
            // FOR NO KEY UPDATE, so only an explicit user-row lock waits.
            await blocker.query(
                'SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE',
                [userId]
            );

            const { rows: pidRows } = await blocker.query(
                'SELECT pg_backend_pid() AS pid'
            );
            const blockerPid = pidRows[0].pid as number;

            merge = repo
                .mergeForUser(userId, progress('story_locked', 300))
                .then(result => {
                    settled = true;
                    return result;
                });

            // A fixed delay cannot prove contention: poll until PostgreSQL
            // reports the merge connection blocked by the blocker connection
            // before releasing the lock.
            const deadline = Date.now() + 10_000;
            let blocked = false;
            while (Date.now() < deadline) {
                const { rows } = await pool.query<{ pid: number }>(
                    `SELECT pid FROM pg_stat_activity
                     WHERE wait_event_type = 'Lock'
                       AND $1 = ANY (pg_blocking_pids(pid))`,
                    [blockerPid]
                );
                if (rows.length > 0) {
                    blocked = true;
                    break;
                }
                await new Promise(resolve => setTimeout(resolve, 25));
            }
            expect(blocked).toBe(true);
            expect(settled).toBe(false);

            await blocker.query('COMMIT');
            await expect(merge).resolves.toHaveProperty('story_locked');
        } finally {
            // A failed assertion must not leave the user-row lock behind: the
            // open transaction would block afterAll cleanup.
            await blocker.query('ROLLBACK').catch(() => {});
            blocker.release();
            await merge?.catch(() => {});
        }
    }, 30_000);

    it('stores a compiled-story bookmark without a Story Writer row', async () => {
        const repo = new BookmarkRepository(database);

        const saved = await repo.create({
            userId,
            storyId: 'train_adventure',
            sceneId: 'act1_scene1',
            bookmarkName: 'Compiled story save',
            locale: 'en',
        });

        const bookmarks = await repo.findByUserAndStory(
            userId,
            'train_adventure'
        );
        expect(bookmarks).toHaveLength(1);
        expect(bookmarks[0]).toMatchObject({
            id: saved.id,
            sceneId: 'act1_scene1',
            bookmarkName: 'Compiled story save',
        });
    }, 30_000);

    it('stores a compiled-story character setup without a Story Writer row', async () => {
        const repo = new CharacterSetupRepository(database);

        const saved = await repo.create({
            userId,
            storyId: 'train_adventure',
            characterName: 'Hana',
        });

        const setup = await repo.findByUserAndStory(userId, 'train_adventure');
        expect(setup).toMatchObject({
            id: saved.id,
            characterName: 'Hana',
        });
    }, 30_000);

    it('deletes a story with its bookmarks and character setups', async () => {
        // Fixture ids are explicit: the shared test setup stubs crypto, so
        // every repo-generated id in this file is identical and would
        // collide on the primary key.
        const storyId = `del-${randomUUID()}`;
        await database.insert(schema.stories).values({
            id: storyId,
            userId,
            title: 'Story to delete',
            status: 'draft',
        });
        await database.insert(bookmarks).values([
            {
                id: `del-bm-${randomUUID()}`,
                userId,
                storyId,
                sceneId: 'scene-1',
                bookmarkName: 'Story bookmark',
                locale: 'en',
            },
            // A compiled-story row shares the columns but must survive: it
            // can never carry a Story Writer id.
            {
                id: `del-bm-${randomUUID()}`,
                userId,
                storyId: 'train_adventure',
                sceneId: 'act1',
                bookmarkName: 'Compiled bookmark',
                locale: 'en',
            },
        ]);
        await database.insert(characterSetups).values({
            id: `del-cs-${randomUUID()}`,
            userId,
            storyId,
            characterName: 'Hana',
        });

        const storyRepo = new StoryRepository(database);
        expect(await storyRepo.deleteWithDependents(storyId, userId)).toBe(
            true
        );

        // Other tests leave compiled-story rows behind for this user, so
        // assertions scope to the deleted story rather than the whole table.
        expect(
            await database
                .select()
                .from(bookmarks)
                .where(
                    and(
                        eq(bookmarks.userId, userId),
                        eq(bookmarks.storyId, storyId)
                    )
                )
        ).toEqual([]);
        expect(
            await database
                .select()
                .from(characterSetups)
                .where(
                    and(
                        eq(characterSetups.userId, userId),
                        eq(characterSetups.storyId, storyId)
                    )
                )
        ).toEqual([]);
        const compiledBookmarks = await database
            .select()
            .from(bookmarks)
            .where(
                and(
                    eq(bookmarks.userId, userId),
                    eq(bookmarks.storyId, 'train_adventure')
                )
            );
        expect(compiledBookmarks.map(b => b.bookmarkName)).toContain(
            'Compiled bookmark'
        );
        expect(await storyRepo.findById(storyId)).toBeUndefined();
    }, 30_000);
});
