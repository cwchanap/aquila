import Phaser from 'phaser';
import { CharacterDirectory } from './characters/CharacterDirectory';
import { SceneDirectory, type SceneId } from './SceneDirectory';
import type { DialogueEntry, DialogueMap } from './dialogue/types';

export class BaseScene extends Phaser.Scene {
    protected dialogue: DialogueMap = {};
    protected currentDialogueIndex: number = 0;
    protected textObject?: Phaser.GameObjects.Text;
    protected characterNameText?: Phaser.GameObjects.Text;
    protected dialogueBox?: Phaser.GameObjects.Rectangle;
    protected hintText?: Phaser.GameObjects.Text;
    protected homeButton?: Phaser.GameObjects.Text;
    protected playerName: string = 'Player';
    protected locale: string = 'en';
    protected bgGraphics?: Phaser.GameObjects.Graphics;
    protected bgImage?: Phaser.GameObjects.Image;
    protected overlayRect?: Phaser.GameObjects.Rectangle;
    protected beepCtx?: AudioContext;
    protected ambientOsc?: OscillatorNode;
    protected ambientGain?: GainNode;
    // Active story section key driven by SceneDirectory.
    protected sectionKey: SceneId = SceneDirectory.defaultStart;

    constructor(key: string) {
        super(key);
    }

    // Helper to switch sections from a derived StoryScene
    protected setSection(nextKey: SceneId) {
        this.sectionKey = nextKey;
        this.currentDialogueIndex = 0;
        // Rebuild the layout for the new section (background, etc.)
        this.redrawLayout();
        this.applyAmbientForScene(nextKey);
        // Show first dialogue line of the new section
        this.showDialogue();
    }

    protected startAmbient() {
        try {
            const AudioCtor =
                typeof AudioContext !== 'undefined'
                    ? AudioContext
                    : (
                          window as unknown as {
                              webkitAudioContext?: typeof AudioContext;
                          }
                      ).webkitAudioContext;
            if (!AudioCtor) return;
            if (!this.beepCtx) {
                this.beepCtx = new AudioCtor();
            }
            const ctx = this.beepCtx!;
            // Create a very low volume ambient hum
            this.ambientOsc = ctx.createOscillator();
            this.ambientGain = ctx.createGain();
            this.ambientOsc.type = 'sine';
            // Different base tones per scene for mood
            const sKey = this.getSectionKey();
            const freq = SceneDirectory.getAmbientFrequency(sKey);
            this.ambientOsc.frequency.value = freq;
            this.ambientGain.gain.value = 0.004; // very quiet
            this.ambientOsc.connect(this.ambientGain);
            this.ambientGain.connect(ctx.destination);
            this.ambientOsc.start();
            this.applyAmbientForScene(sKey);
        } catch {
            // ignore if audio unavailable or blocked
        }
    }

    protected stopAmbient() {
        try {
            if (this.ambientOsc) {
                this.ambientOsc.stop();
                this.ambientOsc.disconnect();
                this.ambientOsc = undefined;
            }
            if (this.ambientGain) {
                this.ambientGain.disconnect();
                this.ambientGain = undefined;
            }
        } catch {
            // ignore
        }
    }

    protected fadeAmbientTo(target: number, durationMs: number = 300) {
        try {
            if (!this.ambientGain || !this.beepCtx) return;
            const now = this.beepCtx.currentTime;
            const param = this.ambientGain.gain;
            param.cancelScheduledValues(now);
            // Ensure ramp starts from current value
            param.setValueAtTime(param.value, now);
            param.linearRampToValueAtTime(target, now + durationMs / 1000);
        } catch {
            // ignore
        }
    }

    preload() {
        // Shared preload logic, e.g., load fonts, UI assets
    }

    create() {
        // Initialize runtime context from registry
        const regLocale = this.registry.get('locale');
        if (typeof regLocale === 'string') this.locale = regLocale;

        // Build scene layout (background + dialogue UI)
        this.redrawLayout();

        // Listen for resize events to update layout
        this.scale.on('resize', this.redrawLayout, this);

        // Require Enter key to advance dialogue
        this.input.keyboard?.on('keydown-ENTER', this.advanceDialogue, this);
        // Allow Backspace to go back to previous dialogue line
        this.input.keyboard?.on(
            'keydown-BACKSPACE',
            (event: KeyboardEvent) => {
                event.preventDefault?.();
                this.retreatDialogue();
            },
            this
        );

        // Start subtle ambient hum (no audio files required)
        this.startAmbient();
        this.events.once('shutdown', () => this.stopAmbient());
    }

