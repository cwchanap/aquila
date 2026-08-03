# HPA-233 Visual Novel Pre-Production Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a release-bound, machine-verifiable pre-production gate that proves one immutable Aquila visual-novel candidate through storage, public delivery, deployed-reader behavior, protected human approval, and a non-destructive production handoff.

**Architecture:** Add a focused `release-gate` module under `@aquila/infra-cloudflare`, expose it through the existing `assets` CLI, and compose existing HPA-227/HPA-230 contracts rather than defining a second manifest or publisher. Extend the stable web reader shell with non-secret resolved-release identity, add a remote-only Playwright configuration and structured browser evidence, then orchestrate `prepare` and `finalize` in one dedicated GitHub Actions workflow. The implementation remains one primary HPA-233 PR with reviewable commits matching the tasks below.

**Tech Stack:** Bun 1.3.1, TypeScript, Zod 3.24, Vitest 4, Svelte 5, Playwright, GitHub Actions, PostgreSQL 16, Cloudflare R2 via AWS SDK, existing `@aquila/stories/runtime-assets` contracts.

## Global Constraints

- Work in an isolated git worktree created at execution time with `superpowers:using-git-worktrees`.
- Implement on one HPA-233 branch and one primary implementation PR unless Linear is split first.
- Do not introduce a new workspace or a second manifest, pointer, resolver, publisher, cache policy, path layout, or release identity algorithm.
- Import runtime-asset validators, canonicalization, digests, and path helpers from `@aquila/stories/runtime-assets`.
- Use the existing `assets` binary and its established exit taxonomy: `0` success/no-op, `1` configuration, `2` input/verification/integrity, `3` storage/environment, `4` concurrency, `5` guarded operation.
- JSON mode writes exactly one schema-valid document to stdout; progress and diagnostics go to stderr.
- Ordinary and Tier 1 verification require no Cloudflare credentials or external network, but local Playwright requires PostgreSQL 16 and completed web migrations.
- Tier 1 runs `reader-visual.spec.ts` on Desktop Chromium and Mobile Chromium and `reader-lazy-loading.spec.ts` on Desktop Chromium only.
- Mobile Safari remains in the ordinary full E2E workflow.
- Release-gate preview deployments must set an explicit `PUBLIC_ASSET_PREVIEW_ID`; the same literal is passed as `--preview-id` and validated with `isPreviewId()`.
- Remote Playwright must not start or reuse the local web server and must reject localhost and non-HTTPS `BASE_URL` values.
- Resolved asset identity lives on the stable `ReaderShell` ready host and remains stable through text/visual mode and responsive leaf swaps.
- Missing web-identity attributes after visual release state becomes `ready` are fatal.
- The gate may mutate only an isolated preview pointer. It never activates or rolls back production.
- `VisualReviewRecordV1.reviewer` is descriptive only. Final authorization also requires protected GitHub Environment evidence.
- Prepare cannot emit an authorizing report. Finalize reruns every live R2/CDN/browser check.
- Finalize may reuse hermetic Tier 1 evidence only when commit, lockfile digest, toolchain, command-set version, browser matrix, and evidence digest match exactly.
- Expected manifest checksum is mandatory for authorizing preview verification, final aggregation, activation assertion, and production smoke.
- Reuse browser probe helpers from `r2-delivery.spec.ts`; do not copy CORS, decode, dimension, or pointer-revalidation implementations.
- Preserve the existing HPA-230 publisher regression workflow and rename only its displayed workflow name unless preserving history requires leaving the filename unchanged.

---

## File and Responsibility Map

### New infrastructure modules

