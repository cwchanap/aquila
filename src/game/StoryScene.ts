import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneDirectory, type SceneId } from './SceneDirectory';
import { SceneFlow } from './SceneFlow';
import type { ChoiceMap, DialogueMap } from './dialogue/types';

export class StoryScene extends BaseScene {
    protected characterName: string = 'Player';
    private flow?: SceneFlow;
    private transitioning = false;
    private storyId: string = 'train_adventure';
    private completed = false;
    private completionOverlay?: Phaser.GameObjects.Rectangle;
    private completionTitle?: Phaser.GameObjects.Text;
    private completionTip?: Phaser.GameObjects.Text;
    private completionBtn?: Phaser.GameObjects.Text;
    private choiceMap: ChoiceMap = {};
    private awaitingChoice = false;
    private choiceUiElements: Phaser.GameObjects.GameObject[] = [];

    constructor() {
        super('StoryScene');
    }

    init(data: { characterName: string; locale?: string; storyId?: string }) {
        this.characterName = data.characterName || 'Player';
        if (data.locale) this.locale = data.locale;
        if (data.storyId) this.storyId = data.storyId;
        this.registry.set('playerName', this.characterName);
        this.registry.set('locale', this.locale);
    }

    create() {
        super.create();
        // Load dialogue map from registry (populated by PreloadScene)
        const dialogue = this.registry.get('dialogueMap') as
            | DialogueMap
            | undefined;
        this.loadDialogue((dialogue ?? {}) as DialogueMap);
        const choices = this.registry.get('choiceMap') as ChoiceMap | undefined;
        if (choices) {
            this.choiceMap = choices;
        }

        this.flow = this.buildSceneFlow();
        const initialScene =
            this.flow.getCurrentSceneId() ?? SceneDirectory.defaultStart;
        this.setSection(initialScene);
        // Fade in at start for polish
        this.cameras.main.fadeIn(350, 0, 0, 0);
        this.events.once('shutdown', () => {
            this.destroyChoiceUiElements();
        });
    }

    // When one section's dialogue ends, move to the next; finish when done.
    endScene() {
        if (this.transitioning || this.awaitingChoice) return;
        if (!this.flow) {
            this.showCompletionOverlay();
            return;
        }

        const outcome = this.flow.advanceFromScene();
        if (outcome.type === 'scene') {
            this.transitionToScene(outcome.sceneId);
            return;
        }
        if (outcome.type === 'choice') {
            this.presentChoice(outcome.choiceId, outcome.optionIds);
            return;
        }
        this.showCompletionOverlay();
    }

    protected onRetreatDialogue(): void {
        // If user navigates back after completion, remove overlays and restore state
        if (this.completed) {
            this.completed = false;
            // Restore ambient to normal scene level
            this.fadeAmbientTo(0.004, 200);
            this.completionOverlay?.destroy();
            this.completionTitle?.destroy();
            this.completionTip?.destroy();
            this.completionBtn?.destroy();
            this.completionOverlay = undefined;
            this.completionTitle = undefined;
            this.completionTip = undefined;
            this.completionBtn = undefined;
        }
    }

    protected onCrossSectionRetreat(): boolean {
        if (!this.flow) return false;
        const previousSceneId = this.flow.retreatToPreviousScene();
        if (!previousSceneId) return false;

        this.sectionKey = previousSceneId;
        const len = this.dialogue[previousSceneId]?.length ?? 0;
        this.currentDialogueIndex = Math.max(0, len - 1);

        this.applyAmbientForScene(previousSceneId);

        this.redrawLayout();
        return true;
    }

    advanceDialogue(): void {
        if (this.awaitingChoice || this.transitioning) return;
        super.advanceDialogue();
    }

    retreatDialogue(): void {
        if (this.awaitingChoice || this.transitioning) return;
        super.retreatDialogue();
    }

    private buildSceneFlow(): SceneFlow {
        return new SceneFlow({
            start: SceneDirectory.defaultStart,
            nodes: [
                {
                    kind: 'scene',
                    id: 'scene_1',
                    sceneId: 'scene_1',
                    next: 'scene_2',
                },
                {
                    kind: 'scene',
                    id: 'scene_2',
                    sceneId: 'scene_2',
                    next: 'scene_3',
                },
                {
                    kind: 'scene',
                    id: 'scene_3',
                    sceneId: 'scene_3',
                    next: 'choice:get_off_or_stay',
                },
                {
                    kind: 'choice',
                    id: 'choice:get_off_or_stay',
                    choiceId: 'get_off_or_stay',
                    nextByOption: {
                        leave_train: 'scene_4a',
                        stay_on_train: 'scene_4b',
                    },
                },
                {
                    kind: 'scene',
                    id: 'scene_4a',
                    sceneId: 'scene_4a',
                    next: null,
                },
                {
                    kind: 'scene',
                    id: 'scene_4b',
                    sceneId: 'scene_4b',
                    next: null,
                },
            ],
        });
    }

