# HPA-233: Aquila Visual Novel Pre-Production Release Gate

**Date:** 2026-08-02  
**Status:** Approved for implementation  
**Linear:** [HPA-233](https://linear.app/cwchanap/issue/HPA-233/build-aquila-visual-novel-pre-production-release-gate)  
**Parent:** HPA-216  
**Depends on:** HPA-227, HPA-228, HPA-229, HPA-230, HPA-232, HPA-234 — complete  
**Blocks:** HPA-231  
**Delivery rule:** This document is reviewed in a design-only pull request. HPA-233 implementation remains one primary implementation pull request unless the Linear issue is split first.

## Purpose

Build one pre-production authorization gate for Aquila visual-novel releases before the first production migration. The gate composes the contracts, publisher verification, public-delivery checks, reader flows, and human visual approval already owned by completed sibling work. It closes the cross-system gaps that no individual child ticket can prove alone.

The gate must answer one precise question:

> Is this exact candidate commit, story release, manifest checksum, preview namespace, browser scenario set, and human review record safe to activate in production through the existing atomic publisher path?

A passing result is retained as both human-readable evidence and a machine-readable V1 report. HPA-231 must consume that exact report before it activates The Seventh Mirror production pointer.

This design does not introduce another runtime manifest, release identity, resolver, publication layout, browser state model, or publisher implementation. Existing modules remain authoritative.

## Established context and authoritative ownership

### Runtime contracts

`@aquila/stories/runtime-assets` remains the only owner of:

- `RuntimeAssetManifestV1`;
- `ActiveReleasePointerV1`;
- `StoryAssetReleasePlanV1`;
- type-qualified asset identities;
- canonical JSON and release-content hashing;
- release ID derivation;
- pointer/manifest pairing;
- publication paths;
- cache and dimension policies;
- safe story IDs, preview IDs, logical keys, and relative paths.

The gate imports these contracts through the public package export. It must not copy schema fragments or construct publication paths by string concatenation.

### Publisher and R2 verification

`@aquila/infra-cloudflare` already owns:

- authoring-catalog and release-plan validation;
- deterministic encoding and content hashing;
- immutable object and manifest publication;
- deep candidate verification through the selected delivery store;
- machine-readable publisher reports;
- conditional preview and production pointer activation;
- concurrent-pointer protection;
- release listing and rollback;
- public custom-domain verification primitives;
- Cloudflare configuration and credential handling.

The existing publisher report is the retained source of truth for what was included, omitted, created, reused, and whether any pointer changed during candidate publication.

### Browser and reader verification

`packages/e2e` already owns Playwright coverage for:

- direct reader URLs;
- visual reader state;
- background and portrait transitions;
- visual/text mode switching;
- mobile layouts;
- dialogue history;
- missing and invalid asset fallback;
- choices;
- reduced motion;
- lazy story-module isolation, retry, caching, and stale-result guards.

HPA-233 adds one focused environment-driven release flow that composes these behaviors against a real preview candidate. It does not duplicate every local fixture case.

### Reader session ownership

HPA-234 remains authoritative for story, scene, locale, dialogue index, URL synchronization, browser navigation, and persisted reader state. The release gate asserts those contracts through the public reader surface; it does not add a second session model.

## Scope boundaries

### In scope

- A thin release-gate module and CLI inside `@aquila/infra-cloudflare`.
- A parent-acceptance-to-test ownership matrix.
- One credential-free deterministic CI command.
- Parameterized public candidate and active-release verification.
- Validation of retained publisher candidate reports.
- A V1 story-specific browser scenario descriptor.
- A V1 human visual-review record.
- A V1 machine-readable release-gate report.
- A focused desktop and mobile Chromium Playwright release suite.
- A manually triggered GitHub Actions preview-release workflow.
- A read-only activation-readiness assertion for HPA-231.
- A non-destructive production smoke command.
- Failure simulations owned specifically by the composition layer.
- Troubleshooting documentation keyed by stable failure stage.

### Out of scope

- Performing The Seventh Mirror production migration.
- Generating or editing artwork.
- Reimplementing HPA-227 contract tests.
- Reimplementing HPA-228 reader component tests.
- Reimplementing HPA-230 publisher, activation, concurrency, or rollback tests.
- Replacing the existing `assets` publisher CLI.
- Pixel-perfect approval of all production artwork.
- Mutating the production pointer from ordinary CI or release-gate verification.
- Packaging full offline/PWA/Tauri visual assets.
- Testing third-party image-generation providers.
- Load testing unrelated Aquila routes.

## Design principles

1. **Compose, do not fork.** Every check calls the existing parser, verifier, publisher service, or reader surface that owns the behavior.
2. **Bind evidence to identity.** Release ID, manifest checksum, story, preview ID, scenario digest, candidate commit, and manual-review digest must agree before the gate passes.
3. **Separate storage truth from delivery truth.** R2 API verification and public CDN/browser verification are both required because they prove different boundaries.
4. **Keep production mutation explicit.** The gate proves readiness; only the existing publisher activation command changes production `current.json`.
5. **Retain complete evidence.** A later operator must be able to identify exactly what passed without rerunning mutable source inputs.
6. **Fail with actionable context.** Diagnostics identify the stage, story, target, release, qualified asset identity, and safe path or URL when available.
7. **Use small fixtures in ordinary CI.** Live R2, Vercel previews, and production-sized assets are restricted to the gated preview workflow.

## Architecture

### D1 — Add a focused release-gate module to `@aquila/infra-cloudflare`

The gate belongs beside the publisher and public-delivery verifier because it consumes their services, report types, R2 store, configuration, and safety rules. A new workspace would duplicate package setup and create a second infrastructure boundary without an independent deployment need.

Proposed structure:

```text
packages/infra-cloudflare/src/release-gate/
  schemas.ts
  diagnostics.ts
  candidate-evidence.ts
  scenario.ts
  manual-review.ts
  public-release-verifier.ts
  gate-runner.ts
  activation-assertion.ts
  production-smoke.ts
  report.ts
  cli.ts

packages/infra-cloudflare/src/release-gate/__tests__/
packages/infra-cloudflare/src/release-gate/__fixtures__/
```

The existing `src/verify.ts` becomes a compatibility wrapper over the parameterized public verifier so the HPA-229 smoke command continues to work. The old hard-coded smoke story and preview ID remain only in that wrapper, not in the reusable verifier.

The package exposes:

```json
{
  "scripts": {
    "release-gate": "bun src/release-gate/cli.ts"
  }
}
```

The root package exposes one credential-free command:

```json
{
  "scripts": {
    "verify:visual-novel-ci": "..."
  }
}
```

### D2 — Use two evidence tiers

#### Tier 1: deterministic pull-request CI

`bun run verify:visual-novel-ci` runs without Cloudflare access, private source storage, a Vercel deployment, or production-sized artwork.

It composes:

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun --filter e2e test:e2e tests/reader-visual.spec.ts tests/reader-lazy-loading.spec.ts
```

The implementation may use Turbo filters or package scripts to avoid duplicate setup, but the command output must preserve package ownership and make the failing suite visible.

This tier proves deterministic contracts and local composition. It is required on every HPA-233 and HPA-231 candidate commit.

#### Tier 2: gated preview-release verification

A manually triggered workflow verifies one retained immutable candidate through R2, the public asset domain, and a deployed web preview. It may activate only an isolated preview pointer.

It requires:

- candidate commit SHA;
- story ID;
- production candidate release ID;
- manifest checksum;
- retained publisher candidate report;
- preview ID;
- asset base URL;
- deployed web preview URL;
- browser scenario file;
- approved manual-review record.

A passing Tier 2 report is the artifact HPA-231 consumes before production activation.

## Data contracts

### D3 — Define `VisualNovelGateScenarioV1`

A generic gate cannot infer which line changes a background, which route contains an intentional omission, or which choice reaches a representative branch. Those facts are story-specific and must be explicit rather than hard-coded in Playwright.

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
- Every dialogue index is a positive safe integer matching the reader URL contract.
- The transition target must be reachable by normal advancement from the source position.
- `unrelatedStoryIds` contains at least one registered story distinct from `storyId`.
- The scenario is canonicalized and SHA-256 hashed by the gate.
- The browser report records the scenario digest.

Repository location:

```text
packages/e2e/fixtures/visual-release-gates/<storyId>.v1.json
```

HPA-233 provides fixture coverage and the schema. HPA-231 owns the final The Seventh Mirror scenario values used for migration if its release-plan omissions require an adjustment.

### D4 — Define `VisualReviewRecordV1`

Automation proves integrity and behavior but cannot approve representative artwork. Human approval is captured in a validated file:

```ts
interface VisualReviewRecordV1 {
    schemaVersion: 1;
    storyId: string;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    scenarioSha256: string;
    reviewer: string;
    reviewedAt: string;
    decision: 'approved' | 'rejected';
    coverage: {
        included: number;
        omitted: number;
        backgroundsIncluded: number;
        backgroundsOmitted: number;
        portraitsIncluded: number;
        portraitsOmitted: number;
    };
    reviewedCases: Array<{
        id: string;
        route: string;
        notes: string;
    }>;
    knownGaps: string[];
}
```

Rules:

- `reviewedAt` is canonical UTC ISO-8601.
- `decision` must be `approved` for a passing gate.
- Story, preview ID, release ID, checksum, and scenario digest must match gate inputs.
- Counts must be non-negative and agree with the retained publisher report.
- `reviewedCases` must cover direct open, transition, mobile layout, omitted fallback, portrait behavior, and choice progression.
- `knownGaps` explicitly records intentional visual omissions or may be empty.
- The gate canonicalizes and hashes the record. Its SHA-256 is stored in the final gate report.

HPA-231 stores the production migration review at:

```text
docs/releases/visual-novel/<storyId>/<releaseId>.visual-review.v1.json
```

The record may be added after candidate publication because it does not alter release content. The final candidate commit and deployed web preview must include the record, and Tier 1 CI must pass again for that commit.

### D5 — Define `VisualNovelReleaseGateReportV1`

```ts
interface GateEvidenceReferenceV1 {
    kind: string;
    path: string;
    sha256: string;
    mediaType: string;
}

interface GateDiagnosticV1 {
    code: string;
    stage: string;
    message: string;
    storyId: string;
    target: PublicationTarget;
    releaseId?: string;
    manifestSha256?: string;
    identity?: string;
    safePath?: string;
    url?: string;
}

interface GateCheckV1 {
    id: string;
    status: 'passed' | 'failed' | 'not-run';
    startedAt?: string;
    completedAt?: string;
    evidence: GateEvidenceReferenceV1[];
    diagnostics: GateDiagnosticV1[];
}

interface VisualNovelReleaseGateReportV1 {
    schemaVersion: 1;
    status: 'passed' | 'failed';
    storyId: string;
    target: PublicationTarget;
    releaseId: string;
    manifestSha256: string;
    commitSha: string;
    previewId: string;
    scenarioSha256: string;
    manualReviewSha256: string;
    createdAt: string;
    checks: {
        deterministicCi: GateCheckV1;
        publisherCandidate: GateCheckV1;
        r2Candidate: GateCheckV1;
        publicDelivery: GateCheckV1;
        browserFlows: GateCheckV1;
        manualReview: GateCheckV1;
        productionPointerProof: GateCheckV1;
    };
    evidence: GateEvidenceReferenceV1[];
    diagnostics: GateDiagnosticV1[];
}
```

Passing rules:

- Every required check is `passed`.
- No required check is `not-run`.
- All identity fields agree across the candidate report, R2 verifier, public verifier, browser evidence, scenario, and manual review.
- The production pointer before/after proof shows no change.
- JSON mode writes exactly one report document to stdout.
- Human progress and diagnostics go to stderr.
- The report is canonicalized before its artifact checksum is recorded.

The report must not include credentials, private source paths, image prompts, signed URLs, or raw provider errors that could expose secrets.

## Candidate and delivery verification

### D6 — Validate retained publisher candidate evidence

The preview gate consumes the JSON report produced by the exact no-activate production candidate publication. It does not rerun source encoding or reconstruct publication decisions from mutable inputs.

The candidate-evidence check requires:

- command is `publish`;
- status is `success` or `no-op`;
- story and release target match the requested production candidate;
- release ID and manifest checksum match gate inputs;
- pointer did not change;
- `pointersWritten` is zero;
- coverage contains zero unclassified assets;
- every action is one of the existing sanitized publisher actions;
- included and omitted counts are internally consistent.

The gate derives the omitted identity set from the retained publisher actions and later proves none of those identities appears in the public runtime manifest.

A candidate report for another story, release, checksum, target, or publication run fails at stage `candidate-evidence` before any browser work begins.

### D7 — Require both R2 deep verification and public verification

`assets verify --deep` proves the stored immutable candidate through the delivery-store adapter:

- exact manifest bytes and checksum;
- runtime schema;
- canonical release identity;
- object metadata;
- object checksum and byte length;
- encoded format;
- decoded dimensions;
- coverage consistency.

It does not prove the public custom-domain route, Cloudflare cache behavior, browser CORS, or browser decoding. HPA-233 therefore requires a separate unauthenticated public verifier.

The gate must never treat either boundary as a substitute for the other.

### D8 — Parameterize the public release verifier

The reusable verifier accepts:

```ts
interface PublicReleaseVerificationInputV1 {
    storyId: string;
    target: PublicationTarget;
    assetBaseUrl: string;
    browserOrigin: string;
    mode: 'candidate' | 'active';
    releaseId?: string;
    expectedManifestSha256?: string;
    omittedIdentities: string[];
}
```

#### Candidate mode

Candidate mode verifies an immutable release before any pointer update:

1. Compute the release-manifest path with `getReleaseManifestPath()`.
2. Fetch it through the public custom domain.
3. Require JSON content type, immutable cache policy, cache eligibility, and valid CORS.
4. Require exact manifest-byte checksum when supplied.
5. Parse the runtime manifest with the HPA-227 parser.
6. Validate story, release ID, canonical release identity, and forbidden-field absence.
7. Verify every unique object referenced by every manifest asset.
8. Require correct content type, immutable cache policy, byte length, SHA-256, and content-addressed path.
9. Decode every published WebP and AVIF variant through a real browser and compare dimensions with the manifest.
10. Prove every omitted identity from the candidate report is absent from the manifest.

Candidate mode does not invent a pointer and does not claim pointer/manifest pairing passed.

#### Active mode

Active mode adds:

1. Fetch `current.json` through the public domain.
2. Require pointer content type, revalidation directives, edge-cache bypass, and CORS.
3. Parse the pointer for the exact story and target.
4. Require the pointer release ID and checksum to match gate inputs.
5. Fetch the immutable manifest by the canonical path.
6. Validate the pointer/manifest pair.
7. Run all candidate-mode manifest and object checks.

The compatibility HPA-229 smoke command calls active mode with its existing smoke story and preview target.

### D9 — Use stable diagnostics

Gate-owned stages are:

```text
input
candidate-evidence
scenario
r2-candidate
public-pointer
public-manifest
public-object
browser-decode
reader-flow
story-chunk
manual-review
production-pointer-proof
evidence
activation-assertion
production-smoke
```

Gate-owned diagnostic codes are namespaced with `gate/`. Underlying publisher diagnostic codes are preserved when they are already sanitized.

The CLI uses these exit codes:

- `0` — all required checks passed;
- `1` — one or more required checks failed;
- `2` — invalid CLI input, configuration, scenario, report, or review schema;
- `3` — infrastructure or unexpected execution failure prevented a verdict;
- `4` — retained evidence identity conflict, such as mismatched story, release, checksum, preview ID, or digest.

## Browser release flow

### D10 — Add a separate Playwright release-gate configuration

Use:

```text
packages/e2e/playwright.release-gate.config.ts
packages/e2e/tests/visual-novel-release-gate.spec.ts
```

The release-gate config:

- does not start the local Astro dev server;
- requires `VISUAL_GATE_WEB_BASE_URL`;
- runs only the release-gate spec;
- defines `desktop-chromium` using Desktop Chrome;
- defines `mobile-chromium` using Pixel 5;
- retains trace on first retry and screenshots on failure;
- writes a machine-readable JSON or JUnit result in addition to the HTML report;
- uses one worker in CI for deterministic request capture.

Required environment:

```text
VISUAL_GATE_WEB_BASE_URL
VISUAL_GATE_ASSET_BASE_URL
VISUAL_GATE_STORY_ID
VISUAL_GATE_PREVIEW_ID
VISUAL_GATE_RELEASE_ID
VISUAL_GATE_MANIFEST_SHA256
VISUAL_GATE_SCENARIO_PATH
```

### D11 — Verify only the missing cross-system combinations

The suite performs these steps against the deployed preview:

1. Open the scenario's direct non-zero line in visual mode.
2. Capture the requested immutable manifest path and prove it contains the expected release ID.
3. Advance through the declared transition and verify the required background and portrait changes.
4. Switch visual to text and back without changing story, scene, or dialogue index.
5. Change between desktop and mobile viewport dimensions without changing the active line.
6. Open and close dialogue history, preserving focus and position.
7. Create or restore the declared bookmark and return to the exact line.
8. Open the intentionally omitted visual position, prove fallback state, and continue dialogue.
9. Select the declared choice index and verify the expected next scene.
10. Reload the selected story and prove no configured unrelated story module was requested.

Assertions use URLs, reader state attributes, asset request paths, and deterministic data attributes. They do not approve visual aesthetics or compare production screenshots pixel-for-pixel.

The local existing suites remain responsible for broader transition timing, invalid-byte simulations, reduced motion, Safari, and race conditions.

## Workflow and evidence retention

### D12 — Add a dedicated preview-release workflow

Create:

```text
.github/workflows/visual-novel-release-gate.yml
```

It is manually triggered with these required inputs:

- `story_id`;
- `preview_id`;
- `release_id`;
- `manifest_sha256`;
- `candidate_commit_sha`;
- `candidate_report_path`;
- `scenario_path`;
- `manual_review_path`;
- `web_preview_url`;
- `asset_base_url`.

Workflow sequence:

1. Check out the exact candidate commit.
2. Install pinned Bun, Node, and Playwright browser versions.
3. Run `bun run verify:visual-novel-ci`.
4. Parse and validate the retained publisher candidate report.
5. Capture the production pointer before any preview operation.
6. Deep-verify the immutable production candidate through R2.
7. Run public candidate-mode verification against the immutable production candidate path.
8. Mirror the exact candidate manifest into the isolated preview namespace through the existing publisher command.
9. Activate only the preview pointer through the existing conditional activation command.
10. Run active-mode public verification against the preview pointer.
11. Run desktop and mobile Chromium release-gate Playwright flows against the deployed preview.
12. Validate the manual-review record.
13. Capture the production pointer again and prove it is byte-for-byte and ETag-equivalent to the initial snapshot.
14. Assemble the final human-readable summary and `VisualNovelReleaseGateReportV1`.
15. Upload retained evidence and record the artifact ID and digest in the GitHub Actions job summary.

The workflow may mutate only the named preview pointer. It must not publish, activate, roll back, or overwrite production `current.json`.

### D13 — Retain a complete evidence bundle

The uploaded artifact contains:

```text
gate-report.json
summary.md
candidate-publisher-report.json
r2-candidate-verification.json
public-candidate-verification.json
public-active-verification.json
scenario.json
manual-review.json
production-pointer-before.json
production-pointer-after.json
production-pointer-proof.json
playwright-results.json
playwright-report/
test-results/
checksums.txt
```

Every file listed in `gate-report.json` has a SHA-256 evidence reference. The artifact uses the repository's maximum permitted retention up to 90 days. HPA-231 records the workflow run URL, artifact ID, artifact digest, release ID, and manifest checksum in its migration evidence.

## Production activation and smoke

### D14 — Add a read-only activation assertion

Command:

```bash
bun --filter @aquila/infra-cloudflare release-gate assert-activation-ready \
  --report <gate-report.json> \
  --story <story-id> \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --commit <candidate-commit-sha>
```

It validates:

- report schema;
- overall passing status;
- every required check passed;
- exact story, production candidate release, checksum, and commit;
- preview ID and evidence digests are present;
- manual review is approved;
- production pointer proof passed;
- report and referenced evidence checksums match the downloaded artifact.

It performs no network write and cannot call publisher activation.

After this assertion passes, HPA-231 invokes the existing command:

```bash
bun --filter @aquila/infra-cloudflare assets activate \
  --story <story-id> \
  --environment production \
  --release <release-id> \
  --expect-manifest-sha256 <sha256> \
  --confirm-production <story-id> \
  --destination r2
```

The release gate never merges these two operations into one command.

### D15 — Add a non-destructive production smoke command

Command:

```bash
bun --filter @aquila/infra-cloudflare release-gate smoke-production \
  --story <story-id> \
  --release <expected-release-id> \
  --expect-manifest-sha256 <sha256> \
  --asset-base-url <production-asset-domain> \
  --web-base-url <production-web-url> \
  --scenario <scenario.json> \
  --json
```

It checks:

- production `current.json` is available and names the expected release;
- pointer/manifest checksum and release identity are valid;
- representative background and portrait objects decode in a browser;
- pointer revalidation behavior is correct;
- the production reader opens the direct scenario position and advances through the declared transition;
- the command remains read-only.

The smoke command produces a clear success/failure result. HPA-231 owns execution evidence, rollback decisions, and any subsequent reactivation.

## Test ownership matrix

| HPA-216 acceptance area | Existing owner | HPA-233 addition |
| --- | --- | --- |
| Runtime schema, logical keys, paths, pointer integrity | HPA-227 story contract tests | Ownership mapping and composed CI command |
| Exact reader progression across URL, browser, and responsive changes | HPA-234 and HPA-228 tests | Real-preview cross-system flow |
| Visual presentation, portrait slot, transitions, fallback | HPA-228 local reader tests | Representative real-preview path and manual review |
| Public R2 headers, CORS, custom domain, cache behavior | HPA-229 verifier and live browser checks | Parameterized candidate/active verification and retained JSON evidence |
| Immutable publication, idempotency, failed-candidate atomicity | HPA-230 publisher tests | Validate retained candidate report; do not duplicate publisher tests |
| Concurrent pointer protection and rollback | HPA-230 activation/history tests and gated workflow | Map evidence into the parent matrix; require production pointer unchanged during gate |
| Independent story chunks, retry, stale guards | HPA-232 unit and browser tests | Real-preview unrelated-story network assertion |
| Changed images without Vercel rebuild | HPA-230 immutable release and pointer model | Preview candidate/browser proof bound to release ID |
| Prompt/source privacy | HPA-227 schema and HPA-229/HPA-230 verification | Require forbidden-field check in candidate and active public modes |
| Human visual suitability and intentional omissions | No automated owner | `VisualReviewRecordV1` bound to exact release and scenario |
| Production activation authorization | No prior owner | Passing gate report plus read-only activation assertion |
| Post-activation reader health | No prior owner | Non-destructive production smoke command |

The full implementation documentation must expand this table to every individual HPA-216 checkbox and link each row to a concrete test, command, workflow step, or justified manual review.

## Failure simulations

HPA-233 adds fixture or mocked-public-delivery tests for composition behavior that sibling tickets do not own:

- invalid candidate report schema;
- candidate report names another story, release, checksum, or target;
- candidate report shows a pointer write;
- omitted candidate identity appears in the runtime manifest;
- public candidate manifest has invalid bytes or checksum;
- public pointer names the wrong release;
- public cache or CORS policy is wrong;
- public object is absent, has the wrong media type, checksum, byte length, or dimensions;
- browser decode fails despite successful HTTP delivery;
- scenario file is invalid or belongs to another story;
- browser report names another release;
- unrelated story chunk is requested;
- manual review is rejected or mismatched;
- evidence checksum differs from the gate report;
- production pointer before/after proof differs;
- activation assertion receives another commit, release, or checksum;
- production smoke observes another active release.

HPA-230 remains the owner of unchanged-release idempotency, failed-candidate atomicity, conditional pointer conflicts, and rollback target verification. HPA-233 references those tests in its ownership matrix rather than recreating them.

## Security and mutation boundaries

- Ordinary CI receives no Cloudflare credentials.
- Public verification uses unauthenticated HTTPS requests.
- The gated workflow uses the existing scoped R2 publisher credentials only for deep reads, exact preview mirroring, and preview pointer activation.
- Candidate and active public verifiers expose no write methods.
- `assert-activation-ready` and `smoke-production` expose no write methods.
- Production activation requires the existing exact story confirmation.
- Reports sanitize provider errors and never serialize credentials, source paths, prompts, signed URLs, or private metadata.
- URLs stored in diagnostics are limited to public asset and web origins supplied as gate inputs.
- Safe paths and qualified identities are revalidated before inclusion in output.

## Implementation sequence

### Slice 1 — Ownership matrix and schemas

- Add the detailed HPA-216 ownership matrix.
- Implement scenario, manual-review, gate-report, evidence-reference, and diagnostic schemas.
- Add canonicalization and digest helpers.
- Add fixture validation tests.

### Slice 2 — Reusable public verifier

- Extract the current public delivery checks from `src/verify.ts`.
- Add candidate and active modes.
- Parameterize story, target, URLs, release, checksum, and omitted identities.
- Preserve the HPA-229 smoke wrapper.
- Add public failure simulations and JSON reporting.

### Slice 3 — Gate coordinator

- Validate retained candidate reports.
- Compose R2 deep verification, public verification, scenario evidence, browser evidence, manual review, and production pointer proof.
- Emit canonical human and machine reports with stable exit behavior.

### Slice 4 — Cross-system Playwright coverage

- Add the release-gate Playwright config and scenario loader.
- Add the desktop and mobile Chromium release flow.
- Capture manifest/release requests and unrelated story chunks.
- Produce machine-readable browser evidence.

### Slice 5 — CI and retained workflow evidence

- Add `verify:visual-novel-ci`.
- Add the manually triggered preview-release workflow.
- Capture pointer snapshots and prove production is unchanged.
- Upload the complete checksummed evidence bundle.

### Slice 6 — HPA-231 handoff and operations

- Add `assert-activation-ready`.
- Add `smoke-production`.
- Document production activation, artifact verification, failure stages, recovery, and troubleshooting.
- Update HPA-231 references with the exact required gate commands and evidence.

## Validation strategy

The implementation is complete only when all of the following pass:

```bash
bun run compile:check
bun --filter @aquila/stories test
bun --filter web test
bun --filter @aquila/infra-cloudflare test
bun --filter e2e test:e2e tests/reader-visual.spec.ts tests/reader-lazy-loading.spec.ts
bun run verify:visual-novel-ci
```

The gated workflow must also record one successful fixture or controlled preview run proving:

- immutable candidate verification before preview activation;
- exact candidate mirror into an isolated preview;
- preview-only pointer activation;
- public candidate and active verification;
- desktop and mobile reader flow;
- manual review binding;
- production pointer unchanged;
- retained gate report and evidence digest.

## Acceptance summary

HPA-233 is accepted when:

- every HPA-216 criterion has a named automated or justified manual owner;
- ordinary CI is credential-free and fixture-sized;
- one parameterized public verifier supports immutable candidate and active-pointer modes;
- every included object and every omitted identity is verified against retained candidate evidence;
- the real preview reader preserves exact state through transitions, mode changes, responsive changes, history, bookmarks, omissions, choices, and reload;
- unrelated story chunks are absent from the network trace;
- human approval is bound to the exact story, preview, release, checksum, and scenario;
- the final gate report is canonical, checksummed, retained, and machine-consumable;
- preview verification cannot mutate production;
- HPA-231 can assert readiness before activation without rerunning mutable source publication;
- the post-activation smoke command is read-only and returns a deterministic verdict;
- no duplicate manifest, resolver, publisher, or reader-state framework is introduced.
