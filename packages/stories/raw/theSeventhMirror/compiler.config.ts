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
        {
            pattern:
                /^(\u7AD9\u52D9\u4E3B\u7BA1|\u7AD9\u52D9\u4EBA\u54E1|\u7AD9\u52D9|\u6280\u8853\u4EBA\u54E1|\u6280\u8853\u73ED)$/,
            id: 'station_staff',
        },
        {
            pattern: /^(\u6551\u8B77\u4EBA\u54E1|\u6551\u8B77)$/,
            id: 'paramedic',
        },
        {
            pattern:
                /^(\u9435\u9053\u5B89\u5168\u4EBA\u54E1|\u5B89\u5168\u4EBA\u54E1)$/,
            id: 'railway_safety',
        },
        {
            pattern: /^(\u9451\u8B58\u4EBA\u54E1|\u9451\u8B58)$/,
            id: 'forensics',
        },
        {
            pattern:
                /^(\u8ABF\u67E5\u5A92\u9AD4\u524D\u8F29|\u5A92\u9AD4\u524D\u8F29|\u524D\u8F29)$/,
            id: 'media_senior',
        },
        {
            pattern:
                /^(\u5BA2\u670D|\u7063\u5CB8\u65B0\u4EA4\u901A\u5BA2\u670D)$/,
            id: 'customer_service',
        },
        {
            pattern: /^(\u4FDD\u5168|\u57FA\u5730\u4FDD\u5168)$/,
            id: 'security_guard',
        },
        {
            pattern:
                /^(\u7DAD\u4FEE\u4EBA\u54E1|\u7DAD\u4FEE|\u7DAD\u4FEE\u54E1|\u7DAD\u4FEE\u5DE5\u4EBA|\u5DE5\u4F5C\u4EBA\u54E1)$/,
            id: 'maintenance_worker',
        },
        {
            pattern:
                /^(\u91AB\u9662\u6AC3\u53F0|\u6025\u8A3A\u6AC3\u53F0|\u63A5\u5F85\u4EBA\u54E1)$/,
            id: 'hospital_clerk',
        },
        {
            pattern:
                /^(\u91AB\u9662\u4FDD\u5B89|\u91AB\u9662\u884C\u653F|\u884C\u653F\u4EBA\u54E1)$/,
            id: 'hospital_security',
        },
        {
            pattern:
                /^(\u91AB\u8B77|\u8B77\u7406\u4EBA\u54E1|\u8B77\u58EB|\u91AB\u751F|\u91AB\u8B77\u4EBA\u54E1|\u91AB\u7642\u5718\u968A)$/,
            id: 'medical_staff',
        },
        {
            pattern:
                /^(\u8CC7\u6599\u5BA4\u8077\u54E1|\u95B1\u89BD\u5BA4\u8077\u54E1|\u8077\u54E1)$/,
            id: 'archive_staff',
        },
        {
            pattern:
                /^(TKS\u6CD5\u52D9|TKS\u516C\u95DC|\u6CD5\u52D9|\u516C\u95DC)$/,
            id: 'tks_legal',
        },
        { pattern: /^[?\uFF1F]{2,}$/, id: 'unknown' },
    ],
};

export default config;
