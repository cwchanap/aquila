import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneDirectory, type SceneId } from './SceneDirectory';
import { SceneFlow, type FlowConfig } from './SceneFlow';
import {
    clearCheckpoint,
    loadCheckpoint,
    saveCheckpoint,
    type CheckpointState,
    type StoredCheckpoint,
} from './CheckpointStorage';
import type { ChoiceMap, DialogueMap } from './dialogue/types';
import { ProgressMapModal } from './ProgressMapModal';
import { ChoicePresenter } from './ui/ChoicePresenter';
import { MenuOverlay } from './ui/MenuOverlay';
import { CompletionOverlay } from './ui/CompletionOverlay';
import type { EscListenerHost } from './types';

export class StoryScene extends BaseScene implements EscListenerHost {
    protected characterName: string = 'Player';
    private flow?: SceneFlow;
    private checkpointState?: CheckpointState;
    private transitioning = false;
    private storyId: string = 'train_adventure';
    private completed = false;
    private choicePresenter!: ChoicePresenter;
    private menuOverlay!: MenuOverlay;
    private completionOverlay!: CompletionOverlay;
    private escListener?: Phaser.Input.Keyboard.Key;
    private escListenerPaused = false;
    private progressMapModal?: ProgressMapModal;

    constructor() {
        super('StoryScene');
    }

    init(data: { characterName: string; locale?: string; storyId?: string }) {
        if (data.locale) this.locale = data.locale;
        if (data.storyId) this.storyId = data.storyId;
        this.registry.set('locale', this.locale);
    }

    create() {
        super.create();

        this.choicePresenter = new ChoicePresenter(this, {});
        this.menuOverlay = new MenuOverlay(this);
        this.completionOverlay = new CompletionOverlay(this);

        // Load dialogue map from registry (populated by PreloadScene)
        const dialogue = this.registry.get('dialogueMap') as
            | DialogueMap
            | undefined;
        this.loadDialogue((dialogue ?? {}) as DialogueMap);
        const choices = this.registry.get('choiceMap') as ChoiceMap | undefined;
        if (choices) {
            this.choicePresenter.setChoiceMap(choices);
        }

        this.flow = this.restoreSceneFlow();
        const initialScene =
            this.flow.getCurrentSceneId() ??
            SceneDirectory.defaultStart ??
            'scene_1';
        this.setSection(initialScene);
        this.persistCheckpoint();
        this.cameras.main.fadeIn(350, 0, 0, 0);

        this.escListener = this.input.keyboard?.addKey(
            Phaser.Input.Keyboard.KeyCodes.ESC
        );
        this.escListener?.on('down', () => this.toggleMenu());
        this.events.once('shutdown', () => {
            this.choicePresenter.clear();
            this.menuOverlay.forceClose();
            this.completionOverlay?.destroy();
            this.escListener?.destroy();
        });
    }

