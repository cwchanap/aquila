/**
 * Zod schemas for API input validation.
 * Provides type-safe validation with automatic TypeScript type inference.
 */
import { z } from 'zod';

// Story schemas
export const StoryCreateSchema = z.object({
    title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
    description: z.string().optional(),
    coverImage: z.string().url('Invalid cover image URL').optional(),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

export const StoryUpdateSchema = z.object({
    title: z
        .string()
        .min(1, 'Title is required')
        .max(255, 'Title too long')
        .optional(),
    description: z.string().optional(),
    coverImage: z.string().url('Invalid cover image URL').optional().nullable(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
});

export type StoryCreate = z.infer<typeof StoryCreateSchema>;
export type StoryUpdate = z.infer<typeof StoryUpdateSchema>;

// Bookmark schemas
export const BookmarkCreateSchema = z.object({
    storyId: z.string().min(1, 'Story ID is required'),
    sceneId: z.string().min(1, 'Scene ID is required'),
    bookmarkName: z
        .string()
        .min(1, 'Bookmark name is required')
        .max(100, 'Bookmark name too long'),
    locale: z.enum(['en', 'zh']).default('en'),
});

export const BookmarkUpdateSchema = z.object({
    sceneId: z.string().min(1).optional(),
    bookmarkName: z.string().min(1).max(100).optional(),
    locale: z.enum(['en', 'zh']).optional(),
});

export type BookmarkCreate = z.infer<typeof BookmarkCreateSchema>;
export type BookmarkUpdate = z.infer<typeof BookmarkUpdateSchema>;

// User schemas
export const UserUpdateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email('Invalid email address').optional(),
    username: z
        .string()
        .min(3, 'Username must be at least 3 characters')
        .max(50, 'Username too long')
        .optional(),
});

export type UserUpdate = z.infer<typeof UserUpdateSchema>;

// Scene schemas
export const SceneCreateSchema = z.object({
    storyId: z.string().min(1, 'Story ID is required'),
    chapterId: z.string().optional().nullable(),
    title: z.string().min(1, 'Title is required').max(255),
    content: z.string().optional().nullable(),
    order: z.union([z.string(), z.number()]).transform(v => String(v)),
});

export type SceneCreate = z.infer<typeof SceneCreateSchema>;

// Chapter schemas
export const ChapterCreateSchema = z.object({
    storyId: z.string().min(1, 'Story ID is required'),
    title: z.string().min(1, 'Title is required').max(255),
    description: z.string().optional().nullable(),
    order: z.union([z.string(), z.number()]).transform(v => String(v)),
});

export type ChapterCreate = z.infer<typeof ChapterCreateSchema>;

// Character setup schemas
export const CharacterSetupSchema = z.object({
    characterName: z.string().min(1, 'Character name is required').max(50),
    storyId: z.string().min(1, 'Story ID is required'),
    locale: z.enum(['en', 'zh']).default('en'),
});

export type CharacterSetup = z.infer<typeof CharacterSetupSchema>;
