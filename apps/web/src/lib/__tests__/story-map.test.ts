import { describe, expect, it } from 'vitest';
import type { ChoiceMap, StoryFlowConfig, Translations } from '@aquila/stories';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getStoryContent, getStoryFlow } from '@aquila/stories';
import { STORY_CATALOG } from '@aquila/stories/catalog';
import type { StoryProgress } from '../story-progress-store';
import {
    buildStoryMap,
    hasRealDecision,
    layoutStoryMap,
    visibleSceneIds,
    type StoryMapDecision,
    type StoryMapMetrics,
    type StoryMapNode,
    type StoryMapRun,
} from '../story-map';

const t = {
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        actRangeLabel: 'Acts {first}–{last}',
    },
} as unknown as Translations;

const forkFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: 'choice:c1' },
        {
            kind: 'choice',
            id: 'choice:c1',
            choiceId: 'c1',
            nextByOption: {
                b1a: 'b1a_act3',
                b1b: 'b1b_act3',
                b1c: 'b1c_act3',
            },
        },
        {
            kind: 'scene',
            id: 'b1a_act3',
            sceneId: 'b1a_act3',
            next: 'b1a_act4',
        },
        {
            kind: 'scene',
            id: 'b1a_act4',
            sceneId: 'b1a_act4',
            next: 'choice:c2',
        },
        {
            kind: 'choice',
            id: 'choice:c2',
            choiceId: 'c2',
            nextByOption: { b2a: 'b1a_b2a_act5', b2b: 'b1a_b2b_act5' },
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_act5',
            sceneId: 'b1a_b2a_act5',
            next: 'b1a_b2a_actFinal',
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_actFinal',
            sceneId: 'b1a_b2a_actFinal',
            next: null,
        },
        {
            kind: 'scene',
            id: 'b1a_b2b_act5',
            sceneId: 'b1a_b2b_act5',
            next: null,
        },
        { kind: 'scene', id: 'b1b_act3', sceneId: 'b1b_act3', next: null },
        { kind: 'scene', id: 'b1c_act3', sceneId: 'b1c_act3', next: null },
        {
            kind: 'scene',
            id: 'zz_act9',
            sceneId: 'zz_act9',
            next: null,
        },
    ],
} as unknown as StoryFlowConfig;

const forkChoices: ChoiceMap = {
    c1: {
        prompt: 'Which fork?',
        options: [
            { id: 'b1a', nextScene: 'b1a_act3', label: 'Left path' },
            { id: 'b1b', nextScene: 'b1b_act3', label: 'Middle path' },
            { id: 'b1c', nextScene: 'b1c_act3', label: 'Right path' },
        ],
    },
    c2: {
        prompt: 'Up or down?',
        options: [
            { id: 'b2a', nextScene: 'b1a_b2a_act5', label: 'Climb' },
            { id: 'b2b', nextScene: 'b1a_b2b_act5', label: 'Descend' },
        ],
    },
};

const linearFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
    ],
} as unknown as StoryFlowConfig;

const linkOnlyFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'choice:link' },
        {
            kind: 'choice',
            id: 'choice:link',
            choiceId: 'link',
            nextByOption: { only: 'act2' },
        },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: null },
    ],
} as unknown as StoryFlowConfig;

function storyFlow(id: string): StoryFlowConfig {
    const flow = getStoryFlow(id);
    if (!flow) throw new Error(`no flow registered for ${id}`);
    return flow;
}

function progress(visited: string[], endings: string[] = []): StoryProgress {
    return {
        sceneId: visited[visited.length - 1] ?? 'act1',
        dialogueIndex: 0,
        updatedAt: 0,
        finished: false,
        endings,
        visited,
    };
}

function mapAt(visited: string[], current: string, endings: string[] = []) {
    return buildStoryMap({
        flow: forkFlow,
        choices: forkChoices,
        progress: progress(visited, endings),
        currentSceneId: current,
        t,
    });
}

function runSceneIds(node: StoryMapNode | null | undefined): string[] {
    if (!node || node.kind !== 'run') return [];
    return [...node.sceneIds];
}

function firstDecision(node: StoryMapNode): StoryMapDecision | null {
    if (node.kind !== 'run') return null;
    return node.next && node.next.kind === 'decision' ? node.next : null;
}

