# HPA-233 Implementation Plan — Task 4: Validate Publisher Candidate Evidence and Build the Gate Coordinator

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 4: Validate Publisher Candidate Evidence and Build the Gate Coordinator

**Files:**
- Create: `packages/infra-cloudflare/src/release-gate/candidate-evidence.ts`
- Create: `packages/infra-cloudflare/src/release-gate/gate-runner.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/candidate-evidence.test.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/gate-runner.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/report.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/report.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 hashing/references, publisher-owned `parsePublisherReportV1`, and public/R2/browser/manual/workflow evidence.
- Produces:

```ts
export type GateIdentityV1 = {
    storyId: string;
    target: PublicationTarget;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    commitSha: string;
    scenarioSha256: string;
};

export function validateCandidatePublisherEvidence(
    report: PublisherReportV1,
    expected: GateIdentityV1
): CandidateEvidenceSummaryV1;

export async function runVisualNovelReleaseGate(
    input: RunVisualNovelReleaseGateInputV1,
    dependencies?: Partial<GateRunnerDependencies>
): Promise<VisualNovelReleaseGateReportV1>;
```

- [ ] **Step 1: Add an owning-module parser for retained publisher JSON**

In `src/publisher/__tests__/report.test.ts`, add strict parsing tests for the complete public `PublisherReportV1` shape, unknown fields, invalid targets, invalid release/checksum values, malformed counts, and unsafe diagnostics. Implement and export:

```ts
export function parsePublisherReportV1(input: unknown): PublisherReportV1;
```

The parser belongs in `publisher/report.ts`; `candidate-evidence.ts` must call it rather than reproduce the publisher wire schema.

- [ ] **Step 2: Write failing publisher candidate-evidence tests**

```ts
it('accepts only a production publish report with no pointer write', () => {
    const summary = validateCandidatePublisherEvidence(validPublisherReport, gateIdentity);
    expect(summary.pointerChanged).toBe(false);
    expect(summary.omittedIdentities).toEqual(EXPECTED_OMITTED_IDENTITIES);
});

it.each([
    ['wrong command', { command: 'activate' }],
    ['pointer write', { counts: { ...validPublisherReport.counts, pointersWritten: 1 } }],
    ['preview target', { target: { kind: 'preview', previewId: 'x' } }],
])('rejects %s', (_label, patch) => {
    expect(() => validateCandidatePublisherEvidence(deepMerge(validPublisherReport, patch), gateIdentity)).toThrow();
});
```

- [ ] **Step 3: Implement strict publisher evidence validation**

Require `command === 'publish'`, `status` success/no-op, production target, exact story/release/checksum, zero pointer writes, no pointer change, zero unclassified coverage, and internally consistent included/omitted counts. Derive omitted qualified identities from sanitized actions or coverage details already present in the retained report; do not reread mutable source plans.

- [ ] **Step 4: Write gate-runner mismatch tests**

```ts
it.each([
    ['web release', 'webIdentity', { releaseId: 'rel_other' }],
    ['manual checksum', 'manualReview', { manifestSha256: '0'.repeat(64) }],
    ['workflow environment', 'workflowApproval', { environment: 'other' }],
])('fails %s mismatch at evidence-binding', async (_label, key, patch) => {
    const report = await runVisualNovelReleaseGate(
        fixtureGateInput({ [key]: { ...fixtureGateInput()[key], ...patch } })
    );
    expect(report.status).toBe('failed');
    expect(report.diagnostics).toContainEqual(
        expect.objectContaining({ stage: 'evidence-binding' })
    );
});
```

- [ ] **Step 5: Implement deterministic binding order**

Validate in this order so failures are stable and cheap:

1. Input/identity.
2. Candidate publisher report.
3. Tier 1 evidence.
4. R2 deep evidence.
5. Public candidate evidence.
6. Public active-preview evidence.
7. Web identity evidence.
8. Browser evidence.
9. Manual review.
10. Workflow approval.
11. Production-pointer proof.

A failed early stage marks later checks `not-run`; it must never emit `passed`.

- [ ] **Step 6: Implement evidence digest verification**

The runner resolves every evidence path under `evidenceDir`, parses strict JSON where applicable, recomputes its digest, and compares it with the reference. Missing files, tampered bytes, symlink escape, duplicate IDs, or an unreferenced required artifact fail.

- [ ] **Step 7: Implement final report construction**

The report must include every required check and exact evidence reference. `createdAt` comes from injected `now()`. Canonical report hashing happens outside the report body to avoid self-reference.

- [ ] **Step 8: Run focused and package tests**

```bash
bun --filter @aquila/infra-cloudflare test \
  src/publisher/__tests__/report.test.ts \
  src/release-gate/__tests__/candidate-evidence.test.ts \
  src/release-gate/__tests__/gate-runner.test.ts
bun --filter @aquila/infra-cloudflare test
```

- [ ] **Step 9: Commit the coordinator core**

```bash
git add packages/infra-cloudflare/src/release-gate packages/infra-cloudflare/src/publisher/report.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat(infra): bind visual release gate evidence"
```

---