- `packages/infra-cloudflare/src/release-gate/schemas.ts` — strict V1 Zod schemas and parse functions for scenarios, checks, evidence, manual review, workflow approval, web identity, Tier 1 evidence, public verification, and final reports.
- `packages/infra-cloudflare/src/release-gate/diagnostics.ts` — `GateStageV1`, stable diagnostic codes, safe diagnostic construction, and sanitization.
- `packages/infra-cloudflare/src/release-gate/evidence.ts` — evidence-directory confinement, canonical JSON hashing, file hashing, and evidence-reference construction.
- `packages/infra-cloudflare/src/release-gate/candidate-evidence.ts` — validate retained publisher candidate reports and derive included/omitted coverage.
- `packages/infra-cloudflare/src/release-gate/public-release-verifier.ts` — parameterized candidate/active public verification service extracted from `src/verify.ts`.
- `packages/infra-cloudflare/src/release-gate/gate-runner.ts` — bind all retained evidence and produce `VisualNovelReleaseGateReportV1`.
- `packages/infra-cloudflare/src/release-gate/activation-assertion.ts` — read-only HPA-231 authorization assertion.
- `packages/infra-cloudflare/src/release-gate/production-smoke.ts` — non-destructive active-production verification coordinator.
- `packages/infra-cloudflare/src/release-gate/report.ts` — human and JSON rendering plus report-to-exit-code mapping through existing publisher semantics.
- `packages/infra-cloudflare/src/release-gate/cli.ts` — parse `assets release-gate ...` subcommands and dispatch injected services.
- `packages/infra-cloudflare/src/release-gate/index.ts` — narrow public exports used by the package CLI and tests.

### New infrastructure tests and fixtures

- `packages/infra-cloudflare/src/release-gate/__tests__/schemas.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/evidence.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/candidate-evidence.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/public-release-verifier.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/gate-runner.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/activation-assertion.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/production-smoke.test.ts`
- `packages/infra-cloudflare/src/release-gate/__tests__/cli.test.ts`
- `packages/infra-cloudflare/src/release-gate/__fixtures__/` — small manifest, pointer, report, review, browser, workflow, and HTTP-response fixtures.

### Existing infrastructure files to modify

- `packages/infra-cloudflare/src/publisher/cli.ts` — route `assets release-gate` before publisher command parsing without changing publisher commands.
- `packages/infra-cloudflare/src/verify.ts` — retain HPA-229 compatibility behavior as a thin wrapper over the new public verifier.
- `packages/infra-cloudflare/src/publisher/report.ts` — export `parsePublisherReportV1(input)` so retained publisher JSON is validated by its owning module rather than duplicated in the gate.
- `packages/infra-cloudflare/package.json` — keep the existing `assets` script; do not add a conflicting gate binary.

### Web observability files

