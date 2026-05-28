import { describe, it, expect } from 'vitest';
import { makeSceneId, optionIdFromDirRel, actSortKey } from '../ids';

describe('makeSceneId', () => {
    it('handles root acts', () => {
        expect(makeSceneId('', 'act1')).toBe('act1');
    });
    it('encodes the branch path', () => {
        expect(makeSceneId('branch_1b', 'act8')).toBe('b1b_act8');
        expect(makeSceneId('branch_1b/branch_2c', 'act14')).toBe(
            'b1b_b2c_act14'
        );
        expect(makeSceneId('branch_1b/branch_2c', 'actFinal')).toBe(
            'b1b_b2c_actFinal'
        );
    });
});

describe('optionIdFromDirRel', () => {
    it('uses the last branch segment', () => {
        expect(optionIdFromDirRel('branch_1b/branch_2c')).toBe('b2c');
        expect(optionIdFromDirRel('branch_1a')).toBe('b1a');
    });
});

describe('actSortKey', () => {
    it('orders numeric acts then final then epilogue', () => {
        const ordered = [
            'actEpilogue',
            'act10',
            'act2',
            'actFinal',
            'act1',
        ].sort((a, b) => actSortKey(a) - actSortKey(b));
        expect(ordered).toEqual([
            'act1',
            'act2',
            'act10',
            'actFinal',
            'actEpilogue',
        ]);
    });
    it('throws on unexpected names', () => {
        expect(() => actSortKey('readme')).toThrow();
    });
});
