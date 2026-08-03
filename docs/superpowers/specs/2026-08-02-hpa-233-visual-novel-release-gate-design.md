# HPA-233: Aquila Visual Novel Pre-Production Release Gate Design

## Status

Approved for implementation planning after design-review amendments.

- Linear issue: HPA-233
- Parent: HPA-216
- Blocks: HPA-231
- Repository: `cwchanap/aquila`
- Design date: 2026-08-02
- Reviewed pull request: #44
- Delivery rule: one design pull request, followed by one primary HPA-233 implementation pull request unless the Linear issue is split first.

## Summary

Aquila already has the runtime asset contract, visual reader, reader-session state, story lazy loading, isolated R2 delivery, immutable publisher, and publisher regression workflow required for visual-novel releases. HPA-233 must not replace those systems. It adds a thin release-gate layer that composes their existing verification, fills the remaining public-delivery and deployed-browser gaps, binds all evidence to one immutable candidate release, and produces the authorization artifact HPA-231 must present before production activation.

The design separates ordinary credential-free CI from a manually triggered preview-release authorization gate:

- **Tier 1** runs against checked-in small fixtures and a bounded Chromium matrix.
- **Tier 2** verifies one retained immutable production candidate through the R2 API, public CDN, browser decoder, deployed reader, and release-bound human review.
- The gate may update only an isolated preview pointer through the existing publisher.
- The gate never updates the production pointer.
- HPA-231 performs production activation later through the existing atomic publisher command.

## Design-review decisions

The following review conclusions are normative:

1. `.github/workflows/r2-publisher-preview.yml` remains the HPA-230 publisher regression workflow. HPA-233 adds a separate story-release authorization workflow because the two workflows answer different questions.
2. The HPA-230 workflow is renamed in the GitHub Actions UI to **R2 Publisher Regression Gate** during implementation to prevent confusion with the HPA-233 release gate. Renaming the file to `r2-publisher-regression.yml` is optional if preserving workflow history is more valuable.
3. The HPA-233 workflow reuses `r2-gate-capture-state.ts` and shared pointer-proof helpers. It does not recreate HPA-230's controlled-revision, stale-conflict, idempotency, or rollback regression sequence.
4. The HPA-216 acceptance criteria are transcribed into this document. The checked-in ownership matrix becomes the canonical in-repository snapshot for implementation and review.
5. Tier 1 explicitly runs only Desktop Chromium and Mobile Chromium for the targeted visual-reader suite. Mobile Safari remains in the ordinary full E2E workflow.
6. `PublicReleaseVerificationResultV1.releaseId` and `manifestSha256` remain required. Active mode derives them from the validated pointer and fetched manifest.
7. `verify-preview` and `smoke-production` share one diagnostic stage and error-code vocabulary.
8. `--expect-manifest-sha256` is parsed once into one canonical expected checksum value and passed unchanged to every verification boundary. Each verifier independently compares observed bytes with that same value; there is no second expected-checksum source.

## Goals

1. Map every HPA-216 acceptance criterion to an existing owned test, an HPA-233 integration check, HPA-231 migration evidence, or an explicitly justified human review.
2. Expose one deterministic visual-novel CI command that requires no Cloudflare access and no production-sized artwork.
3. Expose one parameterized preview-release verification flow that validates an immutable candidate before production pointer activation.
4. Exercise the real public asset domain and deployed reader together on desktop and mobile Chromium layouts.
5. Bind automated and human evidence to the exact story, release ID, manifest checksum, candidate commit, preview namespace, and browser scenario.
6. Produce a stable machine-readable release-gate result that HPA-231 validates before calling the existing atomic production activation path.
7. Provide a smaller non-destructive production smoke command for use after activation.
8. Reuse existing publisher regression coverage rather than creating a second publisher test framework.

## Non-goals

- Performing The Seventh Mirror production migration.
- Reimplementing runtime manifest, pointer, resolver, publisher, activation, or rollback logic.
- Creating a second fixture framework or a second representation of release coverage.
- Re-running HPA-230's complete publisher regression scenario inside every story-release gate.
- Pixel-perfect approval of every production illustration.
- Generating or evaluating AI artwork.
- Packaging complete offline, PWA, or Tauri asset sets.
- Giving the release gate permission to mutate the production pointer.
- Running destructive failure experiments against an active production story.
- General load or performance testing of unrelated Aquila pages.

## Existing ownership and constraints

The design preserves the boundaries established by HPA-227 through HPA-234.

### `@aquila/stories/runtime-assets`

Owns:

