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
});