    endScene() {
        if (this.transitioning || this.choicePresenter.awaiting) return;
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
            this.choicePresenter.present(
                outcome.choiceId,
                outcome.optionIds,
                (optionId: string) => this.resolveChoice(optionId)
            );
            return;
        }
        this.showCompletionOverlay();
    }

    protected onRetreatDialogue(): void {
        if (this.completed) {
            this.completed = false;
            this.fadeAmbientTo(0.004, 200);
            this.completionOverlay.destroy();
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
        this.persistCheckpoint();
        return true;
    }

    advanceDialogue(): void {
        if (
            this.choicePresenter.awaiting ||
            this.transitioning ||
            this.menuOverlay.open
        )
            return;
        super.advanceDialogue();
    }

    retreatDialogue(): void {
        if (
            this.choicePresenter.awaiting ||
            this.transitioning ||
            this.menuOverlay.open
        )
            return;
        super.retreatDialogue();
    }

    protected getHomeButtonLabel(): string {
        return this.locale.startsWith('zh') ? '☰ 選單' : '☰ Menu';
    }

    protected onHomeButtonPressed(): void {
        this.toggleMenu();
    }

    public pauseEscListener(): void {
        this.escListenerPaused = true;
    }

    public resumeEscListener(): void {
        this.escListenerPaused = false;
    }

    private buildSceneFlow(externalConfig?: FlowConfig): SceneFlow {
        if (externalConfig) {
            return new SceneFlow(externalConfig);
        }

        return new SceneFlow({
            start: SceneDirectory.defaultStart ?? 'scene_1',
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
                    next: 'choice:choice_3',
                },
                {
                    kind: 'choice',
                    id: 'choice:choice_3',
                    choiceId: 'choice_3',
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

    private restoreSceneFlow(): SceneFlow {
        const checkpoint =
            (this.registry.get('checkpointState') as StoredCheckpoint | null) ??
            loadCheckpoint(this.storyId);

        const externalFlowConfig = this.registry.get('flowConfig') as
            | FlowConfig
            | undefined;
        const flow = this.buildSceneFlow(externalFlowConfig);

        if (checkpoint && Array.isArray(checkpoint.history)) {
            const restored = flow.restoreFromHistory(checkpoint.history);
            if (restored && restored === checkpoint.sceneId) {
                this.checkpointState = {
                    sceneId: checkpoint.sceneId,
                    history: [...checkpoint.history],
                };
                return flow;
            }

            clearCheckpoint(this.storyId);
        }

        this.checkpointState = undefined;
        return flow;
    }

    private persistCheckpoint(completed = false): void {
        if (completed) {
            clearCheckpoint(this.storyId);
            this.checkpointState = undefined;
            return;
        }

        if (!this.flow) return;
        const currentSceneId = this.flow.getCurrentSceneId();
        if (!currentSceneId) return;
        const history = this.flow.getSceneHistory();
        if (!history.length) return;

        const state: CheckpointState = {
            sceneId: currentSceneId,
            history,
        };
        this.checkpointState = state;
        saveCheckpoint(this.storyId, state);
    }

    private transitionToScene(sceneId: SceneId) {
        if (this.transitioning) return;
        this.transitioning = true;
        this.fadeAmbientTo(0.0005, 300);
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.setSection(sceneId);
            this.persistCheckpoint();
            this.cameras.main.fadeIn(350, 0, 0, 0);
            this.fadeAmbientTo(0.004, 350);
            this.transitioning = false;
            this.showDialogue();
        });
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
            this.persistCheckpoint(true);
            this.showCompletionOverlay();
        }
    }

    private toggleMenu(forceState?: boolean) {
        if (this.escListenerPaused) return;

        const desired =
            typeof forceState === 'boolean'
                ? forceState
                : !this.menuOverlay.open;
        if (desired === this.menuOverlay.open) return;
        if (desired) {
            this.openMenu();
        } else {
            this.menuOverlay.close();
            this.fadeAmbientTo(0.004, 300);
        }
    }

    private openMenu() {
        const locale = this.locale.startsWith('zh') ? 'zh' : 'en';
        this.menuOverlay.show({
            locale,
            onResume: () => {
                this.fadeAmbientTo(0.004, 300);
            },
            onProgressMap: () => this.openProgressMap(),
            onHome: () => {
                const isLocalizedRoute = window.location.pathname.startsWith(
                    `/${locale}/`
                );
                window.location.href = isLocalizedRoute ? `/${locale}/` : '/';
            },
        });
        this.fadeAmbientTo(0.001, 300);
    }

    private openProgressMap() {
        if (!this.flow) return;

        const flowNodes = this.flow.getFlowNodes();
        const currentNodeId = this.flow.getCurrentNodeId();
        const completedHistory = this.flow.getSceneHistory();

        this.progressMapModal = new ProgressMapModal(this, {
            mapConfig: {
                nodes: flowNodes,
                currentNodeId,
                completedHistory,
                width: this.scale.width,
                height: this.scale.height,
                interactive: false,
                locale: this.locale,
            },
            onClose: () => {
                this.progressMapModal = undefined;
            },
        });

        this.progressMapModal.show();
    }

    private showCompletionOverlay() {
        if (this.completed) return;
        this.completed = true;
        this.choicePresenter.clear();
        this.fadeAmbientTo(0.0015, 400);
        this.completionOverlay.show(this.locale);
    }
}
