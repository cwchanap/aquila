# HPA-233: Aquila Visual Novel Pre-Production Release Gate Design

## Status

Approved for implementation planning.

- Linear issue: HPA-233
- Parent: HPA-216
- Blocks: HPA-231
- Repository: `cwchanap/aquila`
- Design date: 2026-08-02

## Summary

Aquila already has the runtime asset contract, visual reader, reader-session state, story lazy loading, isolated R2 delivery, and immutable publisher required for visual-novel releases. HPA-233 must not replace those systems. It adds a thin release-gate layer that composes their existing verification, fills the remaining cross-system gaps, binds all evidence to one immutable candidate release, and produces the exact authorization artifact HPA-231 must present before production activation.

The design separates ordinary credential-free CI from a manually triggered preview-release gate. Ordinary CI runs entirely against small deterministic fixtures. The preview-release gate verifies a retained immutable production candidate through R2, mirrors and activates that exact release only in an isolated preview namespace, validates public delivery and browser behavior against a deployed web preview, incorporates a release-bound human visual-review record, and emits a retained machine-readable decision. The gate never updates the production pointer.

## Goals

1. Map every HPA-216 acceptance criterion to an existing owned test, an HPA-233 integration check, or an explicitly justified human review.
2. Expose one deterministic visual-novel CI command that requires no Cloudflare access and no production-sized artwork.
3. Expose one parameterized preview-release verification flow that can validate an immutable candidate before any active pointer update.
4. Exercise the real public asset domain and deployed reader together on desktop and mobile layouts.
5. Bind automated and human evidence to the exact story, release ID, manifest checksum, commit, and preview namespace.
6. Produce a stable, machine-readable release-gate result that HPA-231 can verify before calling the existing atomic production activation path.
7. Provide a smaller, non-destructive production smoke command for use after activation.

## Non-goals

- Performing The Seventh Mirror production migration.
- Reimplementing runtime manifest, pointer, resolver, publisher, activation, or rollback logic.
- Creating a second fixture framework or a second representation of release coverage.
- Pixel-perfect approval of every production illustration.
- Generating or evaluating AI artwork.
- Packaging complete offline or Tauri asset sets.
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

HPA-233 must call these APIs rather than parse documents or construct paths independently.

### `@aquila/infra-cloudflare`

Owns:

- Release planning and coverage classification.
- Deterministic image encoding and content addressing.
- Immutable candidate publication.
- Deep R2 candidate verification.
- Preview mirroring.
- Conditional activation, conflict detection, release history, and rollback.
- Public-delivery verification primitives.

HPA-233 adds orchestration and parameterization here. It does not fork publisher behavior.

### `apps/web`

Owns:

- Asset-source environment resolution.
- Canonical reader-session state.
- Visual and text reader behavior.
- Browser restoration, bookmarks, choices, responsive reader state, fallback, caching, and prefetch.
- Story lazy loading.

HPA-233 may expose deterministic reader evidence but does not move these responsibilities into infrastructure code.

### `packages/e2e`

Owns browser flows. HPA-233 adds one release-specific environment-driven suite for the combinations that existing local suites do not prove together.

## Architecture decision

### Chosen approach: thin release-gate orchestrator

The gate is a focused module and CLI within `packages/infra-cloudflare`, supported by an environment-driven Playwright suite in `packages/e2e` and a dedicated GitHub Actions workflow.

A new workspace is not justified initially. The gate's domain logic is primarily evidence validation and orchestration over existing package APIs. A separate `packages/release-gate` workspace may be introduced later only if this layer gains substantial reusable logic that cannot remain cohesive within `infra-cloudflare`.

### Rejected alternatives

#### New release-gate workspace immediately

This would create package plumbing and public exports before there is an independent domain. Most code would wrap `infra-cloudflare` and Playwright, increasing indirection without improving ownership.

#### Workflow-only shell gate

A shell-only implementation would be difficult to unit-test, reuse locally, version as a schema, or consume safely from HPA-231. The workflow should call a tested gate module, not define release semantics itself.

#### Extend the publisher report into the final gate result

