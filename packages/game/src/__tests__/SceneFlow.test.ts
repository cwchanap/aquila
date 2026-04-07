import { describe, it, expect } from 'vitest';
import { SceneFlow, type FlowConfig } from '../SceneFlow';

describe('SceneFlow', () => {
    describe('constructor', () => {
        it('throws when nodes array is empty', () => {
            expect(
                () => new SceneFlow({ start: 'scene_1', nodes: [] })
            ).toThrow('Flow requires at least one node');
        });

        it('throws when start node is not found', () => {
            const config: FlowConfig = {
                start: 'scene_2',
                nodes: [{ kind: 'scene', id: 'scene_1', sceneId: 'scene_1' }],
            };
            expect(() => new SceneFlow(config)).toThrow(
                'Start node "scene_2" not found'
            );
        });

        it('throws when duplicate node ids exist', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    { kind: 'scene', id: 'scene_1', sceneId: 'scene_1' },
                    { kind: 'scene', id: 'scene_1', sceneId: 'scene_1' },
                ],
            };
            expect(() => new SceneFlow(config)).toThrow('Duplicate node id');
        });

        it('throws when start node is not a scene', () => {
            const config: FlowConfig = {
                start: 'choice:1' as any,
                nodes: [
                    {
                        kind: 'choice',
                        id: 'choice:1',
                        choiceId: 'choice_1',
                        nextByOption: { a: 'scene_1' },
                    },
                    { kind: 'scene', id: 'scene_1', sceneId: 'scene_1' },
                    {
                        kind: 'scene',
                        id: 'scene_2',
                        sceneId: 'scene_2',
                        next: 'choice:1',
                    },
                ],
            };
            expect(() => new SceneFlow(config)).toThrow(
                'Start node must be a scene'
            );
        });
    });

    describe('fromLinearScenes', () => {
        it('throws when scenes array is empty', () => {
            expect(() => SceneFlow.fromLinearScenes([])).toThrow(
                'Cannot create flow without scenes'
            );
        });

        it('creates linear flow from scene array', () => {
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
                'scene_3',
            ]);
            expect(flow.getCurrentSceneId()).toBe('scene_1');

            const result1 = flow.advanceFromScene();
            expect(result1).toEqual({ type: 'scene', sceneId: 'scene_2' });

            const result2 = flow.advanceFromScene();
            expect(result2).toEqual({ type: 'scene', sceneId: 'scene_3' });

            const result3 = flow.advanceFromScene();
            expect(result3).toEqual({ type: 'end' });
        });
    });

    describe('advanceFromScene', () => {
        it('returns next scene when available', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'scene_2',
                    },
                    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2' },
                ],
            };
            const flow = new SceneFlow(config);

            const result = flow.advanceFromScene();
            expect(result).toEqual({ type: 'scene', sceneId: 'scene_2' });
            expect(flow.getCurrentSceneId()).toBe('scene_2');
        });

        it('returns choice when at decision point', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:1',
                        choiceId: 'c1',
                        nextByOption: { a: 'scene_2', b: 'scene_3' },
                    },
                    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2' },
                    { kind: 'scene', id: 'scene_3', sceneId: 'scene_3' },
                ],
            };
            const flow = new SceneFlow(config);

            const result = flow.advanceFromScene();
            expect(result).toEqual({
                type: 'choice',
                choiceId: 'c1',
                optionIds: ['a', 'b'],
            });
        });

        it('returns end when story complete', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [{ kind: 'scene', id: 'scene_1', sceneId: 'scene_1' }],
            };
            const flow = new SceneFlow(config);

            const result = flow.advanceFromScene();
            expect(result).toEqual({ type: 'end' });
        });
    });

    describe('selectChoice', () => {
        it('advances to correct branch based on selection', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:1',
                        choiceId: 'c1',
                        nextByOption: { a: 'scene_4a', b: 'scene_4b' },
                    },
                    { kind: 'scene', id: 'scene_4a', sceneId: 'scene_4a' },
                    { kind: 'scene', id: 'scene_4b', sceneId: 'scene_4b' },
                ],
            };
            const flow = new SceneFlow(config);

            flow.advanceFromScene(); // Move to choice

            const resultA = flow.selectChoice('a');
            expect(resultA).toEqual({ type: 'scene', sceneId: 'scene_4a' });
            expect(flow.getCurrentSceneId()).toBe('scene_4a');
        });

        it('returns end when not in choice mode', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1']);
            const result = flow.selectChoice('a');
            expect(result).toEqual({ type: 'end' });
        });
    });

    describe('retreatToPreviousScene', () => {
        it('returns to previous scene', () => {
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
                'scene_3',
            ]);
            flow.advanceFromScene();
            flow.advanceFromScene();

            expect(flow.getCurrentSceneId()).toBe('scene_3');

            const result = flow.retreatToPreviousScene();
            expect(result).toBe('scene_2');
            expect(flow.getCurrentSceneId()).toBe('scene_2');
        });

        it('returns null when at first scene', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1']);
            const result = flow.retreatToPreviousScene();
            expect(result).toBeNull();
        });

        it('returns null when previous history entry is not a known scene node (line 200)', () => {
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
            ] as any);
            // sceneHistory is ordered oldest→newest; pop() removes the last (current).
            // After pop, previousId = '__invalid_node__' which has no matching node.
            (flow as any).sceneHistory = ['__invalid_node__', 'scene_2'];
            const result = flow.retreatToPreviousScene();
            expect(result).toBeNull();
        });
    });

    describe('getSceneHistory', () => {
        it('tracks visited scenes', () => {
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
                'scene_3',
            ]);
            flow.advanceFromScene();
            flow.advanceFromScene();

            const history = flow.getSceneHistory();
            expect(history).toEqual(['scene_1', 'scene_2', 'scene_3']);
        });
    });

    describe('restoreFromHistory', () => {
        it('restores flow to saved state', () => {
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
                'scene_3',
            ]);

            const result = flow.restoreFromHistory(['scene_1', 'scene_2']);
            expect(result).toBe('scene_2');
            expect(flow.getCurrentSceneId()).toBe('scene_2');
        });

        it('returns null for empty history', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1']);
            const result = flow.restoreFromHistory([]);
            expect(result).toBeNull();
        });

        it('returns null when all history entries are unknown scene ids', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1', 'scene_2']);
            // 'ghost_1' and 'ghost_2' are not in the flow → sanitized will be empty
            const result = flow.restoreFromHistory([
                'ghost_1' as any,
                'ghost_2' as any,
            ]);
            expect(result).toBeNull();
        });

        it('restores through a choice branch', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { opt_a: 'scene_2a', opt_b: 'scene_2b' },
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2a',
                        sceneId: 'scene_2a',
                        next: null,
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2b',
                        sceneId: 'scene_2b',
                        next: null,
                    },
                ],
            };
            const flow = new SceneFlow(config);

            // Replay: scene_1 → (choice) → scene_2b
            const result = flow.restoreFromHistory([
                'scene_1',
                'scene_2b',
            ] as any[]);
            expect(result).toBe('scene_2b');
            expect(flow.getCurrentSceneId()).toBe('scene_2b');
        });

        it('returns null when choice history target has no matching option', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { opt_a: 'scene_2a' },
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2a',
                        sceneId: 'scene_2a',
                        next: null,
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2b',
                        sceneId: 'scene_2b',
                        next: null,
                    },
                ],
            };
            const flow = new SceneFlow(config);

            // 'scene_2b' is not reachable from choice:c1
            const result = flow.restoreFromHistory([
                'scene_1',
                'scene_2b',
            ] as any[]);
            expect(result).toBeNull();
        });

        it('returns null when scene sequence is inconsistent with flow graph', () => {
            const flow = SceneFlow.fromLinearScenes([
                'scene_1',
                'scene_2',
                'scene_3',
            ]);
            // scene_3 does not directly follow scene_1 in this linear flow
            const result = flow.restoreFromHistory([
                'scene_1',
                'scene_3',
            ] as any[]);
            expect(result).toBeNull();
        });

        it('returns null when advance returns end during history replay', () => {
            // scene_1 is a terminal node (no next), but history lists scene_2 after it
            // Both scene_1 and scene_2 are valid in the flow, so sanitized = ['scene_1', 'scene_2']
            // Advancing from scene_1 returns 'end' because it has no next
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: null,
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2',
                        sceneId: 'scene_2',
                        next: null,
                    },
                ],
            };
            const flow = new SceneFlow(config);
            const result = flow.restoreFromHistory([
                'scene_1',
                'scene_2',
            ] as any[]);
            expect(result).toBeNull();
        });
    });

    describe('selectChoice edge cases', () => {
        const makeChoiceFlow = () =>
            new SceneFlow({
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { opt_a: 'scene_2' },
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2',
                        sceneId: 'scene_2',
                        next: null,
                    },
                ],
            } as any);

        it('falls back to first option when optionId is unknown', () => {
            const flow = makeChoiceFlow();
            flow.advanceFromScene(); // → choice mode
            const result = flow.selectChoice('non_existent_option');
            // nextByOption has only 'opt_a' → falls back to first option → scene_2
            expect(result).toEqual({ type: 'scene', sceneId: 'scene_2' });
        });

        it('returns end when choice node has empty nextByOption', () => {
            const flow = new SceneFlow({
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: {},
                    },
                ],
            } as any);
            // advanceFromScene hits a choice node with no valid options → returns end
            const result = flow.advanceFromScene();
            expect(result.type).toBe('end');
        });

        it('resets sceneHistory when choice loops back to the starting scene (covers history-reset branch)', () => {
            // scene_1 → choice:c1 → (loop) scene_1
            // sceneHistory = ['scene_1'], lastIndexOf('scene_1') = 0 → slice(0,0) = []
            // The empty-history guard fires and resets sceneHistory to [] before pushing.
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { loop: 'scene_1', forward: 'scene_2' },
                    },
                    {
                        kind: 'scene',
                        id: 'scene_2',
                        sceneId: 'scene_2',
                        next: null,
                    },
                ],
            };
            const flow = new SceneFlow(config);
            flow.advanceFromScene(); // → choice mode

            const result = flow.selectChoice('loop');
            expect(result).toEqual({ type: 'scene', sceneId: 'scene_1' });
            expect(flow.getCurrentSceneId()).toBe('scene_1');
        });
    });

    describe('getFlowNodes', () => {
        it('returns all nodes in the flow', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'scene_2',
                    },
                    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2' },
                ],
            };
            const flow = new SceneFlow(config);
            const nodes = flow.getFlowNodes();
            expect(nodes).toHaveLength(2);
            expect(nodes.some(n => n.id === 'scene_1')).toBe(true);
            expect(nodes.some(n => n.id === 'scene_2')).toBe(true);
        });
    });

    describe('getCurrentNodeId', () => {
        it('returns the current node id', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1', 'scene_2']);
            expect(flow.getCurrentNodeId()).toBe('scene_1');
            flow.advanceFromScene();
            expect(flow.getCurrentNodeId()).toBe('scene_2');
        });
    });

    describe('getCurrentChoiceId', () => {
        it('returns null when not in choice mode', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1']);
            expect(flow.getCurrentChoiceId()).toBeNull();
        });

        it('returns the choice id when in choice mode', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'my_choice',
                        nextByOption: { a: 'scene_2' },
                    },
                    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2' },
                ],
            };
            const flow = new SceneFlow(config);
            flow.advanceFromScene(); // → choice mode
            expect(flow.getCurrentChoiceId()).toBe('my_choice');
        });
    });

    describe('getCurrentChoiceOptionIds', () => {
        it('returns empty array when not in choice mode', () => {
            const flow = SceneFlow.fromLinearScenes(['scene_1']);
            expect(flow.getCurrentChoiceOptionIds()).toEqual([]);
        });

        it('returns option ids when in choice mode', () => {
            const config: FlowConfig = {
                start: 'scene_1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'scene_1',
                        sceneId: 'scene_1',
                        next: 'choice:c1',
                    },
                    {
                        kind: 'choice',
                        id: 'choice:c1',
                        choiceId: 'c1',
                        nextByOption: { opt_a: 'scene_2', opt_b: 'scene_3' },
                    },
                    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2' },
                    { kind: 'scene', id: 'scene_3', sceneId: 'scene_3' },
                ],
            };
            const flow = new SceneFlow(config);
            flow.advanceFromScene(); // → choice mode
            expect(flow.getCurrentChoiceOptionIds()).toEqual([
                'opt_a',
                'opt_b',
            ]);
        });
    });
});
