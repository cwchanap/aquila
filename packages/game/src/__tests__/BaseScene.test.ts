import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseScene } from '../BaseScene';
import { makeMockText } from './phaserMock';
import type { DialogueMap } from '../dialogue/types';
import type { SceneId } from '../SceneDirectory';

// ── Minimal concrete subclass ──────────────────────────────────────────────
class TestScene extends BaseScene {
    /** Tracks calls to endScene() */
    endSceneCalled = false;

    constructor() {
        super('TestScene');
        // Pre-wire mock text objects so showDialogue() works without full create()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).characterNameText = makeMockText();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).textObject = makeMockText();
    }

    override endScene() {
        this.endSceneCalled = true;
    }

    // ── Expose protected state for assertions ──────────────────────────────

    getIndex(): number {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).currentDialogueIndex;
    }

    getSectionKeyPub(): SceneId {
        return this.getSectionKey();
    }

    getLocale(): string {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).locale;
    }

    getHomeButtonLabelPub(): string {
        return this.getHomeButtonLabel();
    }

    onCrossSectionRetreatPub(): boolean {
        return this.onCrossSectionRetreat();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setDialogue(map: DialogueMap) {
        (this as any).dialogue = map;
    }
    setIndex(n: number) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).currentDialogueIndex = n;
    }
    setLocale(l: string) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).locale = l;
    }
    getTextObj() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).textObject;
    }
    getNameObj() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).characterNameText;
    }
    getScaleObj() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).scale;
    }
    getKeyboard() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).input.keyboard;
    }
}