- Runtime manifest, active pointer, and release-plan schemas.
- Canonical JSON and release identity.
- Publication-layout path helpers.
- Safe logical keys, type-qualified identities, and path validation.
- Pointer/manifest pairing.
- Cache and dimension policies.

HPA-233 calls these public APIs rather than parsing documents or constructing paths independently.

### `@aquila/infra-cloudflare`

Owns:

- Release planning and coverage classification.
- Deterministic image encoding and content addressing.
- Immutable candidate publication.
- Deep R2 candidate verification.
- Preview mirroring.
- Conditional activation, conflict detection, release history, and rollback.
- Public-delivery verification primitives.
- Scoped R2 configuration and credential handling.
- Structured publisher reports.

HPA-233 adds orchestration, parameterization, and evidence binding inside this package. It does not fork publisher behavior.

### `apps/web`

Owns:

- Asset-source environment resolution.
- Canonical reader-session state.
- Visual and text reader behavior.
- Browser restoration, bookmarks, choices, responsive reader state, fallback, caching, and prefetch.
- Story lazy loading.

HPA-233 asserts these contracts through the deployed reader. It does not move them into infrastructure code.

### `packages/e2e`

Owns browser flows. HPA-233 adds one environment-driven release suite for combinations that existing local suites do not prove together.

### Existing HPA-230 publisher regression workflow

`.github/workflows/r2-publisher-preview.yml` currently proves the publisher itself with controlled fixtures:

- production candidate publication with `--no-activate`;
- unchanged-release no-op behavior;
- production-to-preview mirroring;
- conditional preview activation;
- deep verification;
- controlled revision;
- deterministic stale-pointer conflict;
- pointer-only rollback;
- public HPA-229 smoke verification;
- production-pointer-unchanged evidence.

It also already uses:

```text
packages/infra-cloudflare/src/publisher/r2-gate-capture-state.ts
packages/infra-cloudflare/src/publisher/r2-gate-fixtures.ts
packages/infra-cloudflare/scripts/r2-stale-conflict-coordinator.ts
```

This workflow remains the regression owner for publisher lifecycle semantics. The HPA-233 story-release workflow reuses its stable helpers but does not duplicate its complete fixture sequence.

## Architecture decision

### Chosen approach: thin release-gate orchestrator

The gate is a focused module and CLI within `packages/infra-cloudflare`, supported by an environment-driven Playwright suite in `packages/e2e` and a dedicated GitHub Actions workflow.

A new workspace is not justified initially. The gate's domain logic is primarily evidence validation and orchestration over existing package APIs. A separate `packages/release-gate` workspace may be introduced later only if this layer gains substantial reusable logic that cannot remain cohesive within `infra-cloudflare`.

Proposed structure:

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
packages/e2e/fixtures/visual-release-gates/
```

The current `packages/infra-cloudflare/src/verify.ts` becomes a compatibility wrapper over the parameterized public verifier. The existing HPA-229 smoke command and tests continue to work.

### Rejected alternatives

#### New release-gate workspace immediately

This creates package plumbing before there is an independent deployment or domain boundary. Most code would wrap `infra-cloudflare` and Playwright, increasing indirection without improving ownership.

#### Workflow-only shell gate

A shell-only implementation is difficult to unit-test, reuse locally, version as a schema, or consume safely from HPA-231. The workflow calls a tested gate module; it does not define release semantics itself.

#### Fold HPA-233 into the existing publisher regression workflow

The existing workflow answers, "Does the publisher lifecycle still work against controlled fixtures?" HPA-233 answers, "May this exact real story release be activated in production?" Folding the two together would make every story authorization rerun stale-conflict and rollback regressions, while making publisher regression depend on a Vercel preview and human approval.

#### Extend the publisher report into the final gate result

Publisher verification is necessary but not sufficient. It cannot represent deployed-browser behavior or human review. Mutating the publisher report schema to include unrelated evidence would blur ownership.

## Evidence tiers

### Tier 1: deterministic visual-novel CI

Expose a credential-free repository command:

```bash
bun run verify:visual-novel-ci
```

The command composes:

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun --filter e2e test:e2e \
  tests/reader-visual.spec.ts \
  tests/reader-lazy-loading.spec.ts \
  --project=chromium \
  --project=mobile-chrome
```

The exact implementation may use a Bun script or Turbo tasks, but it must preserve visible package ownership and failure attribution.

Properties:

