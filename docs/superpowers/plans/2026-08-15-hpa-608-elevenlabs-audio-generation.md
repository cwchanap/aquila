# HPA-608 ElevenLabs Audio Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, resumable Bun/TypeScript workflow that turns validated Aquila `audio-plan.json` rows into bounded ElevenLabs SFX/Music candidates with private provenance and explicit verified human selection.

**Architecture:** Keep generation Node/Bun-only under `packages/stories/src/audio-generation`. Derive an exact provider spec/hash from each plan row, use direct ElevenLabs HTTP behind one injected provider seam, persist immutable candidate results under repository `.tmp/`, and store selection separately. HPA-609 consumes a verified selected source and owns normalization/R2 publication.

**Tech Stack:** TypeScript, Bun, Node `fetch`, `node:util.parseArgs`, `node:crypto`, Node filesystem APIs, existing Zod audio-plan schema, Vitest.

**Design:** `docs/superpowers/specs/2026-08-15-hpa-608-elevenlabs-audio-generation-design.md`

## Global Constraints

- Keep `audio-plan.json` provider-neutral; reuse `AudioPlanV1` / `AudioPlanAsset` unchanged.
- Do not export `audio-generation` from browser/root package exports.
- Direct HTTP only for HPA-608; no ElevenLabs SDK dependency unless implementation proves the two endpoints insufficient.
- SFX: `eleven_text_to_sound_v2`, non-looping, `mp3_44100_128`, prompt influence `0.3`.
- BGM: `music_v2`, prompt-based, `force_instrumental: true`, `output_format=auto`.
- Candidate count default `1`, valid `1..4`.
- Non-dry runs require `--max-requests 1..100`.
- Target mode is explicit keys OR `--missing`; no implicit “all”. `--force` works only with explicit keys.
- Retry only HTTP 429/5xx: initial request + at most two retries, 1s then 2s injected backoff.
- Do not retry thrown/network failures because provider acceptance/billing may be ambiguous.
- Pricing constants as of 2026-08-15: SFX `$0.12/min`, Music `$0.15/min`; label estimates advisory USD.
- Real BGM calls require non-empty `.tmp/audio-generation/<story>/music-terms-note.md`; no legal interpretation in code.
- Candidate bytes, receipts, Music note, and selection remain under ignored `.tmp/` and are never runtime metadata.
- No queue, database, worker, dashboard, provider registry, auto-ranking, runtime generation, or compatibility layer.

---

### Task 1: Derive deterministic provider specs, hashes, and cost estimates

**Files:**
- Create: `packages/stories/src/audio-generation/spec.ts`
- Create: `packages/stories/src/audio-generation/__tests__/spec.test.ts`

**Interfaces:**
- Consumes: `AudioPlanAsset`; existing `canonicalJson` helper.
- Produces:
  - `AudioGenerationSpecV1`
  - `buildAudioGenerationSpec(asset: AudioPlanAsset): AudioGenerationSpecV1`
  - `audioGenerationSpecSha256(spec: AudioGenerationSpecV1): string`
  - `estimateAudioGenerationCostUsd(specs: readonly AudioGenerationSpecV1[]): number`
  - `ELEVENLABS_PRICING_AS_OF`

- [ ] **Step 1: Write failing exact-mapping tests**

```ts
import { describe, expect, it } from 'vitest';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
    ELEVENLABS_PRICING_AS_OF,
    estimateAudioGenerationCostUsd,
} from '../spec';

describe('audio generation spec', () => {
    it('maps SFX to the fixed ElevenLabs request inputs', () => {
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

    it('maps BGM to instrumental music_v2 while retaining loop intent', () => {
        expect(
            buildAudioGenerationSpec({
                key: 'dawn-apartment',
                type: 'bgm',
                prompt: 'Cold Tokyo dawn underscore, seamless loop',
                durationMs: 90_000,
                loop: true,
            })
        ).toEqual({
            schemaVersion: 1,
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Cold Tokyo dawn underscore, seamless loop',
            durationMs: 90_000,
            provider: 'elevenlabs',
            modelId: 'music_v2',
            outputFormat: 'auto',
            loopIntent: true,
            forceInstrumental: true,
        });
    });

    it('changes the hash when a paid-generation input changes', () => {
        const base = buildAudioGenerationSpec({
            key: 'impact',
            type: 'sfx',
            prompt: 'Muted impact',
            durationMs: 900,
        });
        const changed = { ...base, durationMs: 1000 };

        expect(audioGenerationSpecSha256(base)).toMatch(/^[a-f0-9]{64}$/);
        expect(audioGenerationSpecSha256(changed)).not.toBe(
            audioGenerationSpecSha256(base)
        );
    });

    it('estimates current API USD rates from intended duration', () => {
        const specs = [
            buildAudioGenerationSpec({
                key: 'long-sfx',
                type: 'sfx',
                prompt: 'Thirty second ambience',
                durationMs: 30_000,
            }),
            buildAudioGenerationSpec({
                key: 'music',
                type: 'bgm',
                prompt: 'Instrumental underscore',
                durationMs: 60_000,
                loop: true,
            }),
        ];

        expect(estimateAudioGenerationCostUsd(specs)).toBeCloseTo(0.21, 8);
        expect(ELEVENLABS_PRICING_AS_OF).toBe('2026-08-15');
    });
});
```

