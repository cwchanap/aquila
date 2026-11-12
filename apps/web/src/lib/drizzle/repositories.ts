import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { BaseRepository } from './base-repository.js';
import {
    users,
    characterSetups,
    stories,
    chapters,
    scenes,
    bookmarks,
    accounts,
    readingProgress,
    type User,
    type NewUser,
    type CharacterSetup,
    type NewCharacterSetup,
    type Story,
    type NewStory,
    type Chapter,
    type NewChapter,
    type Scene,
    type NewScene,
    type Bookmark,
    type NewBookmark,
    type Account,
} from './schema.js';
import {
    mergeStoryProgressMaps,
    normalizeStoryProgressMap,
    type StoryProgressMap,
} from '../story-progress.js';
import { nanoid } from 'nanoid';

// ============= User Repository =============
export class UserRepository extends BaseRepository<typeof users, User> {
    protected table = users;
    protected idColumn = users.id;

    async create(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>) {
        const id = nanoid();
        const [user] = await this.db
            .insert(users)
            .values({
                id,
                ...data,
            })
            .returning();
        return user;
    }

    async findByEmail(email: string) {
        const [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        return user;
    }

    async findByUsername(username: string) {
        const [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);
        return user;
    }

    async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>) {
        const [user] = await this.db
            .update(users)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning();
        return user;
    }

    async list(limit = 50, offset = 0) {
        return await this.db
            .select()
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);
    }
}

// ============= Character Setup Repository =============
export class CharacterSetupRepository extends BaseRepository<
    typeof characterSetups,
    CharacterSetup
> {
    protected table = characterSetups;
    protected idColumn = characterSetups.id;

    async create(
        data: Omit<NewCharacterSetup, 'id' | 'createdAt' | 'updatedAt'>
    ) {
        const id = nanoid();
        const [setup] = await this.db
            .insert(characterSetups)
            .values({
                id,
                ...data,
            })
            .returning();
        return setup;
    }

    async findByUserAndStory(userId: string, storyId: string) {
        const [setup] = await this.db
            .select()
            .from(characterSetups)
            .where(
                and(
                    eq(characterSetups.userId, userId),
                    eq(characterSetups.storyId, storyId)
                )
            )
            .limit(1);
        return setup;
    }

    async findByUser(userId: string) {
        return await this.db
            .select()
            .from(characterSetups)
            .where(eq(characterSetups.userId, userId))
            .orderBy(desc(characterSetups.createdAt));
    }

    async update(
        id: string,
        data: Partial<
            Omit<CharacterSetup, 'id' | 'createdAt' | 'userId' | 'storyId'>
        >
    ) {
        const [setup] = await this.db
            .update(characterSetups)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(characterSetups.id, id))
            .returning();
        return setup;
    }
}

// ============= Story Repository =============
export class StoryRepository extends BaseRepository<typeof stories, Story> {
    protected table = stories;
    protected idColumn = stories.id;

    async create(data: Omit<NewStory, 'id' | 'createdAt' | 'updatedAt'>) {
        const id = nanoid();
        const [story] = await this.db
            .insert(stories)
            .values({
                id,
                ...data,
            })
            .returning();
        return story;
    }

    async findByUserId(userId: string) {
        return await this.db
            .select()
            .from(stories)
            .where(eq(stories.userId, userId))
            .orderBy(desc(stories.updatedAt));
    }

    /** Deletes the story plus the rows the dropped story FKs used to
     *  cascade. Any signed-in user can bookmark any story id — the bookmark
     *  API does not check story ownership — so bookmarks go by story id
     *  alone, like the old cascade. Character setups keep the owner scope:
     *  the setup API only accepts compiled story ids, so a setup can never
     *  carry a Story Writer id anyway. */
    async deleteWithDependents(id: string, userId: string): Promise<boolean> {
        return await this.db.transaction(async tx => {
            await tx.delete(bookmarks).where(eq(bookmarks.storyId, id));
            await tx
                .delete(characterSetups)
                .where(
                    and(
                        eq(characterSetups.userId, userId),
                        eq(characterSetups.storyId, id)
                    )
                );
            const deleted = await tx
                .delete(stories)
                .where(and(eq(stories.id, id), eq(stories.userId, userId)))
                .returning({ id: stories.id });
            return deleted.length > 0;
        });
    }

