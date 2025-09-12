import { describe, it, expect } from 'vitest';
import { StoryId, STORY_NAMES, isValidStoryId } from '../story-types';

describe('Story Types', () => {
    describe('StoryId enum', () => {
        it('should have TRAIN_ADVENTURE value', () => {
            expect(StoryId.TRAIN_ADVENTURE).toBe('train_adventure');
        });

        it('should contain all expected story IDs', () => {
            const expectedIds = ['train_adventure'];
            const actualIds = Object.values(StoryId);
            expect(actualIds).toEqual(expectedIds);
        });
    });

    describe('STORY_NAMES constant', () => {
        it('should map TRAIN_ADVENTURE to correct name', () => {
            expect(STORY_NAMES[StoryId.TRAIN_ADVENTURE]).toBe(
                'Train Adventure'
            );
        });

        it('should contain all story IDs as keys', () => {
            const storyIds = Object.values(StoryId);
            const storyNameKeys = Object.keys(STORY_NAMES);

            expect(storyNameKeys).toEqual(storyIds);
        });
    });

    describe('isValidStoryId function', () => {
        it('should return true for valid story IDs', () => {
            expect(isValidStoryId(StoryId.TRAIN_ADVENTURE)).toBe(true);
            expect(isValidStoryId('train_adventure')).toBe(true);
        });

        it('should return false for invalid story IDs', () => {
            expect(isValidStoryId('invalid_story')).toBe(false);
            expect(isValidStoryId('')).toBe(false);
            expect(isValidStoryId('random_string')).toBe(false);
        });

        it('should return false for non-string values', () => {
            // @ts-expect-error - Testing invalid input types
            expect(isValidStoryId(123)).toBe(false);
            // @ts-expect-error - Testing invalid input types
            expect(isValidStoryId(null)).toBe(false);
            // @ts-expect-error - Testing invalid input types
            expect(isValidStoryId(undefined)).toBe(false);
            // @ts-expect-error - Testing invalid input types
            expect(isValidStoryId({})).toBe(false);
        });
    });
});
