import type {
    FlowConfig as SharedFlowConfig,
    FlowNodeDefinition as SharedFlowNodeDefinition,
    ChoiceNodeDefinition as SharedChoiceNodeDefinition,
    SceneNodeDefinition as SharedSceneNodeDefinition,
    FlowNodeId as SharedFlowNodeId,
    SceneNodeId as SharedSceneNodeId,
} from '@aquila/dialogue';
import type { SceneId } from './SceneDirectory';

type SceneNodeId = SharedSceneNodeId<SceneId>;
type FlowNodeId = SharedFlowNodeId<SceneId>;

export type FlowConfig = SharedFlowConfig<SceneId>;
export type FlowNodeDefinition = SharedFlowNodeDefinition<SceneId>;
export type SceneNodeDefinition = SharedSceneNodeDefinition<SceneId>;
export type ChoiceNodeDefinition = SharedChoiceNodeDefinition<SceneId>;

export type FlowAdvanceResult =
    | { type: 'scene'; sceneId: SceneId }
    | { type: 'choice'; choiceId: string; optionIds: string[] }
    | { type: 'end' };

export type FlowChoiceResolution =
    | { type: 'scene'; sceneId: SceneId }
    | { type: 'end' };

export class SceneFlow {
    private readonly nodes: Map<FlowNodeId, FlowNodeDefinition> = new Map();
    private mode: 'scene' | 'choice' | 'end';
    private currentNodeId: FlowNodeId;
    private sceneHistory: SceneNodeId[] = [];

    constructor(config: FlowConfig) {
        if (!config.nodes.length) {
            throw new Error('[SceneFlow] Flow requires at least one node.');
        }

        for (const node of config.nodes) {
            if (this.nodes.has(node.id)) {
                throw new Error(`[SceneFlow] Duplicate node id: ${node.id}`);
            }
            this.nodes.set(node.id, node);
        }

        const startNode = this.nodes.get(config.start);
        if (!startNode) {
            throw new Error(
                `[SceneFlow] Start node "${config.start}" not found.`
            );
        }
        if (startNode.kind !== 'scene') {
            throw new Error('[SceneFlow] Start node must be a scene.');
        }

        this.currentNodeId = startNode.id;
        this.mode = 'scene';
        this.sceneHistory = [startNode.id];
    }

    static fromLinearScenes(sceneIds: SceneId[]): SceneFlow {
        if (!sceneIds.length) {
            throw new Error('[SceneFlow] Cannot create flow without scenes.');
        }
        const nodes: FlowNodeDefinition[] = sceneIds.map((sceneId, index) => {
            const nextId =
                index < sceneIds.length - 1
                    ? (sceneIds[index + 1] as FlowNodeId)
                    : undefined;
            return {
                kind: 'scene',
                id: sceneId,
                sceneId,
                next: nextId,
            } satisfies SceneNodeDefinition;
        });
        return new SceneFlow({ start: sceneIds[0], nodes });
    }

    getCurrentSceneId(): SceneId | null {
        if (this.mode !== 'scene') return null;
        const node = this.nodes.get(this.currentNodeId);
        if (!node || node.kind !== 'scene') return null;
        return node.sceneId;
    }

    getCurrentChoiceId(): string | null {
        if (this.mode !== 'choice') return null;
        const node = this.nodes.get(this.currentNodeId);
        if (!node || node.kind !== 'choice') return null;
        return node.choiceId;
    }

    getCurrentChoiceOptionIds(): string[] {
        if (this.mode !== 'choice') return [];
        const node = this.nodes.get(this.currentNodeId);
        if (!node || node.kind !== 'choice') return [];
        return Object.keys(node.nextByOption);
    }

    getCurrentNodeId(): string {
        return this.currentNodeId;
    }

    advanceFromScene(): FlowAdvanceResult {
        if (this.mode !== 'scene') {
            return { type: 'end' };
        }
        const current = this.nodes.get(this.currentNodeId);
        if (!current || current.kind !== 'scene') {
            this.mode = 'end';
            return { type: 'end' };
        }

        const nextId = current.next ?? null;
        if (!nextId) {
            this.mode = 'end';
            return { type: 'end' };
        }

        const nextNode = this.nodes.get(nextId);
        if (!nextNode) {
            this.mode = 'end';
            return { type: 'end' };
        }

        if (nextNode.kind === 'scene') {
            this.currentNodeId = nextNode.id;
            this.mode = 'scene';
            this.sceneHistory.push(nextNode.id);
            return { type: 'scene', sceneId: nextNode.sceneId };
        }

        const optionIds = Object.keys(nextNode.nextByOption);
        this.currentNodeId = nextNode.id;
        this.mode = 'choice';
        if (!optionIds.length) {
            this.mode = 'end';
            return { type: 'end' };
        }
        return {
            type: 'choice',
            choiceId: nextNode.choiceId,
            optionIds,
        };
    }

