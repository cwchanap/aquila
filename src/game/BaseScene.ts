import Phaser from 'phaser';

export class BaseScene extends Phaser.Scene {
    protected dialogue: {
        [key: string]: { dialogue: string; character: string }[];
    } = {};
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
    protected beepCtx?: AudioContext;
    protected ambientOsc?: OscillatorNode;
    protected ambientGain?: GainNode;
    // Active story section key (e.g., 'EntryScene', 'TrainRideScene').
    // Defaults to Phaser scene key when null for backward compatibility.
    protected sectionKey: string | null = null;

    constructor(key: string) {
        super(key);
    }

    // Helper to switch sections from a derived StoryScene
    protected setSection(nextKey: string) {
        this.sectionKey = nextKey;
        this.currentDialogueIndex = 0;
        // Rebuild the layout for the new section (background, etc.)
        this.redrawLayout();
        // Adjust ambient frequency to match new section mood
        try {
            if (this.ambientOsc) {
                let freq = 80;
                if (nextKey === 'TrainRideScene') freq = 60;
                if (nextKey === 'OtherworldStationScene') freq = 95;
                this.ambientOsc.frequency.setValueAtTime(
                    freq,
                    this.beepCtx ? this.beepCtx.currentTime : 0
                );
            }
        } catch {
            // ignore
        }
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
            let freq = 80; // platform
            if (sKey === 'TrainRideScene') freq = 60; // tunnel
            if (sKey === 'OtherworldStationScene') freq = 95; // eerie
            this.ambientOsc.frequency.value = freq;
            this.ambientGain.gain.value = 0.004; // very quiet
            this.ambientOsc.connect(this.ambientGain);
            this.ambientGain.connect(ctx.destination);
            this.ambientOsc.start();
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

    preload() {
        // Shared preload logic, e.g., load fonts, UI assets
    }

    create() {
        // Initialize runtime context from registry
        const regName = this.registry.get('playerName');
        const regLocale = this.registry.get('locale');
        if (typeof regName === 'string') this.playerName = regName;
        if (typeof regLocale === 'string') this.locale = regLocale;

        // Build scene layout (background + dialogue UI)
        this.redrawLayout();

        // Listen for resize events to update layout
        this.scale.on('resize', this.redrawLayout, this);

        // Require Enter key to advance dialogue
        this.input.keyboard?.on('keydown-ENTER', this.advanceDialogue, this);

        // Start subtle ambient hum (no audio files required)
        this.startAmbient();
        this.events.once('shutdown', () => this.stopAmbient());
    }

    protected redrawLayout = () => {
        this.setupBackground();
        this.updateDialogueUI();
    };

    protected getSectionKey() {
        return this.sectionKey ?? this.scene.key;
    }

    protected setupBackground() {
        const width = this.scale.width;
        const height = this.scale.height;

        const sKey = this.getSectionKey();
        const texKey = `bg-${sKey}`;
        const hasTexture = this.textures.exists(texKey);

        // Use image background if preloaded, else fallback to graphics color fill
        if (hasTexture) {
            if (!this.bgImage) {
                this.bgImage = this.add.image(0, 0, texKey).setOrigin(0.5, 0.5);
                this.bgImage.setDepth(-20);
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
            let color = 0x0b1022; // midnight platform
            if (sKey === 'TrainRideScene') color = 0x000000; // dark tunnel
            if (sKey === 'OtherworldStationScene') color = 0x2b0000; // otherworld red sky

            g.fillStyle(color, 1);
            g.fillRect(0, 0, width, height);

            // Simple horizon line for otherworld scene
            if (sKey === 'OtherworldStationScene') {
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

        // Clear existing UI elements if they exist
        if (this.dialogueBox) this.dialogueBox.destroy();
        if (this.characterNameText) this.characterNameText.destroy();
        if (this.textObject) this.textObject.destroy();
        if (this.hintText) this.hintText.destroy();
        if (this.homeButton) this.homeButton.destroy();

        // full screen semi-transparent overlay
        this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
            .setStrokeStyle(2, 0xffffff, 0.2);

        // dialogue box at bottom with more margin from screen edge
        const boxY = height - boxHeight / 2 - 20; // Add 20px margin from bottom
        this.dialogueBox = this.add
            .rectangle(width / 2, boxY, width, boxHeight, 0x000000, 0.8)
            .setStrokeStyle(2, 0xffffff, 0.2);

        // character name and dialogue text inside the box
        const textY = height - boxHeight - 20 + padding; // Adjust text position accordingly
        this.characterNameText = this.add.text(padding, textY, '', {
            fontSize: '22px',
            color: '#ffffff',
        });

        this.textObject = this.add.text(padding, textY + 34, '', {
            fontSize: '20px',
            color: '#ffffff',
            wordWrap: { width: width - padding * 2 },
        });

        // hint text positioned relative to dialogue box (localized)
        const hint = this.locale.startsWith('zh')
            ? '按 Enter 繼續'
            : 'Press Enter';
        this.hintText = this.add
            .text(width - padding, height - 25, hint, {
                fontSize: '14px',
                color: '#dddddd',
            })
            .setOrigin(1, 1)
            .setAlpha(0.8);

        // home button top-left (localized)
        const homeLabel = this.locale.startsWith('zh') ? '🏠 首頁' : '🏠 Home';
        this.homeButton = this.add
            .text(padding, padding, homeLabel, {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: '#333333',
                padding: { x: 12, y: 8 },
            })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                window.location.href = '/';
            })
            .on('pointerover', () => {
                this.homeButton?.setStyle({ backgroundColor: '#555555' });
            })
            .on('pointerout', () => {
                this.homeButton?.setStyle({ backgroundColor: '#333333' });
            });
    }

    loadDialogue(dialogueData: {
        [key: string]: { dialogue: string; character: string }[];
    }) {
        this.dialogue = dialogueData;
        this.currentDialogueIndex = 0;
        // Ensure UI is ready before showing dialogue
        this.time.delayedCall(100, () => {
            this.showDialogue();
        });
    }

    showDialogue() {
        const sceneId = this.getSectionKey();
        const current = this.dialogue[sceneId]?.[this.currentDialogueIndex];
        if (current) {
            if (this.characterNameText && this.textObject) {
                let speaker = current.character;
                let text = current.dialogue;
                if (
                    speaker === 'MainCharacter' ||
                    speaker === '李杰' ||
                    speaker === 'Li Jie'
                ) {
                    speaker = this.playerName || speaker;
                }
                if (this.playerName) {
                    if (
                        this.locale.startsWith('zh') &&
                        this.playerName !== '李杰'
                    ) {
                        text = text.replaceAll('李杰', this.playerName);
                    } else if (
                        !this.locale.startsWith('zh') &&
                        this.playerName !== 'Li Jie'
                    ) {
                        text = text.replaceAll('Li Jie', this.playerName);
                    }
                }
                this.characterNameText.setText(speaker);
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
}