Publisher verification is necessary but not sufficient. It cannot represent deployed-browser behavior or human review. Mutating the publisher report schema to include unrelated evidence would blur ownership and make publisher commands depend on web deployment concerns.

## Evidence tiers

### Tier 1: deterministic visual-novel CI

Expose a credential-free repository command:

```bash
bun run verify:visual-novel-ci
```

The exact implementation may use Turbo, but it must preserve visible ownership and failure attribution. The command composes:

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun --filter e2e test:e2e tests/reader-visual.spec.ts tests/reader-lazy-loading.spec.ts
```

Properties:

- Uses only checked-in small fixtures.
- Does not require R2 credentials or network access.
- Does not require production artwork.
- Does not write any preview or production pointer.
- Runs in normal pull-request CI.
- Produces a clear failing component rather than one opaque wrapper failure.

The gate workflow may rerun a focused subset of Tier 1 for the candidate commit, but the machine-readable gate result must identify the exact commit whose deterministic CI passed.

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
  --manual-review <review-record.json> \
  --commit-sha <candidate-commit> \
  --evidence-dir <directory> \
  --json
```

The command is an evidence aggregator and validator. It does not itself mirror or activate a release. Those operations remain explicit workflow steps using the existing publisher CLI.

The command verifies that all supplied evidence describes the same release and produces the final decision.

## Public-delivery verifier

The current R2 delivery verifier is specialized to one story and preview ID. Refactor it into a reusable service while preserving a compatibility wrapper for the existing smoke command.

### Input

```ts
interface PublicReleaseVerificationInput {
    storyId: string;
    target: PublicationTarget;
    assetBaseUrl: URL;
    browserOrigin: URL;
    releaseId?: string;
    expectedManifestSha256?: ManifestByteSha256;
}
```

### Modes

#### Active-release mode

When `releaseId` is absent:

1. Fetch the target's `current.json`.
2. Validate pointer schema and publication path.
3. Fetch the named immutable manifest.
4. Verify the manifest byte checksum against the pointer.
5. Validate the pointer/manifest pair and canonical release identity.
6. Verify all included objects and public-delivery behavior.

#### Immutable-candidate mode

When `releaseId` is present:

1. Derive the immutable manifest path directly from contract helpers.
2. Fetch and validate the manifest without reading or requiring `current.json`.
3. Verify the supplied expected checksum when present.
4. Verify canonical release identity and all included objects.

Candidate mode is required so a production candidate can be fully checked before any active pointer changes.

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
- Manifest contains no identities classified as omitted in the supplied coverage evidence.
- Coverage has no unclassified or missing included keys.

The existing R2 API deep verifier remains authoritative for storage-level verification. The public verifier proves the independently valuable custom-domain, CDN, CORS, and browser-facing properties.

### Public verification result

Return a structured result rather than printing directly:

```ts
interface PublicReleaseVerificationResultV1 {
    schemaVersion: 1;
    status: 'passed' | 'failed';
    storyId: string;
    target: PublicationTarget;
    releaseId: string;
    manifestSha256: string;
    checks: PublicVerificationCheckV1[];
    diagnostics: GateDiagnosticV1[];
}
```

A compatibility CLI may render the existing human-readable PASS/FAIL format from this result.

## Release-gate schemas

Schemas should use Zod or the repository's existing validation pattern and reject unknown fields unless forward compatibility requires a deliberate extension point.

### Manual visual-review record

```ts
interface VisualReviewRecordV1 {
    schemaVersion: 1;
    storyId: string;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
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

- `storyId`, `previewId`, `releaseId`, and checksum pass the existing contract validators.
- `reviewedAt` is canonical UTC ISO-8601.
- `representativeRoutes` is non-empty and contains only same-origin path-and-query values, not arbitrary external URLs.
- Counts are non-negative safe integers.
- Approval requires at least one representative route and explicit included/omitted counts.
- A rejected record always fails the release gate.

The record is intentionally small. It records authorization evidence rather than becoming an artwork-review database.

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
    createdAt: string;
    checks: {
        deterministicCi: GateCheckV1;
        publisherCandidate: GateCheckV1;
        publicDelivery: GateCheckV1;
        browserFlows: GateCheckV1;
        manualReview: GateCheckV1;
        productionPointerUnchanged: GateCheckV1;
    };
    evidence: GateEvidenceReferenceV1[];
    diagnostics: GateDiagnosticV1[];
}
```

