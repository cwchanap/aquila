# Task 4 report: verify transparent visual fixtures

## Scope

Task 4 extends the existing local visual-fixture verifier and builder only. The
source allowlist, size limit, coverage checks, pointer/manifest integrity,
object hashes, byte lengths, dimensions, and stale-release checks remain in the
same verification path.

## TDD evidence

### RED

Added focused tests before changing production code, then ran the prescribed
command:

```text
rtk bun --filter web test scripts/__tests__/verify-visual-fixtures.test.ts scripts/__tests__/build-visual-fixtures.test.ts
```

The test run failed with six expected failures: four portrait-source metadata
cases (format, width, height, and alpha), one portrait WebP alpha case, and the
exact WebP encoder-option assertion. Existing integrity and orchestration tests
continued to pass during this RED run.

### GREEN

After the minimal implementation, the same focused command passed:

```text
Test Files  2 passed (2)
Tests       27 passed (27)
```

The builder test asserts the shared Sharp WebP chain receives exactly:

```text
{ quality: 82, alphaQuality: 100, lossless: false, preset: 'picture', smartSubsample: true, effort: 6 }
```

and receives it four times.

## Implementation

- Replaced the approved-source `Set` with a typed metadata `Map` containing
  expected dimensions and alpha requirements.
- Added per-source Sharp metadata checks for PNG format and exact dimensions;
  portrait sources additionally require `hasAlpha === true`.
- Aggregated source metadata failures and metadata-read failures in the
  verifier's existing `problems` list.
- Added portrait WebP output alpha validation after the existing object
  dimension check.
- Completed the fixture builder's explicit WebP encoder options.
- Updated the test Sharp harness to distinguish source paths from object
  buffers and added the required source/output-alpha regression cases.

## Preservation audit

- Existing release coverage and runtime-manifest coverage calls are unchanged.
- Pointer/manifest pair validation, canonical release-content hashing, object
  SHA-256 checks, byte-length checks, dimensions, source allowlist/size checks,
  symlink rejection, and stale-release-document checks remain active.
- No URL, manifest, pointer, asset, or runtime contract files were changed.
- No infra dependency was added.

## Verification and no-binary-churn evidence

The required tooling checks passed:

```text
rtk bun --filter web lint       # passed
rtk git diff --check            # passed
```

Before adding this report, `rtk git diff --name-status` listed only these four
source/test files:

```text
M apps/web/scripts/__tests__/build-visual-fixtures.test.ts
M apps/web/scripts/__tests__/verify-visual-fixtures.test.ts
M apps/web/scripts/build-visual-fixtures.ts
M apps/web/scripts/verify-visual-fixtures.ts
```

The diff contained text-only modifications; no PNG, WebP, AVIF, manifest,
pointer, or other binary asset churn was introduced. The real fixture verifier
was intentionally not run as a GREEN check: the checked-in RGB portrait inputs
are the planned Task 5 RED state.

## Self-review and concerns

- Source metadata failures are reported per approved source and do not prevent
  the verifier from checking the remaining source/object/release invariants.
- The output alpha check is limited to portrait identities, so opaque
  backgrounds remain valid.
- No known concerns remain within Task 4 scope. Task 5 still must replace the
  RGB portrait source fixtures and regenerate the content-addressed outputs.

## Follow-up: align background dimensions with real fixtures

The first Task 4 implementation used a stale 1672×941 background expectation.
Real-verifier evidence from the checked-in fixture tree showed both background
PNGs are 959×540 RGB (opaque), and the existing runtime manifest already records
959×540 for both `chapter_1/ch1_act2_s0` and `chapter_1/ch1_act2_s1`. The
manifest evidence is visible in:

```text
apps/web/public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/sha256-9ec642a37a531d9d59fb22470ef95e35493e6b7b9c92b240fd59ff0014fa1b4d/runtime-manifest.json
```

### Follow-up RED

I first changed only the test Sharp source metadata to 959×540 and ran:

```text
rtk bun --filter web test scripts/__tests__/verify-visual-fixtures.test.ts
```

It failed in the two happy-path tests with the expected stale-production
diagnostics:

```text
background source must be a 1672 x 941 PNG: ...ch1_act2_s0.png
background source must be a 1672 x 941 PNG: ...ch1_act2_s1.png
```

### Follow-up GREEN

I then changed only the two background entries in the production metadata map
to 959×540. The focused Task 4 suite passed:

```text
rtk bun --filter web test scripts/__tests__/verify-visual-fixtures.test.ts scripts/__tests__/build-visual-fixtures.test.ts
Test Files  2 passed (2)
Tests       27 passed (27)
```

`rtk bun --filter web lint` and `rtk git diff --check` also passed. No fixture
build or real verifier run was performed in this follow-up because the portrait
source/output objects remain intentionally in Task 5's transitional state.

### Scope and preservation

The follow-up diff contains exactly the verifier and verifier-test text files.
The two pre-existing, uncommitted Task 5 portrait PNG modifications remained
untouched and unstaged throughout; no asset, manifest, pointer, or builder
files changed.
