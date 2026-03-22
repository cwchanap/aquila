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
            loadError: 'Failed to load reader',
            retry: 'Retry',
        },
        locale: 'en',
    })),
}));

const mockMount = vi.hoisted(() => vi.fn(() => ({})));
const mockUnmount = vi.hoisted(() => vi.fn());

vi.mock('svelte', () => ({
    mount: mockMount,
    unmount: mockUnmount,
}));

vi.mock('../ui-dialogs', () => ({
    showAlert: vi.fn().mockResolvedValue(undefined),
    showPrompt: vi.fn().mockResolvedValue('My Bookmark'),
}));

vi.mock('@/components/NovelReader.svelte', () => ({
    default: class MockNovelReader {},
}));

import { getStoryContent } from '@aquila/dialogue';
import { showAlert, showPrompt } from '../ui-dialogs';
const mockGetStoryContent = vi.mocked(getStoryContent);
const mockShowAlert = vi.mocked(showAlert);
const mockShowPrompt = vi.mocked(showPrompt);

// Helper to build a URLSearchParams mock with specific params
function makeUrlParamsMock(params: Record<string, string> = {}) {
    return class {
        get(key: string): string | null {
            return params[key] ?? null;
        }
    };
}

// Shared localStorage mock
function makeMockStorage() {
    return {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
    };
}

