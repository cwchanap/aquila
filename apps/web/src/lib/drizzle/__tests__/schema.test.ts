import { describe, it, expect } from 'vitest';
import {
    storyStatusEnum,
    users,
    sessions,
    accounts,
    verificationTokens,
    characterSetups,
    stories,
    chapters,
    scenes,
    bookmarks,
} from '../schema';

// Symbol used by Drizzle to store the lazy index-builder callback on each table.
// The callback is NOT invoked during pgTable() – it is stored and called later
// (e.g. during migration generation). Invoking it manually in tests is the only
// way to get coverage for those arrow-function bodies.
const ExtraConfigBuilder = Symbol.for('drizzle:ExtraConfigBuilder');
const ExtraConfigColumns = Symbol.for('drizzle:ExtraConfigColumns');

describe('Database schema', () => {
    describe('storyStatusEnum', () => {
        it('is defined and has expected values', () => {
            expect(storyStatusEnum).toBeDefined();
            expect(storyStatusEnum.enumValues).toEqual([
                'draft',
                'published',
                'archived',
            ]);
        });
    });

    describe('Auth tables', () => {
        it('users table is defined', () => {
            expect(users).toBeDefined();
        });

        it('sessions table is defined', () => {
            expect(sessions).toBeDefined();
        });

        it('accounts table is defined', () => {
            expect(accounts).toBeDefined();
        });

        it('verificationTokens table is defined', () => {
            expect(verificationTokens).toBeDefined();
        });
    });

    describe('characterSetups table', () => {
        it('is defined', () => {
            expect(characterSetups).toBeDefined();
        });

        it('has expected columns', () => {
            const cols = characterSetups as unknown as {
                id: unknown;
                userId: unknown;
                characterName: unknown;
                storyId: unknown;
                createdAt: unknown;
                updatedAt: unknown;
            };
            expect(cols.id).toBeDefined();
            expect(cols.userId).toBeDefined();
            expect(cols.characterName).toBeDefined();
            expect(cols.storyId).toBeDefined();
            expect(cols.createdAt).toBeDefined();
            expect(cols.updatedAt).toBeDefined();
        });
    });

    describe('stories table', () => {
        it('is defined', () => {
            expect(stories).toBeDefined();
        });

        it('has expected columns', () => {
            const cols = stories as unknown as {
                id: unknown;
                userId: unknown;
                title: unknown;
                description: unknown;
                status: unknown;
            };
            expect(cols.id).toBeDefined();
            expect(cols.userId).toBeDefined();
            expect(cols.title).toBeDefined();
            expect(cols.description).toBeDefined();
            expect(cols.status).toBeDefined();
        });
    });

    describe('chapters table', () => {
        it('is defined', () => {
            expect(chapters).toBeDefined();
        });

        it('has expected columns', () => {
            const cols = chapters as unknown as {
                id: unknown;
                storyId: unknown;
                title: unknown;
                order: unknown;
            };
            expect(cols.id).toBeDefined();
            expect(cols.storyId).toBeDefined();
            expect(cols.title).toBeDefined();
            expect(cols.order).toBeDefined();
        });
    });

    describe('scenes table', () => {
        it('is defined', () => {
            expect(scenes).toBeDefined();
        });

        it('has expected columns', () => {
            const cols = scenes as unknown as {
                id: unknown;
                storyId: unknown;
                chapterId: unknown;
                title: unknown;
                content: unknown;
                order: unknown;
            };
            expect(cols.id).toBeDefined();
            expect(cols.storyId).toBeDefined();
            expect(cols.chapterId).toBeDefined();
            expect(cols.title).toBeDefined();
            expect(cols.content).toBeDefined();
            expect(cols.order).toBeDefined();
        });
    });

    describe('bookmarks table', () => {
        it('is defined', () => {
            expect(bookmarks).toBeDefined();
        });

        it('has expected columns', () => {
            const cols = bookmarks as unknown as {
                id: unknown;
                userId: unknown;
                storyId: unknown;
                sceneId: unknown;
                bookmarkName: unknown;
                locale: unknown;
            };
            expect(cols.id).toBeDefined();
            expect(cols.userId).toBeDefined();
            expect(cols.storyId).toBeDefined();
            expect(cols.sceneId).toBeDefined();
            expect(cols.bookmarkName).toBeDefined();
            expect(cols.locale).toBeDefined();
        });
    });

    // Drizzle stores the `table => ({...})` index-builder callbacks lazily via
    // Symbol.for('drizzle:ExtraConfigBuilder'). Calling them here exercises those
    // function bodies so they appear in the coverage report.
    describe('index builder callbacks (ExtraConfigBuilder)', () => {
        function invokeBuilder(table: unknown): unknown {
            const t = table as Record<symbol, unknown>;
            const builder = t[ExtraConfigBuilder];
            expect(builder).toBeDefined();
            expect(typeof builder).toBe('function');
            const cols = t[ExtraConfigColumns];
            expect(cols).toBeDefined();
            return (builder as (c: unknown) => unknown)(cols);
        }

        it('users index builder returns expected index keys', () => {
            const result = invokeBuilder(users) as Record<string, unknown>;
            expect(result).toHaveProperty('emailIdx');
        });

        it('sessions index builder returns expected index keys', () => {
            const result = invokeBuilder(sessions) as Record<string, unknown>;
            expect(result).toHaveProperty('userIdIdx');
            expect(result).toHaveProperty('tokenIdx');
            expect(result).toHaveProperty('expiresAtIdx');
        });

        it('accounts index builder returns expected index keys', () => {
            const result = invokeBuilder(accounts) as Record<string, unknown>;
            expect(result).toHaveProperty('userIdIdx');
            expect(result).toHaveProperty('userProviderIdx');
            expect(result).toHaveProperty('userProviderAccountIdx');
        });

        it('verificationTokens index builder returns expected index keys', () => {
            const result = invokeBuilder(verificationTokens) as Record<
                string,
                unknown
            >;
            expect(result).toHaveProperty('tokenIdx');
        });

        it('characterSetups index builder returns expected index keys', () => {
            const result = invokeBuilder(characterSetups) as Record<
                string,
                unknown
            >;
            expect(result).toHaveProperty('userIdIdx');
            expect(result).toHaveProperty('storyIdIdx');
            expect(result).toHaveProperty('userStoryIdx');
        });

        it('stories index builder returns expected index keys', () => {
            const result = invokeBuilder(stories) as Record<string, unknown>;
            expect(result).toHaveProperty('userIdIdx');
        });

        it('chapters index builder returns expected index keys', () => {
            const result = invokeBuilder(chapters) as Record<string, unknown>;
            expect(result).toHaveProperty('storyIdIdx');
            expect(result).toHaveProperty('orderIdx');
        });

        it('scenes index builder returns expected index keys', () => {
            const result = invokeBuilder(scenes) as Record<string, unknown>;
            expect(result).toHaveProperty('storyIdIdx');
            expect(result).toHaveProperty('chapterIdIdx');
            expect(result).toHaveProperty('orderIdx');
        });

        it('bookmarks index builder returns expected index keys', () => {
            const result = invokeBuilder(bookmarks) as Record<string, unknown>;
            expect(result).toHaveProperty('userIdIdx');
            expect(result).toHaveProperty('storyIdIdx');
            expect(result).toHaveProperty('userStoryIdx');
            expect(result).toHaveProperty('userStoryNameUnique');
        });
    });
});