```ts
interface GateCheckV1 {
    status: 'passed' | 'failed';
    evidenceIds: string[];
}

interface GateEvidenceReferenceV1 {
    id: string;
    kind:
        | 'ci-result'
        | 'publisher-report'
        | 'public-verification'
        | 'playwright-result'
        | 'manual-review'
        | 'pointer-snapshot';
    path: string;
    sha256: string;
}
```

### Binding rules

All evidence must agree on:

- Story ID.
- Preview namespace where applicable.
- Immutable release ID.
- Manifest byte checksum.
- Candidate commit SHA where applicable.

The manual-review record must match the release and checksum exactly. Browser evidence must identify the expected release resolved by the reader. Publisher candidate verification must show zero production pointer writes. Pointer snapshots must prove the production pointer is byte-for-byte or semantically unchanged across the workflow.

The final report is `passed` only when every required check is `passed`. Missing evidence is failure, not an omitted optional check.

### Output rules

- `--json` writes only one valid report document to stdout.
- Progress and diagnostics go to stderr.
- Human mode summarizes stages and identifies retained evidence paths.
- Exit code `0`: complete gate passed.
- Exit code `1`: gate failed due to verification.
- Exit code `2`: invalid input or evidence schema.
- Exit code `3`: environment or prerequisite unavailable.
- Existing publisher exit codes remain unchanged and are not reinterpreted by this command.

## Cross-system browser verification

Add `packages/e2e/tests/visual-novel-release-gate.spec.ts`.

### Configuration

The suite reads validated environment variables:

- `RELEASE_GATE_STORY_ID`
- `RELEASE_GATE_PREVIEW_ID`
- `RELEASE_GATE_RELEASE_ID`
- `RELEASE_GATE_MANIFEST_SHA256`
- `PUBLIC_ASSET_BASE_URL`
- `PUBLIC_ASSET_ENVIRONMENT=preview`
- `PUBLIC_ASSET_PREVIEW_ID`
- `BASE_URL`
- Route fixtures or a checked-in scenario descriptor identifying deterministic lines and choice paths.

Do not hard-code The Seventh Mirror-specific lines in the generic test implementation. Story-specific scenario data may be checked in under a small validated fixture owned by HPA-231.

### Required flow

1. Open a direct non-zero story, scene, and dialogue URL in visual mode.
2. Assert that the reader reports the expected release ID and ready visual state.
3. Advance across a known background change and portrait change.
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

The ordinary E2E suite retains mobile Safari and broader regression coverage. The release gate uses the smaller required matrix to keep credentialed preview verification bounded and deterministic.

### Evidence

Emit a machine-readable Playwright result summary containing:

- Project name.
- Story and release identity.
- Scenario IDs.
- Pass/fail status.
- Trace and screenshot paths for failures.

The gate report references this file by path and digest. It does not parse the HTML report.

## Preview workflow

Add `.github/workflows/visual-novel-release-gate.yml` with `workflow_dispatch` inputs:

- Story ID.
- Preview ID.
- Production candidate release ID.
- Manifest checksum.
- Deployed web preview URL.
- Manual-review record path.
- Optional evidence-retention label.

### Required permissions and secrets

- `contents: read` only.
- Scoped R2 publisher credentials needed for read, mirror, and preview-pointer operations.
- No credential capable of updating the production pointer should be supplied if Cloudflare supports separating that permission. When the same scoped publisher credential is unavoidable, workflow assertions and exact command construction must still prohibit production activation.

### Sequence

