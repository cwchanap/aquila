import { describe, it, expect } from 'vitest';
import {
    characters,
    getCharacter,
    narrator,
    liJie,
    tanakaKenta,
    suzukiAsuka,
    satoTakumi,
    takahashiMisaki,
    saitoRen,
    yamamotoKoji,
    itoNana,
    itoMakoto,
    kobayashiShota,
    kobayashiTomoko,
    kobayashiYudai,
    kobayashiHina,
    nakamuraHayato,
    shimizuEmi,
    lingMo,
} from '../characters/instances';
import { CharacterId } from '../characters/CharacterDirectory';
import { Character } from '../characters/Character';

describe('characters map', () => {
    it('contains an entry for every CharacterId', () => {
        for (const id of Object.values(CharacterId)) {
            expect(characters).toHaveProperty(id);
            expect(characters[id]).toBeInstanceOf(Character);
        }
    });

    it('each entry has the correct id', () => {
        for (const id of Object.values(CharacterId)) {
            expect(characters[id].id).toBe(id);
        }
    });
});

describe('getCharacter', () => {
    it('returns the Character instance for a given id', () => {
        const c = getCharacter(CharacterId.LiJie);
        expect(c).toBeInstanceOf(Character);
        expect(c.id).toBe(CharacterId.LiJie);
    });

    it('returns the same instance as the characters map', () => {
        expect(getCharacter(CharacterId.Narrator)).toBe(
            characters[CharacterId.Narrator]
        );
    });
});

describe('named exports', () => {
    const characterInstances: [string, Character, CharacterId][] = [
        ['narrator', narrator, CharacterId.Narrator],
        ['liJie', liJie, CharacterId.LiJie],
        ['tanakaKenta', tanakaKenta, CharacterId.TanakaKenta],
        ['suzukiAsuka', suzukiAsuka, CharacterId.SuzukiAsuka],
        ['satoTakumi', satoTakumi, CharacterId.SatoTakumi],
        ['takahashiMisaki', takahashiMisaki, CharacterId.TakahashiMisaki],
        ['saitoRen', saitoRen, CharacterId.SaitoRen],
        ['yamamotoKoji', yamamotoKoji, CharacterId.YamamotoKoji],
        ['itoNana', itoNana, CharacterId.ItoNana],
        ['itoMakoto', itoMakoto, CharacterId.ItoMakoto],
        ['kobayashiShota', kobayashiShota, CharacterId.KobayashiShota],
        ['kobayashiTomoko', kobayashiTomoko, CharacterId.KobayashiTomoko],
        ['kobayashiYudai', kobayashiYudai, CharacterId.KobayashiYudai],
        ['kobayashiHina', kobayashiHina, CharacterId.KobayashiHina],
        ['nakamuraHayato', nakamuraHayato, CharacterId.NakamuraHayato],
        ['shimizuEmi', shimizuEmi, CharacterId.ShimizuEmi],
        ['lingMo', lingMo, CharacterId.LingMo],
    ];

    it.each(characterInstances)(
        '%s has correct CharacterId',
        (_name, instance, expectedId) => {
            expect(instance.id).toBe(expectedId);
        }
    );
});
