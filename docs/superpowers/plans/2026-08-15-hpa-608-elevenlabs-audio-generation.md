# HPA-608 ElevenLabs Audio Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, resumable Bun/TypeScript workflow that turns validated Aquila `audio-plan.json` rows into bounded ElevenLabs SFX/Music candidates with checksum-verified provenance and explicit human selection for HPA-609.

**Architecture:** `--story` resolves the existing raw story folder through the shared compiler config loader; JSON contracts persist `compiler.config.ts`'s runtime `storyId`. Current provider inputs are hashed with existing `canonicalJson`; one direct-HTTP provider seam performs the paid requests; one story-local `.tmp/` store owns immutable candidate history. Success receipt and selection schemas are exposed only through the Node-only `@aquila/stories/audio-generation` subpath so HPA-609 can verify selected sources without deep imports.

**Tech Stack:** TypeScript, Bun, Node `fetch`, `node:util.parseArgs`, `node:crypto`, Node filesystem APIs, Zod, existing story compiler/audio-plan/runtime-asset helpers, Vitest.

**Design:** `docs/superpowers/specs/2026-08-15-hpa-608-elevenlabs-audio-generation-design.md`

## Global Constraints

- Keep `audio-plan.json` provider-neutral.
- `--story` is the raw folder; persisted JSON `storyId` is validated `compiler.config.ts` `storyId`.
- Reuse `canonicalJson`, `isStoryId`, `isSha256`, and `loadAudioPlan`.
- Do not import `@aquila/infra-cloudflare` back into stories.
- Direct HTTP only; no ElevenLabs SDK for v1.
- SFX current request: `eleven_text_to_sound_v2`, non-looping, `mp3_44100_128`, prompt influence `0.3`, explicit duration `500..30000ms`.
- BGM current request: `music_v2`, `force_instrumental: true`, `output_format=auto`, duration `3000..600000ms`.
- Never clamp provider-illegal authored duration; aggregate all issues before paid work.
- Candidate count defaults to `1`, valid `1..4`; it means desired total current-spec successes per key.
- No `--force`; request another explicit candidate by raising `--candidate-count`.
- Paid runs require `--max-requests 1..100`; logical requests execute sequentially and stop on first final failure.
- Retry only HTTP 429/5xx: initial request + at most two retries with injected 1s/2s backoff.
- Do not retry thrown/network errors or 2xx non-audio responses.
- Accept provider bytes only when returned `Content-Type` starts with `audio/`.
- Stored success always means strict receipt + current spec hash + existing bytes + matching byte length + actual-byte SHA-256.
- Success receipt and selection remain strict `schemaVersion: 1` cross-package contracts. Failure markers are local audit files, not parsed contracts.
- Parseable CLI JSON uses `bun packages/stories/src/audio-generation/cli.ts ...`, never Bun `--filter`.
- Keep the dated advisory USD estimate required by HPA-608, but also print raw durations/request counts and make the scheduled repeated-per-candidate list explicit.
- Re-check current provider pricing during implementation and set `pricingAsOf` to the actual check date; do not treat the constants as a live price service.
- Real BGM requests require the existing small non-empty Music terms/account note; do not grow it into legal automation.
- No queue, DB, worker, dashboard, provider registry, auto-ranking, runtime generation, mastering, audio probing, or R2 publication.

---

## File Structure

### Create

- `packages/stories/src/audio-generation/index.ts`
- `packages/stories/src/audio-generation/spec.ts`
- `packages/stories/src/audio-generation/store.ts`
- `packages/stories/src/audio-generation/elevenlabs.ts`
- `packages/stories/src/audio-generation/run.ts`
- `packages/stories/src/audio-generation/select.ts`
- `packages/stories/src/audio-generation/cli.ts`
- `packages/stories/src/audio-generation/__tests__/spec.test.ts`
- `packages/stories/src/audio-generation/__tests__/store.test.ts`
- `packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts`
- `packages/stories/src/audio-generation/__tests__/run.test.ts`
- `packages/stories/src/audio-generation/__tests__/select.test.ts`
- `packages/stories/src/audio-generation/__tests__/cli.test.ts`

### Modify

