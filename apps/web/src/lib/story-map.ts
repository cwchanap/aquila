import type {
    ChoiceMap,
    ChoiceNodeDefinition,
    FlowNodeDefinition,
    StoryFlowConfig,
    Translations,
} from '@aquila/stories';
import type { StoryProgress } from './story-progress-store';
import {
    actLabel,
    actRangeLabel,
    actSortKey,
    extractActName,
} from './act-navigation';

type Flow = Pick<StoryFlowConfig, 'start' | 'nodes'>;

export type StoryMapStatus = 'route' | 'explored' | 'unread';

export interface StoryMapUnknown {
    kind: 'unknown';
    id: string;
    status: 'unread';
}

export interface StoryMapEnding {
    kind: 'ending';
    id: string;
    /** Terminal scene this marker belongs to; also the jump target. */
    sceneId: string;
    label: string;
    status: 'route' | 'explored';
}

export interface StoryMapRun {
    kind: 'run';
    /** Stable key: the first scene id of the run. */
    id: string;
    /** Revealed scenes in reading order; never contains unread scenes. */
    sceneIds: readonly string[];
    /** Legal jump target for the run. */
    entrySceneId: string;
    /** Collapsed label: `Act N` or `Acts N–M` (localized). */
    label: string;
    /** Sort key of the run's first act (see act-navigation). */
    sortKey: number;
    status: 'route' | 'explored';
    /** Leading scene count on the root-to-current path; scenes after this
     *  cutoff were read but are ahead of the reader's position. */
    routeCount: number;
    /** True when the run contains the reader's current scene. */
    current: boolean;
    /** The reader's scene id, present only when current is true. */
    currentSceneId?: string;
    next: StoryMapDecision | StoryMapUnknown | StoryMapEnding | null;
}

export interface StoryMapOption {
    id: string;
    label: string;
    child: StoryMapRun | StoryMapUnknown;
}

export interface StoryMapDecision {
    kind: 'decision';
    /** Stable key: the flow choice node id (`choice:<choiceId>`). */
    id: string;
    choiceId: string;
    status: 'route' | 'explored';
    options: readonly StoryMapOption[];
}

export type StoryMapNode =
    StoryMapRun | StoryMapDecision | StoryMapUnknown | StoryMapEnding;

export interface StoryMapStats {
    acts: number;
    decisions: number;
    endings: number;
}

export interface StoryMapView {
    root: StoryMapRun | null;
    stats: StoryMapStats;
}

export interface StoryMapMetrics {
    paddingX: number;
    paddingY: number;
    rowHeight: number;
    nodeHeight: number;
    columnGap: number;
    trunkGap: number;
    runWidth: number;
    sceneWidth: number;
    sceneGap: number;
    decisionWidth: number;
    markerWidth: number;
}

export type StoryMapLayoutNodeKind =
    'run' | 'scene' | 'decision' | 'unknown' | 'ending';

export interface StoryMapLayoutNode {
    id: string;
    kind: StoryMapLayoutNodeKind;
    x: number;
    y: number;
    width: number;
    height: number;
    row: number;
    status: StoryMapStatus;
    label?: string;
    sceneId?: string;
    current?: boolean;
}

export type StoryMapLayoutEdgeKind = 'link' | 'trunk' | 'branch';

export interface StoryMapLayoutEdge {
    id: string;
    kind: StoryMapLayoutEdgeKind;
    from: string;
    to: string;
    /** SVG path data: straight for same-row links and trunk segments,
     *  cubic bezier for branch offshoots. */
    d: string;
    label?: string;
}

export interface StoryMapLayout {
    nodes: StoryMapLayoutNode[];
    edges: StoryMapLayoutEdge[];
    bounds: { width: number; height: number };
}

interface FlowIndex {
    byId: Map<string, FlowNodeDefinition>;
    parent: Map<string, string>;
    /** Node ids reachable from `flow.start`; everything else is ignored. */
    reachable: Set<string>;
}

