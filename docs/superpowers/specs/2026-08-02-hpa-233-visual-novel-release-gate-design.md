# HPA-233: Aquila Visual Novel Pre-Production Release Gate Design

## Status

Draft design — third-pass clarifications incorporated; ready for final review before implementation planning.

- Linear issue: HPA-233
- Parent: HPA-216
- Blocks: HPA-231
- Repository: `cwchanap/aquila`
- Design date: 2026-08-02
- Reviewed pull request: #44
- Specification rule: this file is the single authoritative HPA-233 design. No addendum overrides its V1 schemas.
- Delivery rule: one design pull request, followed by one primary HPA-233 implementation pull request unless Linear is split first.

## Purpose

Aquila already has the runtime asset contract, visual reader, canonical reader state, story lazy loading, isolated R2 delivery, immutable publisher, and publisher regression workflow required for visual-novel releases. HPA-233 adds a thin authorization layer that composes those systems, fills public-CDN and deployed-browser gaps, binds all evidence to one immutable candidate, and produces the artifact HPA-231 must validate before production activation.

The design separates:

- **Tier 1:** deterministic local verification using checked-in fixtures, a local PostgreSQL test database, and a bounded Chromium matrix.
- **Tier 2:** a manually triggered, two-phase story-release gate that verifies one retained immutable production candidate through R2, the public CDN, browser decoding, the deployed reader, and release-bound human review.

The gate may update only an isolated preview pointer through the existing publisher. It never updates production. HPA-231 later performs production activation through the existing atomic publisher command.

## Normative decisions

1. `.github/workflows/r2-publisher-preview.yml` remains the HPA-230 publisher lifecycle regression workflow. Its display name becomes **R2 Publisher Regression Gate**.
2. HPA-233 adds a separate per-story authorization workflow because publisher regression and production authorization answer different questions.
3. HPA-233 reuses `r2-gate-capture-state.ts`, public browser probes, and pointer-proof helpers. It does not duplicate HPA-230 idempotency, controlled-revision, stale-conflict, or rollback scenarios.
4. This document contains the canonical in-repository HPA-216 acceptance snapshot.
5. Tier 1 runs visual-reader coverage on Desktop Chromium and Mobile Chromium; lazy-loading remains Desktop Chromium only; Mobile Safari remains ordinary E2E ownership.
6. Tier 1 is Cloudflare-credential-free and external-network-free, but not service-free: PostgreSQL and completed migrations are required before local Playwright.
7. `PublicReleaseVerificationResultV1.releaseId` and `manifestSha256` are required in candidate and active modes.
8. One parsed expected manifest checksum is passed unchanged to every boundary, which independently compares its observation to that value.
9. The release-gate preview uses an explicit `PUBLIC_ASSET_PREVIEW_ID`; the exact same literal is supplied as `--preview-id`. Both sides validate it with `isPreviewId()`.
10. Resolved asset identity is exposed on the stable `ReaderShell` ready host, not the visual-only leaf.
11. Browser checks wait for visual release state `ready`, then require every target-appropriate identity attribute. Absence is fatal.
12. Remote qualification and production smoke use a dedicated Playwright config with no local `webServer`.
13. Manual-review JSON is release-bound evidence, not a signature. Final authorization also requires protected workflow/environment control.
14. `r2-delivery.spec.ts` remains the HPA-229 seeded infrastructure smoke. HPA-233 reuses its CORS/decode/revalidation helpers rather than copying them.
15. `release-gate` is implemented under the existing `assets` binary and reuses its established `0`–`5` exit taxonomy.
16. Finalize reruns live R2/CDN/browser checks. It may reuse prepare-phase hermetic Tier 1 evidence only when all identity and digest fields match.

## Ownership boundaries

### `@aquila/stories/runtime-assets`

Remains authoritative for runtime manifest, active pointer, release-plan schemas, canonical JSON, release identity, path helpers, qualified logical identities, pointer/manifest pairing, and cache/dimension policies. HPA-233 must import those APIs and must not hand-build paths or duplicate schemas.

### `@aquila/infra-cloudflare`

Owns publisher planning, deterministic encoding, immutable publication, deep R2 candidate verification, preview mirroring, conditional activation, concurrency protection, release history, rollback, public-delivery primitives, R2 configuration, and structured publisher reports.

HPA-233 adds parameterized public verification, evidence schemas, orchestration, activation-readiness assertion, production smoke, and CLI integration inside this package.

### `apps/web`

