# Visual-novel release-gate operations

This runbook is the operator handoff for the HPA-233 release gate. It adds an
authorization and evidence layer around the existing immutable publisher; it
does not create a second release, pointer, manifest, or rollback contract.
Use the publisher's [immutable asset runbook](./visual-asset-publisher.md) for
its storage semantics and the [trust-boundary document](./visual-novel-release-gate-trust-boundary.md)
for the workflow authority model.

## 1. Ownership and prerequisites

The release manager owns the dispatch identity, evidence retention, and the
separate production-activation decision. The visual reviewer owns the approved
review record; the protected workflow/environment is the authorization
boundary, not a reviewer signature. The publisher owns immutable candidate creation, deep
verification, atomic pointer changes, and rollback. The HPA-216 matrix at
[`docs/quality/hpa-216-visual-asset-acceptance-matrix.md`](../quality/hpa-216-visual-asset-acceptance-matrix.md)
names the runtime test or manual review case for every acceptance criterion.

Before starting, retain the exact lowercase candidate commit SHA, story ID,
release ID, manifest SHA-256, explicit preview ID, publisher-report Actions
run ID/artifact name, public asset base URL, allowed web origin, production web
origin, and canonical scenario path. The candidate must be a verified,
no-activation production release produced by the existing publisher. Never
derive the release ID or checksum from chat text.

The two workflows deliberately have different authority:

- **Visual Novel Release Candidate Entry** in
  [`.github/workflows/visual-novel-release-gate.yml`](../../.github/workflows/visual-novel-release-gate.yml)
  is unprivileged. It can build candidate bytes and make a request; it has no
  protected environment, Vercel/R2 credential, OIDC, or production authority.
- **Visual Novel Release Live** in
  [`.github/workflows/visual-novel-release-live.yml`](../../.github/workflows/visual-novel-release-live.yml)
  is the default-branch `workflow_run` consumer. It validates the hostile entry
  artifact before protected preview work. It never executes candidate source.

Neither gate workflow runs a production activation or rollback, and neither
contains the production confirmation argument. Production mutation remains a
separate, human-authorized publisher invocation after the readiness assertion.

## 2. Explicit preview-ID setup in Vercel

Use a dedicated, credential-free Vercel preview project. It must not be the
production project, and its token must be scoped to that preview project only.
Configure the protected `visual-novel-release-preview` and
`visual-novel-release-approval` environments with the reviewed
`RELEASE_GATE_VERCEL_PREVIEW_*` variables/secrets described in the trust
boundary document; do not put those credentials in repository, organization,
or local `.env` files.

Choose an unguessable, release-specific `preview_id` before dispatch. The
preview build receives only these public delivery values:

```text
PUBLIC_ASSET_BASE_URL=<public HTTPS asset base URL>
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=<explicit preview_id>
```

The Candidate Entry validates the ID and the Live workflow binds it to the
preview pointer, deployment, browser evidence, and final report. Do not let
Vercel infer the ID from a branch name, deployment URL, or a local default.

## 3. Candidate publication with `--no-activate`

Run this only from a reviewed checkout with the HPA-231 release plan and scoped
R2 publisher credentials. It writes immutable candidate objects/manifests but
does not touch `current.json`:

```bash
mkdir -p evidence
REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story "$STORY_ID" \
  --environment production \
  --plan "$REPOSITORY_ROOT/packages/stories/release-plans/the_seventh_mirror.json" \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination r2 \
  --no-activate \
  --json > evidence/publisher-report.json
```

Read `releaseId` and `manifestSha256` from the retained JSON report. Deep
verify the stored candidate with the existing publisher command, and retain the
report as the `publisher-report` evidence referenced by the gate. A candidate
publication is not approval to activate production.

## 4. Prepare dispatch and non-authorizing evidence

From `main`, dispatch **Visual Novel Release Candidate Entry** with
`phase=prepare` and all required inputs. Use the candidate SHA for
`candidate_commit_sha`, the retained publisher run/artifact values for
`publisher_report_run_id`/`publisher_report_artifact`, the exact release
identity, explicit preview ID, asset base URL, allowed preview web base URL,
production web origin, and repository-relative scenario JSON path.

The Candidate Entry uploads only short-lived raw candidate bytes. Wait for its
linked default-branch **Visual Novel Release Live** run. That trusted
`prepare-live` job seals the artifact, deploys the sealed prebuilt output to
the preview project, performs preview-only publisher/public/browser checks,
and retains the evidence artifact. Record the successful **Live** run ID; this
is the later `prepare_run_id`.

