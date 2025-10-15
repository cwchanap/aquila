import { pgTable, text, timestamp, index, pgEnum } from 'drizzle-orm/pg-core';

// Enum for story status
export const storyStatusEnum = pgEnum('story_status', [
    'draft',
    'published',
    'archived',
]);

// Story table - top level organization
export const stories = pgTable(
    'stories',
    {
        id: text('id').primaryKey(),
        userId: text('user_id').notNull(),
        title: text('title').notNull(),
        description: text('description'),
        coverImage: text('cover_image'),
        status: storyStatusEnum('status').notNull().default('draft'),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        userIdIdx: index('stories_user_id_idx').on(table.userId),
    })
);

// Chapter table - optional organization between story and scenes
export const chapters = pgTable(
    'chapters',
    {
        id: text('id').primaryKey(),
        storyId: text('story_id')
            .notNull()
            .references(() => stories.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        description: text('description'),
        order: text('order').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        storyIdIdx: index('chapters_story_id_idx').on(table.storyId),
        orderIdx: index('chapters_order_idx').on(table.storyId, table.order),
    })
);

// Scene table - individual scenes (can belong to story directly or to a chapter)
export const scenes = pgTable(
    'scenes',
    {
        id: text('id').primaryKey(),
        storyId: text('story_id')
            .notNull()
            .references(() => stories.id, { onDelete: 'cascade' }),
        chapterId: text('chapter_id').references(() => chapters.id, {
            onDelete: 'cascade',
        }),
        title: text('title').notNull(),
        content: text('content'),
        order: text('order').notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        storyIdIdx: index('scenes_story_id_idx').on(table.storyId),
        chapterIdIdx: index('scenes_chapter_id_idx').on(table.chapterId),
        orderIdx: index('scenes_order_idx').on(
            table.storyId,
            table.chapterId,
            table.order
        ),
    })
);

// Type exports
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Scene = typeof scenes.$inferSelect;
export type NewScene = typeof scenes.$inferInsert;
