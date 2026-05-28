// Shared flow types for story configs to stay aligned with @aquila/game.
export type FlowNodeDefinition<TSceneId extends string = string> =
    | SceneNodeDefinition<TSceneId>
    | ChoiceNodeDefinition<TSceneId>;

export type SceneNodeId<TSceneId extends string = string> = TSceneId;
export type ChoiceNodeId = `choice:${string}`;
export type FlowNodeId<TSceneId extends string = string> =
    | SceneNodeId<TSceneId>
    | ChoiceNodeId;

export interface SceneNodeDefinition<TSceneId extends string = string> {
    kind: 'scene';
    id: SceneNodeId<TSceneId>;
    sceneId: SceneNodeId<TSceneId>;
    next?: FlowNodeId<TSceneId> | null;
}

export interface ChoiceNodeDefinition<TSceneId extends string = string> {
    kind: 'choice';
    id: ChoiceNodeId;
    choiceId: string;
    nextByOption: Record<string, SceneNodeId<TSceneId>>;
}

export interface FlowConfig<TSceneId extends string = string> {
    start: SceneNodeId<TSceneId>;
    nodes: FlowNodeDefinition<TSceneId>[];
}
