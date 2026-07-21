# HPA-232 Reader Bundle Measurements

## Method

- Checkout: pre-implementation commit `b7d541c`
- Build: `bun --filter web build`
- Size command: `bun apps/web/scripts/measure-reader-bundles.ts`
- Network route: `/en/reader?story=the_seventh_mirror&scene=ch1_act1&dialogue=1`
- Cache: fresh browser context for every cold run
- Desktop: Playwright Desktop Chrome
- Mobile: Playwright Pixel 5 with the documented CPU/network profile

## Before

- Shared `index.BMyVFRi0.js`: 9,524,129 raw bytes; 2,045.24 kB gzip (Vite report)
- Unselected story behavior: all registered story payloads are part of the same eager shared chunk

## Before raw data

```json
{
  "files": [
    { "name": "Button.D71kroaV.js", "rawBytes": 9456, "gzipBytes": 4127 },
    { "name": "MainMenu.5Kot2-A1.js", "rawBytes": 6002, "gzipBytes": 2295 },
    { "name": "MainMenu.Ci3eAIbS.js", "rawBytes": 247, "gzipBytes": 185 },
    {
      "name": "ReaderShell.CkFzClWB.js",
      "rawBytes": 35863,
      "gzipBytes": 11344
    },
    { "name": "StoryWriter.-wDVLVd-.js", "rawBytes": 26046, "gzipBytes": 7021 },
    { "name": "UserStatus.D7FX6Iaz.js", "rawBytes": 216, "gzipBytes": 170 },
    { "name": "UserStatus.DE9_74P2.js", "rawBytes": 5256, "gzipBytes": 2227 },
    {
      "name": "bookmarks.astro_astro_type_script_index_0_lang.Bx7zbzqg.js",
      "rawBytes": 9824,
      "gzipBytes": 2722
    },
    { "name": "branches.BGWzUGCc.js", "rawBytes": 1455, "gzipBytes": 644 },
    {
      "name": "characters.astro_astro_type_script_index_0_lang.5bMZ8cDL.js",
      "rawBytes": 10391,
      "gzipBytes": 2832
    },
    { "name": "client.svelte.DYaA-WMA.js", "rawBytes": 973, "gzipBytes": 548 },
    { "name": "index.BMyVFRi0.js", "rawBytes": 9524129, "gzipBytes": 2045238 },
    {
      "name": "local-bookmarks-store.KMCQqo6o.js",
      "rawBytes": 5462,
      "gzipBytes": 1902
    },
    {
      "name": "login.astro_astro_type_script_index_0_lang.DitRu3d2.js",
      "rawBytes": 22770,
      "gzipBytes": 8956
    },
    {
      "name": "reader.astro_astro_type_script_index_0_lang.Bv5ptBCY.js",
      "rawBytes": 11502,
      "gzipBytes": 4175
    },
    { "name": "render.CgnxQXsU.js", "rawBytes": 29485, "gzipBytes": 11504 },
    { "name": "snippet.DqvT_Dnb.js", "rawBytes": 419, "gzipBytes": 297 },
    { "name": "this.W_NISwGr.js", "rawBytes": 309, "gzipBytes": 221 },
    { "name": "utils.DZnxsVFh.js", "rawBytes": 36740, "gzipBytes": 12927 }
  ],
  "totals": {
    "rawBytes": 9736545,
    "gzipBytes": 2119335
  }
}
```

### Runtime evidence

The user-approved compact format records the five run timings, resource counts, and selected-story resource URLs/durations below. The complete per-response JSON is reproducible with `bun --filter e2e measure:reader` and is intentionally retained only in the ignored local artifact `.superpowers/sdd/hpa-232-reader-runtime.json`.

Complete story-related resource URLs (durations are milliseconds):

- `http://localhost:5090/@fs/Users/chanwaichan/workspace/Aquila/packages/stories/src/stories/theSeventhMirror/index.ts`
- `http://localhost:5090/@fs/Users/chanwaichan/workspace/Aquila/packages/stories/src/generated/theSeventhMirror/dialogue.zh.ts`
- `http://localhost:5090/@fs/Users/chanwaichan/workspace/Aquila/packages/stories/src/stories/theSeventhMirror/choices.zh.ts`
- `http://localhost:5090/@fs/Users/chanwaichan/workspace/Aquila/packages/stories/src/generated/theSeventhMirror/flow.ts`

