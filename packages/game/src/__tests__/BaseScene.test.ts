import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseScene } from '../BaseScene';
import { makeMockText, makeMockImage, makeMockGraphics } from './phaserMock';
import type { DialogueMap } from '../dialogue/types';
import type { SceneId } from '../SceneDirectory';
import { CharacterId } from '../characters/CharacterDirectory';
import { Character } from '../characters/Character';

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
    getHomeButton() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).homeButton;
    }

    stopAmbientPub(): void {
        this.stopAmbient();
    }

    startAmbientPub(): void {
        this.startAmbient();
    }

    fadeAmbientToPub(target: number, duration?: number): void {
        this.fadeAmbientTo(target, duration);
    }

    applyAmbientForScenePub(sceneId: SceneId): void {
        this.applyAmbientForScene(sceneId);
    }

    setSectionPub(key: SceneId): void {
        this.setSection(key);
    }

    onHomeButtonHoverChangePub(hovering: boolean): void {
        this.onHomeButtonHoverChange(hovering);
    }

    refreshHomeButtonLabelPub(): void {
        this.refreshHomeButtonLabel();
    }

    getOverlayRect() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).overlayRect;
    }

    getBgGraphics() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (this as any).bgGraphics;
    }

    setBgGraphics(g: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this as any).bgGraphics = g;
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

    describe('showDialogue with characterId', () => {
        it('resolves character name from CharacterDirectory when characterId is set', () => {
            scene.setDialogue({
                scene_1: [
                    {
                        characterId: CharacterId.Narrator,
                        dialogue: 'Narrated line',
                    },
                ],
            });
            scene.showDialogue();
            // CharacterDirectory.getById should return an info object with a name
            expect(scene.getNameObj().setText).toHaveBeenCalledWith(
                expect.any(String)
            );
            expect(scene.getTextObj().setText).toHaveBeenCalledWith(
                'Narrated line'
            );
        });

        it('falls back to characterId string when character not found', () => {
            scene.setDialogue({
                scene_1: [
                    {
                        // Cast unknown id
                        characterId: 'unknown_char' as CharacterId,
                        dialogue: 'Mystery line',
                    },
                ],
            });
            scene.showDialogue();
            expect(scene.getNameObj().setText).toHaveBeenCalledWith(
                'unknown_char'
            );
        });
    });

    describe('showDialogue retry path', () => {
        it('retries when textObject is null (calls time.delayedCall)', () => {
            // Remove pre-wired text objects to force retry
            (scene as any).characterNameText = null;
            (scene as any).textObject = null;
            scene.setDialogue(twoLineDialogue);
            scene.showDialogue();
            // Should schedule a retry via time.delayedCall
            expect((scene as any).time.delayedCall).toHaveBeenCalled();
        });
    });

    describe('audio helpers (no AudioContext in jsdom)', () => {
        it('stopAmbient does not throw when no oscillator exists', () => {
            expect(() => scene.stopAmbientPub()).not.toThrow();
        });

        it('fadeAmbientTo does not throw when no gain node exists', () => {
            expect(() => scene.fadeAmbientToPub(0.005, 300)).not.toThrow();
        });

        it('applyAmbientForScene does not throw when no oscillator exists', () => {
            expect(() =>
                scene.applyAmbientForScenePub('scene_1' as SceneId)
            ).not.toThrow();
        });
    });

    describe('onHomeButtonHoverChange', () => {
        it('calls homeButton.setStyle with dark bg when not hovering', () => {
            scene.create(); // populates homeButton
            const btn = scene.getHomeButton();
            scene.onHomeButtonHoverChangePub(false);
            expect(btn.setStyle).toHaveBeenCalledWith(
                expect.objectContaining({ backgroundColor: '#333333' })
            );
        });

        it('calls homeButton.setStyle with lighter bg when hovering', () => {
            scene.create();
            const btn = scene.getHomeButton();
            scene.onHomeButtonHoverChangePub(true);
            expect(btn.setStyle).toHaveBeenCalledWith(
                expect.objectContaining({ backgroundColor: '#555555' })
            );
        });

        it('does not throw when homeButton is undefined', () => {
            (scene as any).homeButton = undefined;
            expect(() => scene.onHomeButtonHoverChangePub(true)).not.toThrow();
        });
    });

    describe('refreshHomeButtonLabel', () => {
        it('calls homeButton.setText with the label', () => {
            scene.create();
            const btn = scene.getHomeButton();
            vi.clearAllMocks();
            scene.refreshHomeButtonLabelPub();
            expect(btn.setText).toHaveBeenCalledWith('🏠 Home');
        });

        it('does not throw when homeButton is undefined', () => {
            (scene as any).homeButton = undefined;
            expect(() => scene.refreshHomeButtonLabelPub()).not.toThrow();
        });
    });

    describe('setupBackground', () => {
        it('reuses existing bgGraphics (calls clear) on second layout pass', () => {
            scene.create();
            const firstGraphics = scene.getBgGraphics();
            // Trigger another redrawLayout
            (scene as any).redrawLayout();
            // Should call clear() on the existing graphics object
            expect(firstGraphics.clear).toHaveBeenCalled();
        });

        it('creates bgImage when texture exists', () => {
            // Make textures.exists return true for the scene
            (scene as any).textures.exists = vi.fn().mockReturnValue(true);
            scene.create();
            expect((scene as any).add.image).toHaveBeenCalled();
        });
    });

    describe('onHomeButtonPressed', () => {
        it('sets window.location.href to "/"', () => {
            vi.stubGlobal('location', { href: '' });
            try {
                (scene as any).onHomeButtonPressed();
                expect(location.href).toBe('/');
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });

    describe('keydown-BACKSPACE callback', () => {
        it('calls retreatDialogue and preventDefault when triggered', () => {
            scene.create();
            const keyboardMock = (scene as any).input.keyboard;
            const backspaceCalls = (
                keyboardMock.on.mock.calls as unknown[][]
            ).filter(call => call[0] === 'keydown-BACKSPACE');
            expect(backspaceCalls.length).toBeGreaterThan(0);

            scene.setDialogue(twoLineDialogue);
            scene.setIndex(1);

            const callback = backspaceCalls[0][1] as (event: {
                preventDefault?: () => void;
            }) => void;
            const mockEvent = { preventDefault: vi.fn() };
            callback(mockEvent);

            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(scene.getIndex()).toBe(0);
        });
    });

    describe('stopAmbient with existing audio nodes', () => {
        it('stops and disconnects oscillator and gain when they exist', () => {
            const mockOsc = { stop: vi.fn(), disconnect: vi.fn() };
            const mockGain = { disconnect: vi.fn() };
            (scene as any).ambientOsc = mockOsc;
            (scene as any).ambientGain = mockGain;

            scene.stopAmbientPub();

            expect(mockOsc.stop).toHaveBeenCalled();
            expect(mockOsc.disconnect).toHaveBeenCalled();
            expect(mockGain.disconnect).toHaveBeenCalled();
            expect((scene as any).ambientOsc).toBeUndefined();
            expect((scene as any).ambientGain).toBeUndefined();
        });
    });

    describe('fadeAmbientTo with existing audio nodes', () => {
        it('ramps gain to target when audio context and gain exist', () => {
            const mockParam = {
                value: 0.1,
                cancelScheduledValues: vi.fn(),
                setValueAtTime: vi.fn(),
                linearRampToValueAtTime: vi.fn(),
            };
            (scene as any).ambientGain = { gain: mockParam };
            (scene as any).beepCtx = { currentTime: 0 };

            scene.fadeAmbientToPub(0.5, 500);

            expect(mockParam.cancelScheduledValues).toHaveBeenCalledWith(0);
            expect(mockParam.setValueAtTime).toHaveBeenCalledWith(0.1, 0);
            expect(mockParam.linearRampToValueAtTime).toHaveBeenCalledWith(
                0.5,
                0.5
            );
        });
    });

    describe('getOrCreateAudioContext creates beepCtx when AudioContext is available (lines 59-60)', () => {
        it('calls new AudioContext() and stores result in beepCtx', () => {
            // Use a regular function constructor (arrow functions cannot be used with `new`)
            function FakeAudioContext(this: object) {}
            vi.stubGlobal('AudioContext', FakeAudioContext);
            // Ensure beepCtx is not pre-set so getOrCreateAudioContext creates it
            (scene as any).beepCtx = undefined;

            const ctx = (scene as any).getOrCreateAudioContext();

            expect(ctx).toBeInstanceOf(FakeAudioContext);
            expect((scene as any).beepCtx).toBe(ctx);
            vi.unstubAllGlobals();
        });
    });

    describe('startAmbient with mocked AudioContext', () => {
        it('creates oscillator and starts it when audio context is available', () => {
            const mockOsc = {
                type: '',
                frequency: { setValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
            };
            const mockGain = {
                gain: { value: 0 },
                connect: vi.fn(),
            };
            // Pre-set beepCtx so getOrCreateAudioContext() returns it immediately
            const mockCtx = {
                createOscillator: vi.fn().mockReturnValue(mockOsc),
                createGain: vi.fn().mockReturnValue(mockGain),
                destination: {},
                currentTime: 0,
            };
            (scene as any).beepCtx = mockCtx;

            scene.startAmbientPub();

            expect(mockCtx.createOscillator).toHaveBeenCalled();
            expect(mockCtx.createGain).toHaveBeenCalled();
            expect(mockOsc.start).toHaveBeenCalled();
        });
    });

    describe('applyAmbientForScene with existing audio nodes', () => {
        it('updates oscillator frequency when ambientOsc and beepCtx exist', () => {
            const mockOsc = { frequency: { setValueAtTime: vi.fn() } };
            (scene as any).ambientOsc = mockOsc;
            (scene as any).beepCtx = { currentTime: 1 };

            scene.applyAmbientForScenePub('scene_1' as SceneId);

            expect(mockOsc.frequency.setValueAtTime).toHaveBeenCalled();
        });
    });

    describe('playBeep with mocked AudioContext', () => {
        it('creates and plays oscillator when audio context is available', () => {
            const mockOsc = {
                type: '',
                frequency: { value: 0 },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
            };
            const mockGain = { gain: { value: 0 }, connect: vi.fn() };
            // Pre-set beepCtx so getOrCreateAudioContext() returns it immediately
            const mockCtx = {
                state: 'running',
                createOscillator: vi.fn().mockReturnValue(mockOsc),
                createGain: vi.fn().mockReturnValue(mockGain),
                destination: {},
                currentTime: 0,
                resume: vi.fn().mockResolvedValue(undefined),
            };
            (scene as any).beepCtx = mockCtx;

            scene.setDialogue(twoLineDialogue);
            scene.advanceDialogue();

            expect(mockCtx.createOscillator).toHaveBeenCalled();
            expect(mockOsc.start).toHaveBeenCalled();
            expect(mockOsc.stop).toHaveBeenCalled();
        });

        it('resumes suspended audio context before playing beep', () => {
            const mockOsc = {
                type: '',
                frequency: { value: 0 },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
            };
            const mockGain = { gain: { value: 0 }, connect: vi.fn() };
            const mockResume = vi.fn().mockResolvedValue(undefined);
            const mockCtx = {
                state: 'suspended',
                createOscillator: vi.fn().mockReturnValue(mockOsc),
                createGain: vi.fn().mockReturnValue(mockGain),
                destination: {},
                currentTime: 0,
                resume: mockResume,
            };
            (scene as any).beepCtx = mockCtx;

            scene.setDialogue(twoLineDialogue);
            scene.advanceDialogue();

            expect(mockResume).toHaveBeenCalled();
        });
    });

    describe('setupBackground - additional texture paths', () => {
        it('calls setTexture on bgImage when texture key changes', () => {
            const existingImage = makeMockImage();
            existingImage.texture = { key: 'old_key' };
            (scene as any).bgImage = existingImage;
            (scene as any).textures.exists = vi.fn().mockReturnValue(true);

            (scene as any).redrawLayout();

            expect(existingImage.setTexture).toHaveBeenCalled();
        });

        it('destroys bgGraphics when switching to texture background', () => {
            const mockGraphics = makeMockGraphics();
            (scene as any).bgGraphics = mockGraphics;
            (scene as any).textures.exists = vi.fn().mockReturnValue(true);

            (scene as any).redrawLayout();

            expect(mockGraphics.destroy).toHaveBeenCalled();
            expect((scene as any).bgGraphics).toBeUndefined();
        });

        it('destroys bgImage when switching from texture to graphics background', () => {
            const existingImage = makeMockImage();
            (scene as any).bgImage = existingImage;
            // textures.exists returns false (the default in mock)

            (scene as any).redrawLayout();

            expect(existingImage.destroy).toHaveBeenCalled();
            expect((scene as any).bgImage).toBeUndefined();
        });

        it('draws horizon line for scene_3', () => {
            (scene as any).sectionKey = 'scene_3';
            const mockGraphics = makeMockGraphics();
            (scene as any).add.graphics = vi.fn().mockReturnValue(mockGraphics);

            (scene as any).redrawLayout();

            expect(mockGraphics.lineStyle).toHaveBeenCalled();
            expect(mockGraphics.strokeLineShape).toHaveBeenCalled();
        });

        it('draws horizon line for scene_4a', () => {
            (scene as any).sectionKey = 'scene_4a';
            const mockGraphics = makeMockGraphics();
            (scene as any).add.graphics = vi.fn().mockReturnValue(mockGraphics);

            (scene as any).redrawLayout();

            expect(mockGraphics.lineStyle).toHaveBeenCalled();
        });
    });

    describe('home button event handlers via callbacks', () => {
        it('pointerover callback triggers hover=true styling', () => {
            scene.create();
            const homeBtn = scene.getHomeButton();
            const pointeroverCall = (homeBtn.on.mock.calls as unknown[][]).find(
                call => call[0] === 'pointerover'
            );
            expect(pointeroverCall).toBeDefined();
            const callback = pointeroverCall![1] as () => void;
            callback();
            expect(homeBtn.setStyle).toHaveBeenCalledWith(
                expect.objectContaining({ backgroundColor: '#555555' })
            );
        });

        it('pointerout callback triggers hover=false styling', () => {
            scene.create();
            const homeBtn = scene.getHomeButton();
            const pointeroutCall = (homeBtn.on.mock.calls as unknown[][]).find(
                call => call[0] === 'pointerout'
            );
            expect(pointeroutCall).toBeDefined();
            const callback = pointeroutCall![1] as () => void;
            callback();
            expect(homeBtn.setStyle).toHaveBeenCalledWith(
                expect.objectContaining({ backgroundColor: '#333333' })
            );
        });

        it('pointerup callback navigates to home', () => {
            vi.stubGlobal('location', { href: '' });
            try {
                scene.create();
                const homeBtn = scene.getHomeButton();
                const pointerupCall = (
                    homeBtn.on.mock.calls as unknown[][]
                ).find(call => call[0] === 'pointerup');
                expect(pointerupCall).toBeDefined();
                const callback = pointerupCall![1] as () => void;
                callback();
                expect(location.href).toBe('/');
            } finally {
                vi.unstubAllGlobals();
            }
        });
    });

    describe('showDialogue - max retries exceeded', () => {
        it('logs error and resets retry count at max retries', () => {
            const consoleSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            (scene as any).characterNameText = null;
            (scene as any).textObject = null;
            (scene as any).dialogueRetryCount = 10; // MAX_DIALOGUE_RETRIES

            scene.setDialogue(twoLineDialogue);
            scene.showDialogue();

            expect(consoleSpy).toHaveBeenCalledWith(
                '[BaseScene] Dialogue UI not ready after maximum retries'
            );
            expect((scene as any).dialogueRetryCount).toBe(0);
            consoleSpy.mockRestore();
        });
    });

    describe('showDialogue - retry delayedCall callback', () => {
        it('calls showDialogue when generation matches after delayedCall fires', () => {
            (scene as any).characterNameText = null;
            (scene as any).textObject = null;

            let capturedCb: (() => void) | null = null;
            (scene as any).time.delayedCall = vi
                .fn()
                .mockImplementation((_delay: number, cb: () => void) => {
                    capturedCb = cb;
                });

            scene.setDialogue(twoLineDialogue);
            scene.showDialogue();

            expect(capturedCb).not.toBeNull();

            // Restore text objects so showDialogue succeeds on retry
            (scene as any).characterNameText = makeMockText();
            (scene as any).textObject = makeMockText();

            capturedCb!();

            expect(scene.getTextObj().setText).toHaveBeenCalledWith('Hello!');
        });
    });

    describe('showDialogue - characterRef path', () => {
        it('uses characterRef info name when characterRef is provided', () => {
            const char = new Character(CharacterId.LiJie);
            scene.setDialogue({
                scene_1: [{ characterRef: char, dialogue: 'Story text' }],
            });
            scene.showDialogue();
            expect(scene.getNameObj().setText).toHaveBeenCalledWith('李杰');
            expect(scene.getTextObj().setText).toHaveBeenCalledWith(
                'Story text'
            );
        });
    });

    describe('retreatDialogue - onCrossSectionRetreat handled path', () => {
        it('calls showDialogue when onCrossSectionRetreat returns true', () => {
            class HandledScene extends TestScene {
                protected override onCrossSectionRetreat(): boolean {
                    return true;
                }
            }
            const handledScene = new HandledScene();
            handledScene.setDialogue(twoLineDialogue);
            handledScene.setIndex(0);

            const showSpy = vi.spyOn(handledScene, 'showDialogue');
            handledScene.retreatDialogue();

            expect(showSpy).toHaveBeenCalled();
        });
    });

    describe('updateDialogueUI overlayRect reuse', () => {
        it('updates existing overlayRect on second redrawLayout', () => {
            scene.create();
            const overlayRect = scene.getOverlayRect();
            expect(overlayRect).toBeDefined();

            vi.clearAllMocks();
            (scene as any).redrawLayout();

            // overlayRect.setPosition should be called (reuse branch)
            expect(overlayRect.setPosition).toHaveBeenCalled();
        });
    });

    describe('loadDialogue - delayedCall callback', () => {
        it('calls showDialogue when generation matches when callback fires', () => {
            let capturedCb: (() => void) | null = null;
            (scene as any).time.delayedCall = vi
                .fn()
                .mockImplementation((_delay: number, cb: () => void) => {
                    capturedCb = cb;
                });

            scene.loadDialogue(twoLineDialogue);

            expect(capturedCb).not.toBeNull();

            // Fire the captured callback – generation should match
            capturedCb!();

            // showDialogue was called and set the text
            expect(scene.getTextObj().setText).toHaveBeenCalledWith('Hello!');
        });

        it('skips showDialogue when generation has changed before callback fires', () => {
            const callbacks: (() => void)[] = [];
            (scene as any).time.delayedCall = vi
                .fn()
                .mockImplementation((_delay: number, cb: () => void) => {
                    callbacks.push(cb);
                });

            scene.loadDialogue(twoLineDialogue); // captures callbacks[0] at gen N
            scene.loadDialogue(twoLineDialogue); // captures callbacks[1] at gen N+1

            vi.clearAllMocks();
            callbacks[0](); // stale – gen N no longer matches current gen

            // setText should NOT have been called by the stale callback
            expect(scene.getTextObj().setText).not.toHaveBeenCalled();
        });
    });
});
