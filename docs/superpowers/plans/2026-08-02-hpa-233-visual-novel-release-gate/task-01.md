# HPA-233 Implementation Plan — Task 1: Lock V1 Schemas, Diagnostics, and the Acceptance Matrix

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 1: Lock V1 Schemas, Diagnostics, and the Acceptance Matrix

**Files:**
- Create: `packages/infra-cloudflare/src/release-gate/schemas.ts`
- Create: `packages/infra-cloudflare/src/release-gate/diagnostics.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/schemas.test.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__fixtures__/valid-evidence.ts`
- Create: `docs/quality/hpa-216-visual-asset-acceptance-matrix.md`

**Interfaces:**
- Consumes: `PublicationTarget`, `isStoryId`, `isPreviewId`, `isReleaseId`, `isSha256`, `qualifyAssetIdentity`, and canonical timestamp conventions from `@aquila/stories/runtime-assets`.
- Produces: `parseVisualNovelGateScenarioV1`, `parseVisualReviewRecordV1`, `parseWorkflowApprovalEvidenceV1`, `parseWebIdentityEvidenceV1`, `parseTier1EvidenceV1`, `parsePublicReleaseVerificationResultV1`, `parseVisualNovelReleaseGateReportV1`, `GateStageV1`, and `GateDiagnosticV1`.

- [ ] **Step 1: Write strict schema tests for the exact closed unions**

```ts
import { describe, expect, it } from 'vitest';
import {
    parseVisualNovelReleaseGateReportV1,
    parseWorkflowApprovalEvidenceV1,
} from '../schemas';
import { validGateReport, validWorkflowApproval } from '../__fixtures__/valid-evidence';

describe('VisualNovelReleaseGateReportV1', () => {
    it('accepts every required check and evidence kind', () => {
        expect(parseVisualNovelReleaseGateReportV1(validGateReport)).toEqual(validGateReport);
    });

    it('rejects unknown checks and evidence kinds', () => {
        expect(() =>
            parseVisualNovelReleaseGateReportV1({
                ...validGateReport,
                checks: { ...validGateReport.checks, extra: validGateReport.checks.webIdentity },
            })
        ).toThrow();
    });
});

describe('WorkflowApprovalEvidenceV1', () => {
    it('requires the protected environment and successful conclusion', () => {
        expect(parseWorkflowApprovalEvidenceV1(validWorkflowApproval)).toEqual(validWorkflowApproval);
        expect(() =>
            parseWorkflowApprovalEvidenceV1({
                ...validWorkflowApproval,
                environment: 'unprotected',
            })
        ).toThrow();
    });
});
```

- [ ] **Step 2: Run the schema test and verify it fails because the module does not exist**

Run:

```bash
bun --filter @aquila/infra-cloudflare test src/release-gate/__tests__/schemas.test.ts
```

Expected: FAIL with module-resolution errors for `../schemas` and `../diagnostics`.

- [ ] **Step 3: Implement the exact stage and evidence unions**

```ts
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
```

Use `z.object(...).strict()` for every V1 wire schema. Use `.superRefine()` for cross-field rules such as preview target requiring `previewId`, production target rejecting it, approved manual review, and every final check being present.

- [ ] **Step 4: Add parse functions with stable names**

```ts
export type VisualNovelReleaseGateReportV1 = z.infer<
    typeof visualNovelReleaseGateReportV1Schema
>;

export function parseVisualNovelReleaseGateReportV1(
    input: unknown
): VisualNovelReleaseGateReportV1 {
    return visualNovelReleaseGateReportV1Schema.parse(input);
}
```

Repeat this exact pattern for scenario, manual review, workflow approval, web identity, Tier 1 evidence, public verification, checks, references, and diagnostics.

- [ ] **Step 5: Add validation tests for identity mismatch and missing required fields**

```ts
it.each([
    ['preview id', { previewId: 'other-preview' }],
    ['release id', { releaseId: 'rel_other' }],
    ['checksum', { manifestSha256: '0'.repeat(64) }],
])('rejects mismatched %s in manual review binding', (_label, patch) => {
    const review = { ...validManualReview, ...patch };
    expect(() => parseVisualReviewRecordV1(review)).not.toThrow();
    expect(() => assertVisualReviewMatchesIdentity(review, validGateIdentity)).toThrow();
});
```

Define the pure binding helper in `schemas.ts` with this exact signature:

```ts
export function assertVisualReviewMatchesIdentity(
    review: VisualReviewRecordV1,
    expected: Pick<
        VisualNovelReleaseGateReportV1,
        'storyId' | 'previewId' | 'releaseId' | 'manifestSha256' | 'scenarioSha256'
    >
): void;
```

It validates only cross-document identity and decision/count rules; file access and evidence digests remain Task 4 responsibilities.

- [ ] **Step 6: Transcribe the 19 HPA-216 criteria into the exact ownership matrix**

Use columns:

```markdown
| ID | Criterion | Existing owner | Existing file/command | HPA-233 evidence | HPA-231 evidence/manual justification |
```

Every row must name an exact file and executable command. AC-06 must state that HPA-233 preserves the configured locale but does not add a locale-switch interaction. AC-08, AC-09, AC-13, AC-15, AC-18, and AC-19 must explicitly reference HPA-230/HPA-231 evidence rather than duplicate it.

- [ ] **Step 7: Run focused and package tests**

Run:

```bash
bun --filter @aquila/infra-cloudflare test src/release-gate/__tests__/schemas.test.ts
bun --filter @aquila/infra-cloudflare test
```

Expected: PASS; no existing publisher test changes.

- [ ] **Step 8: Commit the schema contract**

```bash
git add packages/infra-cloudflare/src/release-gate docs/quality/hpa-216-visual-asset-acceptance-matrix.md
git commit -m "feat(infra): define visual novel release gate contracts"
```

---