// ── Fixture dialogue ───────────────────────────────────────────────────────
const twoLineDialogue: DialogueMap = {
    scene_1: [
        { character: 'Alice', dialogue: 'Hello!' },
        { character: 'Bob', dialogue: 'World!' },
    ],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BaseScene', () => {
    let scene: TestScene;

    beforeEach(() => {
        scene = new TestScene();
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('creates an instance of BaseScene', () => {
            expect(scene).toBeInstanceOf(BaseScene);
        });

        it('initialises dialogue index to 0', () => {
            expect(scene.getIndex()).toBe(0);
        });

        it('defaults to English locale', () => {
            expect(scene.getLocale()).toBe('en');
        });

        it('defaults sectionKey to scene_1', () => {
            expect(scene.getSectionKeyPub()).toBe('scene_1');
        });
    });

    describe('getHomeButtonLabel', () => {
        it('returns "🏠 Home" for English locale', () => {
            expect(scene.getHomeButtonLabelPub()).toBe('🏠 Home');
        });

        it('returns "🏠 首頁" for zh locale', () => {
            scene.setLocale('zh');
            expect(scene.getHomeButtonLabelPub()).toBe('🏠 首頁');
        });

        it('returns "🏠 首頁" for zh-TW locale', () => {
            scene.setLocale('zh-TW');
            expect(scene.getHomeButtonLabelPub()).toBe('🏠 首頁');
        });
    });

    describe('onCrossSectionRetreat', () => {
        it('returns false by default (base class no-op)', () => {
            expect(scene.onCrossSectionRetreatPub()).toBe(false);
        });
    });

    describe('loadDialogue', () => {
        it('stores the dialogue map', () => {
            scene.loadDialogue(twoLineDialogue);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            expect((scene as any).dialogue).toBe(twoLineDialogue);
        });

        it('resets the dialogue index to 0', () => {
            scene.loadDialogue(twoLineDialogue);
            scene.advanceDialogue();
            expect(scene.getIndex()).toBe(1);
            scene.loadDialogue(twoLineDialogue);
            expect(scene.getIndex()).toBe(0);
        });
    });

    describe('showDialogue', () => {
        it('sets character name and dialogue text for the current entry', () => {
            scene.setDialogue(twoLineDialogue);
            scene.showDialogue();
            expect(scene.getNameObj().setText).toHaveBeenCalledWith('Alice');
            expect(scene.getTextObj().setText).toHaveBeenCalledWith('Hello!');
        });

        it('shows the second entry after index is 1', () => {
            scene.setDialogue(twoLineDialogue);
            scene.setIndex(1);
            scene.showDialogue();
            expect(scene.getNameObj().setText).toHaveBeenCalledWith('Bob');
            expect(scene.getTextObj().setText).toHaveBeenCalledWith('World!');
        });

        it('calls endScene() when past the last entry', () => {
            scene.setDialogue(twoLineDialogue);
            scene.setIndex(2); // out of bounds
            scene.showDialogue();
            expect(scene.endSceneCalled).toBe(true);
        });

        it('calls endScene() when dialogue map is empty', () => {
            scene.setDialogue({});
            scene.showDialogue();
            expect(scene.endSceneCalled).toBe(true);
        });

        it('substitutes "Li Jie" for MainCharacter speaker in English', () => {
            scene.setDialogue({
                scene_1: [{ character: 'MainCharacter', dialogue: 'I speak.' }],
            });
            scene.showDialogue();
            expect(scene.getNameObj().setText).toHaveBeenCalledWith('Li Jie');
        });

        it('substitutes "李杰" for MainCharacter speaker in Chinese', () => {
            scene.setLocale('zh');
            scene.setDialogue({
                scene_1: [{ character: 'MainCharacter', dialogue: 'I speak.' }],
            });
            scene.showDialogue();
            expect(scene.getNameObj().setText).toHaveBeenCalledWith('李杰');
        });
    });

    describe('advanceDialogue', () => {
        it('increments the dialogue index', () => {
            scene.setDialogue(twoLineDialogue);
            scene.advanceDialogue();
            expect(scene.getIndex()).toBe(1);
        });

        it('shows the next line after advancing', () => {
            scene.setDialogue(twoLineDialogue);
            scene.advanceDialogue();
            expect(scene.getTextObj().setText).toHaveBeenLastCalledWith(
                'World!'
            );
        });

        it('calls endScene() when advancing past the last entry', () => {
            scene.setDialogue({
                scene_1: [{ character: 'Alice', dialogue: 'Only line' }],
            });
            scene.advanceDialogue(); // moves to index 1 → endScene
            expect(scene.endSceneCalled).toBe(true);
        });
    });

    describe('retreatDialogue', () => {
        it('does not decrement below 0', () => {
            scene.setDialogue(twoLineDialogue);
            scene.retreatDialogue();
            expect(scene.getIndex()).toBe(0);
        });

        it('decrements the index when index > 0', () => {
            scene.setDialogue(twoLineDialogue);
            scene.setIndex(1);
            scene.retreatDialogue();
            expect(scene.getIndex()).toBe(0);
        });

        it('shows the previous line after retreating', () => {
            scene.setDialogue(twoLineDialogue);
            scene.setIndex(1);
            scene.retreatDialogue();
            expect(scene.getTextObj().setText).toHaveBeenLastCalledWith(
                'Hello!'
            );
        });
    });

    describe('create', () => {
        it('runs without throwing', () => {
            expect(() => scene.create()).not.toThrow();
        });

        it('registers a resize listener on scale', () => {
            scene.create();
            expect(scene.getScaleObj().on).toHaveBeenCalledWith(
                'resize',
                expect.any(Function),
                scene
            );
        });

        it('registers Enter keyboard listener', () => {
            scene.create();
            expect(scene.getKeyboard().on).toHaveBeenCalledWith(
                'keydown-ENTER',
                expect.any(Function),
                scene
            );
        });

        it('registers Backspace keyboard listener', () => {
            scene.create();
            expect(scene.getKeyboard().on).toHaveBeenCalledWith(
                'keydown-BACKSPACE',
                expect.any(Function),
                scene
            );
        });

        it('creates dialogue UI elements via scene.add', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const addSpy = (scene as any).add;
            scene.create();
            expect(addSpy.text).toHaveBeenCalled();
            expect(addSpy.rectangle).toHaveBeenCalled();
        });
    });
});
