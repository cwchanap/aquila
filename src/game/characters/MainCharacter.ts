import { BaseCharacter } from './BaseCharacter';

export class MainCharacter extends BaseCharacter {
    constructor(scene: Phaser.Scene, name: string) {
        super(scene, name);
        // Main character specific initialization
    }

    // Override or add methods specific to MainCharacter
    makeDecision(choice: string) {
        // For branching dialogues, etc.
        console.log(`${this.name} chooses: ${choice}`);
    }
}
