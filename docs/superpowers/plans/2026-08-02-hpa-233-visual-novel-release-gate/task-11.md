# HPA-233 Implementation Plan — Task 11: Add Activation Assertion, Production Smoke, Runbook, and Final Verification

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 11: Add Activation Assertion, Production Smoke, Runbook, and Final Verification

**Files:**
- Create: `packages/infra-cloudflare/src/release-gate/activation-assertion.ts`
- Create: `packages/infra-cloudflare/src/release-gate/production-smoke.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/activation-assertion.test.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/production-smoke.test.ts`
- Create: `docs/infrastructure/visual-novel-release-gate.md`
- Modify: `.env.example`
- Modify: `docs/quality/hpa-216-visual-asset-acceptance-matrix.md`

**Interfaces:**
- Consumes: final report parser, evidence hashing, public active verifier, production browser evidence, existing publisher activation/rollback commands.
- Produces:

```ts
export async function assertActivationReady(
    input: AssertActivationReadyInputV1
): Promise<ActivationReadyResultV1>;

export async function runProductionSmoke(
    input: ProductionSmokeInputV1,
    dependencies?: Partial<ProductionSmokeDependencies>
): Promise<ProductionSmokeReportV1>;
```

- [ ] **Step 1: Write activation assertion tests**

```ts
it('accepts only a passing report with matching retained evidence', async () => {
    await expect(assertActivationReady(validAssertionInput)).resolves.toEqual({ status: 'passed' });
});

it.each([
    ['failed report', { status: 'failed' }],
    ['wrong release', { releaseId: 'rel_other' }],
    ['tampered evidence', { evidenceDigestOverride: '0'.repeat(64) }],
])('rejects %s without calling activation', async (_label, patch) => {
    const activate = vi.fn();
    await expect(assertActivationReady(fixtureAssertionInput(patch), { activate })).rejects.toThrow();
    expect(activate).not.toHaveBeenCalled();
});
```

The assertion module must not import or receive a pointer mutation function at all; the mock above should be unnecessary after design cleanup. Prefer a static dependency test asserting no import from publisher activation modules.

- [ ] **Step 2: Implement read-only activation assertion**

Validate report schema/status, exact story/release/checksum/commit, every required check, every referenced evidence digest, manual review, workflow approval, web identity, and production-pointer proof. Emit a compact machine-readable success result. Do not read mutable source plans or call R2 writes.

- [ ] **Step 3: Write production smoke tests**

Test expected production pointer/release/checksum, no preview ID, public active verification, representative object decode, production web identity, one reader progression, pointer revalidation, and no write operation. Wrong active release must fail at `post-activation-smoke`.

- [ ] **Step 4: Implement production smoke coordinator**

Compose the public active verifier and structured production Playwright evidence. Require production asset environment and configured production web origin. Use the same expected checksum typed value and shared diagnostics.

- [ ] **Step 5: Wire both subcommands through Task 5 CLI**

Document and test:

```bash
bun --filter @aquila/infra-cloudflare assets release-gate assert-activation-ready \
  --report evidence/gate-report.json \
  --story <story-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --commit-sha <sha>

bun --filter @aquila/infra-cloudflare assets release-gate smoke-production \
  --story <story-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --asset-base-url <production-assets> \
  --web-base-url <production-web> \
  --browser-evidence <production-smoke.json> \
  --json
```

- [ ] **Step 6: Write the operator runbook**

Include exact sections:

1. Ownership and prerequisites.
2. Explicit preview-ID setup in Vercel.
3. Candidate publication with `--no-activate`.
4. Prepare dispatch and non-authorizing evidence.
5. Human review record template.
6. Protected-environment finalize dispatch.
7. Evidence retention and verification.
8. `assert-activation-ready`.
9. Existing atomic production activation command.
10. Production smoke.
11. Rollback decision using existing verified-release rollback.
12. Troubleshooting keyed by `GateStageV1` and diagnostic code.
13. Weaker maintainer-only fallback when protected environments are unavailable.

- [ ] **Step 7: Complete every ownership-matrix command/path**

Replace any ticket-only references with exact current test files and commands. Mark manual visual judgment rows with review case IDs and justification. Confirm the matrix is self-contained without opening Linear.

- [ ] **Step 8: Run the complete credential-free verification suite**

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun lint
bun run build
```

Then run Tier 1 with PostgreSQL:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aquila_e2e \
bun run verify:visual-novel-ci -- --evidence /tmp/hpa233-tier1.json
```

- [ ] **Step 9: Run workflow/static safety checks**

```bash
actionlint .github/workflows/r2-publisher-preview.yml .github/workflows/visual-novel-release-gate.yml
grep -R --line-number -- '--confirm-production' .github/workflows/visual-novel-release-gate.yml && exit 1 || true
grep -R --line-number 'PUBLIC_ASSET_' packages/e2e/playwright.release-gate.config.ts packages/e2e/tests/visual-novel-release-gate.spec.ts && exit 1 || true
```

- [ ] **Step 10: Run the gated preview workflow twice**

Run `prepare`, perform the review against the generated preview, then run `finalize` under the protected environment. Retain run URLs, artifact IDs/digests, release ID, checksum, preview ID, stage durations, and production-pointer proof in the PR description. Confirm prepare cannot produce a passing final report.

- [ ] **Step 11: Self-review against the canonical design**

Check every design section and all 19 HPA-216 criteria against a task, test, command, or explicit HPA-231/manual owner. Search the implementation and plan for unfinished markers, duplicate schemas, hand-built publication paths, local-server fallback in remote tests, and production mutation in the gate workflow.

- [ ] **Step 12: Commit final handoff and documentation**

```bash
git add packages/infra-cloudflare apps/web packages/e2e docs .env.example
git commit -m "docs: add visual release gate operations and handoff"
```

---
