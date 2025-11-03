import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReaderManager } from '../reader-manager';

// Mock the @aquila/dialogue module
vi.mock('@aquila/dialogue', () => ({
    getStoryContent: vi.fn(),
    getTranslations: vi.fn(() => ({
        reader: {
            bookmarkPrompt: 'Save bookmark as:',
            defaultBookmarkName: 'Bookmark',
            bookmarkSaved: 'Bookmark saved!',
            bookmarkFailed: 'Failed to save bookmark',
            bookmarkError: 'Error saving bookmark',
            endOfStory: 'End of story reached',
        },
        locale: 'en',
    })),
}));

import { getStoryContent } from '@aquila/dialogue';

describe('ReaderManager', () => {
    const mockGetStoryContent = vi.mocked(getStoryContent);

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn(),
            },
            writable: true,
        });

        // Mock URL and location
        Object.defineProperty(window, 'location', {
            value: {
                search: '',
                href: 'http://localhost:3000/en/reader',
            },
            writable: true,
        });

        Object.defineProperty(window, 'URLSearchParams', {
            value: class {
                constructor(search: string) {
                    this.search = search;
                }
                get() {
                    return null;
                }
            },
            writable: true,
        });

        // Mock history
        Object.defineProperty(window, 'history', {
            value: {
                pushState: vi.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getSceneData', () => {
        it('should return dialogue and choice data for a valid scene', () => {
            const mockStory = {
                dialogue: {
                    scene_3: [
                        { characterId: 'narrator', dialogue: 'Test dialogue' },
                    ],
                },
                choices: {
                    choice_3: {
                        prompt: 'What to do?',
                        options: [
                            {
                                id: 'option1',
                                label: 'Option 1',
                                nextScene: 'scene_4',
                            },
                        ],
                    },
                },
            };

            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'scene_3',
                'en'
            );

            expect(result.dialogue).toEqual(mockStory.dialogue.scene_3);
            expect(result.choice).toEqual(mockStory.choices.choice_3);
        });

        it('should return null choice when no matching choice exists', () => {
            const mockStory = {
                dialogue: {
                    scene_1: [
                        { characterId: 'narrator', dialogue: 'Test dialogue' },
                    ],
                },
                choices: {}, // No choices
            };

            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'scene_1',
                'en'
            );

            expect(result.dialogue).toEqual(mockStory.dialogue.scene_1);
            expect(result.choice).toBeNull();
        });

        it('should handle scene IDs with suffixes (e.g., scene_4a)', () => {
            const mockStory = {
                dialogue: {
                    scene_4a: [
                        { characterId: 'narrator', dialogue: 'Test dialogue' },
                    ],
                },
                choices: {
                    choice_4: {
                        prompt: 'What to do?',
                        options: [
                            {
                                id: 'option1',
                                label: 'Option 1',
                                nextScene: 'scene_5',
                            },
                        ],
                    },
                },
            };

            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'scene_4a',
                'en'
            );

            expect(result.dialogue).toEqual(mockStory.dialogue.scene_4a);
            expect(result.choice).toEqual(mockStory.choices.choice_4);
        });

        it('should return empty dialogue array when scene does not exist', () => {
            const mockStory = {
                dialogue: {},
                choices: {},
            };

            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'scene_999',
                'en'
            );

            expect(result.dialogue).toEqual([]);
            expect(result.choice).toBeNull();
        });
    });

    describe('parseSceneNumber', () => {
        it('should parse basic scene numbers', () => {
            const manager = new ReaderManager('en');
            expect((manager as any).parseSceneNumber('scene_1')).toBe(1);
            expect((manager as any).parseSceneNumber('scene_10')).toBe(10);
            expect((manager as any).parseSceneNumber('scene_123')).toBe(123);
        });

        it('should handle scene IDs with suffixes', () => {
            const manager = new ReaderManager('en');
            expect((manager as any).parseSceneNumber('scene_1a')).toBe(1);
            expect((manager as any).parseSceneNumber('scene_2b')).toBe(2);
            expect((manager as any).parseSceneNumber('scene_10_final')).toBe(
                10
            );
        });

        it('should return null for invalid scene IDs', () => {
            const manager = new ReaderManager('en');
            expect((manager as any).parseSceneNumber('invalid')).toBeNull();
            expect((manager as any).parseSceneNumber('scene_')).toBeNull();
            expect((manager as any).parseSceneNumber('scene_abc')).toBeNull();
            expect((manager as any).parseSceneNumber('')).toBeNull();
        });
    });

    describe('hasNextScene', () => {
        it('should return true when next scene exists', () => {
            const mockStory = {
                dialogue: {
                    scene_2: [
                        {
                            characterId: 'narrator',
                            dialogue: 'Next scene exists',
                        },
                    ],
                },
                choices: {},
            };

            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('scene_1');

            expect(result).toBe(true);
        });

        it('should return false when next scene does not exist', () => {
            const mockStory = {
                dialogue: {
                    scene_1: [
                        {
                            characterId: 'narrator',
                            dialogue: 'Only this scene',
                        },
                    ],
                },
                choices: {},
            };

            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('scene_1');

            expect(result).toBe(false);
        });

        it('should return false for invalid scene IDs', () => {
            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('invalid_scene');

            expect(result).toBe(false);
        });
    });
});
