import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReaderManager } from '../reader-manager';

// Mock the @aquila/stories module
vi.mock('@aquila/stories', () => ({
    getStoryContent: vi.fn(),
    getStoryFlow: vi.fn(),
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

import { getStoryContent, getStoryFlow } from '@aquila/stories';
import { showAlert, showPrompt } from '../ui-dialogs';
const mockGetStoryContent = vi.mocked(getStoryContent);
const mockGetStoryFlow = vi.mocked(getStoryFlow);
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

        // Default flow: act1 -> act2 (linear), act2 is terminal
        mockGetStoryFlow.mockReturnValue({
            start: 'act1',
            nodes: [
                { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
                { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
            ],
        });

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
        it('returns dialogue and choice when scene node next is a choice ref', () => {
            // Set up a flow where act3's next points to a choice node
            mockGetStoryFlow.mockReturnValue({
                start: 'act1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'act1',
                        sceneId: 'act1',
                        next: 'act2',
                    },
                    {
                        kind: 'scene',
                        id: 'act2',
                        sceneId: 'act2',
                        next: 'act3',
                    },
                    {
                        kind: 'scene',
                        id: 'act3',
                        sceneId: 'act3',
                        next: 'choice:choice_act3',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:choice_act3',
                        choiceId: 'choice_act3',
                        nextByOption: {
                            option1: 'b1a_act4',
                            option2: 'b1b_act4',
                        },
                    },
                ],
            });

            const mockStory = {
                dialogue: {
                    act3: [
                        { characterId: 'narrator', dialogue: 'Test dialogue' },
                    ],
                },
                choices: {
                    choice_act3: {
                        prompt: 'What to do?',
                        options: [
                            {
                                id: 'option1',
                                label: 'Option 1',
                                nextScene: 'b1a_act4',
                            },
                            {
                                id: 'option2',
                                label: 'Option 2',
                                nextScene: 'b1b_act4',
                            },
                        ],
                    },
                },
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'act3',
                'en'
            );

            expect(result.dialogue).toEqual(mockStory.dialogue.act3);
            expect(result.choice).toEqual(mockStory.choices.choice_act3);
        });

        it('returns null choice when scene node next is a plain scene id', () => {
            // Default flow: act1 -> act2 (plain next), no choice
            const mockStory = {
                dialogue: {
                    act1: [
                        { characterId: 'narrator', dialogue: 'Test dialogue' },
                    ],
                },
                choices: {
                    choice_act1: {
                        prompt: 'Unused',
                        options: [],
                    },
                },
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'act1',
                'en'
            );

            expect(result.dialogue).toEqual(mockStory.dialogue.act1);
            expect(result.choice).toBeNull();
        });

        it('returns null choice when scene node next is null (terminal)', () => {
            // Default flow: act2 is terminal (next: null)
            const mockStory = {
                dialogue: {
                    act2: [{ characterId: 'narrator', dialogue: 'Last scene' }],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'act2',
                'en'
            );

            expect(result.dialogue).toEqual(mockStory.dialogue.act2);
            expect(result.choice).toBeNull();
        });

        it('returns null choice when scene node is not found in flow', () => {
            const mockStory = {
                dialogue: {},
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'unknown_scene',
                'en'
            );

            expect(result.dialogue).toEqual([]);
            expect(result.choice).toBeNull();
        });

        it('returns empty dialogue array when scene does not exist in content', () => {
            const mockStory = {
                dialogue: {},
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            const result = (manager as any).getSceneData(
                'trainAdventure',
                'act1',
                'en'
            );

            expect(result.dialogue).toEqual([]);
            expect(result.choice).toBeNull();
        });
    });

    describe('hasNextScene', () => {
        it('returns true when scene node has a plain scene id as next', () => {
            // Default flow: act1 -> act2 (plain next)
            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('act1');
            expect(result).toBe(true);
        });

        it('returns false when scene node next is null (terminal scene)', () => {
            // Default flow: act2 is terminal
            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('act2');
            expect(result).toBe(false);
        });

        it('returns false when scene node next is a choice ref', () => {
            mockGetStoryFlow.mockReturnValue({
                start: 'act1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'act3',
                        sceneId: 'act3',
                        next: 'choice:choice_act3',
                    },
                ],
            });

            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('act3');
            expect(result).toBe(false);
        });

        it('returns false when scene id is not found in flow', () => {
            const manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('unknown_scene');
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

            expect(state.storyId).toBe('train_adventure');
            expect(state.sceneId).toBe('act1');
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
            expect(state.storyId).toBe('train_adventure');
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
            expect(state.sceneId).toBe('act1');
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

            expect(state.sceneId).toBe('act1');
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

            expect(state.sceneId).toBe('act1');
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
            const mockStory = { dialogue: { act1: [] }, choices: {} };
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
        it('navigates to the linear next scene when flow node has a plain next', async () => {
            // Default flow: act1 -> act2 (plain next). Manager starts at act1.
            const mockStory = {
                dialogue: {
                    act1: [{ characterId: 'narrator', dialogue: 'Scene 1' }],
                    act2: [{ characterId: 'narrator', dialogue: 'Scene 2' }],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            await manager.handleNext();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('act2')
            );
        });

        it('shows end-of-story alert when flow node next is null (terminal)', async () => {
            // Override flow so manager starts at act2 (terminal)
            mockGetStoryFlow.mockReturnValue({
                start: 'act2',
                nodes: [
                    { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
                ],
            });

            const mockStory = {
                dialogue: {
                    act2: [{ characterId: 'narrator', dialogue: 'Last scene' }],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            await manager.handleNext();

            expect(mockShowAlert).toHaveBeenCalledWith('End of story reached');
        });

        it('shows end-of-story alert when flow node next is a choice ref', async () => {
            // A choice-branching scene has no linear next; showAlert is expected
            mockGetStoryFlow.mockReturnValue({
                start: 'act3',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'act3',
                        sceneId: 'act3',
                        next: 'choice:choice_act3',
                    },
                ],
            });

            const mockStory = {
                dialogue: {
                    act3: [
                        { characterId: 'narrator', dialogue: 'Choice scene' },
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
            // Wait until the unmount closure fires and mockUnmount is recorded
            await vi.waitFor(() => {
                expect(mockUnmount).toHaveBeenCalled();
            });
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
                dialogue: { act1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const manager = new ReaderManager('en');
            manager.initialize();

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('act1')
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
