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
    });
});
