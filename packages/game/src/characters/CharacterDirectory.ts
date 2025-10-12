export enum CharacterId {
    Narrator = 'narrator',
    LiJie = 'li_jie',
    TanakaKenta = 'tanaka_kenta',
    SuzukiAsuka = 'suzuki_asuka',
    SatoTakumi = 'sato_takumi',
    TakahashiMisaki = 'takahashi_misaki',
    SaitoRen = 'saito_ren',
    YamamotoKoji = 'yamamoto_koji',
    ItoNana = 'ito_nana',
    ItoMakoto = 'ito_makoto',
    KobayashiShota = 'kobayashi_shota',
    KobayashiTomoko = 'kobayashi_tomoko',
    KobayashiYudai = 'kobayashi_yudai',
    KobayashiHina = 'kobayashi_hina',
    NakamuraHayato = 'nakamura_hayato',
    ShimizuEmi = 'shimizu_emi',
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
        alias: '男主角',
    },
    [CharacterId.TanakaKenta]: {
        id: CharacterId.TanakaKenta,
        name: '田中健太',
        alias: '健談男大生',
    },
    [CharacterId.SuzukiAsuka]: {
        id: CharacterId.SuzukiAsuka,
        name: '鈴木明日香',
        alias: '活潑女大生',
    },
    [CharacterId.SatoTakumi]: {
        id: CharacterId.SatoTakumi,
        name: '佐藤拓海',
        alias: '沉穩男大生',
    },
    [CharacterId.TakahashiMisaki]: {
        id: CharacterId.TakahashiMisaki,
        name: '高橋美咲',
        alias: '多話女大生',
    },
    [CharacterId.SaitoRen]: {
        id: CharacterId.SaitoRen,
        name: '斎藤蓮',
        alias: '膽小眼鏡男',
    },
    [CharacterId.YamamotoKoji]: {
        id: CharacterId.YamamotoKoji,
        name: '山本浩二',
        alias: '慷慨大叔',
    },
    [CharacterId.ItoNana]: {
        id: CharacterId.ItoNana,
        name: '伊藤奈々',
        alias: '焦慮妻子',
    },
    [CharacterId.ItoMakoto]: {
        id: CharacterId.ItoMakoto,
        name: '伊藤誠',
        alias: '煩躁丈夫',
    },
    [CharacterId.KobayashiShota]: {
        id: CharacterId.KobayashiShota,
        name: '小林翔太',
        alias: '天真弟弟',
    },
    [CharacterId.KobayashiTomoko]: {
        id: CharacterId.KobayashiTomoko,
        name: '小林智子',
        alias: '溫柔母親',
    },
    [CharacterId.KobayashiYudai]: {
        id: CharacterId.KobayashiYudai,
        name: '小林雄大',
        alias: '沉穩父親',
    },
    [CharacterId.KobayashiHina]: {
        id: CharacterId.KobayashiHina,
        name: '小林陽菜',
        alias: '懂事姐姐',
    },
    [CharacterId.NakamuraHayato]: {
        id: CharacterId.NakamuraHayato,
        name: '中村隼人',
        alias: '自私中年男',
    },
    [CharacterId.ShimizuEmi]: {
        id: CharacterId.ShimizuEmi,
        name: '清水恵美',
        alias: '文靜少女',
    },
    [CharacterId.LingMo]: {
        id: CharacterId.LingMo,
        name: '凌墨',
        alias: '神秘黑衣男',
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