Owns asset-source resolution, reader state, visual/text behavior, bookmarks, choices, responsive swaps, fallback, caching, prefetch, and lazy story loading.

HPA-233 owns only the minimal non-secret observability addition required to prove which validated asset release the deployed reader uses.

### `packages/e2e`

Owns browser flows. HPA-233 adds a parameterized release-gate suite, a remote-only config, structured evidence, and shared browser-delivery helpers.

## Architecture

Use a focused release-gate module inside `packages/infra-cloudflare`:

```text
packages/infra-cloudflare/src/release-gate/
  schemas.ts
  diagnostics.ts
  candidate-evidence.ts
  public-release-verifier.ts
  gate-runner.ts
  activation-assertion.ts
  production-smoke.ts
  report.ts
  cli.ts

packages/infra-cloudflare/src/release-gate/__tests__/
packages/infra-cloudflare/src/release-gate/__fixtures__/
packages/e2e/tests/visual-novel-release-gate.spec.ts
packages/e2e/tests/visual-novel-production-smoke.spec.ts
packages/e2e/fixtures/visual-release-gates/
packages/e2e/playwright.release-gate.config.ts
```

`packages/infra-cloudflare/src/verify.ts` becomes a compatibility wrapper over the parameterized public verifier so the existing HPA-229 smoke command remains valid.

A separate workspace is not justified because the gate primarily composes existing infrastructure services. A workflow-only shell gate is rejected because it would be difficult to test, version, and consume safely.

## Tier 1: deterministic visual-novel CI

Expose:

```bash
bun run verify:visual-novel-ci
```

### Prerequisite

Before Playwright runs:

- PostgreSQL 16 is healthy;
- `DATABASE_URL` targets the test database;
- `bun run drizzle:migrate` completes in `apps/web`.

The local command either provisions the service or clearly documents this prerequisite.

### Commands

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun --filter e2e test:e2e \
  tests/reader-visual.spec.ts \
  --project=chromium \
  --project=mobile-chrome
bun --filter e2e test:e2e \
  tests/reader-lazy-loading.spec.ts \
  --project=chromium
```

Properties:

- checked-in small asset/story fixtures only;
- no R2 credentials or external network;
- no production artwork;
- no pointer mutation;
- aggregate command used locally and by the release workflow, not added as a duplicate ordinary PR job;
- ordinary `.github/workflows/e2e-tests.yml` continues to own full browser CI, PostgreSQL setup/migrations, and Mobile Safari.

Prepare emits `Tier1EvidenceV1` containing candidate commit SHA, lockfile SHA-256, Bun/Node/Playwright versions, command-set schema version, browser matrix, status, and artifact digest. Finalize may reuse it only when every identity field matches; otherwise Tier 1 reruns.

## Tier 2 CLI

Use the existing package script and binary:

```bash
bun --filter @aquila/infra-cloudflare assets release-gate verify-preview \
  --story <story-id> \
  --preview-id <preview-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --asset-base-url <asset-domain> \
  --web-base-url <deployed-preview-url> \
  --publisher-report <candidate-report.json> \
  --browser-evidence <playwright-result.json> \
  --web-identity-evidence <web-identity.json> \
  --manual-review <review-record.json> \
  --workflow-approval <workflow-approval.json> \
  --commit-sha <candidate-commit> \
  --evidence-dir <directory> \
  --json
```

The gate command aggregates and validates evidence. Mirroring and preview activation remain explicit workflow steps through existing publisher commands.

For authorization, `PUBLIC_ASSET_PREVIEW_ID` must be set explicitly on the Vercel preview build. Branch-derived IDs remain valid for ordinary previews but are not accepted as release-gate authority. The same literal is passed as `--preview-id`.

Preview runs reject a web base URL equal to the configured production web origin. Production smoke requires the configured production origin.

## Public release verification

```ts
interface PublicReleaseVerificationInputV1 {
    storyId: string;
    target: PublicationTarget;
    assetBaseUrl: URL;
    browserOrigin: URL;
    mode: 'candidate' | 'active';
    releaseId?: string;
    expectedManifestSha256?: ManifestByteSha256;
    omittedIdentities: string[];
}
```

Rules:

- candidate mode requires `releaseId`;
- active mode rejects a caller-supplied release override and resolves it from `current.json`;
- `expectedManifestSha256` is optional only for compatibility use of the generic verifier;
- it is mandatory for authorization, final aggregation, activation assertion, and production smoke;
- base/origin URLs are HTTPS and credential-free;
- omitted identities are validated qualified identities.

Candidate mode fetches the immutable manifest directly without requiring `current.json`. Active mode fetches and validates the pointer, derives the immutable manifest path, verifies pointer checksum, and validates the pointer/manifest pair.

Both modes verify schema, canonical release identity, forbidden public fields, content-addressed paths, object existence, byte length, SHA-256, media type, immutable caching, decoded dimensions, browser decode, omission absence, and complete coverage.

```ts
interface PublicReleaseVerificationResultV1 {
    schemaVersion: 1;
    status: 'passed' | 'failed';
    mode: 'candidate' | 'active';
    storyId: string;
    target: PublicationTarget;
    releaseId: string;
    manifestSha256: string;
    checks: PublicVerificationCheckV1[];
    diagnostics: GateDiagnosticV1[];
}
```

Candidate mode returns the validated supplied release and observed manifest digest. Active mode derives both required fields from validated public documents.

## Browser scenario

```ts
interface VisualNovelGatePositionV1 {
    sceneId: string;
    dialogueIndex: number;
}

