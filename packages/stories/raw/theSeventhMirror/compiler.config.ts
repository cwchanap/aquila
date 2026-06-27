import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'the_seventh_mirror',
    defaultSpeakerId: 'narrator',
    suffixRegex: /(（內心）|\(內心\)|（内心）|的聲音|[?？！!。]+)$/g,
    rolePatterns: [
        { pattern: /^廣播(\u8072)?$/, id: 'announcement' },
        {
            pattern:
                /^(\u8A0A\u606F|\u7C21\u8A0A|\u624B\u6A5F\u87A2\u5E55|\u7D19\u689D|\u533F\u540D\u8A0A\u606F)$/,
            id: 'message',
        },
        {
            pattern: /^(\u8B66\u5BDF[A-Za-z]?|\u8B66\u54E1)$/,
            id: 'police_officer',
        },
        { pattern: /^.*\u8072\u97F3$/, id: 'voice' },
        {
            pattern: /^(\u5922\u8A71|\u5922\u4E2D\u7684\u8072\u97F3)$/,
            id: 'dream_voice',
        },
        {
            pattern:
                /^(\u6AC3\u53F0\u4EBA\u54E1|\u8077\u54E1|\u7814\u7A76\u4EBA\u54E1|\u6AC3\u53F0)$/,
            id: 'clinic_staff',
        },
        { pattern: /^[?\uFF1F]{2,}$/, id: 'unknown' },
    ],
};

export default config;