function flatten(root: StoryMapRun | null): StoryMapNode[] {
    const out: StoryMapNode[] = [];
    const walk = (node: StoryMapNode | null) => {
        if (!node) return;
        out.push(node);
        if (node.kind === 'run') walk(node.next);
        if (node.kind === 'decision') node.options.forEach(o => walk(o.child));
    };
    walk(root);
    return out;
}

const metrics: StoryMapMetrics = {
    paddingX: 16,
    paddingY: 12,
    rowHeight: 48,
    nodeHeight: 24,
    columnGap: 32,
    trunkGap: 12,
    runWidth: 120,
    sceneWidth: 40,
    sceneGap: 8,
    decisionWidth: 36,
    markerWidth: 24,
};

const ALL_FORK_SCENES = [
    'act1',
    'act2',
    'b1a_act3',
    'b1a_act4',
    'b1a_b2a_act5',
    'b1a_b2a_actFinal',
    'b1a_b2b_act5',
    'b1b_act3',
    'b1c_act3',
];
const ALL_FORK_ENDINGS = [
    'b1a_b2a_actFinal',
    'b1a_b2b_act5',
    'b1b_act3',
    'b1c_act3',
];

describe('hasRealDecision', () => {
    it('returns false for a linear flow and for link-only choices', () => {
        expect(hasRealDecision(linearFlow)).toBe(false);
        expect(hasRealDecision(linkOnlyFlow)).toBe(false);
    });

    it('returns true when a choice has two or more options', () => {
        expect(hasRealDecision(forkFlow)).toBe(true);
    });

    it('matches the real catalog: Platform and the branching shorts only', () => {
        const expected = new Set([
            'train_adventure',
            'elevator_game',
            'demon_lord_is_hiring',
            'three_am_laundromat',
            'day_4012',
            'one_pot_before_dawn',
        ]);
        for (const entry of STORY_CATALOG) {
            expect(hasRealDecision(storyFlow(entry.id)), entry.id).toBe(
                expected.has(entry.id)
            );
        }
    });
});

describe('visibleSceneIds', () => {
    it('contains only the current scene on a fresh start', () => {
        expect(visibleSceneIds(forkFlow, progress([]), 'act1')).toEqual(
            new Set(['act1'])
        );
    });

    it('includes visited scenes and the current scene', () => {
        const set = visibleSceneIds(
            forkFlow,
            progress(['act1', 'act2']),
            'act2'
        );
        expect(set).toEqual(new Set(['act1', 'act2']));
    });

    it('closes over ancestors so a direct link shows a continuous path', () => {
        const set = visibleSceneIds(forkFlow, progress([]), 'b1a_b2a_act5');
        expect(set).toEqual(
            new Set(['act1', 'act2', 'b1a_act3', 'b1a_act4', 'b1a_b2a_act5'])
        );
        expect(set.has('b1b_act3')).toBe(false);
        expect(set.has('b1c_act3')).toBe(false);
        expect(set.has('b1a_b2b_act5')).toBe(false);
    });

    it('treats missing progress and unknown scenes as nothing extra', () => {
        expect(visibleSceneIds(forkFlow, null, undefined)).toEqual(new Set());
        const set = visibleSceneIds(forkFlow, null, 'not_a_scene');
        expect(set).toEqual(new Set());
    });

    it('excludes scenes unreachable from the flow start', () => {
        const set = visibleSceneIds(forkFlow, progress(['zz_act9']), 'act1');
        expect(set.has('act1')).toBe(true);
        expect(set.has('zz_act9')).toBe(false);
    });
});

