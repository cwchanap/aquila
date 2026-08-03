# HPA-233 Release Gate Design Addendum

## Status and precedence

**Status:** Normative clarification for PR #44 before implementation planning.

This addendum supplements `2026-08-02-hpa-233-visual-novel-release-gate-design.md`. Where this document is more specific, it takes precedence. It closes the deployed-web, Playwright, project-membership, and human-approval ambiguities found during the second design review.

## Review verdict

All five Important comments are valid for the current repository:

- the deployed web application bakes `PUBLIC_ASSET_*` configuration at build time;
- the current visual-reader DOM exposes release state but not release identity;
- the default Playwright configuration always starts the local web server;
- current mobile project matching excludes the proposed release-gate filename and excludes lazy-loading;
- `VisualReviewRecordV1.reviewer` is free text and is not an authentication mechanism.

The implementation plan must include the requirements below before Slice 4 or Slice 5 begins.

## A1 — Bind the deployed web application to the gate preview

`--preview-id` and `--web-base-url` are one deployment identity, not independent inputs.

The Vercel preview used by the gate must be built with:

```text
PUBLIC_ASSET_ENVIRONMENT=preview
PUBLIC_ASSET_PREVIEW_ID=<the exact gate preview id>
```

The preview ID must be explicit and branch-scoped so concurrent Vercel previews cannot race on one R2 namespace.

Before reader-flow evidence may pass, browser verification must prove that the deployed application reports:

```text
data-deployment-environment="preview"
data-asset-environment="preview"
data-asset-preview-id="<gate preview id>"
data-asset-release-id="<expected release id>"
data-asset-manifest-sha256="<expected manifest checksum>"
```

It must also record that pointer and manifest requests use the expected preview namespace and immutable release path.

The following are fatal `evidence-binding` failures:

- the deployed application reports `local` or `production` asset mode;
- the deployment environment is not `preview`;
- the preview ID differs from the workflow input;
- the release ID or manifest checksum differs;
- the browser reads local fixture paths instead of the public asset domain.

Production smoke applies the inverse rule: deployment and asset environment must both be `production`, no preview ID may be present, and release/checksum must match the expected production identity.

## A2 — Add a minimal web release-observability contract

The current `VisualSnapshot` carries only release state. HPA-233 therefore owns a small `apps/web` observability addition.

When a visual release has been validated, the visual reader root exposes these non-secret attributes:

```text
data-deployment-environment="local|preview|production"
data-asset-environment="local|preview|production"
data-asset-preview-id="<preview id>"         # preview only
data-asset-release-id="<release id>"
data-asset-manifest-sha256="<sha256>"
```

Ownership and source of values:

- deployment environment comes from validated build-time deployment configuration;
- asset environment and preview ID come from the validated `AssetResolverSource`;
- release ID and manifest checksum come from the validated pointer/manifest result already used by the resolver.

The attributes remain absent until identity validation succeeds. They contain no credentials, source paths, prompts, private bucket names, or signed URLs.

DOM identity is the primary deterministic browser assertion. Observed pointer/manifest request paths are retained as defense-in-depth evidence.

Slice 4 may extend the visual snapshot/controller boundary only as needed to carry this validated identity.

## A3 — Use a dedicated remote Playwright configuration

Add:

```text
packages/e2e/playwright.release-gate.config.ts
```

It is used by Tier 2 preview verification and production smoke browser checks. It must:

- contain no `webServer` entry;
- never start `bun run dev`;
- require an absolute HTTPS `BASE_URL`;
- reject localhost and the local fixture origin;
- receive the expected target class, `preview` or `production`;
- define exactly Desktop Chromium and Mobile Chromium projects;
- explicitly match `visual-novel-release-gate.spec.ts` and any separate production-smoke spec;
- use the structured release-gate reporter in addition to normal failure traces/screenshots.

The remote test process does not set `PUBLIC_ASSET_*`. Those values must already be baked into the deployed application and are verified through the observability attributes.

Tier 1 and ordinary E2E continue using the existing `playwright.config.ts` and local `webServer`.

## A4 — Make Playwright project membership explicit

The bounded Tier 1 command is split to match current project membership:

```bash
bun --filter e2e test:e2e \
  tests/reader-visual.spec.ts \
  --project=chromium \
  --project=mobile-chrome

bun --filter e2e test:e2e \
  tests/reader-lazy-loading.spec.ts \
  --project=chromium
```

`reader-lazy-loading.spec.ts` remains Chromium-only unless mobile coverage is deliberately added later.

The dedicated remote configuration explicitly includes the release-gate spec in both Desktop Chromium and Mobile Chromium. Mobile Safari remains owned by the ordinary full E2E workflow.

The aggregate `verify:visual-novel-ci` command is used locally and by gate preparation/finalization. Its constituent tests continue to run in existing PR CI; it is not added as a second duplicate all-PR workflow.

## A5 — Define the manual-review trust model

`VisualReviewRecordV1` is release-bound evidence, not a cryptographic signature.

The free-text `reviewer` field is descriptive. It is never treated as the authorization principal.

Operational authorization comes from workflow controls:

