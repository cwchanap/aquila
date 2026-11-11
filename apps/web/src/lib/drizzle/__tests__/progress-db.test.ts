import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import * as schema from '../schema';
import { readingProgress, users } from '../schema';
import {
    BookmarkRepository,
    CharacterSetupRepository,
    ReadingProgressRepository,
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

            merge = repo
                .mergeForUser(userId, progress('story_locked', 300))
                .then(result => {
                    settled = true;
                    return result;
                });

            await new Promise(resolve => setTimeout(resolve, 200));
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
});
