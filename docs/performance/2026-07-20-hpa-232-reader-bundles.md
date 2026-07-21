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

Resource URL suffixes (durations are milliseconds):

- `/packages/stories/src/stories/theSeventhMirror/index.ts`
- `/packages/stories/src/generated/theSeventhMirror/dialogue.zh.ts`
- `/packages/stories/src/stories/theSeventhMirror/choices.zh.ts`
- `/packages/stories/src/generated/theSeventhMirror/flow.ts`

| Profile / run | ScriptDuration (ms) | JS responses |  Entry | Dialogue | Choices |   Flow |
| ------------- | ------------------: | -----------: | -----: | -------: | ------: | -----: |
| Desktop 1     |              75.894 |          829 |   13.2 |      5.6 |     7.6 |   10.2 |
| Desktop 2     |              63.354 |          829 |   10.7 |     10.5 |    11.4 |   12.5 |
| Desktop 3     |               68.05 |          829 |    9.7 |      6.4 |     8.3 |    8.5 |
| Desktop 4     |               67.23 |          829 |    6.7 |     60.2 |    68.3 |     69 |
| Desktop 5     |              70.224 |          829 |    5.4 |      4.1 |     5.9 |    6.1 |
| Mobile 1      |              279.12 |          829 | 1692.7 |   3283.7 |  3124.9 | 3335.1 |
| Mobile 2      |             267.812 |          829 | 1686.2 |   3298.4 |  3148.4 | 3358.1 |
| Mobile 3      |              467.63 |          829 | 1686.5 |   3304.9 |  3103.4 | 3350.3 |
| Mobile 4      |              284.82 |          829 | 1692.8 |   3306.8 |    3097 | 3365.5 |
| Mobile 5      |             260.245 |          829 | 1693.8 |   3283.4 |  3139.7 | 3341.9 |

- Desktop median `ScriptDuration`: 68.05 ms
- Mobile median `ScriptDuration`: 279.12 ms
