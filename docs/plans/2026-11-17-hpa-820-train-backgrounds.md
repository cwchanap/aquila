# HPA-820 — Restore the “Stay on the train” route backgrounds

**Status:** Proposed design specification and implementation plan. This is the **single draft PR for HPA-820**: implement, validate, and record release evidence on this branch. Do **not** create another PR for implementation.

- Linear: https://linear.app/cwchanap/issue/HPA-820/stay-on-the-train-branch-renders-with-no-background-image-flat-navy
- Repository baseline reviewed: `main` at `bbf3e079f94bc0a53e816f12a9d453039b1ee469` (2026-11-17).
- Related but **not in scope**: HPA-819 (English translation absent on the other branch), HPA-821 (reader UX issues).

## User-visible problem and goal

After choosing **Stay on the train** in *The Platform at the End of the World*, the visual reader shows a flat navy background throughout `b1b_act4`–`b1b_act7`. Restore the intended illustrated scenes while keeping dialogue, routing, progress, and reading modes unchanged.

Success means the deployed, signed-out English reader can enter the branch and display/decode the authored backgrounds at representative beats in each affected act, with automated browser screenshots as evidence. The reader must stay usable if any subsequent individual image fails.

## Verified repository facts versus unresolved production hypothesis

| Seam | Observed on reviewed main | Implication |
| --- | --- | --- |
| Story source | `packages/stories/raw/trainAdventure/branch_1b/act4.md`–`act7.md` contain named `bg` blocks and cross-scene `reuse` directives | The intended backgrounds already have logical keys in the authored story. |
| Source art | `packages/assets/media/train_adventure/backgrounds/branch_1b/` has checked-in PNGs for these acts; additional reused images live in `_root/` and `branch_1a/` | **No image generation or new art task** is required unless an audit proves a specific source is actually missing. |
| Recent changes | The branch-art directory was updated on 2026-11-14 and 2026-11-15 | A production visual release older than these assets is a plausible cause, **not yet proven**. |
| Compiler | `packages/stories/src/compiler/parse-scene.ts` applies cues/reuses; compiled outputs are generated and gitignored | Regenerate with `bun compile:stories`; never edit generated files directly. |
| Publisher | `docs/infrastructure/visual-asset-publisher.md`: the publisher includes available source images, silently omits ones lacking source files, and activates via the `current.json` pointer | Compare the **active production manifest**, generated inventory, and actual source files before touching code or production. |
| Web resolver | `apps/web/src/lib/visual-assets/source-factory.ts` forces stories in `PRODUCTION_VISUAL_STORY_IDS`, including `train_adventure`, to the **production** namespace even in Vercel previews | A normal preview deployment cannot be assumed to render a preview-pointer candidate. Do not weaken this contract as part of this fix. |
| UI | `VisualStateController` and `VisualNovelReader.svelte` display a navy background when no decoded background is ready; the latter exposes `data-bg-state` | Determine whether the failure is missing manifest coverage, object HTTP/decode failure, or an actual resolver bug. |

**Unverified at planning time:** the live `vn/stories/train_adventure/current.json` pointer, active manifest contents, public object responses, and currently deployed reader behavior. Do **not** label the cause “stale release” or the bug “fixed” without those checks.

### Branch-specific inventory to validate

Compiling the raw source must preserve the scene IDs `b1b_act4` through `b1b_act7`. The asset audit must include all background keys referenced by these scenes, not just assets created inside each scene.

Representative required keys:

- Act 4: `_root/act3_s4`, `branch_1a/b1a_act4_lijie_stands`, `branch_1b/b1b_act4_empty_car`, `branch_1b/b1b_act4_figure`, `branch_1b/b1b_act4_doors_locked`.
- Act 5: `branch_1b/b1b_act5_half_empty`, `branch_1b/b1b_act5_ito_explain`, `branch_1b/b1b_act5_relief`, `branch_1b/b1b_act5_lijie_sea`, plus the Act 4 reuse.
- Act 6: `branch_1b/b1b_act6_yomi_arrival`, `branch_1b/b1b_act6_breakdown`, `branch_1b/b1b_act6_lijie_steps_out`, plus earlier reused backgrounds.
- Act 7: `branch_1b/b1b_act7_carriage_fight`, `branch_1b/b1b_act7_platform`, `branch_1b/b1b_act7_hall`, `branch_1b/b1b_act7_map`, and the other named Act 7 cues/reuses.

Use compiled story dialogue and the publisher's generated inventory for the **complete** set, rather than maintaining this representative list as a second source of truth.

