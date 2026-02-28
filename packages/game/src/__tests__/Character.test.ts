import { describe, it, expect } from 'vitest';
import { Character } from '../characters/Character';
import { CharacterId } from '../characters/CharacterDirectory';

describe('Character', () => {
    describe('id', () => {
        it('stores the CharacterId', () => {
            const c = new Character(CharacterId.LiJie);
            expect(c.id).toBe(CharacterId.LiJie);
        });

        it('stores narrator id', () => {
            const c = new Character(CharacterId.Narrator);
            expect(c.id).toBe(CharacterId.Narrator);
        });
    });

    describe('info', () => {
        it('returns CharacterInfo for the id', () => {
            const c = new Character(CharacterId.LiJie);
            expect(c.info).toEqual({
                id: CharacterId.LiJie,
                name: '李杰',
                alias: '男主角',
            });
        });

        it('returns CharacterInfo for narrator', () => {
            const c = new Character(CharacterId.Narrator);
            expect(c.info.name).toBe('旁白');
        });
    });

    describe('name', () => {
        it('returns the real character name', () => {
            const c = new Character(CharacterId.TanakaKenta);
            expect(c.name).toBe('田中健太');
        });

        it('returns narrator name', () => {
            const c = new Character(CharacterId.Narrator);
            expect(c.name).toBe('旁白');
        });
    });

    describe('alias', () => {
        it('returns the character alias', () => {
            const c = new Character(CharacterId.TanakaKenta);
            expect(c.alias).toBe('健談男大生');
        });

        it('returns alias for LiJie', () => {
            const c = new Character(CharacterId.LiJie);
            expect(c.alias).toBe('男主角');
        });
    });
});
