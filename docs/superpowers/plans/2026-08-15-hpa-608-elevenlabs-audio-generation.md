# HPA-608 ElevenLabs Audio Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, resumable Bun/TypeScript workflow that turns validated Aquila `audio-plan.json` rows into bounded ElevenLabs SFX/Music candidates with private provenance and explicit verified human selection.

**Architecture:** Keep all generation code Node/Bun-only under `packages/stories/src/audio-generation` and out of browser exports. Derive a deterministic provider generation spec/hash from each validated plan row, use direct ElevenLabs HTTP behind one injected provider interface, persist source bytes/receipts under the already-ignored repository `.tmp/` tree, and keep `selection.json` separate from generation provenance. HPA-609 consumes only a verified selected source; HPA-608 never publishes or builds runtime manifests.

**Tech Stack:** TypeScript, Bun, Node `fetch`, `node:util.parseArgs`, `node:crypto`, Node filesystem APIs, Zod through the existing audio-plan schema, Vitest.

**Design:** `docs/superpowers/specs/2026-08-15-hpa-608-elevenlabs-audio-generation-design.md`

## Global Constraints

- Use the existing strict `AudioPlanV1` / `AudioPlanAsset` contract; do not add provider fields to `audio-plan.json`.
- Keep `audio-generation` Node/Bun-only and do not export it from `packages/stories/src/index.ts`.
- Use direct ElevenLabs HTTP. Do not add `@elevenlabs/elevenlabs-js` unless the two-endpoint direct adapter proves insufficient during implementation.
- SFX model: `eleven_text_to_sound_v2`, explicit non-looping, output request `mp3_44100_128`, prompt influence `0.3`.
- BGM model: `music_v2`, `force_instrumental: true`, `output_format=auto`, no composition plans, references, finetunes, stems, inpainting, or streaming.
- `--candidate-count` defaults to `1` and accepts `1..4`.
- Non-dry generation requires `--max-requests 1..100`.
- Exactly one target mode: one or more `--key`, or `--missing`; `--force` is explicit-key-only.
- Retry only 429 and 5xx, at most two retries after the initial HTTP attempt, with injected 1s/2s backoff.
- Do not retry thrown/network failures because provider acceptance/billing may be ambiguous.
- Current dry-run pricing constants: Sound Effects `$0.12/min`, Music `$0.15/min`, `pricingAsOf = 2026-08-15`; label the estimate as advisory USD rather than inventing credits.
- Real BGM generation requires non-empty `.tmp/audio-generation/<story>/music-terms-note.md`; the code checks presence only and does not make a legal decision.
- Never commit generated candidates, provider receipts, selection state, Music terms notes, or prompts copied into receipts; `.tmp/` remains the private local boundary.
- Do not add compatibility aliases, a queue, database, worker, dashboard, generic provider registry, or runtime generation path.

---

### Task 1: Derive deterministic ElevenLabs generation specs and current cost estimates

**Files:**
- Create: `packages/stories/src/audio-generation/spec.ts`
- Create: `packages/stories/src/audio-generation/__tests__/spec.test.ts`

**Interfaces:**
- Consumes: `AudioPlanAsset` from `packages/stories/src/audio-plan.ts`; `canonicalJson` from `packages/stories/src/runtime-assets/canonical.ts`.
- Produces:
  - `AudioGenerationSpecV1`
  - `buildAudioGenerationSpec(asset: AudioPlanAsset): AudioGenerationSpecV1`
  - `audioGenerationSpecSha256(spec: AudioGenerationSpecV1): string`
  - `estimateAudioGenerationCostUsd(specs: readonly AudioGenerationSpecV1[]): number`
  - `ELEVENLABS_PRICING_AS_OF`

- [ ] **Step 1: Write exact mapping/hash/cost tests**

Create `spec.test.ts` with focused examples for one SFX and one BGM:

```ts
import { describe, expect, it } from 'vitest';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
    ELEVENLABS_PRICING_AS_OF,
    estimateAudioGenerationCostUsd,
} from '../spec';

describe('buildAudioGenerationSpec', () => {
    it('maps an SFX plan row to the fixed ElevenLabs v2 request contract', () => {
        const spec = buildAudioGenerationSpec({
            key: 'door-open',
            type: 'sfx',
            prompt: 'Heavy apartment door opening',
            durationMs: 2200,
        });

        expect(spec).toEqual({
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

    it('maps BGM to music_v2 instrumental generation and preserves loop intent', () => {
        const spec = buildAudioGenerationSpec({
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Cold Tokyo dawn underscore, seamless loop',
            durationMs: 90_000,
            loop: true,
        });

        expect(spec).toEqual({
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

    it('changes the spec hash when a paid generation input changes', () => {
        const base = buildAudioGenerationSpec({
            key: 'impact',
            type: 'sfx',
            prompt: 'Muted impact',
            durationMs: 900,
        });
        const changed = { ...base, durationMs: 1000 };

        expect(audioGenerationSpecSha256(base)).not.toBe(
            audioGenerationSpecSha256(changed)
        );
        expect(audioGenerationSpecSha256(base)).toMatch(/^[a-f0-9]{64}$/);
    });

    it('estimates current ElevenAPI USD cost from intended duration', () => {
        const specs = [
            buildAudioGenerationSpec({
                key: 'impact',
                type: 'sfx',
                prompt: 'Muted impact',
                durationMs: 60_000,
            }),
            buildAudioGenerationSpec({
                key: 'music',
                type: 'bgm',
                prompt: 'Instrumental underscore',
                durationMs: 60_000,
                loop: true,
            }),
        ];

        expect(estimateAudioGenerationCostUsd(specs)).toBeCloseTo(0.27, 8);
        expect(ELEVENLABS_PRICING_AS_OF).toBe('2026-08-15');
    });
});
```

Add duration-bound tests:

```ts
expect(() =>
    buildAudioGenerationSpec({
        key: 'too-long',
        type: 'sfx',
        prompt: 'Long effect',
        durationMs: 30_001,
    })
).toThrow(/0.5.*30 seconds/i);

expect(() =>
    buildAudioGenerationSpec({
        key: 'too-short-music',
        type: 'bgm',
        prompt: 'Tiny cue',
        durationMs: 2_999,
        loop: true,
    })
).toThrow(/3000.*600000/i);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/spec.test.ts
```

Expected: FAIL because `../spec` does not exist.

- [ ] **Step 3: Implement the fixed spec union, provider bounds, hash, and dated pricing**

Create `spec.ts` with these exported shapes/constants:

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

Implement `buildAudioGenerationSpec` with hard provider duration validation and no clamping. Implement `estimateAudioGenerationCostUsd` as the sum of `durationMs / 60_000 * rate` by type; do not round inside the function.

Do not hash `asset.notes` because notes are not sent to the provider.

- [ ] **Step 4: Run the spec tests**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/spec.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the spec slice**

```bash
git add packages/stories/src/audio-generation/spec.ts packages/stories/src/audio-generation/__tests__/spec.test.ts
git commit -m "feat(stories): define audio generation specs"
```

---

### Task 2: Persist candidates, receipts, failures, and integrity state under `.tmp/`

**Files:**
- Create: `packages/stories/src/audio-generation/store.ts`
- Create: `packages/stories/src/audio-generation/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `AudioGenerationSpecV1` from Task 1.
- Produces:
  - `GeneratedAudioCandidate`
  - `AudioCandidateReceiptV1`
  - `VerifiedStoredCandidate`
  - `LocalAudioGenerationStore`
  - `candidateIdFor(index: number): string`

- [ ] **Step 1: Write persistence/resume/integrity tests with a temporary root**

Use `mkdtemp`, not the repository `.tmp/`, in tests:

```ts
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalAudioGenerationStore } from '../store';
```

Cover these behaviors explicitly:

1. writing candidate bytes + receipt produces `candidate-001.mp3` and `candidate-001.receipt.json`;
2. `matchingSuccessfulCandidates(storyId, key, specSha256)` returns only success receipts matching that spec hash;
3. changing `specSha256` makes an old success stale without deleting it;
4. a receipt referencing missing bytes throws integrity error;
5. modifying the stored bytes after receipt creation throws checksum error;
6. orphan audio with no success receipt is not counted as complete;
7. failure receipts use `candidate-001.attempt-001.failure.json`, then `attempt-002`, and do not replace a success receipt;
8. `nextCandidateId` advances past every observed candidate ordinal so `--force` cannot overwrite old bytes.

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

- [ ] **Step 2: Run the store test and verify failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/store.test.ts
```

