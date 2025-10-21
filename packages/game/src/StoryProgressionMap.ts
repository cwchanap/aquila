import Phaser from 'phaser';
import type { SceneId } from './SceneDirectory';
import type { FlowNodeDefinition } from './SceneFlow';

export interface ProgressionNodeVisual {
    nodeId: string;
    kind: 'scene' | 'choice';
    x: number;
    y: number;
    state: 'completed' | 'current' | 'locked';
    sceneId?: SceneId;
    choiceId?: string;
}

export interface ProgressionEdgeVisual {
    from: string;
    to: string;
    label?: string;
}

export interface StoryProgressionMapConfig {
    nodes: FlowNodeDefinition[];
    currentNodeId: string;
    completedHistory: string[];
    width: number;
    height: number;
    interactive?: boolean;
    locale?: string;
}

/**
 * Visualizes story progression with scenes, choices, and branches.
 * Supports automatic layout for linear and branching story structures.
 */
export class StoryProgressionMap {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private config: StoryProgressionMapConfig;
    private nodeVisuals: Map<string, Phaser.GameObjects.Container> = new Map();
    private edgeVisuals: Phaser.GameObjects.Graphics;
    private nodeData: Map<string, ProgressionNodeVisual> = new Map();

    // Visual constants
    private readonly NODE_RADIUS = 20;
    private readonly CHOICE_SIZE = 28;
    private readonly NODE_SPACING_X = 100;
    private readonly NODE_SPACING_Y = 80;
    private readonly COLORS = {
        completed: 0x4ade80, // Green
        current: 0x60a5fa, // Blue
        locked: 0x6b7280, // Gray
        choice: 0xfbbf24, // Yellow/Amber
        edge: 0x94a3b8, // Slate
        edgeCompleted: 0x86efac, // Light green
    };

    constructor(scene: Phaser.Scene, config: StoryProgressionMapConfig) {
        this.scene = scene;
        this.config = config;
        this.container = scene.add.container(0, 0);
        this.edgeVisuals = scene.add.graphics();
        this.container.add(this.edgeVisuals);

        this.buildLayout();
        this.render();
    }

    /**
     * Build the graph layout using a layered approach.
     * Scenes are positioned in layers, with branches spreading vertically.
     */
    private buildLayout(): void {
        const { nodes, currentNodeId, completedHistory } = this.config;
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Build adjacency graph
        const graph = this.buildGraph(nodes);

        // Compute layers (horizontal position)
        const layers = this.computeLayers(nodes, graph);

        // Assign positions
        this.assignPositions(layers, nodeMap, currentNodeId, completedHistory);
    }

    private buildGraph(nodes: FlowNodeDefinition[]): Map<string, string[]> {
        const graph = new Map<string, string[]>();

        for (const node of nodes) {
            if (node.kind === 'scene') {
                const next = node.next;
                if (next) {
                    graph.set(node.id, [next]);
                } else {
                    graph.set(node.id, []);
                }
            } else if (node.kind === 'choice') {
                const targets = Object.values(node.nextByOption);
                graph.set(node.id, targets);
            }
        }

        return graph;
    }

    private computeLayers(
        nodes: FlowNodeDefinition[],
        graph: Map<string, string[]>
    ): Map<number, string[]> {
        const layers = new Map<number, string[]>();
        const visited = new Set<string>();
        const nodeToLayer = new Map<string, number>();

        // Find start node (node with no incoming edges)
        const hasIncoming = new Set<string>();
        for (const targets of graph.values()) {
            targets.forEach(t => hasIncoming.add(t));
        }
        const startNodes = nodes
            .filter(n => !hasIncoming.has(n.id))
            .map(n => n.id);

        if (!startNodes.length && nodes.length > 0) {
            startNodes.push(nodes[0].id);
        }

        // BFS to assign layers
        const queue: Array<{ nodeId: string; layerNum: number }> = [];
        startNodes.forEach(id => {
            queue.push({ nodeId: id, layerNum: 0 });
            nodeToLayer.set(id, 0);
        });

        while (queue.length > 0) {
            const { nodeId, layerNum } = queue.shift()!;
            if (visited.has(nodeId)) continue;
            visited.add(nodeId);

            if (!layers.has(layerNum)) {
                layers.set(layerNum, []);
            }
            layers.get(layerNum)!.push(nodeId);

            const neighbors = graph.get(nodeId) ?? [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    const nextLayer = layerNum + 1;
                    const existingLayer = nodeToLayer.get(neighbor);
                    if (
                        existingLayer === undefined ||
                        nextLayer > existingLayer
                    ) {
                        nodeToLayer.set(neighbor, nextLayer);
                        queue.push({ nodeId: neighbor, layerNum: nextLayer });
                    }
                }
            }
        }