    async update(
        id: string,
        data: Partial<Omit<Story, 'id' | 'createdAt' | 'userId'>>
    ) {
        const [story] = await this.db
            .update(stories)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(stories.id, id))
            .returning();
        return story;
    }
}

// Chapter Repository
export class ChapterRepository extends BaseRepository<
    typeof chapters,
    Chapter
> {
    protected table = chapters;
    protected idColumn = chapters.id;

    async create(data: Omit<NewChapter, 'id' | 'createdAt' | 'updatedAt'>) {
        const id = nanoid();
        const [chapter] = await this.db
            .insert(chapters)
            .values({
                id,
                ...data,
            })
            .returning();
        return chapter;
    }

    async findByStoryId(storyId: string) {
        return await this.db
            .select()
            .from(chapters)
            .where(eq(chapters.storyId, storyId))
            .orderBy(asc(chapters.order));
    }

    async update(
        id: string,
        data: Partial<Omit<Chapter, 'id' | 'createdAt' | 'storyId'>>
    ) {
        const [chapter] = await this.db
            .update(chapters)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(chapters.id, id))
            .returning();
        return chapter;
    }

    async reorder(storyId: string, chapterIds: string[]): Promise<void> {
        // Use transaction to ensure atomicity - all updates succeed or none do
        await this.db.transaction(async tx => {
            const now = new Date();
            await Promise.all(
                chapterIds.map((chapterId, index) =>
                    tx
                        .update(chapters)
                        .set({ order: index, updatedAt: now })
                        .where(
                            and(
                                eq(chapters.id, chapterId),
                                eq(chapters.storyId, storyId)
                            )
                        )
                )
            );
        });
    }
}

// Scene Repository
export class SceneRepository extends BaseRepository<typeof scenes, Scene> {
    protected table = scenes;
    protected idColumn = scenes.id;

    async create(data: Omit<NewScene, 'id' | 'createdAt' | 'updatedAt'>) {
        const id = nanoid();
        const [scene] = await this.db
            .insert(scenes)
            .values({
                id,
                ...data,
            })
            .returning();
        return scene;
    }

    async findByStoryId(storyId: string) {
        return await this.db
            .select()
            .from(scenes)
            .where(eq(scenes.storyId, storyId))
            .orderBy(asc(scenes.order));
    }

    async findByChapterId(chapterId: string) {
        return await this.db
            .select()
            .from(scenes)
            .where(eq(scenes.chapterId, chapterId))
            .orderBy(asc(scenes.order));
    }

    async findDirectScenes(storyId: string) {
        // Scenes that belong directly to story (no chapter)
        return await this.db
            .select()
            .from(scenes)
            .where(and(eq(scenes.storyId, storyId), isNull(scenes.chapterId)))
            .orderBy(asc(scenes.order));
    }

    async update(
        id: string,
        data: Partial<Omit<Scene, 'id' | 'createdAt' | 'storyId'>>
    ) {
        const [scene] = await this.db
            .update(scenes)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(scenes.id, id))
            .returning();
        return scene;
    }

    async reorder(
        storyId: string,
        sceneIds: string[],
        chapterId?: string | null
    ): Promise<void> {
        // Use transaction to ensure atomicity - all updates succeed or none do
        await this.db.transaction(async tx => {
            const now = new Date();
            await Promise.all(
                sceneIds.map((sceneId, index) =>
                    tx
                        .update(scenes)
                        .set({ order: index, updatedAt: now })
                        .where(
                            and(
                                eq(scenes.id, sceneId),
                                eq(scenes.storyId, storyId),
                                chapterId
                                    ? eq(scenes.chapterId, chapterId)
                                    : isNull(scenes.chapterId)
                            )
                        )
                )
            );
        });
    }
}