Expected: FAIL because `../store` does not exist.

- [ ] **Step 3: Implement the local store with no storage abstraction beyond this one class**

The core result/receipt types are:

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

`LocalAudioGenerationStore` accepts `root` and injected `now`:

```ts
export class LocalAudioGenerationStore {
    constructor(
        readonly root: string,
        private readonly now: () => Date = () => new Date()
    ) {}

    async matchingSuccessfulCandidates(
        storyId: string,
        key: string,
        specSha256: string
    ): Promise<readonly VerifiedStoredCandidate[]>;

    async nextCandidateId(storyId: string, key: string): Promise<string>;

    async writeSuccess(input: {
        storyId: string;
        candidateId: string;
        spec: AudioGenerationSpecV1;
        specSha256: string;
        generated: GeneratedAudioCandidate;
    }): Promise<VerifiedStoredCandidate>;

    async writeFailure(input: {
        storyId: string;
        candidateId: string;
        spec: AudioGenerationSpecV1;
        specSha256: string;
        failure: { kind: string; status?: number; message: string };
    }): Promise<string>;

    async readVerifiedCandidate(
        storyId: string,
        key: string,
        candidateId: string
    ): Promise<VerifiedStoredCandidate>;

    async hasMusicTermsNote(storyId: string): Promise<boolean>;
}
```

Use local candidate ordinals `candidate-001`, `candidate-002`, etc. Store all paths beneath `<root>/<story>/<key>/` and reject path traversal by relying on validated story/key values from existing schemas/plan, not arbitrary path fragments.

Write audio bytes first. Write JSON through `<path>.tmp` then `rename()` to the final receipt/selection path. A process killed between byte and receipt writes leaves an orphan byte file that is not counted as successful.

Success verification must recompute file byte length and SHA-256 every time `readVerifiedCandidate` is used for selection. Listing/missing planning may trust the success receipt's `specSha256` only after confirming the referenced file exists; do not rehash every candidate merely to print a dry-run.

- [ ] **Step 4: Run store tests**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add packages/stories/src/audio-generation/store.ts packages/stories/src/audio-generation/__tests__/store.test.ts
git commit -m "feat(stories): persist audio generation candidates"
```

---

### Task 3: Add the direct ElevenLabs provider adapter with bounded retries

**Files:**
- Create: `packages/stories/src/audio-generation/elevenlabs.ts`
- Create: `packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts`

**Interfaces:**
- Consumes: `AudioGenerationSpecV1` from Task 1; `GeneratedAudioCandidate` from Task 2.
- Produces:
  - `AudioGenerationProvider`
  - `ElevenLabsProviderError`
  - `createElevenLabsAudioProvider(deps?: ElevenLabsProviderDependencies): AudioGenerationProvider`

- [ ] **Step 1: Write request-mapping tests using an injected `fetch`**

Define the provider seam in `elevenlabs.ts`:

```ts
export interface AudioGenerationProvider {
    generate(
        spec: AudioGenerationSpecV1,
        apiKey: string
    ): Promise<GeneratedAudioCandidate>;
}
```

Test SFX request mapping:

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

Test BGM request mapping:

```ts
expect(fetchMock).toHaveBeenCalledWith(
    'https://api.elevenlabs.io/v1/music?output_format=auto',
    expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
            prompt: 'Cold Tokyo dawn underscore',
            music_length_ms: 90_000,
            model_id: 'music_v2',
            force_instrumental: true,
            store_for_inpainting: false,
            sign_with_c2pa: false,
        }),
    })
);
```

The BGM request must not add a nonexistent provider `loop` parameter; loop remains local intent in the spec/prompt.

- [ ] **Step 2: Write retry/error/redaction tests**

Cover:

- 429 then 200 -> exactly two HTTP attempts and one injected 1s sleep;
- 500, 503, 200 -> exactly three attempts and sleeps `[1000, 2000]`;
- third 5xx -> throws after three attempts;
- 401/402/403/422 -> one attempt, no sleep;
- thrown `fetch` error -> one attempt, no retry;
- `error.message`, serialized failure metadata, and any public `toString()` never contain the supplied API key;
- response headers `request-id`, `x-trace-id`, `song-id`, and `character-cost` are copied only into the optional non-secret metadata fields.

- [ ] **Step 3: Run the provider test and verify failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/elevenlabs.test.ts
```