describe('buildStoryMap', () => {
    it('shows a single ? continuation on a fresh start', () => {
        const view = mapAt([], 'act1');
        expect(view.root?.kind).toBe('run');
        expect(runSceneIds(view.root)).toEqual(['act1']);
        expect(view.root?.next?.kind).toBe('unknown');
        expect(flatten(view.root).some(n => n.kind === 'decision')).toBe(false);
    });

    it('keeps an unpassed decision hidden behind one ?', () => {
        const view = mapAt(['act1', 'act2'], 'act2');
        expect(runSceneIds(view.root)).toEqual(['act1', 'act2']);
        expect(view.root?.next?.kind).toBe('unknown');
        expect(flatten(view.root).some(n => n.kind === 'decision')).toBe(false);
    });

    it('reveals a passed decision with all option labels and ? for unread options', () => {
        const view = mapAt(['act1', 'act2', 'b1a_act3'], 'b1a_act3');
        const decision = firstDecision(view.root!);
        expect(decision).not.toBeNull();
        expect(decision!.id).toBe('choice:c1');
        expect(decision!.options.map(o => o.label)).toEqual([
            'Left path',
            'Middle path',
            'Right path',
        ]);
        const [b1a, b1b, b1c] = decision!.options;
        expect(b1a.child.kind).toBe('run');
        expect(b1b.child.kind).toBe('unknown');
        expect(b1c.child.kind).toBe('unknown');
        const unknownSceneIds = flatten(view.root)
            .filter(n => n.kind === 'unknown')
            .flatMap(n => Object.values(n))
            .filter(v => typeof v === 'string');
        expect(unknownSceneIds.join()).not.toContain('b1b_act3');
        expect(unknownSceneIds.join()).not.toContain('b1c_act3');
    });

    it('reveals nested decisions only once the reader reaches them', () => {
        const near = mapAt(
            ['act1', 'act2', 'b1a_act3', 'b1a_act4'],
            'b1a_act4'
        );
        const b1aRun = firstDecision(near.root!)!.options[0]
            .child as StoryMapRun;
        expect(b1aRun.next?.kind).toBe('unknown');
        expect(
            flatten(near.root).filter(n => n.kind === 'decision')
        ).toHaveLength(1);

        const past = mapAt(
            ['act1', 'act2', 'b1a_act3', 'b1a_act4', 'b1a_b2a_act5'],
            'b1a_b2a_act5'
        );
        const deeper = flatten(past.root).filter(
            n => n.kind === 'decision'
        ) as StoryMapDecision[];
        expect(deeper.map(d => d.id)).toEqual(['choice:c1', 'choice:c2']);
    });

    it('hides a reached terminal until the ending is completed', () => {
        const unread = mapAt(['act1', 'act2', 'b1b_act3'], 'b1b_act3');
        const run = firstDecision(unread.root!)!.options[1]
            .child as StoryMapRun;
        expect(runSceneIds(run)).toEqual(['b1b_act3']);
        expect(run.next?.kind).toBe('unknown');

        const done = mapAt(['act1', 'act2', 'b1b_act3'], 'b1b_act3', [
            'b1b_act3',
        ]);
        const doneRun = firstDecision(done.root!)!.options[1]
            .child as StoryMapRun;
        expect(doneRun.next?.kind).toBe('ending');
        expect(
            doneRun.next && 'sceneId' in doneRun.next && doneRun.next.sceneId
        ).toBe('b1b_act3');
        expect(done.stats.endings).toBe(1);
    });

    it('does not treat recorded endings as visited scenes', () => {
        const view = mapAt([], 'act1', ['b1b_act3']);
        expect(runSceneIds(view.root)).toEqual(['act1']);
        expect(view.stats.endings).toBe(0);
        expect(
            flatten(view.root)
                .filter(n => n.kind === 'run')
                .flatMap(n => (n as StoryMapRun).sceneIds)
        ).not.toContain('b1b_act3');
    });

    it('marks the current route versus explored side paths', () => {
        const view = mapAt(
            ['act1', 'act2', 'b1a_act3', 'b1b_act3'],
            'b1a_act3'
        );
        expect(view.root?.status).toBe('route');
        const decision = firstDecision(view.root!)!;
        expect(decision.status).toBe('route');
        const [b1a, b1b] = decision.options;
        expect(b1a.child.kind).toBe('run');
        expect((b1a.child as StoryMapRun).status).toBe('route');
        expect((b1a.child as StoryMapRun).current).toBe(true);
        expect((b1b.child as StoryMapRun).status).toBe('explored');
        expect((b1b.child as StoryMapRun).current).toBe(false);
    });

    it('reconstructs a continuous revealed path for a bookmarked scene', () => {
        const view = mapAt([], 'b1a_b2a_act5');
        expect(runSceneIds(view.root)).toEqual(['act1', 'act2']);
        const c1 = firstDecision(view.root!)!;
        const b1aRun = c1.options[0].child as StoryMapRun;
        expect(runSceneIds(b1aRun)).toEqual(['b1a_act3', 'b1a_act4']);
        const c2 = b1aRun.next as StoryMapDecision;
        expect(c2.kind).toBe('decision');
        const deep = c2.options[0].child as StoryMapRun;
        expect(runSceneIds(deep)).toEqual(['b1a_b2a_act5']);
        expect(deep.next?.kind).toBe('unknown');
        expect(c2.options[1].child.kind).toBe('unknown');
        expect(
            flatten(view.root)
                .filter(n => n.kind === 'run')
                .flatMap(n => (n as StoryMapRun).sceneIds)
        ).not.toContain('b1b_act3');
    });

    it('labels collapsed runs with localized act ranges', () => {
        const view = mapAt(['act1', 'act2', 'b1a_act3'], 'b1a_act3');
        expect(view.root?.label).toBe('Acts 1–2');
        const c1 = firstDecision(view.root!)!;
        expect((c1.options[0].child as StoryMapRun).label).toBe('Act 3');
    });

    it('counts only visible acts, passed decisions and reached endings', () => {
        const partial = mapAt(['act1', 'act2', 'b1a_act3'], 'b1a_act3');
        expect(partial.stats).toEqual({ acts: 3, decisions: 1, endings: 0 });

        const full = mapAt(ALL_FORK_SCENES, 'b1a_b2a_act5', ALL_FORK_ENDINGS);
        expect(full.stats).toEqual({ acts: 9, decisions: 2, endings: 4 });
    });

    it('counts sibling acts that share a displayed act number separately', () => {
        const view = mapAt(
            ['act1', 'act2', 'b1a_act3', 'b1b_act3', 'b1c_act3'],
            'b1a_act3'
        );
        expect(view.stats.acts).toBe(5);
        const branched = mapAt(
            ['act1', 'act2', 'b1a_b2a_act5', 'b1a_b2b_act5'],
            'b1a_b2a_act5'
        );
        expect(branched.stats.acts).toBe(6);
    });

    it('counts same-numbered acts on real sibling branches separately', () => {
        const flow = storyFlow('train_adventure');
        const { choices } = getStoryContent('train_adventure', 'en');
        const view = buildStoryMap({
            flow,
            choices,
            progress: progress(['b1a_b2a_act7', 'b1a_b2b_act7']),
            currentSceneId: 'b1a_b2a_act7',
            t,
        });
        expect(view.stats.acts).toBe(8);
    });

    it('ignores visited scenes that are unreachable from the flow start', () => {
        const view = mapAt(
            [...ALL_FORK_SCENES, 'zz_act9'],
            'b1a_b2a_act5',
            ALL_FORK_ENDINGS
        );
        const shown = flatten(view.root)
            .filter((n): n is StoryMapRun => n.kind === 'run')
            .flatMap(r => r.sceneIds);
        expect(shown).not.toContain('zz_act9');
        expect(view.stats.acts).toBe(9);
    });

    it('exposes minimal scene ids for legal jumps only', () => {
        const view = mapAt(['act1', 'act2', 'b1b_act3'], 'b1b_act3');
        const run = view.root!;
        expect(run.entrySceneId).toBe('act1');
        const decision = firstDecision(run)!;
        expect('entrySceneId' in decision).toBe(false);
        expect('sceneId' in decision.options[0].child).toBe(false);
    });
});