- Uses only checked-in small fixtures.
- Does not require R2 credentials or network access.
- Does not require production artwork.
- Does not write a preview or production pointer.
- Runs in normal pull-request CI.
- Includes Desktop Chromium and Mobile Chromium only for the bounded targeted suite.
- Does not replace the ordinary E2E workflow.

The existing `.github/workflows/e2e-tests.yml` continues to run the repository's full configured browser matrix, including Mobile Safari for `reader-visual.spec.ts`. Tier 1 is a focused release-readiness command, not the complete regression suite.

The final gate report identifies the exact candidate commit whose deterministic CI passed.

### Tier 2: preview release gate

Expose one parameterized gate command, provisionally:

```bash
bun --filter @aquila/infra-cloudflare release-gate verify-preview \
  --story <story-id> \
  --preview-id <preview-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --asset-base-url <asset-domain> \
  --web-base-url <deployed-preview-url> \
  --publisher-report <candidate-report.json> \
  --browser-evidence <playwright-result.json> \
  --manual-review <review-record.json> \
  --commit-sha <candidate-commit> \
  --evidence-dir <directory> \
  --json
```

The command is an evidence aggregator and validator. It does not mirror or activate a release. Those operations remain explicit workflow steps through the existing publisher CLI.

The gate parses `--expect-manifest-sha256` once with the HPA-227 SHA-256 validator. The resulting canonical lowercase value is passed unchanged to:

- the R2 deep-verification command;
- production-to-preview mirror verification;
- preview activation;
- public candidate verification;
- public active-release verification;
- browser evidence validation;
- manual-review validation;
- final activation-readiness assertion.

Each boundary independently computes or reads its observed manifest checksum and compares it with this one expected value.

## Public-delivery verifier

The current R2 delivery verifier is specialized to one story and preview ID and always reads `current.json`. Refactor it into a reusable service while preserving a compatibility wrapper for the existing smoke command.

### Input

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

Validation rules:

- Candidate mode requires `releaseId`.
- Active mode rejects a caller-supplied release override; it resolves the release from `current.json`.
- `expectedManifestSha256`, when present, is the canonical value parsed by the gate coordinator.
- `assetBaseUrl` and `browserOrigin` are HTTPS and credential-free.
- Omitted identities are validated type-qualified logical identities.

### Active-release mode

1. Fetch the target's `current.json`.
2. Validate pointer schema and publication path.
3. Derive the release ID and expected manifest path from the validated pointer.
4. Fetch the immutable manifest.
5. Verify manifest bytes against `pointer.manifestSha256`.
6. When a gate-level expected checksum is supplied, require it to equal the pointer checksum.
7. Validate the pointer/manifest pair and canonical release identity.
8. Verify all included objects and public-delivery behavior.

### Immutable-candidate mode

1. Derive the immutable manifest path with `getReleaseManifestPath()`.
2. Fetch and validate the manifest without reading or requiring `current.json`.
3. Verify the supplied expected checksum.
4. Validate story ID, release ID, canonical release identity, and all included objects.

Candidate mode is required so a production candidate can be checked through the public custom domain before any active pointer update.

### Required checks

- HTTPS asset base without credentials.
- JSON content types for pointer and manifest.
- Pointer revalidation directives and edge-cache bypass in active mode.
- Immutable manifest cache headers and edge-cache eligibility.
- CORS readable from the deployed web origin.
- Runtime schema validity.
- Exact manifest checksum and canonical release identity.
- No forbidden prompt, source-path, or generation-metadata fields.
- Every manifest variant path matches its digest and format.
- Every unique included object exists.
- Body byte length and SHA-256 match the manifest.
- Correct `image/webp` or `image/avif` media type.
- Correct immutable cache behavior.
- Decoded dimensions match the manifest.
- Browser decode succeeds for every required variant.
- Manifest contains no identity classified as omitted in the candidate report.
- Coverage has no unclassified or missing included keys.

The existing R2 API deep verifier remains authoritative for storage-level verification. The public verifier proves the independently valuable custom-domain, CDN, CORS, and browser-facing properties.

### Public verification result

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

`releaseId` and `manifestSha256` are required in both modes:

- candidate mode returns the validated supplied release and observed manifest digest;
- active mode derives the release from the validated pointer and derives the manifest digest from the fetched bytes before constructing the result.

A compatibility CLI renders the existing human-readable PASS/FAIL format from this structured result.

## Release-gate schemas

Schemas use Zod and the repository's existing contract validators. V1 evidence schemas reject unknown fields unless a deliberate extension point is documented.

### Browser scenario descriptor