Expected: FAIL because the provider module does not exist.

- [ ] **Step 4: Implement the two-endpoint adapter**

Use dependencies instead of a generic client framework:

```ts
export interface ElevenLabsProviderDependencies {
    readonly fetchImpl?: typeof fetch;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly baseUrl?: string;
}

export function createElevenLabsAudioProvider(
    dependencies: ElevenLabsProviderDependencies = {}
): AudioGenerationProvider;
```

Defaults:

```ts
const fetchImpl = dependencies.fetchImpl ?? globalThis.fetch;
const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
        new Promise<void>(resolve => setTimeout(resolve, milliseconds)));
const baseUrl = dependencies.baseUrl ?? 'https://api.elevenlabs.io';
```

Retry only based on an actual HTTP response status of `429` or `>=500`. For a thrown fetch/network error, throw a sanitized `ElevenLabsProviderError('network', undefined, 'ElevenLabs request failed before a usable response')` immediately.

For non-OK responses, classify at least:

```ts
type ProviderFailureKind =
    | 'rate-limit'
    | 'server'
    | 'authentication'
    | 'payment'
    | 'invalid-request'
    | 'network';
```

Do not dump response/request headers or environment data into errors. Reading a short provider error body for a human message is allowed, but strip/replace the API key if it somehow appears.

For successful binary responses, return `Uint8Array(await response.arrayBuffer())`, `content-type`, the requested output-format string, an extension inferred from the documented/requested format, `actualDurationMs: null`, and the whitelisted metadata headers only.

- [ ] **Step 5: Run provider tests**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/elevenlabs.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the provider slice**

```bash
git add packages/stories/src/audio-generation/elevenlabs.ts packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts
git commit -m "feat(stories): add ElevenLabs audio provider"
```

---

### Task 4: Plan and execute bounded resumable generation batches

**Files:**
- Create: `packages/stories/src/audio-generation/run.ts`
- Create: `packages/stories/src/audio-generation/__tests__/run.test.ts`

**Interfaces:**
- Consumes:
  - `AudioPlanV1` from `audio-plan.ts`
  - spec/hash/cost functions from Task 1
  - `LocalAudioGenerationStore` from Task 2
  - `AudioGenerationProvider` / provider errors from Task 3
- Produces:
  - `AudioGenerationOptions`
  - `AudioGenerationPlan`
  - `planAudioGeneration(...)`
  - `runAudioGeneration(...)`

- [ ] **Step 1: Write planning tests before execution tests**

Use this options shape:

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

Test the exact target semantics:

1. no `keys` and `missing=false` -> error;
2. `keys` plus `missing=true` -> error;
3. duplicate explicit keys are de-duplicated while preserving plan order;
4. unknown key -> error before provider calls;
5. `candidateCount=0` or `5` -> error;
6. `force=true` with `missing=true` -> error;
7. normal explicit key generation requests only the deficit to `candidateCount` for the current spec hash;
8. `force=true` requests exactly `candidateCount` additional candidates with fresh ordinals;
9. `missing=true` walks the whole plan in authored plan order and fills only current-spec deficits;
10. `maxRequests` takes a deterministic prefix and reports `deferredByRequestCap` rather than failing the whole large batch.