    private transitionToScene(sceneId: SceneId) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.fadeAmbientTo(0.0005, 300);
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.setSection(sceneId);
            this.cameras.main.fadeIn(350, 0, 0, 0);
            this.fadeAmbientTo(0.004, 350);
            this.transitioning = false;
            this.showDialogue();
        });
    }

    private presentChoice(choiceId: string, optionIds: string[]) {
        const choiceDef = this.choiceMap[choiceId];
        const validOptionIds = optionIds.length ? optionIds : [''];

        if (!choiceDef) {
            this.resolveChoice(validOptionIds[0]);
            return;
        }

        this.destroyChoiceUiElements();
        this.awaitingChoice = true;

        const width = this.scale.width;
        const height = this.scale.height;
        const backdrop = this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
            .setDepth(900);
        const panelWidth = Math.min(width - 80, 560);
        const panelHeight = 240;
        const panel = this.add
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
        const prompt = this.add
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

        this.choiceUiElements.push(backdrop, panel, prompt);

        const optionBaseY = prompt.y + 60;
        const optionSpacing = 60;
        let anyOptionAdded = false;

        validOptionIds.forEach((optionId, index) => {
            const optionDef = choiceDef.options.find(
                opt => opt.id === optionId
            );
            if (!optionDef) {
                return;
            }

            const optionY = optionBaseY + index * optionSpacing;
            const buttonBg = this.add
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
                    this.handleChoiceSelection(optionId);
                });

            const label = this.add
                .text(width / 2, optionY, optionDef.label, {
                    fontSize: '20px',
                    color: '#e5e7eb',
                })
                .setOrigin(0.5)
                .setDepth(902);

            this.choiceUiElements.push(buttonBg, label);
            anyOptionAdded = true;
        });

        if (!anyOptionAdded) {
            // Fallback if none of the provided option IDs matched definitions
            this.clearChoiceUi();
            this.resolveChoice(validOptionIds[0]);
            return;
        }
    }

    private handleChoiceSelection(optionId: string) {
        this.clearChoiceUi();
        this.resolveChoice(optionId);
    }

    private resolveChoice(optionId: string) {
        if (!this.flow) {
            this.showCompletionOverlay();
            return;
        }
        const resolution = this.flow.selectChoice(optionId);
        if (resolution.type === 'scene') {
            this.transitionToScene(resolution.sceneId);
        } else {
            this.showCompletionOverlay();
        }
    }

    private destroyChoiceUiElements() {
        this.choiceUiElements.forEach(element => {
            element.destroy();
        });
        this.choiceUiElements = [];
    }

    private clearChoiceUi() {
        this.destroyChoiceUiElements();
        this.awaitingChoice = false;
    }

    private showCompletionOverlay() {
        if (this.completed) return;
        this.completed = true;
        this.clearChoiceUi();
        // Fade ambient down slightly to indicate completion state
        this.fadeAmbientTo(0.0015, 400);
        const width = this.scale.width;
        const height = this.scale.height;
        this.completionOverlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.5)
            .setOrigin(0)
            .setDepth(1000);
        const title = this.locale.startsWith('zh')
            ? '章節完成'
            : 'Chapter Complete';
        const tip = this.locale.startsWith('zh')
            ? '按 Enter 返回主選單'
            : 'Press Enter to go Home';
        const btnLabel = this.locale.startsWith('zh') ? '🏠 回首頁' : '🏠 Home';

        this.completionTitle = this.add
            .text(width / 2, height / 2 - 20, title, {
                fontSize: '36px',
                color: '#ffffff',
            })
            .setOrigin(0.5)
            .setDepth(1001);
        this.completionTip = this.add
            .text(width / 2, height / 2 + 8, tip, {
                fontSize: '16px',
                color: '#e5e7eb',
            })
            .setOrigin(0.5)
            .setDepth(1001);
        this.completionBtn = this.add
            .text(width / 2, height / 2 + 50, btnLabel, {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: '#00000080',
                padding: { left: 12, right: 12, top: 8, bottom: 8 },
            })
            .setOrigin(0.5)
            .setDepth(1001)
            .setInteractive({ useHandCursor: true })
            .on('pointerup', () => {
                window.location.href = '/';
            });

        this.input.keyboard?.once('keydown-ENTER', () => {
            window.location.href = '/';
        });
    }
}