## Design decision: diagnose first, fix the smallest failing layer

1. **Read-only baseline.** Build the current story; inspect the generated `image-assets.json`, source PNG availability, and published active `train_adventure` production pointer/manifest. Collect one failing reader trace with `data-asset-*` release identity, `data-visual-release-state`, `data-bg-state`, network HTTP status/CORS, decode outcome, and the scene/line/background key. Compare with a functioning Act 3 background.
2. **Missing or older release entries:** use the existing immutable publisher to create a **candidate only**, verify exact coverage and public availability, then activate via the existing production pointer command. No code/schema changes or new asset pipeline.
3. **Active entry present but public object unavailable/undecodable:** use existing publisher verifier and CDN/browser diagnostics to correct publication/object delivery; do not hide a broken image behind a fake placeholder.
4. **Entry and object valid, browser still fails:** reproduce with a focused `WebAssetResolver` / `VisualStateController` test, then patch only the broken resolution/cache/decode behavior. Retain existing graceful fallback and never replace the whole visual system.
5. **Already resolved in production:** keep this PR limited to the automated regression check and verified evidence; do not force a pointless re-publication.

Do not change story content, art prompts, animation, reader UX, translation files, runtime schema, deploy environments, or all-story asset loading. No backward-compatibility shim, generic release-monitoring service, or new test device infrastructure.

## Implementation sequence (one PR)

### 1. Reproduce and identify the missing boundary

- Rebase against latest `main` before implementation; run `bun install` and `bun compile:stories`.
- From the current `train_adventure` generated dialogue, enumerate the distinct background logical keys used in `b1b_act4`–`b1b_act7` (including inherited/reused keys). Check generated authoring manifest entries and matching `packages/assets/media/train_adventure/backgrounds/<key>.png` source paths.
- Retrieve the **active production** pointer and manifest using the existing `@aquila/infra-cloudflare verify` CLI or browser CDN probe. Compare its `background:<key>` entries and asset variants to that generated inventory. Record release ID, manifest hash, missing keys, HTTP status, CORS and decode results. Do not infer readiness from files merely existing in Git.
- Capture a Playwright MCP reproduction screenshot for a **unique branch_1b cue** inside Act 4 (not just its opening line, which reuses Act 3 art) and another inside Act 7.

### 2. Repair publication if the active release lacks coverage

Reuse `docs/infrastructure/visual-asset-publisher.md` with `--story train_adventure`, not the runbook's `the_seventh_mirror` example. Keep R2 credentials outside logs and PR contents.

~~~bash
REPOSITORY_ROOT=$(pwd)
mkdir -p .tmp

# Read-only report; inspect included/omitted counts and required keys.
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story train_adventure --environment production \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination r2 --json > .tmp/hpa-820-plan.json

# Immutable candidate, NO production pointer change.
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story train_adventure --environment production \
  --source-root "$REPOSITORY_ROOT/packages/assets/media" \
  --destination r2 --no-activate --json > .tmp/hpa-820-candidate.json
~~~

- Read `releaseId` and `manifestSha256` from the JSON report (do not construct them from filenames). Check the candidate manifest covers **all** compiled keys referenced by Acts 4–7 and its omitted list contains none of them. A successful CLI exit alone is not sufficient.
- Run the existing deep candidate `assets verify --environment production --release ... --expect-manifest-sha256 ... --destination r2 --deep`, followed by the **public read-only verifier** pinned to that candidate (see release-gate runbook). Assert object responses can be fetched and image formats decoded.
- The generic preview-gate workflow cannot, by itself, prove this train story's **reader** is using a candidate preview release: `source-factory.ts` forces its source to production. Avoid adding an environment override or implying the preview reader used a candidate when it did not.
- Only after the candidate passes read-only verification, use `assets activate --story train_adventure --environment production --release ... --expect-manifest-sha256 ... --confirm-production train_adventure --destination r2`. Retain the **previous** production release ID/hash so `assets rollback` can restore it if the deployed E2E fails.
- If the plan indicates existing active production already contains every image and each decodes, **skip** publish/activate and follow the resolver diagnosis instead.

### 3. Add narrowly scoped automated regression coverage