Representative resume test:

```ts
const first = await planAudioGeneration({
    plan,
    store,
    options: {
        storyId: 'theSeventhMirror',
        missing: true,
        candidateCount: 2,
        force: false,
        dryRun: true,
        maxRequests: 1,
    },
});
expect(first.logicalRequests).toBe(4);
expect(first.executionItems).toHaveLength(1);
expect(first.deferredByRequestCap).toBe(3);
```

- [ ] **Step 2: Write dry-run/cost/Music-gate/execution tests**

Cover:

- dry-run never calls provider and never requires API key;
- dry-run includes per-kind key counts, summed intended durations, logical request count, `wouldExecute`, deferred count, dated USD estimate, and whether the Music terms note exists;
- SFX-only real run can execute without a Music note;
- any real execution item of type BGM fails before the first provider call when the Music note is absent/empty;
- real run with zero missing execution items succeeds without API key;
- real run with execution items and missing API key fails before provider calls;
- success writes candidate receipt before advancing to the next logical item;
- first final provider failure writes a failure receipt and stops; earlier successes remain;
- rerunning `--missing` after that failure skips the earlier successes and retries only the incomplete candidate.

- [ ] **Step 3: Run the orchestration test and verify failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/run.test.ts
```

Expected: FAIL because `../run` does not exist.

- [ ] **Step 4: Implement `planAudioGeneration` as a pure-enough planner over store state**

Use plan rows as the only identity list. Build current specs/hashes once. For each target key:

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

Allocate candidate IDs without mutation, starting after `store.nextCandidateId()` and incrementing locally for every planned item.

The plan report must separate:

```ts
export interface AudioGenerationPlan {
    readonly storyId: string;
    readonly keyCount: number;
    readonly sfx: { readonly keys: number; readonly durationMs: number };
    readonly bgm: { readonly keys: number; readonly durationMs: number };
    readonly candidateCount: number;
    readonly logicalRequests: number;
    readonly executionItems: readonly PlannedGenerationItem[];
    readonly deferredByRequestCap: number;
    readonly estimatedCost: {
        readonly currency: 'USD';
        readonly amount: number;
        readonly pricingAsOf: typeof ELEVENLABS_PRICING_AS_OF;
    };
    readonly musicTermsNotePresent: boolean;
}
```

Cost estimate is for all `logicalRequests`, not only the request-cap prefix, so the operator sees the full requested batch cost. If useful, also include `executionEstimatedCost` for the capped prefix; do not replace the full estimate.

- [ ] **Step 5: Implement `runAudioGeneration` with explicit preflight ordering**

Execution order:

1. call `planAudioGeneration`;
2. return immediately for dry-run;
3. return immediately when `executionItems.length === 0`;
4. if any execution BGM exists, require `store.hasMusicTermsNote(storyId)`;
5. require non-empty `ELEVENLABS_API_KEY` supplied by the caller;
6. iterate execution items sequentially;
7. call `provider.generate(spec, apiKey)`;
8. on success `store.writeSuccess(...)`;
9. on provider failure `store.writeFailure(...)`, then throw and stop.

Do not parallelize provider requests. The current workload is small, sequential execution makes request caps/resume/logs easier, and concurrency adds no useful product value here.

- [ ] **Step 6: Run orchestration tests**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/run.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the resumable-runner slice**

```bash
git add packages/stories/src/audio-generation/run.ts packages/stories/src/audio-generation/__tests__/run.test.ts
git commit -m "feat(stories): add resumable audio generation runner"
```

---

### Task 5: Add explicit verified candidate selection

**Files:**
- Create: `packages/stories/src/audio-generation/select.ts`
- Create: `packages/stories/src/audio-generation/__tests__/select.test.ts`
- Modify: `packages/stories/src/audio-generation/store.ts`
- Modify: `packages/stories/src/audio-generation/__tests__/store.test.ts`

**Interfaces:**
- Consumes: current `AudioPlanV1`, Task 1 spec/hash, Task 2 verified candidate reader.
- Produces:
  - `AudioSelectionFileV1`
  - `selectAudioCandidate(...)`
  - store `readSelection` / `writeSelection` helpers.

- [ ] **Step 1: Add atomic selection-file read/write coverage to the store tests**

Use this exact private file shape:

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

`selection.json` lives at `<storeRoot>/<story>/selection.json`. Missing selection file returns an empty v1 selection object for that story. Writes use temp + rename.

- [ ] **Step 2: Write selection validation tests**

Cover:

1. valid current candidate -> selection entry written;
2. selecting a second candidate for the same key replaces only that key's selection;
3. selecting one key preserves selections for other keys;
4. unknown key -> fail;
5. stale receipt `specSha256` after plan prompt/duration change -> fail;
6. source bytes changed after generation -> fail on recomputed SHA-256;
7. receipt missing/source missing -> fail;
8. no candidate deletion occurs after selection.

Representative stale-spec test:

```ts
await expect(
    selectAudioCandidate({
        storyId: 'theSeventhMirror',
        key: 'door-open',
        candidateId: 'candidate-001',
        plan: changedPlan,
        store,
        now: () => new Date('2026-08-15T12:00:00Z'),
    })
).rejects.toThrow(/spec.*hash|stale/i);
```

- [ ] **Step 3: Run selection tests and verify failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/select.test.ts
```

