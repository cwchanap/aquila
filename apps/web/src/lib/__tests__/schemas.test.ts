import { describe, it, expect } from 'vitest';
import { SceneCreateSchema, ChapterCreateSchema } from '../schemas';

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