| Profile / run | ScriptDuration (ms) | JS responses |  Entry | Dialogue | Choices |   Flow |
| ------------- | ------------------: | -----------: | -----: | -------: | ------: | -----: |
| Desktop 1     |              59.878 |          829 |    5.8 |      3.7 |     4.3 |    4.3 |
| Desktop 2     |              59.389 |          829 |    3.3 |      2.1 |     2.3 |    2.3 |
| Desktop 3     |              59.699 |          829 |    3.8 |      2.7 |     4.2 |    4.3 |
| Desktop 4     |              58.274 |          829 |    3.1 |      1.8 |     2.5 |    2.5 |
| Desktop 5     |              62.951 |          829 |    3.6 |      1.7 |     1.9 |    1.8 |
| Mobile 1      |             246.875 |          829 | 1686.0 |   3307.1 |  3141.5 | 3351.9 |
| Mobile 2      |             245.641 |          829 | 1706.6 |   3277.7 |  3073.2 | 3344.4 |
| Mobile 3      |             244.231 |          829 | 1684.7 |   3298.8 |  3112.0 | 3365.7 |
| Mobile 4      |             242.912 |          829 | 1702.0 |   3283.0 |  3078.5 | 3349.6 |
| Mobile 5      |             247.627 |          829 | 1699.7 |   3284.9 |  3082.0 | 3336.5 |

- Desktop median `ScriptDuration`: 59.699 ms
- Mobile median `ScriptDuration`: 245.641 ms

## After

The after measurement used the same production build, gzip script, reader
route, ready selector, five fresh contexts per profile, and mobile CPU/network
profile as the baseline. `ScriptDuration` is the approved CDP proxy for
scripting/parse work. Wall-clock reader-ready duration was captured by a
separate evidence-only harness with those same route/profile values so the
original before/after command remained unchanged.

### Production bundle evidence

The initial static totals are the reader entry plus its static shared
dependencies. The before build did not emit a manifest, so its row is the
comparable baseline delivery envelope formed by the reader entry, eager shared
`index`, `render`, and local-bookmark chunks. The after closure is structurally
verified by the manifest and contains the reader entry, lightweight translation
`index`, `render`, and local-bookmark chunks.

| Delivery surface                 | Before raw / gzip bytes | After raw / gzip bytes |
| -------------------------------- | ----------------------- | ---------------------- |
| Reader entry                     | 11,502 / 4,175          | 15,977 / 5,341         |
| Shared `index`                   | 9,524,129 / 2,045,238   | 13,392 / 5,397         |
| Initial reader delivery envelope | 9,570,578 / 2,062,819   | 64,316 / 24,145        |
| All emitted client JavaScript    | 9,736,545 / 2,119,335   | 9,743,999 / 2,121,322  |

The total emitted bytes remain nearly flat because the same story payloads are
now emitted as dynamic chunks. The delivery change is that the web reader's
initial graph no longer includes those payloads; Phaser and desktop continue
to use their intentionally preserved synchronous path.

| Dynamically selected story chunk | Emitted file               | Raw bytes | Gzip bytes |
| -------------------------------- | -------------------------- | --------: | ---------: |
| Train Adventure                  | `_astro/index.DWUGgw2l.js` | 5,948,241 |  1,356,791 |
| Don't Save Me Before Midnight    | `_astro/index.D2EuYMAa.js` | 2,205,871 |    406,582 |
| The Seventh Mirror               | `_astro/index.dFD9wf6K.js` | 1,356,670 |    276,244 |

The build's manifest assertion printed this mapping and verified three distinct
dynamic entries:

```text
stories/trainAdventure/index.ts -> _astro/index.DWUGgw2l.js
stories/dontSaveMeBeforeMidnight/index.ts -> _astro/index.D2EuYMAa.js
stories/theSeventhMirror/index.ts -> _astro/index.dFD9wf6K.js
```

The after size JSON is retained at the ignored
`.superpowers/sdd/hpa-232-task-11-bundle-sizes.json`. The production manifest
and module-membership proof are reproducible at
`apps/web/dist/client/.vite/manifest.json` and
`apps/web/dist/client/.vite/story-chunk-modules.json` after the build.

### Cold-load runtime evidence

`bun --filter e2e measure:reader` completed five normal cold runs per profile.
Every run observed 197 pre-readiness JavaScript responses: 112 belonged to The
Seventh Mirror, and zero belonged to Train Adventure or Don't Save Me Before
Midnight. The complete per-response request list and timings are retained at
the ignored `.superpowers/sdd/hpa-232-reader-runtime.json`.

