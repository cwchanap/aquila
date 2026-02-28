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
    it('narrator has Narrator id', () => {
        expect(narrator.id).toBe(CharacterId.Narrator);
    });

    it('liJie has LiJie id', () => {
        expect(liJie.id).toBe(CharacterId.LiJie);
    });

    it('tanakaKenta has TanakaKenta id', () => {
        expect(tanakaKenta.id).toBe(CharacterId.TanakaKenta);
    });

    it('suzukiAsuka has SuzukiAsuka id', () => {
        expect(suzukiAsuka.id).toBe(CharacterId.SuzukiAsuka);
    });

    it('satoTakumi has SatoTakumi id', () => {
        expect(satoTakumi.id).toBe(CharacterId.SatoTakumi);
    });

    it('takahashiMisaki has TakahashiMisaki id', () => {
        expect(takahashiMisaki.id).toBe(CharacterId.TakahashiMisaki);
    });

    it('saitoRen has SaitoRen id', () => {
        expect(saitoRen.id).toBe(CharacterId.SaitoRen);
    });

    it('yamamotoKoji has YamamotoKoji id', () => {
        expect(yamamotoKoji.id).toBe(CharacterId.YamamotoKoji);
    });

    it('itoNana has ItoNana id', () => {
        expect(itoNana.id).toBe(CharacterId.ItoNana);
    });

    it('itoMakoto has ItoMakoto id', () => {
        expect(itoMakoto.id).toBe(CharacterId.ItoMakoto);
    });

    it('kobayashiShota has KobayashiShota id', () => {
        expect(kobayashiShota.id).toBe(CharacterId.KobayashiShota);
    });

    it('kobayashiTomoko has KobayashiTomoko id', () => {
        expect(kobayashiTomoko.id).toBe(CharacterId.KobayashiTomoko);
    });

    it('kobayashiYudai has KobayashiYudai id', () => {
        expect(kobayashiYudai.id).toBe(CharacterId.KobayashiYudai);
    });

    it('kobayashiHina has KobayashiHina id', () => {
        expect(kobayashiHina.id).toBe(CharacterId.KobayashiHina);
    });

    it('nakamuraHayato has NakamuraHayato id', () => {
        expect(nakamuraHayato.id).toBe(CharacterId.NakamuraHayato);
    });

    it('shimizuEmi has ShimizuEmi id', () => {
        expect(shimizuEmi.id).toBe(CharacterId.ShimizuEmi);
    });

    it('lingMo has LingMo id', () => {
        expect(lingMo.id).toBe(CharacterId.LingMo);
    });
});