function indexFlow(flow: Pick<StoryFlowConfig, 'start' | 'nodes'>): FlowIndex {
    const byId = new Map<string, FlowNodeDefinition>();
    const parent = new Map<string, string>();
    for (const node of flow.nodes) {
        byId.set(node.id, node);
    }
    for (const node of flow.nodes) {
        if (node.kind === 'scene') {
            if (node.next && !parent.has(node.next)) {
                parent.set(node.next, node.id);
            }
        } else {
            for (const target of Object.values(node.nextByOption)) {
                if (!parent.has(target)) parent.set(target, node.id);
            }
        }
    }
    const reachable = new Set<string>();
    const stack: string[] = [flow.start];
    while (stack.length > 0) {
        const id = stack.pop()!;
        if (reachable.has(id)) continue;
        const node = byId.get(id);
        if (!node) continue;
        reachable.add(id);
        if (node.kind === 'scene') {
            if (node.next) stack.push(node.next);
        } else {
            stack.push(...Object.values(node.nextByOption));
        }
    }
    return { byId, parent, reachable };
}

function addAncestorChain(
    id: string,
    index: FlowIndex,
    into: Set<string>
): void {
    let cur: string | undefined = id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
        seen.add(cur);
        const node = index.byId.get(cur);
        // An unreachable node's ancestors are unreachable too, so a chain
        // that leaves the reachable graph contributes nothing.
        if (!node || !index.reachable.has(cur)) return;
        if (node.kind === 'scene') into.add(node.sceneId);
        cur = index.parent.get(cur);
    }
}

function collectVisible(
    index: FlowIndex,
    visited: readonly string[] | undefined,
    currentSceneId: string | null | undefined
): Set<string> {
    const visible = new Set<string>();
    for (const id of visited ?? []) {
        addAncestorChain(id, index, visible);
    }
    if (currentSceneId) addAncestorChain(currentSceneId, index, visible);
    return visible;
}

export function hasRealDecision(flow: Pick<StoryFlowConfig, 'nodes'>): boolean {
    return flow.nodes.some(
        node =>
            node.kind === 'choice' && Object.keys(node.nextByOption).length >= 2
    );
}

/**
 * Scene ids the reader may legitimately see: every recorded `visited` scene
 * plus the current scene, closed over ancestors back to the flow root so a
 * direct link or bookmark reveals a continuous path — without exposing any
 * sibling or descendant scenes that were never read. Scenes unreachable from
 * `flow.start` can never become visible, even if recorded as visited.
 */
export function visibleSceneIds(
    flow: Pick<StoryFlowConfig, 'start' | 'nodes'>,
    progress: Pick<StoryProgress, 'visited'> | null | undefined,
    currentSceneId: string | null | undefined
): ReadonlySet<string> {
    return collectVisible(indexFlow(flow), progress?.visited, currentSceneId);
}

