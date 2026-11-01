import { describe, it, expect } from 'vitest';

const branchFlow = {
    start: 'b1a_act1',
    nodes: [
        {
            kind: 'scene',
            id: 'b1a_act1',
            sceneId: 'b1a_act1',
            next: 'b1a_act2',
        },
        {
            kind: 'scene',
            id: 'b1a_act2',
            sceneId: 'b1a_act2',
            next: 'actFinal',
        },
        {
            kind: 'scene',
            id: 'actFinal',
            sceneId: 'actFinal',
            next: 'actEpilogue',
        },
        {
            kind: 'scene',
            id: 'actEpilogue',
            sceneId: 'actEpilogue',
            next: null,
        },
    ],
};

const chapterFlow = {
    start: 'ch1_act1',
    nodes: [
        {
            kind: 'scene',
            id: 'ch1_act1',
            sceneId: 'ch1_act1',
            next: 'ch1_act2',
        },
        {
            kind: 'scene',
            id: 'ch1_act2',
            sceneId: 'ch1_act2',
            next: 'ch2_act1',
        },
        { kind: 'scene', id: 'ch2_act1', sceneId: 'ch2_act1', next: null },
    ],
};

// Mirrors the real trainAdventure branch topology: the same act number appears
// under several branch prefixes (e.g. act7 under b2a AND b2b), and act20
// appears at both a shallow ancestor prefix (b1a_) and a deeper same-lineage
// prefix (b1a_b2a_b3a_). The branch-disambiguation logic in buildBranches must
// (a) exclude candidates on a diverging sibling branch, and (b) when multiple
// candidates share the current lineage, pick the one whose prefix matches most
// deeply. The linear `branchFlow` fixture above can't exercise either path.
const branchingFlow = {
    start: 'b1a_act4',
    nodes: [
        {
            kind: 'scene',
            id: 'b1a_act4',
            sceneId: 'b1a_act4',
            next: 'b1a_act5',
        },
        {
            kind: 'scene',
            id: 'b1a_act5',
            sceneId: 'b1a_act5',
            next: 'b1a_b2a_act7',
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_act7',
            sceneId: 'b1a_b2a_act7',
            next: 'b1a_b2a_b3a_act8',
        },
        {
            kind: 'scene',
            id: 'b1a_b2b_act7',
            sceneId: 'b1a_b2b_act7',
            next: 'b1a_b2b_b3a_act8',
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_b3a_act8',
            sceneId: 'b1a_b2a_b3a_act8',
            next: 'b1a_b2a_b3a_act20',
        },
        {
            kind: 'scene',
            id: 'b1a_b2b_b3a_act8',
            sceneId: 'b1a_b2b_b3a_act8',
            next: 'b1a_act20',
        },
        // act20 at a shallow ancestor prefix on the shared b1a lineage…
        {
            kind: 'scene',
            id: 'b1a_act20',
            sceneId: 'b1a_act20',
            next: 'actFinal',
        },
        // …and at a deeper same-lineage prefix under b2a/b3a.
        {
            kind: 'scene',
            id: 'b1a_b2a_b3a_act20',
            sceneId: 'b1a_b2a_b3a_act20',
            next: 'actFinal',
        },
        {
            kind: 'scene',
            id: 'actFinal',
            sceneId: 'actFinal',
            next: 'actEpilogue',
        },
        {
            kind: 'scene',
            id: 'actEpilogue',
            sceneId: 'actEpilogue',
            next: null,
        },
    ],
};

import type { StoryFlowConfig, Translations } from '@aquila/stories';
import {
    buildChapterData,
    extractActName,
    extractBranchPrefix,
    extractChapterKey,
    actSortKey,
    branchMatchScore,
    actRangeLabel,
} from '@/lib/act-navigation';

const t = {
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        chapterLabel: 'Chapter {n}',
    },
} as unknown as Translations;

describe('act-navigation', () => {
    it('extractActName / extractChapterKey parse ids', () => {
        expect(extractActName('ch2_act1')).toBe('act1');
        expect(extractActName('b1a_actFinal')).toBe('actFinal');
        expect(extractChapterKey('ch2_act1')).toBe('ch2');
        expect(extractChapterKey('b1a_act1')).toBeNull();
    });

    it('actSortKey orders final and epilogue last', () => {
        expect(actSortKey('act1')).toBe(1);
        expect(actSortKey('actFinal')).toBe(9998);
        expect(actSortKey('actEpilogue')).toBe(9999);
    });

    it('builds branches mode for a non-chapter flow, sorted', () => {
        const data = buildChapterData(
            branchFlow as unknown as StoryFlowConfig,
            'b1a_act1',
            t
        );
        expect(data.mode).toBe('branches');
        if (data.mode !== 'branches') throw new Error('expected branches');
        expect(data.acts.map(a => a.label)).toEqual([
            'Act 1',
            'Act 2',
            'Final',
            'Epilogue',
        ]);
    });

    it('builds chapters mode for a chapter flow', () => {
        const data = buildChapterData(
            chapterFlow as unknown as StoryFlowConfig,
            'ch1_act1',
            t
        );
        expect(data.mode).toBe('chapters');
        if (data.mode !== 'chapters') throw new Error('expected chapters');
        expect(data.chapters.map(c => c.label)).toEqual([
            'Chapter 1',
            'Chapter 2',
        ]);
        expect(data.chapters[0].acts.map(a => a.label)).toEqual([
            'Act 1',
            'Act 2',
        ]);
    });

    it('returns empty branches for a loaded flow with no scene nodes', () => {
        const data = buildChapterData(
            { start: 'act1', nodes: [] } as unknown as StoryFlowConfig,
            'act1',
            t
        );
        expect(data).toEqual({ mode: 'branches', acts: [] });
    });
});

