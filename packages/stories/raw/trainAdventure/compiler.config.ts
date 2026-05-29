import { CharacterId, CharacterDirectory } from '../../src/characters';
import type {
    ResolvedCharacter,
    StoryCompilerConfig,
} from '../../src/compiler/config';

// Misspelled / verbose / dual-name source labels -> a clean canonical label.
// The canonical form is used both for resolution AND as the per-line displayName,
// so these specific labels are NOT shown as written (unlike legitimate aliases).
const canonicalize: Record<string, string> = {
    齋藤大輔: '斎藤大輔',
    史特林: '納撒尼爾·史特林',
    納撒尼爾史特林: '納撒尼爾·史特林',
    宇佐美警部: '宇佐美誠一郎',
    伊藤奈奈: '伊藤奈々',
    精靈劍士凱蘭: '凱蘭',
    '李明遠/斎藤浩一': '斎藤浩一',
    '林婉如/斎藤美香': '斎藤美香',
    '李杰**': '李杰',
    李杰的回覆: '李杰',
};

// Trailing voice / inner-thought / punctuation markers are stripped for RESOLUTION
// only (e.g. 健太的聲音 -> 健太, 李杰（內心）-> 李杰); the displayName keeps them.
const SUFFIX_RE =
    /(（內心）|\(內心\)|（内心）|的聲音|的喊聲|的低語|之聲|[?？！!。]+)$/g;
function stripSuffix(label: string): string {
    let prev: string;
    let cur = label.trim();
    do {
        prev = cur;
        cur = cur.replace(SUFFIX_RE, '').trim();
    } while (cur !== prev);
    return cur;
}

