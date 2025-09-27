import Phaser from 'phaser';
import type { ChoiceMap, DialogueMap } from './dialogue/types';
import entryUrl from '@/assets/entry.png?url';
import trainRideUrl from '@/assets/train_ride.png?url';
import stationUrl from '@/assets/station.png?url';

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
        this.load.image('bg-scene_1', entryUrl);
        this.load.image('bg-scene_2', trainRideUrl);
        this.load.image('bg-scene_3', stationUrl);

        // Load optional JSON dialogue for data-driven flow (JSON only contains dialogues)
        const storyId = this.startData.storyId || 'train_adventure';
        const locale = (this.startData.locale || 'zh').toLowerCase();
        const localePrefix = locale.startsWith('zh') ? 'zh' : 'en';
        this.load.json(
            'story-dialogue',
            `/stories/${localePrefix}/${storyId}.json`
        );
        this.load.json(
            'story-choices',
            `/stories/${localePrefix}/${storyId}_choices.json`
        );
    }

    create() {
        const dialogueMap = (this.cache.json.get('story-dialogue') ||
            null) as DialogueMap | null;
        if (dialogueMap) {
            // Store for StoryScene to consume if provided
            this.registry.set('dialogueMap', dialogueMap);
        }

        const choiceMap = (this.cache.json.get('story-choices') ||
            null) as ChoiceMap | null;
        if (choiceMap) {
            this.registry.set('choiceMap', choiceMap);
        }

        // Start StoryScene; sections are defined in code, not JSON settings
        this.scene.start('StoryScene', {
            characterName: this.startData.characterName,
            locale: this.startData.locale,
            storyId: this.startData.storyId || 'train_adventure',
        });
    }
}