A generic gate cannot infer which dialogue changes a background, which route contains an intentional omission, or which choice reaches a representative branch. Those facts are explicit data:

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
    omittedFallback: VisualNovelGatePositionV1 & {
        identity: string;
    };
    choice: VisualNovelGatePositionV1 & {
        choiceIndex: number;
        expectedSceneId: string;
    };
    unrelatedStoryIds: string[];
}
```

Rules:

- `identity` is a valid type-qualified asset identity.
- Dialogue indexes are non-negative safe integers matching the reader URL contract.
- The transition target is reachable through normal advancement.
- `unrelatedStoryIds` contains at least one registered story distinct from `storyId`.
- The descriptor is canonicalized and SHA-256 hashed.
- Browser evidence records the scenario digest.

Repository location:

```text
packages/e2e/fixtures/visual-release-gates/<storyId>.v1.json
```

HPA-233 owns the schema and fixture tests. HPA-231 owns the final The Seventh Mirror scenario values used during migration.

### Manual visual-review record

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

Validation requirements:

- Story, preview ID, release ID, checksum, and scenario digest pass existing validators.
- `reviewedAt` is canonical UTC ISO-8601.
- Representative routes are non-empty same-origin path-and-query values.
- Counts are non-negative safe integers and agree with the retained publisher report.
- Approval requires representative desktop, mobile, transition, omission, portrait, and choice cases.
- A rejected record always fails the release gate.

The record is intentionally small. It records authorization evidence rather than becoming an artwork-review database.

### Shared diagnostic stage vocabulary

Both `verify-preview` and `smoke-production` use the same diagnostic schema and stage enum:

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

Each command emits only the stages relevant to its execution, but troubleshooting documentation and automation consume one stable vocabulary.

### Final gate report

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
        browserFlows: GateCheckV1;
        manualReview: GateCheckV1;
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
        | 'playwright-result'
        | 'manual-review'
        | 'pointer-snapshot';
    path: string;
    sha256: string;
    mediaType: string;
}
```

### Binding rules

All evidence agrees on:

- Story ID.
- Preview namespace where applicable.
- Immutable release ID.
- Manifest byte checksum.
- Candidate commit SHA where applicable.
- Browser scenario digest.
- Manual-review digest.

The final report is `passed` only when every required check is `passed`. Missing or `not-run` evidence is failure.

### Output and exit rules

- `--json` writes one valid report document to stdout.
- Progress and diagnostics go to stderr.
- Human mode summarizes stages and retained evidence paths.
- Exit code `0`: complete gate passed.
- Exit code `1`: gate failed due to verification.
- Exit code `2`: invalid input or evidence schema.
- Exit code `3`: environment or prerequisite unavailable.
- Existing publisher exit codes remain unchanged and are not reinterpreted.

## Cross-system browser verification

Add `packages/e2e/tests/visual-novel-release-gate.spec.ts`.

### Configuration

The suite reads validated environment variables:

- `RELEASE_GATE_STORY_ID`
- `RELEASE_GATE_PREVIEW_ID`
- `RELEASE_GATE_RELEASE_ID`
- `RELEASE_GATE_MANIFEST_SHA256`
- `RELEASE_GATE_SCENARIO`
- `PUBLIC_ASSET_BASE_URL`
- `PUBLIC_ASSET_ENVIRONMENT=preview`
- `PUBLIC_ASSET_PREVIEW_ID`
- `BASE_URL`

Do not hard-code The Seventh Mirror-specific lines in the generic test implementation.

### Required flow

1. Open a direct non-zero story, scene, and dialogue URL in visual mode.
2. Assert that the reader reports the expected release ID and ready visual state.
3. Advance across a known background and portrait change.
4. Switch visual to text and back while preserving the exact active line.
5. Resize between desktop and mobile dimensions while preserving the exact active line.
6. Open and close dialogue history with focus restoration.
7. Restore a bookmark and verify the exact route and line.
8. Exercise an intentionally omitted or unavailable visual while dialogue remains usable.
9. Select a deterministic choice and load the expected next scene.
10. Reload and assert that no unrelated story dialogue chunk was requested.

### Browser matrix

Required release-gate projects:

- Desktop Chromium.
- Mobile Chromium.

The full ordinary E2E workflow retains Mobile Safari and broader regression coverage.

### Evidence

Emit a machine-readable Playwright result summary containing:

- Project name.
- Story, preview, release, and manifest identity.
- Scenario digest.
- Pass/fail status.
- Trace and screenshot paths for failures.

The gate report references this file by path and digest. It does not parse the HTML report.