| Profile / run | ScriptDuration (ms) | JS responses | Entry | Dialogue | Choices |  Flow |
| ------------- | ------------------: | -----------: | ----: | -------: | ------: | ----: |
| Desktop 1     |              41.940 |          197 |   3.5 |     12.7 |     2.9 |   4.7 |
| Desktop 2     |              40.079 |          197 |   1.1 |      1.4 |     2.0 |   2.0 |
| Desktop 3     |              41.383 |          197 |   1.0 |      1.0 |     1.5 |   1.3 |
| Desktop 4     |              40.669 |          197 |   1.1 |      1.3 |     1.4 |   1.3 |
| Desktop 5     |              40.793 |          197 |   1.2 |      1.6 |     2.3 |   1.9 |
| Mobile 1      |             198.909 |          197 | 174.3 |    536.6 |   187.6 | 514.8 |
| Mobile 2      |             193.433 |          197 | 177.7 |    536.7 |   185.9 | 514.3 |
| Mobile 3      |             200.303 |          197 | 173.1 |    537.8 |   187.3 | 516.9 |
| Mobile 4      |             182.949 |          197 | 176.5 |    537.9 |   183.8 | 515.9 |
| Mobile 5      |             189.465 |          197 | 174.9 |    540.0 |   185.3 | 515.3 |

- Desktop median `ScriptDuration`: 40.793 ms across 5 runs (before: 59.699 ms).
- Mobile median `ScriptDuration`: 193.433 ms across 5 runs (before: 245.641 ms).

The selected top-level story request list was:

- `packages/stories/src/stories/theSeventhMirror/index.ts`
- `packages/stories/src/generated/theSeventhMirror/dialogue.zh.ts`
- `packages/stories/src/stories/theSeventhMirror/choices.zh.ts`
- `packages/stories/src/generated/theSeventhMirror/flow.ts`

The same-profile augmented run measured wall-clock time from immediately before
navigation until the reader-ready selector attached:

| Profile           | Ready durations (ms), 5 cold runs                          | Median (ms) |
| ----------------- | ---------------------------------------------------------- | ----------: |
| Desktop Chrome    | 350.893, 273.233, 266.959, 265.329, 263.618                |     266.959 |
| Pixel 5 throttled | 56,218.955, 56,218.669, 56,239.430, 56,262.773, 56,240.393 |  56,239.430 |

Its full evidence is retained at the ignored
`.superpowers/sdd/hpa-232-task-11-runtime-evidence.json`. The separate harness's
CDP medians (40.013 ms desktop and 190.294 ms mobile) corroborated the unchanged
benchmark; the threshold decision uses the exact `measure:reader` result above.

### Invalid-persisted-session recovery

This exceptional path was measured separately and excluded from all normal
medians. A fresh context was seeded with a valid Midnight story ID but a removed
scene, causing the manager to load Midnight, reject the persisted position,
then load the default Train Adventure story.

| Profile           | Runs | Ready duration (ms) | ScriptDuration (ms) | JS responses | Story entry order |
| ----------------- | ---: | ------------------: | ------------------: | -----------: | ----------------- |
| Desktop Chrome    |    1 |           1,333.235 |              76.853 |          721 | Midnight -> Train |
| Pixel 5 throttled |    1 |         179,687.039 |             291.819 |          721 | Midnight -> Train |

### Compatibility and request verification

All Task 11 commands passed at the after checkout:

- `bun compile:check` — pass; generated story output had no drift.
- `bun --filter @aquila/stories test` — 16 files and 126 tests passed.
- `bun --filter @aquila/stories typecheck` — pass.
- `bun --filter web test` — 63 files and 1,307 tests passed.
- `bun --filter @aquila/game test` — 18 files and 412 tests passed.
- `bun --filter @aquila/game typecheck` — pass.
- `bun --filter desktop test` — exit 0; this workspace currently has no test files.
- `bun --filter desktop check` — 0 errors and 0 warnings.
- `bun --filter web lint` — pass.
- `bun --filter web build` — pass, including the manifest/module-membership assertion.
- `bun --filter e2e test:e2e tests/reader-lazy-loading.spec.ts --project=chromium` — 4/4 passed. The first sandboxed launch was blocked by macOS Mach-port permissions; the same command passed outside the sandbox.
- `git diff --check` — pass.

The Chromium journeys additionally prove exact direct-link restoration,
selected-only loading, reload retry after a one-shot module failure, no
same-story redownload during scene navigation, and latest-wins behavior under
rapid history navigation. Stories, game, and desktop verification preserve the
synchronous compatibility path.

## Chapter-splitting decision

The Seventh Mirror is 276,244 bytes gzip, below the 500 kB delivery gate, and
its exact-method mobile median `ScriptDuration` is 193.433 ms, below the 200 ms
gate. Neither threshold is exceeded, so no HPA-216 follow-up is proposed.

Chapter-level splitting is unnecessary under the HPA-232 thresholds.
