const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_D = 'd'.repeat(64);
const SHA_E = 'e'.repeat(64);

export const validPreviewTarget = {
    kind: 'preview',
    previewId: 'hpa-233',
} as const;

export const validReleaseId = `sha256-${SHA_A}`;
export const otherValidReleaseId = `sha256-${SHA_B}`;

export const validGateScenario = {
    schemaVersion: 1,
    storyId: 'the_seventh_mirror',
    locale: 'en',
    directOpen: { sceneId: 'opening', dialogueIndex: 1 },
    transition: {
        from: { sceneId: 'opening', dialogueIndex: 1 },
        to: { sceneId: 'station', dialogueIndex: 2 },
        backgroundChanges: true,
        portraitChanges: true,
    },
    bookmark: { sceneId: 'station', dialogueIndex: 2 },
    omittedFallback: {
        sceneId: 'station',
        dialogueIndex: 3,
        identity: 'portrait:characters/mei/missing',
    },
    choice: {
        sceneId: 'station',
        dialogueIndex: 4,
        choiceIndex: 0,
        expectedSceneId: 'platform',
    },
    unrelatedStoryIds: ['train_adventure'],
} as const;

export const validManualReview = {
    schemaVersion: 1,
    storyId: 'the_seventh_mirror',
    previewId: 'hpa-233',
    releaseId: validReleaseId,
    manifestSha256: SHA_B,
    scenarioSha256: SHA_C,
    reviewedAt: '2026-08-03T12:00:00.000Z',
    reviewer: 'release-reviewer',
    decision: 'approved',
    includedCount: 2,
    omittedCount: 1,
    representativeRoutes: ['/en/stories/the_seventh_mirror?scene=opening'],
    notes: ['Desktop and mobile review completed.'],
} as const;

export const validWorkflowApproval = {
    schemaVersion: 1,
    repository: 'cwchan/aquila',
    workflowRef: '.github/workflows/visual-novel-release-gate.yml@main',
    runId: 123456,
    runAttempt: 1,
    jobId: 'release-gate-finalize',
    actor: 'release-bot',
    environment: 'visual-novel-release-approval',
    conclusion: 'success',
} as const;

export const validTier1Evidence = {
    schemaVersion: 1,
    commitSha: 'f'.repeat(40),
    lockfileSha256: SHA_D,
    bunVersion: '1.3.1',
    nodeVersion: '22.10.0',
    playwrightVersion: '1.55.0',
    commandSetVersion: 1,
    browserMatrix: ['chromium', 'mobile-chrome'],
    status: 'passed',
    completedAt: '2026-08-03T12:00:00.000Z',
} as const;

export const validWebIdentityEvidence = {
    schemaVersion: 1,
    target: 'preview',
    webBaseUrl: 'https://preview.aquila.example',
    assetEnvironment: 'preview',
    previewId: 'hpa-233',
    releaseId: validReleaseId,
    manifestSha256: SHA_B,
    pointerRequestUrl:
        'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/current.json',
    manifestRequestUrl:
        'https://assets.aquila.example/vn/previews/hpa-233/stories/the_seventh_mirror/releases/runtime-manifest.json',
} as const;

export const validPublicVerificationResult = {
    schemaVersion: 1,
    status: 'passed',
    mode: 'candidate',
    storyId: 'the_seventh_mirror',
    target: validPreviewTarget,
    releaseId: validReleaseId,
    manifestSha256: SHA_B,
    checks: [{ id: 'manifest.fetch', status: 'passed' }],
    diagnostics: [],
} as const;

export const validGateEvidence = [
    {
        id: 'ci',
        kind: 'ci-result',
        path: 'ci/result.json',
        sha256: SHA_D,
        mediaType: 'application/json',
    },
    {
        id: 'publisher',
        kind: 'publisher-report',
        path: 'publisher/report.json',
        sha256: SHA_E,
        mediaType: 'application/json',
    },
    {
        id: 'r2',
        kind: 'r2-verification',
        path: 'r2/result.json',
        sha256: SHA_A,
        mediaType: 'application/json',
    },
    {
        id: 'public',
        kind: 'public-verification',
        path: 'public/result.json',
        sha256: SHA_B,
        mediaType: 'application/json',
    },
    {
        id: 'web',
        kind: 'web-identity',
        path: 'web/identity.json',
        sha256: SHA_C,
        mediaType: 'application/json',
    },
    {
        id: 'browser',
        kind: 'playwright-result',
        path: 'browser/result.json',
        sha256: SHA_D,
        mediaType: 'application/json',
    },
    {
        id: 'manual',
        kind: 'manual-review',
        path: 'manual/review.json',
        sha256: SHA_E,
        mediaType: 'application/json',
    },
    {
        id: 'workflow',
        kind: 'workflow-approval',
        path: 'workflow/approval.json',
        sha256: SHA_A,
        mediaType: 'application/json',
    },
    {
        id: 'pointer',
        kind: 'pointer-snapshot',
        path: 'pointer/before.json',
        sha256: SHA_B,
        mediaType: 'application/json',
    },
] as const;

const passedCheck = { status: 'passed', evidenceIds: ['ci'] } as const;

export const validGateReport = {
    schemaVersion: 1,
    status: 'passed',
    storyId: 'the_seventh_mirror',
    target: validPreviewTarget,
    previewId: 'hpa-233',
    releaseId: validReleaseId,
    manifestSha256: SHA_B,
    commitSha: 'f'.repeat(40),
    scenarioSha256: SHA_C,
    manualReviewSha256: SHA_E,
    createdAt: '2026-08-03T12:00:00.000Z',
    checks: {
        deterministicCi: passedCheck,
        publisherCandidate: passedCheck,
        r2Candidate: passedCheck,
        publicCandidate: passedCheck,
        publicActiveRelease: passedCheck,
        webIdentity: passedCheck,
        browserFlows: passedCheck,
        manualReview: passedCheck,
        workflowApproval: passedCheck,
        productionPointerUnchanged: passedCheck,
    },
    evidence: validGateEvidence,
    diagnostics: [],
} as const;

export const validGateIdentity = {
    storyId: validGateReport.storyId,
    previewId: validGateReport.previewId,
    releaseId: validGateReport.releaseId,
    manifestSha256: validGateReport.manifestSha256,
    scenarioSha256: validGateReport.scenarioSha256,
} as const;