A successful entry or prepare run is evidence, not release authorization. It
must not produce a passing final authorization report by itself. If any
identity, artifact digest, preview evidence, or production-pointer proof is
missing, stop and correct the upstream stage rather than creating replacement
evidence locally.

## 5. Human review record template

Review the exact deployment URL returned by the protected preview job, with the
retained scenario and the HPA-216 manual cases. Store a strict JSON record at a
repository-relative path selected for the finalize request. Do not add fields:

```json
{
  "schemaVersion": 1,
  "storyId": "the_seventh_mirror",
  "previewId": "replace-with-explicit-preview-id",
  "releaseId": "replace-with-retained-release-id",
  "manifestSha256": "replace-with-retained-64-hex-digest",
  "scenarioSha256": "replace-with-retained-64-hex-digest",
  "reviewedAt": "2026-08-03T00:00:00.000Z",
  "reviewer": "release-reviewer",
  "decision": "approved",
  "includedCount": 0,
  "omittedCount": 0,
  "representativeRoutes": ["/en/stories/the-seventh-mirror"],
  "notes": [
    "VR-01 desktop composition approved; no clipping or incorrect visual identity.",
    "VR-02 mobile composition approved; placement and responsive layout remain readable.",
    "VR-03 transition and reduced-motion behaviour approved.",
    "VR-04 missing or omitted asset fallback approved.",
    "VR-05 direct-open, choice, bookmark, and progression paths approved."
  ]
}
```

The case IDs are defined in the HPA-216 matrix. Replace every example value
with retained evidence values. A rejected review stays a retained record but
must not be used to request finalization.

## 6. Protected-environment finalize dispatch

After a successful trusted Live prepare run and approved review record, dispatch
**Visual Novel Release Candidate Entry** from `main` again with
`phase=finalize`. Repeat the exact identity inputs, set `prepare_run_id` to the
successful trusted **Live** prepare run ID, and set `manual_review_path` to the
review record path. Do not supply the unprivileged Candidate Entry run ID as
`prepare_run_id`.

The default-branch Live workflow re-downloads the exact entry artifact,
revalidates the request identity, materializes the review record as protected
evidence, and pauses at `visual-novel-release-approval`. Designated environment
approvers review the retained evidence there. The gate still performs no
production pointer mutation.

## 7. Evidence retention and verification

Download and retain the final Live artifact without modifying its JSON files.
Keep it as one evidence directory containing the gate report and every
referenced relative path. Record these values in the release record/PR:

- Candidate Entry and trusted Live run URLs, IDs, attempts, artifact IDs, and
  digests.
- Candidate commit SHA; story ID; preview ID; release ID; manifest SHA-256;
  scenario SHA-256; and manual-review SHA-256.
- Sealed contract digest, Vercel deployment attestation/URL, Tier 1 result,
  publisher/public verification, browser evidence, stage timings, and both
  production-pointer snapshots.

Validate that the artifact contains the exact report path and every referenced
artifact before authorizing production. Do not rebuild a report, recompute a
human review, or replace an evidence file after finalization. A locally
available report is necessary for the next read-only assertion but cannot
substitute for the protected workflow run.

## 8. `assert-activation-ready`

Run the assertion from the retained artifact's repository-root layout, so the
safe relative report path resolves beside its referenced evidence. It is
structurally read-only: it rehashes the exact referenced evidence, validates
the final report, manual review, protected workflow approval, preview web
identity, and unchanged production-pointer proof. It has no publisher/R2
activation or pointer-write dependency.

```bash
bun --filter @aquila/infra-cloudflare assets release-gate assert-activation-ready \
  --report evidence/gate-report.json \
  --story "$STORY_ID" \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --commit-sha "$CANDIDATE_COMMIT_SHA" \
  --json
```

Only `{ "status": "passed" }` authorizes proceeding to the separate
production activation command. Any non-zero result is a stop condition; retain
the output and repair the named upstream evidence or rerun the protected gate.

## 9. Existing atomic production activation command

After the assertion passes and an authorized release manager explicitly decides
to release, use the existing publisher's source-independent atomic activation.
This is deliberately outside both gate workflows:

```bash
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story "$STORY_ID" \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production "$STORY_ID" \
  --destination r2 \
  --json > evidence/production-activate-report.json
```

The existing publisher rereads and deep-verifies the immutable candidate, then
uses its conditional pointer contract. It does not re-encode content. Keep the
activation report alongside the final gate evidence.

## 10. Production smoke

