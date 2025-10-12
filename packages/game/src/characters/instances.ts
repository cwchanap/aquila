import { Character } from './Character';
import { CharacterId } from './CharacterDirectory';

const create = (id: CharacterId) => new Character(id);

export const characters: Record<CharacterId, Character> = {
    [CharacterId.Narrator]: create(CharacterId.Narrator),
    [CharacterId.LiJie]: create(CharacterId.LiJie),
    [CharacterId.TanakaKenta]: create(CharacterId.TanakaKenta),
    [CharacterId.SuzukiAsuka]: create(CharacterId.SuzukiAsuka),
    [CharacterId.SatoTakumi]: create(CharacterId.SatoTakumi),
    [CharacterId.TakahashiMisaki]: create(CharacterId.TakahashiMisaki),
    [CharacterId.SaitoRen]: create(CharacterId.SaitoRen),
    [CharacterId.YamamotoKoji]: create(CharacterId.YamamotoKoji),
    [CharacterId.ItoNana]: create(CharacterId.ItoNana),
    [CharacterId.ItoMakoto]: create(CharacterId.ItoMakoto),
    [CharacterId.KobayashiShota]: create(CharacterId.KobayashiShota),
    [CharacterId.KobayashiTomoko]: create(CharacterId.KobayashiTomoko),
    [CharacterId.KobayashiYudai]: create(CharacterId.KobayashiYudai),
    [CharacterId.KobayashiHina]: create(CharacterId.KobayashiHina),
    [CharacterId.NakamuraHayato]: create(CharacterId.NakamuraHayato),
    [CharacterId.ShimizuEmi]: create(CharacterId.ShimizuEmi),
    [CharacterId.LingMo]: create(CharacterId.LingMo),
};

export type CharacterMap = typeof characters;

export const narrator = characters[CharacterId.Narrator];
export const liJie = characters[CharacterId.LiJie];
export const tanakaKenta = characters[CharacterId.TanakaKenta];
export const suzukiAsuka = characters[CharacterId.SuzukiAsuka];
export const satoTakumi = characters[CharacterId.SatoTakumi];
export const takahashiMisaki = characters[CharacterId.TakahashiMisaki];
export const saitoRen = characters[CharacterId.SaitoRen];
export const yamamotoKoji = characters[CharacterId.YamamotoKoji];
export const itoNana = characters[CharacterId.ItoNana];
export const itoMakoto = characters[CharacterId.ItoMakoto];
export const kobayashiShota = characters[CharacterId.KobayashiShota];
export const kobayashiTomoko = characters[CharacterId.KobayashiTomoko];
export const kobayashiYudai = characters[CharacterId.KobayashiYudai];
export const kobayashiHina = characters[CharacterId.KobayashiHina];
export const nakamuraHayato = characters[CharacterId.NakamuraHayato];
export const shimizuEmi = characters[CharacterId.ShimizuEmi];
export const lingMo = characters[CharacterId.LingMo];

export function getCharacter(id: CharacterId) {
    return characters[id];
}
