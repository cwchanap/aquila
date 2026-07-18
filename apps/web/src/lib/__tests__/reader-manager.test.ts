import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReaderManager } from '../reader-manager';
import { readerState } from '../reader-state.svelte';

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

vi.mock('@/components/ReaderShell.svelte', () => ({
    default: class MockReaderShell {},
}));

import { getStoryContent, getStoryFlow } from '@aquila/stories';
import { showAlert, showPrompt } from '../ui-dialogs';
const mockGetStoryContent = vi.mocked(getStoryContent);
const mockGetStoryFlow = vi.mocked(getStoryFlow);
const mockShowAlert = vi.mocked(showAlert);
const mockShowPrompt = vi.mocked(showPrompt);

// Point window.location at a controlled search string (real URLSearchParams parses it).
function setLocation(search: string) {
    Object.defineProperty(window, 'location', {
        value: {
            search,
            href: `http://localhost:3000/en/reader${search}`,
            reload: vi.fn(),
        },
        writable: true,
    });
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
    // Hoisted so afterEach can call destroy() — tests create a manager and
    // call initialize(), which registers popstate/pagehide/visibilitychange
    // listeners. Without destroy() in afterEach, listeners accumulate across
    // tests and stale handlers fire in later tests, reading the shared
    // readerState and interfering with assertions.
    let manager: ReaderManager | null = null;

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

        // Default empty story content so applySession never throws on missing dialogue.
        mockGetStoryContent.mockReturnValue({ dialogue: {}, choices: {} });

        mockStorage = makeMockStorage();

        Object.defineProperty(window, 'localStorage', {
            value: mockStorage,
            writable: true,
        });

        setLocation('');

        Object.defineProperty(window, 'history', {
            value: {
                pushState: vi.fn(),
                replaceState: vi.fn(),
            },
            writable: true,
        });

        // Reset fetch mock
        global.fetch = vi.fn();

        // readerState is a shared singleton — reset between tests so each manager
        // starts from a clean store.
        readerState.reset();
    });

    afterEach(() => {
        // Tear down lifecycle listeners registered by initialize() so stale
        // handlers do not accumulate across tests (see comment on `manager`).
        manager?.destroy();
        manager = null;
        vi.restoreAllMocks();
        document.body.replaceChildren();
        readerState.reset();
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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
            manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('act1');
            expect(result).toBe(true);
        });

        it('returns false when scene node next is null (terminal scene)', () => {
            // Default flow: act2 is terminal
            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('act3');
            expect(result).toBe(false);
        });

        it('returns false when scene id is not found in flow', () => {
            manager = new ReaderManager('en');
            const result = (manager as any).hasNextScene('unknown_scene');
            expect(result).toBe(false);
        });
    });

    describe('restore (initialize)', () => {
        it('resolves default state into readerState when no URL params and no localStorage', () => {
            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.storyId).toBe('train_adventure');
            expect(readerState.currentSceneId).toBe('act1');
            expect(readerState.locale).toBe('en');
            expect(readerState.dialogueIndex).toBe(0);
        });

        it('writes readerState from a valid URL story+scene', () => {
            setLocation('?story=train_adventure&scene=act2');
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act2: [{ characterId: 'narrator', dialogue: 'Act 2' }],
                },
                choices: {},
            });

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.storyId).toBe('train_adventure');
            expect(readerState.currentSceneId).toBe('act2');
        });

        it('falls back to start scene when URL scene is not in flow', () => {
            setLocation('?story=train_adventure&scene=scene_5');

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.currentSceneId).toBe('act1');
        });

        it('resolves URL story start scene when story differs from default', () => {
            mockGetStoryFlow.mockImplementation((sid: string) => {
                if (sid === 'other_story') {
                    return {
                        start: 'other_act1',
                        nodes: [
                            {
                                kind: 'scene',
                                id: 'other_act1',
                                sceneId: 'other_act1',
                                next: null,
                            },
                        ],
                    };
                }
                return {
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
                            next: null,
                        },
                    ],
                };
            });
            setLocation('?story=other_story');

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.storyId).toBe('other_story');
            expect(readerState.currentSceneId).toBe('other_act1');
        });

        it('ignores URL story when getStoryFlow returns undefined for it', () => {
            mockGetStoryFlow.mockImplementation((sid: string) => {
                if (sid === 'unknown_story') return undefined;
                return {
                    start: 'act1',
                    nodes: [
                        {
                            kind: 'scene',
                            id: 'act1',
                            sceneId: 'act1',
                            next: null,
                        },
                    ],
                };
            });
            setLocation('?story=unknown_story');

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.storyId).toBe('train_adventure');
        });

        it('resolves dialogue index from URL dialogue param (1-based)', () => {
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [
                        { characterId: 'narrator', dialogue: 'a' },
                        { characterId: 'narrator', dialogue: 'b' },
                        { characterId: 'narrator', dialogue: 'c' },
                        { characterId: 'narrator', dialogue: 'd' },
                    ],
                },
                choices: {},
            });
            setLocation('?story=train_adventure&scene=act1&dialogue=3');

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.dialogueIndex).toBe(2);
        });

        it('restores from localStorage when no URL story is present', () => {
            mockStorage.getItem.mockReturnValueOnce(
                JSON.stringify({
                    storyId: 'train_adventure',
                    sceneId: 'act2',
                    locale: 'en',
                })
            );
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act2: [{ characterId: 'narrator', dialogue: 'Act 2' }],
                },
                choices: {},
            });

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.currentSceneId).toBe('act2');
        });

        it('falls back to default when saved sceneId is not in flow', () => {
            mockStorage.getItem.mockReturnValueOnce(
                JSON.stringify({
                    storyId: 'train_adventure',
                    sceneId: 'scene_7',
                    locale: 'en',
                })
            );

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.currentSceneId).toBe('act1');
        });

        it('ignores localStorage with a mismatched locale', () => {
            mockStorage.getItem.mockReturnValueOnce(
                JSON.stringify({
                    storyId: 'train_adventure',
                    sceneId: 'act1',
                    locale: 'zh',
                })
            );

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.currentSceneId).toBe('act1');
        });

        it('handles invalid JSON in localStorage gracefully', () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            mockStorage.getItem.mockReturnValueOnce('{invalid json}');

            manager = new ReaderManager('en');
            manager.initialize();

            expect(readerState.currentSceneId).toBe('act1');
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });

        it('persists the v2 schema (version=2) to localStorage on initialize', () => {
            manager = new ReaderManager('en');
            manager.initialize();

            const storedCall = mockStorage.setItem.mock.calls.find(
                (call: [string, string]) => call[0] === 'aquila:readerState:en'
            );
            expect(storedCall).toBeDefined();
            const saved = JSON.parse(storedCall![1]);
            expect(saved.version).toBe(2);
            expect(saved.storyId).toBe('train_adventure');
            expect(saved.sceneId).toBe('act1');
            expect(saved.dialogueIndex).toBe(0);
        });

        it('uses replaceState on initial restore, not pushState', () => {
            mockGetStoryContent.mockReturnValue({
                dialogue: { act1: [] },
                choices: {},
            });

            manager = new ReaderManager('en');
            manager.initialize();

            expect(window.history.replaceState).toHaveBeenCalled();
            expect(window.history.pushState).not.toHaveBeenCalled();
        });
    });

    describe('navigation', () => {
        it('handleChoice updates readerState and persists the new scene', () => {
            mockGetStoryContent.mockReturnValue({
                dialogue: { scene_4a: [] },
                choices: {},
            });

            manager = new ReaderManager('en');
            manager.handleChoice('scene_4a');

            expect(readerState.currentSceneId).toBe('scene_4a');
            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('scene_4a')
            );
        });

        it('handleChoice uses pushState for subsequent navigation', () => {
            mockGetStoryContent.mockReturnValue({
                dialogue: { scene_4a: [] },
                choices: {},
            });

            manager = new ReaderManager('en');
            manager.handleChoice('scene_4a');

            expect(window.history.pushState).toHaveBeenCalled();
        });

        it('handleNext advances to the linear next scene', async () => {
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ characterId: 'narrator', dialogue: 'Scene 1' }],
                    act2: [{ characterId: 'narrator', dialogue: 'Scene 2' }],
                },
                choices: {},
            });

            manager = new ReaderManager('en');
            await manager.handleNext();

            expect(readerState.currentSceneId).toBe('act2');
            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:readerState:en',
                expect.stringContaining('act2')
            );
        });

        it('handleNext shows end-of-story alert at a terminal scene', async () => {
            mockGetStoryFlow.mockReturnValue({
                start: 'act2',
                nodes: [
                    { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
                ],
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act2: [{ characterId: 'narrator', dialogue: 'Last scene' }],
                },
                choices: {},
            });

            manager = new ReaderManager('en');
            await manager.handleNext();

            expect(mockShowAlert).toHaveBeenCalledWith('End of story reached');
        });

        it('handleNext shows end-of-story alert at a choice point', async () => {
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
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act3: [
                        { characterId: 'narrator', dialogue: 'Choice scene' },
                    ],
                },
                choices: {},
            });

            manager = new ReaderManager('en');
            await manager.handleNext();

            expect(mockShowAlert).toHaveBeenCalledWith('End of story reached');
        });
    });

    describe('handleBookmark', () => {
        it('does nothing when user cancels the prompt (null)', async () => {
            mockShowPrompt.mockResolvedValueOnce(null);

            manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('does nothing when user provides empty string', async () => {
            mockShowPrompt.mockResolvedValueOnce('');

            manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('saves bookmark and shows success alert when response is ok', async () => {
            mockShowPrompt.mockResolvedValueOnce('My Checkpoint');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValueOnce({}),
            });

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(mockShowAlert).toHaveBeenCalledWith('Error saving bookmark');
            errorSpy.mockRestore();
        });

        it('saves to local bookmarks when response is 401', async () => {
            mockShowPrompt.mockResolvedValueOnce('Local Save');
            global.fetch = vi.fn().mockResolvedValueOnce({
                ok: false,
                status: 401,
            });

            manager = new ReaderManager('en');
            await manager.handleBookmark();

            expect(global.fetch).toHaveBeenCalledWith(
                '/api/bookmarks',
                expect.objectContaining({ method: 'POST' })
            );
            expect(mockShowAlert).toHaveBeenCalledWith('Bookmark saved!');

            expect(mockStorage.setItem).toHaveBeenCalledWith(
                'aquila:bookmarks:en',
                expect.stringContaining('Local Save')
            );
            const storedCall = mockStorage.setItem.mock.calls.find(
                (call: [string, string]) => call[0] === 'aquila:bookmarks:en'
            );
            expect(storedCall).toBeDefined();
            const stored = JSON.parse(storedCall![1]);
            expect(stored).toHaveLength(1);
            expect(stored[0].bookmarkName).toBe('Local Save');
            expect(stored[0].storyId).toBe('train_adventure');
            expect(stored[0].sceneId).toBe('act1');
        });

        it('encodes dialogue number in bookmark name when provided', async () => {
            mockShowPrompt.mockResolvedValueOnce('Chapter');
            const mockFetch = vi.fn().mockResolvedValueOnce({
                ok: true,
                json: vi.fn().mockResolvedValueOnce({}),
            });
            global.fetch = mockFetch;

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

            manager = new ReaderManager('en');
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

    describe('renderReader', () => {
        it('returns early without throwing when container does not exist', () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            manager = new ReaderManager('en');
            expect(() => manager.renderReader()).not.toThrow();
        });

        it('skips remounting when reader instance already exists', async () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            document.body.appendChild(container);

            manager = new ReaderManager('en');

            // Set a fake existing reader instance
            const mockUnmount = vi.fn();
            (manager as any).readerInstance = { unmount: mockUnmount };

            manager.renderReader();
            // Give microtasks a chance to run
            await Promise.resolve();

            // Should NOT call unmount — component stays mounted
            expect(mockUnmount).not.toHaveBeenCalled();
        });

        it('unmount closure in readerInstance calls svelte unmount (covers lines 373-376)', async () => {
            const mockStory = {
                dialogue: { scene_1: [] },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            document.body.appendChild(container);

            manager = new ReaderManager('en');

            // First render: let the async import chain complete so readerInstance is set
            // with the REAL unmount closure (lines 373-376)
            manager.renderReader();
            // Wait until the dynamic import .then completes and sets readerInstance
            await vi.waitFor(() => {
                expect((manager as any).readerInstance).not.toBeNull();
            });

            // Explicitly call unmount on the readerInstance to exercise the closure
            (manager as any).readerInstance.unmount();
            expect(mockUnmount).toHaveBeenCalled();
        });

        it('clears the container before mounting on first render', async () => {
            const mockStory = {
                dialogue: {
                    scene_1: [{ characterId: 'narrator', dialogue: 'Hello' }],
                },
                choices: {},
            };
            mockGetStoryContent.mockReturnValue(mockStory);

            const container = document.createElement('div');
            container.id = 'reader-container';
            // Add some existing content (e.g., SSR comment placeholder)
            const oldChild = document.createElement('p');
            oldChild.textContent = 'old content';
            container.appendChild(oldChild);
            expect(container.childNodes.length).toBe(1);
            document.body.appendChild(container);

            manager = new ReaderManager('en');
            manager.renderReader();

            // Wait for the dynamic import .then to run
            await vi.waitFor(() => {
                expect(mockMount).toHaveBeenCalled();
            });

            // The container should have been cleared before mount,
            // so replaceChildren() removed the old <p>
            // After mount, only the mounted component exists (mock adds nothing)
            expect(container.contains(oldChild)).toBe(false);
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

                manager = new ReaderManager('en');
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

                manager = new ReaderManager('en');
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

    describe('index glue and history policy', () => {
        // Fake timers are global (test-setup.ts) but do NOT auto-stub rAF.
        // Stub both requestAnimationFrame and cancelAnimationFrame so the
        // manager's throttle/cancel paths are observable via pending().
        function stubRaf() {
            let cb: FrameRequestCallback | null = null;
            Object.defineProperty(window, 'requestAnimationFrame', {
                value: (fn: FrameRequestCallback) => {
                    cb = fn;
                    return 1;
                },
                writable: true,
                configurable: true,
            });
            Object.defineProperty(window, 'cancelAnimationFrame', {
                value: () => {
                    cb = null;
                },
                writable: true,
                configurable: true,
            });
            return {
                flush: () => {
                    const f = cb;
                    cb = null;
                    if (f) f(performance.now());
                },
                pending: () => cb !== null,
            };
        }

        // renderReader early-returns without a #reader-container in the DOM,
        // so each test must mount one before calling initialize().
        function setupContainer() {
            const container = document.createElement('div');
            container.id = 'reader-container';
            document.body.appendChild(container);
        }

        it('onIndexChange writes readerState.dialogueIndex and schedules throttled replaceState', async () => {
            const raf = stubRaf();
            const replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState: vi.fn(), replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: { act1: [{ dialogue: 'a' }] },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            // initialize() already invoked replaceState once via syncUrl(true);
            // clear it so the assertion below specifically verifies that
            // onIndexChange itself is throttled (does not call replaceState
            // synchronously).
            replaceState.mockClear();
            const onIndexChange = mockMount.mock.calls.at(-1)![1].props
                .onIndexChange as (i: number) => void;
            onIndexChange(2);
            expect(readerState.dialogueIndex).toBe(2);
            expect(raf.pending()).toBe(true);
            expect(replaceState).not.toHaveBeenCalled(); // throttled
            raf.flush();
            expect(replaceState).toHaveBeenCalled();
        });

        it('goToScene flushes pending replaceState before pushState', async () => {
            const raf = stubRaf();
            const pushState = vi.fn(),
                replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState, replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ dialogue: 'a' }],
                    act2: [{ dialogue: 'b' }],
                },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            const onIndexChange = mockMount.mock.calls.at(-1)![1].props
                .onIndexChange as (i: number) => void;
            onIndexChange(1); // schedule a replaceState
            expect(raf.pending()).toBe(true);
            manager.goToScene('act2'); // navigate
            expect(raf.pending()).toBe(false); // flushed
            expect(replaceState).toHaveBeenCalled(); // the line write happened
            expect(pushState).toHaveBeenCalled(); // then the scene entry
        });

        it('popstate restores validated state and cancels pending replaceState', async () => {
            const raf = stubRaf();
            const replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState: vi.fn(), replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ dialogue: 'a' }, { dialogue: 'b' }],
                },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            const onIndexChange = mockMount.mock.calls.at(-1)![1].props
                .onIndexChange as (i: number) => void;
            onIndexChange(1);
            expect(raf.pending()).toBe(true);
            // dispatch popstate with a valid URL (use the helper so href is valid)
            setLocation('?story=train_adventure&scene=act1&dialogue=1');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(raf.pending()).toBe(false); // cancelled, not flushed
            expect(readerState.dialogueIndex).toBe(0); // restored to line 1 -> index 0
        });

        it('invalid popstate soft-rejects: store unchanged, canonical URL replaceStated', async () => {
            const replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState: vi.fn(), replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: { act1: [{ dialogue: 'a' }] },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            const before = readerState.currentSceneId;
            // Make 'bogus' an unknown story so popstate takes the soft-reject branch.
            mockGetStoryFlow.mockReturnValue(undefined);
            setLocation('?story=bogus&scene=nope');
            replaceState.mockClear(); // ignore initialize's call
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(readerState.currentSceneId).toBe(before); // unchanged
            expect(replaceState).toHaveBeenCalled(); // canonical URL reconverged
        });

        it('popstate with valid story but stale scene soft-rejects (store unchanged, URL reconverged)', async () => {
            const pushState = vi.fn(),
                replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState, replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ dialogue: 'a' }],
                    act2: [{ dialogue: 'b' }],
                },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            // Move off the START scene so a soft-reject is observable: without
            // the fix, a stale-scene popstate would silently Tier-1-resolve to
            // the story START (act1), clobbering the current scene (act2).
            manager.goToScene('act2');
            expect(readerState.currentSceneId).toBe('act2');
            const before = readerState.currentSceneId;
            // popstate carries a VALID story but a scene absent from its flow.
            setLocation('?story=train_adventure&scene=deleted_scene');
            replaceState.mockClear(); // ignore initialize + goToScene calls
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(readerState.currentSceneId).toBe(before); // act2, unchanged
            expect(replaceState).toHaveBeenCalled(); // canonical URL reconverged
        });

        it('popstate with a malformed dialogue param soft-rejects (store unchanged, URL reconverged)', async () => {
            // Regression guard: a popstate carrying a partially-numeric
            // dialogue value (e.g. "2junk") must NOT silently fall through to
            // resolveInitialState, which treats parseDialogueParam=null as
            // "absent" and moves the reader to index 0, leaving the malformed
            // URL in place. The handler must soft-reject: keep the store and
            // reconverge the canonical URL via replaceState.
            const pushState = vi.fn(),
                replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState, replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ dialogue: 'a' }, { dialogue: 'b' }],
                    act2: [
                        { dialogue: 'x' },
                        { dialogue: 'y' },
                        { dialogue: 'z' },
                    ],
                },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            // Move to act2 and advance to a non-zero line so a soft-reject is
            // observable: without the fix, the malformed popstate would reset
            // dialogueIndex to 0 (same scene), which is a silent state change.
            manager.goToScene('act2');
            const onIndexChange = mockMount.mock.calls.at(-1)![1].props
                .onIndexChange as (i: number) => void;
            onIndexChange(2);
            expect(readerState.dialogueIndex).toBe(2);
            const beforeScene = readerState.currentSceneId;
            const beforeIndex = readerState.dialogueIndex;
            // popstate carries a VALID story+scene but a malformed dialogue.
            setLocation('?story=train_adventure&scene=act2&dialogue=2junk');
            replaceState.mockClear(); // ignore initialize + goToScene + onIndexChange
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(readerState.currentSceneId).toBe(beforeScene); // act2
            expect(readerState.dialogueIndex).toBe(beforeIndex); // 2, unchanged
            expect(replaceState).toHaveBeenCalled(); // canonical URL reconverged
        });

        it('popstate with dialogue=0 restores index 0 (not treated as malformed)', async () => {
            // Guard for the special absent/`0` sentinel: parseDialogueParam
            // returns null for "0" (n < 1), but popstate must NOT soft-reject
            // it — "0" is the documented "no explicit line" sentinel and must
            // restore the reader to index 0. Only non-zero unparseable values
            // are malformed.
            const pushState = vi.fn(),
                replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState, replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ dialogue: 'a' }, { dialogue: 'b' }],
                    act2: [
                        { dialogue: 'x' },
                        { dialogue: 'y' },
                        { dialogue: 'z' },
                    ],
                },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            manager.goToScene('act2');
            const onIndexChange = mockMount.mock.calls.at(-1)![1].props
                .onIndexChange as (i: number) => void;
            onIndexChange(2);
            expect(readerState.dialogueIndex).toBe(2);
            // popstate with dialogue=0 on the same scene must restore to 0
            // (NOT soft-reject and leave the reader at index 2).
            setLocation('?story=train_adventure&scene=act2&dialogue=0');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(readerState.currentSceneId).toBe('act2');
            expect(readerState.dialogueIndex).toBe(0); // restored to 0
        });

        it('popstate with dialogue=00 restores index 0 (zero-equivalent, not malformed)', async () => {
            // Regression guard: parseDialogueParam returns null for "00"
            // (parseInt("00") = 0, which fails n < 1), exactly as it does for
            // "0". Initial restore maps both to index 0. The popstate guard
            // must classify all zero-equivalent values (all-zeros strings)
            // the same way it classifies "0" — as valid restore targets —
            // rather than soft-rejecting and leaving the reader on its
            // previous line. Aligns popstate with initial-restore semantics.
            const pushState = vi.fn(),
                replaceState = vi.fn();
            Object.defineProperty(window, 'history', {
                value: { pushState, replaceState },
                writable: true,
            });
            mockGetStoryContent.mockReturnValue({
                dialogue: {
                    act1: [{ dialogue: 'a' }, { dialogue: 'b' }],
                    act2: [
                        { dialogue: 'x' },
                        { dialogue: 'y' },
                        { dialogue: 'z' },
                    ],
                },
                choices: {},
            });
            setupContainer();
            manager = new ReaderManager('en');
            manager.initialize();
            await vi.waitFor(() => expect(mockMount).toHaveBeenCalled());
            manager.goToScene('act2');
            const onIndexChange = mockMount.mock.calls.at(-1)![1].props
                .onIndexChange as (i: number) => void;
            onIndexChange(2);
            expect(readerState.dialogueIndex).toBe(2);
            // popstate with dialogue=00 on the same scene must restore to 0,
            // NOT soft-reject and leave the reader at index 2.
            setLocation('?story=train_adventure&scene=act2&dialogue=00');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(readerState.currentSceneId).toBe('act2');
            expect(readerState.dialogueIndex).toBe(0); // restored to 0
        });
    });
});
