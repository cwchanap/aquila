# HPA-233 Implementation Plan — Task 9: Build Tier 1 Aggregation and Reusable Hermetic Evidence

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 9: Build Tier 1 Aggregation and Reusable Hermetic Evidence

**Files:**
- Create: `scripts/verify-visual-novel-ci.ts`
- Create: `scripts/__tests__/verify-visual-novel-ci.test.ts`
- Modify: `package.json`
- No change: `.github/workflows/e2e-tests.yml` remains the ordinary full E2E owner; the aggregate command is invoked locally and by the release workflow only.

**Interfaces:**
- Consumes: Task 1 `Tier1EvidenceV1`, existing package scripts, PostgreSQL/migration commands.
- Produces: `bun run verify:visual-novel-ci` and optional `--evidence <path>` output.

- [ ] **Step 1: Write command-plan tests**

```ts
it('runs visual E2E on desktop/mobile and lazy E2E on desktop only', () => {
    expect(buildTier1Commands()).toEqual([
        ['bun', 'run', 'compile:check'],
        ['bun', '--filter', '@aquila/stories', 'test'],
        ['bun', '--filter', 'web', 'test'],
        ['bun', '--filter', '@aquila/infra-cloudflare', 'test'],
        ['bun', '--filter', 'e2e', 'test:e2e', 'tests/reader-visual.spec.ts', '--project=chromium', '--project=mobile-chrome'],
        ['bun', '--filter', 'e2e', 'test:e2e', 'tests/reader-lazy-loading.spec.ts', '--project=chromium'],
    ]);
});
```

- [ ] **Step 2: Write PostgreSQL prerequisite tests**

Inject a database probe and command runner. Missing/unhealthy database must exit with environment code `3` and print the exact migration command needed. Successful mode runs `bun run drizzle:migrate` in `apps/web` before Playwright.

- [ ] **Step 3: Implement sequential command execution with visible ownership**

Prefix each stage with a stable name and stream child stdout/stderr directly. Stop on first failure and preserve the child exit code category where safe.

- [ ] **Step 4: Emit canonical Tier 1 evidence**

When `--evidence evidence/tier1.json` is supplied, include:

```ts
{
    schemaVersion: 1,
    commitSha,
    lockfileSha256,
    bunVersion,
    nodeVersion,
    playwrightVersion,
    commandSetVersion: 1,
    browserMatrix: ['chromium', 'mobile-chrome'],
    status: 'passed',
    completedAt,
}
```

Hash the canonical parsed document and write the digest separately in the workflow summary, not inside the document.

- [ ] **Step 5: Add the root script**

```json
{
  "scripts": {
    "verify:visual-novel-ci": "bun scripts/verify-visual-novel-ci.ts"
  }
}
```

- [ ] **Step 6: Run unit and dry-run tests**

```bash
bun test scripts/__tests__/verify-visual-novel-ci.test.ts
bun run verify:visual-novel-ci -- --dry-run
```

Dry-run output must show migrations before Playwright and the exact project split.

- [ ] **Step 7: Run Tier 1 against a local PostgreSQL service**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aquila_e2e \
bun run verify:visual-novel-ci -- --evidence /tmp/hpa233-tier1.json
```

Expected: all stages pass and the evidence parses with Task 1 schema.

- [ ] **Step 8: Commit Tier 1 tooling**

```bash
git add scripts package.json
git commit -m "test: add deterministic visual novel gate command"
```

---
