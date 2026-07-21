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
