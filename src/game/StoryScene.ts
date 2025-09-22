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
            this.add
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

            this.add
                .text(width / 2, height / 2 - 20, title, {
                    fontSize: '36px',
                    color: '#ffffff',
                })
                .setOrigin(0.5)
                .setDepth(1001);
            this.add
                .text(width / 2, height / 2 + 8, tip, {
                    fontSize: '16px',
                    color: '#e5e7eb',
                })
                .setOrigin(0.5)
                .setDepth(1001);
            this.add
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
}