Expected: FAIL because `../select` does not exist.

- [ ] **Step 4: Implement selection by re-deriving current truth, never by trusting CLI input**

Algorithm:

```ts
const asset = plan.assets.find(candidate => candidate.key === key);
if (!asset) throw new Error(`Unknown audio key: ${key}`);

const currentSpec = buildAudioGenerationSpec(asset);
const currentSpecSha256 = audioGenerationSpecSha256(currentSpec);
const candidate = await store.readVerifiedCandidate(
    storyId,
    key,
    candidateId
);

if (candidate.receipt.specSha256 !== currentSpecSha256) {
    throw new Error(`Audio candidate ${candidateId} is stale for ${key}`);
}
```

Then read the current selection file, replace only `selections[key]`, and write it atomically with the verified source SHA and injected timestamp.

Do not add a rejection/delete workflow. A rejected candidate is simply not selected and its audio + receipt remains available.

- [ ] **Step 5: Run store + selection tests**

```bash
bun --filter @aquila/stories test -- \
  src/audio-generation/__tests__/store.test.ts \
  src/audio-generation/__tests__/select.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the selection slice**

```bash
git add packages/stories/src/audio-generation/store.ts packages/stories/src/audio-generation/select.ts packages/stories/src/audio-generation/__tests__/store.test.ts packages/stories/src/audio-generation/__tests__/select.test.ts
git commit -m "feat(stories): verify audio candidate selections"
```

---

### Task 6: Wire the Bun CLI and package scripts without widening package exports

**Files:**
- Create: `packages/stories/src/audio-generation/cli.ts`
- Create: `packages/stories/src/audio-generation/__tests__/cli.test.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**
- Consumes: `loadAudioPlan`, Tasks 2–5 modules, `ELEVENLABS_API_KEY` from injected/current environment.
- Produces:
  - `audio:generate` package command
  - `audio:select` package command
  - exported `runAudioGenerationCli(...)` only for local tests; no package-root export.

- [ ] **Step 1: Write CLI parse/behavior tests with injected dependencies**

The CLI entry supports two package-script commands:

```text
bun src/audio-generation/cli.ts generate [options]
bun src/audio-generation/cli.ts select [options]
```

Generate `parseArgs` options:

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

Select options:

```ts
const selectOptions = {
    story: { type: 'string' },
    key: { type: 'string' },
    candidate: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
} as const;
```

Cover:

- missing `--story` -> usage error;
- generate without key/missing -> usage error;
- `--missing` plus `--key` -> usage error;
- `--force --missing` -> usage error;
- candidate count outside 1..4 -> usage error;
- non-dry run without `--max-requests` -> usage error;
- dry-run does not require `ELEVENLABS_API_KEY`;
- select requires exactly one key/candidate;
- stdout JSON contains summary/selection result but not prompts or API key;
- stderr error containing an injected provider failure does not contain API key;
- unknown command -> usage error.