describe('buildStoryMap on the real Platform flow', () => {
    const flow = storyFlow('train_adventure');
    const choices = getStoryContent('train_adventure', 'en').choices;
    const realT = { ...t } as Translations;

    it('reveals the ancestor chain of a deep scene without sibling leaks', () => {
        const current = 'b1a_b2b_b3a_act10';
        const view = buildStoryMap({
            flow,
            choices,
            progress: progress([]),
            currentSceneId: current,
            t: realT,
        });
        const visible = visibleSceneIds(flow, progress([]), current);
        const runs = flatten(view.root).filter(
            (n): n is StoryMapRun => n.kind === 'run'
        );
        const shown = new Set(runs.flatMap(r => r.sceneIds));
        for (const id of shown) expect(visible.has(id), id).toBe(true);
        expect(shown.has(current)).toBe(true);
        expect([...shown].some(id => id.startsWith('b1b_'))).toBe(false);

        const decisions = flatten(view.root).filter(
            (n): n is StoryMapDecision => n.kind === 'decision'
        );
        expect(decisions.map(d => d.id)).toEqual([
            'choice:choice_act3',
            'choice:choice_b1a_act6',
            'choice:choice_b1a_b2b_act7',
        ]);
        const first = decisions[0];
        expect(first.options.map(o => o.id)).toEqual(
            choices.choice_act3.options.map(o => o.id)
        );
        expect(first.options[0].label).toBe(
            choices.choice_act3.options[0].label
        );
        expect(decisions.some(d => d.id === 'choice:choice_b1a_b2a_act8')).toBe(
            false
        );
    });
});

