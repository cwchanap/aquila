import {
    pgTable,
    text,
    timestamp,
    index,
    uniqueIndex,
    pgEnum,
    boolean,
} from 'drizzle-orm/pg-core';

// Enum for story status
export const storyStatusEnum = pgEnum('story_status', [
    'draft',
    'published',
    'archived',
]);

// ============= Authentication Tables (Better Auth) =============

// Users table
export const users = pgTable(
    'users',
    {
        id: text('id').primaryKey(),
        email: text('email').notNull().unique(),
        username: text('username'),
        name: text('name'),
        image: text('image'),
        emailVerified: boolean('email_verified').notNull().default(false),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        emailIdx: index('users_email_idx').on(table.email),
    })
);

// Sessions table
export const sessions = pgTable(
    'sessions',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
        token: text('token').notNull().unique(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
    },
    table => ({
        userIdIdx: index('sessions_user_id_idx').on(table.userId),
        tokenIdx: index('sessions_token_idx').on(table.token),
        expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
    })
);

// Accounts table (OAuth providers)
export const accounts = pgTable(
    'accounts',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at', {
            mode: 'date',
        }),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
            mode: 'date',
        }),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        userIdIdx: index('accounts_user_id_idx').on(table.userId),
        userProviderIdx: index('accounts_user_provider_idx').on(
            table.userId,
            table.providerId
        ),
        userProviderAccountIdx: uniqueIndex(
            'accounts_user_provider_account_idx'
        ).on(table.userId, table.providerId, table.accountId),
    })
);

// Verification tokens table
export const verificationTokens = pgTable(
    'verification_tokens',
    {
        id: text('id').primaryKey(),
        identifier: text('identifier').notNull(),
        token: text('token').notNull().unique(),
        expires: timestamp('expires', { mode: 'date' }).notNull(),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        tokenIdx: index('verification_tokens_token_idx').on(table.token),
    })
);

// Character setups table
export const characterSetups = pgTable(
    'character_setups',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        characterName: text('character_name').notNull(),
        storyId: text('story_id')
            .notNull()
            .references(() => stories.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        userIdIdx: index('character_setups_user_id_idx').on(table.userId),
        storyIdIdx: index('character_setups_story_id_idx').on(table.storyId),
        userStoryIdx: index('character_setups_user_story_idx').on(
            table.userId,
            table.storyId
        ),
    })
);

// ============= Story Management Tables =============

// Story table - top level organization
export const stories = pgTable(
    'stories',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
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

// Type exports - Authentication
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type VerificationToken = typeof verificationTokens.$inferSelect;
export type NewVerificationToken = typeof verificationTokens.$inferInsert;
export type CharacterSetup = typeof characterSetups.$inferSelect;
export type NewCharacterSetup = typeof characterSetups.$inferInsert;

// ============= Reading Progress (Bookmarks) =============

// Bookmarks table - saves reading progress for stories
export const bookmarks = pgTable(
    'bookmarks',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        storyId: text('story_id')
            .notNull()
            .references(() => stories.id, { onDelete: 'cascade' }),
        sceneId: text('scene_id')
            .notNull()
            .references(() => scenes.id, { onDelete: 'cascade' }),
        bookmarkName: text('bookmark_name').notNull(),
        locale: text('locale').notNull().default('en'),
        createdAt: timestamp('created_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { mode: 'date' })
            .notNull()
            .defaultNow(),
    },
    table => ({
        userIdIdx: index('bookmarks_user_id_idx').on(table.userId),
        storyIdIdx: index('bookmarks_story_id_idx').on(table.storyId),
        userStoryIdx: index('bookmarks_user_story_idx').on(
            table.userId,
            table.storyId
        ),
        userStoryNameUnique: uniqueIndex('bookmarks_user_story_name_unique').on(
            table.userId,
            table.storyId,
            table.bookmarkName
        ),
    })
);

// Type exports - Story Management
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Scene = typeof scenes.$inferSelect;
export type NewScene = typeof scenes.$inferInsert;

// Type exports - Reading Progress
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
