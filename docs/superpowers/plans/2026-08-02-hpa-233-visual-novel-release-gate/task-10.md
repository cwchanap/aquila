# HPA-233 Implementation Plan — Task 10: Implement Prepare/Finalize Workflow with Protected Approval

> Parent plan: [`../2026-08-02-hpa-233-visual-novel-release-gate.md`](../2026-08-02-hpa-233-visual-novel-release-gate.md)

## Task 10: Implement Prepare/Finalize Workflow with Protected Approval

**Files:**
- Create: `.github/workflows/visual-novel-release-gate.yml`
- Modify: `.github/workflows/r2-publisher-preview.yml`
- Create: `packages/infra-cloudflare/scripts/release-gate-workflow-evidence.ts`
- Create: `packages/infra-cloudflare/src/release-gate/__tests__/workflow-contract.test.ts`

**Interfaces:**
- Consumes: Tasks 3–9 commands/evidence, existing publisher `publish`, `mirror-preview`, `activate`, `verify --deep`, and `r2-gate-capture-state.ts`.
- Produces: non-authorizing prepare artifact and authorizing finalize artifact accepted by Task 4 gate runner.

- [ ] **Step 1: Rename only the existing workflow display name**

Change:

```yaml
name: R2 Publisher Regression Gate
```

Do not alter its fixture lifecycle, permissions, dispatch inputs, or evidence semantics in this step.

- [ ] **Step 2: Write a workflow-contract test before authoring YAML**

Parse YAML and assert:

```ts
expect(workflow.on.workflow_dispatch.inputs.phase.options).toEqual(['prepare', 'finalize']);
expect(workflow.jobs.finalize.environment).toBe('visual-novel-release-approval');
expect(JSON.stringify(workflow)).not.toContain('--confirm-production');
expect(JSON.stringify(workflow)).not.toContain('assets rollback --environment production');
```

Also assert both phases provision PostgreSQL 16 and run migrations before any Tier 1 Playwright execution.

- [ ] **Step 3: Define exact workflow inputs**

Require these exact `workflow_dispatch` inputs: `phase`, `candidate_commit_sha`, `story_id`, `preview_id`, `release_id`, `manifest_sha256`, `publisher_report_run_id`, `publisher_report_artifact`, `asset_base_url`, `web_base_url`, `production_web_origin`, `scenario_path`, `prepare_run_id`, and `manual_review_path`. `prepare_run_id` and `manual_review_path` are required only when `phase=finalize`; validate this before checkout-dependent work.

Validate all user inputs in one early Bun step before using them in shell commands. Never interpolate unvalidated values into paths or command flags.

- [ ] **Step 4: Implement shared setup and PostgreSQL prerequisites**

Both phases use pinned Bun/Node, Playwright install, PostgreSQL 16 service, `DATABASE_URL`, dependency install, and `bun run drizzle:migrate` in `apps/web` before Tier 1.

- [ ] **Step 5: Implement prepare sequence**

Execute:

1. Checkout exact candidate commit.
2. Tier 1 with evidence.
3. Validate retained production candidate report.
4. Capture production pointer.
5. `assets verify --deep` for production candidate with expected checksum.
6. Public candidate verification without pointer read.
7. `assets mirror-preview` with explicit preview ID/checksum.
8. `assets activate --environment preview` only.
9. Public active-preview verification.
10. Remote web-identity preflight and Desktop/Mobile browser flow.
11. Capture production pointer and prove unchanged.
12. Upload non-authorizing evidence with summary text `PREPARE ONLY — NOT PRODUCTION AUTHORIZATION`.

- [ ] **Step 6: Implement finalize Tier 1 reuse rules**

Download prepare evidence. Reuse only if commit SHA, lockfile digest, Bun/Node/Playwright versions, command-set version, browser matrix, status, and artifact digest match. Otherwise provision PostgreSQL, migrate, and rerun Tier 1. Record `reused` or `rerun` in final summary.

- [ ] **Step 7: Implement finalize live sequence under protected environment**

The authorizing job declares:

```yaml
environment: visual-novel-release-approval
```

It reruns all live R2 deep, public candidate, idempotent mirror/preview activation, public active, web identity, and Desktop/Mobile browser checks. It validates manual review, captures production pointer before/after, writes exact `WorkflowApprovalEvidenceV1` from Actions context, runs `assets release-gate verify-preview`, and uploads the final report and digest.

- [ ] **Step 8: Add timeout measurement and budgeting**

Measure each stage with monotonic shell timestamps and write durations to the job summary. Start with a conservative `timeout-minutes: 60` for the first implementation run, then reduce to measured worst success plus 50% in the same PR before declaring completion. Prepare and finalize may have different final timeouts.

- [ ] **Step 9: Add failure-path artifact upload**

Use `if: always()` for safe diagnostics: reports, traces, screenshots, pointer snapshots, stage timings, and sanitized command logs. Never upload environment dumps, credential files, signed URLs, or private source paths.

- [ ] **Step 10: Run workflow validation**

```bash
actionlint .github/workflows/r2-publisher-preview.yml .github/workflows/visual-novel-release-gate.yml
bun --filter @aquila/infra-cloudflare test src/release-gate/__tests__/workflow-contract.test.ts
```

- [ ] **Step 11: Commit workflow integration**

```bash
git add .github/workflows packages/infra-cloudflare/scripts packages/infra-cloudflare/src/release-gate/__tests__
git commit -m "ci: add visual novel release authorization gate"
```

---