- `apps/web/src/lib/visual-assets/types.ts` — add resolved release identity to `VisualSnapshot`.
- `apps/web/src/lib/visual-assets/visual-state-controller.ts` — publish and clear validated identity with release state.
- `apps/web/src/lib/visual-assets/source-factory.ts` — expose validated source target through `VisualReaderRuntime` without rereading environment variables downstream.
- `apps/web/src/components/ReaderShell.svelte` — host stable `data-asset-*` attributes on `data-testid="reader-ready"`.
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts` — identity lifecycle tests.
- `apps/web/src/components/__tests__/ReaderShell.test.ts` — stable DOM attribute tests across mode and responsive swaps.

### E2E files

- `packages/e2e/tests/support/r2-browser-probe.ts` — extracted shared page-side CORS, fetch, header, decode, and dimension helpers.
- `packages/e2e/tests/r2-delivery.spec.ts` — consume the extracted helpers and preserve existing fixed smoke behavior.
- `packages/e2e/playwright.release-gate.config.ts` — remote-only Desktop/Mobile Chromium configuration with no `webServer`.
- `packages/e2e/tests/visual-novel-release-gate.spec.ts` — parameterized deployed-preview release flow.
- `packages/e2e/tests/visual-novel-production-smoke.spec.ts` — smaller deployed-production flow.
- `packages/e2e/reporters/release-gate-reporter.ts` — write structured browser evidence.
- `packages/e2e/fixtures/visual-release-gates/hpa_233_fixture.v1.json` — deterministic fixture scenario for HPA-233 tests.
- `packages/e2e/package.json` — add explicit local Tier 1 and remote gate scripts.

### Repository scripts, workflows, and docs

- `scripts/verify-visual-novel-ci.ts` — run Tier 1 commands in order, validate PostgreSQL/migrations prerequisite, and emit `Tier1EvidenceV1` when requested.
- `package.json` — add `verify:visual-novel-ci`.
- `.github/workflows/r2-publisher-preview.yml` — rename displayed workflow to `R2 Publisher Regression Gate` only.
- `.github/workflows/visual-novel-release-gate.yml` — two-phase prepare/finalize authorization workflow.
- `docs/quality/hpa-216-visual-asset-acceptance-matrix.md` — exact criterion-to-command/file ownership matrix.
- `docs/infrastructure/visual-novel-release-gate.md` — CLI, evidence, preview setup, protected environment, prepare/finalize, activation, smoke, rollback, and troubleshooting runbook.
- `.env.example` — document explicit gate preview variables and production-origin guard if not already present.

---

## Task Index and Commit Order

Each linked task is part of this implementation plan and contains exact files, interfaces, failing tests, implementation steps, validation commands, and commit boundaries. Execute in order unless a task explicitly states otherwise.

1. [Task 1: Lock V1 Schemas, Diagnostics, and the Acceptance Matrix](2026-08-02-hpa-233-visual-novel-release-gate/task-01.md)
2. [Task 2: Add Canonical Evidence Hashing and Safe Report Rendering](2026-08-02-hpa-233-visual-novel-release-gate/task-02.md)
3. [Task 3: Refactor the Public Delivery Verifier into Candidate and Active Services](2026-08-02-hpa-233-visual-novel-release-gate/task-03.md)
4. [Task 4: Validate Publisher Candidate Evidence and Build the Gate Coordinator](2026-08-02-hpa-233-visual-novel-release-gate/task-04.md)
5. [Task 5: Integrate `assets release-gate` Without Breaking Publisher Commands](2026-08-02-hpa-233-visual-novel-release-gate/task-05.md)
6. [Task 6: Expose Stable Validated Release Identity on `ReaderShell`](2026-08-02-hpa-233-visual-novel-release-gate/task-06.md)
7. [Task 7: Extract Browser Delivery Probes and Add Remote-Only Playwright Configuration](2026-08-02-hpa-233-visual-novel-release-gate/task-07.md)
8. [Task 8: Implement Structured Release-Gate and Production-Smoke Browser Flows](2026-08-02-hpa-233-visual-novel-release-gate/task-08.md)
9. [Task 9: Build Tier 1 Aggregation and Reusable Hermetic Evidence](2026-08-02-hpa-233-visual-novel-release-gate/task-09.md)
10. [Task 10: Implement Prepare/Finalize Workflow with Protected Approval](2026-08-02-hpa-233-visual-novel-release-gate/task-10.md)
11. [Task 11: Add Activation Assertion, Production Smoke, Runbook, and Final Verification](2026-08-02-hpa-233-visual-novel-release-gate/task-11.md)

## Dependency Gates

- Tasks 1–5 lock the infrastructure schemas, evidence binding, verifier, coordinator, and CLI.
- Task 6 must land before deployed-browser work because Task 8 consumes the stable reader identity.
- Task 7 must land before Task 8 so the release suite cannot accidentally use the local web server.
- Tasks 1–9 must pass before Task 10 authors the prepare/finalize workflow.
- Task 11 is the final production handoff, runbook, live preview evidence, and whole-branch verification.

## Final PR Checklist

- [ ] One implementation PR contains all eleven tasks as reviewable commits.
- [ ] No child issue or second implementation PR was created without first splitting HPA-233 in Linear.
- [ ] The original design and this plan agree on every V1 field, check ID, evidence kind, CLI name, and stage.
- [ ] Normal PR CI remains credential-free; no second duplicate all-PR aggregate workflow was added.
- [ ] Tier 1 documents and validates PostgreSQL plus migrations.
- [ ] Candidate public verification does not read `current.json`.
- [ ] Stable web identity is on `ReaderShell`, is absent before validation, is required after ready, persists through mode/layout changes, and clears on invalidation.
- [ ] Remote Playwright has no `webServer`, rejects localhost, and collects both Desktop and Mobile Chromium projects.
- [ ] Existing `r2-delivery.spec.ts` behavior is preserved through shared helpers.
- [ ] Prepare is visibly non-authorizing.
- [ ] Finalize requires protected environment approval and reruns all live checks.
- [ ] The final report contains all ten required checks and nine exact evidence kinds.
- [ ] `assert-activation-ready` is structurally unable to mutate a pointer.
- [ ] Production smoke is read-only and rejects preview/local identity.
- [ ] Production pointer is proven unchanged before and after both workflow phases.
- [ ] Gated preview evidence and measured timeout values are retained in the PR.
- [ ] HPA-231 has exact copy-paste qualification, activation, smoke, and rollback commands.

## Execution Handoff

**1. Subagent-Driven (recommended):** use `superpowers:subagent-driven-development`, dispatch a fresh subagent per linked task, and perform requirements plus code-quality review between tasks.

**2. Inline Execution:** use `superpowers:executing-plans`, execute linked tasks in order, and stop at the documented review checkpoints.
