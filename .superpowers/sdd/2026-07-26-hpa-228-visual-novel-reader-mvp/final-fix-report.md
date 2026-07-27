# HPA-228 Final Whole-Branch Fix Report

## Status

Complete. All five important findings and all three minor findings from
`final-review-findings.md` are resolved, covered by focused regressions, and
green in the complete required verification matrix.

## Scope

- Review base: `4fb6dad62d92ec4f7ce3fbf25dfaad6eece6ce87`
- Branch: `codex/hpa-228-visual-novel-reader-impl`
- Commit: the final fix-wave commit containing this report; its SHA is recorded
  by Git after the commit is created.

The changes remain inside the HPA-228 web reader/runtime and fixture-verification
boundary. No generated story output, HPA-230 publisher/hosting code, or
placeholder-rendering contract was changed.

## Finding-by-Finding Resolution

### Important 1: persisted releases were not bound to the exact source

Resolved in `web-asset-resolver.ts`.

- `ValidatedReleaseRecord` now persists the complete normalized
  `AssetResolverSource`: environment, story ID, base URL, and publication
  target.
- Stored records and nested source/target objects require exact keys and valid
  environment/target combinations.
- Source identity participates in deduplication, upsert, and fallback
  selection.
- Equivalent base URLs are normalized before comparison.
- Legacy partial records containing only story ID and target are discarded.
- The same release ID can remain independently stored for distinct exact
  sources.

Regression coverage rejects reuse across a different base URL or environment,
accepts equivalent normalized base URLs, rejects legacy partial records, and
keeps identical release IDs distinct across sources.

### Important 2: a fresh resolver could accept a persisted downgrade

Resolved in `web-asset-resolver.ts`.

- Every active-release load revalidates bounded stored records before network
  activation and seeds the newest exact-source `publishedAt`.
- A valid network pointer older than the newest persisted exact-source release
  is rejected as `stale-pointer`.
- `stale-pointer` now enters the same validated fallback path as other
  availability failures.
- Fallback selects the newest eligible exact-source stored release and exposes
  it as `last-validated-release`, which the controller maps to
  `stale-but-usable`.

Regression coverage creates a fresh resolver with a newer validated stored
release and an older valid network pointer, then proves the stored release
continues instead of being downgraded.

### Important 3: decoded cache joins skipped caller metadata validation

Resolved in `decoded-asset-cache.ts` and `types.ts`.

- Decoded entries now retain the actual fetched byte length alongside actual
  decoded dimensions.
- Every caller is checked against its own selected manifest variant after a
  completed cache hit, an in-flight join, or a concurrent insertion race.
- Global immutable cache keys remain exactly `format + sha256`, preserving the
  approved HPA-227 contract.
- Conflicting byte length, dimensions, or an absent matching selected variant
  fail with a typed integrity error without refetching or replacing the valid
  cached object.

Regression coverage exercises conflicting byte length and dimensions on
completed hits plus conflicting dimensions on a concurrent join.

### Important 4: source-less keyed stories remained silently idle

Resolved in `source-factory.ts` and `visual-state-controller.ts`.

- Every story now receives a non-null, disposable visual runtime.
- Stories without a configured asset source receive a controller with a null
  resolver, not a network-capable fake source.
- Intentionally omitted lines remain `idle` with omitted layers and no status.
- Authored background or portrait keys become typed failed layers with an
  `unavailable` release/status.
- Source-less controllers do no release, asset, warm, or edge-prefetch network
  work.
- Returning from a keyed line to an omitted line clears the unavailable status.

Controller, factory, and `ReaderShell` integration regressions cover both keyed
and intentionally omitted Train Adventure lines and assert zero fetch/cache
activity.

### Important 5: the visual backlog did not trap keyboard focus

Resolved in `VisualBacklog.svelte`.

- The backlog now uses the repository's shared `focusTrap` action.
- Initial focus, forward Tab wrapping, reverse Shift+Tab wrapping, Escape
  close, background inertness, and trigger focus restoration are retained.

Component regressions prove both Tab directions are prevented and wrapped
inside the modal; the existing real-browser focus-restoration journey remains
green.

### Minor 1: visual status was inside the inert, lower-z reader subtree

Resolved in `VisualNovelReader.svelte` and `ReaderShell.svelte`.

- `VisualNovelReader` reports the typed runtime status through
  `onVisualStatusChange` and clears it on destruction.
- `ReaderShell` owns translation/presentation and renders the polite status at
  z-80 beside the mode control, outside `reader-ready`.
- Replacement loading may make `reader-ready` inert without hiding or
  silencing the status.
- Text mode does not expose a stale visual status.

Regression coverage proves the status remains visible, translated, z-80, and
outside the inert reader while replacement loading is active.

### Minor 2: the default AVIF probe repeated after runtime recreation

Resolved in `decoded-asset-cache.ts`.

- Default caches share one module-stable fetch wrapper, so the WeakMap probe
  identity survives cache/runtime recreation.
- The wrapper still calls `globalThis.fetch` with the correct receiver and
  observes the current browser fetch implementation.

A regression recreates two default caches and proves the session-level AVIF
probe is fetched only once.

### Minor 3: fixture corruption tests rewrote checked-in assets

Resolved in `verify-visual-fixtures.ts` and `visual-fixtures.test.ts`.

- `verifyVisualFixtures` accepts an optional public-root dependency while its
  CLI keeps the checked-in root as the default.
- The corruption test copies fixtures to an isolated `mkdtemp` tree, mutates
  only that copy, verifies aggregated failures there, and removes the
  temporary directory in `finally`.