describe('story map over the full catalog', () => {
    it('builds and lays out every flow with all scenes visited', () => {
        for (const entry of STORY_CATALOG) {
            const flow = storyFlow(entry.id);
            const { choices } = getStoryContent(entry.id, 'en');
            const sceneIds = flow.nodes
                .filter(n => n.kind === 'scene')
                .map(n => (n.kind === 'scene' ? n.sceneId : n.id));
            const endings = flow.nodes
                .filter(n => n.kind === 'scene' && n.next == null)
                .map(n => (n.kind === 'scene' ? n.sceneId : n.id));
            const view = buildStoryMap({
                flow,
                choices,
                progress: progress(sceneIds, endings),
                currentSceneId: flow.start,
                t,
            });
            expect(view.root, entry.id).not.toBeNull();
            const shown = flatten(view.root)
                .filter((n): n is StoryMapRun => n.kind === 'run')
                .flatMap(r => r.sceneIds);
            expect(new Set(shown).size, entry.id).toBe(shown.length);

            const layout = layoutStoryMap(view, new Set(), metrics);
            expect(layout.nodes.length, entry.id).toBeGreaterThan(0);
            expect(layout.bounds.width).toBeGreaterThan(0);
            expect(layout.bounds.height).toBeGreaterThan(0);
            const ids = new Set(layout.nodes.map(n => n.id));
            for (const edge of layout.edges) {
                expect(ids.has(edge.from), `${entry.id} ${edge.id}`).toBe(true);
                expect(ids.has(edge.to), `${entry.id} ${edge.id}`).toBe(true);
            }
        }
    });
});

