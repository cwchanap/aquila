import { describe, it, expect, vi, afterEach } from 'vitest';

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

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => branchFlow),
}));

import { getStoryFlow, type Translations } from '@aquila/stories';
import {
    buildChapterData,
    extractActName,
    extractBranchPrefix,
    extractChapterKey,
    actSortKey,
    branchMatchScore,
} from '@/lib/act-navigation';

const t = {
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        chapterLabel: 'Chapter {n}',
    },
} as unknown as Translations;

afterEach(() => vi.clearAllMocks());

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
        const data = buildChapterData('s', 'b1a_act1', t);
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
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );
        const data = buildChapterData('s', 'ch1_act1', t);
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

    it('returns empty branches when flow is missing', () => {
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            undefined
        );
        const data = buildChapterData('s', 'act1', t);
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
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            branchingFlow
        );
        const data = buildChapterData('s', currentSceneId, t);
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
