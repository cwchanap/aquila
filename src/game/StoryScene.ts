import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import type { DialogueMap } from './dialogue/types';

export class StoryScene extends BaseScene {
    protected characterName: string = 'Player';
    private sections: string[] = [
        'EntryScene',
        'TrainRideScene',
        'OtherworldStationScene',
    ];
    private sectionIndex = 0;
    private transitioning = false;
    private storyId: string = 'train_adventure';
    private completed = false;
    private completionOverlay?: Phaser.GameObjects.Rectangle;
    private completionTitle?: Phaser.GameObjects.Text;
    private completionTip?: Phaser.GameObjects.Text;
    private completionBtn?: Phaser.GameObjects.Text;

    constructor() {
        super('StoryScene');
    }

    init(data: {
        characterName: string;
        locale?: string;
        storyId?: string;
        sections?: string[];
    }) {
        this.characterName = data.characterName || 'Player';
        if (data.locale) this.locale = data.locale;
        if (data.storyId) this.storyId = data.storyId;
        if (Array.isArray(data.sections) && data.sections.length > 0) {
            this.sections = data.sections;
        }
        this.registry.set('playerName', this.characterName);
        this.registry.set('locale', this.locale);
    }

    create() {
        super.create();
        // Load dialogue map from registry (populated by PreloadScene)
        const dialogue = this.registry.get('dialogueMap') as
            | DialogueMap
            | undefined;
        this.loadDialogue((dialogue ?? {}) as DialogueMap);
        // Start at the first section
        this.sectionIndex = 0;
        this.setSection(this.sections[this.sectionIndex]);
        // Fade in at start for polish
        this.cameras.main.fadeIn(350, 0, 0, 0);
    }

    // When one section's dialogue ends, move to the next; finish when done.
    endScene() {
        if (this.transitioning) return;
        const nextIndex = this.sectionIndex + 1;
        if (nextIndex < this.sections.length) {
            this.transitioning = true;
            // Crossfade: fade out, switch section, fade in
            // Fade ambient down while fading video
            this.fadeAmbientTo(0.0005, 300);
            this.cameras.main.fadeOut(350, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.sectionIndex = nextIndex;
                this.setSection(this.sections[this.sectionIndex]);
                this.cameras.main.fadeIn(350, 0, 0, 0);
                // Restore ambient to normal low level
                this.fadeAmbientTo(0.004, 350);
                this.transitioning = false;
            });
        } else {
            // End of chapter
            // Optionally: show a small message or navigate.
            if (this.completed) return;
            this.completed = true;
            // Fade ambient down slightly to indicate completion state
            this.fadeAmbientTo(0.0015, 400);
            const width = this.scale.width;
            const height = this.scale.height;
            this.completionOverlay = this.add
                .rectangle(0, 0, width, height, 0x000000, 0.5)
                .setOrigin(0)
                .setDepth(1000);
            const title = this.locale.startsWith('zh')
                ? '章節完成'
                : 'Chapter Complete';
            const tip = this.locale.startsWith('zh')
                ? '按 Enter 返回主選單'
                : 'Press Enter to go Home';
            const btnLabel = this.locale.startsWith('zh')
                ? '🏠 回首頁'
                : '🏠 Home';

            this.completionTitle = this.add
                .text(width / 2, height / 2 - 20, title, {
                    fontSize: '36px',
                    color: '#ffffff',
                })
                .setOrigin(0.5)
                .setDepth(1001);
            this.completionTip = this.add
                .text(width / 2, height / 2 + 8, tip, {
                    fontSize: '16px',
                    color: '#e5e7eb',
                })
                .setOrigin(0.5)
                .setDepth(1001);
            this.completionBtn = this.add
                .text(width / 2, height / 2 + 50, btnLabel, {
                    fontSize: '18px',
                    color: '#ffffff',
                    backgroundColor: '#00000080',
                    padding: { left: 12, right: 12, top: 8, bottom: 8 },
                })
                .setOrigin(0.5)
                .setDepth(1001)
                .setInteractive({ useHandCursor: true })
                .on('pointerup', () => {
                    window.location.href = '/';
                });

            this.input.keyboard?.once('keydown-ENTER', () => {
                window.location.href = '/';
            });
        }
    }

    protected onRetreatDialogue(): void {
        // If user navigates back after completion, remove overlays and restore state
        if (this.completed) {
            this.completed = false;
            // Restore ambient to normal scene level
            this.fadeAmbientTo(0.004, 200);
            this.completionOverlay?.destroy();
            this.completionTitle?.destroy();
            this.completionTip?.destroy();
            this.completionBtn?.destroy();
            this.completionOverlay = undefined;
            this.completionTitle = undefined;
            this.completionTip = undefined;
            this.completionBtn = undefined;
        }
    }

    protected onCrossSectionRetreat(): boolean {
        // If at the first line of a section, go to the last line of the previous section
        if (this.sectionIndex > 0) {
            this.sectionIndex -= 1;
            const prevKey = this.sections[this.sectionIndex];
            // Switch section without auto-show from setSection; do it manually to avoid flicker
            this.sectionKey = prevKey;
            const len = this.dialogue[prevKey]?.length ?? 1;
            this.currentDialogueIndex = Math.max(0, len - 1);
            // Update ambient frequency to match previous section mood
            try {
                if (this.ambientOsc) {
                    let freq = 80;
                    if (prevKey === 'TrainRideScene') freq = 60;
                    if (prevKey === 'OtherworldStationScene') freq = 95;
                    this.ambientOsc.frequency.setValueAtTime(
                        freq,
                        this.beepCtx ? this.beepCtx.currentTime : 0
                    );
                }
            } catch {
                // ignore
            }
            // Rebuild layout for new section (background, UI preserved appropriately)
            this.redrawLayout();
            return true;
        }
        return false;
    }
}