Also assert SFX `499ms` / `30001ms` and BGM `2999ms` / `600001ms` throw rather than clamp.

- [ ] **Step 2: Verify the focused test fails**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/spec.test.ts
```

Expected: FAIL because `../spec` does not exist.

- [ ] **Step 3: Implement the exact union and helpers**

```ts
import { createHash } from 'node:crypto';
import type { AudioPlanAsset } from '../audio-plan';
import { canonicalJson, type JsonValue } from '../runtime-assets/canonical';

export const ELEVENLABS_PRICING_AS_OF = '2026-08-15' as const;
const SFX_USD_PER_MINUTE = 0.12;
const MUSIC_USD_PER_MINUTE = 0.15;

export type AudioGenerationSpecV1 =
    | {
          readonly schemaVersion: 1;
          readonly key: string;
          readonly type: 'sfx';
          readonly prompt: string;
          readonly durationMs: number;
          readonly provider: 'elevenlabs';
          readonly modelId: 'eleven_text_to_sound_v2';
          readonly outputFormat: 'mp3_44100_128';
          readonly loop: false;
          readonly promptInfluence: 0.3;
      }
    | {
          readonly schemaVersion: 1;
          readonly key: string;
          readonly type: 'bgm';
          readonly prompt: string;
          readonly durationMs: number;
          readonly provider: 'elevenlabs';
          readonly modelId: 'music_v2';
          readonly outputFormat: 'auto';
          readonly loopIntent: true;
          readonly forceInstrumental: true;
      };

export function audioGenerationSpecSha256(
    spec: AudioGenerationSpecV1
): string {
    return createHash('sha256')
        .update(canonicalJson(spec as unknown as JsonValue))
        .digest('hex');
}
```

`buildAudioGenerationSpec` performs provider duration validation. `estimateAudioGenerationCostUsd` sums `durationMs / 60_000 * rate` with no internal rounding. Do not include `asset.notes` because notes are not provider input.

- [ ] **Step 4: Verify Task 1 passes and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/spec.test.ts
git add packages/stories/src/audio-generation/spec.ts packages/stories/src/audio-generation/__tests__/spec.test.ts
git commit -m "feat(stories): define audio generation specs"
```

---

### Task 2: Persist immutable local candidates and receipts

**Files:**
- Create: `packages/stories/src/audio-generation/store.ts`
- Create: `packages/stories/src/audio-generation/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `AudioGenerationSpecV1`.
- Produces: `GeneratedAudioCandidate`, `AudioCandidateReceiptV1`, `VerifiedStoredCandidate`, `LocalAudioGenerationStore`.

- [ ] **Step 1: Write failing temp-directory persistence/integrity tests**

Use `mkdtemp(join(tmpdir(), 'aquila-audio-'))`. Cover:

1. success writes `candidate-001.mp3` + `candidate-001.receipt.json`;
2. matching-success lookup counts only the requested `specSha256`;
3. spec change makes old success stale without deletion;
4. orphan audio with no receipt does not count as complete;
5. missing or tampered bytes fail `readVerifiedCandidate`;
6. final failure writes immutable `candidate-002.failure.json`;
7. `nextCandidateId` scans success/failure/orphan ordinals and returns the next unused ID.

Representative integrity test:

```ts
const stored = await store.writeSuccess({
    storyId: 'theSeventhMirror',
    candidateId: 'candidate-001',
    spec,
    specSha256,
    generated: {
        bytes: new TextEncoder().encode('audio-bytes'),
        extension: 'mp3',
        mediaType: 'audio/mpeg',
        format: 'mp3_44100_128',
        actualDurationMs: null,
        providerMetadata: {},
    },
});
await writeFile(stored.audioPath, 'tampered');
await expect(
    store.readVerifiedCandidate('theSeventhMirror', 'door-open', 'candidate-001')
).rejects.toThrow(/sha-?256|checksum/i);
```

- [ ] **Step 2: Verify the store test fails**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts
```