export function buildStoryMap({
    flow,
    choices,
    progress,
    currentSceneId,
    t,
}: {
    flow: Flow;
    choices: ChoiceMap;
    progress: StoryProgress | null | undefined;
    currentSceneId: string | null | undefined;
    t: Translations;
}): StoryMapView {
    const index = indexFlow(flow);
    const visible = collectVisible(index, progress?.visited, currentSceneId);

    const endings = new Set(progress?.endings ?? []);
    const acts = new Set<string>();
    const stats: StoryMapStats = { acts: 0, decisions: 0, endings: 0 };

    // The route is the root-to-current path: current scene plus its ancestors.
    const route = new Set<string>();
    {
        let cur: string | undefined = currentSceneId ?? undefined;
        const seen = new Set<string>();
        while (cur && !seen.has(cur)) {
            seen.add(cur);
            route.add(cur);
            cur = index.parent.get(cur);
        }
    }

    // Guards a malformed cyclic flow into a frontier instead of looping.
    const emitted = new Set<string>();

    const unknown = (id: string): StoryMapUnknown => ({
        kind: 'unknown',
        id,
        status: 'unread',
    });

    const runLabel = (sceneIds: string[]): string => {
        const first = extractActName(sceneIds[0] ?? '');
        const last = extractActName(sceneIds[sceneIds.length - 1] ?? '');
        if (!first && !last) return '';
        if (first === last || !last) return actLabel(first, t);
        if (!first) return actLabel(last, t);
        return actRangeLabel(first, last, t);
    };

    function buildDecision(node: ChoiceNodeDefinition): StoryMapDecision {
        stats.decisions++;
        const def = choices[node.choiceId];
        const ordered = def?.options.length
            ? def.options.map(o => o.id).filter(id => id in node.nextByOption)
            : Object.keys(node.nextByOption);
        for (const id of Object.keys(node.nextByOption)) {
            if (!ordered.includes(id)) ordered.push(id);
        }
        return {
            kind: 'decision',
            id: node.id,
            choiceId: node.choiceId,
            status: route.has(node.id) ? 'route' : 'explored',
            options: ordered.map(optionId => {
                const dest = node.nextByOption[optionId];
                const destNode = index.byId.get(dest);
                const revealed =
                    destNode?.kind === 'scene' &&
                    visible.has(destNode.sceneId) &&
                    !emitted.has(destNode.sceneId);
                return {
                    id: optionId,
                    label:
                        def?.options.find(o => o.id === optionId)?.label ??
                        optionId,
                    child: revealed
                        ? buildRun(dest)
                        : unknown(`unknown:${node.id}:${optionId}`),
                };
            }),
        };
    }

    function buildRun(startSceneId: string): StoryMapRun {
        const sceneIds: string[] = [];
        let node = index.byId.get(startSceneId);
        let terminalScene: string | null = null;
        let pendingDecision: ChoiceNodeDefinition | null = null;
        let frontier: string | null = null;

        while (node && node.kind === 'scene' && visible.has(node.sceneId)) {
            if (emitted.has(node.sceneId)) {
                frontier = `unknown:${node.id}`;
                break;
            }
            emitted.add(node.sceneId);
            sceneIds.push(node.sceneId);
            const act = extractActName(node.sceneId);
            if (act) acts.add(act);

            const nextId = node.next;
            if (nextId == null) {
                terminalScene = node.sceneId;
                break;
            }
            const target = index.byId.get(nextId);
            if (!target) {
                frontier = `unknown:${node.id}`;
                break;
            }
            if (target.kind === 'choice') {
                const optionIds = Object.keys(target.nextByOption);
                if (optionIds.length <= 1) {
                    // A single-option choice is a link, not a fork.
                    const dest = optionIds[0]
                        ? target.nextByOption[optionIds[0]]
                        : undefined;
                    const destNode = dest ? index.byId.get(dest) : undefined;
                    if (
                        destNode &&
                        destNode.kind === 'scene' &&
                        visible.has(destNode.sceneId)
                    ) {
                        node = destNode;
                        continue;
                    }
                    frontier = `unknown:${node.id}`;
                    break;
                }
                const passed = optionIds.some(optionId =>
                    visible.has(target.nextByOption[optionId])
                );
                if (passed) pendingDecision = target;
                else frontier = `unknown:${node.id}`;
                break;
            }
            if (visible.has(target.sceneId)) {
                node = target;
                continue;
            }
            frontier = `unknown:${node.id}`;
            break;
        }

        const cutoff = sceneIds.findIndex(id => !route.has(id));
        const routeCount = cutoff === -1 ? sceneIds.length : cutoff;
        const status = routeCount > 0 ? 'route' : 'explored';
        let next: StoryMapRun['next'] = null;
        if (pendingDecision) {
            next = buildDecision(pendingDecision);
        } else if (terminalScene && endings.has(terminalScene)) {
            stats.endings++;
            next = {
                kind: 'ending',
                id: `ending:${terminalScene}`,
                sceneId: terminalScene,
                label: actLabel(extractActName(terminalScene), t),
                status: route.has(terminalScene) ? 'route' : 'explored',
            };
        } else if (terminalScene || frontier) {
            next = unknown(frontier ?? `unknown:${terminalScene}`);
        }

        const current =
            currentSceneId != null && sceneIds.includes(currentSceneId);
        return {
            kind: 'run',
            id: sceneIds[0] ?? startSceneId,
            sceneIds,
            entrySceneId: sceneIds[0] ?? '',
            label: runLabel(sceneIds),
            sortKey: actSortKey(
                extractActName(sceneIds[0] ?? '') ||
                    extractActName(sceneIds[sceneIds.length - 1] ?? '')
            ),
            status,
            routeCount,
            current,
            ...(current && currentSceneId ? { currentSceneId } : {}),
            next,
        };
    }

    const startNode = index.byId.get(flow.start);
    const root =
        startNode?.kind === 'scene' && visible.has(startNode.sceneId)
            ? buildRun(flow.start)
            : null;
    stats.acts = acts.size;
    return { root, stats };
}