// Anonymous / role speakers collapse to ONE reference id each (A/B/甲/乙 dropped);
// the as-written label is preserved per line via displayName.
const rolePatterns: { pattern: RegExp; id: CharacterId }[] = [
    {
        pattern:
            /^\u7CBE\u9748(\u5B88\u885B|\u885B\u58EB|\u5F13\u7BAD\u624B|\u528D\u58EB)([A-Za-z\u7532\u4E59\u4E19]|\u7684\u8072\u97F3)?$/,
        id: CharacterId.ElfGuard,
    }, // unnamed elf guards/archers/swordsmen (凱蘭 handled separately)
    {
        pattern:
            /^(\u7CBE\u9748|.*\u7CBE\u9748.*|\u8001\u7CBE\u9748|\u5E74[\u9577\u8F15]\u7CBE\u9748.*)$/,
        id: CharacterId.Elf,
    }, // generic elf villagers/elders/children/etc.
    {
        pattern:
            /^(\u58EB\u5175|\u7F8E\u570B\u58EB\u5175|\u58EB\u5175[A-Za-z\u7532\u4E59]|\u58EB\u5175\u53F8\u6A5F|\u58EB\u5175\u5011|\u58EB\u5175\u7684\u8072\u97F3)$/,
        id: CharacterId.Soldier,
    },
    {
        pattern:
            /^(\u5B88\u885B[\u7532\u4E59]?|\u9580\u524D\u5B88\u885B|\u5B88\u885B\u7684\u8072\u97F3|\u770B\u5B88|\u6B66\u88DD\u770B\u5B88.*|\u5E74\u8F15\u5973\u885B\u5175|\u885B\u5175|\u7344\u8B66|\u8B66\u885B|\u4FDD\u5168)$/,
        id: CharacterId.Guard,
    },
    {
        pattern:
            /^(\u5E97\u54E1|.*\u5E97\u5E97\u54E1|\u5973\u50D5\u5E97\u54E1|\u6AC3\u6AAF\u4EBA\u54E1|\u8077\u54E1|\u5E74\u8F15\u5973\u8077\u54E1|\u5E97\u4E3B|\u5E97\u9577|\u6536\u9280\u54E1.*|\u524D\u53F0|\u63A5\u5F85\u4EBA\u54E1|\u670D\u52D9\u4EBA\u54E1)$/,
        id: CharacterId.Clerk,
    }, // shop clerks / counter / reception staff
    { pattern: /^\u5973\u50D5[A-Za-z]?$/, id: CharacterId.Maid },
    { pattern: /^\u540C\u4E8B([A-Za-z]|\u5011)?$/, id: CharacterId.Colleague },
    {
        pattern: /^\u9ED1\u897F\u88DD\u7537[A-Za-z\uFF1F]?$/,
        id: CharacterId.ManInBlack,
    },
    {
        pattern:
            /^(\u8B66\u5BDF[A-Za-z]?|\u5E74\u8F15\u8B66\u5BDF|\u503C\u73ED\u8B66\u5BDF|\u6AC3\u6AAF\u8B66\u5BDF)$/,
        id: CharacterId.PoliceOfficer,
    },
    { pattern: /^\u8DEF\u4EBA[\u7532\u4E59]?$/, id: CharacterId.Passerby },
    {
        pattern:
            /^(\u670D\u52D9\u751F|\u5973\u670D\u52D9\u751F|.*\u5973\u670D\u52D9\u751F)$/,
        id: CharacterId.Waiter,
    },
    {
        pattern: /^(\u8B77\u58EB|\u62A4\u58EB|\u6AC3\u6AAF\u8B77\u58EB)$/,
        id: CharacterId.Nurse,
    }, // 护士 = simplified-char variant
    {
        pattern: /^(\u91AB\u751F|\u8ECD\u91AB|\u91AB\u5E2B)$/,
        id: CharacterId.Doctor,
    },
    {
        pattern: /^(\u7D93\u7406|\u90E8\u9580\u7D93\u7406)$/,
        id: CharacterId.Manager,
    },
    {
        pattern: /^(\u5B98\u54E1|\u4E2D\u5E74\u8B66\u5B98)$/,
        id: CharacterId.Official,
    }, // FLAG: 中年警官 -> Official or PoliceOfficer?
    {
        pattern: /^(\u65C5\u5BA2[A-Za-z]?|\u4E0A\u73ED\u65CF)$/,
        id: CharacterId.Passenger,
    },
    {
        pattern: /^(\u53F8\u6A5F|\u8A08\u7A0B\u8ECA\u53F8\u6A5F|\u6A5F\u9577)$/,
        id: CharacterId.Driver,
    }, // FLAG: 機長 = (plane) captain lumped here
    { pattern: /^.*\u5DE5\u7A0B\u5E2B$/, id: CharacterId.Engineer },
    {
        pattern:
            /^(\u964C\u751F\u865F\u78BC|\u7C21\u8A0A\u5167\u5BB9|\u7C21\u8A0A|\u8A0A\u606F|\u8A9E\u97F3\u4FE1\u7BB1|\u4FBF\u689D|\u6536\u97F3\u6A5F|\u96FB\u8A71\u90A3\u982D|\u624B\u6A5F\u87A2\u5E55)$/,
        id: CharacterId.Message,
    }, // FLAG: NON-character text/devices (SMS/voicemail/radio/note). Treat as a pseudo-speaker, or fold into Narrator?
    {
        pattern: /^(\u5716\u66F8\u9928\u54E1|\u9928\u54E1)$/,
        id: CharacterId.Librarian,
    },
    {
        pattern:
            /^(\u5DE5\u4F5C\u4EBA\u54E1[A-Za-z]?|\u9451\u8B58\u4EBA\u54E1[A-Za-z]?|\u65C5\u9928\u54E1\u5DE5)$/,
        id: CharacterId.Staff,
    }, // FLAG: 鑑識人員 = forensics; lump into Staff?
    {
        pattern:
            /^(\u4E2D\u5E74\u7537[\u5B50\u4EBA\u6027]|\u80A5\u80D6\u4E2D\u5E74\u7537|\u80D6\u7537[\u5B50\u4EBA]|\u7F8E\u570B\u7537\u5B50)$/,
        id: CharacterId.MiddleAgedMan,
    },
    {
        pattern:
            /^(\u4E2D\u5E74\u5973[\u4EBA\u6027]|\u4E2D\u5E74\u5A66\u5973|\u4E2D\u5E74\u5A66\u4EBA)$/,
        id: CharacterId.MiddleAgedWoman,
    },
    {
        pattern: /^(\u8001\u95C6|.*\u8001\u95C6\u5A18|\u5973\u5C07)$/,
        id: CharacterId.InnKeeper,
    }, // FLAG: inn/shop owner — split from Clerk?
    {
        pattern:
            /^(\u5C0F?\u7537\u5B69|\u5C0F?\u5973\u5B69|\u5C0F\u5B69|\u5973\u5B69)$/,
        id: CharacterId.Child,
    },
    {
        pattern: /^(\u773E\u4EBA|\u56DB\u4EBA|\u670B\u53CB|.*\u5011)$/,
        id: CharacterId.Crowd,
    }, // collective voices (同事們/士兵們/精靈孩子們/四人...)
    {
        pattern: /^(\u6BCD\u89AA|\u7236\u89AA|\u5ABD\u5ABD|\u7238\u7238)$/,
        id: CharacterId.Parent,
    }, // FLAG: generic parent (斎藤母親/父親 are named above)
    {
        pattern:
            /^(\u5E74\u8F15\u7537[\u5B50\u6027]|\u795E\u79D8\u7537[\u5B50\u4EBA]|\u964C\u751F\u7537\u5B50|.*\u7684\u7537\u751F|\u9818\u982D\u8005|.*\u4F2F\u4F2F|.*\u5927\u53D4)$/,
        id: CharacterId.Man,
    }, // FLAG: catch-all bystander men; 神秘男子 -> LingMo? 領頭者 -> a leader?
    {
        pattern:
            /^(\u5E74\u8F15\u5973[\u5B50\u6027]|.*\u7684\u5973\u751F|\u5176\u4E2D\u4E00\u500B\u5973\u751F|\u53E6\u4E00\u500B\u5973\u751F|\u5973\u6027)$/,
        id: CharacterId.Woman,
    }, // FLAG: catch-all bystander women
    { pattern: /^.*(\u7537\u751F|\u5973\u751F)$/, id: CharacterId.Student }, // FLAG: descriptive student labels not matched to the 4 named students above
    {
        pattern: /^\u5C0D\u8B1B\u6A5F(\u7684\u8072\u97F3)?$/,
        id: CharacterId.Intercom,
    },
    { pattern: /^\u5EE3\u64AD(\u8072)?$/, id: CharacterId.Announcement },
    { pattern: /^[?\uFF1F]{2,}$/, id: CharacterId.Unknown }, // deliberate mystery speaker
    { pattern: /^.*\u8072\u97F3$/, id: CharacterId.Voice }, // unattributed off-screen voice — catch-all, MUST run last
];

function resolveCharacter(name: string): ResolvedCharacter | undefined {
    const displayName = canonicalize[name] ?? name;

    const exact = CharacterDirectory.getIdByName(displayName);
    if (exact) return { id: exact, displayName };

    const base = stripSuffix(displayName);
    if (base !== displayName) {
        const viaBase = CharacterDirectory.getIdByName(base);
        if (viaBase) return { id: viaBase, displayName };
    }

    for (const r of rolePatterns) {
        if (r.pattern.test(displayName) || r.pattern.test(base)) {
            return { id: r.id, displayName };
        }
    }

    return undefined;
}

const config: StoryCompilerConfig = {
    storyId: 'train_adventure',
    resolveCharacter,
    // Forum/news/marker paragraphs (no "**speaker**：" header) render as narration.
    defaultSpeaker: { id: CharacterId.Narrator, displayName: '旁白' },
};

export default config;