- [ ] **Step 3: Implement the minimal local store**

```ts
export interface GeneratedAudioCandidate {
    readonly bytes: Uint8Array;
    readonly extension: string;
    readonly mediaType: string;
    readonly format: string;
    readonly actualDurationMs: number | null;
    readonly providerMetadata: {
        readonly requestId?: string;
        readonly traceId?: string;
        readonly songId?: string;
        readonly billingMetadata?: string;
    };
}

export interface AudioCandidateReceiptV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly key: string;
    readonly type: 'sfx' | 'bgm';
    readonly candidateId: string;
    readonly spec: AudioGenerationSpecV1;
    readonly specSha256: string;
    readonly provider: 'elevenlabs';
    readonly modelId: string;
    readonly createdAt: string;
    readonly intendedDurationMs: number;
    readonly actualDurationMs: number | null;
    readonly output: {
        readonly filename: string;
        readonly mediaType: string;
        readonly format: string;
        readonly byteLength: number;
        readonly sha256: string;
    };
    readonly providerMetadata: GeneratedAudioCandidate['providerMetadata'];
}
```

Required store methods:

```ts
matchingSuccessfulCandidates(storyId, key, specSha256)
nextCandidateId(storyId, key)
writeSuccess({ storyId, candidateId, spec, specSha256, generated })
writeFailure({ storyId, candidateId, spec, specSha256, failure })
readVerifiedCandidate(storyId, key, candidateId)
hasMusicTermsNote(storyId)
```

Rules:

- IDs are `candidate-001`, `candidate-002`, ... and are never reused after success/failure/orphan observation.
- Source bytes are written first; success receipt uses temp-file + rename.
- `readVerifiedCandidate` recomputes byte length + SHA-256.
- `matchingSuccessfulCandidates` may avoid rehashing every source for dry-run, but requires the referenced source path to exist.
- `actualDurationMs` remains `null` when the provider does not supply measured duration.
- Failure receipt stores only candidate/spec/hash/timestamp + sanitized kind/status/message.

- [ ] **Step 4: Verify Task 2 passes and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts
git add packages/stories/src/audio-generation/store.ts packages/stories/src/audio-generation/__tests__/store.test.ts
git commit -m "feat(stories): persist audio generation candidates"
```

---

### Task 3: Add direct ElevenLabs request mapping and bounded retries

**Files:**
- Create: `packages/stories/src/audio-generation/elevenlabs.ts`
- Create: `packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts`

**Interfaces:**
- Consumes: Task 1 specs; Task 2 generated-candidate type.
- Produces: `AudioGenerationProvider`, `ElevenLabsProviderError`, `createElevenLabsAudioProvider`.

- [ ] **Step 1: Write failing exact HTTP mapping tests**

Provider seam:

```ts
export interface AudioGenerationProvider {
    generate(
        spec: AudioGenerationSpecV1,
        apiKey: string
    ): Promise<GeneratedAudioCandidate>;
}
```

Assert SFX maps to:

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

Assert BGM maps to `/v1/music?output_format=auto` with:

```ts
JSON.stringify({
    prompt: 'Cold Tokyo dawn underscore',
    music_length_ms: 90_000,
    model_id: 'music_v2',
    force_instrumental: true,
    store_for_inpainting: false,
    sign_with_c2pa: false,
})
```

Do not send a BGM `loop` field; loop is local intent only.

- [ ] **Step 2: Add retry/error/redaction tests**

Test:

- 429, 200 => 2 fetches, sleep `[1000]`;
- 500, 503, 200 => 3 fetches, sleeps `[1000, 2000]`;
- third 5xx => throw;
- 401/402/403/422 => one fetch, no sleep;
- thrown fetch error => one fetch, no retry;
- API key never appears in thrown error/message;
- only `request-id`, `x-trace-id`, `song-id`, `character-cost` are copied into metadata.

- [ ] **Step 3: Verify tests fail, then implement**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/elevenlabs.test.ts
```

Implementation dependencies:

