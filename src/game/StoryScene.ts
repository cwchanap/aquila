import { BaseScene } from './BaseScene';
import { getTrainAdventureDialogue } from './dialogue/index';

export class StoryScene extends BaseScene {
    protected characterName: string = 'Player';
    private sections: string[] = [
        'EntryScene',
        'TrainRideScene',
        'OtherworldStationScene',
    ];
    private sectionIndex = 0;

    constructor() {
        super('StoryScene');
    }

    init(data: { characterName: string; locale?: string }) {
        this.characterName = data.characterName || 'Player';
        if (data.locale) this.locale = data.locale;
        this.registry.set('playerName', this.characterName);
        this.registry.set('locale', this.locale);
    }

    create() {
        super.create();
        // Load dialogue map for current locale
        this.loadDialogue(getTrainAdventureDialogue(this.locale));
        // Start at the first section
        this.sectionIndex = 0;
        this.setSection(this.sections[this.sectionIndex]);
    }

    // When one section's dialogue ends, move to the next; finish when done.
    endScene() {
        this.sectionIndex += 1;
        if (this.sectionIndex < this.sections.length) {
            this.setSection(this.sections[this.sectionIndex]);
        } else {
            // End of chapter
            // Optionally: show a small message or navigate.
            // For now, log and keep scene active so user can hit Home.
            console.log('Story completed.');
        }
    }
}
