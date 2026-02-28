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
});