// ============= Bookmark Repository =============
export class BookmarkRepository extends BaseRepository<
    typeof bookmarks,
    Bookmark
> {
    protected table = bookmarks;
    protected idColumn = bookmarks.id;

    async create(
        data: Omit<NewBookmark, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<Bookmark> {
        const id = nanoid();
        const [bookmark] = await this.db
            .insert(bookmarks)
            .values({
                id,
                ...data,
            })
            .returning();
        return bookmark;
    }

    async findByUserAndStory(
        userId: string,
        storyId: string
    ): Promise<Bookmark[]> {
        return await this.db
            .select()
            .from(bookmarks)
            .where(
                and(
                    eq(bookmarks.userId, userId),
                    eq(bookmarks.storyId, storyId)
                )
            )
            .orderBy(desc(bookmarks.updatedAt));
    }

    async findByUser(userId: string): Promise<Bookmark[]> {
        return await this.db
            .select()
            .from(bookmarks)
            .where(eq(bookmarks.userId, userId))
            .orderBy(desc(bookmarks.updatedAt));
    }

    async update(
        id: string,
        data: Partial<Omit<Bookmark, 'id' | 'createdAt' | 'userId' | 'storyId'>>
    ): Promise<Bookmark | undefined> {
        const [bookmark] = await this.db
            .update(bookmarks)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(bookmarks.id, id))
            .returning();
        return bookmark;
    }

    // Create or update a bookmark for a specific scene
    // Uses atomic upsert to prevent race conditions
    async upsertByScene(
        userId: string,
        storyId: string,
        sceneId: string,
        bookmarkName: string,
        locale: string = 'en'
    ): Promise<Bookmark> {
        const id = nanoid();
        const now = new Date();

        const [bookmark] = await this.db
            .insert(bookmarks)
            .values({
                id,
                userId,
                storyId,
                sceneId,
                bookmarkName,
                locale,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: [
                    bookmarks.userId,
                    bookmarks.storyId,
                    bookmarks.bookmarkName,
                ],
                set: {
                    sceneId,
                    locale,
                    updatedAt: now,
                },
            })
            .returning();

        return bookmark;
    }
}

// ============= Reading Progress Repository =============
export class ReadingProgressRepository extends BaseRepository<
    typeof readingProgress,
    typeof readingProgress.$inferSelect
> {
    protected table = readingProgress;
    protected idColumn = readingProgress.userId;

    /**
     * Merge a client map into the account's stored map atomically. Locking the
     * user row (rather than the progress row) serializes two first-time writes
     * without blocking FK-checked session/bookmark/character inserts.
     */
    async mergeForUser(
        userId: string,
        localMap: StoryProgressMap
    ): Promise<StoryProgressMap> {
        return await this.db.transaction(async tx => {
            await tx
                .select({ id: users.id })
                .from(users)
                .where(eq(users.id, userId))
                .for('no key update');

            const [stored] = await tx
                .select()
                .from(readingProgress)
                .where(eq(readingProgress.userId, userId))
                .limit(1);

            const merged = mergeStoryProgressMaps(
                localMap,
                normalizeStoryProgressMap(stored?.data)
            );
            const updatedAt = new Date();

            if (stored) {
                await tx
                    .update(readingProgress)
                    .set({ data: merged, updatedAt })
                    .where(eq(readingProgress.userId, userId));
            } else {
                await tx
                    .insert(readingProgress)
                    .values({ userId, data: merged, updatedAt });
            }

            return merged;
        });
    }
}

// ============= Account Repository =============
// Retained as a thin typed wrapper for future app-level account queries.
// Better Auth owns OAuth account CRUD via the Drizzle adapter directly, so no
// methods are needed here today.
export class AccountRepository extends BaseRepository<
    typeof accounts,
    Account
> {
    protected table = accounts;
    protected idColumn = accounts.id;
}