describe('extractBranchPrefix', () => {
    it('returns the tokens before the act token', () => {
        expect(extractBranchPrefix('b1a_b2a_b3a_act8')).toBe('b1a_b2a_b3a_');
        expect(extractBranchPrefix('b1a_act4')).toBe('b1a_');
    });

    it('returns empty string when the scene has no branch prefix', () => {
        expect(extractBranchPrefix('act1')).toBe('');
        expect(extractBranchPrefix('actFinal')).toBe('');
    });
});

describe('branchMatchScore', () => {
    it('counts shared leading branch tokens', () => {
        expect(branchMatchScore('b1a_b2a_', 'b1a_b2a_')).toBe(2);
        expect(branchMatchScore('b1a_b2a_b3a_', 'b1a_b2a_')).toBe(2);
    });

    it('stops at the first diverging token', () => {
        expect(branchMatchScore('b1a_b2a_', 'b1a_b2b_')).toBe(1);
        expect(branchMatchScore('b1a_b2a_b3a_', 'b1a_b2b_b3a_')).toBe(1);
    });

    it('returns 0 when either side has no prefix', () => {
        expect(branchMatchScore('', 'b1a_')).toBe(0);
        expect(branchMatchScore('b1a_', '')).toBe(0);
        expect(branchMatchScore('', '')).toBe(0);
    });

    it('prefers a deeper same-lineage prefix over a shallow ancestor', () => {
        // The whole reason buildBranches scores candidates: a shallow ancestor
        // (b1a_) and a deeper same-lineage (b1a_b2a_b3a_) both qualify as
        // "on branch", but the deeper one must win.
        expect(branchMatchScore('b1a_b2a_b3a_', 'b1a_b2a_b3a_')).toBe(3);
        expect(branchMatchScore('b1a_', 'b1a_b2a_b3a_')).toBe(1);
        expect(
            branchMatchScore('b1a_b2a_b3a_', 'b1a_b2a_b3a_')
        ).toBeGreaterThan(branchMatchScore('b1a_', 'b1a_b2a_b3a_'));
    });
});

describe('buildBranches disambiguation', () => {
    // Helper: resolve the branching fixture from a given current scene and
    // return a map of act rawName -> chosen sceneId.
    function resolveFrom(currentSceneId: string): Record<string, string> {
        const data = buildChapterData(
            branchingFlow as unknown as StoryFlowConfig,
            currentSceneId,
            t
        );
        if (data.mode !== 'branches') throw new Error('expected branches');
        return Object.fromEntries(data.acts.map(a => [a.rawName, a.sceneId]));
    }

    it('excludes candidates on a diverging sibling branch (b2a current)', () => {
        const chosen = resolveFrom('b1a_b2a_b3a_act8');
        // act7: b2a candidate wins; the b2b sibling must NOT leak in.
        expect(chosen['act7']).toBe('b1a_b2a_act7');
        expect(chosen['act7']).not.toBe('b1a_b2b_act7');
        // act8: same — b2a/b3a candidate wins.
        expect(chosen['act8']).toBe('b1a_b2a_b3a_act8');
        expect(chosen['act8']).not.toBe('b1a_b2b_b3a_act8');
    });

    it('excludes candidates on a diverging sibling branch (b2b current)', () => {
        const chosen = resolveFrom('b1a_b2b_b3a_act8');
        // Now the b2b candidates win and the b2a ones are excluded.
        expect(chosen['act7']).toBe('b1a_b2b_act7');
        expect(chosen['act8']).toBe('b1a_b2b_b3a_act8');
        expect(chosen['act7']).not.toBe('b1a_b2a_act7');
    });

    it('picks the deepest same-lineage candidate when a shallow ancestor also qualifies', () => {
        // From a b2a/b3a scene, act20 has two on-branch candidates: the shallow
        // ancestor `b1a_act20` and the deep `b1a_b2a_b3a_act20`. The scoring
        // loop must select the deeper one (this is the branch that the linear
        // fixture left entirely uncovered).
        const chosen = resolveFrom('b1a_b2a_b3a_act8');
        expect(chosen['act20']).toBe('b1a_b2a_b3a_act20');
        expect(chosen['act20']).not.toBe('b1a_act20');
    });

    it('falls back to the shallow ancestor when the deep candidate is off-branch', () => {
        // From a b2b scene, the deep b2a/b3a act20 is excluded, leaving only
        // the shared shallow `b1a_act20` (an ancestor of the b2b lineage).
        const chosen = resolveFrom('b1a_b2b_b3a_act8');
        expect(chosen['act20']).toBe('b1a_act20');
        expect(chosen['act20']).not.toBe('b1a_b2a_b3a_act20');
    });

    it('keeps shared-prefix and prefix-less acts and sorts them', () => {
        const chosen = resolveFrom('b1a_b2a_b3a_act8');
        // Shared b1a acts and the prefix-less Final/Epilogue always appear.
        expect(chosen['act4']).toBe('b1a_act4');
        expect(chosen['act5']).toBe('b1a_act5');
        expect(chosen['actFinal']).toBe('actFinal');
        expect(chosen['actEpilogue']).toBe('actEpilogue');
    });
});

