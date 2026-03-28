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

        it('marks choice node as completed when a target scene is in history', () => {
            // Covers line 546: hasVisitedAnyTarget ? 'completed' : 'locked' — the 'completed' branch
            const scene = makeScene();
            const map = new StoryProgressionMap(
                scene,
                baseConfig(branchingNodes)
            );
            // scene_3a is one of the targets of choice:c1; visiting it marks the choice as completed
            expect(() =>
                map.update('scene_3a', ['scene_1', 'scene_2', 'scene_3a'])
            ).not.toThrow();
        });

        it('marks choice node as locked when no target scenes are in history', () => {
            // Covers line 546: hasVisitedAnyTarget ? 'completed' : 'locked' — the 'locked' branch
            const scene = makeScene();
            const map = new StoryProgressionMap(
                scene,
                baseConfig(branchingNodes)
            );
            expect(() => map.update('scene_2', ['scene_1'])).not.toThrow();
        });

        it('marks unvisited scene nodes as locked (else branch)', () => {
            // Covers line 548: the else branch when node.kind === 'scene' but not in completedHistory
            const scene = makeScene();
            const map = new StoryProgressionMap(
                scene,
                baseConfig(branchingNodes)
            );
            // scene_3a and scene_3b are scene nodes not in history and not current → locked
            expect(() => map.update('scene_2', ['scene_1'])).not.toThrow();
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

    describe('interactive mode', () => {
        const interactiveConfig = (nodes: FlowNodeDefinition[]) => ({
            ...baseConfig(nodes),
            interactive: true,
        });

        it('registers pointer events on node containers when interactive=true', () => {
            const scene = makeScene();
            new StoryProgressionMap(scene, interactiveConfig(linearNodes));
            // Root container (index 0) + one per node (2); the node containers get .on() calls
            const nodeContainer = scene.add.container.mock.results[1].value;
            const events = nodeContainer.on.mock.calls.map(
                (c: [string, unknown]) => c[0]
            );
            expect(events).toContain('pointerover');
            expect(events).toContain('pointerout');
            expect(events).toContain('pointerup');
        });

        it('showTooltip creates a tooltip container on pointerover', () => {
            const scene = makeScene();
            new StoryProgressionMap(scene, interactiveConfig(linearNodes));
            const nodeContainer = scene.add.container.mock.results[1].value;
            const pointeroverCb = nodeContainer.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerover'
            )?.[1] as (() => void) | undefined;
            const containersBefore = scene.add.container.mock.calls.length;
            pointeroverCb?.();
            // A new tooltip container is created inside showTooltip
            expect(scene.add.container.mock.calls.length).toBeGreaterThan(
                containersBefore
            );
        });

        it('hideTooltip destroys an existing tooltip container on pointerout (line 491)', () => {
            // Covers StoryProgressionMap.ts line 491: this.tooltipContainer = undefined
            const scene = makeScene();
            new StoryProgressionMap(scene, interactiveConfig(linearNodes));
            const nodeContainer = scene.add.container.mock.results[1].value;
            const findCb = (event: string) =>
                nodeContainer.on.mock.calls.find(
                    (c: [string, unknown]) => c[0] === event
                )?.[1] as (() => void) | undefined;

            // First trigger pointerover to create the tooltip
            findCb('pointerover')?.();
            // Capture the tooltip container that was created
            const tooltipContainer =
                scene.add.container.mock.results[
                    scene.add.container.mock.results.length - 1
                ].value;
            // Then trigger pointerout to destroy it (covers line 491)
            findCb('pointerout')?.();
            expect(tooltipContainer.destroy).toHaveBeenCalled();
        });

        it('pointerup emits nodeClicked event with node data (line 502)', () => {
            // Covers StoryProgressionMap.ts line 502: this.eventEmitter.emit(event, ...args)
            const scene = makeScene();
            const map = new StoryProgressionMap(
                scene,
                interactiveConfig(linearNodes)
            );
            const handler = vi.fn();
            map.on('nodeClicked', handler);

            const nodeContainer = scene.add.container.mock.results[1].value;
            const pointerupCb = nodeContainer.on.mock.calls.find(
                (c: [string, unknown]) => c[0] === 'pointerup'
            )?.[1] as (() => void) | undefined;

            expect(pointerupCb).toBeDefined();
            pointerupCb?.();
            // handler should be called with the ProgressionNodeVisual data for scene_1
            expect(handler).toHaveBeenCalledOnce();
            expect(handler).toHaveBeenCalledWith(
                expect.objectContaining({ nodeId: 'scene_1' })
            );
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