- [ ] **Step 2: Run CLI tests and verify failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/cli.test.ts
```

Expected: FAIL because `../cli` does not exist.

- [ ] **Step 3: Implement repository/story/store path wiring**

Resolve the repository root from `import.meta.url`, not `process.cwd()`, so package-filter execution and direct execution use the same storage root.

From `packages/stories/src/audio-generation/cli.ts`, derive:

```ts
const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const rawRoot = join(repositoryRoot, 'packages', 'stories', 'raw');
const storeRoot = join(repositoryRoot, '.tmp', 'audio-generation');
```

For generate:

1. validate CLI option combinations;
2. find `<rawRoot>/<story>/compiler.config.ts` so unknown story names fail before arbitrary path access;
3. call `loadAudioPlan(rawDir)` and require a plan for generation;
4. instantiate `LocalAudioGenerationStore(storeRoot)`;
5. instantiate the ElevenLabs provider only for the normal CLI dependency set; dry-run still does not call it;
6. pass `environment.ELEVENLABS_API_KEY` to `runAudioGeneration` only when execution needs it;
7. print one JSON report to stdout.

For select:

1. load/validate the same plan;
2. call `selectAudioCandidate`;
3. print one concise JSON result with story/key/candidate/source hash.

Do not print full prompts or receipt contents from either command.

- [ ] **Step 4: Add the package scripts and deliberately leave exports unchanged**

Modify `packages/stories/package.json` scripts:

```json
"audio:generate": "bun src/audio-generation/cli.ts generate",
"audio:select": "bun src/audio-generation/cli.ts select"
```

Do not modify `packages/stories/src/index.ts` or the package `exports` map.

- [ ] **Step 5: Run CLI + full stories tests**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/cli.test.ts
bun --filter @aquila/stories test
```

Expected: PASS.

- [ ] **Step 6: Run a real-repo dry-run without credentials**

```bash
env -u ELEVENLABS_API_KEY \
  bun --filter @aquila/stories audio:generate -- \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --max-requests 10 \
  --dry-run
```

Expected:

- exit 0;
- no provider request;
- no `.tmp/audio-generation` mutation required by the command;
- current Seventh Mirror summary reports 28 SFX, 13 BGM, and their current intended durations when no local candidates exist;
- output includes dated advisory USD estimate and request-cap/deferred counts.

- [ ] **Step 7: Commit the CLI slice**

```bash
git add packages/stories/src/audio-generation/cli.ts packages/stories/src/audio-generation/__tests__/cli.test.ts packages/stories/package.json
git commit -m "feat(stories): add audio generation CLI"
```

---

### Task 7: Run the bounded real-provider smoke and final repository verification

**Files:**
- No tracked source files expected unless the smoke exposes a concrete implementation defect.
- Local only: `.tmp/audio-generation/theSeventhMirror/music-terms-note.md`
- Local only: generated candidate/receipt/selection files under `.tmp/audio-generation/theSeventhMirror/`

**Interfaces:**
- Consumes: complete HPA-608 CLI.
- Produces: evidence that one real SFX and one real instrumental Music v2 request work end-to-end; no committed generated media.

- [ ] **Step 1: Run all mocked tests before spending provider usage**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
```

Expected: all pass and `compile:check` reports no generated-story drift.

- [ ] **Step 2: Record the manual Music pricing/rights preflight**

Create the ignored local file:

```text
.tmp/audio-generation/theSeventhMirror/music-terms-note.md
```

Record all five facts explicitly:

```markdown
# Eleven Music preflight

