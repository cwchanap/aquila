import Phaser from 'phaser';
import type { ChoiceMap, DialogueMap } from './dialogue/types';
import { getStoryContent, getStoryFlow } from '@aquila/dialogue';
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
        // Try to load backgrounds, but continue if they fail
        // This allows the game to run without background images
        const backgrounds = [
            {
                key: 'bg-scene_1',
                path: '/assets/train_adventure/backgrounds/entry.png',
            },
            {
                key: 'bg-scene_2',
                path: '/assets/train_adventure/backgrounds/train_ride.png',
            },
            {
                key: 'bg-scene_3',
                path: '/assets/train_adventure/backgrounds/station.png',
            },
        ];

        backgrounds.forEach(bg => {
            this.load.image(bg.key, bg.path);
        });

        // Handle load errors gracefully
        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            console.warn(`Failed to load asset: ${file.key}`, file.src);
            // Create a placeholder texture for missing images
            if (file.type === 'image') {
                const graphics = this.add.graphics();
                graphics.fillStyle(0x2c3e50, 1);
                graphics.fillRect(0, 0, 1920, 1080);
                graphics.generateTexture(file.key, 1920, 1080);
                graphics.destroy();
            }
        });

        // Load dialogue/choice data from internal modules instead of network JSON
        const storyId = this.startData.storyId || 'train_adventure';
        const locale = (this.startData.locale || 'zh').toLowerCase();
        const { dialogue, choices } = getStoryContent(storyId, locale);
        this.registry.set('dialogueMap', dialogue);
        this.registry.set('choiceMap', choices);

        // Load story flow configuration (locale-independent)
        const flowConfig = getStoryFlow(storyId);
        this.registry.set('flowConfig', flowConfig);

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
