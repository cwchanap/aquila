import { Character } from './Character';
import {
    CharacterId,
    characterTable,
} from '@aquila/stories/generated/trainAdventure/characters';

const create = (id: string) => {
    const info = characterTable[id];
    return new Character(id, info?.name ?? id);
};

export const characters = Object.fromEntries(
    Object.values(CharacterId).map(id => [id, create(id)])
) as Record<string, Character>;

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

export function getCharacter(id: string) {
    return characters[id];
}