    protected redrawLayout = () => {
        this.setupBackground();
        this.updateDialogueUI();
    };

    protected getSectionKey(): SceneId {
        return this.sectionKey;
    }

    protected setupBackground() {
        const width = this.scale.width;
        const height = this.scale.height;

        const sKey = this.getSectionKey();
        const texKey = SceneDirectory.getBackgroundTextureKey(sKey);
        const hasTexture = this.textures.exists(texKey);

        // Use image background if preloaded, else fallback to graphics color fill
        if (hasTexture) {
            if (!this.bgImage) {
                this.bgImage = this.add.image(0, 0, texKey).setOrigin(0.5, 0.5);
                this.bgImage.setDepth(-20);
            } else if (this.bgImage.texture.key !== texKey) {
                // Update the existing image's texture when section changes
                this.bgImage.setTexture(texKey);
            }
            // Position center
            this.bgImage.setPosition(width / 2, height / 2);
            // Scale to cover
            const tex = this.textures
                .get(texKey)
                .getSourceImage() as HTMLImageElement;
            const scale = Math.max(width / tex.width, height / tex.height);
            this.bgImage.setScale(scale);

            // Ensure any graphics fallback is removed
            if (this.bgGraphics) {
                this.bgGraphics.destroy();
                this.bgGraphics = undefined;
            }
        } else {
            // Fallback: simple colored background
            if (this.bgImage) {
                this.bgImage.destroy();
                this.bgImage = undefined;
            }
            if (this.bgGraphics) {
                this.bgGraphics.clear();
            } else {
                this.bgGraphics = this.add.graphics();
                this.bgGraphics.setDepth(-20);
            }
            const g = this.bgGraphics;
            const color = SceneDirectory.getFallbackColor(sKey);

            g.fillStyle(color, 1);
            g.fillRect(0, 0, width, height);

            // Simple horizon line for otherworld scene
            if (sKey === 'scene_3' || sKey === 'scene_4a') {
                g.lineStyle(2, 0xaa0000, 0.6);
                g.strokeLineShape(
                    new Phaser.Geom.Line(
                        0,
                        Math.floor(height * 0.6),
                        width,
                        Math.floor(height * 0.6)
                    )
                );
            }
        }
    }

