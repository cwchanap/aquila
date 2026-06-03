export enum CharacterId {
    // core cast
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

    // extended named cast (trainAdventure)
    HasegawaMio = 'hasegawa_mio',
    HaradaErika = 'harada_erika',
    NakanoKaito = 'nakano_kaito',
    KisaragiSouma = 'kisaragi_souma',
    HimuroRikuto = 'himuro_rikuto',
    NanamiShiori = 'nanami_shiori',
    WatanabeMari = 'watanabe_mari',
    TakahashiAyaka = 'takahashi_ayaka',
    TakayamaSho = 'takayama_sho',
    ItoRiko = 'ito_riko',
    ChenYu = 'chen_yu',
    KurosawaRyuichi = 'kurosawa_ryuichi',
    ZhangWei = 'zhang_wei',
    WangHao = 'wang_hao',
    YamadaYumi = 'yamada_yumi',
    YamadaManager = 'yamada_manager',
    SuzukiTaro = 'suzuki_taro',
    SuzukiShinya = 'suzuki_shinya',
    SuzukiDaiki = 'suzuki_daiki',
    SaitoDaisuke = 'saito_daisuke',
    UsamiSeiichiro = 'usami_seiichiro',
    ShimizuKosuke = 'shimizu_kosuke',
    ShimizuYukari = 'shimizu_yukari',
    SasakiAi = 'sasaki_ai',
    SasakiYuko = 'sasaki_yuko',
    LiMingyuan = 'li_mingyuan',
    LinWanru = 'lin_wanru',
    SaitoKoichi = 'saito_koichi',
    SaitoMika = 'saito_mika',
    NathanielSterling = 'nathaniel_sterling',
    Kelan = 'kelan',
    Lila = 'lila',
    Ailaru = 'ailaru',
    Elysia = 'elysia',
    Seran = 'seran',
    Iranil = 'iranil',
    Orion = 'orion',
    Nisara = 'nisara',
    Serina = 'serina',
    Liana = 'liana',
    Aether = 'aether',
    Salvis = 'salvis',
    Aderin = 'aderin',
    SacredTree = 'sacred_tree',
    SuzukiYui = 'suzuki_yui',
    SuzukiYuma = 'suzuki_yuma',
    SuzukiKeiko = 'suzuki_keiko',
    SuzukiMiyuki = 'suzuki_miyuki',
    HashimotoKenichi = 'hashimoto_kenichi',
    Kuga = 'kuga',
    Aiwen = 'aiwen',
    Nanao = 'nanao',

    // dont_save_me_before_midnight
    GuYan = 'gu_yan',
    XuXingtang = 'xu_xingtang',
    ShaoQiming = 'shao_qiming',
    HanYue = 'han_yue',
    LinZhuren = 'lin_zhuren',
    GuZe = 'gu_ze',
    XuMother = 'xu_mother',
    BlackRaincoat = 'black_raincoat',
    Roommate = 'roommate',
    FemaleVoice = 'female_voice',
    ZhangHao = 'zhang_hao',

    // collapsed anonymous / role speakers
    ElfGuard = 'elf_guard',
    Elf = 'elf',
    Soldier = 'soldier',
    Guard = 'guard',
    Clerk = 'clerk',
    Maid = 'maid',
    Colleague = 'colleague',
    ManInBlack = 'man_in_black',
    PoliceOfficer = 'police_officer',
    Passerby = 'passerby',
    Waiter = 'waiter',
    Nurse = 'nurse',
    Doctor = 'doctor',
    Manager = 'manager',
    Official = 'official',
    Passenger = 'passenger',
    Driver = 'driver',
    Engineer = 'engineer',
    Message = 'message',
    Librarian = 'librarian',
    Staff = 'staff',
    MiddleAgedMan = 'middle_aged_man',
    MiddleAgedWoman = 'middle_aged_woman',
    InnKeeper = 'inn_keeper',
    Child = 'child',
    Crowd = 'crowd',
    Parent = 'parent',
    Man = 'man',
    Woman = 'woman',
    Student = 'student',
    Intercom = 'intercom',
    Announcement = 'announcement',
    Unknown = 'unknown',
    Voice = 'voice',
}