```ts
export interface ElevenLabsProviderDependencies {
    readonly fetchImpl?: typeof fetch;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly baseUrl?: string;
}
```

Defaults are `globalThis.fetch`, normal `setTimeout`, and `https://api.elevenlabs.io`.

Classify provider failures as `rate-limit | server | authentication | payment | invalid-request | network`. Never serialize request headers or environment. A short provider response message is allowed only after redacting the API key.

Successful response returns raw `Uint8Array`, MIME type, requested format/extension, `actualDurationMs: null`, and whitelisted metadata.

- [ ] **Step 4: Verify and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/elevenlabs.test.ts
git add packages/stories/src/audio-generation/elevenlabs.ts packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts
git commit -m "feat(stories): add ElevenLabs audio provider"
```

---

### Task 4: Plan and execute bounded resumable batches

**Files:**
- Create: `packages/stories/src/audio-generation/run.ts`
- Create: `packages/stories/src/audio-generation/__tests__/run.test.ts`

**Interfaces:**
- Consumes: `AudioPlanV1`, Tasks 1–3.
- Produces: `AudioGenerationOptions`, `AudioGenerationPlan`, `planAudioGeneration`, `runAudioGeneration`.

- [ ] **Step 1: Write failing planner tests**

Options:

```ts
export interface AudioGenerationOptions {
    readonly storyId: string;
    readonly keys?: readonly string[];
    readonly missing: boolean;
    readonly candidateCount: number;
    readonly force: boolean;
    readonly dryRun: boolean;
    readonly maxRequests?: number;
}
```

Cover:

1. neither key nor missing => error;
2. keys + missing => error;
3. duplicate keys dedupe, while result order follows plan order;
4. unknown key => error;
5. candidate count outside `1..4` => error;
6. force + missing => error;
7. normal explicit/missing mode requests only current-spec deficits;
8. force requests exactly `candidateCount` additional candidates;
9. IDs start after every observed success/failure/orphan ordinal;
10. request cap takes a deterministic prefix and reports deferred count.

Use a two-key fixture with `candidateCount: 2` and one existing success to assert total deficit/request ordering exactly.

- [ ] **Step 2: Write failing execution/preflight tests**

Cover:

- dry-run never calls provider and never needs API key;
- report has per-kind counts/durations, logical requests, execution count, deferred count, pricing date/amount, Music-note presence;
- real SFX-only run does not require Music note;
- any real BGM execution fails before provider call if Music note is absent/blank;
- zero execution items succeeds without API key;
- non-empty execution requires API key;
- success persists before moving to next logical item;
- final provider failure persists `candidate-NNN.failure.json`, stops, and keeps earlier successes;
- next `--missing` run skips earlier successes, allocates the next candidate ID for the still-missing key, and continues.

- [ ] **Step 3: Verify tests fail, then implement planner**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/run.test.ts
```

For each target asset:

```ts
const successful = await store.matchingSuccessfulCandidates(
    options.storyId,
    asset.key,
    specSha256
);
const needed = options.force
    ? options.candidateCount
    : Math.max(0, options.candidateCount - successful.length);
```

Allocate planned candidate IDs from `nextCandidateId` plus local increments without writing anything during planning.

`AudioGenerationPlan` includes:

```ts
{
    storyId,
    keyCount,
    sfx: { keys, durationMs },
    bgm: { keys, durationMs },
    candidateCount,
    logicalRequests,
    executionItems,
    deferredByRequestCap,
    estimatedCost: { currency: 'USD', amount, pricingAsOf },
    musicTermsNotePresent,
}
```

Estimate all logical requested candidates, not just the capped execution prefix.

- [ ] **Step 4: Implement sequential execution**

Order:

1. build plan;
2. dry-run => return plan/report;
3. no execution items => return success;
4. if execution contains BGM, require Music note;
5. require API key;
6. sequentially call provider and write success;
7. on provider failure, write immutable failure receipt and throw immediately.

Do not parallelize generation.

