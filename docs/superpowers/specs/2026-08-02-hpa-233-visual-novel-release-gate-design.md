# HPA-233: Visual Novel Pre-Production Release Check

## Status

Draft design, scoped down. Supersedes the earlier evidence-chain design on this branch.

- Linear issue: HPA-233
- Parent: HPA-216
- Blocks: HPA-231
- Design date: 2026-08-02

## Purpose

Before flipping the production asset pointer for a visual-novel story, answer one question:

> Does this exact release actually work — served from the public CDN, in a real browser, in the deployed reader?

Everything else needed for a safe release already exists: immutable content-addressed publication, deep storage-side candidate verification (`assets verify --release --deep`), atomic pointer activation, release history, and rollback (all HPA-230). HPA-233 fills the two real gaps and stops there.

## The two actual gaps

1. **Public CDN verification is hardcoded.** `packages/infra-cloudflare/src/verify.ts` checks the public delivery host properly — CORS, immutable cache headers, content type, byte checksums, decoded dimensions, forbidden fields — but only for `the_seventh_mirror` at preview ID `smoke`, and only in active mode (via `current.json`). It cannot verify an arbitrary candidate release before that release is pointed at.

2. **Nothing checks the deployed reader.** `assets verify` proves bytes are in the bucket. `verify.ts` proves the CDN serves them. Neither proves the deployed web app resolved *that* release and rendered it. Today there is no way to tell from outside whether a preview deploy is showing the new release, a stale release, or local fixtures.

## Non-goals

Explicitly rejected, with reasons, so they don't get re-proposed:

- **Cryptographic evidence binding** (per-artifact SHA-256, manual-review records, workflow-approval JSON, an `assert-activation-ready` command that re-checks digests). This is a tamper-evidence scheme against an adversary who does not exist — this is a solo repo and the only person who could forge the evidence is the person the evidence is for. GitHub's run log is already the audit trail.
- **Two-phase prepare/finalize.** Running the whole pipeline twice, plus a five-field cache key to partly undo the doubling, buys nothing when one person triggers the release and reads the result.
- **Versioned wire schemas** (`schemaVersion: 1` on eight types, `.strict()` everywhere). These documents are produced and consumed by the same repo at the same commit and live for one workflow run. Plain TypeScript types are enough; there is no boundary to version across.
- **A 15-stage diagnostic enum and stable diagnostic codes.** One person runs this and reads the output. A clear message and a non-zero exit say the same thing.
- **A custom Playwright reporter emitting browser evidence.** The spec asserts release identity directly; Playwright already exits non-zero when an assertion fails. A separate evidence file re-checked by a CLI is a third mechanism for one fact.
- **A `docs/quality/` acceptance matrix** mapping 19 criteria to exact files and commands. It goes stale on the first rename and nobody reads it.
- **A separate `release-gate/` module tree** (11 files) and a compatibility wrapper preserving `verify.ts`'s current interface for callers inside this repo. Change the callers.

If this project ever grows a second maintainer or a compliance requirement, revisit. Not before.

## Design

### 1. Parameterized public CDN verification

Generalize the existing `verify.ts` in place. Same checks, same output style; story, target, and release become inputs instead of constants.

```bash
bun --filter @aquila/infra-cloudflare verify \
  --story the_seventh_mirror \
  --preview-id hpa-233 \
  --release sha256-<digest> \
  --expect-manifest-sha256 <digest> \
  --asset-base-url https://assets.example.dev \
  --json
```

- **Candidate mode** (`--release` given): fetch the immutable manifest at its content-addressed path directly. Never read `current.json` — the point is to verify a release that is not yet active.
- **Active mode** (`--release` omitted): current behaviour. Fetch and validate `current.json`, derive the manifest path, validate the pointer/manifest pair.
- No args: keeps today's `the_seventh_mirror`/`smoke` active-mode defaults, so the HPA-229 smoke invocation and its tests keep working unchanged.
- `--expect-manifest-sha256` is optional but, when given, every boundary compares its own observation against that one value.
- `--json` prints one result object to stdout; human progress goes to stderr.

Exit `0` pass, `1` fail. The existing publisher exit taxonomy stays untouched — this is a different binary path with a different job.

### 2. Deployed-reader release identity

When the visual runtime validates a release, expose what it resolved on the stable `reader-ready` host in `ReaderShell.svelte` (already present at line 351, already used by `packages/e2e/tests/utils.ts`):

