# HPA-233 final-review fix report

Final review wave: 5 Important findings (P1 #1, P1 #2, P2 #3, P2 #4, P2 #5).
All five fixed in one dispatch. Branch: `agent/hpa-233-release-gate-design`.

## P1 #1 — First storage verify targeted the wrong namespace (workflow + runbook)

**Changed:**
- `.github/workflows/visual-novel-release-gate.yml` (Verify release in deep storage step, lines 82-110): the step now verifies the release WHERE it was published — the PRODUCTION namespace — via `assets verify --story … --environment production --release … --expect-manifest-sha256 … --destination r2 --deep --json` (no `--preview-id`). Rationale: the candidate is created with `--no-activate` in production; `mirror-preview` has not run yet, so a fresh gate run has nothing to verify in preview at step 1.
- Read-only confirmation: publisher `cli.ts` `verify` handler (case 'verify', cli.ts:729) calls only `verifyStoredRelease` (candidate-verifier.ts:387), which performs only `store.read` (candidate-verifier.ts:106) — no `createImmutable`/pointer writes. `assertProductionMutationConfirmation` applies only to `activate`/`rollback` (cli.ts:478-480), so `verify --environment production` needs no `--confirm-production`. The `verify` command moves no pointer.
- Workflow comments (storage-verify step + preview activate step, lines 82-97, 126-129) and runbook `docs/infrastructure/visual-novel-release-gate.md` (intro, lines 7-20; §2, lines ~76-81) now describe the REAL invariant: the production-safety invariant is about pointer-MOVING commands (`publish`/`activate`/`rollback` targeting production), not about the literal string `--environment production`; `verify --environment production` is read-only and does not weaken it. The workflow's only pointer move is the preview `activate`.

**Safety grep re-run (pointer-moving commands):**
```
$ rg -nE "cli\.ts (publish|activate|rollback|verify|mirror-preview)" .github/workflows/visual-novel-release-gate.yml
103: bun packages/infra-cloudflare/src/publisher/cli.ts verify \
118: bun packages/infra-cloudflare/src/publisher/cli.ts mirror-preview \
135: bun packages/infra-cloudflare/src/publisher/cli.ts activate \
```
`--confirm-production` / `rollback` appear only in workflow COMMENTS and in runbook manual §4/§6; `--environment production` appears exactly once, in the read-only `verify` step (line 105). No pointer-moving production command exists in the workflow.

**Covering check:** workflow YAML parsed by `python3 yaml.safe_load` (OK, 13 steps); runbook re-read.

**Live verifiability:** the first gate run after this change (with real R2 credentials) is the live proof that `verify --environment production` finds the `--no-activate` candidate; not run here (no credentials/release in this session).

## P1 #2 — Step-7 interception raced the reader's prefetch (deployed spec)

**Changed:** `packages/e2e/tests/visual-novel-deployed.spec.ts` step 7 (lines 560-640):
- (a) ALL variant routes (webp + optional avif) are installed via `page.route` BEFORE `page.goto()` of the step-7 navigation; `page.unroute` happens only at the end of the step. `warmWithinScene` (visual-state-controller.ts:708-739) prefetches the next distinct visual DURING navigation, so routes installed after `waitForVisualReady` could be bypassed by a fast CDN that populated the decoded cache.
- (b) Interception counter `blockedRequests` incremented in the route handler; `expect(blockedRequests).toBeGreaterThanOrEqual(1)` after the fallback assertions — the step fails loudly if the reader never asked for the blocked asset (routes never matched ⇒ step asserted nothing).
- (c) Wording corrected: the step exercises FORCED DELIVERY FAILURE of a covered asset (`requireCovered` guarantees the asset exists in the manifest), NOT a "genuine omission". `blockedEntry` is required (throws "Assertion bug" if absent, since requireCovered already proved coverage). File header comment updated likewise.

**Covering check:** `bun x tsc --noEmit -p packages/e2e/tsconfig.json` — no errors in `visual-novel-deployed.spec.ts` or `playwright.release-gate.config.ts` (pre-existing errors in other spec files and `stories/src/runtime-assets` are unrelated). Logic verified by inspection: route patterns are `**/<content-addressed object path>`, unique per variant; the initial load at `backgroundPage - 1` resolves the PRIOR background (not intercepted), while both the navigation-time prefetch and the click-driven load of `backgroundAfter` hit the 404 routes, so `blockedRequests >= 1` is guaranteed and the fallback banner is deterministically reachable.

**Live verifiability:** NOT live-verified — requires a full published release + deployed preview reader (workflow run). Verification by inspection + typecheck only, as stated in the brief.

## P2 #3 — Active mode ignored the caller-supplied expected manifest checksum

**Changed:** `packages/infra-cloudflare/src/verify.ts` `runActiveChecks` (lines 619-640): when `input.expectedManifestSha256` is supplied, the pointer's observed `manifestSha256` is compared against it — a new check `pointer manifestSha256 matches expected`; on disagreement the run fails with `CheckAborted('pointer manifestSha256', …)` BEFORE the manifest bytes are validated against the pointer. When not supplied, behaviour is byte-identical to before (pointer digest remains the reference).

**Covering check:** new regression test in `verify.test.ts` (`fails an active-mode run whose pointer disagrees with --expect-manifest-sha256`, verifyPublicRelease describe) — valid pointer/manifest pair + MISMATCHED `expectedManifestSha256` ⇒ `status: 'failed'`, check row `false`, manifest never fetched (dependent checks skipped). Ran `bun --filter @aquila/infra-cloudflare test src/__tests__/verify.test.ts`: **40/40 passed** (incl. all 3 new tests).

**Live verifiability:** fully covered by unit tests (fetch is faked); no live infra needed.

## P2 #4 — `--json` produced no JSON for setup failures

**Changed:** `packages/infra-cloudflare/src/verify.ts` `main()` (lines 1208-1328): all setup phases now have a structured failure path. Raw argv is scanned for `--json` (so even a PARSE failure emits JSON), config loading is caught, and URL construction/verification is wrapped in one try/catch — every failure path emits exactly ONE `{"status":"failed",…}` object to stdout (with `error` detail, plus storyId/target/releaseId/baseUrl where already known) and exits 1; human detail goes to stderr. Non-`--json` output is byte-identical to the pre-parameterization verifier (`verify: <msg>` for parse/config errors, `Verification could not run: <msg>` for everything else).

**Covering check:** new subprocess tests (`verify CLI --json setup failures` describe, execFile `bun packages/infra-cloudflare/src/verify.ts`): bad `--environment bogus` and non-HTTPS `--asset-base-url` with `--json` each exit 1 with stdout being exactly one parseable JSON object with `status: "failed"`. verify.test.ts run: **40/40 passed**; full package: `bun --filter @aquila/infra-cloudflare test` **406/406 passed** (29 files).

**Live verifiability:** fully covered by subprocess tests (real CLI, real stdout capture).

## P2 #5 — Remote-only URL validation accepted local/credential-bearing URLs

**Changed:** `packages/e2e/playwright.release-gate.config.ts` `resolveBaseUrl` (lines 28-65): rejects non-empty `url.username`/`url.password` (credential-bearing — `url.origin` silently strips credentials while the raw input is echoed in error messages); rejects the full loopback/unspecified range — `127.0.0.0/8` via `/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/`, `0.0.0.0`, `[::1]`, `[::]`, plus the existing `localhost`/`*.localhost`. Header comment updated.

**Covering check (config load, packages/e2e):**
```
https://127.0.0.2       => REJECTED (deployed origin)
https://0.0.0.0         => REJECTED (deployed origin)
https://user:pass@example.com => REJECTED (credentials)
https://[::1]           => REJECTED (deployed origin)
https://[::]            => REJECTED (deployed origin)
https://127.0.0.1       => REJECTED (deployed origin)
https://foo.localhost   => REJECTED (deployed origin)
https://10.0.0.1        => ACCEPTED (private, not loopback — per brief)
https://example.com     => ACCEPTED
```
`r2-delivery.spec.ts` and `tests/support/r2-browser-probe.ts` untouched (r2-delivery unchanged; git diff confirms).

**Live verifiability:** fully verified locally at config load; no live infra needed.

## Global verification

- `bun --filter @aquila/infra-cloudflare test src/__tests__/verify.test.ts` → 40/40 passed (3 new tests)
- `bun --filter @aquila/infra-cloudflare test` (full package) → 406/406 passed (29 files)
- `bun run lint` → 4/4 tasks successful
- `bun run compile:check` → exited 0 (generated story output in sync)
- Workflow YAML parsed clean; refined production-safety grep reported above
- e2e typecheck: no errors in the two touched e2e files