## Workflow relationship and preview authorization workflow

### HPA-230 workflow: publisher regression

During HPA-233 implementation, update the GitHub Actions display name of `.github/workflows/r2-publisher-preview.yml` to:

```yaml
name: R2 Publisher Regression Gate
```

It continues to own:

- controlled fixture candidate A/B/C behavior;
- unchanged publication no-op;
- create-or-reuse semantics;
- preview activation and pointer-only changes;
- stale advisory conflict;
- rollback;
- publisher-level production-pointer proof;
- lower-level public smoke.

It remains manually triggerable and may also be used as periodic infrastructure regression evidence. HPA-233 does not make every story authorization depend on rerunning this full scenario.

### HPA-233 workflow: story-release authorization

Add `.github/workflows/visual-novel-release-gate.yml` with `workflow_dispatch` inputs:

- Candidate commit SHA.
- Story ID.
- Preview ID.
- Production candidate release ID.
- Manifest checksum.
- Publisher candidate-report path or artifact reference.
- Deployed web preview URL.
- Browser scenario path.
- Phase: `prepare` or `finalize`.
- Manual-review record path, required only for `finalize`.
- Optional evidence-retention label.

The same workflow is intentionally run in two phases:

- `prepare` creates or reuses the isolated preview, runs automated checks, and uploads non-authorizing evidence for the human reviewer. It does not emit a passing final gate report.
- `finalize` reruns the bounded automated checks against the same immutable identity, validates the completed manual-review record, and emits the final authorizing report.

Rerunning automated checks in `finalize` avoids trusting cross-run mutable state or requiring the gate to download and bless an earlier workflow artifact as sufficient by itself. Mirroring and preview activation are expected to be idempotent or no-op for the same release.

The workflow reuses:

- `r2-gate-capture-state.ts` for before/after snapshots;
- the existing R2 store and publisher CLI;
- extracted shared pointer-only assertion helpers where useful;
- the parameterized public verifier.

It does not rerun:

- controlled source revisions;
- unchanged-candidate no-op proof;
- stale-conflict coordination;
- rollback regression;
- publisher fixture construction.

Those remain HPA-230 workflow responsibilities.

### Required permissions and secrets

- `contents: read`.
- Scoped R2 publisher credentials needed for read, mirror, and preview-pointer operations.
- No production activation confirmation is available to this workflow.
- If Cloudflare cannot provide a preview-only credential, command construction and before/after proof still prohibit production mutation.

### Prepare-phase sequence

1. Checkout the exact candidate commit.
2. Install pinned dependencies and Playwright browsers.
3. Run bounded Tier 1 deterministic CI.
4. Load and validate the retained production candidate publisher report.
5. Capture the production pointer with the existing capture-state helper.
6. Deep-verify the immutable production candidate through the R2 API.
7. Publicly verify the immutable production candidate in candidate mode.
8. Mirror the exact retained candidate to the requested preview namespace.
9. Activate only the preview pointer using the existing conditional publisher path.
10. Publicly verify the preview active release in active mode.
11. Run Desktop Chromium and Mobile Chromium release-gate Playwright flows against the deployed web preview.
12. Capture the production pointer again and prove it is unchanged.
13. Upload the automated evidence, preview routes, traces, screenshots, pointer snapshots, checksums, and digest metadata for human review.
14. Write a preparation summary that clearly states it is not production authorization.

### Finalize-phase sequence

1. Checkout the exact candidate commit and require the same story, preview, release, manifest checksum, and scenario identity used for review.
2. Rerun bounded Tier 1, R2 deep verification, public candidate verification, idempotent mirror/preview activation, public active verification, and Desktop/Mobile Chromium flows.
3. Validate the completed manual visual-review record against the exact release, checksum, preview ID, scenario digest, and coverage.
4. Capture the production pointer before and after finalization and prove it is unchanged.
5. Assemble and validate the final gate report.
6. Upload all final evidence and write the release ID, manifest checksum, report digest, artifact digest, and workflow run ID to the job summary.

### Workflow invariants

- The production candidate was published with `--no-activate` before this workflow.
- The workflow uses the retained publisher report; it does not re-encode source inputs.
- Preview activation is explicit and separate from gate aggregation.
- No command includes production confirmation or requests production activation.
- Production pointer snapshots are mandatory evidence.
- A failure at any stage prevents a passing report.
- Prepare phase cannot emit a passing final report.
- Finalize phase requires an approved manual-review record and reruns the bounded automated checks.
- Safe partial artifacts are uploaded for diagnosis.
- The expected manifest checksum is one validated value passed unchanged across all stages.