- `packages/stories/src/compiler/config.ts` — shared raw-root/config loader.
- `packages/stories/src/compiler/cli.ts` — reuse shared loader/root.
- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` — `camera-shutter: 400 -> 500`.
- `packages/stories/package.json` — Node-only `./audio-generation` export + optional convenience scripts.

### Private/uncommitted during implementation

- `.tmp/hpa-608-provider-probe.mjs`
- `.tmp/hpa-608-provider-probe.json`
- `.tmp/audio-generation/<storyFolder>/**`

---

## Task 1: Share story-config loading, fix the known cue, and define the current generation spec

**Files:**
- Modify: `packages/stories/src/compiler/config.ts`
- Modify: `packages/stories/src/compiler/cli.ts`
- Modify: `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- Create: `packages/stories/src/audio-generation/spec.ts`
- Create: `packages/stories/src/audio-generation/__tests__/spec.test.ts`

**Interfaces:**
- Produces `STORIES_RAW_ROOT`, `loadStoryCompilerConfig(rawDir)`.
- Produces `CurrentAudioGenerationSpec`, `AudioGenerationSpecIssue`, `buildAudioGenerationSpec`, `buildAudioGenerationSpecSet`, `audioGenerationSpecSha256`, and a tiny dated USD estimate helper over the **scheduled spec list**.

- [ ] **Step 1: Write the failing shared-config/spec tests**

In `spec.test.ts`, cover exact current inputs, hash changes, provider limits, aggregate issues, and the committed Seventh Mirror plan:

```ts
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadAudioPlan } from '../../audio-plan-loader';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
    buildAudioGenerationSpecSet,
    estimateScheduledAudioCostUsd,
} from '../spec';

describe('audio generation spec', () => {
    it('maps SFX to the exact current paid inputs', () => {
        expect(
            buildAudioGenerationSpec({
                key: 'door-open',
                type: 'sfx',
                prompt: 'Heavy apartment door opening',
                durationMs: 2200,
            })
        ).toEqual({
            schemaVersion: 1,
            key: 'door-open',
            type: 'sfx',
            prompt: 'Heavy apartment door opening',
            durationMs: 2200,
            provider: 'elevenlabs',
            modelId: 'eleven_text_to_sound_v2',
            outputFormat: 'mp3_44100_128',
            loop: false,
            promptInfluence: 0.3,
        });
    });

    it('maps BGM to current instrumental music_v2 inputs', () => {
        expect(
            buildAudioGenerationSpec({
                key: 'dawn-apartment',
                type: 'bgm',
                prompt: 'Cold Tokyo dawn underscore',
                durationMs: 90_000,
                loop: true,
            })
        ).toEqual({
            schemaVersion: 1,
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Cold Tokyo dawn underscore',
            durationMs: 90_000,
            provider: 'elevenlabs',
            modelId: 'music_v2',
            outputFormat: 'auto',
            loopIntent: true,
            forceInstrumental: true,
        });
    });

    it('aggregates every provider-illegal row', () => {
        const result = buildAudioGenerationSpecSet([
            { key: 'too-short', type: 'sfx', prompt: 'x', durationMs: 400 },
            { key: 'too-long', type: 'sfx', prompt: 'y', durationMs: 30_001 },
            {
                key: 'tiny-music',
                type: 'bgm',
                prompt: 'z',
                durationMs: 2_999,
                loop: true,
            },
        ]);
        expect(result.issues.map(issue => issue.key)).toEqual([
            'too-short',
            'too-long',
            'tiny-music',
        ]);
    });

    it('keeps the committed Seventh Mirror plan provider-compatible', () => {
        const rawDir = fileURLToPath(
            new URL('../../../raw/theSeventhMirror/', import.meta.url)
        );
        const plan = loadAudioPlan(rawDir);
        expect(plan).toBeDefined();
        expect(buildAudioGenerationSpecSet(plan!.assets).issues).toEqual([]);
    });

    it('hashes every paid input', () => {
        const spec = buildAudioGenerationSpec({
            key: 'impact',
            type: 'sfx',
            prompt: 'Muted impact',
            durationMs: 900,
        });
        expect(audioGenerationSpecSha256(spec)).toMatch(/^[a-f0-9]{64}$/);
        expect(
            audioGenerationSpecSha256({ ...spec, promptInfluence: 0.5 })
        ).not.toBe(audioGenerationSpecSha256(spec));
    });

    it('estimates over the repeated scheduled list, not unique keys', () => {
        const spec = buildAudioGenerationSpec({
            key: 'ambience',
            type: 'sfx',
            prompt: 'Thirty second ambience',
            durationMs: 30_000,
        });
        expect(estimateScheduledAudioCostUsd([spec, spec])).toBeCloseTo(0.12, 8);
    });
});
```

- [ ] **Step 2: Verify the focused test fails**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/spec.test.ts
```

Expected: FAIL because the module does not exist and the committed `400ms` row is not provider-compatible.

- [ ] **Step 3: Extract the existing raw-root/config loader**

Extend `compiler/config.ts` with one owner for raw layout:

```ts
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const compilerDir = dirname(fileURLToPath(import.meta.url));
export const STORIES_RAW_ROOT = resolve(compilerDir, '../..', 'raw');

export async function loadStoryCompilerConfig(
    rawDir: string
): Promise<StoryCompilerConfig> {
    const configPath = join(rawDir, 'compiler.config.ts');
    if (!existsSync(configPath)) {
        throw new Error(`[story-compiler] missing compiler config: ${configPath}`);
    }
    const configModule = await import(configPath);
    return configModule.default as StoryCompilerConfig;
}
```

Update `compiler/cli.ts` to remove its local `rawRoot`/config import logic and reuse `STORIES_RAW_ROOT` + `loadStoryCompilerConfig`.

- [ ] **Step 4: Correct the authored provider-illegal cue**

Change only:

```json
{
  "key": "camera-shutter",
  "type": "sfx",
  "prompt": "Camera shutter and flash, evidence capture, one-shot",
  "durationMs": 500
}
```

Do not change `AudioPlanV1` provider-neutral bounds.

- [ ] **Step 5: Implement the current spec/hash/issue aggregation**

Use the current literal inputs in the builder. Hash with existing `canonicalJson` plus local `createHash`:

```ts
export function audioGenerationSpecSha256(
    spec: CurrentAudioGenerationSpec
): string {
    return createHash('sha256')
        .update(canonicalJson(spec as unknown as JsonValue))
        .digest('hex');
}
```

`buildAudioGenerationSpecSet` catches every per-row provider-bound failure and returns issues in plan order. Paid execution later refuses to run while `issues.length > 0`.

Keep the dated USD estimator tiny and run it over a scheduled list where one spec appears once per still-needed candidate; do not hide candidate-count multiplication inside the helper. Set `ELEVENLABS_PRICING_AS_OF` to the actual implementation-time pricing check date after verifying the official provider page.

- [ ] **Step 6: Verify Task 1 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/spec.test.ts
bun run compile:check
git add \
  packages/stories/src/compiler/config.ts \
  packages/stories/src/compiler/cli.ts \
  packages/stories/raw/theSeventhMirror/docs/audio-plan.json \
  packages/stories/src/audio-generation/spec.ts \
  packages/stories/src/audio-generation/__tests__/spec.test.ts
git commit -m "feat(stories): define audio generation specs"
```

---

## Task 2: Build the checksum-verified store and the HPA-609 package subpath

**Files:**
- Create: `packages/stories/src/audio-generation/store.ts`
- Create: `packages/stories/src/audio-generation/index.ts`
- Create: `packages/stories/src/audio-generation/__tests__/store.test.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**
- Produces `StoredAudioGenerationSpecV1Schema`, `AudioCandidateReceiptV1Schema`, `VerifiedStoredCandidate`, `LocalAudioGenerationStore`.
- Exposes only Node-side handoff APIs at `@aquila/stories/audio-generation`.

- [ ] **Step 1: Write failing schema/store tests**

Cover:

1. constructor validates runtime story id with `isStoryId`;
2. success receipt rejects invalid `storyId` and non-SHA-256 digests using existing helpers;
3. historical receipt parses when provider/model/output/request-setting values differ from today's builder constants;
4. unknown receipt fields/schema version fail;
5. tampered/missing bytes are not successful;
6. `matchingSuccessfulCandidates(key, hash)` re-hashes actual bytes;
7. success/failure/orphan candidate filenames consume ordinals;
8. failure marker is not parsed as a contract;
9. package subpath import resolves while the root entry remains unchanged.

Historical receipt example:

```ts
expect(() =>
    AudioCandidateReceiptV1Schema.parse({
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        key: 'dawn-apartment',
        type: 'bgm',
        candidateId: 'candidate-001',
        spec: {
            schemaVersion: 1,
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'old prompt',
            durationMs: 90_000,
            provider: 'elevenlabs',
            modelId: 'music_v3',
            outputFormat: 'future_format',
            loopIntent: true,
            forceInstrumental: true,
        },
        specSha256: 'a'.repeat(64),
        provider: 'elevenlabs',
        modelId: 'music_v3',
        createdAt: '2026-08-16T00:00:00.000Z',
        intendedDurationMs: 90_000,
        actualDurationMs: null,
        output: {
            filename: 'candidate-001.ogg',
            mediaType: 'audio/ogg',
            format: 'audio/ogg',
            byteLength: 4,
            sha256: 'b'.repeat(64),
        },
        providerMetadata: {},
    })
).not.toThrow();
```

- [ ] **Step 2: Verify the store test fails**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts
```

- [ ] **Step 3: Implement a strict historical stored-spec parser**

Keep field structure strict, but values expected to change across paid generations are typed rather than pinned to today's literals:

```ts
const StoredSfxGenerationSpecV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        key: z.string().min(1),
        type: z.literal('sfx'),
        prompt: z.string(),
        durationMs: z.number().int().positive(),
        provider: z.string().min(1),
        modelId: z.string().min(1),
        outputFormat: z.string().min(1),
        loop: z.boolean(),
        promptInfluence: z.number(),
    })
    .strict();

const StoredBgmGenerationSpecV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        key: z.string().min(1),
        type: z.literal('bgm'),
        prompt: z.string(),
        durationMs: z.number().int().positive(),
        provider: z.string().min(1),
        modelId: z.string().min(1),
        outputFormat: z.string().min(1),
        loopIntent: z.boolean(),
        forceInstrumental: z.boolean(),
    })
    .strict();
```

This parser reads old paid provenance; current-spec equality is still the hash's job.

- [ ] **Step 4: Implement the strict success receipt with existing validators**

Use:

```ts
const StoryIdSchema = z
    .string()
    .refine(isStoryId, 'Invalid runtime story id');
const Sha256Schema = z
    .string()
    .refine(isSha256, 'Expected lowercase SHA-256');
```

`AudioCandidateReceiptV1Schema` is `.strict()`, embeds the stored-spec parser, and uses `Sha256Schema` for `specSha256` and `output.sha256`.

- [ ] **Step 5: Implement story-owned store state**

Constructor:

```ts
new LocalAudioGenerationStore(
    {
        root: '.tmp/audio-generation/theSeventhMirror',
        storyId: 'the_seventh_mirror',
    },
    now?
);
```

Methods do not take `storyId`:

```ts
matchingSuccessfulCandidates(key, specSha256)
nextCandidateId(key)
writeSuccess({ candidateId, spec, specSha256, generated })
writeFailureMarker({ candidateId, spec, specSha256, failure })
readVerifiedCandidate(key, candidateId)
hasMusicTermsNote()
```

`readVerifiedCandidate` parses the receipt, requires `receipt.storyId === this.storyId`, recomputes byte length/SHA-256, and returns verified bytes/path metadata.

`matchingSuccessfulCandidates` calls the same verification path; no file-existence-only shortcut.

On final failure write one immutable `candidate-NNN.failure.json`. Do not create a parsed/versioned failure schema. `nextCandidateId` scans `candidate-NNN.*` filenames, so the failure marker itself consumes the ordinal.

- [ ] **Step 6: Add the Node-only HPA-609 subpath**

`audio-generation/index.ts` exports only:

```ts
export {
    AudioCandidateReceiptV1Schema,
    LocalAudioGenerationStore,
    StoredAudioGenerationSpecV1Schema,
} from './store';
export type {
    AudioCandidateReceiptV1,
    StoredAudioGenerationSpecV1,
    VerifiedStoredCandidate,
} from './store';
```

Add to `packages/stories/package.json`:

```json
{
  "exports": {
    "./audio-generation": "./src/audio-generation/index.ts"
  }
}
```

Do **not** modify `packages/stories/src/index.ts`.

- [ ] **Step 7: Verify Task 2 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts
bun --filter @aquila/stories typecheck
git add \
  packages/stories/src/audio-generation/store.ts \
  packages/stories/src/audio-generation/index.ts \
  packages/stories/src/audio-generation/__tests__/store.test.ts \
  packages/stories/package.json
git commit -m "feat(stories): persist verified audio candidates"
```

---

## Task 2.5: Probe the real provider contract before exhaustive mocks

**Files:**
- Private create: `.tmp/hpa-608-provider-probe.mjs`
- Private output: `.tmp/hpa-608-provider-probe.json`
- No committed files.

**Purpose:** Spend only two minimum-size generations to verify request fields, query placement, returned `Content-Type`, and useful response headers before Task 3 freezes those assumptions in mocks.

- [ ] **Step 1: Complete the Music/account preflight note**

Create the non-empty story note with the actual account plan, current check date, intended Aquila hobby-game distribution, and your concise human decision after reviewing current Music/API/model terms:

```text
.tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

Do not commit it.

- [ ] **Step 2: Create the throwaway two-request probe**

Write `.tmp/hpa-608-provider-probe.mjs`:

```js
import { writeFile } from 'node:fs/promises';

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required');

const requests = [
    {
        name: 'sfx',
        url: 'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
        body: {
            text: 'Single dry camera shutter click',
            duration_seconds: 0.5,
            loop: false,
            prompt_influence: 0.3,
            model_id: 'eleven_text_to_sound_v2',
        },
    },
    {
        name: 'bgm',
        url: 'https://api.elevenlabs.io/v1/music?output_format=auto',
        body: {
            prompt: 'Three second minimal instrumental mystery texture, no vocals',
            music_length_ms: 3000,
            model_id: 'music_v2',
            force_instrumental: true,
            store_for_inpainting: false,
            sign_with_c2pa: false,
        },
    },
];

const results = [];
for (const request of requests) {
    const response = await fetch(request.url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'xi-api-key': apiKey,
        },
        body: JSON.stringify(request.body),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const headerNames = [
        'content-type',
        'content-length',
        'character-cost',
        'song-id',
        'request-id',
        'x-trace-id',
    ];
    results.push({
        name: request.name,
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(
            headerNames
                .map(name => [name, response.headers.get(name)])
                .filter(([, value]) => value !== null)
        ),
        byteLength: bytes.byteLength,
        prefixHex: Buffer.from(bytes.subarray(0, 16)).toString('hex'),
    });
    if (!response.ok) break;
}

await writeFile(
    '.tmp/hpa-608-provider-probe.json',
    JSON.stringify(results, null, 2) + '\n'
);
console.log(JSON.stringify(results, null, 2));
```

The script never writes the API key or full response headers.

- [ ] **Step 3: Run exactly once and inspect the transcript**

```bash
bun .tmp/hpa-608-provider-probe.mjs
cat .tmp/hpa-608-provider-probe.json
```

Expected when the documented contract matches reality:

- exactly two logical paid requests maximum;
- both statuses are 2xx;
- both byte lengths are non-zero;
- both responses advertise `audio/*` content types;
- useful non-secret provider identifiers/cost headers are recorded only when present.

If either request contradicts the documented request/response contract, update the design/plan **before** writing Task 3's exhaustive mock assertions.

---

## Task 3: Implement direct ElevenLabs mapping and bounded retry from the observed transcript

**Files:**
- Create: `packages/stories/src/audio-generation/elevenlabs.ts`
- Create: `packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts`

**Interfaces:**
- Consumes current specs and store `GeneratedAudioCandidate`.
- Produces `AudioGenerationProvider`, `ElevenLabsProviderError`, `createElevenLabsAudioProvider`.

- [ ] **Step 1: Write failing exact HTTP tests using the Task 2.5 transcript**

Provider seam:

```ts
export interface AudioGenerationProvider {
    generate(
        spec: CurrentAudioGenerationSpec,
        apiKey: string
    ): Promise<GeneratedAudioCandidate>;
}
```

Assert SFX URL/body exactly:

```ts
expect(fetchMock).toHaveBeenCalledWith(
    'https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128',
    expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'xi-api-key': 'test-secret',
        }),
        body: JSON.stringify({
            text: 'Heavy apartment door opening',
            duration_seconds: 2.2,
            loop: false,
            prompt_influence: 0.3,
            model_id: 'eleven_text_to_sound_v2',
        }),
    })
);
```

Assert BGM maps to `/v1/music?output_format=auto` with prompt, `music_length_ms`, `music_v2`, `force_instrumental: true`, `store_for_inpainting: false`, and `sign_with_c2pa: false`.

- [ ] **Step 2: Add response/retry/redaction tests**

Cover:

- 200 + `audio/mpeg` => success;
- 200 + `audio/ogg; codecs=opus` => accepted, normalized media type `audio/ogg`, derived extension `ogg`;
- 200 + `application/json` => final invalid-provider-response error, no retry;
- 429 then 200 => two fetches, sleep `[1000]`;
- 500, 503, 200 => three fetches, sleeps `[1000, 2000]`;
- third 5xx => final failure;
- deterministic 4xx => one fetch, no sleep;
- thrown fetch/network error => one fetch, no retry;
- API key never appears in error messages/metadata.

- [ ] **Step 3: Verify failure then implement the adapter**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/elevenlabs.test.ts
```

Implement with injected `fetch` + `sleep`. Strip content-type parameters, require `audio/`, and derive extension with a tiny helper (`audio/mpeg -> mp3`; otherwise safe subtype without `x-`). Store only explicitly approved non-secret response headers.

- [ ] **Step 4: Verify Task 3 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/elevenlabs.test.ts
git add packages/stories/src/audio-generation/elevenlabs.ts packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts
git commit -m "feat(stories): add ElevenLabs audio adapter"
```

---

## Task 4: Plan and execute bounded resumable batches

**Files:**
- Create: `packages/stories/src/audio-generation/run.ts`
- Create: `packages/stories/src/audio-generation/__tests__/run.test.ts`

**Interfaces:**
- Produces `AudioGenerationStoryContext`, `loadAudioGenerationStoryContext`, `planAudioGeneration`, `runAudioGeneration`.

- [ ] **Step 1: Write failing story-context/planner tests**

`loadAudioGenerationStoryContext('theSeventhMirror')` must:

```ts
expect(context.storyFolder).toBe('theSeventhMirror');
expect(context.storyId).toBe('the_seventh_mirror');
expect(context.plan.assets).toHaveLength(41);
```

It resolves `rawDir = join(STORIES_RAW_ROOT, storyFolder)`, calls shared `loadStoryCompilerConfig(rawDir)`, validates `config.storyId` with `isStoryId`, and calls `loadAudioPlan(rawDir)`.

Planner tests cover:

- explicit keys in plan order;
- `--missing` over every plan row;
- candidate count means desired total current-spec verified successes;
- one existing verified success + desired count 2 => exactly one scheduled request;
- old-spec success does not count;
- any provider issue => zero scheduled paid work plus full issue list;
- max request cap takes deterministic prefix;
- a capped run is successful with remainder reported;
- dry-run performs no store mutation/provider call;
- dated USD estimate receives the repeated scheduled spec list.

- [ ] **Step 2: Write failing execution/resume tests**

With fake provider/store:

- requests execute one at a time;
- success is persisted before next provider call;
- final provider failure writes `candidate-NNN.failure.json` and stops;
- next run allocates the next ordinal;
- matching verified successes are not regenerated;
- first real BGM call requires `store.hasMusicTermsNote()`;
- Ctrl-C-like thrown error leaves earlier success untouched and is not retried.

- [ ] **Step 3: Implement story context/planner/runner**

Keep runner dependencies explicit rather than adding a service container:

```ts
interface RunDependencies {
    readonly provider: AudioGenerationProvider;
    readonly store: LocalAudioGenerationStore;
    readonly apiKey: string;
}
```

No parallelism, queue, scheduler, or generic job abstraction.

- [ ] **Step 4: Verify Task 4 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/run.test.ts
git add packages/stories/src/audio-generation/run.ts packages/stories/src/audio-generation/__tests__/run.test.ts
git commit -m "feat(stories): add resumable audio generation runner"
```

---

## Task 5: Add strict explicit candidate selection and complete the HPA-609 subpath

**Files:**
- Create: `packages/stories/src/audio-generation/select.ts`
- Create: `packages/stories/src/audio-generation/__tests__/select.test.ts`
- Modify: `packages/stories/src/audio-generation/index.ts`

**Interfaces:**
- Produces/export `AudioSelectionFileV1Schema`, type, and `selectAudioCandidate`.

- [ ] **Step 1: Write failing strict selection tests**

Use existing validators:

```ts
const SelectionSchema = z
    .object({
        candidateId: z.string().regex(/^candidate-\d{3}$/),
        specSha256: z.string().refine(isSha256),
        sourceSha256: z.string().refine(isSha256),
    })
    .strict();

export const AudioSelectionFileV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        storyId: z.string().refine(isStoryId),
        selections: z.record(SelectionSchema),
    })
    .strict();
```

Cover:

- unknown field/version/invalid hash/story id fails;
- selecting valid current-spec candidate writes one entry;
- stale spec hash fails before mutation;
- tampered source fails through `readVerifiedCandidate`;
- replacing selection for the same key is atomic;
- candidates for other keys remain selected.

- [ ] **Step 2: Verify failure and implement minimal selection**

`selectAudioCandidate`:

1. derives current spec/hash from plan row;
2. calls `store.readVerifiedCandidate(key, candidateId)`;
3. requires receipt spec hash == current spec hash;
4. writes verified source SHA-256;
5. parses existing selection through the same strict schema before replacing it;
6. temp+rename writes `selection.json`.

- [ ] **Step 3: Export the HPA-609 contract**

Extend `audio-generation/index.ts`:

```ts
export { AudioSelectionFileV1Schema } from './select';
export type { AudioSelectionFileV1 } from './select';
```

HPA-609 must consume these through `@aquila/stories/audio-generation`, not a source deep import.

- [ ] **Step 4: Verify Task 5 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/select.test.ts
bun --filter @aquila/stories typecheck
git add \
  packages/stories/src/audio-generation/select.ts \
  packages/stories/src/audio-generation/index.ts \
  packages/stories/src/audio-generation/__tests__/select.test.ts
git commit -m "feat(stories): add audio candidate selection"
```

---

## Task 6: Add the direct-path JSON CLI and stable exit codes

**Files:**
- Create: `packages/stories/src/audio-generation/cli.ts`
- Create: `packages/stories/src/audio-generation/__tests__/cli.test.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**
- Produces `audioGenerationExitCode(error)` and CLI `generate` / `select` commands.

- [ ] **Step 1: Write failing CLI parsing/exit-code tests**

Use `node:util.parseArgs`; keep command as the first positional. Cover:

- missing/unknown command => exit 1;
- missing/unknown story or invalid flag combinations => exit 1;
- explicit `--key` and `--missing` are mutually exclusive;
- no `--force` option exists;
- candidate count range `1..4`;
- paid generation without `--max-requests` => exit 1;
- provider-illegal plan / stale-invalid selection input => exit 2;
- provider or local store I/O failure => exit 3;
- capped successful generation with deferred remainder => exit 0;
- stdout has one JSON document and progress/errors stay on stderr.

Exit map:

```ts
export function audioGenerationExitCode(error: unknown): number {
    if (!(error instanceof AudioGenerationError)) return 3;
    if (error.code === 'configuration') return 1;
    if (error.code === 'input') return 2;
    return 3;
}
```

- [ ] **Step 2: Write failing dry-run JSON contract test**

Invoke the CLI runner directly with captured streams and assert the report includes:

```ts
expect(report).toMatchObject({
    storyFolder: 'theSeventhMirror',
    storyId: 'the_seventh_mirror',
    assetCount: 41,
    sfx: { count: 28 },
    bgm: { count: 13 },
    providerIssues: [],
});
```

Also assert the estimate object has `currency: 'USD'`, dated `pricingAsOf`, and raw scheduled request/duration fields exist alongside it.

- [ ] **Step 3: Implement CLI and convenience scripts**

Documented machine invocation:

```bash
bun packages/stories/src/audio-generation/cli.ts generate --story theSeventhMirror --missing --dry-run
bun packages/stories/src/audio-generation/cli.ts select --story theSeventhMirror --key camera-shutter --candidate candidate-001
```

Optional package aliases may remain:

```json
{
  "audio:generate": "bun src/audio-generation/cli.ts generate",
  "audio:select": "bun src/audio-generation/cli.ts select"
}
```

Do not use aliases through `bun --filter` when stdout will be parsed as JSON.

- [ ] **Step 4: Verify the real direct-path dry run**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run > .tmp/hpa-608-dry-run.json

bun -e "const x=await Bun.file('.tmp/hpa-608-dry-run.json').json(); console.log(x.storyFolder,x.storyId,x.assetCount,x.providerIssues.length)"
```

Expected:

```text
theSeventhMirror the_seventh_mirror 41 0
```

- [ ] **Step 5: Verify Task 6 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/cli.test.ts
bun --filter @aquila/stories typecheck
git add \
  packages/stories/src/audio-generation/cli.ts \
  packages/stories/src/audio-generation/__tests__/cli.test.ts \
  packages/stories/package.json
git commit -m "feat(stories): add audio generation CLI"
```

---

## Task 7: Verify the assembled workflow and run the bounded real smoke

**Files:**
- No new production modules.
- Private generated files only under `.tmp/`.

- [ ] **Step 1: Run focused/full repository checks**

```bash
bun run test
bun --filter @aquila/stories typecheck
bun --filter @aquila/stories lint
bun run compile:check
```

Expected: all pass.

- [ ] **Step 2: Re-run direct-path dry-run and inspect request/cost scope**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run
```

Confirm provider issues are empty, no credential is required, and the dated estimate is accompanied by raw duration/request counts.

- [ ] **Step 3: Ensure the Music note is still present and private**

```bash
test -s .tmp/audio-generation/theSeventhMirror/music-terms-note.md
git check-ignore .tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

- [ ] **Step 4: Perform exactly one new SFX and one new BGM generation through the assembled CLI**

Do not delete prior paid artifacts to force the smoke. First inspect current verified counts for the chosen keys and request one more total success than currently exists.

Use two one-key invocations so differing existing counts cannot accidentally schedule more than two paid requests:

```bash
# Example when camera-shutter currently has 0 verified successes:
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key camera-shutter \
  --candidate-count 1 \
  --max-requests 1

# Example when dawn-apartment currently has 0 verified successes:
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 1
```

If either key already has matching successes, set its `--candidate-count` to exactly `existingCount + 1`. Never use a destructive cleanup or reintroduce `--force`.

Total final-smoke paid requests: exactly two. Note that the real Seventh Mirror BGM spec is 90 seconds; inspect the dry-run estimate before approving this request.

- [ ] **Step 5: Select the newly generated candidates**

Run one selection per key using the new candidate ids reported by generation:

```bash
bun packages/stories/src/audio-generation/cli.ts select \
  --story theSeventhMirror \
  --key camera-shutter \
  --candidate candidate-001

bun packages/stories/src/audio-generation/cli.ts select \
  --story theSeventhMirror \
  --key dawn-apartment \
  --candidate candidate-001
```

Replace the example candidate ids with the actual newly allocated ids from the smoke; do not edit `selection.json` manually.

- [ ] **Step 6: Prove resume and HPA-609 handoff**

Re-run the same desired counts in dry-run. Expected scheduled requests for those two keys: `0` after checksum verification.

Then import the Node-only subpath in a small local check and parse/resolve the selection without provider credentials:

```bash
bun -e "import { AudioSelectionFileV1Schema } from '@aquila/stories/audio-generation'; const x=AudioSelectionFileV1Schema.parse(await Bun.file('.tmp/audio-generation/theSeventhMirror/selection.json').json()); console.log(x.storyId)"
```

Expected:

```text
the_seventh_mirror
```

- [ ] **Step 7: Final scope/secret check**

```bash
git status --short
git diff --check
git grep -n "ELEVENLABS_API_KEY" -- ':!docs/superpowers/*' ':!packages/stories/src/audio-generation/**' || true
```

Confirm no candidate bytes, receipts, selections, Music note, provider probe, or API key are staged/tracked.

---

## Risk checkpoints during implementation

- **HPA-609 import boundary:** if infra needs a deep `src/audio-generation/*` import, stop; the explicit `@aquila/stories/audio-generation` subpath is incomplete.
- **Historical paid receipt:** if changing the current model/output literal makes an old receipt unparseable rather than merely stale by hash, stop.
- **Story identity:** if any store method accepts caller-supplied `storyId`, move it back to constructor-owned state.
- **Provider compatibility:** if a new authored cue violates provider bounds, normal stories tests must catch it before API use.
- **Raw story layout:** if HPA-608 redefines `packages/stories/raw` or imports `compiler.config.ts` independently of the shared helper, stop.
- **Provider contract:** do not write exhaustive Task 3 mocks until the two-request probe transcript has been inspected.
- **Stored success:** no file-existence-only fast path; actual bytes are always hashed.
- **JSON stdout:** any captured operator JSON invoked through `bun --filter` is wrong.
- **Failure history:** a final failure must create a `candidate-NNN.failure.json` marker so the ordinal is visibly consumed without parsing a log.
- **Cost estimate:** if pricing changes, update the dated constants before relying on the amount; raw duration/request scope remains visible.

## Review resolution

Accepted:

- F1: explicit Node-only `@aquila/stories/audio-generation` subpath for HPA-609.
- F2: two-request real-provider probe before exhaustive HTTP/orchestration mocks.
- F3: historical stored-spec parser does not pin current model/output/request constants; hash owns staleness.
- F4: constructor-owned runtime `storyId`, with existing `isStoryId`/`isSha256` validation.
- F5: normal test keeps the committed Seventh Mirror plan provider-compatible.
- F6: compiler CLI and audio generation share one raw-root/config loader.
- F7: stable `0/1/2/3` exit-code contract.
- F8 cuts: remove `--force`; remove the strict parsed failure-receipt schema.

Accepted with a smaller replacement:

- Instead of `failures.jsonl`, use one unparsed `candidate-NNN.failure.json` marker. This preserves the audit trail and lets filename-only candidate-id allocation see that the ordinal is consumed.

Intentionally retained:

- The dated advisory USD estimate: HPA-608 explicitly requires a pre-spend calculable estimate; the implementation stays a two-rate calculation over the repeated scheduled spec list and exposes raw durations/request counts.
- `schemaVersion: 1` on success receipt and selection: those files are now a supported cross-package HPA-609 handoff, so strict versioned parsing has a concrete second consumer.
- The non-empty Music terms note as the deliberately small account/rights speed bump; no legal interpretation is added.

---

## Final acceptance checklist

- [ ] Provider-neutral plan schema is unchanged; `camera-shutter` is explicitly corrected to a legal provider duration.
- [ ] Current Seventh Mirror plan has zero provider issues in normal tests.
- [ ] Raw folder resolution/config loading has one shared owner.
- [ ] Current paid spec hash changes with current model/output/request inputs.
- [ ] Historical success receipts remain parseable across current model/output constant changes and become stale through spec-hash comparison.
- [ ] Store owns runtime story id and uses existing `isStoryId`/`isSha256` validators.
- [ ] Matching success always re-hashes actual bytes.
- [ ] Failure consumes an immutable candidate id without a second parsed failure schema.
- [ ] `@aquila/stories/audio-generation` exposes only the Node-side receipt/selection/store contract HPA-609 needs; root browser export stays untouched.
- [ ] Early two-request provider probe is completed before exhaustive HTTP/orchestration mocks.
- [ ] Provider 2xx requires `audio/*`; retry/redaction rules match the observed contract.
- [ ] No `--force`; higher desired candidate count requests additional explicit candidates.
- [ ] Dry-run reports raw scope plus dated advisory USD over the scheduled repeated spec list.
- [ ] Exit codes are stable: 0 success, 1 configuration, 2 input/plan, 3 provider/I/O.
- [ ] Direct file-path JSON output is parseable.
- [ ] Final assembled real smoke performs exactly one new SFX + one new BGM request and the next dry-run resumes with zero work for those desired counts.
- [ ] HPA-609 can parse the selection and verify selected source through the supported subpath without ElevenLabs credentials.
- [ ] All candidates/receipts/selections/probe/terms files remain ignored/private.