1. Checkout the exact candidate commit.
2. Install pinned dependencies and Playwright browsers.
3. Run targeted deterministic CI.
4. Capture the production pointer before any R2 operation.
5. Deep-verify the immutable production candidate through the R2 API.
6. Mirror the exact retained candidate to the requested preview namespace.
7. Activate only the preview pointer using the existing conditional publisher path.
8. Run parameterized public-delivery verification against the preview namespace.
9. Run desktop and mobile release-gate Playwright flows against the deployed web preview.
10. Validate the manual visual-review record.
11. Capture the production pointer again and prove it is unchanged.
12. Assemble and validate the final gate report.
13. Upload all evidence and write the release ID, manifest checksum, report digest, artifact digest, and workflow run ID to the job summary.

### Workflow invariants

- The candidate is published to production storage with `--no-activate` before this workflow, normally by HPA-231.
- The workflow mirrors exact immutable bytes. It does not re-encode mutable source inputs.
- Preview activation is explicit and separate from gate aggregation.
- No command includes production confirmation or requests production activation.
- The production pointer is captured before and after and must remain unchanged.
- A failure at any stage prevents a passing report.
- Partial artifacts are still uploaded when safe so operators can diagnose the failure.

## Production activation handoff

HPA-231 consumes the retained passing report. Add a read-only assertion command:

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
- Story, release, checksum, and commit match the intended activation.
- Every required check passed.
- Every referenced evidence digest matches the retained file.
- Manual review is approved and bound to the same release.
- Production-pointer-unchanged proof passed.

The assertion command does not call activation. HPA-231 then invokes the existing publisher command to activate the verified stored release atomically.

A report is not a permanent universal approval. It authorizes only the exact immutable release and candidate commit it names.

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

This command is deliberately smaller than the pre-production gate. It validates the cutover, not the entire candidate qualification process.

## Failure diagnostics

Use stable stages:

- `input`
- `ci`
- `publisher-candidate`
- `pointer`
- `manifest`
- `coverage`
- `public-object`
- `browser-decode`
- `reader-flow`
- `manual-review`
- `evidence-binding`
- `production-pointer-proof`
- `post-activation-smoke`

A diagnostic should carry only safe fields:

