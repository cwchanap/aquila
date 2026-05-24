/**
 * Scene flow configuration for Train Adventure story.
 * Defines the narrative structure and branching paths.
 */

// Note: These aliases intentionally mirror the FlowConfig/FlowNodeDefinition
// types used by SceneFlow in @aquila/game to avoid schema drift.
import type { FlowConfig, FlowNodeDefinition } from '../../flow-types';

export type TrainAdventureSceneId =
    | 'scene_1'
    | 'scene_2'
    | 'scene_3'
    | 'scene_4a'
    | 'scene_4b'
    | 'scene_5b'
    | 'scene_6b'
    | 'scene_7b'
    | 'scene_8b'
    | 'scene_9b'
    | 'scene_10b'
    | 'scene_11b'
    | 'scene_12b'
    | 'scene_13b'
    | 'scene_14b'
    | 'scene_15b'
    | 'scene_16b'
    | 'scene_final_3b';
export type TrainAdventureFlowNodeDefinition =
    FlowNodeDefinition<TrainAdventureSceneId>;
export type TrainAdventureFlowConfig = FlowConfig<TrainAdventureSceneId>;

/**
 * The scene flow configuration for Train Adventure.
 * This defines the narrative path:
 * scene_1 -> scene_2 -> scene_3 -> (choice) -> scene_4a OR scene_4b -> scene_5b -> ... -> scene_final_3b
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
            next: 'scene_5b',
        },
        {
            kind: 'scene',
            id: 'scene_5b',
            sceneId: 'scene_5b',
            next: 'scene_6b',
        },
        {
            kind: 'scene',
            id: 'scene_6b',
            sceneId: 'scene_6b',
            next: 'scene_7b',
        },
        {
            kind: 'scene',
            id: 'scene_7b',
            sceneId: 'scene_7b',
            next: 'scene_8b',
        },
        {
            kind: 'scene',
            id: 'scene_8b',
            sceneId: 'scene_8b',
            next: 'scene_9b',
        },
        {
            kind: 'scene',
            id: 'scene_9b',
            sceneId: 'scene_9b',
            next: 'scene_10b',
        },
        {
            kind: 'scene',
            id: 'scene_10b',
            sceneId: 'scene_10b',
            next: 'scene_11b',
        },
        {
            kind: 'scene',
            id: 'scene_11b',
            sceneId: 'scene_11b',
            next: 'scene_12b',
        },
        {
            kind: 'scene',
            id: 'scene_12b',
            sceneId: 'scene_12b',
            next: 'scene_13b',
        },
        {
            kind: 'scene',
            id: 'scene_13b',
            sceneId: 'scene_13b',
            next: 'scene_14b',
        },
        {
            kind: 'scene',
            id: 'scene_14b',
            sceneId: 'scene_14b',
            next: 'scene_15b',
        },
        {
            kind: 'scene',
            id: 'scene_15b',
            sceneId: 'scene_15b',
            next: 'scene_16b',
        },
        {
            kind: 'scene',
            id: 'scene_16b',
            sceneId: 'scene_16b',
            next: 'scene_final_3b',
        },
        {
            kind: 'scene',
            id: 'scene_final_3b',
            sceneId: 'scene_final_3b',
            next: null,
        },
    ],
};
