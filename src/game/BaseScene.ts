import Phaser from 'phaser';

export class BaseScene extends Phaser.Scene {
  protected dialogue: { [key: string]: { dialogue: string; character: string }[] } = {};
  protected currentDialogueIndex: number = 0;
  protected textObject?: Phaser.GameObjects.Text;
  protected characterNameText?: Phaser.GameObjects.Text;
  protected dialogueBox?: Phaser.GameObjects.Rectangle;
  protected hintText?: Phaser.GameObjects.Text;
  protected homeButton?: Phaser.GameObjects.Text;

  constructor(key: string) {
    super(key);
  }

  preload() {
    // Shared preload logic, e.g., load fonts, UI assets
  }

  create() {
    // Shared create logic: dialogue UI aligned to bottom
    const width = this.scale.width;
    const height = this.scale.height;
    const boxHeight = 160;
    const padding = 24;

    // semi-transparent box at bottom
    this.dialogueBox = this.add
      .rectangle(width / 2, height - boxHeight / 2, width, boxHeight, 0x000000, 0.6)
      .setStrokeStyle(2, 0xffffff, 0.2);

    // character name and dialogue text inside the box
    this.characterNameText = this.add.text(padding, height - boxHeight + padding, '', {
      fontSize: '22px',
      color: '#ffffff',
    });

    this.textObject = this.add.text(padding, height - boxHeight + padding + 34, '', {
      fontSize: '20px',
      color: '#ffffff',
      wordWrap: { width: width - padding * 2 },
    });

    // hint text bottom-right
    this.hintText = this.add
      .text(width - padding, height - padding, 'Press Enter', {
        fontSize: '14px',
        color: '#dddddd',
      })
      .setOrigin(1, 1)
      .setAlpha(0.8);

    // home button top-left
    this.homeButton = this.add
      .text(padding, padding, '🏠 Home', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 12, y: 8 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        window.location.href = '/';
      })
      .on('pointerover', () => {
        this.homeButton?.setStyle({ backgroundColor: '#555555' });
      })
      .on('pointerout', () => {
        this.homeButton?.setStyle({ backgroundColor: '#333333' });
      });

    // Require Enter key to advance dialogue
    this.input.keyboard?.on('keydown-ENTER', this.advanceDialogue, this);
  }

  loadDialogue(dialogueData: { [key: string]: { dialogue: string; character: string }[] }) {
    this.dialogue = dialogueData;
    this.currentDialogueIndex = 0;
    this.showDialogue();
  }

  showDialogue() {
    const sceneId = this.scene.key; // Or manage scene IDs differently
    const current = this.dialogue[sceneId]?.[this.currentDialogueIndex];
    if (current) {
      this.characterNameText?.setText(current.character);
      this.textObject?.setText(current.dialogue);
    } else {
      // End of dialogue, transition or end
      this.endScene();
    }
  }

  advanceDialogue() {
    this.currentDialogueIndex++;
    this.showDialogue();
  }

  endScene() {
    // Override in child classes
  }
}