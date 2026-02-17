import Phaser from 'phaser';
import type { ChoiceMap } from '../dialogue/types';

export class ChoicePresenter {
    private scene: Phaser.Scene;
    private choiceMap: ChoiceMap;
    private uiElements: Phaser.GameObjects.GameObject[] = [];
    private _awaiting = false;

    constructor(scene: Phaser.Scene, choiceMap: ChoiceMap) {
        this.scene = scene;
        this.choiceMap = choiceMap;
    }

    get awaiting(): boolean {
        return this._awaiting;
    }

    setChoiceMap(choiceMap: ChoiceMap) {
        this.choiceMap = choiceMap;
    }

    present(
        choiceId: string,
        optionIds: string[],
        onSelect: (optionId: string) => void
    ): void {
        const choiceDef = this.choiceMap[choiceId];
        const validOptionIds = optionIds.length ? optionIds : [''];

        if (!choiceDef) {
            console.warn(
                `[ChoicePresenter] Missing choice definition for choiceId="${choiceId}", optionIds=${JSON.stringify(optionIds)}`
            );
            if (validOptionIds[0]) {
                onSelect(validOptionIds[0]);
            }
            return;
        }

        this.destroyElements();
        this._awaiting = true;

        const width = this.scene.scale.width;
        const height = this.scene.scale.height;
        const backdrop = this.scene.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
            .setDepth(900)
            .setInteractive()
            .on(
                'pointerdown',
                (
                    pointer: Phaser.Input.Pointer,
                    localX: number,
                    localY: number,
                    event: Phaser.Types.Input.EventData
                ) => {
                    event.stopPropagation();
                }
            );
        const panelWidth = Math.min(width - 80, 560);
        const topPadding = 40;
        const promptHeight = 40;
        const optionHeight = 44;
        const optionSpacing = 60;
        const bottomPadding = 30;
        const optionCount = validOptionIds.length;
        const panelHeight = Math.max(
            240,
            topPadding +
                promptHeight +
                optionCount * optionHeight +
                (optionCount - 1) * (optionSpacing - optionHeight) +
                bottomPadding
        );
        const panel = this.scene.add
            .rectangle(
                width / 2,
                height / 2,
                panelWidth,
                panelHeight,
                0x111319,
                0.92
            )
            .setStrokeStyle(2, 0xffffff, 0.25)
            .setDepth(901);
        const prompt = this.scene.add
            .text(
                width / 2,
                height / 2 - panelHeight / 2 + 40,
                choiceDef.prompt,
                {
                    fontSize: '22px',
                    color: '#ffffff',
                    wordWrap: { width: panelWidth - 48, useAdvancedWrap: true },
                    align: 'center',
                }
            )
            .setOrigin(0.5)
            .setDepth(902);

        this.uiElements.push(backdrop, panel, prompt);

        const optionBaseY = prompt.y + 80;
        let anyOptionAdded = false;
        let renderedIndex = 0;

        validOptionIds.forEach(optionId => {
            const optionDef = choiceDef.options.find(
                opt => opt.id === optionId
            );
            if (!optionDef) return;

            const optionY = optionBaseY + renderedIndex * optionSpacing;
            const buttonBg = this.scene.add
                .rectangle(
                    width / 2,
                    optionY,
                    panelWidth - 60,
                    44,
                    0x1f2933,
                    0.9
                )
                .setStrokeStyle(1, 0xffffff, 0.25)
                .setDepth(901)
                .setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    buttonBg.setFillStyle(0x2c3c4c, 0.95);
                })
                .on('pointerout', () => {
                    buttonBg.setFillStyle(0x1f2933, 0.9);
                })
                .on('pointerup', () => {
                    this.clear();
                    onSelect(optionId);
                });

            const label = this.scene.add
                .text(width / 2, optionY, optionDef.label, {
                    fontSize: '20px',
                    color: '#e5e7eb',
                })
                .setOrigin(0.5)
                .setDepth(902);

            this.uiElements.push(buttonBg, label);
            anyOptionAdded = true;
            renderedIndex++;
        });

        if (!anyOptionAdded) {
            this.clear();
            onSelect(validOptionIds[0]);
        }
    }

    clear(): void {
        this.destroyElements();
        this._awaiting = false;
    }

    private destroyElements(): void {
        this.uiElements.forEach(el => el.destroy());
        this.uiElements = [];
    }
}