describe('layoutStoryMap', () => {
    const fullView = () =>
        mapAt(ALL_FORK_SCENES, 'b1a_b2a_act5', ALL_FORK_ENDINGS);

    it('keeps the current route on row 0', () => {
        const layout = layoutStoryMap(fullView(), new Set(), metrics);
        for (const node of layout.nodes) {
            if (node.status === 'route') {
                expect(node.row, node.id).toBe(0);
            }
        }
    });

    it('allocates side rows deepest-first', () => {
        const layout = layoutStoryMap(fullView(), new Set(), metrics);
        const rows = new Map(layout.nodes.map(n => [n.id, n.row]));
        expect(rows.get('b1a_b2b_act5')).toBe(1);
        expect(rows.get('b1b_act3')).toBe(2);
        expect(rows.get('b1c_act3')).toBe(3);
    });

    it('always unfolds the run containing the current scene', () => {
        const view = mapAt(
            ['act1', 'act2', 'b1a_act3', 'b1a_act4'],
            'b1a_act4'
        );
        const layout = layoutStoryMap(view, new Set(), metrics);
        const scenes = layout.nodes.filter(
            n =>
                n.kind === 'scene' &&
                (n.sceneId === 'b1a_act3' || n.sceneId === 'b1a_act4')
        );
        expect(scenes.map(n => n.sceneId)).toEqual(['b1a_act3', 'b1a_act4']);
        expect(
            layout.nodes.some(n => n.kind === 'run' && n.id === 'b1a_act3')
        ).toBe(false);
    });

    it('colors only the root-to-current path as route', () => {
        const view = mapAt(
            ['act1', 'act2', 'b1a_act3', 'b1a_act4'],
            'b1a_act3'
        );
        const layout = layoutStoryMap(view, new Set(), metrics);
        const byScene = new Map(
            layout.nodes
                .filter(n => n.kind === 'scene')
                .map(n => [n.sceneId, n])
        );
        expect(byScene.get('b1a_act3')?.status).toBe('route');
        expect(byScene.get('b1a_act4')?.status).toBe('explored');
    });

    it('derives an ending marker status from its own scene, not its run', () => {
        const after = layoutStoryMap(fullView(), new Set(), metrics);
        const marker = after.nodes.find(
            n => n.id === 'ending:b1a_b2a_actFinal'
        )!;
        expect(marker.status).toBe('explored');
        const at = layoutStoryMap(
            mapAt(ALL_FORK_SCENES, 'b1a_b2a_actFinal', ALL_FORK_ENDINGS),
            new Set(),
            metrics
        );
        expect(
            at.nodes.find(n => n.id === 'ending:b1a_b2a_actFinal')?.status
        ).toBe('route');
    });

    it('shares one real trunk path segment among sibling branches', () => {
        const layout = layoutStoryMap(fullView(), new Set(), metrics);
        const c1 = layout.nodes.find(n => n.id === 'choice:c1')!;
        const cyOf = (row: number) =>
            metrics.paddingY + row * metrics.rowHeight + metrics.rowHeight / 2;

        const stubs = layout.edges.filter(
            e => e.kind === 'stub' && e.from === c1.id
        );
        const trunks = layout.edges.filter(
            e => e.kind === 'trunk' && e.from === c1.id
        );
        expect(stubs).toHaveLength(1);
        expect(trunks).toHaveLength(3);
        const [sx, sy, tx1, ty] = stubs[0].d
            .match(/-?\d+(?:\.\d+)?/g)!
            .map(Number);
        expect(sx).toBe(c1.x + c1.width);
        expect(sy).toBe(ty);
        expect(sy).toBe(cyOf(c1.row));
        const deepest = layout.nodes.find(n => n.id === 'b1c_act3')!;
        let segTop = sy;
        const segNums = trunks.map(t =>
            t.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
        );
        for (const [vx1, vy1, vx2, vy2] of segNums) {
            expect(vx1).toBe(tx1);
            expect(vx2).toBe(tx1);
            expect(vy1).toBe(segTop);
            segTop = vy2;
        }
        expect(segTop).toBe(cyOf(deepest.row));
        expect(tx1).toBeGreaterThan(sx);
        expect(trunks[0].serves).toEqual(['b1b_act3', 'b1c_act3']);
        expect(trunks[1].serves).toEqual(['b1c_act3']);
        expect(trunks[2].serves).toEqual(['b1c_act3']);
        expect(trunks[2].to).toBe(deepest.id);

        const branches = layout.edges.filter(
            e => e.kind === 'branch' && e.from === c1.id
        );
        expect(branches).toHaveLength(2);
        const rowsById = new Map(layout.nodes.map(n => [n.id, n.row]));
        for (const branch of branches) {
            const childRow = rowsById.get(branch.to)!;
            const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = branch.d
                .match(/-?\d+(?:\.\d+)?/g)!
                .map(Number);
            expect(sx).toBe(tx1);
            expect(ex).toBe(layout.nodes.find(n => n.id === branch.to)!.x);
            expect(ey).toBe(cyOf(childRow));
            expect(sy).toBeLessThan(ey);
            expect(sy).toBeGreaterThanOrEqual(cyOf(0));
            expect(sy).toBeLessThanOrEqual(cyOf(deepest.row));
            expect(c1x).toBeGreaterThan(sx);
            expect(c2x).toBeLessThan(ex);
            expect(c1y).not.toBe(c2y);
        }
        expect(branches.map(e => e.label).sort()).toEqual([
            'Middle path',
            'Right path',
        ]);
    });

    it('expands one run into scenes without touching other rows', () => {
        const collapsed = layoutStoryMap(fullView(), new Set(), metrics);
        const expanded = layoutStoryMap(
            fullView(),
            new Set(['b1a_act3']),
            metrics
        );
        const collapsedRows = new Map(collapsed.nodes.map(n => [n.id, n.row]));
        for (const node of expanded.nodes) {
            const before = collapsedRows.get(node.id);
            if (before !== undefined) {
                expect(node.row, node.id).toBe(before);
            }
        }
        const scenes = expanded.nodes.filter(
            n => n.kind === 'scene' && n.sceneId?.startsWith('b1a_act')
        );
        expect(scenes.map(n => n.sceneId)).toEqual(['b1a_act3', 'b1a_act4']);
        const runDelta =
            2 * metrics.sceneWidth + metrics.sceneGap - metrics.runWidth;
        expect(expanded.bounds.height).toBe(collapsed.bounds.height);
        expect(expanded.bounds.width).toBe(collapsed.bounds.width + runDelta);
    });

    it('lays out runs as single labeled nodes when collapsed', () => {
        const layout = layoutStoryMap(fullView(), new Set(), metrics);
        const runNode = layout.nodes.find(n => n.id === 'act1');
        expect(runNode?.kind).toBe('run');
        expect(runNode?.label).toBe('Acts 1–2');
    });

    it('returns an empty layout for an empty view', () => {
        const layout = layoutStoryMap(
            { root: null, stats: { acts: 0, decisions: 0, endings: 0 } },
            new Set(),
            metrics
        );
        expect(layout.nodes).toEqual([]);
        expect(layout.edges).toEqual([]);
    });
});
