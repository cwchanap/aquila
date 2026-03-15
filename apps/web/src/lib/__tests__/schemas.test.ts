import { describe, it, expect } from 'vitest';
import {
    SceneCreateSchema,
    ChapterCreateSchema,
    StoryCreateSchema,
    StoryUpdateSchema,
    BookmarkCreateSchema,
    BookmarkUpdateSchema,
    UserUpdateSchema,
    CharacterSetupSchema,
} from '../schemas';

const validSceneBase = {
    storyId: 'story-1',
    title: 'Scene Title',
};

const validChapterBase = {
    storyId: 'story-1',
    title: 'Chapter Title',
};

describe('SceneCreateSchema - order field', () => {
    it('accepts a valid integer number', () => {
        const result = SceneCreateSchema.safeParse({
            ...validSceneBase,
            order: 3,
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.order).toBe(3);
    });

    it('accepts a numeric string', () => {
        const result = SceneCreateSchema.safeParse({
            ...validSceneBase,
            order: '5',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.order).toBe(5);
    });

    it('rejects an empty string', () => {
        const result = SceneCreateSchema.safeParse({
            ...validSceneBase,
            order: '',
        });
        expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only string', () => {
        const result = SceneCreateSchema.safeParse({
            ...validSceneBase,
            order: '   ',
        });
        expect(result.success).toBe(false);
    });

    it('rejects a non-integer numeric string', () => {
        const result = SceneCreateSchema.safeParse({
            ...validSceneBase,
            order: '1.5',
        });
        expect(result.success).toBe(false);
    });

    it('accepts zero as an explicit integer', () => {
        const result = SceneCreateSchema.safeParse({
            ...validSceneBase,
            order: 0,
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.order).toBe(0);
    });
});

describe('StoryCreateSchema', () => {
    it('accepts a valid story with all fields', () => {
        const result = StoryCreateSchema.safeParse({
            title: 'My Story',
            description: 'A tale',
            coverImage: 'https://example.com/cover.png',
            status: 'published',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.title).toBe('My Story');
            expect(result.data.status).toBe('published');
        }
    });

    it('defaults status to "draft" when omitted', () => {
        const result = StoryCreateSchema.safeParse({ title: 'Draft Story' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.status).toBe('draft');
    });

    it('trims whitespace from title', () => {
        const result = StoryCreateSchema.safeParse({ title: '  Trimmed  ' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.title).toBe('Trimmed');
    });

    it('rejects an empty title', () => {
        const result = StoryCreateSchema.safeParse({ title: '' });
        expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only title', () => {
        const result = StoryCreateSchema.safeParse({ title: '   ' });
        expect(result.success).toBe(false);
    });

    it('rejects a title longer than 255 characters', () => {
        const result = StoryCreateSchema.safeParse({ title: 'x'.repeat(256) });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid cover image URL', () => {
        const result = StoryCreateSchema.safeParse({
            title: 'Story',
            coverImage: 'not-a-url',
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid status value', () => {
        const result = StoryCreateSchema.safeParse({
            title: 'Story',
            status: 'pending',
        });
        expect(result.success).toBe(false);
    });

    it('accepts all valid status values', () => {
        for (const status of ['draft', 'published', 'archived']) {
            const result = StoryCreateSchema.safeParse({
                title: 'Story',
                status,
            });
            expect(result.success).toBe(true);
        }
    });
});

describe('StoryUpdateSchema', () => {
    it('accepts an empty object (all fields optional)', () => {
        const result = StoryUpdateSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts partial updates', () => {
        const result = StoryUpdateSchema.safeParse({ title: 'New Title' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.title).toBe('New Title');
    });

    it('accepts null coverImage to clear it', () => {
        const result = StoryUpdateSchema.safeParse({ coverImage: null });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.coverImage).toBeNull();
    });

    it('rejects an invalid coverImage URL', () => {
        const result = StoryUpdateSchema.safeParse({
            coverImage: 'not-a-url',
        });
        expect(result.success).toBe(false);
    });

    it('rejects an empty title when provided', () => {
        const result = StoryUpdateSchema.safeParse({ title: '' });
        expect(result.success).toBe(false);
    });
});

describe('BookmarkCreateSchema', () => {
    const validBase = {
        storyId: 'story-1',
        sceneId: 'scene-1',
        bookmarkName: 'Checkpoint',
    };

    it('accepts valid bookmark with default locale', () => {
        const result = BookmarkCreateSchema.safeParse(validBase);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.locale).toBe('en');
    });

    it('accepts explicit zh locale', () => {
        const result = BookmarkCreateSchema.safeParse({
            ...validBase,
            locale: 'zh',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.locale).toBe('zh');
    });

    it('rejects missing storyId', () => {
        const result = BookmarkCreateSchema.safeParse({
            sceneId: 'scene-1',
            bookmarkName: 'Save',
        });
        expect(result.success).toBe(false);
    });

    it('rejects missing sceneId', () => {
        const result = BookmarkCreateSchema.safeParse({
            storyId: 'story-1',
            bookmarkName: 'Save',
        });
        expect(result.success).toBe(false);
    });

    it('rejects empty bookmarkName', () => {
        const result = BookmarkCreateSchema.safeParse({
            ...validBase,
            bookmarkName: '',
        });
        expect(result.success).toBe(false);
    });

    it('rejects bookmarkName longer than 100 characters', () => {
        const result = BookmarkCreateSchema.safeParse({
            ...validBase,
            bookmarkName: 'x'.repeat(101),
        });
        expect(result.success).toBe(false);
    });

    it('rejects an invalid locale', () => {
        const result = BookmarkCreateSchema.safeParse({
            ...validBase,
            locale: 'fr',
        });
        expect(result.success).toBe(false);
    });
});

describe('BookmarkUpdateSchema', () => {
    it('accepts an empty object (all fields optional)', () => {
        const result = BookmarkUpdateSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts a partial update with only sceneId', () => {
        const result = BookmarkUpdateSchema.safeParse({ sceneId: 'scene-2' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.sceneId).toBe('scene-2');
    });

    it('accepts all fields together', () => {
        const result = BookmarkUpdateSchema.safeParse({
            sceneId: 'scene-2',
            bookmarkName: 'New Save',
            locale: 'zh',
        });
        expect(result.success).toBe(true);
    });

    it('rejects empty sceneId when provided', () => {
        const result = BookmarkUpdateSchema.safeParse({ sceneId: '' });
        expect(result.success).toBe(false);
    });
});

describe('UserUpdateSchema', () => {
    it('accepts an empty object (all fields optional)', () => {
        const result = UserUpdateSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('accepts a valid email', () => {
        const result = UserUpdateSchema.safeParse({
            email: 'user@example.com',
        });
        expect(result.success).toBe(true);
    });

    it('rejects an invalid email', () => {
        const result = UserUpdateSchema.safeParse({ email: 'not-an-email' });
        expect(result.success).toBe(false);
    });

    it('accepts a username within length bounds', () => {
        const result = UserUpdateSchema.safeParse({ username: 'alice' });
        expect(result.success).toBe(true);
    });

    it('rejects a username shorter than 3 characters', () => {
        const result = UserUpdateSchema.safeParse({ username: 'ab' });
        expect(result.success).toBe(false);
    });

    it('rejects a username longer than 50 characters', () => {
        const result = UserUpdateSchema.safeParse({
            username: 'a'.repeat(51),
        });
        expect(result.success).toBe(false);
    });

    it('trims whitespace from name', () => {
        const result = UserUpdateSchema.safeParse({ name: '  Alice  ' });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.name).toBe('Alice');
    });

    it('rejects an empty name when provided', () => {
        const result = UserUpdateSchema.safeParse({ name: '' });
        expect(result.success).toBe(false);
    });
});

describe('CharacterSetupSchema', () => {
    it('accepts a valid setup with default locale', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: 'Hero',
            storyId: 'train_adventure',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.locale).toBe('en');
    });

    it('accepts zh locale', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: 'Hero',
            storyId: 'train_adventure',
            locale: 'zh',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.locale).toBe('zh');
    });

    it('rejects empty characterName', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: '',
            storyId: 'train_adventure',
        });
        expect(result.success).toBe(false);
    });

    it('rejects characterName longer than 50 characters', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: 'a'.repeat(51),
            storyId: 'train_adventure',
        });
        expect(result.success).toBe(false);
    });

    it('accepts characterName exactly 50 characters', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: 'a'.repeat(50),
            storyId: 'train_adventure',
        });
        expect(result.success).toBe(true);
    });

    it('rejects missing storyId', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: 'Hero',
        });
        expect(result.success).toBe(false);
    });

    it('rejects invalid locale', () => {
        const result = CharacterSetupSchema.safeParse({
            characterName: 'Hero',
            storyId: 'train_adventure',
            locale: 'fr',
        });
        expect(result.success).toBe(false);
    });
});

describe('ChapterCreateSchema - order field', () => {
    it('accepts a valid integer number', () => {
        const result = ChapterCreateSchema.safeParse({
            ...validChapterBase,
            order: 2,
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.order).toBe(2);
    });

    it('accepts a numeric string', () => {
        const result = ChapterCreateSchema.safeParse({
            ...validChapterBase,
            order: '10',
        });
        expect(result.success).toBe(true);
        if (result.success) expect(result.data.order).toBe(10);
    });

    it('rejects an empty string', () => {
        const result = ChapterCreateSchema.safeParse({
            ...validChapterBase,
            order: '',
        });
        expect(result.success).toBe(false);
    });

    it('rejects a whitespace-only string', () => {
        const result = ChapterCreateSchema.safeParse({
            ...validChapterBase,
            order: '  ',
        });
        expect(result.success).toBe(false);
    });

    it('rejects a float numeric string', () => {
        const result = ChapterCreateSchema.safeParse({
            ...validChapterBase,
            order: '2.7',
        });
        expect(result.success).toBe(false);
    });
});