- [ ] **Step 5: Verify and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/run.test.ts
git add packages/stories/src/audio-generation/run.ts packages/stories/src/audio-generation/__tests__/run.test.ts
git commit -m "feat(stories): add resumable audio generation runner"
```

---

### Task 5: Add explicit verified human selection

**Files:**
- Create: `packages/stories/src/audio-generation/select.ts`
- Create: `packages/stories/src/audio-generation/__tests__/select.test.ts`
- Modify: `packages/stories/src/audio-generation/store.ts`
- Modify: `packages/stories/src/audio-generation/__tests__/store.test.ts`

**Interfaces:**
- Consumes: current plan, Task 1 current spec/hash, Task 2 verified source reader.
- Produces: `AudioSelectionFileV1`, `selectAudioCandidate`, store selection read/write methods.

- [ ] **Step 1: Add selection file tests**

Selection shape:

```ts
export interface AudioSelectionFileV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly selections: Readonly<
        Record<
            string,
            {
                readonly candidateId: string;
                readonly specSha256: string;
                readonly sourceSha256: string;
                readonly selectedAt: string;
            }
        >
    >;
}
```

Missing `<story>/selection.json` reads as an empty v1 selection object. Writes are temp + rename.

- [ ] **Step 2: Write failing selection validation tests**

Cover:

- valid current success is selected;
- replacing one key preserves other selections;
- unknown key fails;
- failure-only candidate fails;
- changed prompt/duration causing spec-hash mismatch fails;
- tampered/missing source fails on recomputed byte/hash verification;
- selection never deletes candidate bytes/receipts.

Core algorithm:

```ts
const asset = plan.assets.find(item => item.key === key);
if (!asset) throw new Error(`Unknown audio key: ${key}`);

const currentSpec = buildAudioGenerationSpec(asset);
const currentSpecSha256 = audioGenerationSpecSha256(currentSpec);
const candidate = await store.readVerifiedCandidate(storyId, key, candidateId);

if (candidate.receipt.specSha256 !== currentSpecSha256) {
    throw new Error(`Audio candidate ${candidateId} is stale for ${key}`);
}
```

Then update exactly `selections[key]` using verified source SHA + injected timestamp.

- [ ] **Step 3: Verify and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts src/audio-generation/__tests__/select.test.ts
git add packages/stories/src/audio-generation/store.ts packages/stories/src/audio-generation/select.ts packages/stories/src/audio-generation/__tests__/store.test.ts packages/stories/src/audio-generation/__tests__/select.test.ts
git commit -m "feat(stories): verify audio candidate selections"
```

---

### Task 6: Wire the Bun CLI and package scripts

**Files:**
- Create: `packages/stories/src/audio-generation/cli.ts`
- Create: `packages/stories/src/audio-generation/__tests__/cli.test.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**
- Consumes: `loadAudioPlan`, Tasks 2–5, `ELEVENLABS_API_KEY` from environment.
- Produces package commands `audio:generate`, `audio:select`; no package-root export.

- [ ] **Step 1: Write failing CLI parsing/redaction tests**

Generation options:

```ts
const generateOptions = {
    story: { type: 'string' },
    key: { type: 'string', multiple: true },
    missing: { type: 'boolean' },
    'candidate-count': { type: 'string' },
    'dry-run': { type: 'boolean' },
    force: { type: 'boolean' },
    'max-requests': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
} as const;
```

Selection options:

```ts
const selectOptions = {
    story: { type: 'string' },
    key: { type: 'string' },
    candidate: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
} as const;
```

Assert missing/contradictory selectors, invalid candidate count, non-dry missing max requests, and unknown command fail as usage errors. Assert dry-run works with no API key. Assert stdout/stderr never contain an injected API key or full prompt.

- [ ] **Step 2: Verify CLI test fails**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/cli.test.ts
```

- [ ] **Step 3: Implement fixed path/dependency wiring**

Resolve paths from `import.meta.url`, not current working directory:

```ts
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const rawRoot = join(repositoryRoot, 'packages', 'stories', 'raw');
const storeRoot = join(repositoryRoot, '.tmp', 'audio-generation');
```

Before using `story` as a path, require `<rawRoot>/<story>/compiler.config.ts` to exist, then call `loadAudioPlan(rawDir)` and require a plan.

`generate` parses/wires store/provider/options and prints one concise JSON report. `select` loads the same current plan, validates selection, and prints story/key/candidate/source hash only. Never print prompt or receipt body.

- [ ] **Step 4: Add scripts; leave exports unchanged**

In `packages/stories/package.json`:

```json
"audio:generate": "bun src/audio-generation/cli.ts generate",
"audio:select": "bun src/audio-generation/cli.ts select"
```

Do not edit `packages/stories/src/index.ts` or package `exports`.

- [ ] **Step 5: Verify the CLI and a real-repo dry run**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/cli.test.ts
bun --filter @aquila/stories test

