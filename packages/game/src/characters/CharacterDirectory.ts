export type CharacterId =
    | 'narrator'
    | 'li_jie'
    | 'zhao_yang'
    | 'wang_ting'
    | 'sun_peng'
    | 'zhou_qian'
    | 'wang_hao'
    | 'shi_lei'
    | 'liu_shufen'
    | 'gao_zhiqiang'
    | 'zheng_chen'
    | 'wu_hui'
    | 'zheng_yi'
    | 'zheng_xiaoyue'
    | 'qian_ming'
    | 'lin_ya'
    | 'ling_mo';

export interface CharacterInfo {
    id: CharacterId;
    // Real character name (e.g., 石磊、王皓、林雅)
    name: string;
    // Legacy/display alias used in scripts/UI previously (e.g., 中年男子（慷慨大叔）、眼鏡男、少女A）
    alias: string;
}

const characterTable: Record<CharacterId, CharacterInfo> = {
    narrator: { id: 'narrator', name: '旁白', alias: '旁白' },
    li_jie: { id: 'li_jie', name: '李杰', alias: '李杰' },
    zhao_yang: { id: 'zhao_yang', name: '趙陽', alias: '大學生（男A）' },
    wang_ting: { id: 'wang_ting', name: '王婷', alias: '大學生（女A）' },
    sun_peng: { id: 'sun_peng', name: '孫鵬', alias: '大學生（男B）' },
    zhou_qian: { id: 'zhou_qian', name: '周倩', alias: '大學生（女B）' },
    wang_hao: { id: 'wang_hao', name: '王皓', alias: '眼鏡男' },
    shi_lei: { id: 'shi_lei', name: '石磊', alias: '中年男子（慷慨大叔）' },
    liu_shufen: { id: 'liu_shufen', name: '劉淑芬', alias: '中年夫婦（妻）' },
    gao_zhiqiang: {
        id: 'gao_zhiqiang',
        name: '高志強',
        alias: '中年夫婦（夫）',
    },
    zheng_chen: { id: 'zheng_chen', name: '鄭晨', alias: '小男孩' },
    wu_hui: { id: 'wu_hui', name: '吳慧', alias: '母親' },
    zheng_yi: { id: 'zheng_yi', name: '鄭毅', alias: '父親' },
    zheng_xiaoyue: { id: 'zheng_xiaoyue', name: '鄭曉月', alias: '姐姐' },
    qian_ming: { id: 'qian_ming', name: '錢明', alias: '中年男子（自私膽小）' },
    lin_ya: { id: 'lin_ya', name: '林雅', alias: '少女A' },
    ling_mo: { id: 'ling_mo', name: '凌墨', alias: '黑衣男' },
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