The checked-in fixture tree is never rewritten by the corruption test.

## Files Changed

Production/runtime:

- `apps/web/src/lib/visual-assets/web-asset-resolver.ts`
- `apps/web/src/lib/visual-assets/decoded-asset-cache.ts`
- `apps/web/src/lib/visual-assets/visual-state-controller.ts`
- `apps/web/src/lib/visual-assets/source-factory.ts`
- `apps/web/src/lib/visual-assets/types.ts`
- `apps/web/src/components/ReaderShell.svelte`
- `apps/web/src/components/VisualNovelReader.svelte`
- `apps/web/src/components/VisualBacklog.svelte`
- `apps/web/scripts/verify-visual-fixtures.ts`

Regressions:

- `apps/web/src/lib/visual-assets/__tests__/web-asset-resolver.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/decoded-asset-cache.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-state-controller.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/source-factory.test.ts`
- `apps/web/src/lib/visual-assets/__tests__/visual-fixtures.test.ts`
- `apps/web/src/components/__tests__/ReaderShell.test.ts`
- `apps/web/src/components/__tests__/VisualNovelReader.test.ts`
- `apps/web/src/components/__tests__/VisualBacklog.test.ts`

## TDD Evidence

- Resolver/source/downgrade regressions: the first focused run reported four
  new failures against the old behavior. After the implementation, the final
  resolver suite passed 31/31.
- Cache metadata/probe regressions: the first focused run reported four new
  failures for completed hits, concurrent joins, and repeated default probes.
  The final cache suite passed 22/22.
- Source-less runtime regressions: the first controller/factory run reported
  two failed expectations plus the old null-runtime dereference. The final
  controller/factory suites passed 28/28.
- Backlog regressions: both forward and reverse Tab tests initially observed
  `defaultPrevented === false`; the final backlog suite passed 5/5.
- Status stacking regression: the old reader timed out looking for a z-80
  status outside `reader-ready`; the final `ReaderShell` and
  `VisualNovelReader` suites passed 46/46.
- Isolated fixture regression: the old verifier ignored the injected copy and
  incorrectly passed after the temporary corruption; the final fixture suite
  passed 2/2.
- Fresh aggregate focused run — PASS, 8 files and 134 tests:

  ```text
  rtk bun --filter web test \
    src/lib/visual-assets/__tests__/web-asset-resolver.test.ts \
    src/lib/visual-assets/__tests__/decoded-asset-cache.test.ts \
    src/lib/visual-assets/__tests__/visual-state-controller.test.ts \
    src/lib/visual-assets/__tests__/source-factory.test.ts \
    src/lib/visual-assets/__tests__/visual-fixtures.test.ts \
    src/components/__tests__/ReaderShell.test.ts \
    src/components/__tests__/VisualBacklog.test.ts \
    src/components/__tests__/VisualNovelReader.test.ts
  ```

## Complete Verification

- `rtk bun --filter web build:visual-fixtures` — PASS.
- `rtk git diff --exit-code -- apps/web/public/assets/vn apps/web/src/lib/visual-assets/avif-probe.avif`
  — PASS; fixture regeneration produced no drift.
- `rtk bun --filter web verify:visual-fixtures` — PASS.
- `rtk bun --filter web test` — PASS, 76 files and 1,446 tests.
- `rtk bun --filter web lint` — PASS.
- `rtk bun --filter @aquila/stories test` — PASS, 20 files and 198 tests.
- `rtk bun --filter @aquila/stories typecheck` — PASS.
- `rtk bun --filter @aquila/stories lint` — PASS.
- `rtk bun run compile:check` — PASS; generated story outputs remained
  unchanged.
- `rtk bun run build` — PASS, 4 of 4 tasks successful.
- `rtk bun --filter e2e test:e2e tests/reader-visual.spec.ts` — PASS outside
  the macOS sandbox, 29 passed and the desktop copy of the explicit mobile
  landscape test intentionally skipped.
- `rtk git diff --check` — PASS.

The first Playwright attempt inside the managed sandbox executed no scenarios:
Chromium reported a Mach-port permission denial and WebKit aborted during
launch. The identical command was rerun outside the sandbox as required and
completed green across Chromium, mobile Chrome, and mobile Safari.

## Self-Review

- Re-read every production diff against all eight findings and the approved
  HPA-227/HPA-228 boundaries.
- Confirmed exact-source comparison is used consistently in stored-record
  parsing, uniqueness, upsert, downgrade seeding, and fallback selection.
- Confirmed decoded-object sharing remains global by immutable hash while
  caller-specific metadata is rechecked at every deduplication boundary.
- Confirmed source-less runtimes cannot issue resolver/cache requests and
  distinguish authored keys from intentional omission.
- Confirmed visual status is presentational shell state outside the inert
  subtree and is cleared when the visual reader is destroyed.
- Confirmed the existing shared focus action owns the modal trap and restore
  lifecycle.
- Confirmed fixture generation, story compilation, and the production build
  leave tracked generated assets unchanged.
- Confirmed the worktree was still at the requested base and branch before
  staging, and only the 17 intended files plus this report were modified.

## Concerns

No unresolved HPA-228 finding or required-verification failure remains.

A non-gating diagnostic invocation of raw
`rtk bunx tsc --noEmit -p apps/web/tsconfig.json` still reports the repository's
existing broad test/helper typing baseline. The two new resolver-test typing
errors it initially exposed were fixed; no resolver-test error remains, and the
required stories typecheck plus the complete production build are green.
Existing nonblocking build warnings about Svelte deprecations and large chunks
are unchanged.