- Prefer a dedicated deployed-only Playwright spec under `packages/e2e/tests/`, wired into the existing `playwright.release-gate.config.ts` and excluded from the default local suite. Reuse `ReaderPage`, `openCrossroads` / `chooseRoute`, deployed auth bypass setup, and existing release identity assertions; don't create another Playwright runner or framework.
- Test a signed-out English reader: deep-link to the end of `act3`, open Crossroads, select “Stay on the train,” and assert the destination is `b1b_act4`. Progress to its first **new** `branch_1b` background cue.
- For each `b1b_act4`, `b1b_act5`, `b1b_act6` and `b1b_act7`, locate a dialogue index with a **distinct named `branch_1b` background** using compiled dialogue (not brittle fixed page numbers). Visit that canonical URL in visual mode, wait for `[data-bg-layer="active"][data-bg-state="ready"]`, and assert the displayed image decodes (nonzero `naturalWidth`/`naturalHeight`), has a real object URL, and no visual-unavailable message.
- Assert the reader reports the expected **production** release ID/hash. Use Playwright MCP to drive the end-to-end deployed browser flow and collect screenshots at one chosen beat in **each affected act**, along with a root/Act 3 reference frame; automatically review screenshots for actual illustrated image coverage rather than a flat navy field. No Linear UI mock-up was supplied, so these screenshots are the visual evidence.
- Include a targeted failure-path assertion that a 404 on one image still permits advancing dialogue. Reuse the existing fallback test seams rather than recreating a complete fallback matrix.
- Run the deployed test against **production only after activation**, and record the actual MCP run + screenshots in this same PR. If it fails, use the existing pointer-only rollback, investigate, and retry on this branch. Do not claim a preview run covered this production-only story.

### 4. Validate and finish in the same PR

- For a **release-only fix**, record candidate/active manifest comparison, existing publisher/deep/public verifier results, and deployed Playwright MCP screenshots; do not add unrelated code.
- If a resolver code fix is necessary, add focused Vitest regression coverage and run `bun --filter web test`, `bun --filter web lint`, `bun --filter web build`, plus the relevant Playwright suite.
- Add results, new release ID/hash and pre-activation rollback identity (non-secret) to PR evidence. All review changes stay in this PR. No separate implementation PR.

## End-to-end acceptance criteria (automated, no human sign-off)

- [ ] An executable inventory check shows **every** background key referenced by `b1b_act4`–`b1b_act7`, including cross-branch reuses, is present in the active production manifest with a valid public/decodeable asset; no required key appears in the publisher's omitted set.
- [ ] A read-only public manifest/object check confirms the live `train_adventure` pointer and checksum match the release the browser reports. Before any production activation, the candidate passes deep R2 verification and public CDN verification. If no activation is needed, document the evidence instead.
- [ ] **Playwright MCP E2E** on the deployed signed-out English reader selects “Stay on the train” from the first Crossroads and reaches `b1b_act4` without losing canonical URL/reading progress.
- [ ] **Playwright MCP E2E** deep-links to one **new** `branch_1b` visual cue in each of Acts 4, 5, 6, and 7; each active image reaches `ready`, decodes with positive dimensions, and shows no visual-unavailable warning.
- [ ] **Automated visual screenshot check:** capture all four branch images plus an Act 3 reference, inspect screenshots via MCP for genuinely rendered scene artwork rather than a flat navy background, and attach screenshot evidence to the PR. No mock-up exists for this defect; no human acceptance step.
- [ ] A forced single-image failure does not block reader progression; existing fallback regression remains green.
- [ ] Relevant unit/lint/build checks pass **if implementation changes code**. Run the existing deployed-specific test configuration separately; ordinary local CI does not prove R2 production delivery.
- [ ] If an activation was needed, the production pointer is the verified release and the deployed E2E passes. On failure, pointer-only rollback to the retained previous release is executed and verified; the task is **not** marked complete.

One platform (desktop Chromium) provides sufficient automated acceptance because no platform-specific behavior is being changed. No new artwork or SFX and no additional PRs are part of this ticket.

## Risks and non-goals

- **Publishing is not automatic:** a committed PNG does not imply it is in the current production manifest. Always check the pointer.
- **Wrong preview target:** training this test against a Vercel preview is insufficient for `train_adventure` because it still resolves the production R2 pointer. Verify the actual active release identity.
- **False-positive first frame:** `b1b_act4` begins with a reused Act 3 background. Test later named cues to distinguish an incomplete branch release from a working root image.
- **Large scope creep:** translation gaps (HPA-819), remaining reader friction (HPA-821), other branch artwork, and generic monitoring are separate concerns.
- **Operational failure:** immutable objects are not deleted on failure; retain previous pointer identity and use existing rollback, without writing to the production pointer until read-only candidate verification is complete.
