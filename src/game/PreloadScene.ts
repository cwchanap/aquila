import Phaser from 'phaser';
import entryUrl from '@/assets/entry.png?url';
import trainRideUrl from '@/assets/train_ride.png?url';
import stationUrl from '@/assets/station.png?url';

export class PreloadScene extends Phaser.Scene {
    private startData: { characterName: string; locale?: string } = {
        characterName: 'Player',
        locale: 'zh',
    };

    constructor() {
        super('PreloadScene');
    }

    init(data: { characterName: string; locale?: string }) {
        this.startData = data || this.startData;
    }

    preload() {
        // Backgrounds mapped to scene keys
        this.load.image('bg-EntryScene', entryUrl);
        this.load.image('bg-TrainRideScene', trainRideUrl);
        this.load.image('bg-OtherworldStationScene', stationUrl);
    }

    create() {
        // Forward to story scene with original data
        this.scene.start('StoryScene', {
            characterName: this.startData.characterName,
            locale: this.startData.locale,
        });
    }
}
