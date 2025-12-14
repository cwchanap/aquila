import { eq, and, asc, desc, isNull } from 'drizzle-orm';
import { db, type DrizzleDB } from './db';
import {
    users,
    characterSetups,
    stories,
    chapters,
    scenes,
    bookmarks,
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
} from './schema';
import { nanoid } from 'nanoid';

// ============= User Repository =============
export class UserRepository {
    private db: DrizzleDB;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

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

    async findById(id: string) {
        const [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
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

    async findBySupabaseUserId(supabaseUserId: string) {
        const [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.supabaseUserId, supabaseUserId))
            .limit(1);
        return user;
    }

    async findOrCreateBySupabaseUserId(
        supabaseUserId: string,
        data: {
            email: string;
            name?: string | null;
            username?: string | null;
            image?: string | null;
        }
    ) {
        const existingBySupabaseId =
            await this.findBySupabaseUserId(supabaseUserId);
        if (existingBySupabaseId) {
            return existingBySupabaseId;
        }

        const existingByEmail = await this.findByEmail(data.email);
        if (existingByEmail) {
            if (
                existingByEmail.supabaseUserId &&
                existingByEmail.supabaseUserId !== supabaseUserId
            ) {
                throw new Error(
                    `Email ${data.email} is already linked to a different Supabase user`
                );
            }

            if (!existingByEmail.supabaseUserId) {
                const [updated] = await this.db
                    .update(users)
                    .set({
                        supabaseUserId,
                        name: data.name ?? existingByEmail.name ?? null,
                        username:
                            data.username ?? existingByEmail.username ?? null,
                        image: data.image ?? existingByEmail.image ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(users.id, existingByEmail.id))
                    .returning();

                if (updated) {
                    return updated;
                }
            }

            return existingByEmail;
        }

        const id = nanoid();
        const insertedUsers = await this.db
            .insert(users)
            .values({
                id,
                email: data.email,
                name: data.name ?? null,
                username: data.username ?? null,
                image: data.image ?? null,
                supabaseUserId,
            })
            .onConflictDoNothing({
                target: users.email,
            })
            .returning();

        if (insertedUsers[0]) {
            return insertedUsers[0];
        }

        const racedEmail = await this.findByEmail(data.email);
        if (racedEmail) {
            if (racedEmail.supabaseUserId) {
                if (racedEmail.supabaseUserId === supabaseUserId) {
                    return racedEmail;
                }

                throw new Error(
                    `Email ${data.email} is already linked to a different Supabase user`
                );
            }

            if (!racedEmail.supabaseUserId) {
                const [updated] = await this.db
                    .update(users)
                    .set({
                        supabaseUserId,
                        name: data.name ?? racedEmail.name ?? null,
                        username: data.username ?? racedEmail.username ?? null,
                        image: data.image ?? racedEmail.image ?? null,
                        updatedAt: new Date(),
                    })
                    .where(eq(users.id, racedEmail.id))
                    .returning();

                if (updated) {
                    return updated;
                }
            }

            return racedEmail;
        }

        throw new Error(
            `Failed to load user for Supabase user ${supabaseUserId} after upsert attempt`
        );
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

    async delete(id: string) {
        const deleted = await this.db
            .delete(users)
            .where(eq(users.id, id))
            .returning();
        return deleted[0];
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
export class CharacterSetupRepository {
    private db: DrizzleDB;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

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

    async delete(id: string) {
        await this.db.delete(characterSetups).where(eq(characterSetups.id, id));
    }
}

// ============= Story Repository =============
export class StoryRepository {
    private db: DrizzleDB;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

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

    async findById(id: string) {
        const [story] = await this.db
            .select()
            .from(stories)
            .where(eq(stories.id, id))
            .limit(1);
        return story;
    }

    async findByUserId(userId: string) {
        return await this.db
            .select()
            .from(stories)
            .where(eq(stories.userId, userId))
            .orderBy(desc(stories.updatedAt));
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

    async delete(id: string) {
        await this.db.delete(stories).where(eq(stories.id, id));
    }
}

// Chapter Repository
export class ChapterRepository {
    private db: DrizzleDB;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

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

    async findById(id: string) {
        const [chapter] = await this.db
            .select()
            .from(chapters)
            .where(eq(chapters.id, id))
            .limit(1);
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

    async delete(id: string) {
        await this.db.delete(chapters).where(eq(chapters.id, id));
    }

    async reorder(storyId: string, chapterIds: string[]) {
        // Update order for each chapter
        for (let i = 0; i < chapterIds.length; i++) {
            await this.db
                .update(chapters)
                .set({ order: i.toString(), updatedAt: new Date() })
                .where(
                    and(
                        eq(chapters.id, chapterIds[i]),
                        eq(chapters.storyId, storyId)
                    )
                );
        }
    }
}

// Scene Repository
export class SceneRepository {
    private db: DrizzleDB;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

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

    async findById(id: string) {
        const [scene] = await this.db
            .select()
            .from(scenes)
            .where(eq(scenes.id, id))
            .limit(1);
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

    async delete(id: string) {
        await this.db.delete(scenes).where(eq(scenes.id, id));
    }

    async reorder(
        storyId: string,
        sceneIds: string[],
        chapterId?: string | null
    ) {
        // Update order for each scene
        for (let i = 0; i < sceneIds.length; i++) {
            await this.db
                .update(scenes)
                .set({ order: i.toString(), updatedAt: new Date() })
                .where(
                    and(
                        eq(scenes.id, sceneIds[i]),
                        eq(scenes.storyId, storyId),
                        chapterId
                            ? eq(scenes.chapterId, chapterId)
                            : isNull(scenes.chapterId)
                    )
                );
        }
    }
}

// ============= Bookmark Repository =============
export class BookmarkRepository {
    private db: DrizzleDB;

    constructor(dbInstance?: DrizzleDB) {
        this.db = dbInstance || db;
    }

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

    async findById(id: string): Promise<Bookmark | undefined> {
        const [bookmark] = await this.db
            .select()
            .from(bookmarks)
            .where(eq(bookmarks.id, id))
            .limit(1);
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

    async delete(id: string): Promise<boolean> {
        const deleted = await this.db
            .delete(bookmarks)
            .where(eq(bookmarks.id, id))
            .returning({ id: bookmarks.id });

        return deleted.length > 0;
    }

    // Create or update a bookmark for a specific scene
    async upsertByScene(
        userId: string,
        storyId: string,
        sceneId: string,
        bookmarkName: string,
        locale: string = 'en'
    ): Promise<Bookmark> {
        // Check if bookmark with this name already exists
        const [existing] = await this.db
            .select()
            .from(bookmarks)
            .where(
                and(
                    eq(bookmarks.userId, userId),
                    eq(bookmarks.storyId, storyId),
                    eq(bookmarks.bookmarkName, bookmarkName)
                )
            )
            .limit(1);

        if (existing) {
            // Update existing bookmark
            const [updated] = await this.db
                .update(bookmarks)
                .set({
                    sceneId,
                    locale,
                    updatedAt: new Date(),
                })
                .where(eq(bookmarks.id, existing.id))
                .returning();
            return updated;
        } else {
            // Create new bookmark
            return await this.create({
                userId,
                storyId,
                sceneId,
                bookmarkName,
                locale,
            });
        }
    }
}