interface VisualNovelGateScenarioV1 {
    schemaVersion: 1;
    storyId: string;
    locale: string;
    directOpen: VisualNovelGatePositionV1;
    transition: {
        from: VisualNovelGatePositionV1;
        to: VisualNovelGatePositionV1;
        backgroundChanges: boolean;
        portraitChanges: boolean;
    };
    bookmark: VisualNovelGatePositionV1;
    omittedFallback: VisualNovelGatePositionV1 & { identity: string };
    choice: VisualNovelGatePositionV1 & {
        choiceIndex: number;
        expectedSceneId: string;
    };
    unrelatedStoryIds: string[];
}
```

The scenario is strictly validated, canonicalized, and SHA-256 hashed. HPA-233 owns the schema; HPA-231 owns final The Seventh Mirror values.

## Manual review and workflow trust

```ts
interface VisualReviewRecordV1 {
    schemaVersion: 1;
    storyId: string;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    scenarioSha256: string;
    reviewedAt: string;
    reviewer: string;
    decision: 'approved' | 'rejected';
    includedCount: number;
    omittedCount: number;
    representativeRoutes: string[];
    notes: string[];
}
```

The record is release-bound review content, not authentication. The free-text reviewer is descriptive.

Finalize runs in protected environment `visual-novel-release-approval` with required reviewer approval. The job records only information available to normal Actions context:

```ts
interface WorkflowApprovalEvidenceV1 {
    schemaVersion: 1;
    repository: string;
    workflowRef: string;
    runId: number;
    runAttempt: number;
    jobId: string;
    actor: string;
    environment: 'visual-novel-release-approval';
    conclusion: 'success';
}
```

The human approver identity remains recoverable from GitHub's deployment/run audit trail. V1 does not require a deployments API call. An optional authenticated enrichment may add it later without changing authorization semantics.

If protected environments are unavailable, the runbook documents the weaker maintainer-only control and never calls the JSON record signed or authenticated.

## Diagnostics

```ts
type GateStageV1 =
    | 'input'
    | 'ci'
    | 'publisher-candidate'
    | 'r2-candidate'
    | 'pointer'
    | 'manifest'
    | 'coverage'
    | 'public-object'
    | 'browser-decode'
    | 'web-identity'
    | 'reader-flow'
    | 'manual-review'
    | 'evidence-binding'
    | 'production-pointer-proof'
    | 'post-activation-smoke';

