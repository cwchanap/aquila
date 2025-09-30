import Phaser from 'phaser';
import type { ChoiceMap, DialogueMap } from './dialogue/types';
import { getStoryContent } from './dialogue/stories';
import { loadCheckpoint } from './CheckpointStorage';

export class PreloadScene extends Phaser.Scene {
    private startData: {
        characterName: string;
        locale?: string;
        storyId?: string;
    } = {
        characterName: 'Player',
        locale: 'zh',
        storyId: 'train_adventure',
    };

    constructor() {
        super('PreloadScene');
    }

    init(data: { characterName: string; locale?: string; storyId?: string }) {
        this.startData = data || this.startData;
    }

    preload() {
        // Backgrounds mapped to scene IDs (built-in fallbacks for train_adventure)
        this.load.image('bg-scene_1', '/game/entry.png');
        this.load.image('bg-scene_2', '/game/train_ride.png');
        this.load.image('bg-scene_3', '/game/station.png');

        // Load dialogue/choice data from internal modules instead of network JSON
        const storyId = this.startData.storyId || 'train_adventure';
        const locale = (this.startData.locale || 'zh').toLowerCase();
        const { dialogue, choices } = getStoryContent(storyId, locale);
        this.registry.set('dialogueMap', dialogue);
        this.registry.set('choiceMap', choices);

        const checkpoint = loadCheckpoint(storyId);
        this.registry.set('checkpointState', checkpoint);
    }

    create() {
        const dialogueMap =
            (this.registry.get('dialogueMap') as DialogueMap | undefined) ??
            ({} as DialogueMap);
        const choiceMap =
            (this.registry.get('choiceMap') as ChoiceMap | undefined) ??
            ({} as ChoiceMap);
        this.registry.set('dialogueMap', dialogueMap);
        this.registry.set('choiceMap', choiceMap);

        // Start StoryScene; sections are defined in code, not JSON settings
        this.scene.start('StoryScene', {
            characterName: this.startData.characterName,
            locale: this.startData.locale,
            storyId: this.startData.storyId || 'train_adventure',
        });
    }
}