        return layers;
    }

    private assignPositions(
        layers: Map<number, string[]>,
        nodeMap: Map<string, FlowNodeDefinition>,
        currentNodeId: string,
        completedHistory: string[]
    ): void {
        const { width, height } = this.config;
        const layerCount = layers.size;
        const baseX = width * 0.1;
        const layerSpacing = Math.min(
            this.NODE_SPACING_X,
            (width * 0.8) / Math.max(1, layerCount - 1)
        );

        let layerIndex = 0;
        const sortedLayers = Array.from(layers.entries()).sort(
            (a, b) => a[0] - b[0]
        );
        for (const layerEntry of sortedLayers) {
            const nodeIds = layerEntry[1];
            const nodeCount = nodeIds.length;
            const startY =
                height / 2 - ((nodeCount - 1) * this.NODE_SPACING_Y) / 2;

            nodeIds.forEach((nodeId, index) => {
                const node = nodeMap.get(nodeId);
                if (!node) return;

                const x = baseX + layerIndex * layerSpacing;
                const y = startY + index * this.NODE_SPACING_Y;

                // Determine node state
                let state: 'completed' | 'current' | 'locked' = 'locked';
                if (nodeId === currentNodeId) {
                    state = 'current';
                } else if (
                    node.kind === 'scene' &&
                    completedHistory.includes(nodeId)
                ) {
                    // Scene nodes: check if they're in the completed history
                    state = 'completed';
                } else if (node.kind === 'choice') {
                    // Choice nodes: mark as completed if ANY of their outgoing scenes has been visited
                    const targetScenes = Object.values(node.nextByOption);
                    const hasVisitedAnyTarget = targetScenes.some(targetId =>
                        completedHistory.includes(targetId)
                    );
                    if (hasVisitedAnyTarget) {
                        state = 'completed';
                    }
                }

                const visual: ProgressionNodeVisual = {
                    nodeId,
                    kind: node.kind,
                    x,
                    y,
                    state,
                    sceneId: node.kind === 'scene' ? node.sceneId : undefined,
                    choiceId:
                        node.kind === 'choice' ? node.choiceId : undefined,
                };

                this.nodeData.set(nodeId, visual);
            });

            layerIndex++;
        }
    }

    private render(): void {
        // Draw edges first (so they're behind nodes)
        this.drawEdges();

        // Draw nodes
        this.drawNodes();
    }

    private drawEdges(): void {
        const { nodes } = this.config;
        this.edgeVisuals.clear();

        for (const node of nodes) {
            const fromData = this.nodeData.get(node.id);
            if (!fromData) continue;

            let targets: string[] = [];
            const edgeLabels: Record<string, string> = {};

            if (node.kind === 'scene') {
                if (node.next) {
                    targets = [node.next];
                }
            } else if (node.kind === 'choice') {
                targets = Object.values(node.nextByOption);
                // Map target to option label
                for (const [option, target] of Object.entries(
                    node.nextByOption
                )) {
                    edgeLabels[target] = option;
                }
            }

            for (const target of targets) {
                const toData = this.nodeData.get(target);
                if (!toData) continue;

                const isCompleted =
                    fromData.state === 'completed' && toData.state !== 'locked';
                const color = isCompleted
                    ? this.COLORS.edgeCompleted
                    : this.COLORS.edge;
                const alpha = isCompleted ? 0.8 : 0.4;

                this.edgeVisuals.lineStyle(3, color, alpha);
                this.edgeVisuals.lineBetween(
                    fromData.x,
                    fromData.y,
                    toData.x,
                    toData.y
                );

                // Draw arrow head
                const angle = Math.atan2(
                    toData.y - fromData.y,
                    toData.x - fromData.x
                );
                const arrowSize = 10;
                const targetRadius =
                    toData.kind === 'choice'
                        ? this.CHOICE_SIZE / 2
                        : this.NODE_RADIUS;
                const arrowX = toData.x - Math.cos(angle) * (targetRadius + 5);
                const arrowY = toData.y - Math.sin(angle) * (targetRadius + 5);

                this.edgeVisuals.fillStyle(color, alpha);
                this.edgeVisuals.fillTriangle(
                    arrowX,
                    arrowY,
                    arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
                    arrowY - arrowSize * Math.sin(angle - Math.PI / 6),
                    arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
                    arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
                );
            }
        }
    }

    private drawNodes(): void {
        for (const [nodeId, data] of this.nodeData.entries()) {
            const nodeContainer = this.scene.add.container(data.x, data.y);

            if (data.kind === 'scene') {
                this.drawSceneNode(nodeContainer, data);
            } else {
                this.drawChoiceNode(nodeContainer, data);
            }

            this.container.add(nodeContainer);
            this.nodeVisuals.set(nodeId, nodeContainer);

            // Add interactivity
            if (this.config.interactive) {
                this.makeNodeInteractive(nodeContainer, data);
            }
        }
    }

    private drawSceneNode(
        container: Phaser.GameObjects.Container,
        data: ProgressionNodeVisual
    ): void {
        const color =
            data.state === 'completed'
                ? this.COLORS.completed
                : data.state === 'current'
                  ? this.COLORS.current
                  : this.COLORS.locked;

        const alpha = data.state === 'locked' ? 0.4 : 1;

        // Outer circle
        const circle = this.scene.add.circle(
            0,
            0,
            this.NODE_RADIUS,
            color,
            alpha
        );
        circle.setStrokeStyle(2, 0xffffff, data.state === 'locked' ? 0.3 : 0.6);
        container.add(circle);

        // Inner fill for current node (pulsing effect)
        if (data.state === 'current') {
            const innerCircle = this.scene.add.circle(
                0,
                0,
                this.NODE_RADIUS - 6,
                0xffffff,
                0.3
            );
            container.add(innerCircle);

            // Add pulse animation
            this.scene.tweens.add({
                targets: innerCircle,
                alpha: 0.6,
                scale: 1.2,
                duration: 800,
                yoyo: true,
                repeat: -1,
            });
        }

        // Checkmark for completed nodes
        if (data.state === 'completed') {
            const checkmark = this.scene.add
                .text(0, 0, '✓', {
                    fontSize: '24px',
                    color: '#ffffff',
                })
                .setOrigin(0.5);
            container.add(checkmark);
        }
    }

    private drawChoiceNode(
        container: Phaser.GameObjects.Container,
        data: ProgressionNodeVisual
    ): void {
        const color =
            data.state === 'completed'
                ? this.COLORS.completed
                : data.state === 'current'
                  ? this.COLORS.choice
                  : this.COLORS.locked;

        const alpha = data.state === 'locked' ? 0.4 : 0.9;
        const size = this.CHOICE_SIZE;

        // Diamond shape
        const diamond = this.scene.add.graphics();
        diamond.fillStyle(color, alpha);
        diamond.fillPoints(
            [
                new Phaser.Geom.Point(0, -size / 2),
                new Phaser.Geom.Point(size / 2, 0),
                new Phaser.Geom.Point(0, size / 2),
                new Phaser.Geom.Point(-size / 2, 0),
            ],
            true
        );
        diamond.lineStyle(2, 0xffffff, data.state === 'locked' ? 0.3 : 0.6);
        diamond.strokePoints(
            [
                new Phaser.Geom.Point(0, -size / 2),
                new Phaser.Geom.Point(size / 2, 0),
                new Phaser.Geom.Point(0, size / 2),
                new Phaser.Geom.Point(-size / 2, 0),
            ],
            true
        );

        container.add(diamond);

        // Question mark icon
        if (data.state !== 'completed') {
            const icon = this.scene.add
                .text(0, 0, '?', {
                    fontSize: '20px',
                    color: '#ffffff',
                })
                .setOrigin(0.5);
            container.add(icon);
        }
    }

    private makeNodeInteractive(
        container: Phaser.GameObjects.Container,
        data: ProgressionNodeVisual
    ): void {
        const hitArea = new Phaser.Geom.Circle(0, 0, this.NODE_RADIUS + 10);
        container.setInteractive(hitArea, Phaser.Geom.Circle.Contains);
        container.on('pointerover', () => {
            this.scene.input.setDefaultCursor('pointer');
            container.setScale(1.1);

            // Show tooltip
            this.showTooltip(data);
        });
        container.on('pointerout', () => {
            this.scene.input.setDefaultCursor('default');
            container.setScale(1);
            this.hideTooltip();
        });
        container.on('pointerup', () => {
            this.emit('nodeClicked', data);
        });
    }

    private tooltipContainer?: Phaser.GameObjects.Container;

    private showTooltip(data: ProgressionNodeVisual): void {
        this.hideTooltip();

        const tooltipText =
            data.kind === 'scene'
                ? `Scene: ${data.sceneId}`
                : `Choice: ${data.choiceId}`;

        const text = this.scene.add
            .text(data.x, data.y - 50, tooltipText, {
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: '#00000099',
                padding: { x: 10, y: 6 },
            })
            .setOrigin(0.5);

        this.tooltipContainer = this.scene.add.container(0, 0);
        this.tooltipContainer.add(text);
        this.tooltipContainer.setDepth(1000);
        this.container.add(this.tooltipContainer);
    }

    private hideTooltip(): void {
        if (this.tooltipContainer) {
            this.tooltipContainer.destroy();
            this.tooltipContainer = undefined;
        }
    }

    private eventEmitter = new Phaser.Events.EventEmitter();

    public on(event: string, fn: (...args: unknown[]) => void): void {
        this.eventEmitter.on(event, fn);
    }

    private emit(event: string, ...args: unknown[]): void {
        this.eventEmitter.emit(event, ...args);
    }

    public destroy(): void {
        this.nodeVisuals.forEach(node => node.destroy());
        this.edgeVisuals.destroy();
        this.container.destroy();
        this.eventEmitter.removeAllListeners();
    }

    public getContainer(): Phaser.GameObjects.Container {
        return this.container;
    }

    /**
     * Update the map with new progress state
     */
    public update(currentNodeId: string, completedHistory: string[]): void {
        this.config.currentNodeId = currentNodeId;
        this.config.completedHistory = completedHistory;

        // Build node lookup for checking choice targets
        const nodeMap = new Map<string, FlowNodeDefinition>(
            this.config.nodes.map(n => [n.id, n])
        );

        // Update node states
        for (const [nodeId, data] of this.nodeData.entries()) {
            if (nodeId === currentNodeId) {
                data.state = 'current';
            } else {
                const node = nodeMap.get(nodeId);
                if (
                    node?.kind === 'scene' &&
                    completedHistory.includes(nodeId)
                ) {
                    // Scene nodes: check if they're in the completed history
                    data.state = 'completed';
                } else if (node?.kind === 'choice') {
                    // Choice nodes: mark as completed if ANY of their outgoing scenes has been visited
                    const targetScenes = Object.values(node.nextByOption);
                    const hasVisitedAnyTarget = targetScenes.some(targetId =>
                        completedHistory.includes(targetId)
                    );
                    data.state = hasVisitedAnyTarget ? 'completed' : 'locked';
                } else {
                    data.state = 'locked';
                }
            }
        }

        // Re-render
        this.nodeVisuals.forEach(node => node.destroy());
        this.nodeVisuals.clear();
        this.render();
    }
}
