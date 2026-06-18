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

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => branchFlow),
}));

import { getStoryFlow, type Translations } from '@aquila/stories';
import {
    buildChapterData,
    extractActName,
    extractChapterKey,
    actSortKey,
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