```ts
interface GateDiagnosticV1 {
    code: string;
    stage: string;
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

Do not emit source filesystem paths, generation prompts, credentials, signed URLs, raw environment values, or private bucket names in public artifacts.

## Failure simulation ownership

HPA-233 reuses HPA-230 tests for:

- Unchanged-release idempotency.
- Failed-candidate atomicity.
- Concurrent-pointer protection.
- Conditional activation.
- Verified-release rollback.

HPA-233 adds tests for its own behavior:

- Active and immutable-candidate public-verification modes.
- Invalid public pointer and manifest.
- Pointer checksum mismatch.
- Wrong public content type, dimensions, CORS, or cache directives.
- Missing or corrupt public objects.
- Forbidden prompt or source fields.
- Coverage evidence with unclassified or missing included identities.
- Omitted identity incorrectly present in the manifest.
- Browser-result release mismatch.
- Manual-review story, preview, release, or checksum mismatch.
- Rejected manual review.
- Missing required evidence.
- Tampered evidence digest.
- Production-pointer before/after mismatch.
- Post-activation expected-release mismatch.

Tests use local stores, fixture HTTP servers, or mocked fetch implementations unless the behavior specifically requires the gated preview workflow.

## Test ownership matrix

Create a checked-in matrix mapping each HPA-216 acceptance criterion to one of:

- Existing HPA-227 contract tests.
- Existing HPA-228 reader unit or E2E tests.
- Existing HPA-229 delivery verification.
- Existing HPA-230 publisher tests.
- Existing HPA-232 lazy-loading tests.
- Existing HPA-234 session-state tests.
- New HPA-233 cross-system or evidence-binding tests.
- Manual visual review with a written justification.

The matrix should include the exact command and file path, not merely the owning ticket. Duplicate checks should either be removed or explicitly documented as defense in depth across different boundaries.

## Implementation slices

### Slice 1: ownership matrix and schemas

- Add the HPA-216 criterion-to-test matrix.
- Define gate report, evidence reference, diagnostic, public-verification, and manual-review schemas.
- Add strict parser and cross-evidence binding tests.

### Slice 2: reusable public verifier

- Extract hard-coded public verification into parameterized services.
- Add immutable-candidate mode.
- Preserve the existing smoke CLI as a compatibility wrapper.
- Add structured JSON output and safe diagnostics.

### Slice 3: gate coordinator

- Load, hash, validate, and bind all evidence.
- Produce human and JSON final reports.
- Add `assert-activation-ready`.
- Prove the coordinator cannot call pointer mutation APIs.

### Slice 4: cross-system Playwright flow

- Add scenario descriptor schema and release-gate spec.
- Add desktop and mobile Chromium projects or focused project selection.
- Emit structured Playwright evidence.
- Consolidate the unrelated-story network assertion into the release flow without removing broader lazy-loading regression tests.

### Slice 5: CI and preview workflow

- Add `verify:visual-novel-ci`.
- Add the dedicated preview gate workflow.
- Capture production pointer before and after.
- Retain reports, traces, screenshots, and digest metadata.

### Slice 6: production handoff and runbook

- Add post-activation smoke.
- Document HPA-231's exact qualification, activation, smoke, and rollback decision sequence.
- Add troubleshooting guidance keyed by stable stage and error code.

## Security and mutation safety

1. Gate aggregation and public verification are read-only.
2. The preview workflow invokes mutation only through the existing publisher and only for a validated preview target.
3. Production activation requires the existing exact story confirmation and is absent from the gate workflow.
4. Production pointer snapshots are required evidence, not best-effort logging.
5. Reports sanitize diagnostics and never include credentials or private source details.
6. Evidence paths are restricted to the workflow evidence directory; path traversal and external references are rejected.
7. Evidence file hashes are computed by the gate, not trusted from user-supplied metadata.
8. Public URLs must be HTTPS and credential-free.

## Operational flow for HPA-231

1. Complete the production release plan and source inventory.
2. Publish the production candidate with `--no-activate` and retain its publisher report.
3. Deploy the candidate commit as a web preview configured for the chosen asset preview namespace.
4. Run the HPA-233 preview workflow to mirror and activate the exact candidate in preview.
5. Perform representative visual review and commit or otherwise retain the signed-off review record.
6. Rerun or resume gate aggregation so the final report includes the approved review record.
7. Run `assert-activation-ready` against the exact candidate.
8. Activate production using the existing publisher atomic activation command.
9. Run the non-destructive production smoke.
10. Decide whether to retain the release, roll back to a previously verified release, or investigate. Execution evidence and rollback decisions belong to HPA-231.

## Documentation deliverables

- HPA-216 acceptance-to-test ownership matrix.
- Release-gate CLI and schema documentation.
- Manual visual-review record template.
- Preview workflow runbook.
- HPA-231 activation checklist.
- Post-activation smoke instructions.
- Troubleshooting guide keyed by stage and code.
- Fixture ownership notes.

## Acceptance mapping

The implementation is complete when:

- Ordinary CI remains credential-free and fixture-sized.
- A candidate immutable release is verified before pointer activation.
- Public custom-domain and browser behavior are verified separately from R2 API storage verification.
- Desktop and mobile reader flows prove exact progression state across mode and layout changes.
- Omitted or failed visuals do not block dialogue or choices.
- Unrelated story dialogue is not eagerly requested.
- Existing publisher idempotency, atomicity, conflict, and rollback tests are referenced rather than duplicated.
- Human review is required only for visual judgement and cannot be reused across releases.
- The final result identifies and binds the exact verified release.
- The preview workflow cannot update production and proves that it did not.
- HPA-231 has one documented assertion to run before production activation.
- Production smoke is non-destructive and returns a clear result.
- Failures identify story, release, target, identity or path where relevant, and a stable stage.

## Open implementation details

The following choices may be finalized during implementation planning without changing this design:

- Whether `release-gate` is a subcommand of the existing `assets` CLI or a sibling CLI entry point inside the same package.
- The exact JSON reporter integration used to derive structured Playwright evidence.
- Whether deterministic CI is implemented as a root shell script, a Bun script, or a Turbo task.
- Exact artifact retention duration, subject to repository policy.

These are implementation mechanics. The ownership boundaries, evidence binding, mutation safety, required checks, and HPA-231 handoff are fixed by this design.