## Production activation handoff

HPA-231 consumes the retained passing report through a read-only assertion command:

```bash
bun --filter @aquila/infra-cloudflare release-gate assert-activation-ready \
  --report <gate-report.json> \
  --story <story-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --commit-sha <candidate-commit>
```

The assertion verifies:

- Report schema and passing status.
- Story, release, checksum, scenario, review, and commit match the intended activation.
- Every required check passed.
- Every referenced evidence digest matches the retained file.
- Production-pointer-unchanged proof passed.

The assertion command does not call activation. HPA-231 then invokes the existing publisher command to activate the verified stored release atomically.

A report authorizes only the exact immutable release and candidate commit it names.

## Post-activation smoke

Expose a non-destructive command:

```bash
bun --filter @aquila/infra-cloudflare release-gate smoke-production \
  --story <story-id> \
  --release <expected-release-id> \
  --expect-manifest-sha256 <sha256> \
  --asset-base-url <production-asset-domain> \
  --web-base-url <production-web-url> \
  --json
```

Required checks:

- Production `current.json` exists and names the expected release.
- Pointer and immutable manifest integrity pass.
- Representative background and portrait objects decode.
- The reader opens the expected direct route and advances.
- Pointer revalidation behavior is correct.
- No write operation is attempted.

`smoke-production` emits `GateDiagnosticV1` and uses the shared `GateStageV1` vocabulary. It primarily emits `input`, `pointer`, `manifest`, `public-object`, `browser-decode`, `reader-flow`, and `post-activation-smoke`.

This command validates the cutover, not the entire candidate qualification process.

## Failure simulation ownership

HPA-233 references HPA-230 tests for:

- Unchanged-release idempotency.
- Failed-candidate atomicity.
- Concurrent-pointer protection.
- Conditional activation.
- Verified-release rollback.

HPA-233 adds tests for:

- Active and immutable-candidate public-verification modes.
- Invalid public pointer and manifest.
- Pointer checksum mismatch.
- Wrong public content type, dimensions, CORS, or cache directives.
- Missing or corrupt public objects.
- Forbidden prompt or source fields.
- Coverage evidence with unclassified or missing included identities.
- Omitted identity incorrectly present in the manifest.
- Browser-result release or scenario mismatch.
- Manual-review story, preview, release, checksum, or scenario mismatch.
- Rejected manual review.
- Missing required evidence.
- Tampered evidence digest.
- Production-pointer before/after mismatch.
- Post-activation expected-release mismatch.
- A different expected checksum being introduced by any stage.

Tests use local stores, fixture HTTP servers, or mocked fetch implementations unless the behavior specifically requires the gated preview workflow.

## Canonical HPA-216 acceptance snapshot and ownership matrix

The criteria below were transcribed from Linear HPA-216 on 2026-08-02. This section is the canonical in-repository snapshot used by HPA-233 implementation and review. If Linear HPA-216 changes, the implementation PR updates this table in the same change.