describe('ReaderManager', () => {
    let mockStorage: ReturnType<typeof makeMockStorage>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockStorage = makeMockStorage();

        Object.defineProperty(window, 'localStorage', {
            value: mockStorage,
            writable: true,
        });

        Object.defineProperty(window, 'location', {
            value: {
                search: '',
                href: 'http://localhost:3000/en/reader',
            },
            writable: true,
        });

        Object.defineProperty(window, 'URLSearchParams', {
            value: makeUrlParamsMock(),
            writable: true,
        });

        Object.defineProperty(window, 'history', {
            value: {
                pushState: vi.fn(),
            },
            writable: true,
        });

        // Reset fetch mock
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
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
                choices: {},
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

    describe('validateSceneState', () => {
        it('returns true for a valid scene state object', () => {
            const manager = new ReaderManager('en');
            expect(
                (manager as any).validateSceneState({
                    storyId: 'trainAdventure',
                    sceneId: 'scene_1',
                    locale: 'en',
                })
            ).toBe(true);
        });

        it('returns true for zh locale', () => {
            const manager = new ReaderManager('en');
            expect(
                (manager as any).validateSceneState({
                    storyId: 'trainAdventure',
                    sceneId: 'scene_1',
                    locale: 'zh',
                })
            ).toBe(true);
        });

        it('returns false for null', () => {
            const manager = new ReaderManager('en');
            expect((manager as any).validateSceneState(null)).toBe(false);
        });

        it('returns false for non-object (string)', () => {
            const manager = new ReaderManager('en');
            expect((manager as any).validateSceneState('string')).toBe(false);
        });

        it('returns false for non-object (number)', () => {
            const manager = new ReaderManager('en');
            expect((manager as any).validateSceneState(42)).toBe(false);
        });

        it('returns false when storyId is not a string', () => {
            const manager = new ReaderManager('en');
            expect(
                (manager as any).validateSceneState({
                    storyId: 123,
                    sceneId: 'scene_1',
                    locale: 'en',
                })
            ).toBe(false);
        });

        it('returns false when sceneId is not a string', () => {
            const manager = new ReaderManager('en');
            expect(
                (manager as any).validateSceneState({
                    storyId: 'trainAdventure',
                    sceneId: null,
                    locale: 'en',
                })
            ).toBe(false);
        });

        it('returns false for unsupported locale', () => {
            const manager = new ReaderManager('en');
            expect(
                (manager as any).validateSceneState({
                    storyId: 'trainAdventure',
                    sceneId: 'scene_1',
                    locale: 'fr',
                })
            ).toBe(false);
        });
    });

    describe('loadInitialState', () => {
        it('returns default state when no URL params and no localStorage', () => {
            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            expect(state.storyId).toBe('trainAdventure');
            expect(state.sceneId).toBe('scene_1');
            expect(state.locale).toBe('en');
        });

        it('returns state from URL when scene param is present', () => {
            Object.defineProperty(window, 'URLSearchParams', {
                value: makeUrlParamsMock({
                    scene: 'scene_5',
                    story: 'trainAdventure',
                }),
                writable: true,
            });

            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            expect(state.sceneId).toBe('scene_5');
            expect(state.storyId).toBe('trainAdventure');
        });

        it('uses current storyId when URL has scene but no story', () => {
            Object.defineProperty(window, 'URLSearchParams', {
                value: makeUrlParamsMock({ scene: 'scene_3' }),
                writable: true,
            });

            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            expect(state.sceneId).toBe('scene_3');
            expect(state.storyId).toBe('trainAdventure');
        });

        it('sets initialDialogueIndex from dialogue URL param', () => {
            Object.defineProperty(window, 'URLSearchParams', {
                value: makeUrlParamsMock({
                    scene: 'scene_2',
                    dialogue: '3',
                }),
                writable: true,
            });

            const manager = new ReaderManager('en');
            manager.loadInitialState();

            expect((manager as any).initialDialogueIndex).toBe(2); // 3 - 1 = 2
        });

        it('clamps dialogue index to 0 when dialogue param is 0', () => {
            Object.defineProperty(window, 'URLSearchParams', {
                value: makeUrlParamsMock({
                    scene: 'scene_1',
                    dialogue: '0',
                }),
                writable: true,
            });

            const manager = new ReaderManager('en');
            manager.loadInitialState();

            expect((manager as any).initialDialogueIndex).toBe(0);
        });

        it('ignores non-numeric dialogue param', () => {
            Object.defineProperty(window, 'URLSearchParams', {
                value: makeUrlParamsMock({
                    scene: 'scene_1',
                    dialogue: 'abc',
                }),
                writable: true,
            });

            const manager = new ReaderManager('en');
            manager.loadInitialState();

            expect((manager as any).initialDialogueIndex).toBeNull();
        });

        it('loads state from localStorage when available', () => {
            mockStorage.getItem.mockReturnValueOnce(
                JSON.stringify({
                    storyId: 'trainAdventure',
                    sceneId: 'scene_7',
                    locale: 'en',
                })
            );

            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            expect(state.sceneId).toBe('scene_7');
            expect(state.storyId).toBe('trainAdventure');
        });

        it('ignores localStorage state with different locale', () => {
            mockStorage.getItem.mockReturnValueOnce(
                JSON.stringify({
                    storyId: 'trainAdventure',
                    sceneId: 'scene_7',
                    locale: 'zh',
                })
            );

            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            // Different locale means the saved state is discarded
            expect(state.sceneId).toBe('scene_1');
            expect(mockStorage.removeItem).toHaveBeenCalledWith(
                'aquila:readerState:en'
            );
        });

        it('warns and falls back to default when localStorage state is invalid', () => {
            const warnSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            mockStorage.getItem.mockReturnValueOnce(
                JSON.stringify({ bad: 'data' })
            );

            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            expect(state.sceneId).toBe('scene_1');
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('handles invalid JSON in localStorage gracefully', () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockStorage.getItem.mockReturnValueOnce('{invalid json}');

            const manager = new ReaderManager('en');
            const state = manager.loadInitialState();

            expect(state.sceneId).toBe('scene_1');
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('saveState', () => {
        it('saves state to localStorage with the storage key', () => {
            const manager = new ReaderManager('en');
            manager.saveState({
                storyId: 'trainAdventure',
                sceneId: 'scene_3',
                locale: 'en',
            });

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('scene_3')
            );
        });

        it('updates the URL with story and scene params', () => {
            const manager = new ReaderManager('en');
            manager.saveState({
                storyId: 'trainAdventure',
                sceneId: 'scene_3',
                locale: 'en',
            });

            expect(window.history.pushState).toHaveBeenCalled();
        });

        it('normalizes locale to initialLocale', () => {
            const manager = new ReaderManager('en');
            manager.saveState({
                storyId: 'trainAdventure',
                sceneId: 'scene_3',
                locale: 'zh', // different from initialLocale
            });

            const savedData = JSON.parse(
                (mockStorage.setItem as ReturnType<typeof vi.fn>).mock
                    .calls[0][1]
            );
            expect(savedData.locale).toBe('en');
        });
    });

    describe('handleChoice', () => {
        it('navigates to the chosen scene', () => {
            const mockStory = {
                dialogue: {
                    scene_4a: [],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            manager.handleChoice('scene_4a');

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('scene_4a')
            );
        });
    });

    describe('handleBookmark', () => {
        it('does nothing when user cancels the prompt (null)', async () => {
            mockShowPrompt.mockResolvedValueOnce(null);

            const manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does nothing when user provides empty string', async () => {
            mockShowPrompt.mockResolvedValueOnce('');

            const manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('saves bookmark and shows success alert when response is ok', async () => {
            mockShowPrompt.mockResolvedValueOnce('My Checkpoint');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValueOnce({}),
            });

            const manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/bookmarks',
                expect.objectContaining({ method: 'POST' })
            );
            expect(mockShowAlert).toHaveBeenCalledWith('Bookmark saved!');
        });

        it('shows error alert when response is not ok', async () => {
            mockShowPrompt.mockResolvedValueOnce('My Checkpoint');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                json: vi.fn().mockResolvedValueOnce({ error: 'Server error' }),
            });

            const manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(mockShowAlert).toHaveBeenCalledWith(
                expect.stringContaining('Server error')
            );
        });

        it('shows fallback error when response.json has no error field', async () => {
            mockShowPrompt.mockResolvedValueOnce('My Checkpoint');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                json: vi.fn().mockResolvedValueOnce({}),
            });

            const manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(mockShowAlert).toHaveBeenCalledWith(
                expect.stringContaining('Unknown error')
            );
        });

        it('shows bookmark error when fetch throws', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockShowPrompt.mockResolvedValueOnce('My Checkpoint');
            global.fetch = vi
                .fn()
                .mockRejectedValueOnce(new Error('Network error'));

            const manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(mockShowAlert).toHaveBeenCalledWith('Error saving bookmark');
            errorSpy.mockRestore();
        });

        it('encodes dialogue number in bookmark name when provided', async () => {
            mockShowPrompt.mockResolvedValueOnce('Chapter');
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValueOnce({}),
            });
            global.fetch = mockFetch;

            const manager = new ReaderManager('en');
            await manager.handleBookmark(5);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.bookmarkName).toContain('[dlg:5]');
            expect(body.bookmarkName).toContain('Chapter');
        });

        it('does not encode dialogue number when dialogueNumber is 0', async () => {
            mockShowPrompt.mockResolvedValueOnce('Chapter');
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValueOnce({}),
            });
            global.fetch = mockFetch;

            const manager = new ReaderManager('en');
            await manager.handleBookmark(0);

            const callArgs = mockFetch.mock.calls[0];
            const body = JSON.parse(callArgs[1].body);
            expect(body.bookmarkName).toBe('Chapter');
        });
    });

    describe('onBookmark prop passed to mount (covers line 293)', () => {
        it('invokes handleBookmark via onBookmark prop extracted from mount call', async () => {
            mockShowPrompt.mockResolvedValueOnce(null); // handleBookmark returns early
            const mockStory = { dialogue: { scene_1: [] }, choices: {} };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            document.body.appendChild(container);

            const manager = new ReaderManager('en');
            manager.renderReader();

            // Wait for the dynamic import .then to run and call mount
            await vi.waitFor(() => {
                expect(mockMount).toHaveBeenCalled();
            });

            // Extract the onBookmark callback from mount's props argument
            const mountCall =
                mockMount.mock.calls[mockMount.mock.calls.length - 1];
            const { onBookmark } = mountCall[1].props as {
                onBookmark: (n: number) => Promise<void>;
            };

            // Invoke it - this exercises line 293: this.handleBookmark(dialogueNumber)
            await onBookmark(3);

            expect(mockShowPrompt).toHaveBeenCalled();
        });
    });

    describe('handleNext', () => {
        it('navigates to next scene when it exists', async () => {
            const mockStory = {
                dialogue: {
                    scene_2: [
                        { characterId: 'narrator', dialogue: 'Next scene' },
                    ],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            await manager.handleNext();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('scene_2')
            );
        });

        it('shows end-of-story alert when no next scene exists', async () => {
            const mockStory = {
                dialogue: {
                    scene_1: [
                        { characterId: 'narrator', dialogue: 'Last scene' },
                    ],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            await manager.handleNext();

            expect(mockShowAlert).toHaveBeenCalledWith('End of story reached');
        });
    });

    describe('renderReader', () => {
        it('returns early without throwing when container does not exist', () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            expect(() => manager.renderReader()).not.toThrow();
        });

        it('unmounts existing reader instance before rendering', async () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            document.body.appendChild(container);

            const manager = new ReaderManager('en');

            // Set a fake existing reader instance
            const mockUnmount = vi.fn();
            (manager as any).readerInstance = { unmount: mockUnmount };

            manager.renderReader();
            // Give microtasks a chance to run
            await Promise.resolve();

            expect(mockUnmount).toHaveBeenCalled();
        });

        it('unmount closure in readerInstance calls svelte unmount (covers lines 307-309)', async () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            document.body.appendChild(container);

            const manager = new ReaderManager('en');

            // First render: let the async import chain complete so readerInstance is set
            // with the REAL unmount closure (lines 306-310)
            manager.renderReader();
            // Wait until the dynamic import .then completes and sets readerInstance
            await vi.waitFor(() => {
                expect((manager as any).readerInstance).not.toBeNull();
            });

            // Second render: the REAL readerInstance.unmount() is called (line 307-309)
            manager.renderReader();
            await Promise.resolve();

            // mockUnmount (svelte's unmount) should have been called by the closure
            expect(mockUnmount).toHaveBeenCalled();
        });

        it('clears the container when container exists', () => {
            const mockStory = {
                dialogue: {
                    scene_1: [{ characterId: 'narrator', dialogue: 'Hello' }],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            // Add some existing content
            container.innerHTML = '<p>old content</p>';
            document.body.appendChild(container);

            const manager = new ReaderManager('en');
            // renderReader fires import() and then clears container async
            // We only verify it doesn't throw with a container present
            expect(() => manager.renderReader()).not.toThrow();
        });

        it('shows error UI with loadError text when component mounting throws', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            // Make svelte's mount throw to trigger the .catch handler in renderReader
            mockMount.mockImplementation(() => {
                throw new Error('Mount failed');
            });

            try {
                const mockStory = {
                    dialogue: { scene_1: [] },
                    choices: {},
                };
                mockGetStoryContent.mockReturnValue(mockStory);

                const container = document.createElement('div');
                container.id = 'reader-container';
                document.body.appendChild(container);

                const manager = new ReaderManager('en');
                manager.renderReader();

                // Wait until the .catch handler has built the error UI in the DOM
                await vi.waitFor(() => {
                    const errorPara = container.querySelector('p');
                    expect(errorPara).not.toBeNull();
                });

                const errorPara = container.querySelector('p');
                expect(errorPara?.textContent).toBe('Failed to load reader');

                const retryBtn = container.querySelector('button');
                expect(retryBtn?.textContent).toBe('Retry');

                expect(errorSpy).toHaveBeenCalled();
            } finally {
                errorSpy.mockRestore();
                mockMount.mockImplementation(() => ({}));
            }
        });

        it('shows Retry button in error UI that reloads the page', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const reloadMock = vi.fn();
            (window.location as unknown as Record<string, unknown>).reload =
                reloadMock;

            // Make svelte's mount throw to trigger the .catch handler in renderReader
            mockMount.mockImplementation(() => {
                throw new Error('Mount failed');
            });

            try {
                const mockStory = { dialogue: { scene_1: [] }, choices: {} };
                mockGetStoryContent.mockReturnValue(mockStory);

                const container = document.createElement('div');
                container.id = 'reader-container';
                document.body.appendChild(container);

                const manager = new ReaderManager('en');
                manager.renderReader();

                // Wait until the retry button appears
                await vi.waitFor(() => {
                    expect(container.querySelector('button')).not.toBeNull();
                });

                const retryBtn =
                    container.querySelector<HTMLButtonElement>('button');
                retryBtn?.click();

                expect(reloadMock).toHaveBeenCalled();
            } finally {
                errorSpy.mockRestore();
                mockMount.mockImplementation(() => ({}));
            }
        });
    });

    describe('initialize', () => {
        it('does not throw when called', () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            expect(() => manager.initialize()).not.toThrow();
        });

        it('saves state to localStorage on initialization', () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            manager.initialize();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('scene_1')
            );
        });

        it('loads URL state and uses it during initialization', () => {
            Object.defineProperty(window, 'URLSearchParams', {
                value: makeUrlParamsMock({ scene: 'scene_4' }),
                writable: true,
            });

            const mockStory = {
                dialogue: {
                    scene_4: [{ characterId: 'narrator', dialogue: 'Scene 4' }],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            manager.initialize();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('scene_4')
            );
        });
    });
});
