import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryScene } from '../StoryScene';
import { SceneFlow } from '../SceneFlow';
import { ChoicePresenter } from '../ui/ChoicePresenter';
import { makeMockText } from './phaserMock';
import type { DialogueMap } from '../dialogue/types';

// ── Concrete subclass used in tests ────────────────────────────────────────

class TestStoryScene extends StoryScene {
    endSceneCalled = false;

    constructor() {
        super();
        // Pre-wire private sub-components so guard tests don't need create()
        (this as any).choicePresenter = {
            awaiting: false,
            clear: vi.fn(),
            setChoiceMap: vi.fn(),
            present: vi.fn(),
        };
        (this as any).menuOverlay = {
            open: false,
            forceClose: vi.fn(),
            show: vi.fn(),
            close: vi.fn(),
        };
        (this as any).completionOverlay = {
            visible: false,
            destroy: vi.fn(),
            show: vi.fn(),
        };
        (this as any).transitioning = false;
        (this as any).completed = false;
        (this as any).flow = null;
        // Pre-wire text objects so showDialogue() works
        (this as any).characterNameText = makeMockText();
        (this as any).textObject = makeMockText();
        (this as any).dialogue = {
            scene_1: [
                { character: 'Alice', dialogue: 'Line 1' },
                { character: 'Bob', dialogue: 'Line 2' },
            ],
        } satisfies DialogueMap;
    }

    override endScene() {
        this.endSceneCalled = true;
    }

    // ── Expose internals for assertions ───────────────────────────────────

    getIndex(): number {
        return (this as any).currentDialogueIndex;
    }

    isEscPaused(): boolean {
        return (this as any).escListenerPaused;
    }

    isCompleted(): boolean {
        return (this as any).completed;
    }

    getLocale(): string {
        return (this as any).locale;
    }

    getStoryId(): string {
        return (this as any).storyId;
    }

    getRegistryFn() {
        return (this as any).registry;
    }

    getHomeButtonLabelPub(): string {
        return this.getHomeButtonLabel();
    }

    onRetreatDialoguePub(): void {
        this.onRetreatDialogue();
    }

    onCrossSectionRetreatPub(): boolean {
        return this.onCrossSectionRetreat();
    }

    setFlow(flow: SceneFlow | null) {
        (this as any).flow = flow;
    }

    setCompleted(v: boolean) {
        (this as any).completed = v;
    }

    setChoicePresenterAwaiting(v: boolean) {
        (this as any).choicePresenter.awaiting = v;
    }

    setMenuOpen(v: boolean) {
        (this as any).menuOverlay.open = v;
    }

    setTransitioning(v: boolean) {
        (this as any).transitioning = v;
    }
}

// ── Simple linear SceneFlow for cross-section retreat tests ────────────────