| ID | HPA-216 acceptance criterion | Primary existing owner/evidence | HPA-233 or HPA-231 completion evidence |
|---|---|---|---|
| AC-01 | The Seventh Mirror can be opened and progressed in visual novel mode on desktop and mobile. | HPA-228 visual-reader tests. | HPA-233 deployed preview flow; HPA-231 production smoke. |
| AC-02 | Text and visual modes share one progression state and preserve the exact active dialogue line when switching. | HPA-234 session tests; HPA-228 reader tests. | HPA-233 preview flow at a non-zero line. |
| AC-03 | Compiled logical background and portrait keys resolve through a validated, versioned, prompt-free runtime manifest. | HPA-227 contracts; HPA-230 publisher verification. | HPA-233 candidate and active public verification. |
| AC-04 | The visual MVP displays one active portrait with deterministic left, center, or right placement. | HPA-227 presentation metadata; HPA-228 tests. | HPA-233 representative preview assertion. |
| AC-05 | Background and portrait transitions do not flash, reset progression, or violate reduced-motion preferences. | HPA-228 local E2E and reduced-motion tests. | HPA-233 representative transition proves deployed release integration; ordinary E2E retains reduced-motion coverage. |
| AC-06 | Choices, bookmarks, direct scene URLs, locale routing, browser navigation, and responsive reader swaps continue to work. | HPA-234 and HPA-228 tests. | HPA-233 direct URL, bookmark, choice, and responsive-layout flow. |
| AC-07 | Missing, invalid, or slow assets fall back cleanly without blocking story progression. | HPA-228 fallback tests. | HPA-233 intentional omission or unavailable-asset preview case. |
| AC-08 | Changed images can be published without a Vercel application deployment when logical keys remain unchanged. | HPA-230 content-addressed publisher and activation tests. | HPA-231 migration/controlled revision evidence; referenced by HPA-233 matrix, not duplicated. |
| AC-09 | Asset publication is atomic and can be rolled back to a previously verified release. | HPA-230 tests and R2 Publisher Regression Gate. | HPA-231 activation and rollback decision record; no duplicate HPA-233 regression. |
| AC-10 | Public binary objects and immutable manifests use content-addressed or release-versioned URLs with appropriate cache headers. | HPA-227 paths; HPA-229 verifier; HPA-230 candidate verifier. | HPA-233 public candidate and active-release verification. |
| AC-11 | The mutable story pointer has a documented revalidation policy. | HPA-227 policy; HPA-229 verifier/runbook. | HPA-233 active verification and production smoke. |
| AC-12 | The public runtime manifest and public CDN metadata expose no generation prompts. | HPA-227 schema; HPA-229/230 verification. | HPA-233 forbidden-field public check. |
| AC-13 | Production visual assets are no longer bundled into the Vercel deployment or treated as canonical runtime binaries in Git. | HPA-231 migration and repository-cleanup scope. | HPA-231 retained migration evidence; HPA-233 maps but does not perform cleanup. |
| AC-14 | Opening one story does not eagerly load every registered story's dialogue bundle. | HPA-232 lazy-loading E2E. | HPA-233 deployed preview network assertion. |
| AC-15 | Bundle measurements demonstrate the selected story is emitted and loaded independently. | HPA-232 build assertions and performance report. | Existing evidence is referenced; no new HPA-233 measurement. |
| AC-16 | Unit tests cover manifest validation, URL resolution, CJK/nested keys, cache/fallback behavior, and reader-state preservation. | HPA-227, HPA-228, HPA-234 unit suites. | Tier 1 command and checked-in ownership matrix. |
| AC-17 | Playwright tests cover desktop and mobile visual mode, a scene transition, reader-mode switching, missing assets, and a choice branch. | HPA-228 local Playwright suite. | HPA-233 deployed preview Desktop/Mobile Chromium flow. |
| AC-18 | The asset publisher verifies metadata and decoding before changing the active release pointer. | HPA-230 candidate verifier and tests. | R2 Publisher Regression Gate plus retained candidate report; not reimplemented. |
| AC-19 | The publishing and rollback workflow is documented. | HPA-229 and HPA-230 runbooks. | HPA-233 activation handoff and HPA-231 migration runbook. |

The implementation converts this design table into a checked-in matrix with exact commands and file paths. Rows that rely on manual visual judgement identify the review-record case ID and justification. Duplicate checks are documented as defense in depth only when they verify different boundaries.

## Implementation slices

### Slice 1: ownership matrix and schemas

- Add the exact command/file-path HPA-216 ownership matrix from the canonical snapshot.
- Define scenario, gate report, evidence reference, diagnostic, public-verification, and manual-review schemas.
- Add strict parser and cross-evidence binding tests.
- Define the shared stage and error-code vocabulary.

### Slice 2: reusable public verifier

- Extract hard-coded public verification into parameterized services.
- Add immutable-candidate mode.
- Preserve the existing smoke CLI as a compatibility wrapper.
- Keep result release identity required in both modes.
- Pass the one parsed expected checksum through every verifier.
- Add structured JSON output and safe diagnostics.

### Slice 3: gate coordinator

- Load, hash, validate, and bind all evidence.
- Produce human and JSON final reports.
- Add `assert-activation-ready`.
- Prove the coordinator cannot call pointer mutation APIs.

### Slice 4: cross-system Playwright flow

- Add scenario descriptor schema and release-gate spec.
- Select Desktop Chromium and Mobile Chromium explicitly.
- Emit structured Playwright evidence.
- Consolidate the unrelated-story network assertion into the release flow without removing broader lazy-loading regression tests.
- Leave Mobile Safari in the ordinary full E2E workflow.

### Slice 5: workflow integration

- Add `verify:visual-novel-ci`.
- Rename the existing workflow display name to R2 Publisher Regression Gate.
- Add the separate HPA-233 visual-novel release-gate workflow.
- Reuse `r2-gate-capture-state.ts` and shared pointer-proof helpers.
- Avoid duplicating controlled revision, stale conflict, and rollback regression steps.
- Retain reports, traces, screenshots, and digest metadata.