- Account/plan: <the actual ElevenLabs plan being used>
- API pricing checked: 2026-08-15 (refresh this date if implementation runs later)
- Music Terms / Music API Terms / model-specific terms checked: <actual check date>
- Intended distribution: Aquila visual-novel hobby-project distribution being tested by HPA-608
- Decision: generation and intended distribution are permitted for this account/use after the manual terms review
```

Replace the angle-bracketed factual values with the operator's actual information before generation. This is a human record, not code configuration.

- [ ] **Step 3: Dry-run exactly the two smoke keys**

```bash
bun --filter @aquila/stories audio:generate -- \
  --story theSeventhMirror \
  --key door-open \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2 \
  --dry-run
```

Expected: exactly two logical candidate requests, one SFX and one BGM, with no provider call.

- [ ] **Step 4: Run at most the two real generation requests**

With `ELEVENLABS_API_KEY` set in the shell environment:

```bash
bun --filter @aquila/stories audio:generate -- \
  --story theSeventhMirror \
  --key door-open \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2
```

Expected:

- no more than two logical successful generation requests;
- `door-open/candidate-001.*` source + success receipt exists;
- `dawn-apartment/candidate-001.*` source + success receipt exists;
- receipt source SHA-256 values match the bytes;
- no API key appears in stdout/stderr/receipts.

If either provider call fails after the bounded retry policy, stop. Do not expand the smoke to other keys in the same implementation pass.

- [ ] **Step 5: Verify explicit selection against both smoke candidates**

```bash
bun --filter @aquila/stories audio:select -- \
  --story theSeventhMirror \
  --key door-open \
  --candidate candidate-001

bun --filter @aquila/stories audio:select -- \
  --story theSeventhMirror \
  --key dawn-apartment \
  --candidate candidate-001
```

Expected: `selection.json` contains both keys and their verified source/spec hashes; source files/receipts remain unchanged.

- [ ] **Step 6: Prove resume is a no-op for the two completed candidates**

```bash
bun --filter @aquila/stories audio:generate -- \
  --story theSeventhMirror \
  --key door-open \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2 \
  --dry-run
```

Expected: `logicalRequests: 0` for these current-spec candidates and no cost attributed to new requests.

- [ ] **Step 7: Run final verification and inspect tracked diff**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
git status --short
git diff --check
```

Expected:

- tests/lint/compile check pass;
- `.tmp/audio-generation/**` does not appear as tracked output;
- tracked changes are only the intended HPA-608 source/tests/package script changes.

- [ ] **Step 8: Commit any final test-only fixes, if the smoke required them**

If and only if tracked fixes were necessary, commit the exact affected source/test files with a focused message such as:

```bash
git add packages/stories/src/audio-generation

git commit -m "fix(stories): harden audio generation smoke path"
```

Do not commit `.tmp/` content.

---

## Final acceptance checklist

Before marking HPA-608 complete, verify all of the following from the implementation and test output:

- [ ] One validated `audio-plan.json` drives SFX and BGM generation; no second authored inventory exists.
- [ ] `--key`, `--missing`, `--candidate-count`, `--dry-run`, `--force`, and `--max-requests` match the design semantics.
- [ ] Unchanged current-spec successes are skipped; changed spec hashes become stale without deleting old candidates.
- [ ] Request execution is sequential, explicitly bounded, and resumable after process failure/interruption.
- [ ] 429/5xx retries are bounded; deterministic 4xx/network ambiguity does not retry.
- [ ] Source bytes + private success/failure receipts are stored only under ignored `.tmp/`.
- [ ] Receipt hashes/byte lengths are verified before selection.
- [ ] Music v2 requests are instrumental and use prompt + intended duration only.
- [ ] The manual Music terms note gate happens before any real BGM call.
- [ ] Dry-run labels current cost as dated advisory USD rather than stale “credits.”
- [ ] API key is absent from stdout, stderr, receipts, and tracked files.
- [ ] Selection is explicit, one candidate per key, and fails on stale spec/source checksum mismatch.
- [ ] HPA-609 can consume the verified selected source without ElevenLabs credentials or provider calls.
- [ ] One SFX + one BGM real smoke stayed within two logical generation requests.
- [ ] `bun --filter @aquila/stories test`, `bun --filter @aquila/stories lint`, and `bun run compile:check` pass.