```text
data-asset-environment="local|preview|production"
data-asset-preview-id="<preview-id>"     # preview only
data-asset-release-id="<release-id>"
data-asset-manifest-sha256="<sha256>"
```

Attributes live on `ReaderShell`, not on `VisualNovelReader`, because the visual leaf unmounts on text-mode switches and remounts at responsive breakpoints. Identity must survive both.

Lifecycle: absent before the release validates; present once release state is `ready`; cleared when the runtime is disposed or the story/release becomes invalid.

This is the highest value-per-line item in the whole issue — it makes "which release is this page showing?" answerable by eye, permanently, in every environment.

### 3. One deployed-browser spec

`packages/e2e/playwright.release-gate.config.ts`: no `webServer`, requires an HTTPS `BASE_URL`, rejects localhost, Desktop Chromium + Mobile Chromium.

`packages/e2e/tests/visual-novel-deployed.spec.ts`, driven by env (`RELEASE_GATE_STORY_ID`, `RELEASE_GATE_RELEASE_ID`, `RELEASE_GATE_MANIFEST_SHA256`, `RELEASE_GATE_PREVIEW_ID` when preview):

1. Open the story in visual mode at a non-zero position.
2. Wait for visual release state `ready`, then require every expected `data-asset-*` value on `reader-ready`. Missing attributes, local fallback, or a mismatched release is a failure.
3. Advance through a background change and a portrait change.
4. Switch visual↔text: same line, same identity.
5. Resize desktop↔mobile: same line, same identity.
6. Restore a bookmark, take one choice.
7. Exercise one intentionally-omitted asset and confirm graceful fallback.

The same spec serves production by pointing `BASE_URL` at the production origin and omitting `RELEASE_GATE_PREVIEW_ID`; a production run additionally asserts no preview ID is present. No second spec, no separate smoke command.

Reuse the page-side CORS/decode/dimension helpers already in `r2-delivery.spec.ts` by extracting them to `tests/support/`; that spec keeps its current behaviour.

### 4. One release workflow

`.github/workflows/visual-novel-release-gate.yml` — single job, `workflow_dispatch`, inputs: story, release ID, manifest checksum, preview ID, preview URL.

1. Deep-verify the candidate in storage: `assets verify --release --deep`.
2. Mirror and activate the candidate into the isolated preview namespace: existing `assets mirror-preview` + `assets activate`.
3. Public CDN candidate verification (§1) against the preview namespace.
4. Deployed-browser spec (§3) against the preview URL.
5. Print a summary.

Green means go. **You** are the approval — you read the run and decide. Production activation stays a separate manual `assets activate --environment production --confirm-production`, exactly as it works today, followed by rerunning §1 and §3 against production URLs.

The workflow only ever writes to a preview namespace. It cannot touch the production pointer, because it never calls a command that can.

`.github/workflows/r2-publisher-preview.yml` is unchanged; it remains the HPA-230 publisher regression gate.

### 5. Runbook

Add a section to `docs/infrastructure/` covering: qualify a candidate, read the workflow output, activate production, verify production, roll back. Copy-pasteable commands, roughly a page. HPA-231 consumes it.

## HPA-216 acceptance

The deployed spec (§3) covers AC-01, AC-02, AC-04, AC-05, AC-06, AC-07, AC-17 against a real deployment. Public verification (§1) covers AC-03, AC-10, AC-11, AC-12. HPA-230's existing publisher and regression workflow already cover AC-08, AC-09, AC-18, AC-19; HPA-232 covers AC-14 and AC-15; existing unit tests cover AC-16. AC-13 is HPA-231's migration cleanup.

No separate matrix document — this paragraph is the mapping, and it lives next to the design it describes.

## Scope

Four tasks, roughly a day of work:

1. Parameterize public CDN verification.
2. Expose release identity on `ReaderShell`.
3. Remote Playwright config and the deployed spec.
4. Release workflow and runbook.

## Done when

- `verify.ts` verifies an arbitrary candidate release without reading `current.json`, and its no-argument invocation still behaves exactly as before.
- The deployed reader reports which release it resolved, and that identity survives mode switches and responsive swaps.
- The deployed spec fails loudly on a stale release, a wrong preview ID, or local-fixture fallback.
- Remote Playwright cannot start or reach a local server.
- One `workflow_dispatch` run tells you go/no-go, and cannot mutate the production pointer.
- The runbook has copy-pasteable qualify → activate → verify → roll back commands.