interface GateDiagnosticV1 {
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
```

`web-identity` is used for deployed-reader identity failures. `evidence-binding` is reserved for mismatches between retained artifacts.

## Final report schemas

```ts
interface VisualNovelReleaseGateReportV1 {
    schemaVersion: 1;
    status: 'passed' | 'failed';
    storyId: string;
    target: PublicationTarget;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    commitSha: string;
    scenarioSha256: string;
    manualReviewSha256: string;
    createdAt: string;
    checks: {
        deterministicCi: GateCheckV1;
        publisherCandidate: GateCheckV1;
        r2Candidate: GateCheckV1;
        publicCandidate: GateCheckV1;
        publicActiveRelease: GateCheckV1;
        webIdentity: GateCheckV1;
        browserFlows: GateCheckV1;
        manualReview: GateCheckV1;
        workflowApproval: GateCheckV1;
        productionPointerUnchanged: GateCheckV1;
    };
    evidence: GateEvidenceReferenceV1[];
    diagnostics: GateDiagnosticV1[];
}

interface GateCheckV1 {
    status: 'passed' | 'failed' | 'not-run';
    evidenceIds: string[];
}

interface GateEvidenceReferenceV1 {
    id: string;
    kind:
        | 'ci-result'
        | 'publisher-report'
        | 'r2-verification'
        | 'public-verification'
        | 'web-identity'
        | 'playwright-result'
        | 'manual-review'
        | 'workflow-approval'
        | 'pointer-snapshot';
    path: string;
    sha256: string;
    mediaType: string;
}

interface WebIdentityEvidenceV1 {
    schemaVersion: 1;
    target: 'preview' | 'production';
    webBaseUrl: string;
    assetEnvironment: 'preview' | 'production';
    previewId?: string;
    releaseId: string;
    manifestSha256: string;
    pointerRequestUrl: string;
    manifestRequestUrl: string;
}
```

All V1 schemas reject unknown fields. The final result passes only when every required check passes and all evidence agrees on story, preview namespace, release, manifest checksum, commit, scenario digest, review digest, web identity, and workflow authorization.

## Output and exit behavior

The release-gate subcommands reuse the existing `assets` binary taxonomy:

- `0`: success or no-op;
- `1`: configuration error;
- `2`: input, evidence-schema, coverage, verification, or integrity failure;
- `3`: storage, environment, or prerequisite unavailable;
- `4`: delegated publisher concurrency conflict;
- `5`: guarded activation-target or operation failure.

This is not a widening from a `0/1` binary: the existing publisher already uses `0`–`5`. Existing meanings remain unchanged. Workflows treat any non-zero as failure unless explicitly testing a documented code such as conflict `4`.

JSON mode writes exactly one report to stdout. Progress and diagnostics go to stderr.

## Stable deployed-reader identity

Identity attributes live on the stable `ReaderShell` element with `data-testid="reader-ready"`, because `VisualNovelReader` unmounts during text-mode switches and may remount at responsive breakpoints.

When the visual runtime validates a release, `reader-ready` exposes:

```text
data-asset-environment="local|preview|production"
data-asset-preview-id="<preview-id>"        # preview only
data-asset-release-id="<release-id>"
data-asset-manifest-sha256="<sha256>"
```

No separate deployment-environment attribute is introduced. The authoritative question is which validated `AssetResolverSource` and pointer/manifest identity the reader uses.

Identity persists across visual/text mode and responsive leaf swaps, and clears when runtime/story identity changes or becomes invalid.

### Settled assertion

1. Enter visual mode.
2. Wait for `data-visual-release-state="ready"` on the visual reader.
3. Require all target-appropriate identity attributes on `reader-ready`.
4. Compare all values with gate inputs.
5. Treat missing attributes, local fallback, wrong environment, wrong preview ID, wrong release/checksum, or local fixture requests as fatal `web-identity` failures.
6. Switch text/visual and resize; require stable identity to remain unchanged, then reassert visual readiness.

Network-observed pointer and manifest paths are retained as defense in depth.

## Remote Playwright

`packages/e2e/playwright.release-gate.config.ts`:

- has no `webServer` and never starts `bun run dev`;
- requires HTTPS `BASE_URL`;
- rejects localhost/local fixture origin;
- accepts `RELEASE_GATE_TARGET=preview|production`;
- rejects the configured production origin for preview runs and requires it for production smoke;
- defines Desktop Chromium and Mobile Chromium only;
- explicitly matches release-gate and production-smoke specs;
- emits structured evidence plus traces/screenshots.

The test process does not set `PUBLIC_ASSET_*`; it verifies values baked into the deployed application.

Required environment:

- `RELEASE_GATE_TARGET`
- `RELEASE_GATE_STORY_ID`
- `RELEASE_GATE_PREVIEW_ID` for preview
- `RELEASE_GATE_RELEASE_ID`
- `RELEASE_GATE_MANIFEST_SHA256`
- `RELEASE_GATE_SCENARIO`
- `AQUILA_PRODUCTION_WEB_ORIGIN`
- `BASE_URL`

Required browser flow:

1. Open the configured locale's non-zero direct route in visual mode.
2. Wait for ready and require complete stable web identity.
3. Assert pointer/manifest requests use expected paths.
4. Exercise background and portrait transition.
5. Switch visual/text and preserve exact line and identity.
6. Resize desktop/mobile and preserve exact line and identity.
7. Open/close history with focus restoration.
8. Restore bookmark.
9. Exercise intentional omission/unavailable fallback.
10. Select deterministic choice.
11. Reload, prove unrelated story chunks were not requested, and preserve locale in the canonical URL.

HPA-233 does not add a locale-switch interaction; HPA-234 and ordinary E2E retain cross-locale ownership.

### Existing browser smoke prior art

`packages/e2e/tests/r2-delivery.spec.ts` remains the fixed HPA-229 seeded smoke for `the_seventh_mirror/smoke`. HPA-233 extracts/reuses its page CORS fetch, browser decode, dimension, and pointer-revalidation helpers. The fixed smoke and real-candidate gate are defense in depth at different boundaries; helper logic must not be copied.

## Preview workflow

Add `.github/workflows/visual-novel-release-gate.yml` with phase `prepare|finalize`, candidate commit, story, explicit preview ID, release ID, checksum, publisher-report reference, deployed preview URL, scenario, prepare evidence reference, and finalize review record.

Both phases have PostgreSQL 16, `DATABASE_URL`, pinned dependencies/browsers, and completed web migrations before local Tier 1 Playwright.

### Prepare

1. Checkout candidate.
2. Provision/check PostgreSQL, install dependencies/browsers, run migrations.
3. Run Tier 1 and emit canonical hermetic evidence.
4. Validate retained publisher evidence.
5. Capture production pointer.
6. Deep-verify production candidate through R2.
7. Publicly verify candidate mode.
8. Mirror/activate only explicit preview namespace.
9. Publicly verify active preview mode.
10. Run remote web-identity preflight.
11. Run Desktop/Mobile Chromium release flows.
12. Capture production pointer and prove unchanged.
13. Upload non-authorizing review evidence.

### Finalize

1. Checkout same candidate and enter protected environment.
2. Validate prepare evidence.
3. Reuse Tier 1 only when commit, lockfile, toolchain, command-set, and browser matrix match; otherwise rerun PostgreSQL/migrations/Tier 1.
4. Rerun all live R2 deep, public candidate, idempotent preview mirror/activation, public active, web identity, and browser checks.
5. Validate manual review.
6. Prove production pointer unchanged.
7. Emit workflow approval evidence and final report.

Prepare cannot authorize production. Finalize cannot reuse live evidence from prepare.

Separate prepare/finalize timeouts are based on measured successful stage durations plus 50%, capped at 60 minutes. Per-stage timing is retained.

## Production handoff

```bash
bun --filter @aquila/infra-cloudflare assets release-gate assert-activation-ready \
  --report <gate-report.json> \
  --story <story-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --commit-sha <candidate-commit>
```

The command verifies report schema/status, exact identity, every required check, evidence digests, manual review, workflow approval, web identity, and production-pointer proof. It never activates.

HPA-231 then uses the existing publisher atomic activation command.

## Production smoke

```bash
bun --filter @aquila/infra-cloudflare assets release-gate smoke-production \
  --story <story-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --asset-base-url <production-assets> \
  --web-base-url <production-web> \
  --json
```

Checks production pointer and manifest integrity, representative decode, stable production web identity with no preview ID, reader opening/progression, pointer revalidation, and no mutation.

## Failure ownership

Reuse HPA-230 tests for idempotency, failed-candidate atomicity, conditional activation, conflict protection, and verified rollback.

HPA-233 adds tests for active/candidate public verification, invalid public documents, wrong checksum/headers/CORS/dimensions, missing/corrupt objects, forbidden fields, incomplete coverage, omitted identities present, browser/scenario mismatch, missing settled identity, identity changes across mode/layout swaps, wrong/derived preview ID, remote local-server fallback, manual-review mismatch/rejection, missing/tampered evidence, workflow-approval tampering, Tier 1 reuse identity mismatch, production-pointer mismatch, and production-smoke expected-release mismatch.

## HPA-216 acceptance snapshot

| ID | Acceptance criterion | Primary owner | HPA-233/HPA-231 evidence |
|---|---|---|---|
| AC-01 | Seventh Mirror opens and progresses in visual mode on desktop/mobile. | HPA-228 | Deployed preview flow; production smoke. |
| AC-02 | Text/visual modes preserve exact active line. | HPA-234/HPA-228 | Non-zero deployed mode swap. |
| AC-03 | Logical visual keys resolve through validated prompt-free manifest. | HPA-227/HPA-230 | Candidate and active public verification. |
| AC-04 | One portrait uses deterministic left/center/right placement. | HPA-227/HPA-228 | Representative deployed assertion. |
| AC-05 | Transitions do not flash/reset and respect reduced motion. | HPA-228 | Deployed transition; ordinary reduced-motion E2E. |
| AC-06 | Choices, bookmarks, direct URLs, locale routing, navigation, responsive swaps work. | HPA-234/HPA-228 | Deployed direct URL/bookmark/choice/layout and locale preservation; locale switching remains ordinary E2E. |
| AC-07 | Missing/invalid/slow assets fall back without blocking. | HPA-228 | Intentional omission/unavailable preview case. |
| AC-08 | Image changes publish without Vercel rebuild when keys unchanged. | HPA-230 | HPA-231 controlled migration evidence. |
| AC-09 | Publication is atomic and rollback works. | HPA-230 | Regression gate and HPA-231 record. |
| AC-10 | Objects/manifests use immutable paths/cache headers. | HPA-227/229/230 | Public candidate/active verification. |
| AC-11 | Mutable pointer has revalidation policy. | HPA-227/HPA-229 | Active verification and production smoke. |
| AC-12 | Public manifest/CDN metadata expose no prompts. | HPA-227/229/230 | Forbidden-field public check. |
| AC-13 | Production visuals leave Vercel bundle/Git canonical ownership. | HPA-231 | Migration cleanup evidence. |
| AC-14 | Opening one story does not eagerly load all stories. | HPA-232 | Deployed network assertion. |
| AC-15 | Bundle measurements prove independent loading. | HPA-232 | Existing measurement evidence. |
| AC-16 | Unit tests cover schemas, URLs, CJK paths, cache/fallback, state. | HPA-227/228/234 | Tier 1 and ownership matrix. |
| AC-17 | Playwright covers desktop/mobile, transition, mode switch, missing asset, choice. | HPA-228 | Deployed Desktop/Mobile Chromium flow. |
| AC-18 | Publisher verifies metadata/decode before pointer change. | HPA-230 | Regression gate and retained report. |
| AC-19 | Publishing and rollback are documented. | HPA-229/HPA-230 | HPA-233 handoff and HPA-231 runbook. |

Implementation expands this table with exact commands and file paths. Duplicate checks are documented only as defense in depth across distinct boundaries.

## Implementation slices

### Slice 1 — Schemas and ownership matrix

Define all strict V1 schemas above, exact union literals, shared diagnostics, Tier 1 evidence, and the command/path ownership matrix.

### Slice 2 — Reusable public verifier

Extract parameterized public verification, add candidate mode, preserve the existing smoke wrapper, require result identity, reuse browser-delivery helpers, and add safe structured output.

### Slice 3 — Gate coordinator

Validate/hash/bind evidence, produce reports, implement activation assertion, reuse existing exit taxonomy, and prove no pointer mutation APIs are reachable.

### Slice 4 — Stable web observability and Playwright

Flow validated identity to stable `ReaderShell`, preserve/clear it correctly, add settled identity assertions, add remote config and explicit project membership, reuse `r2-delivery` helpers, emit web/browser evidence, and preserve locale.

### Slice 5 — Workflow integration

Add documented Tier 1 database prerequisite, rename regression display name, add prepare/finalize workflow, enforce explicit preview ID, protected finalization, exact approval evidence, digest-bound Tier 1 reuse, live-check reruns, measured timeouts, and retained artifacts.

### Slice 6 — Handoff and runbook

Add production smoke, qualification/activation/rollback runbook, troubleshooting by stable stage/code, workflow ownership, database setup, and evidence-retention guidance.

## Acceptance

Implementation is complete only when:

- the single canonical schema compiles with exact checks and evidence kinds;
- Tier 1 documents and satisfies PostgreSQL/migration prerequisites without Cloudflare credentials/external network;
- explicit preview ID is identical and validated on web build and gate sides;
- browser waits for ready, then fails on missing or mismatched stable identity;
- identity survives reader-mode and responsive leaf swaps;
- remote Playwright cannot start/use local fixtures;
- release-gate runs Desktop/Mobile Chromium and lazy-loading scope matches the command;
- public candidate and active boundaries both verify the exact checksum;
- existing seeded `r2-delivery` smoke and real-candidate gate reuse helpers with documented defense-in-depth roles;
- review is release-bound while authorization comes from protected workflow controls;
- final report binds CI, publisher, R2, public, web, browser, review, approval, and pointer evidence;
- finalize may reuse only exact hermetic Tier 1 evidence and reruns every live check;
- production activation remains separate and smoke remains non-destructive;
- failures identify a stable stage and safe context.
