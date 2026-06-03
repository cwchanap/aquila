import { CharacterId, CharacterDirectory } from '../../src/characters';
import type {
    ResolvedCharacter,
    StoryCompilerConfig,
} from '../../src/compiler/config';

const SUFFIX_RE = /(（內心）|\(內心\)|（内心）|的聲音|[?？！!。]+)$/g;
function stripSuffix(label: string): string {
    let prev: string;
    let cur = label.trim();
    do {
        prev = cur;
        cur = cur.replace(SUFFIX_RE, '').trim();
    } while (cur !== prev);
    return cur;
}

const rolePatterns: { pattern: RegExp; id: CharacterId }[] = [
    { pattern: /^室友[A-Za-z]?$/, id: CharacterId.Roommate },
    { pattern: /^廣播(\u8072)?$/, id: CharacterId.Announcement },
    {
        pattern: /^(\u540C\u5B78[A-Za-z]?|\u9694\u58C1\u540C\u5B78)$/,
        id: CharacterId.Student,
    },
    {
        pattern: /^(\u8B66\u5BDF[A-Za-z]?|\u8B66\u54E1)$/,
        id: CharacterId.PoliceOfficer,
    },
    {
        pattern:
            /^(\u8A0A\u606F|\u7C21\u8A0A|\u624B\u6A5F\u87A2\u5E55|\u7D19\u689D|\u533F\u540D\u8A0A\u606F)$/,
        id: CharacterId.Message,
    },
    { pattern: /^.*\u8072\u97F3$/, id: CharacterId.Voice },
    { pattern: /^[?\uFF1F]{2,}$/, id: CharacterId.Unknown },
];

function resolveCharacter(name: string): ResolvedCharacter | undefined {
    const displayName = name;

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
    storyId: 'dont_save_me_before_midnight',
    resolveCharacter,
    defaultSpeaker: { id: CharacterId.Narrator, displayName: '旁白' },
};

export default config;
