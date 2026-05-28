import { describe, it, expect } from 'vitest';
import { CharacterId, CharacterDirectory } from '../characters/CharacterId';

describe('CharacterDirectory', () => {
    describe('getById', () => {
        it('returns character info for valid id', () => {
            const info = CharacterDirectory.getById(CharacterId.LiJie);
            expect(info).toEqual({
                id: CharacterId.LiJie,
                name: '李杰',
                alias: '男主角',
            });
        });

        it('returns narrator info', () => {
            const info = CharacterDirectory.getById(CharacterId.Narrator);
            expect(info.name).toBe('旁白');
        });
    });

    describe('getIdByName', () => {
        it('returns id when looking up by real name', () => {
            const id = CharacterDirectory.getIdByName('李杰');
            expect(id).toBe(CharacterId.LiJie);
        });

        it('returns id when looking up by alias', () => {
            const id = CharacterDirectory.getIdByName('男主角');
            expect(id).toBe(CharacterId.LiJie);
        });

        it('returns undefined for unknown name', () => {
            const id = CharacterDirectory.getIdByName('Unknown Character');
            expect(id).toBeUndefined();
        });

        it('supports looking up all characters by either name or alias', () => {
            // Test a few key characters
            expect(CharacterDirectory.getIdByName('田中健太')).toBe(
                CharacterId.TanakaKenta
            );
            expect(CharacterDirectory.getIdByName('健談男大生')).toBe(
                CharacterId.TanakaKenta
            );

            expect(CharacterDirectory.getIdByName('鈴木明日香')).toBe(
                CharacterId.SuzukiAsuka
            );
            expect(CharacterDirectory.getIdByName('活潑女大生')).toBe(
                CharacterId.SuzukiAsuka
            );
        });
    });

    describe('getAll', () => {
        it('returns all characters', () => {
            const all = CharacterDirectory.getAll();
            expect(all.length).toBeGreaterThan(0);
            expect(all.some(c => c.id === CharacterId.LiJie)).toBe(true);
            expect(all.some(c => c.id === CharacterId.Narrator)).toBe(true);
        });

        it('includes all CharacterId enum values', () => {
            const all = CharacterDirectory.getAll();
            const allIds = all.map(c => c.id);

            for (const id of Object.values(CharacterId)) {
                expect(allIds).toContain(id);
            }
        });
    });
});

describe('CharacterId enum', () => {
    it('has expected character ids', () => {
        expect(CharacterId.Narrator).toBe('narrator');
        expect(CharacterId.LiJie).toBe('li_jie');
        expect(CharacterId.TanakaKenta).toBe('tanaka_kenta');
    });
});