    updateDialogueUI() {
        const width = this.scale.width;
        const height = this.scale.height;
        const boxHeight = 180; // Increased height for better visibility
        const padding = 24;
        const bottomMargin = 20; // Minimal margin to align dialogue box to bottom

        // Clear existing UI elements if they exist
        if (this.dialogueBox) this.dialogueBox.destroy();
        if (this.characterNameText) this.characterNameText.destroy();
        if (this.textObject) this.textObject.destroy();
        if (this.hintText) this.hintText.destroy();
        if (this.homeButton) this.homeButton.destroy();

        // full screen semi-transparent overlay (single instance, reused)
        if (this.overlayRect) {
            this.overlayRect
                .setPosition(width / 2, height / 2)
                .setSize(width, height)
                .setFillStyle(0x000000, 0.3)
                .setDepth(-10);
        } else {
            this.overlayRect = this.add
                .rectangle(width / 2, height / 2, width, height, 0x000000, 0.3)
                .setDepth(-10);
        }

        // dialogue box aligned to bottom
        const boxY = height - boxHeight / 2 - bottomMargin;
        this.dialogueBox = this.add
            .rectangle(width / 2, boxY, width, boxHeight, 0x000000, 0.8)
            .setStrokeStyle(2, 0xffffff, 0.2);

        // character name and dialogue text inside the box
        const textY = height - boxHeight - bottomMargin + padding;
        this.characterNameText = this.add.text(padding, textY, '', {
            fontSize: '22px',
            color: '#ffffff',
        });

        this.textObject = this.add.text(padding, textY + 34, '', {
            fontSize: '20px',
            color: '#ffffff',
            wordWrap: { width: width - padding * 2, useAdvancedWrap: true },
            fixedWidth: width - padding * 2,
        });

        // hint text positioned at bottom-right corner of dialogue box (localized)
        const hint = this.locale.startsWith('zh')
            ? 'Enter 繼續 · Backspace 返回'
            : 'Enter: Next · Backspace: Back';
        const hintY = height - bottomMargin - padding;
        this.hintText = this.add
            .text(width - padding, hintY, hint, {
                fontSize: '14px',
                color: '#dddddd',
            })
            .setOrigin(1, 1)
            .setAlpha(0.8);

        // home button top-left (localized)
        this.homeButton = this.add
            .text(padding, padding, '', {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 12, y: 8 },
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                this.onHomeButtonHoverChange(true);
            })
            .on('pointerout', () => {
                this.onHomeButtonHoverChange(false);
            })
            .on('pointerup', () => {
                this.onHomeButtonPressed();
            });
        this.refreshHomeButtonLabel();
        this.onHomeButtonHoverChange(false);
    }

    loadDialogue(dialogueData: DialogueMap) {
        this.dialogue = dialogueData;
        this.currentDialogueIndex = 0;
        // Ensure UI is ready before showing dialogue
        this.time.delayedCall(100, () => {
            this.showDialogue();
        });
    }

    showDialogue() {
        const sceneId = this.getSectionKey();
        const current: DialogueEntry | undefined =
            this.dialogue[sceneId]?.[this.currentDialogueIndex];
        if (current) {
            if (this.characterNameText && this.textObject) {
                const character = current.characterRef;
                const charId = character?.id ?? current.characterId;
                const info =
                    character?.info ??
                    (charId ? CharacterDirectory.getById(charId) : undefined);
                let speaker = current.character ?? info?.name ?? charId;
                const text = current.dialogue;

                // Use default protagonist name based on locale
                if (speaker === 'MainCharacter') {
                    speaker = this.locale.startsWith('zh') ? '李杰' : 'Li Jie';
                }

                this.characterNameText.setText(speaker ?? '');
                this.textObject.setText(text);
            } else {
                // If UI not ready, try again in a moment
                this.time.delayedCall(50, () => this.showDialogue());
            }
        } else {
            // End of dialogue, transition or end
            this.endScene();
        }
    }

    advanceDialogue() {
        this.playBeep();
        this.currentDialogueIndex++;
        this.showDialogue();
    }

    retreatDialogue() {
        this.playBeep();
        if (this.currentDialogueIndex > 0) {
            this.currentDialogueIndex--;
            // Allow child scenes to react (e.g., clear completion overlays)
            this.onRetreatDialogue();
            this.showDialogue();
        } else {
            // At first line: allow child scene to switch to previous section
            const handled = this.onCrossSectionRetreat();
            if (handled) {
                this.showDialogue();
            }
        }
    }

    // Hook for child scenes to override to cleanup any end-of-scene UI
    protected onRetreatDialogue() {
        // no-op by default
    }

    // Hook for child scenes to override for cross-section navigation.
    // Return true if a previous section was selected and state updated.
    protected onCrossSectionRetreat(): boolean {
        return false;
    }

    protected playBeep() {
        try {
            const AudioCtor =
                typeof AudioContext !== 'undefined'
                    ? AudioContext
                    : (
                          window as unknown as {
                              webkitAudioContext?: typeof AudioContext;
                          }
                      ).webkitAudioContext;
            if (!AudioCtor) return;
            if (!this.beepCtx) {
                this.beepCtx = new AudioCtor();
            }
            const ctx = this.beepCtx!;
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'sine';
            o.frequency.value = 880;
            g.gain.value = 0.02;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.05);
        } catch {
            // no-op if audio not available
        }
    }

    endScene() {
        // Override in child classes
    }

    protected applyAmbientForScene(sceneId: SceneId) {
        try {
            if (this.ambientOsc && this.beepCtx) {
                const freq = SceneDirectory.getAmbientFrequency(sceneId);
                this.ambientOsc.frequency.setValueAtTime(
                    freq,
                    this.beepCtx.currentTime
                );
            }
        } catch {
            // ignore
        }
    }

    protected getHomeButtonLabel(): string {
        return this.locale.startsWith('zh') ? '🏠 首頁' : '🏠 Home';
    }

    protected onHomeButtonPressed(): void {
        window.location.href = '/';
    }

    protected onHomeButtonHoverChange(hovering: boolean): void {
        const backgroundColor = hovering ? '#555555' : '#333333';
        this.homeButton?.setStyle({ backgroundColor });
    }

    protected refreshHomeButtonLabel(): void {
        const label = this.getHomeButtonLabel();
        this.homeButton?.setText(label);
    }
}