Run the remote production Playwright smoke with `RELEASE_GATE_TARGET=production`
against the configured production HTTPS origin. The release-gate Playwright
configuration rejects local hosts, rejects preview as production, and records
production identity, representative image decoding, progression, and no
mutating browser requests. Retain the produced `production-smoke` browser
evidence in the final evidence directory.

Then run the read-only coordinator:

```bash
export AQUILA_PRODUCTION_WEB_ORIGIN="$PRODUCTION_WEB_ORIGIN"
bun --filter @aquila/infra-cloudflare assets release-gate smoke-production \
  --story "$STORY_ID" \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --asset-base-url "$ASSET_BASE_URL" \
  --web-base-url "$PRODUCTION_WEB_ORIGIN" \
  --browser-evidence evidence/production-smoke.json \
  --json
```

The command reads the public active pointer/manifest/object checks and the
structured browser evidence. It rejects a caller-supplied active release,
preview/local targets, stale release IDs, stale checksums, or pointer
revalidation failure. It does not invoke publisher mutation.

## 11. Rollback decision using existing verified-release rollback

Do not roll back for a failed pre-activation assertion; production was not
changed. After an activation, roll back when production smoke finds a wrong
release/checksum, stale pointer, unreadable required object, wrong web identity,
or failed reader progression, unless an incident commander determines the
evidence is false and records that decision.

First identify the previously verified release and its retained manifest digest
from the existing publisher evidence. Then invoke the existing source-independent
rollback; it writes a new monotonic pointer through the same CAS contract:

```bash
bun --filter @aquila/infra-cloudflare assets -- rollback \
  --story "$STORY_ID" \
  --environment production \
  --release "$PREVIOUS_RELEASE_ID" \
  --expect-manifest-sha256 "$PREVIOUS_MANIFEST_SHA256" \
  --confirm-production "$STORY_ID" \
  --destination r2 \
  --json > evidence/production-rollback-report.json
```

Retain the smoke failure, rollback report, previous-release verification, and
post-rollback public verification. Do not manually write `current.json`, copy
an old pointer body, or use an unverified release as a rollback target.

## 12. Troubleshooting keyed by `GateStageV1` and diagnostic code

| Stage                                             | Typical diagnostic code                                           | Safe response                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `input`                                           | `input/identity`, `input/url`                                     | Correct the retained scalar or HTTPS origin; do not rewrite evidence.                                 |
| `ci`                                              | `ci/tier1-failed`                                                 | Reproduce/fix the candidate and restart prepare with a new identity if bytes changed.                 |
| `publisher-candidate` / `r2-candidate`            | `publisher-candidate/*`, `r2-candidate/*`                         | Repair the existing candidate publication/verification evidence; keep production inactive.            |
| `public-object` / `manifest` / `pointer`          | `public-verification/*`                                           | Investigate delivery/cache/object evidence and rerun protected preview verification.                  |
| `web-identity` / `browser-decode` / `reader-flow` | `web-identity/*`, `browser/*`                                     | Check the sealed deployment binding and scenario; do not use a local server as a substitute.          |
| `manual-review` / `workflow-approval`             | `evidence-binding/manual-review-*`, `workflow-approval/untrusted` | Obtain a new protected finalization and strict approved record; a path alone is not approval.         |
| `evidence-binding`                                | `evidence-binding/digest-mismatch`                                | Treat the retained artifact as tampered/incomplete and rerun the protected gate.                      |
| `production-pointer-proof`                        | `production-pointer-proof/mismatch`                               | Stop before activation; investigate the external pointer change and begin a fresh gate.               |
| `post-activation-smoke`                           | `post-activation-smoke/release-mismatch`                          | Declare a production incident, retain evidence, and use the verified-release rollback decision above. |

Use the JSON diagnostic's `code`, `stage`, and exact identity fields as the
incident key. Never turn a failing result into a pass by editing a report or
loosening an expected identity.

## 13. Weaker maintainer-only fallback when protected environments are unavailable

This fallback is weaker and must be recorded as such; it is not equivalent to
the protected-environment gate. Use it only when GitHub protected environments
are unavailable and an incident/release owner explicitly accepts the reduced
assurance. Two designated maintainers must independently review the exact
candidate identity, preview URL, publisher/public evidence, manual cases, and
production-pointer snapshots. Preserve their names, UTC timestamps, and the
reason protected environments were unavailable in the release record.

The fallback still requires immutable publisher evidence, the read-only
activation assertion, the existing atomic publisher command, and production
smoke. It must not move credentials into the Candidate Entry workflow, add
production mutation to either gate workflow, fabricate a workflow-approval
record, or treat local/browser mocks as production proof. Restore the protected
environment path before the next routine release.