env -u ELEVENLABS_API_KEY bun --filter @aquila/stories audio:generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --max-requests 10 \
  --dry-run
```

Expected dry-run with a clean local store: 28 SFX, 13 BGM, 41 logical requests, 10 in the capped execution prefix, 31 deferred, dated advisory USD estimate, no provider call.

- [ ] **Step 6: Commit**

```bash
git add packages/stories/src/audio-generation/cli.ts packages/stories/src/audio-generation/__tests__/cli.test.ts packages/stories/package.json
git commit -m "feat(stories): add audio generation CLI"
```

---

### Task 7: Run one bounded real-provider smoke and final verification

**Files:**
- No tracked files expected from the smoke.
- Local only: `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`
- Local only: generated candidates/receipts/selection under `.tmp/audio-generation/theSeventhMirror/`

**Interfaces:**
- Consumes complete CLI.
- Produces evidence for at most one real SFX + one real BGM generation.

- [ ] **Step 1: Run all mocked/repository checks before paid usage**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
```

All must pass before smoke.

- [ ] **Step 2: Record the current Music preflight note**

Create `.tmp/audio-generation/theSeventhMirror/music-terms-note.md` and write the actual account/plan in use, the actual check date for API pricing, the actual check date for Music Terms + Music API Terms + model-specific terms, the intended Aquila distribution/use case, and the operator's concise decision that generation/distribution is permitted for that account/use.

Do not copy an assumed plan name into the repository and do not commit this file.

- [ ] **Step 3: Dry-run exactly the smoke keys**

```bash
bun --filter @aquila/stories audio:generate \
  --story theSeventhMirror \
  --key door-open \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2 \
  --dry-run
```

Expected: two logical candidate requests, one SFX + one BGM, zero provider calls.

- [ ] **Step 4: Execute no more than those two logical requests**

With `ELEVENLABS_API_KEY` set only in the shell environment:

```bash
bun --filter @aquila/stories audio:generate \
  --story theSeventhMirror \
  --key door-open \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2
```

Expected: success receipts/source bytes for each key, matching hashes, no credential leakage. If either logical candidate fails after bounded retries, stop; do not expand the smoke.

- [ ] **Step 5: Select both successful smoke candidates**

Use the successful candidate IDs printed by the generation report. For a clean first run they should be `candidate-001`:

```bash
bun --filter @aquila/stories audio:select \
  --story theSeventhMirror \
  --key door-open \
  --candidate candidate-001

bun --filter @aquila/stories audio:select \
  --story theSeventhMirror \
  --key dawn-apartment \
  --candidate candidate-001
```

If the local store already contained failed/stale candidates, use the actual new success IDs instead of forcing ordinal `001`.

- [ ] **Step 6: Prove resume is now a no-op for those current-spec keys**

```bash
bun --filter @aquila/stories audio:generate \
  --story theSeventhMirror \
  --key door-open \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2 \
  --dry-run
```

Expected: `logicalRequests: 0` for those two current-spec successes.

- [ ] **Step 7: Run final verification**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
git diff --check
git status --short
```

Expected: `.tmp/audio-generation/**` is not tracked; only intended HPA-608 source/tests/package-script changes exist.

---

## Final acceptance checklist

- [ ] `audio-plan.json` remains the only authored generation-intent inventory.
- [ ] Exact SFX/BGM provider mapping is tested.
- [ ] Current-spec successes skip; spec changes make old successes stale without deletion.
- [ ] Failed candidate IDs are immutable/consumed; resumed work allocates new IDs.
- [ ] Targeting, candidate count, dry-run, force, and request cap match the design.
- [ ] Generation is sequential and bounded.
- [ ] 429/5xx retries are bounded; deterministic 4xx/network ambiguity does not retry.
- [ ] Private candidates/receipts/selection/Music note stay under `.tmp/`.
- [ ] API key is absent from logs, receipts, and tracked files.
- [ ] Real BGM generation is blocked until the manual Music note exists.
- [ ] Dry-run reports advisory USD with pricing date, not a fabricated credit conversion.
- [ ] Selection re-verifies current spec and source checksum.
- [ ] HPA-609 can consume a selected verified source without ElevenLabs credentials.
- [ ] One SFX + one BGM real smoke stays within two logical generation requests.
- [ ] `bun --filter @aquila/stories test`, `bun --filter @aquila/stories lint`, and `bun run compile:check` pass.
