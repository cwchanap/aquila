import Phaser from 'phaser';

export class BaseCharacter {
    protected scene: Phaser.Scene;
    protected name: string;
    protected sprite?: Phaser.GameObjects.Sprite;

    constructor(scene: Phaser.Scene, name: string) {
        this.scene = scene;
        this.name = name;
    }

    createSprite(x: number, y: number, texture: string) {
        this.sprite = this.scene.add.sprite(x, y, texture);
        return this.sprite;
    }

    speak(dialogue: string) {
        // Display dialogue, perhaps using scene's text objects
        console.log(`${this.name}: ${dialogue}`);
        // In actual implementation, update scene's dialogue text
    }

    // Other shared methods, like animations, etc.
}