export interface CharacterInfo {
    id: CharacterId;
    /** Canonical display name. */
    name: string;
    /** Alternate labels (real name, role label, short form, voice form, …) that
     *  resolve to this character. May be empty for role ids. */
    aliases: string[];
}

const characterTable: Record<CharacterId, CharacterInfo> = {
    [CharacterId.Narrator]: {
        id: CharacterId.Narrator,
        name: '旁白',
        aliases: [],
    },
    [CharacterId.LiJie]: {
        id: CharacterId.LiJie,
        name: '李杰',
        aliases: ['男主角'],
    }, // 李杰** (artifact) and 李杰的回覆 (SMS) canonicalize to 李杰
    [CharacterId.TanakaKenta]: {
        id: CharacterId.TanakaKenta,
        name: '田中健太',
        aliases: [
            '健談男大生',
            '健談男生',
            '田中',
            '健太',
            '健太的聲音',
            '田中健太？',
        ],
    },
    [CharacterId.SuzukiAsuka]: {
        id: CharacterId.SuzukiAsuka,
        name: '鈴木明日香',
        aliases: ['活潑女大生', '活潑女生', '明日香', '明日香的聲音'],
    },
    [CharacterId.SatoTakumi]: {
        id: CharacterId.SatoTakumi,
        name: '佐藤拓海',
        aliases: ['沉穩男大生', '沉穩男生', '沉穩的男生', '拓海', '拓海的聲音'],
    },
    [CharacterId.TakahashiMisaki]: {
        id: CharacterId.TakahashiMisaki,
        name: '高橋美咲',
        aliases: ['多話女大生', '多話女生', '美咲'],
    },
    [CharacterId.SaitoRen]: {
        id: CharacterId.SaitoRen,
        name: '斎藤蓮',
        aliases: ['膽小眼鏡男', '眼鏡男'],
    }, // FLAG: is generic 眼鏡男(34) really SaitoRen, or a different bystander?
    [CharacterId.YamamotoKoji]: {
        id: CharacterId.YamamotoKoji,
        name: '山本浩二',
        aliases: ['慷慨大叔'],
    },
    [CharacterId.ItoNana]: {
        id: CharacterId.ItoNana,
        name: '伊藤奈々',
        aliases: ['焦慮妻子'],
    }, // 伊藤奈奈 canonicalizes to 伊藤奈々
    [CharacterId.ItoMakoto]: {
        id: CharacterId.ItoMakoto,
        name: '伊藤誠',
        aliases: ['煩躁丈夫'],
    },
    [CharacterId.KobayashiShota]: {
        id: CharacterId.KobayashiShota,
        name: '小林翔太',
        aliases: ['天真弟弟'],
    },
    [CharacterId.KobayashiTomoko]: {
        id: CharacterId.KobayashiTomoko,
        name: '小林智子',
        aliases: ['溫柔母親', '智子', '智子的聲音'],
    },
    [CharacterId.KobayashiYudai]: {
        id: CharacterId.KobayashiYudai,
        name: '小林雄大',
        aliases: ['沉穩父親', '雄大', '雄大的聲音'],
    },
    [CharacterId.KobayashiHina]: {
        id: CharacterId.KobayashiHina,
        name: '小林陽菜',
        aliases: ['懂事姐姐'],
    },
    [CharacterId.NakamuraHayato]: {
        id: CharacterId.NakamuraHayato,
        name: '中村隼人',
        aliases: ['自私中年男'],
    },
    [CharacterId.ShimizuEmi]: {
        id: CharacterId.ShimizuEmi,
        name: '清水恵美',
        aliases: ['文靜少女', '恵美', '恵美的聲音'],
    },
    [CharacterId.LingMo]: {
        id: CharacterId.LingMo,
        name: '凌墨',
        aliases: ['神秘黑衣男'],
    },
    [CharacterId.HasegawaMio]: {
        id: CharacterId.HasegawaMio,
        name: '長谷川澪',
        aliases: [],
    },
    [CharacterId.HaradaErika]: {
        id: CharacterId.HaradaErika,
        name: '原田繪里花',
        aliases: [],
    },
    [CharacterId.NakanoKaito]: {
        id: CharacterId.NakanoKaito,
        name: '中野海斗',
        aliases: [],
    },
    [CharacterId.KisaragiSouma]: {
        id: CharacterId.KisaragiSouma,
        name: '如月颯真',
        aliases: [],
    },
    [CharacterId.HimuroRikuto]: {
        id: CharacterId.HimuroRikuto,
        name: '氷室陸斗',
        aliases: [],
    },
    [CharacterId.NanamiShiori]: {
        id: CharacterId.NanamiShiori,
        name: '七海詩織',
        aliases: [],
    },
    [CharacterId.WatanabeMari]: {
        id: CharacterId.WatanabeMari,
        name: '渡邊真理',
        aliases: [],
    },
    [CharacterId.TakahashiAyaka]: {
        id: CharacterId.TakahashiAyaka,
        name: '高橋彩花',
        aliases: [],
    }, // FLAG: distinct from 高橋美咲(TakahashiMisaki)?
    [CharacterId.TakayamaSho]: {
        id: CharacterId.TakayamaSho,
        name: '高山翔',
        aliases: ['白袍劍士', '白袍年輕人'],
    }, // 白袍劍士/白袍年輕人 = aliases for 高山翔
    [CharacterId.ItoRiko]: {
        id: CharacterId.ItoRiko,
        name: '伊藤莉子',
        aliases: [],
    }, // FLAG: distinct Ito from 伊藤奈々/伊藤誠
    [CharacterId.ChenYu]: { id: CharacterId.ChenYu, name: '陳宇', aliases: [] },
    [CharacterId.KurosawaRyuichi]: {
        id: CharacterId.KurosawaRyuichi,
        name: '黑澤龍一',
        aliases: [],
    },
    [CharacterId.ZhangWei]: {
        id: CharacterId.ZhangWei,
        name: '張偉',
        aliases: [],
    },
    [CharacterId.WangHao]: {
        id: CharacterId.WangHao,
        name: '王浩',
        aliases: [],
    },
    [CharacterId.YamadaYumi]: {
        id: CharacterId.YamadaYumi,
        name: '山田由美',
        aliases: [],
    },
    [CharacterId.YamadaManager]: {
        id: CharacterId.YamadaManager,
        name: '山田部長',
        aliases: [],
    }, // FLAG: "Manager Yamada" — same person as 山田由美? assumed different.
    [CharacterId.SuzukiTaro]: {
        id: CharacterId.SuzukiTaro,
        name: '鈴木太郎',
        aliases: [],
    }, // FLAG: Suzuki family — distinct from 鈴木明日香
    [CharacterId.SuzukiShinya]: {
        id: CharacterId.SuzukiShinya,
        name: '鈴木真也',
        aliases: [],
    },
    [CharacterId.SuzukiDaiki]: {
        id: CharacterId.SuzukiDaiki,
        name: '鈴木大輝',
        aliases: [],
    },
    [CharacterId.SaitoDaisuke]: {
        id: CharacterId.SaitoDaisuke,
        name: '斎藤大輔',
        aliases: [],
    }, // 齋藤大輔 canonicalizes to 斎藤大輔
    [CharacterId.UsamiSeiichiro]: {
        id: CharacterId.UsamiSeiichiro,
        name: '宇佐美誠一郎',
        aliases: [],
    }, // 宇佐美警部 (title) canonicalizes to 宇佐美誠一郎
    [CharacterId.ShimizuKosuke]: {
        id: CharacterId.ShimizuKosuke,
        name: '清水浩介',
        aliases: ['清水'],
    }, // FLAG: bare 清水(2) assumed = 浩介, NOT 清水恵美/清水由香里
    [CharacterId.ShimizuYukari]: {
        id: CharacterId.ShimizuYukari,
        name: '清水由香里',
        aliases: [],
    }, // FLAG: distinct Shimizu from 浩介 & 恵美
    [CharacterId.SasakiAi]: {
        id: CharacterId.SasakiAi,
        name: '佐佐木愛',
        aliases: [],
    },
    [CharacterId.SasakiYuko]: {
        id: CharacterId.SasakiYuko,
        name: '佐佐木優子',
        aliases: [],
    }, // FLAG: distinct Sasaki from 愛
    [CharacterId.LiMingyuan]: {
        id: CharacterId.LiMingyuan,
        name: '李明遠',
        aliases: [],
    },
    [CharacterId.LinWanru]: {
        id: CharacterId.LinWanru,
        name: '林婉如',
        aliases: [],
    },
    [CharacterId.SaitoKoichi]: {
        id: CharacterId.SaitoKoichi,
        name: '斎藤浩一',
        aliases: ['斎藤父親'],
    }, // 斎藤父親 = 斎藤浩一 (the father)
    [CharacterId.SaitoMika]: {
        id: CharacterId.SaitoMika,
        name: '斎藤美香',
        aliases: ['斎藤母親'],
    }, // 斎藤母親 = 斎藤美香 (the mother)
    [CharacterId.NathanielSterling]: {
        id: CharacterId.NathanielSterling,
        name: '納撒尼爾·史特林',
        aliases: [],
    }, // 史特林 / 納撒尼爾史特林 canonicalize to 納撒尼爾·史特林
    [CharacterId.Kelan]: { id: CharacterId.Kelan, name: '凱蘭', aliases: [] }, // 精靈劍士凱蘭 canonicalizes to 凱蘭
    [CharacterId.Lila]: { id: CharacterId.Lila, name: '莉拉', aliases: [] }, // FLAG romaji
    [CharacterId.Ailaru]: {
        id: CharacterId.Ailaru,
        name: '艾拉如',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Elysia]: {
        id: CharacterId.Elysia,
        name: '艾莉希雅',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Seran]: { id: CharacterId.Seran, name: '瑟蘭', aliases: [] }, // FLAG romaji
    [CharacterId.Iranil]: {
        id: CharacterId.Iranil,
        name: '伊蘭尼爾',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Orion]: { id: CharacterId.Orion, name: '歐瑞恩', aliases: [] }, // FLAG romaji
    [CharacterId.Nisara]: {
        id: CharacterId.Nisara,
        name: '妮莎拉',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Serina]: {
        id: CharacterId.Serina,
        name: '瑟琳娜',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Liana]: { id: CharacterId.Liana, name: '莉雅娜', aliases: [] }, // FLAG romaji
    [CharacterId.Aether]: {
        id: CharacterId.Aether,
        name: '艾瑟爾',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Salvis]: {
        id: CharacterId.Salvis,
        name: '薩爾維斯',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.Aderin]: {
        id: CharacterId.Aderin,
        name: '艾德林',
        aliases: [],
    }, // FLAG romaji
    [CharacterId.SacredTree]: {
        id: CharacterId.SacredTree,
        name: '神樹',
        aliases: ['神樹之聲'],
    }, // 神樹之聲 = its voice
    [CharacterId.SuzukiYui]: {
        id: CharacterId.SuzukiYui,
        name: '鈴木結衣',
        aliases: [],
    }, // FLAG: Suzuki family member
    [CharacterId.SuzukiYuma]: {
        id: CharacterId.SuzukiYuma,
        name: '鈴木悠真',
        aliases: [],
    },
    [CharacterId.SuzukiKeiko]: {
        id: CharacterId.SuzukiKeiko,
        name: '鈴木惠子',
        aliases: [],
    },
    [CharacterId.SuzukiMiyuki]: {
        id: CharacterId.SuzukiMiyuki,
        name: '鈴木美雪',
        aliases: [],
    },
    [CharacterId.HashimotoKenichi]: {
        id: CharacterId.HashimotoKenichi,
        name: '橋本健一',
        aliases: [],
    },
    [CharacterId.Kuga]: { id: CharacterId.Kuga, name: '久我', aliases: [] }, // FLAG romaji (Kuga?)
    [CharacterId.Aiwen]: { id: CharacterId.Aiwen, name: '艾文', aliases: [] }, // FLAG romaji (Evan/Aiwen?)
    [CharacterId.Nanao]: { id: CharacterId.Nanao, name: '七尾', aliases: [] }, // FLAG: distinct from 七海詩織?
    [CharacterId.GuYan]: {
        id: CharacterId.GuYan,
        name: '顧言',
        aliases: [],
    },
    [CharacterId.XuXingtang]: {
        id: CharacterId.XuXingtang,
        name: '許星棠',
        aliases: [],
    },
    [CharacterId.ShaoQiming]: {
        id: CharacterId.ShaoQiming,
        name: '邵啟明',
        aliases: ['邵叔'],
    },
    [CharacterId.HanYue]: {
        id: CharacterId.HanYue,
        name: '韓越',
        aliases: [],
    },
    [CharacterId.LinZhuren]: {
        id: CharacterId.LinZhuren,
        name: '林主任',
        aliases: [],
    },
    [CharacterId.GuZe]: {
        id: CharacterId.GuZe,
        name: '顧澤',
        aliases: [],
    },
    [CharacterId.XuMother]: {
        id: CharacterId.XuMother,
        name: '許星棠母親',
        aliases: [],
    },
    [CharacterId.BlackRaincoat]: {
        id: CharacterId.BlackRaincoat,
        name: '黑雨衣',
        aliases: [],
    },
    [CharacterId.Roommate]: {
        id: CharacterId.Roommate,
        name: '室友',
        aliases: [],
    },
    [CharacterId.FemaleVoice]: {
        id: CharacterId.FemaleVoice,
        name: '女聲',
        aliases: [],
    },
    [CharacterId.ZhangHao]: {
        id: CharacterId.ZhangHao,
        name: '張昊',
        aliases: [],
    },
    [CharacterId.ElfGuard]: {
        id: CharacterId.ElfGuard,
        name: '精靈守衛',
        aliases: [],
    }, // unnamed elf guards/archers/swordsmen (凱蘭 handled separately)
    [CharacterId.Elf]: { id: CharacterId.Elf, name: '精靈', aliases: [] }, // generic elf villagers/elders/children/etc.
    [CharacterId.Soldier]: {
        id: CharacterId.Soldier,
        name: '士兵',
        aliases: [],
    },
    [CharacterId.Guard]: { id: CharacterId.Guard, name: '守衛', aliases: [] },
    [CharacterId.Clerk]: { id: CharacterId.Clerk, name: '店員', aliases: [] }, // shop clerks / counter / reception staff
    [CharacterId.Maid]: { id: CharacterId.Maid, name: '女僕', aliases: [] },
    [CharacterId.Colleague]: {
        id: CharacterId.Colleague,
        name: '同事',
        aliases: [],
    },
    [CharacterId.ManInBlack]: {
        id: CharacterId.ManInBlack,
        name: '黑西裝男',
        aliases: [],
    },
    [CharacterId.PoliceOfficer]: {
        id: CharacterId.PoliceOfficer,
        name: '警察',
        aliases: [],
    },
    [CharacterId.Passerby]: {
        id: CharacterId.Passerby,
        name: '路人',
        aliases: [],
    },
    [CharacterId.Waiter]: {
        id: CharacterId.Waiter,
        name: '服務生',
        aliases: [],
    },
    [CharacterId.Nurse]: { id: CharacterId.Nurse, name: '護士', aliases: [] }, // 护士 = simplified-char variant
    [CharacterId.Doctor]: { id: CharacterId.Doctor, name: '醫生', aliases: [] },
    [CharacterId.Manager]: {
        id: CharacterId.Manager,
        name: '經理',
        aliases: [],
    },
    [CharacterId.Official]: {
        id: CharacterId.Official,
        name: '官員',
        aliases: [],
    }, // FLAG: 中年警官 -> Official or PoliceOfficer?
    [CharacterId.Passenger]: {
        id: CharacterId.Passenger,
        name: '旅客',
        aliases: [],
    },
    [CharacterId.Driver]: { id: CharacterId.Driver, name: '司機', aliases: [] }, // FLAG: 機長 = (plane) captain lumped here
    [CharacterId.Engineer]: {
        id: CharacterId.Engineer,
        name: '工程師',
        aliases: [],
    },
    [CharacterId.Message]: {
        id: CharacterId.Message,
        name: '訊息',
        aliases: [],
    }, // FLAG: NON-character text/devices (SMS/voicemail/radio/note). Treat as a pseudo-speaker, or fold into Narrator?
    [CharacterId.Librarian]: {
        id: CharacterId.Librarian,
        name: '圖書館員',
        aliases: [],
    },
    [CharacterId.Staff]: {
        id: CharacterId.Staff,
        name: '工作人員',
        aliases: [],
    }, // FLAG: 鑑識人員 = forensics; lump into Staff?
    [CharacterId.MiddleAgedMan]: {
        id: CharacterId.MiddleAgedMan,
        name: '中年男子',
        aliases: [],
    },
    [CharacterId.MiddleAgedWoman]: {
        id: CharacterId.MiddleAgedWoman,
        name: '中年女人',
        aliases: [],
    },
    [CharacterId.InnKeeper]: {
        id: CharacterId.InnKeeper,
        name: '老闆娘',
        aliases: [],
    }, // FLAG: inn/shop owner — split from Clerk?
    [CharacterId.Child]: { id: CharacterId.Child, name: '小孩', aliases: [] },
    [CharacterId.Crowd]: { id: CharacterId.Crowd, name: '眾人', aliases: [] }, // collective voices (同事們/士兵們/精靈孩子們/四人...)
    [CharacterId.Parent]: { id: CharacterId.Parent, name: '家長', aliases: [] }, // FLAG: generic parent (斎藤母親/父親 are named above)
    [CharacterId.Man]: { id: CharacterId.Man, name: '男子', aliases: [] }, // FLAG: catch-all bystander men; 神秘男子 -> LingMo? 領頭者 -> a leader?
    [CharacterId.Woman]: { id: CharacterId.Woman, name: '女子', aliases: [] }, // FLAG: catch-all bystander women
    [CharacterId.Student]: {
        id: CharacterId.Student,
        name: '學生',
        aliases: [],
    }, // FLAG: descriptive student labels not matched to the 4 named students above
    [CharacterId.Intercom]: {
        id: CharacterId.Intercom,
        name: '對講機',
        aliases: [],
    },
    [CharacterId.Announcement]: {
        id: CharacterId.Announcement,
        name: '廣播',
        aliases: [],
    },
    [CharacterId.Unknown]: {
        id: CharacterId.Unknown,
        name: '？？？',
        aliases: [],
    }, // deliberate mystery speaker
    [CharacterId.Voice]: { id: CharacterId.Voice, name: '聲音', aliases: [] }, // unattributed off-screen voice — catch-all, MUST run last
};

// Lookup by canonical name OR any alias.
const nameToId = new Map<string, CharacterId>();
for (const c of Object.values(characterTable)) {
    nameToId.set(c.name, c.id);
    for (const a of c.aliases) nameToId.set(a, c.id);
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
