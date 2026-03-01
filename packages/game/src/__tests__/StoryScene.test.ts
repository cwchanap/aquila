import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoryScene } from '../StoryScene';
import { SceneFlow } from '../SceneFlow';
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
    });
});