- `prepare` may run with normal repository workflow permissions and cannot emit production authorization;
- `finalize` runs in a protected GitHub Environment named `visual-novel-release-approval`, or an equivalent protected environment;
- required environment reviewer approval is applied to `finalize`;
- only repository maintainers may dispatch or approve finalization under repository policy;
- final evidence records workflow actor, run ID, environment name, and approval context separately from the review JSON.

The gate validates review content, release identity, and digest. GitHub workflow/environment controls establish who was allowed to finalize.

If protected environments are unavailable under repository plan capabilities, the runbook must document the weaker maintainer-only control. The implementation must not describe the JSON record as authenticated or signed.

The final report adds required checks and evidence for:

```text
webIdentity
workflowApproval
```

and accepts evidence kinds equivalent to:

```text
web-identity
workflow-approval
```

A passing report requires both checks.

## A6 — Browser flow and locale scope

The release-gate browser flow must:

1. Open the scenario's non-zero direct route under its configured locale.
2. Verify deployment, asset, preview, release, and checksum identity.
3. Verify expected pointer/manifest request paths.
4. Exercise background and portrait transition.
5. Preserve the exact line through visual/text mode changes.
6. Preserve the exact line through desktop/mobile layout changes.
7. Open and close history with focus restoration.
8. Restore a bookmark.
9. Exercise intentional omission or unavailable-asset fallback.
10. Select a deterministic choice.
11. Reload, prove unrelated story chunks were not requested, and preserve the configured locale in the canonical URL.

HPA-233 does not need a locale-switch interaction. Cross-locale routing remains owned by HPA-234 and ordinary E2E. The HPA-216 AC-06 matrix row must state this boundary explicitly.

## A7 — Expected checksum requirements

The reusable public verifier may allow `expectedManifestSha256` to be omitted for compatibility use.

It is mandatory for:

- authorizing preview-gate execution;
- final gate aggregation;
- `assert-activation-ready`;
- production smoke.

The command parses one expected checksum and passes that same typed value to every verification boundary. Each boundary independently computes or reads the observed checksum and compares it with that value.

## A8 — Prepare/finalize workflow requirements

The HPA-233 workflow remains two-phase.

### Prepare

- runs bounded Tier 1;
- validates retained publisher evidence;
- deep-verifies the immutable candidate through R2;
- publicly verifies candidate mode;
- mirrors and activates only the isolated preview pointer;
- publicly verifies active preview mode;
- runs remote web-identity preflight;
- runs Desktop and Mobile Chromium release flows;
- proves the production pointer is unchanged;
- emits non-authorizing evidence for human review.

### Finalize

- requires the same commit, story, preview, release, checksum, and scenario identity;
- requires protected-environment approval evidence;
- reruns bounded live checks, including remote identity preflight;
- validates the completed manual-review record;
- proves the production pointer is unchanged;
- emits the final authorizing report.

Prepare cannot emit a passing final report.

## A9 — Runtime and timeout budget

Running live qualification in both phases is intentional.

Slice 5 must measure:

- bounded Tier 1 duration;
- R2 and public-verification duration;
- remote Desktop/Mobile Chromium duration.

The workflow sets explicit `timeout-minutes` from the measured worst successful duration plus a 50% safety margin, capped at 60 minutes. Per-stage timings are written to the job summary. The HPA-233 workflow must not inherit an arbitrary timeout from the HPA-230 regression workflow.

## A10 — Implementation-slice updates

### Slice 4: web observability and Playwright

Slice 4 now explicitly includes:

- web release-observability attributes;
- minimal validated identity flow through the visual controller/snapshot;
- the dedicated remote Playwright configuration;
- exact Desktop/Mobile project membership;
- Tier 1 command/project split;
- DOM and network identity assertions;
- scenario-locale preservation.

### Slice 5: workflow

Slice 5 now explicitly includes:

- preview/web identity binding;
- protected-environment approval for finalization;
- retained workflow actor/approval evidence;
- measured timeout budgeting;
- remote-only browser execution;
- failure simulations for wrong deployment/asset environment, wrong preview namespace, wrong release/checksum, local-server fallback, missing mobile project membership, and missing/tampered approval evidence.

## Acceptance additions

Implementation is not complete until:

- the deployed reader reports the exact deployment environment, asset environment, preview namespace, release ID, and manifest checksum supplied to the gate;
- remote Playwright cannot start or use the local fixture server;
- the release-gate spec runs on Desktop Chromium and Mobile Chromium;
- lazy-loading project scope matches the documented Tier 1 command;
- human review is authorized by workflow/environment controls rather than the JSON reviewer string;
- preview gate rejects production/local/mismatched web identity;
- production smoke rejects preview/local/mismatched web identity;
- the scenario locale is preserved through the deployed flow;
- gate and smoke paths require the expected manifest checksum;
- workflow timeouts are based on measured stage durations.

## CLI preference

Implementation planning should prefer an `assets release-gate ...` subcommand so the gate can reuse existing parser, report, and exit-code infrastructure. A sibling CLI entry point requires a concrete isolation reason.
