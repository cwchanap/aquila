import { Character } from './Character';
import { CharacterId } from './CharacterDirectory';

const create = (id: CharacterId) => new Character(id);

export const characters: Record<CharacterId, Character> = {
    [CharacterId.Narrator]: create(CharacterId.Narrator),
    [CharacterId.LiJie]: create(CharacterId.LiJie),
    [CharacterId.ZhaoYang]: create(CharacterId.ZhaoYang),
    [CharacterId.WangTing]: create(CharacterId.WangTing),
    [CharacterId.SunPeng]: create(CharacterId.SunPeng),
    [CharacterId.ZhouQian]: create(CharacterId.ZhouQian),
    [CharacterId.WangHao]: create(CharacterId.WangHao),
    [CharacterId.ShiLei]: create(CharacterId.ShiLei),
    [CharacterId.LiuShufen]: create(CharacterId.LiuShufen),
    [CharacterId.GaoZhiqiang]: create(CharacterId.GaoZhiqiang),
    [CharacterId.ZhengChen]: create(CharacterId.ZhengChen),
    [CharacterId.WuHui]: create(CharacterId.WuHui),
    [CharacterId.ZhengYi]: create(CharacterId.ZhengYi),
    [CharacterId.ZhengXiaoyue]: create(CharacterId.ZhengXiaoyue),
    [CharacterId.QianMing]: create(CharacterId.QianMing),
    [CharacterId.LinYa]: create(CharacterId.LinYa),
    [CharacterId.LingMo]: create(CharacterId.LingMo),
};

export type CharacterMap = typeof characters;

export const narrator = characters[CharacterId.Narrator];
export const liJie = characters[CharacterId.LiJie];
export const zhaoYang = characters[CharacterId.ZhaoYang];
export const wangTing = characters[CharacterId.WangTing];
export const sunPeng = characters[CharacterId.SunPeng];
export const zhouQian = characters[CharacterId.ZhouQian];
export const wangHao = characters[CharacterId.WangHao];
export const shiLei = characters[CharacterId.ShiLei];
export const liuShufen = characters[CharacterId.LiuShufen];
export const gaoZhiqiang = characters[CharacterId.GaoZhiqiang];
export const zhengChen = characters[CharacterId.ZhengChen];
export const wuHui = characters[CharacterId.WuHui];
export const zhengYi = characters[CharacterId.ZhengYi];
export const zhengXiaoyue = characters[CharacterId.ZhengXiaoyue];
export const qianMing = characters[CharacterId.QianMing];
export const linYa = characters[CharacterId.LinYa];
export const lingMo = characters[CharacterId.LingMo];

export function getCharacter(id: CharacterId) {
    return characters[id];
}