### Slice 6: production handoff and runbook

- Add post-activation smoke using the shared diagnostic schema.
- Document HPA-231's exact qualification, activation, smoke, and rollback decision sequence.
- Add troubleshooting guidance keyed by shared stage and error code.
- Document workflow ownership and when each gate is run.

## Security and mutation safety

1. Gate aggregation and public verification are read-only.
2. The preview workflow invokes mutation only through the existing publisher and only for a validated preview target.
3. Production activation requires the existing exact story confirmation and is absent from the gate workflow.
4. Production pointer snapshots are required evidence, not best-effort logging.
5. Reports sanitize diagnostics and never include credentials or private source details.
6. Evidence paths are restricted to the workflow evidence directory; path traversal and external references are rejected.
7. Evidence file hashes are computed by the gate, not trusted from supplied metadata.
8. Public URLs are HTTPS and credential-free.
9. One canonical expected manifest checksum is used across the workflow.
10. The HPA-230 regression workflow and HPA-233 release workflow have distinct names and responsibilities.

## Operational flow for HPA-231

1. Complete the production release plan and source inventory.
2. Publish the production candidate with `--no-activate` and retain its publisher report.
3. Deploy the candidate commit as a web preview configured for the chosen asset preview namespace.
4. Run the HPA-233 workflow in `prepare` phase through candidate verification, preview mirroring, preview activation, public verification, and browser flows.
5. Perform representative visual review against the prepared preview and retain the release-bound review record.
6. Run the same workflow in `finalize` phase; it reruns bounded automated checks and emits the final report with approved human evidence.
7. Run `assert-activation-ready` against the exact candidate.
8. Activate production using the existing publisher atomic activation command.
9. Run the non-destructive production smoke.
10. Decide whether to retain the release, roll back to a previously verified release, or investigate. Execution evidence and rollback decisions belong to HPA-231.

The HPA-230 R2 Publisher Regression Gate is run independently when publisher lifecycle behavior or R2 integration needs regression evidence. It is not the per-story production authorization record.

## Documentation deliverables

- Canonical HPA-216 acceptance-to-test ownership matrix with exact commands and paths.
- Release-gate CLI and schema documentation.
- Manual visual-review record template.
- Visual-novel release-gate workflow runbook.
- R2 Publisher Regression Gate ownership note.
- HPA-231 activation checklist.
- Post-activation smoke instructions.
- Troubleshooting guide keyed by shared stage and code.
- Fixture ownership notes.

## Acceptance mapping

The implementation is complete when:

- Ordinary Tier 1 CI remains credential-free and fixture-sized.
- Tier 1 explicitly uses Desktop Chromium and Mobile Chromium, while ordinary E2E retains Mobile Safari.
- A candidate immutable release is verified before preview or production pointer activation through public candidate mode.
- Public custom-domain and browser behavior are verified separately from R2 API storage verification.
- Desktop and mobile reader flows prove exact progression state across mode and layout changes.
- Omitted or failed visuals do not block dialogue or choices.
- Unrelated story dialogue is not eagerly requested.
- Existing publisher idempotency, atomicity, conflict, and rollback tests and workflow are referenced rather than duplicated.
- The two R2 workflows have explicit non-overlapping ownership and distinguishable names.
- Human review is required only for visual judgement and cannot be reused across releases.
- The final result identifies and binds the exact verified release, checksum, commit, scenario, and review.
- Active-mode public verification returns a required release ID derived from the pointer.
- Both release qualification and production smoke use the shared diagnostic vocabulary.
- The preview workflow cannot update production and proves that it did not.
- HPA-231 has one documented assertion to run before production activation.
- Production smoke is non-destructive and returns a clear result.
- Failures identify story, release, target, identity or path where relevant, and a stable stage.
- The checked-in HPA-216 matrix is self-contained and reviewable without opening Linear.

## Open implementation details

The following choices may be finalized during implementation planning without changing this design:

- Whether `release-gate` is a subcommand of the existing `assets` CLI or a sibling CLI entry point inside the same package.
- Whether the HPA-230 workflow filename is renamed or only its display name changes.
- The exact JSON reporter integration used to derive structured Playwright evidence.
- Whether deterministic CI is implemented as a root shell script, a Bun script, or a Turbo task.
- Exact artifact retention duration, subject to repository policy.

These are implementation mechanics. The ownership boundaries, workflow separation, evidence binding, mutation safety, required checks, shared diagnostics, and HPA-231 handoff are fixed by this design.
