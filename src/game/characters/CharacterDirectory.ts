export type CharacterId =
    | 'narrator'
    | 'li_jie'
    | 'college_student_male_a'
    | 'college_student_female_a'
    | 'college_student_male_b'
    | 'glasses_man'
    | 'generous_middle_aged_man'
    | 'middle_aged_couple_wife'
    | 'middle_aged_couple_husband'
    | 'little_boy'
    | 'mother'
    | 'cowardly_middle_aged_man'
    | 'girl_a';

export interface CharacterInfo {
    id: CharacterId;
    name: string;
}

const characterTable: Record<CharacterId, CharacterInfo> = {
    narrator: { id: 'narrator', name: '旁白' },
    li_jie: { id: 'li_jie', name: '李杰' },
    college_student_male_a: {
        id: 'college_student_male_a',
        name: '大學生（男A）',
    },
    college_student_female_a: {
        id: 'college_student_female_a',
        name: '大學生（女A）',
    },
    college_student_male_b: {
        id: 'college_student_male_b',
        name: '大學生（男B）',
    },
    glasses_man: { id: 'glasses_man', name: '眼鏡男' },
    generous_middle_aged_man: {
        id: 'generous_middle_aged_man',
        name: '中年男子（慷慨大叔）',
    },
    middle_aged_couple_wife: {
        id: 'middle_aged_couple_wife',
        name: '中年夫婦（妻）',
    },
    middle_aged_couple_husband: {
        id: 'middle_aged_couple_husband',
        name: '中年夫婦（夫）',
    },
    little_boy: { id: 'little_boy', name: '小男孩' },
    mother: { id: 'mother', name: '母親' },
    cowardly_middle_aged_man: {
        id: 'cowardly_middle_aged_man',
        name: '中年男子（自私膽小）',
    },
    girl_a: {
        id: 'girl_a',
        name: '少女A',
    },
};

const nameToId = new Map<string, CharacterId>(
    Object.values(characterTable).map(character => [
        character.name,
        character.id,
    ])
);

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
