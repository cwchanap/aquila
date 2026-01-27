/**
 * Scene flow configuration for Train Adventure story.
 * Defines the narrative structure and branching paths.
 */

// Note: We define the flow config structure here without importing from @aquila/game
// to avoid circular dependencies. The structure matches FlowConfig from SceneFlow.ts.

export interface TrainAdventureFlowNodeDefinition {
    kind: 'scene' | 'choice';
    id: string;
    sceneId?: string;
    choiceId?: string;
    next?: string | null;
    nextByOption?: Record<string, string>;
}

export interface TrainAdventureFlowConfig {
    start: string;
    nodes: TrainAdventureFlowNodeDefinition[];
}

/**
 * The scene flow configuration for Train Adventure.
 * This defines the narrative path:
 * scene_1 -> scene_2 -> scene_3 -> (choice) -> scene_4a OR scene_4b
 */
export const trainAdventureFlow: TrainAdventureFlowConfig = {
    start: 'scene_1',
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
};