describe('actRangeLabel', () => {
    const rangeT = {
        reader: {
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            actRangeLabel: 'Acts {first}–{last}',
        },
    } as unknown as Translations;

    it('renders the localized Acts N–M form for numeric act names', () => {
        expect(actRangeLabel('act1', 'act3', rangeT)).toBe('Acts 1–3');
        expect(actRangeLabel('act2', 'act20', rangeT)).toBe('Acts 2–20');
    });

    it('falls back to concatenated labels for non-numeric endpoints', () => {
        expect(actRangeLabel('act3', 'actFinal', rangeT)).toBe('Act 3–Final');
        expect(actRangeLabel('actFinal', 'actEpilogue', rangeT)).toBe(
            'Final–Epilogue'
        );
    });
});

describe('buildChapterData visible-scene filter', () => {
    function resolveFilteredFrom(
        currentSceneId: string,
        visible: ReadonlySet<string>
    ): Record<string, string> {
        const data = buildChapterData(
            branchingFlow as unknown as StoryFlowConfig,
            currentSceneId,
            t,
            visible
        );
        if (data.mode !== 'branches') throw new Error('expected branches');
        return Object.fromEntries(data.acts.map(a => [a.rawName, a.sceneId]));
    }

    it('hides acts whose candidates are all outside the allowlist', () => {
        const visible = new Set([
            'b1a_act4',
            'b1a_act5',
            'b1a_b2a_act7',
            'b1a_b2a_b3a_act8',
        ]);
        const chosen = resolveFilteredFrom('b1a_b2a_b3a_act8', visible);
        // act20, actFinal and actEpilogue exist in the flow but every one of
        // their candidate scenes was filtered out, so the labels never render.
        expect(Object.keys(chosen)).toEqual(['act4', 'act5', 'act7', 'act8']);
    });

    it('filters candidates before branch matching so only visible ids are offered', () => {
        const visible = new Set([
            'b1a_act4',
            'b1a_act5',
            'b1a_b2a_act7',
            'b1a_b2a_b3a_act8',
            'b1a_act20',
        ]);
        const chosen = resolveFilteredFrom('b1a_b2a_b3a_act8', visible);
        // act20 resolves to the visible shallow ancestor; the deeper
        // same-lineage candidate was filtered out before the match scored.
        expect(chosen['act20']).toBe('b1a_act20');
        for (const sceneId of Object.values(chosen)) {
            expect(visible.has(sceneId)).toBe(true);
        }
    });

    it('drops an act entirely when its visible candidate is off-branch', () => {
        // The reader visited act7 on the b2b sibling only; from a b2a scene
        // the visible b2b candidate is off-branch, so act7 must not appear at
        // all rather than leaking a jump to it.
        const visible = new Set([
            'b1a_act4',
            'b1a_act5',
            'b1a_b2b_act7',
            'b1a_b2a_b3a_act8',
        ]);
        const chosen = resolveFilteredFrom('b1a_b2a_b3a_act8', visible);
        expect(chosen['act7']).toBeUndefined();
    });

    it('filters scene candidates before grouping in chapters mode', () => {
        const visible = new Set(['ch1_act1']);
        const data = buildChapterData(
            chapterFlow as unknown as StoryFlowConfig,
            'ch1_act1',
            t,
            visible
        );
        if (data.mode !== 'chapters') throw new Error('expected chapters');
        // Chapters with no visible acts are not even listed.
        expect(data.chapters.map(c => c.chapterNum)).toEqual([1]);
        expect(data.chapters[0].acts.map(a => a.sceneId)).toEqual(['ch1_act1']);
    });

    it('retains the unrestricted act list when the allowlist is omitted', () => {
        const data = buildChapterData(
            branchFlow as unknown as StoryFlowConfig,
            'b1a_act1',
            t
        );
        if (data.mode !== 'branches') throw new Error('expected branches');
        // Linear stories keep skip-ahead: every act is listed unfiltered.
        expect(data.acts.map(a => a.label)).toEqual([
            'Act 1',
            'Act 2',
            'Final',
            'Epilogue',
        ]);
    });
});
