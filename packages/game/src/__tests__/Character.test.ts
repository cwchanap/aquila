import { describe, it, expect } from 'vitest';
import { Character } from '../characters/Character';

describe('Character', () => {
    describe('id', () => {
        it('stores the id', () => {
            const c = new Character('li_jie', '李杰');
            expect(c.id).toBe('li_jie');
        });

        it('stores narrator id', () => {
            const c = new Character('narrator', '旁白');
            expect(c.id).toBe('narrator');
        });
    });

    describe('name', () => {
        it('returns the character name', () => {
            const c = new Character('tanaka_kenta', '田中健太');
            expect(c.name).toBe('田中健太');
        });

        it('returns narrator name', () => {
            const c = new Character('narrator', '旁白');
            expect(c.name).toBe('旁白');
        });

        it('returns the raw id when constructed with id as name (instances.ts fallback pattern)', () => {
            const c = new Character('totally_unknown', 'totally_unknown');
            expect(c.name).toBe('totally_unknown');
        });
    });

    describe('alias', () => {
        it('returns the character name as alias', () => {
            const c = new Character('tanaka_kenta', '田中健太');
            expect(c.alias).toBe('田中健太');
        });

        it('returns alias for LiJie (equals name)', () => {
            const c = new Character('li_jie', '李杰');
            expect(c.alias).toBe('李杰');
        });

        it('alias equals name when constructed with id as name (instances.ts fallback pattern)', () => {
            const c = new Character('totally_unknown', 'totally_unknown');
            expect(c.alias).toBe('totally_unknown');
        });
    });
});