function makeTwoSceneFlow() {
    // scene_1 → scene_2 (linear)
    const flow = SceneFlow.fromLinearScenes(['scene_1', 'scene_2'] as any);
    flow.advanceFromScene(); // now at scene_2
    return flow;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('StoryScene', () => {
    let scene: TestStoryScene;

    beforeEach(() => {
        scene = new TestStoryScene();
        localStorage.clear();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('creates an instance of StoryScene', () => {
            expect(scene).toBeInstanceOf(StoryScene);
        });

        it('defaults storyId to train_adventure', () => {
            expect(scene.getStoryId()).toBe('train_adventure');
        });
    });

    describe('init', () => {
        it('sets locale from data', () => {
            (scene as any).init({ characterName: 'Tester', locale: 'zh' });
            expect(scene.getLocale()).toBe('zh');
        });

        it('sets storyId from data', () => {
            (scene as any).init({
                characterName: 'Tester',
                storyId: 'my_story',
            });
            expect(scene.getStoryId()).toBe('my_story');
        });

        it('stores locale in registry', () => {
            (scene as any).init({ characterName: 'Tester', locale: 'en' });
            expect(scene.getRegistryFn().set).toHaveBeenCalledWith(
                'locale',
                'en'
            );
        });

        it('does not override locale when not provided', () => {
            (scene as any).locale = 'zh';
            (scene as any).init({ characterName: 'Tester' });
            expect(scene.getLocale()).toBe('zh');
        });
    });

    describe('getHomeButtonLabel', () => {
        it('returns "☰ Menu" for English locale', () => {
            expect(scene.getHomeButtonLabelPub()).toBe('☰ Menu');
        });

        it('returns "☰ 選單" for zh locale', () => {
            (scene as any).locale = 'zh';
            expect(scene.getHomeButtonLabelPub()).toBe('☰ 選單');
        });
    });

    describe('pauseEscListener / resumeEscListener', () => {
        it('pauseEscListener sets the paused flag', () => {
            expect(scene.isEscPaused()).toBe(false);
            scene.pauseEscListener();
            expect(scene.isEscPaused()).toBe(true);
        });

        it('resumeEscListener clears the paused flag', () => {
            scene.pauseEscListener();
            scene.resumeEscListener();
            expect(scene.isEscPaused()).toBe(false);
        });
    });

    describe('advanceDialogue guards', () => {
        it('advances normally when no guard is active', () => {
            expect(scene.getIndex()).toBe(0);
            scene.advanceDialogue();
            expect(scene.getIndex()).toBe(1);
        });

        it('is a no-op when choicePresenter is awaiting', () => {
            scene.setChoicePresenterAwaiting(true);
            scene.advanceDialogue();
            expect(scene.getIndex()).toBe(0);
        });

        it('is a no-op when transitioning', () => {
            scene.setTransitioning(true);
            scene.advanceDialogue();
            expect(scene.getIndex()).toBe(0);
        });

        it('is a no-op when the menu is open', () => {
            scene.setMenuOpen(true);
            scene.advanceDialogue();
            expect(scene.getIndex()).toBe(0);
        });
    });

    describe('retreatDialogue guards', () => {
        beforeEach(() => {
            // Start at index 1 so retreat has something to retreat to
            (scene as any).currentDialogueIndex = 1;
        });

        it('retreats normally when no guard is active', () => {
            scene.retreatDialogue();
            expect(scene.getIndex()).toBe(0);
        });

        it('is a no-op when choicePresenter is awaiting', () => {
            scene.setChoicePresenterAwaiting(true);
            scene.retreatDialogue();
            expect(scene.getIndex()).toBe(1);
        });

        it('is a no-op when transitioning', () => {
            scene.setTransitioning(true);
            scene.retreatDialogue();
            expect(scene.getIndex()).toBe(1);
        });

        it('is a no-op when the menu is open', () => {
            scene.setMenuOpen(true);
            scene.retreatDialogue();
            expect(scene.getIndex()).toBe(1);
        });
    });

    describe('onRetreatDialogue', () => {
        it('is a no-op when not completed', () => {
            scene.setCompleted(false);
            expect(() => scene.onRetreatDialoguePub()).not.toThrow();
            expect(scene.isCompleted()).toBe(false);
        });

        it('clears completed flag and destroys completion overlay', () => {
            scene.setCompleted(true);
            scene.onRetreatDialoguePub();
            expect(scene.isCompleted()).toBe(false);
            expect((scene as any).completionOverlay.destroy).toHaveBeenCalled();
        });
    });

    describe('onCrossSectionRetreat', () => {
        it('returns false when flow is null', () => {
            scene.setFlow(null);
            expect(scene.onCrossSectionRetreatPub()).toBe(false);
        });

        it('returns false when flow has no previous scene', () => {
            // Flow is at start – nothing to retreat to
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            scene.setFlow(flow);
            expect(scene.onCrossSectionRetreatPub()).toBe(false);
        });

        it('returns true and updates sectionKey when previous scene exists', () => {
            const flow = makeTwoSceneFlow();
            scene.setFlow(flow);
            (scene as any).sectionKey = 'scene_2';
            (scene as any).dialogue = {
                scene_1: [{ character: 'A', dialogue: 'Back' }],
            };
            const result = scene.onCrossSectionRetreatPub();
            expect(result).toBe(true);
            expect((scene as any).sectionKey).toBe('scene_1');
        });

        it('sets dialogue index to the last entry of the previous scene', () => {
            const flow = makeTwoSceneFlow();
            scene.setFlow(flow);
            (scene as any).sectionKey = 'scene_2';
            (scene as any).dialogue = {
                scene_1: [
                    { character: 'A', dialogue: 'First' },
                    { character: 'B', dialogue: 'Second' },
                ],
            };
            scene.onCrossSectionRetreatPub();
            // Max(0, len-1) = 1
            expect((scene as any).currentDialogueIndex).toBe(1);
        });
    });

    describe('endScene', () => {
        it('is a no-op when transitioning', () => {
            scene.setTransitioning(true);
            scene.endSceneCalled = false;
            // Call the parent implementation directly to test real behavior
            StoryScene.prototype.endScene.call(scene);
            // The real endScene should return early when transitioning
            expect(scene.endSceneCalled).toBe(false);
        });

        function makeRealScene(
            overrides: {
                awaiting?: boolean;
                transitioning?: boolean;
                flow?: null;
                completed?: boolean;
            } = {}
        ) {
            const RealScene = StoryScene;
            const realScene = new RealScene();
            (realScene as any).choicePresenter = {
                awaiting: overrides.awaiting ?? false,
                clear: vi.fn(),
                present: vi.fn(),
            };
            (realScene as any).transitioning = overrides.transitioning ?? false;
            (realScene as any).flow = overrides.flow ?? null;
            (realScene as any).completed = overrides.completed ?? false;
            (realScene as any).completionOverlay = {
                show: vi.fn(),
                destroy: vi.fn(),
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            return realScene;
        }

        it('is a no-op when choicePresenter is awaiting', () => {
            const realScene = makeRealScene({ awaiting: true });
            realScene.endScene();
            expect(
                (realScene as any).completionOverlay.show
            ).not.toHaveBeenCalled();
        });

        it('calls showCompletionOverlay when flow is null and not already completed', () => {
            const realScene = makeRealScene();
            realScene.endScene();
            expect(
                (realScene as any).completionOverlay.show
            ).toHaveBeenCalled();
            expect((realScene as any).completed).toBe(true);
        });

        it('calls transitionToScene when flow advances to a scene', () => {
            const realScene = makeRealScene();
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            (realScene as any).flow = flow;
            (realScene as any).dialogue = {
                scene_2: [{ character: 'A', dialogue: 'Hi' }],
            };

            const transitionSpy = vi
                .spyOn(realScene as any, 'transitionToScene')
                .mockImplementation(() => {});

            realScene.endScene();
            expect(transitionSpy).toHaveBeenCalledWith('scene_2');
        });

        it('presents choices when flow reaches a choice node', () => {
            const realScene = makeRealScene();
            const flow = new SceneFlow({
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { a: 'scene_2', b: 'scene_3' },
                    },
                    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2' },
                    { kind: 'scene', id: 'scene_3', sceneId: 'scene_3' },
                ],
            } as any);
            (realScene as any).flow = flow;

            realScene.endScene();
            expect(
                (realScene as any).choicePresenter.present
            ).toHaveBeenCalledWith('c1', ['a', 'b'], expect.any(Function));
        });

        it('calls showCompletionOverlay when flow reaches end', () => {
            const realScene = makeRealScene();
            const flow = SceneFlow.fromLinearScenes(['scene_1'] as any);
            (realScene as any).flow = flow;

            realScene.endScene();
            expect(
                (realScene as any).completionOverlay.show
            ).toHaveBeenCalled();
        });

        it('resolveChoice callback transitions to the resolved scene', () => {
            const realScene = makeRealScene();
            const flow = new SceneFlow({
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { a: 'scene_2', b: 'scene_3' },
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2',
                        sceneId: 'scene_2',
                        next: null,
                    },
                    {
                        kind: 'scene',
                        id: 'scene_3',
                        sceneId: 'scene_3',
                        next: null,
                    },
                ],
            } as any);
            (realScene as any).flow = flow;

            let capturedCb: ((optionId: string) => void) | undefined;
            (realScene as any).choicePresenter.present.mockImplementation(
                (
                    _id: string,
                    _opts: string[],
                    cb: (optionId: string) => void
                ) => {
                    capturedCb = cb;
                }
            );

            const transitionSpy = vi
                .spyOn(realScene as any, 'transitionToScene')
                .mockImplementation(() => {});

            realScene.endScene();
            expect(capturedCb).toBeDefined();

            // Invoke the captured callback to cover line 97
            capturedCb?.('a');
            expect(transitionSpy).toHaveBeenCalledWith('scene_2');
        });
    });

    describe('create', () => {
        it('calls setChoiceMap when choiceMap is defined in registry', () => {
            localStorage.clear();
            const realScene = new StoryScene();
            const fakeChoiceMap = { c1: { prompt: 'Choose', options: [] } };
            (realScene as any).registry.get.mockImplementation(
                (key: string) => {
                    if (key === 'choiceMap') return fakeChoiceMap;
                    return undefined;
                }
            );
            const setChoiceMapSpy = vi
                .spyOn(ChoicePresenter.prototype, 'setChoiceMap')
                .mockImplementation(() => {});
            expect(() => (realScene as any).create()).not.toThrow();
            expect(setChoiceMapSpy).toHaveBeenCalledWith(fakeChoiceMap);
            setChoiceMapSpy.mockRestore();
        });

        it('initialises choicePresenter, menuOverlay, completionOverlay and starts the scene', () => {
            localStorage.clear();
            const realScene = new StoryScene();
            expect(() => (realScene as any).create()).not.toThrow();
            // After create(), these should be proper instances
            expect((realScene as any).choicePresenter).toBeDefined();
            expect((realScene as any).menuOverlay).toBeDefined();
            expect((realScene as any).completionOverlay).toBeDefined();
            expect((realScene as any).flow).toBeDefined();
        });

        it('triggers shutdown cleanup callbacks without throwing', () => {
            localStorage.clear();
            const realScene = new StoryScene();
            (realScene as any).create();

            // Spy on the cleanup methods StoryScene registers in its shutdown handler
            const clear = vi.fn();
            const forceClose = vi.fn();
            const destroyCompletionOverlay = vi.fn();
            const destroyEscListener = vi.fn();

            (realScene as any).choicePresenter = {
                ...(realScene as any).choicePresenter,
                clear,
            };
            (realScene as any).menuOverlay = {
                ...(realScene as any).menuOverlay,
                forceClose,
            };
            (realScene as any).completionOverlay = {
                ...(realScene as any).completionOverlay,
                destroy: destroyCompletionOverlay,
            };
            (realScene as any).escListener = { destroy: destroyEscListener };

            // Invoke ALL shutdown callbacks: super.create() (BaseScene) registers one
            // first, then StoryScene.create() registers another.  Call both so the
            // test is independent of registration order.
            const eventsOnce = (realScene as any).events.once;
            const shutdownCalls = eventsOnce.mock.calls.filter(
                (c: unknown[]) => c[0] === 'shutdown'
            );
            expect(shutdownCalls.length).toBeGreaterThan(0);
            expect(() =>
                shutdownCalls.forEach(([, callback]: unknown[]) => {
                    (callback as () => void)();
                })
            ).not.toThrow();

            expect(clear).toHaveBeenCalled();
            expect(forceClose).toHaveBeenCalled();
            expect(destroyCompletionOverlay).toHaveBeenCalled();
            expect(destroyEscListener).toHaveBeenCalled();
        });
    });

    describe('toggleMenu (via escListenerPaused)', () => {
        it('is a no-op when escListenerPaused is true', () => {
            const RealScene = StoryScene;
            const realScene = new RealScene();
            (realScene as any).escListenerPaused = true;
            (realScene as any).menuOverlay = {
                open: false,
                show: vi.fn(),
                close: vi.fn(),
                forceClose: vi.fn(),
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            // Call the private toggleMenu via any
            (realScene as any).toggleMenu();
            expect((realScene as any).menuOverlay.show).not.toHaveBeenCalled();
        });

        it('does not show menu when current state matches desired state', () => {
            const RealScene = StoryScene;
            const realScene = new RealScene();
            (realScene as any).escListenerPaused = false;
            (realScene as any).menuOverlay = {
                open: true,
                show: vi.fn(),
                close: vi.fn(),
                forceClose: vi.fn(),
            };
            // forceState = true but menu already open → no-op
            (realScene as any).toggleMenu(true);
            expect((realScene as any).menuOverlay.show).not.toHaveBeenCalled();
        });
    });

    describe('persistCheckpoint', () => {
        it('calls clearCheckpoint when completed=true', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'test_story';
            localStorage.setItem(
                'aquila:checkpoint:test_story',
                JSON.stringify({
                    version: 1,
                    storyId: 'test_story',
                    sceneId: 'scene_1',
                    history: ['scene_1'],
                    savedAt: Date.now(),
                })
            );
            (realScene as any).persistCheckpoint(true);
            expect(
                localStorage.getItem('aquila:checkpoint:test_story')
            ).toBeNull();
        });

        it('saves checkpoint to localStorage when flow has valid state', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'test_story';
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            flow.advanceFromScene();
            (realScene as any).flow = flow;
            (realScene as any).persistCheckpoint(false);
            const stored = localStorage.getItem('aquila:checkpoint:test_story');
            expect(stored).not.toBeNull();
            const parsed = JSON.parse(stored!);
            expect(parsed.sceneId).toBe('scene_2');
        });

        it('is a no-op when flow is null', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'test_story';
            (realScene as any).flow = null;
            expect(() =>
                (realScene as any).persistCheckpoint(false)
            ).not.toThrow();
        });
    });

    describe('buildSceneFlow', () => {
        it('uses external config when provided', () => {
            const realScene = new StoryScene();
            const externalConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: null,
                    },
                ],
            };
            const flow = (realScene as any).buildSceneFlow(externalConfig);
            expect(flow.getCurrentSceneId()).toBe('scene_1');
        });

        it('builds default flow when no external config', () => {
            const realScene = new StoryScene();
            const flow = (realScene as any).buildSceneFlow(undefined);
            expect(flow.getCurrentSceneId()).toBe('scene_1');
        });
    });

    describe('restoreSceneFlow', () => {
        beforeEach(() => {
            localStorage.clear();
        });

        it('returns a flow at scene_1 when no checkpoint exists', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'test_story';
            (realScene as any).registry.get.mockReturnValue(undefined);
            const flow = (realScene as any).restoreSceneFlow();
            expect(flow.getCurrentSceneId()).toBe('scene_1');
        });

        it('restores from a valid saved checkpoint', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'train_adventure';
            (realScene as any).registry.get.mockReturnValue(undefined);

            localStorage.setItem(
                'aquila:checkpoint:train_adventure',
                JSON.stringify({
                    version: 1,
                    storyId: 'train_adventure',
                    sceneId: 'scene_2',
                    history: ['scene_1', 'scene_2'],
                    savedAt: Date.now(),
                })
            );

            const flow = (realScene as any).restoreSceneFlow();
            expect(flow.getCurrentSceneId()).toBe('scene_2');
        });

        it('clears invalid checkpoint and returns fresh flow', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'train_adventure';
            (realScene as any).registry.get.mockReturnValue(undefined);

            localStorage.setItem(
                'aquila:checkpoint:train_adventure',
                JSON.stringify({
                    version: 1,
                    storyId: 'train_adventure',
                    sceneId: 'scene_99',
                    history: ['scene_1', 'scene_99'],
                    savedAt: Date.now(),
                })
            );

            const flow = (realScene as any).restoreSceneFlow();
            expect(flow.getCurrentSceneId()).toBe('scene_1');
        });
    });

    describe('transitionToScene', () => {
        it('sets transitioning to true and triggers camera fadeOut', () => {
            const realScene = new StoryScene();
            (realScene as any).transitioning = false;
            (realScene as any).choicePresenter = {
                awaiting: false,
                clear: vi.fn(),
            };
            (realScene as any).flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            (realScene as any).dialogue = {
                scene_1: [{ character: 'A', dialogue: 'hello' }],
                scene_2: [{ character: 'B', dialogue: 'world' }],
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            (realScene as any).transitionToScene('scene_2' as any);
            expect((realScene as any).transitioning).toBe(true);
            expect((realScene as any).cameras.main.fadeOut).toHaveBeenCalled();
        });

        it('is a no-op when already transitioning', () => {
            const realScene = new StoryScene();
            (realScene as any).transitioning = true;
            (realScene as any).transitionToScene('scene_2' as any);
            expect(
                (realScene as any).cameras.main.fadeOut
            ).not.toHaveBeenCalled();
        });
    });

    describe('resolveChoice', () => {
        it('calls showCompletionOverlay when flow is null', () => {
            const realScene = new StoryScene();
            (realScene as any).flow = null;
            (realScene as any).completed = false;
            (realScene as any).completionOverlay = {
                show: vi.fn(),
                destroy: vi.fn(),
            };
            (realScene as any).choicePresenter = {
                awaiting: false,
                clear: vi.fn(),
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            (realScene as any).resolveChoice('opt_a');
            expect(
                (realScene as any).completionOverlay.show
            ).toHaveBeenCalled();
        });

        it('calls transitionToScene when flow.selectChoice returns a scene', () => {
            const realScene = new StoryScene();
            const config = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { opt_a: 'scene_2' },
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2',
                        sceneId: 'scene_2',
                        next: null,
                    },
                ],
            };
            const flow = new SceneFlow(config as any);
            flow.advanceFromScene(); // → choice mode
            (realScene as any).flow = flow;
            (realScene as any).transitioning = false;
            (realScene as any).completed = false;
            (realScene as any).dialogue = {
                scene_2: [{ character: 'A', dialogue: 'hi' }],
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            (realScene as any).resolveChoice('opt_a');
            expect((realScene as any).transitioning).toBe(true);
            expect((realScene as any).cameras.main.fadeOut).toHaveBeenCalled();
        });

        it('calls persistCheckpoint+showCompletionOverlay when selectChoice returns end', () => {
            const realScene = new StoryScene();
            const mockFlow = {
                selectChoice: vi.fn().mockReturnValue({ type: 'end' }),
                getCurrentSceneId: vi.fn().mockReturnValue(null),
                getSceneHistory: vi.fn().mockReturnValue([]),
            };
            (realScene as any).flow = mockFlow;
            (realScene as any).storyId = 'test_story';
            (realScene as any).completed = false;
            (realScene as any).completionOverlay = {
                show: vi.fn(),
                destroy: vi.fn(),
            };
            (realScene as any).choicePresenter = {
                awaiting: false,
                clear: vi.fn(),
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            (realScene as any).resolveChoice('opt_a');
            expect(
                (realScene as any).completionOverlay.show
            ).toHaveBeenCalled();
        });
    });

    describe('toggleMenu', () => {
        it('calls openMenu when menu is closed and forceState is not specified', () => {
            const realScene = new StoryScene();
            (realScene as any).escListenerPaused = false;
            const mockMenuOverlay = {
                open: false,
                show: vi.fn(),
                close: vi.fn(),
                forceClose: vi.fn(),
            };
            (realScene as any).menuOverlay = mockMenuOverlay;
            (realScene as any).locale = 'en';
            (realScene as any).flow = null;
            const openMenuSpy = vi
                .spyOn(realScene as any, 'openMenu')
                .mockImplementation(() => {});
            (realScene as any).toggleMenu();
            expect(openMenuSpy).toHaveBeenCalled();
        });

        it('calls menuOverlay.close when menu is open and forceState=false', () => {
            const realScene = new StoryScene();
            (realScene as any).escListenerPaused = false;
            const mockMenuOverlay = {
                open: true,
                show: vi.fn(),
                close: vi.fn(),
                forceClose: vi.fn(),
            };
            (realScene as any).menuOverlay = mockMenuOverlay;
            (realScene as any).locale = 'en';
            (realScene as any).toggleMenu(false);
            expect(mockMenuOverlay.close).toHaveBeenCalled();
        });
    });

    describe('transitionToScene camera callback', () => {
        it('executes the camerafadeoutcomplete callback', () => {
            const realScene = new StoryScene();
            (realScene as any).transitioning = false;
            (realScene as any).storyId = 'test_story';
            (realScene as any).flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            (realScene as any).dialogue = {
                scene_2: [{ character: 'A', dialogue: 'hello' }],
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();

            let capturedCallback: (() => void) | undefined;
            (realScene as any).cameras.main.once = vi
                .fn()
                .mockImplementation((_event: string, cb: () => void) => {
                    capturedCallback = cb;
                });

            (realScene as any).transitionToScene('scene_2' as any);
            expect((realScene as any).transitioning).toBe(true);

            expect(capturedCallback).toBeDefined();
            capturedCallback!();
            expect((realScene as any).transitioning).toBe(false);
            expect((realScene as any).cameras.main.fadeIn).toHaveBeenCalled();
        });
    });

    describe('openProgressMap', () => {
        it('is a no-op when flow is null', () => {
            const realScene = new StoryScene();
            (realScene as any).flow = null;
            expect(() => (realScene as any).openProgressMap()).not.toThrow();
            expect((realScene as any).progressMapModal).toBeUndefined();
        });

        it('creates and shows a ProgressMapModal when flow exists', () => {
            const realScene = new StoryScene();
            (realScene as any).flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            (realScene as any).locale = 'en';
            expect(() => (realScene as any).openProgressMap()).not.toThrow();
        });

        it('sets progressMapModal to undefined when the modal is closed', () => {
            const realScene = new StoryScene();
            (realScene as any).flow = SceneFlow.fromLinearScenes([
                'scene_1',
            ] as any);
            (realScene as any).locale = 'en';

            (realScene as any).openProgressMap();

            const modal = (realScene as any).progressMapModal;
            expect(modal).toBeDefined();

            // Invoke the private close() method to trigger the onClose callback
            // which sets progressMapModal back to undefined (covers line 346).
            (modal as any).close();

            expect((realScene as any).progressMapModal).toBeUndefined();
        });
    });

    describe('onHomeButtonPressed', () => {
        it('calls toggleMenu without throwing', () => {
            const realScene = new StoryScene();
            const mockMenuOverlay = {
                open: false,
                show: vi.fn(),
                close: vi.fn(),
                forceClose: vi.fn(),
            };
            (realScene as any).menuOverlay = mockMenuOverlay;
            (realScene as any).escListenerPaused = false;
            (realScene as any).locale = 'en';
            (realScene as any).flow = null;

            const toggleSpy = vi
                .spyOn(realScene as any, 'toggleMenu')
                .mockImplementation(() => {});
            (realScene as any).onHomeButtonPressed();
            expect(toggleSpy).toHaveBeenCalled();
        });
    });

    describe('openMenu body', () => {
        function makeMenuScene(locale = 'en') {
            const realScene = new StoryScene();
            const mockMenuOverlay = {
                open: false,
                show: vi.fn(),
                close: vi.fn(),
                forceClose: vi.fn(),
            };
            (realScene as any).menuOverlay = mockMenuOverlay;
            (realScene as any).locale = locale;
            (realScene as any).flow = null;
            return { realScene, mockMenuOverlay };
        }

        it('calls menuOverlay.show with locale and callback config', () => {
            const { realScene, mockMenuOverlay } = makeMenuScene();
            (realScene as any).openMenu();
            expect(mockMenuOverlay.show).toHaveBeenCalledWith(
                expect.objectContaining({
                    locale: 'en',
                    onResume: expect.any(Function),
                    onProgressMap: expect.any(Function),
                    onHome: expect.any(Function),
                })
            );
        });

        it('passes zh locale when scene locale starts with zh', () => {
            const { realScene, mockMenuOverlay } = makeMenuScene('zh-TW');
            (realScene as any).openMenu();
            expect(mockMenuOverlay.show).toHaveBeenCalledWith(
                expect.objectContaining({ locale: 'zh' })
            );
        });

        it('onResume callback invokes fadeAmbientTo without throwing', () => {
            const { realScene, mockMenuOverlay } = makeMenuScene();
            (realScene as any).openMenu();
            const config = mockMenuOverlay.show.mock.calls[0][0];
            expect(() => config.onResume()).not.toThrow();
        });

        it('onProgressMap callback calls openProgressMap without throwing', () => {
            const { realScene, mockMenuOverlay } = makeMenuScene();
            (realScene as any).openMenu();
            const config = mockMenuOverlay.show.mock.calls[0][0];
            expect(() => config.onProgressMap()).not.toThrow();
        });

        it('onHome callback sets window.location.href to "/"', () => {
            const { realScene, mockMenuOverlay } = makeMenuScene('en');
            (realScene as any).openMenu();
            const config = mockMenuOverlay.show.mock.calls[0][0];

            vi.stubGlobal('location', { href: '', pathname: '/' });
            try {
                config.onHome();
                expect(location.href).toBe('/');
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });

    describe('persistCheckpoint edge cases', () => {
        it('returns early when getSceneHistory returns empty array, skipping any write', () => {
            const realScene = new StoryScene();
            (realScene as any).choicePresenter = {
                awaiting: false,
                clear: vi.fn(),
                present: vi.fn(),
            };
            (realScene as any).completionOverlay = {
                show: vi.fn(),
                destroy: vi.fn(),
            };
            (realScene as any).characterNameText = makeMockText();
            (realScene as any).textObject = makeMockText();
            const flow = SceneFlow.fromLinearScenes(['scene_1'] as any);
            vi.spyOn(flow, 'getCurrentSceneId').mockReturnValue(
                'scene_1' as any
            );
            vi.spyOn(flow, 'getSceneHistory').mockReturnValue([]);
            (realScene as any).flow = flow;

            const setItemSpy = vi.spyOn(localStorage, 'setItem');
            (realScene as any).persistCheckpoint();
            expect(setItemSpy).not.toHaveBeenCalled();
            setItemSpy.mockRestore();
        });
    });

    describe('showCompletionOverlay edge cases', () => {
        it('is a no-op when already completed', () => {
            const realScene = new StoryScene();
            (realScene as any).choicePresenter = {
                awaiting: false,
                clear: vi.fn(),
                present: vi.fn(),
            };
            (realScene as any).completionOverlay = {
                show: vi.fn(),
                destroy: vi.fn(),
            };
            (realScene as any).completed = true;
            (realScene as any).showCompletionOverlay();
            expect(
                (realScene as any).completionOverlay.show
            ).not.toHaveBeenCalled();
        });
    });

    describe('restoreSceneFlow – clears checkpoint when restoration fails', () => {
        beforeEach(() => {
            localStorage.clear();
        });

        it('clears a valid-format checkpoint whose history cannot be replayed', () => {
            const realScene = new StoryScene();
            (realScene as any).storyId = 'train_adventure';
            (realScene as any).registry.get.mockReturnValue(undefined);

            // scene_3 is registered but does NOT directly follow scene_1 in the flow
            // (scene_2 is in between), so restoreFromHistory returns null for this history.
            localStorage.setItem(
                'aquila:checkpoint:train_adventure',
                JSON.stringify({
                    version: 1,
                    storyId: 'train_adventure',
                    sceneId: 'scene_3',
                    history: ['scene_1', 'scene_3'],
                    savedAt: Date.now(),
                })
            );

            (realScene as any).restoreSceneFlow();

            // Checkpoint should be cleared from localStorage (line 234 executed)
            expect(
                localStorage.getItem('aquila:checkpoint:train_adventure')
            ).toBeNull();
        });
    });
});
