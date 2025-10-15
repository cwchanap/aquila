import { eq, and, asc, desc } from 'drizzle-orm';
import { db, type DrizzleDB } from './db';
import {
    stories,
    chapters,
    scenes,
    type Story,
    type NewStory,
    type Chapter,
    type NewChapter,
    type Scene,
    type NewScene,
} from './schema';
import { nanoid } from 'nanoid';

// Story Repository - uses singleton db instance
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
