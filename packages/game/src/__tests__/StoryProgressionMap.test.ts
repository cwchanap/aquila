import { describe, it, expect, vi } from 'vitest';
import { StoryProgressionMap } from '../StoryProgressionMap';
import { makeMockScene } from './phaserMock';
import type { FlowNodeDefinition } from '../SceneFlow';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeScene = () => makeMockScene() as any;

// ── Flow fixtures ──────────────────────────────────────────────────────────

const linearNodes: FlowNodeDefinition[] = [
    { kind: 'scene', id: 'scene_1', sceneId: 'scene_1', next: 'scene_2' },
    { kind: 'scene', id: 'scene_2', sceneId: 'scene_2', next: null },
];

const branchingNodes: FlowNodeDefinition[] = [
    { kind: 'scene', id: 'scene_1', sceneId: 'scene_1', next: 'scene_2' },
    {
        kind: 'scene',
        id: 'scene_2',
        sceneId: 'scene_2',
        next: 'choice:c1',
    },
    {
        kind: 'choice',
        id: 'choice:c1',
        choiceId: 'c1',
        nextByOption: { opt_a: 'scene_3a', opt_b: 'scene_3b' },
    },
    { kind: 'scene', id: 'scene_3a', sceneId: 'scene_3a', next: null },
    { kind: 'scene', id: 'scene_3b', sceneId: 'scene_3b', next: null },
];

const baseConfig = (
    nodes: FlowNodeDefinition[],
    currentNodeId = 'scene_1',
    completedHistory: string[] = ['scene_1']
) => ({
    nodes,
    currentNodeId,
    completedHistory,
    width: 800,
    height: 400,
    interactive: false,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('StoryProgressionMap', () => {
    describe('construction', () => {
        it('creates an instance with a linear flow without throwing', () => {
            expect(
                () =>
                    new StoryProgressionMap(
                        makeScene(),
                        baseConfig(linearNodes)
                    )
            ).not.toThrow();
        });

        it('creates an instance with a branching flow without throwing', () => {
            expect(
                () =>
                    new StoryProgressionMap(
                        makeScene(),
                        baseConfig(branchingNodes)
                    )
            ).not.toThrow();
        });

        it('creates a container and edges graphics via scene.add', () => {
            const scene = makeScene();
            new StoryProgressionMap(scene, baseConfig(linearNodes));
            expect(scene.add.container).toHaveBeenCalled();
            expect(scene.add.graphics).toHaveBeenCalled();
        });

        it('creates node visuals via scene.add.container for each node', () => {
            const scene = makeScene();
            new StoryProgressionMap(scene, baseConfig(linearNodes));
            // One for the root container + one per node (2 nodes)
            expect(scene.add.container).toHaveBeenCalledTimes(
                1 + linearNodes.length
            );
        });

        it('renders choice nodes as graphics (diamond shape)', () => {
            const scene = makeScene();
            new StoryProgressionMap(scene, baseConfig(branchingNodes));
            // graphics called for: edgeVisuals + 1 choice diamond
            expect(scene.add.graphics).toHaveBeenCalledTimes(2);
        });
    });

    describe('getContainer', () => {
        it('returns the container created during construction', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(scene, baseConfig(linearNodes));
            const container = map.getContainer();
            expect(container).toBeDefined();
            // It should be the first container created (the root one)
            expect(container).toBe(scene.add.container.mock.results[0].value);
        });
    });

    describe('update', () => {
        it('does not throw when called with valid state', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(scene, baseConfig(linearNodes));
            expect(() =>
                map.update('scene_2', ['scene_1', 'scene_2'])
            ).not.toThrow();
        });

        it('re-renders nodes after update', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(scene, baseConfig(linearNodes));
            const containerCallsBefore = scene.add.container.mock.calls.length;
            map.update('scene_2', ['scene_1', 'scene_2']);
            // New node containers should be created during re-render
            expect(scene.add.container.mock.calls.length).toBeGreaterThan(
                containerCallsBefore
            );
        });

        it('handles update with all nodes completed', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(
                scene,
                baseConfig(linearNodes, 'scene_2', ['scene_1'])
            );
            expect(() =>
                map.update('scene_2', ['scene_1', 'scene_2'])
            ).not.toThrow();
        });
    });

    describe('event subscription', () => {
        it('on() registers a nodeClicked listener without throwing', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(scene, baseConfig(linearNodes));
            const handler = vi.fn();
            expect(() => map.on('nodeClicked', handler)).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('does not throw', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(scene, baseConfig(linearNodes));
            expect(() => map.destroy()).not.toThrow();
        });

        it('destroys the root container', () => {
            const scene = makeScene();
            const map = new StoryProgressionMap(scene, baseConfig(linearNodes));
            const container = map.getContainer();
            map.destroy();
            expect(container.destroy).toHaveBeenCalled();
        });
    });
});