    selectChoice(optionId: string): FlowChoiceResolution {
        if (this.mode !== 'choice') {
            return { type: 'end' };
        }
        const current = this.nodes.get(this.currentNodeId);
        if (!current || current.kind !== 'choice') {
            this.mode = 'end';
            return { type: 'end' };
        }

        const nextId =
            current.nextByOption[optionId] ??
            Object.values(current.nextByOption)[0];
        if (!nextId) {
            this.mode = 'end';
            return { type: 'end' };
        }

        const nextNode = this.nodes.get(nextId);
        if (!nextNode || nextNode.kind !== 'scene') {
            this.mode = 'end';
            return { type: 'end' };
        }

        // Trim history to the current scene before adding the new branch
        const lastSceneIndex = this.sceneHistory.lastIndexOf(nextNode.id);
        if (lastSceneIndex !== -1) {
            this.sceneHistory = this.sceneHistory.slice(0, lastSceneIndex);
        }

        // Ensure we only keep actual scenes and append the next scene entry
        const currentSceneId = this.sceneHistory[this.sceneHistory.length - 1];
        const currentSceneNode = this.nodes.get(currentSceneId);
        if (!currentSceneNode || currentSceneNode.kind !== 'scene') {
            this.sceneHistory = [];
        }
        this.sceneHistory.push(nextNode.id);

        this.currentNodeId = nextNode.id;
        this.mode = 'scene';
        return { type: 'scene', sceneId: nextNode.sceneId };
    }

    retreatToPreviousScene(): SceneId | null {
        if (this.sceneHistory.length <= 1) {
            return null;
        }
        // Remove current scene
        this.sceneHistory.pop();
        const previousId = this.sceneHistory[this.sceneHistory.length - 1];
        const previousNode = this.nodes.get(previousId);
        if (!previousNode || previousNode.kind !== 'scene') {
            return null;
        }
        this.currentNodeId = previousNode.id;
        this.mode = 'scene';
        return previousNode.sceneId;
    }

    getSceneHistory(): SceneId[] {
        return this.sceneHistory
            .map(nodeId => this.nodes.get(nodeId))
            .filter(
                (node): node is SceneNodeDefinition =>
                    !!node && node.kind === 'scene'
            )
            .map(node => node.sceneId);
    }

    getFlowNodes(): FlowNodeDefinition[] {
        return Array.from(this.nodes.values());
    }

    restoreFromHistory(history: SceneId[]): SceneId | null {
        if (!history.length) {
            return null;
        }

        const sanitized = history.filter(sceneId => {
            const node = this.nodes.get(sceneId);
            return !!node && node.kind === 'scene';
        });
        if (!sanitized.length) {
            return null;
        }

        const startId = sanitized[0];
        const startNode = this.nodes.get(startId);
        if (!startNode || startNode.kind !== 'scene') {
            return null;
        }

        this.sceneHistory = [startNode.id];
        this.currentNodeId = startNode.id;
        this.mode = 'scene';

        for (let i = 1; i < sanitized.length; i++) {
            const targetSceneId = sanitized[i];
            const outcome = this.advanceFromScene();

            if (outcome.type === 'scene') {
                if (outcome.sceneId !== targetSceneId) {
                    return null;
                }
                continue;
            }

            if (outcome.type === 'choice') {
                const choiceNode = this.nodes.get(this.currentNodeId);
                if (!choiceNode || choiceNode.kind !== 'choice') {
                    return null;
                }
                const matchedEntry = Object.entries(
                    choiceNode.nextByOption
                ).find(([, nextSceneId]) => nextSceneId === targetSceneId);
                if (!matchedEntry) {
                    return null;
                }
                const [optionId] = matchedEntry;
                const resolution = this.selectChoice(optionId);
                if (
                    resolution.type !== 'scene' ||
                    resolution.sceneId !== targetSceneId
                ) {
                    return null;
                }
                continue;
            }

            return null;
        }

        return this.getCurrentSceneId();
    }
}
