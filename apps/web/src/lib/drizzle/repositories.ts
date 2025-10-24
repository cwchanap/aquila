import { eq, and, asc, desc } from 'drizzle-orm';
import { db, type DrizzleDB } from './db';
import {
    users,
    characterSetups,
    stories,
    chapters,
    scenes,
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
} from './schema';
import { nanoid } from 'nanoid';

// ============= User Repository =============
export class UserRepository {
    static async create(data: Omit<NewUser, 'id' | 'createdAt' | 'updatedAt'>) {
        const id = nanoid();
        const [user] = await db
            .insert(users)
            .values({
                id,
                ...data,
            })
            .returning();
        return user;
    }

    static async findById(id: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        return user;
    }

    static async findByEmail(email: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        return user;
    }

    static async findByUsername(username: string) {
        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);
        return user;
    }

    static async update(
        id: string,
        data: Partial<Omit<User, 'id' | 'createdAt'>>
    ) {
        const [user] = await db
            .update(users)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(users.id, id))
            .returning();
        return user;
    }

    static async delete(id: string) {
        await db.delete(users).where(eq(users.id, id));
    }

    static async list(limit = 50, offset = 0) {
        return await db
            .select()
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(limit)
            .offset(offset);
    }
}

// ============= Character Setup Repository =============
export class CharacterSetupRepository {
    static async create(
        data: Omit<NewCharacterSetup, 'id' | 'createdAt' | 'updatedAt'>
    ) {
        const id = nanoid();
        const [setup] = await db
            .insert(characterSetups)
            .values({
                id,
                ...data,
            })
            .returning();
        return setup;
    }

    static async findByUserAndStory(userId: string, storyId: string) {
        const [setup] = await db
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

    static async findByUser(userId: string) {
        return await db
            .select()
            .from(characterSetups)
            .where(eq(characterSetups.userId, userId))
            .orderBy(desc(characterSetups.createdAt));
    }

    static async update(
        id: string,
        data: Partial<
            Omit<CharacterSetup, 'id' | 'createdAt' | 'userId' | 'storyId'>
        >
    ) {
        const [setup] = await db
            .update(characterSetups)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(characterSetups.id, id))
            .returning();
        return setup;
    }

    static async delete(id: string) {
        await db.delete(characterSetups).where(eq(characterSetups.id, id));
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
                .set({ order: i, updatedAt: new Date() })
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
            .where(and(eq(scenes.storyId, storyId), eq(scenes.chapterId, null)))
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
                .set({ order: i, updatedAt: new Date() })
                .where(
                    and(
                        eq(scenes.id, sceneIds[i]),
                        eq(scenes.storyId, storyId),
                        chapterId
                            ? eq(scenes.chapterId, chapterId)
                            : eq(scenes.chapterId, null)
                    )
                );
        }
    }
}
