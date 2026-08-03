import type { PublicationTarget } from '@aquila/stories/runtime-assets';

export const GATE_STAGES = [
    'input',
    'ci',
    'publisher-candidate',
    'r2-candidate',
    'pointer',
    'manifest',
    'coverage',
    'public-object',
    'browser-decode',
    'web-identity',
    'reader-flow',
    'manual-review',
    'evidence-binding',
    'production-pointer-proof',
    'post-activation-smoke',
] as const;

export type GateStageV1 = (typeof GATE_STAGES)[number];

export const GATE_EVIDENCE_KINDS = [
    'ci-result',
    'publisher-report',
    'r2-verification',
    'public-verification',
    'web-identity',
    'playwright-result',
    'manual-review',
    'workflow-approval',
    'pointer-snapshot',
] as const;

export type GateEvidenceKindV1 = (typeof GATE_EVIDENCE_KINDS)[number];

export interface GateDiagnosticV1 {
    code: string;
    stage: GateStageV1;
    message: string;
    storyId?: string;
    target?: PublicationTarget;
    releaseId?: string;
    manifestSha256?: string;
    identity?: string;
    safePath?: string;
    publicUrl?: string;
    evidenceId?: string;
}
