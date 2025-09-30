export enum CharacterId {
    Narrator = 'narrator',
    LiJie = 'li_jie',
    ZhaoYang = 'zhao_yang',
    WangTing = 'wang_ting',
    SunPeng = 'sun_peng',
    ZhouQian = 'zhou_qian',
    WangHao = 'wang_hao',
    ShiLei = 'shi_lei',
    LiuShufen = 'liu_shufen',
    GaoZhiqiang = 'gao_zhiqiang',
    ZhengChen = 'zheng_chen',
    WuHui = 'wu_hui',
    ZhengYi = 'zheng_yi',
    ZhengXiaoyue = 'zheng_xiaoyue',
    QianMing = 'qian_ming',
    LinYa = 'lin_ya',
    LingMo = 'ling_mo',
}

export interface CharacterInfo {
    id: CharacterId;
    // Real character name (e.g., 石磊、王皓、林雅)
    name: string;
    // Legacy/display alias used in scripts/UI previously (e.g., 中年男子（慷慨大叔）、眼鏡男、少女A）
    alias: string;
}

const characterTable: Record<CharacterId, CharacterInfo> = {
    [CharacterId.Narrator]: {
        id: CharacterId.Narrator,
        name: '旁白',
        alias: '旁白',
    },
    [CharacterId.LiJie]: {
        id: CharacterId.LiJie,
        name: '李杰',
        alias: '李杰',
    },
    [CharacterId.ZhaoYang]: {
        id: CharacterId.ZhaoYang,
        name: '趙陽',
        alias: '大學生（男A）',
    },
    [CharacterId.WangTing]: {
        id: CharacterId.WangTing,
        name: '王婷',
        alias: '大學生（女A）',
    },
    [CharacterId.SunPeng]: {
        id: CharacterId.SunPeng,
        name: '孫鵬',
        alias: '大學生（男B）',
    },
    [CharacterId.ZhouQian]: {
        id: CharacterId.ZhouQian,
        name: '周倩',
        alias: '大學生（女B）',
    },
    [CharacterId.WangHao]: {
        id: CharacterId.WangHao,
        name: '王皓',
        alias: '眼鏡男',
    },
    [CharacterId.ShiLei]: {
        id: CharacterId.ShiLei,
        name: '石磊',
        alias: '中年男子（慷慨大叔）',
    },
    [CharacterId.LiuShufen]: {
        id: CharacterId.LiuShufen,
        name: '劉淑芬',
        alias: '中年夫婦（妻）',
    },
    [CharacterId.GaoZhiqiang]: {
        id: CharacterId.GaoZhiqiang,
        name: '高志強',
        alias: '中年夫婦（夫）',
    },
    [CharacterId.ZhengChen]: {
        id: CharacterId.ZhengChen,
        name: '鄭晨',
        alias: '小男孩',
    },
    [CharacterId.WuHui]: {
        id: CharacterId.WuHui,
        name: '吳慧',
        alias: '母親',
    },
    [CharacterId.ZhengYi]: {
        id: CharacterId.ZhengYi,
        name: '鄭毅',
        alias: '父親',
    },
    [CharacterId.ZhengXiaoyue]: {
        id: CharacterId.ZhengXiaoyue,
        name: '鄭曉月',
        alias: '姐姐',
    },
    [CharacterId.QianMing]: {
        id: CharacterId.QianMing,
        name: '錢明',
        alias: '中年男子（自私膽小）',
    },
    [CharacterId.LinYa]: {
        id: CharacterId.LinYa,
        name: '林雅',
        alias: '少女A',
    },
    [CharacterId.LingMo]: {
        id: CharacterId.LingMo,
        name: '凌墨',
        alias: '黑衣男',
    },
};

// Support lookups by both real name and legacy alias
const nameToId = new Map<string, CharacterId>();
for (const c of Object.values(characterTable)) {
    nameToId.set(c.name, c.id);
    nameToId.set(c.alias, c.id);
}

export class CharacterDirectory {
    static getById(id: CharacterId): CharacterInfo {
        return characterTable[id];
    }

    static getIdByName(name: string): CharacterId | undefined {
        return nameToId.get(name);
    }

    static getAll(): CharacterInfo[] {
        return Object.values(characterTable);
    }
}
