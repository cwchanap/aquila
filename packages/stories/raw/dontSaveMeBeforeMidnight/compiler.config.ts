import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'dont_save_me_before_midnight',
    defaultSpeakerId: 'narrator',
    suffixRegex: /(（內心）|\(內心\)|（内心）|的聲音|[?？！!。]+)$/g,
    rolePatterns: [
        { pattern: /^室友[A-Za-z]?$/, id: 'roommate' },
        { pattern: /^廣播(\u8072)?$/, id: 'announcement' },
        {
            pattern: /^(\u540C\u5B78[A-Za-z]?|\u9694\u58C1\u540C\u5B78)$/,
            id: 'student',
        },
        {
            pattern: /^(\u8B66\u5BDF[A-Za-z]?|\u8B66\u54E1)$/,
            id: 'police_officer',
        },
        {
            pattern:
                /^(\u8A0A\u606F|\u7C21\u8A0A|\u624B\u6A5F\u87A2\u5E55|\u7D19\u689D|\u533F\u540D\u8A0A\u606F)$/,
            id: 'message',
        },
        { pattern: /^\u8001\u5E2B$/, id: 'teacher' },
        { pattern: /^.*\u8072\u97F3$/, id: 'voice' },
        { pattern: /^[?\uFF1F]{2,}$/, id: 'unknown' },
    ],
};

export default config;
