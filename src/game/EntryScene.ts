import { BaseScene } from './BaseScene';
import { trainAdventureDialogue } from './dialogue/trainAdventureDialogue';
import { MainCharacter } from './characters/MainCharacter';

export class EntryScene extends BaseScene {
  protected mainCharacter?: MainCharacter;

  constructor() {
    super('EntryScene');
  }

  init(data: { characterName: string }) {
    this.mainCharacter = new MainCharacter(this, data.characterName);
  }

  create() {
    super.create();
    this.loadDialogue(trainAdventureDialogue);

    // Example: Create sprite for main character (assuming assets are loaded)
    // this.mainCharacter.createSprite(400, 300, 'main-char-texture');
  }

  endScene() {
    // For now, just log end
    console.log('Entry scene ended');
    // this.scene.start('NextScene');
  }
}