/**
 * Positions the view model as a horizontal railway map: the current route
 * stays on row 0 and side branches occupy contiguous bands allocated deepest
 * decisions first, so siblings fan out of a shared trunk. Expanded runs emit
 * one node per scene — widening only their own horizontal footprint.
 */
export function layoutStoryMap(
    view: StoryMapView,
    expandedRunIds: ReadonlySet<string>,
    metrics: StoryMapMetrics
): StoryMapLayout {
    const nodes: StoryMapLayoutNode[] = [];
    const edges: StoryMapLayoutEdge[] = [];
    if (!view.root) {
        return { nodes, edges, bounds: { width: 0, height: 0 } };
    }
    const m = metrics;
    const byId = new Map<string, StoryMapLayoutNode>();
    let maxRight = 0;
    let maxRow = 0;

    const rowsOf = (node: StoryMapNode): number => {
        if (node.kind === 'run') {
            return node.next ? rowsOf(node.next) : 1;
        }
        if (node.kind === 'decision') {
            return node.options.reduce(
                (sum, option) => sum + rowsOf(option.child),
                0
            );
        }
        return 1;
    };

    const yOf = (row: number): number =>
        m.paddingY + row * m.rowHeight + (m.rowHeight - m.nodeHeight) / 2;
    const cyOf = (row: number): number =>
        m.paddingY + row * m.rowHeight + m.rowHeight / 2;

    const emit = (node: StoryMapLayoutNode): void => {
        nodes.push(node);
        byId.set(node.id, node);
        maxRight = Math.max(maxRight, node.x + node.width);
        maxRow = Math.max(maxRow, node.row);
    };

    const edge = (
        kind: StoryMapLayoutEdgeKind,
        from: string,
        to: string,
        d: string,
        label?: string
    ): void => {
        edges.push({
            id: kind === 'trunk' ? `trunk:${from}` : `${from}->${to}`,
            kind,
            from,
            to,
            d,
            ...(label ? { label } : {}),
        });
    };

    const straightEdge = (from: string, to: string, label?: string): void => {
        const a = byId.get(from);
        const b = byId.get(to);
        if (!a || !b) return;
        edge(
            'link',
            from,
            to,
            `M ${a.x + a.width} ${cyOf(a.row)} L ${b.x} ${cyOf(b.row)}`,
            label
        );
    };

    /** The one shared segment a decision's side branches depart from: a stub
     *  leaving the decision at its row, then a vertical trunk reaching the
     *  deepest sibling band. */
    const trunkEdge = (
        from: string,
        to: string,
        trunkX: number,
        lastRow: number
    ): void => {
        const a = byId.get(from);
        if (!a) return;
        const x0 = a.x + a.width;
        const y = cyOf(a.row);
        edge(
            'trunk',
            from,
            to,
            `M ${x0} ${y} L ${trunkX} ${y} L ${trunkX} ${cyOf(lastRow)}`
        );
    };

    /** Offshoot from the shared trunk at the child's own row height. */
    const branchEdge = (
        from: string,
        to: string,
        trunkX: number,
        label: string
    ): void => {
        const b = byId.get(to);
        if (!b) return;
        const y = cyOf(b.row);
        const bend = (b.x - trunkX) / 2;
        edge(
            'branch',
            from,
            to,
            `M ${trunkX} ${y} C ${trunkX + bend} ${y} ${b.x - bend} ${y} ${b.x} ${y}`,
            label
        );
    };

    const place = (node: StoryMapNode, row: number, x: number): void => {
        if (node.kind === 'run') {
            let cursor = x;
            let lastId = '';
            const emitLink = (
                id: string,
                kind: StoryMapLayoutNodeKind,
                width: number,
                extra: Partial<StoryMapLayoutNode>
            ): void => {
                emit({
                    id,
                    kind,
                    x: cursor,
                    y: yOf(row),
                    width,
                    height: m.nodeHeight,
                    row,
                    status: node.status,
                    ...extra,
                });
                if (lastId) straightEdge(lastId, id);
                lastId = id;
                cursor += width;
            };
            if (expandedRunIds.has(node.id) || node.current) {
                // The current act is always unfolded; per-scene route
                // membership stops coloring at the reader's position.
                node.sceneIds.forEach((sceneId, i) => {
                    emitLink(sceneId, 'scene', m.sceneWidth, {
                        sceneId,
                        status: i < node.routeCount ? 'route' : 'explored',
                        current: sceneId === node.currentSceneId,
                    });
                    cursor += m.sceneGap;
                });
                cursor -= m.sceneGap;
            } else {
                emitLink(node.id, 'run', m.runWidth, {
                    label: node.label,
                    sceneId: node.entrySceneId,
                    current: node.current,
                });
            }
            if (node.next) {
                place(node.next, row, cursor + m.columnGap);
                straightEdge(lastId, node.next.id);
            }
            return;
        }
        if (node.kind === 'decision') {
            emit({
                id: node.id,
                kind: 'decision',
                x,
                y: yOf(row),
                width: m.decisionWidth,
                height: m.nodeHeight,
                row,
                status: node.status,
            });
            const childX = x + m.decisionWidth + m.columnGap;
            const trunkX = x + m.decisionWidth + m.trunkGap;
            const primary = node.options.findIndex(
                o => o.child.kind === 'run' && o.child.status === 'route'
            );
            const order = node.options.map((_, i) => i);
            if (primary >= 0) {
                order.splice(order.indexOf(primary), 1);
                order.unshift(primary);
            }
            const childRows = order.map(i => rowsOf(node.options[i].child));
            // Emit the shared trunk first so it renders behind its offshoots.
            if (order.length > 1) {
                const lastSideBandTop =
                    row + childRows.slice(0, -1).reduce((s, n) => s + n, 0);
                trunkEdge(
                    node.id,
                    node.options[order[order.length - 1]].child.id,
                    trunkX,
                    lastSideBandTop
                );
            }
            let bandTop = row;
            order.forEach((optionIndex, placed) => {
                const option = node.options[optionIndex];
                place(option.child, bandTop, childX);
                if (placed === 0) {
                    straightEdge(node.id, option.child.id, option.label);
                } else {
                    branchEdge(node.id, option.child.id, trunkX, option.label);
                }
                bandTop += childRows[placed];
            });
            return;
        }
        emit({
            id: node.id,
            kind: node.kind,
            x,
            y: yOf(row),
            width: m.markerWidth,
            height: m.nodeHeight,
            row,
            status: node.status,
            ...(node.kind === 'unknown' ? { label: '?' } : {}),
            ...(node.kind === 'ending'
                ? { label: node.label, sceneId: node.sceneId }
                : {}),
        });
    };

    place(view.root, 0, m.paddingX);
    return {
        nodes,
        edges,
        bounds: {
            width: maxRight + m.paddingX,
            height: m.paddingY * 2 + (maxRow + 1) * m.rowHeight,
        },
    };
}
