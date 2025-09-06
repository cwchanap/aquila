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
    // Shared create logic: dialogue UI at bottom with full screen background
    this.updateDialogueUI();

    // Listen for resize events to update UI
    this.scale.on('resize', this.updateDialogueUI, this);

    // Require Enter key to advance dialogue
    this.input.keyboard?.on('keydown-ENTER', this.advanceDialogue, this);
  }

  updateDialogueUI() {
    const width = this.scale.width;
    const height = this.scale.height;
    const boxHeight = 180; // Increased height for better visibility
    const padding = 24;

    // Clear existing UI elements if they exist
    if (this.dialogueBox) this.dialogueBox.destroy();
    if (this.characterNameText) this.characterNameText.destroy();
    if (this.textObject) this.textObject.destroy();
    if (this.hintText) this.hintText.destroy();
    if (this.homeButton) this.homeButton.destroy();

    // full screen semi-transparent background
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
      .setStrokeStyle(2, 0xffffff, 0.2);

    // dialogue box at bottom with more margin from screen edge
    const boxY = height - boxHeight / 2 - 20; // Add 20px margin from bottom
    this.dialogueBox = this.add
      .rectangle(width / 2, boxY, width, boxHeight, 0x000000, 0.8)
      .setStrokeStyle(2, 0xffffff, 0.2);

    // character name and dialogue text inside the box
    const textY = height - boxHeight - 20 + padding; // Adjust text position accordingly
    this.characterNameText = this.add.text(padding, textY, '', {
      fontSize: '22px',
      color: '#ffffff',
    });

    this.textObject = this.add.text(padding, textY + 34, '', {
      fontSize: '20px',
      color: '#ffffff',
      wordWrap: { width: width - padding * 2 },
    });

    // hint text positioned relative to dialogue box
    this.hintText = this.add
      .text(width - padding, height - 25, 'Press Enter', {
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
  }

  loadDialogue(dialogueData: { [key: string]: { dialogue: string; character: string }[] }) {
    this.dialogue = dialogueData;
    this.currentDialogueIndex = 0;
    // Ensure UI is ready before showing dialogue
    this.time.delayedCall(100, () => {
      this.showDialogue();
    });
  }

  showDialogue() {
    const sceneId = this.scene.key; // Or manage scene IDs differently
    const current = this.dialogue[sceneId]?.[this.currentDialogueIndex];
    if (current) {
      if (this.characterNameText && this.textObject) {
        this.characterNameText.setText(current.character);
        this.textObject.setText(current.dialogue);
      } else {
        // If UI not ready, try again in a moment
        this.time.delayedCall(50, () => this.showDialogue());
      }
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