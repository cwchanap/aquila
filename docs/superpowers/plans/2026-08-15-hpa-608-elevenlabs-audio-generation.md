# HPA-608 ElevenLabs Audio Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, resumable Bun/TypeScript workflow that turns validated Aquila `audio-plan.json` rows into bounded ElevenLabs SFX/Music candidates with strict private provenance and explicit verified human selection.

**Architecture:** Keep generation Node/Bun-only under `packages/stories/src/audio-generation`. `--story` selects the existing raw story folder, while persisted receipt/selection JSON uses `compiler.config.ts`'s runtime `storyId`. Derive a strict deterministic provider spec/hash, call ElevenLabs through one injected direct-HTTP seam, persist immutable candidate history under `.tmp/`, define success as strict receipt + checksum-verified bytes, and leave normalization/R2 publication to HPA-609.

**Tech Stack:** TypeScript, Bun, Node `fetch`, `node:util.parseArgs`, `node:crypto`, Node filesystem APIs, Zod, existing story compiler/audio-plan helpers, Vitest.

**Design:** `docs/superpowers/specs/2026-08-15-hpa-608-elevenlabs-audio-generation-design.md`

## Global Constraints

- Reuse `AudioPlanV1` / `AudioPlanAsset`; do not add provider fields to `audio-plan.json`.
- `--story` is the raw folder name; JSON `storyId` is `compiler.config.ts`'s snake_case runtime id.
- Keep staging paths under `.tmp/audio-generation/<storyFolder>/`.
- Do not export `audio-generation` from `packages/stories/src/index.ts`.
- Direct HTTP only; no ElevenLabs SDK dependency for v1.
- SFX: `eleven_text_to_sound_v2`, `mp3_44100_128`, non-looping, prompt influence `0.3`, duration `500..30000ms`.
- BGM: `music_v2`, prompt-based, `force_instrumental: true`, `output_format=auto`, duration `3000..600000ms`.
- Never clamp provider-illegal duration; report every invalid key before any paid request.
- Candidate count defaults to `1`, valid range `1..4`.
- Non-dry runs require `--max-requests 1..100`.
- Target mode is explicit `--key` values OR `--missing`; no implicit “all”. `--force` is explicit-key-only.
- Retry only HTTP 429/5xx: initial request + at most two retries, injected 1s/2s backoff.
- Do not retry thrown/network failures or successful non-audio responses.
- Require returned `Content-Type` to start with `audio/` before accepting bytes.
- “Successful stored candidate” always means strict receipt parse + current spec match + existing bytes + byte length + SHA-256 match.
- Receipt/failure/selection JSON uses strict Zod `schemaVersion: 1`; unknown fields/version fail. No migration code.
- Current advisory pricing constants: SFX `$0.12/min`, Music `$0.15/min`, `pricingAsOf = 2026-08-15`.
- Real BGM calls require non-empty `.tmp/audio-generation/<storyFolder>/music-terms-note.md`; code checks presence only.
- JSON operator commands are run directly: `bun packages/stories/src/audio-generation/cli.ts ...`. Keep `bun --filter` for tests/lint only.
- No queue, database, worker, dashboard, provider registry, runtime generation, auto-ranking, compatibility layer, mastering, or R2 publication.

---

## File Structure

### Create

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

- `packages/stories/raw/theSeventhMirror/docs/audio-plan.json` — `camera-shutter` `400 -> 500ms` provider-compatibility prerequisite.
- `packages/stories/package.json` — optional convenience scripts only; direct file invocation remains the parseable JSON contract.

---

### Task 1: Correct the known provider-illegal cue and derive strict generation specs

**Files:**
- Modify: `packages/stories/raw/theSeventhMirror/docs/audio-plan.json`
- Create: `packages/stories/src/audio-generation/spec.ts`
- Create: `packages/stories/src/audio-generation/__tests__/spec.test.ts`

**Interfaces:**
- Consumes: `AudioPlanAsset`; existing `canonicalJson`.
- Produces:
  - `AudioGenerationSpecV1Schema`
  - `AudioGenerationSpecV1`
  - `AudioGenerationSpecIssue`
  - `buildAudioGenerationSpec(asset: AudioPlanAsset): AudioGenerationSpecV1`
  - `buildAudioGenerationSpecSet(assets: readonly AudioPlanAsset[]): { specs: readonly AudioGenerationSpecV1[]; issues: readonly AudioGenerationSpecIssue[] }`
  - `audioGenerationSpecSha256(spec: AudioGenerationSpecV1): string`
  - `estimateAudioGenerationCostUsd(specs: readonly AudioGenerationSpecV1[]): number`
  - `ELEVENLABS_PRICING_AS_OF`

- [ ] **Step 1: Write failing mapping/schema/hash/validation tests**

Create `spec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    AudioGenerationSpecV1Schema,
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
    buildAudioGenerationSpecSet,
    estimateAudioGenerationCostUsd,
} from '../spec';

describe('audio generation spec', () => {
    it('maps SFX to the exact paid request inputs', () => {
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

    it('maps BGM to instrumental music_v2 and keeps loop as local intent', () => {
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

    it('rejects unknown schema versions/fields', () => {
        expect(() =>
            AudioGenerationSpecV1Schema.parse({
                schemaVersion: 2,
                key: 'impact',
                type: 'sfx',
            })
        ).toThrow();
    });

    it('aggregates every provider-illegal plan row', () => {
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

        expect(result.specs).toEqual([]);
        expect(result.issues.map(issue => issue.key)).toEqual([
            'too-short',
            'too-long',
            'tiny-music',
        ]);
    });

    it('changes the hash when a paid input changes', () => {
        const base = buildAudioGenerationSpec({
            key: 'impact',
            type: 'sfx',
            prompt: 'Muted impact',
            durationMs: 900,
        });
        expect(audioGenerationSpecSha256(base)).toMatch(/^[a-f0-9]{64}$/);
        expect(audioGenerationSpecSha256({ ...base, durationMs: 1000 })).not.toBe(
            audioGenerationSpecSha256(base)
        );
    });

    it('estimates dated USD cost without rounding internally', () => {
        const specs = [
            buildAudioGenerationSpec({
                key: 'ambience',
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
    });
});
```

- [ ] **Step 2: Verify the focused test fails**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/spec.test.ts
```

Expected: FAIL because `../spec` does not exist.

- [ ] **Step 3: Fix the one known plan incompatibility**

Change only:

```json
{
  "key": "camera-shutter",
  "type": "sfx",
  "prompt": "Camera shutter and flash, evidence capture, one-shot",
  "durationMs": 500
}
```

Then run:

```bash
bun run compile:check
```

Expected: PASS; the provider-neutral schema remains unchanged.

- [ ] **Step 4: Implement the strict provider spec schema/helpers**

Use Zod strict objects and a discriminated union. Core constants/types:

```ts
export const ELEVENLABS_PRICING_AS_OF = '2026-08-15' as const;
const SFX_USD_PER_MINUTE = 0.12;
const MUSIC_USD_PER_MINUTE = 0.15;

export interface AudioGenerationSpecIssue {
    readonly key: string;
    readonly type: 'sfx' | 'bgm';
    readonly message: string;
}
```

`buildAudioGenerationSpec` throws for one invalid row. `buildAudioGenerationSpecSet` iterates all assets, collects every failure in plan order, and returns no paid-execution plan while issues exist.

Hash:

```ts
return createHash('sha256')
    .update(canonicalJson(spec as unknown as JsonValue))
    .digest('hex');
```

Do not hash `asset.notes`.

- [ ] **Step 5: Verify Task 1 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/spec.test.ts
bun run compile:check
git add \
  packages/stories/raw/theSeventhMirror/docs/audio-plan.json \
  packages/stories/src/audio-generation/spec.ts \
  packages/stories/src/audio-generation/__tests__/spec.test.ts
git commit -m "feat(stories): define audio generation specs"
```

---

### Task 2: Persist strict checksum-verified candidates and receipts

**Files:**
- Create: `packages/stories/src/audio-generation/store.ts`
- Create: `packages/stories/src/audio-generation/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `AudioGenerationSpecV1Schema` / type.
- Produces:
  - `GeneratedAudioCandidate`
  - `AudioCandidateReceiptV1Schema` / type
  - `AudioCandidateFailureReceiptV1Schema` / type
  - `VerifiedStoredCandidate`
  - `LocalAudioGenerationStore`

- [ ] **Step 1: Write failing temp-directory persistence/schema/integrity tests**

Use `mkdtemp(join(tmpdir(), 'aquila-audio-'))` and test:

1. success writes bytes + strict receipt;
2. unknown receipt field/schema version is rejected;
3. missing bytes are not successful;
4. tampered bytes fail checksum verification;
5. `matchingSuccessfulCandidates` rehashes bytes and uses the same verified definition as selection;
6. old spec hash is stale without deletion;
7. failure writes immutable `candidate-002.failure.json`;
8. orphan/failure/success ordinals are all consumed by `nextCandidateId`.

Representative tamper test:

```ts
const stored = await store.writeSuccess({
    storyId: 'the_seventh_mirror',
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
    store.readVerifiedCandidate('the_seventh_mirror', 'door-open', 'candidate-001')
).rejects.toThrow(/sha-?256|checksum/i);
```

- [ ] **Step 2: Verify failure**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts
```

- [ ] **Step 3: Implement strict receipt/failure schemas**

`AudioCandidateReceiptV1Schema` is `.strict()`, embeds `AudioGenerationSpecV1Schema`, and requires:

```text
schemaVersion = 1
storyId       = runtime snake_case id
key/type/candidateId
spec/specSha256
provider/modelId
createdAt
intendedDurationMs
actualDurationMs = number | null
output.filename/mediaType/format/byteLength/sha256
providerMetadata = only approved optional non-secret fields
```

`AudioCandidateFailureReceiptV1Schema` is strict and stores only candidate/spec/hash/timestamp plus sanitized kind/status/message.

- [ ] **Step 4: Implement the local store**

Constructor:

```ts
new LocalAudioGenerationStore(root, now?)
```

Required methods:

```ts
matchingSuccessfulCandidates(storyId, key, specSha256)
nextCandidateId(storyId, key)
writeSuccess({ storyId, candidateId, spec, specSha256, generated })
writeFailure({ storyId, candidateId, spec, specSha256, failure })
readVerifiedCandidate(storyId, key, candidateId)
hasMusicTermsNote(storyFolder)
```

Rules:

- directories are `<root>/<storyFolder>/<key>/`; methods that persist JSON receive runtime `storyId` separately;
- bytes are written before success receipt;
- receipt JSON is written to `<path>.tmp` then renamed;
- parsing always goes through Zod;
- `readVerifiedCandidate` recomputes length + SHA-256;
- `matchingSuccessfulCandidates` calls the same verification path and therefore rehashes actual bytes;
- candidate ids are never reused after success/failure/orphan observation.

- [ ] **Step 5: Verify Task 2 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/store.test.ts
git add packages/stories/src/audio-generation/store.ts packages/stories/src/audio-generation/__tests__/store.test.ts
git commit -m "feat(stories): persist verified audio candidates"
```

---

### Task 3: Add direct ElevenLabs mapping, response validation, and bounded retries

**Files:**
- Create: `packages/stories/src/audio-generation/elevenlabs.ts`
- Create: `packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts`

**Interfaces:**
- Consumes: Task 1 specs; Task 2 `GeneratedAudioCandidate`.
- Produces:
  - `AudioGenerationProvider`
  - `ElevenLabsProviderError`
  - `createElevenLabsAudioProvider({ fetch, sleep })`

- [ ] **Step 1: Write failing exact request tests**

Provider seam:

```ts
export interface AudioGenerationProvider {
    generate(
        spec: AudioGenerationSpecV1,
        apiKey: string
    ): Promise<GeneratedAudioCandidate>;
}
```

SFX expectation:

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

BGM body:

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

Do not send a BGM `loop` field.

- [ ] **Step 2: Add retry/redaction/non-audio tests**

Cover:

- `429 -> 200` => two fetches, sleep `1000`;
- `500 -> 503 -> 200` => three fetches, sleeps `1000, 2000`;
- third 5xx => throw;
- `401/402/403/422` => one fetch, no sleep;
- thrown fetch error => one fetch, no retry;
- 200 + missing Content-Type => throw invalid response;
- 200 + `application/json` => throw invalid response and do not return bytes;
- 200 + `audio/mpeg; charset=binary` => accept as `audio/mpeg`, extension `mp3`;
- 200 + another valid `audio/*` type => preserve media type and derive a safe extension rather than hard-code `.mp3`;
- API key is absent from error text/metadata.

Representative response check:

```ts
fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ detail: 'unexpected body' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
);

await expect(provider.generate(spec, 'test-secret')).rejects.toThrow(/audio/i);
```

- [ ] **Step 3: Verify failure**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/elevenlabs.test.ts
```

- [ ] **Step 4: Implement the adapter**

On `response.ok`:

```ts
const mediaType = response.headers
    .get('content-type')
    ?.split(';', 1)[0]
    .trim()
    .toLowerCase();

if (!mediaType?.startsWith('audio/')) {
    throw new ElevenLabsProviderError(
        'invalid_response',
        'ElevenLabs returned a successful non-audio response'
    );
}
```

Only then read `arrayBuffer()`.

Copy only approved metadata headers (`request-id`, `x-trace-id`, `song-id`, `character-cost` or equivalent billing metadata). Never persist headers wholesale.

- [ ] **Step 5: Verify Task 3 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/elevenlabs.test.ts
git add packages/stories/src/audio-generation/elevenlabs.ts packages/stories/src/audio-generation/__tests__/elevenlabs.test.ts
git commit -m "feat(stories): add ElevenLabs audio adapter"
```

---

### Task 4: Resolve story context and implement deterministic resumable execution

**Files:**
- Create: `packages/stories/src/audio-generation/run.ts`
- Create: `packages/stories/src/audio-generation/__tests__/run.test.ts`

**Interfaces:**
- Consumes: `loadAudioPlan`, `StoryCompilerConfig`, `isStoryId`, Tasks 1–3.
- Produces:
  - `AudioGenerationStoryContext`
  - `loadAudioGenerationStoryContext(storyFolder: string): Promise<AudioGenerationStoryContext>`
  - `planAudioGeneration(input): Promise<AudioGenerationPlanReportV1>`
  - `runAudioGeneration(input): Promise<AudioGenerationRunReportV1>`

- [ ] **Step 1: Write failing story-identity tests**

Use a temp raw root fixture containing:

```ts
// compiler.config.ts equivalent loaded through injected config loader in tests
{ storyId: 'the_seventh_mirror', defaultSpeakerId: 'narrator', rolePatterns: [] }
```

Assert:

```ts
expect(context.storyFolder).toBe('theSeventhMirror');
expect(context.storyId).toBe('the_seventh_mirror');
expect(context.stagingRoot).toContain('audio-generation/theSeventhMirror');
```

Also assert unknown folder/missing config/invalid `config.storyId` fail before provider planning.

- [ ] **Step 2: Write failing planner tests**

Cover:

1. provider issue aggregation lists all invalid keys and `wouldExecute === 0`;
2. `--missing` counts only checksum-verified current-spec successes;
3. tampered successful bytes become missing;
4. desired candidate count `2` with one verified success schedules one logical request;
5. `--force` explicit key schedules additional candidates even when current success exists;
6. request cap truncates a deterministic prefix;
7. dry-run calls neither provider nor store mutation;
8. BGM paid run without terms note fails before provider call.

- [ ] **Step 3: Write failing execution/resume tests**

Test sequential behavior:

```ts
expect(maxObservedConcurrency).toBe(1);
```

Test stop-on-failure:

```ts
expect(provider.generate).toHaveBeenCalledTimes(2);
expect(thirdKeyWasRequested).toBe(false);
```

Test failed id consumption:

```text
candidate-001.failure.json exists
next resumed success is candidate-002
```

- [ ] **Step 4: Verify failure**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/run.test.ts
```

- [ ] **Step 5: Implement story context**

Resolve from repository root:

```text
packages/stories/raw/<storyFolder>/compiler.config.ts
packages/stories/raw/<storyFolder>/docs/audio-plan.json
.tmp/audio-generation/<storyFolder>/
```

Import the compiler config, validate `config.storyId` with existing `isStoryId`, and persist that runtime id into all store writes/reports.

Do not derive `storyId` from the folder name.

- [ ] **Step 6: Implement planner/executor**

Planner flow:

1. load context and validated plan;
2. build all provider specs/issues;
3. if issues exist: report every issue, zero execution, non-success status;
4. filter explicit keys or `--missing`;
5. call checksum-verified `matchingSuccessfulCandidates`;
6. derive exact logical requests in plan order;
7. apply request cap;
8. estimate dated advisory cost from the scheduled specs.

Execution flow:

1. require API key only after a valid non-dry plan exists;
2. before first scheduled BGM require non-empty terms note;
3. allocate next immutable candidate id;
4. call provider sequentially;
5. write success or final failure receipt;
6. stop on first final failure;
7. never overwrite a prior candidate id.

- [ ] **Step 7: Verify Task 4 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/run.test.ts
git add packages/stories/src/audio-generation/run.ts packages/stories/src/audio-generation/__tests__/run.test.ts
git commit -m "feat(stories): add resumable audio generation runner"
```

---

### Task 5: Add strict verified human selection

**Files:**
- Create: `packages/stories/src/audio-generation/select.ts`
- Create: `packages/stories/src/audio-generation/__tests__/select.test.ts`

**Interfaces:**
- Consumes: story context, Task 1 current spec/hash, Task 2 verified candidate.
- Produces:
  - `AudioSelectionFileV1Schema`
  - `AudioSelectionFileV1`
  - `selectAudioCandidate(input): Promise<AudioSelectionFileV1>`
  - `loadAudioSelection(path): Promise<AudioSelectionFileV1>`

- [ ] **Step 1: Write failing strict-schema tests**

Schema shape:

```ts
{
    schemaVersion: 1,
    storyId: 'the_seventh_mirror',
    selections: [
        {
            key: 'door-open',
            type: 'sfx',
            candidateId: 'candidate-001',
            specSha256: 'a'.repeat(64),
            sourceSha256: 'b'.repeat(64),
        },
    ],
}
```

Assert unknown fields, schema version 2, duplicate keys, invalid story id, invalid hashes, and malformed candidate ids fail.

- [ ] **Step 2: Write failing selection-integrity tests**

Cover:

- valid current candidate selects;
- receipt `storyId` differing from `config.storyId` fails;
- stale spec hash fails;
- tampered source fails before selection write;
- selecting same key replaces only that key;
- output selections are sorted by key;
- HPA-609-style load parses through the exported Zod schema without provider access.

- [ ] **Step 3: Verify failure**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/select.test.ts
```

- [ ] **Step 4: Implement strict selection**

Selection flow:

1. load story context by raw folder;
2. load current plan asset and current provider spec/hash;
3. read candidate through `readVerifiedCandidate` (strict receipt + bytes SHA-256);
4. require receipt runtime `storyId === context.storyId`;
5. require current spec hash;
6. load existing selection through `AudioSelectionFileV1Schema` if present;
7. replace one key, sort, atomically write `selection.json`.

Do not add rejection/deletion/auto-ranking state.

- [ ] **Step 5: Verify Task 5 and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/select.test.ts
git add packages/stories/src/audio-generation/select.ts packages/stories/src/audio-generation/__tests__/select.test.ts
git commit -m "feat(stories): add verified audio candidate selection"
```

---

### Task 6: Wire the direct-path JSON CLI

**Files:**
- Create: `packages/stories/src/audio-generation/cli.ts`
- Create: `packages/stories/src/audio-generation/__tests__/cli.test.ts`
- Modify: `packages/stories/package.json`

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces parseable stdout JSON for `generate` and `select` when invoked by direct file path.

- [ ] **Step 1: Write failing CLI parser/validation tests**

Cover:

- missing/unknown command;
- missing `--story`;
- `--key` and `--missing` together rejected;
- neither target mode rejected;
- `--candidate-count 0/5` rejected;
- non-dry generate without `--max-requests` rejected;
- `--force --missing` rejected;
- select requires one key/candidate;
- dry-run does not require `ELEVENLABS_API_KEY`;
- errors never include environment/API key values.

- [ ] **Step 2: Add a direct-invocation JSON smoke test**

Spawn the CLI through its file path, not `bun --filter`:

```ts
const proc = Bun.spawn([
    'bun',
    'packages/stories/src/audio-generation/cli.ts',
    'generate',
    '--story',
    'theSeventhMirror',
    '--missing',
    '--candidate-count',
    '1',
    '--dry-run',
]);

const stdout = await new Response(proc.stdout).text();
expect(() => JSON.parse(stdout)).not.toThrow();
expect((await proc.exited)).toBe(0);
```

The expected current clean report after Task 1 includes:

```text
storyFolder = theSeventhMirror
storyId     = the_seventh_mirror
assetCount  = 41
sfx.count   = 28
bgm.count   = 13
providerIssues = []
```

Do not assert a Bun `--filter` JSON path.

- [ ] **Step 3: Verify failure**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/cli.test.ts
```

- [ ] **Step 4: Implement `parseArgs` command wiring**

Follow the publisher CLI's local `node:util.parseArgs` style without importing publisher code.

Stdout: exactly one JSON report.  
Stderr: human progress/errors only.

Environment handling:

```ts
const apiKey = process.env.ELEVENLABS_API_KEY;
```

Read only when a valid non-dry execution will make provider calls. Never print it.

- [ ] **Step 5: Add convenience package scripts**

`packages/stories/package.json` may include:

```json
{
  "audio:generate": "bun src/audio-generation/cli.ts generate",
  "audio:select": "bun src/audio-generation/cli.ts select"
}
```

These are convenience aliases, not the documented parseable-JSON invocation contract.

- [ ] **Step 6: Verify the direct-path CLI and commit**

```bash
bun --filter @aquila/stories test src/audio-generation/__tests__/cli.test.ts
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --missing \
  --candidate-count 1 \
  --dry-run > .tmp/hpa-608-dry-run.json
bun -e 'await Bun.file(".tmp/hpa-608-dry-run.json").json(); console.log("valid json")'
git add packages/stories/src/audio-generation/cli.ts packages/stories/src/audio-generation/__tests__/cli.test.ts packages/stories/package.json
git commit -m "feat(stories): add audio generation CLI"
```

Expected: direct-path stdout parses as JSON with no package-script prefixes.

---

### Task 7: Run full verification and the bounded real API smoke

**Files:**
- No production code expected unless verification exposes a concrete defect.
- Local ignored state: `.tmp/audio-generation/theSeventhMirror/`.

**Interfaces:**
- Consumes completed HPA-608 CLI.
- Produces one verified SFX candidate, one verified BGM candidate, and selection evidence with no publication.

- [ ] **Step 1: Run repository verification**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
```

All must pass before spending.

- [ ] **Step 2: Re-run the parseable dry-run by file path**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key camera-shutter \
  --key dawn-apartment \
  --candidate-count 1 \
  --dry-run > .tmp/hpa-608-smoke-plan.json
bun -e 'console.log(await Bun.file(".tmp/hpa-608-smoke-plan.json").json())'
```

Verify manually:

- two logical requests needed;
- one SFX + one BGM;
- provider issues empty;
- story id is `the_seventh_mirror`;
- dated advisory USD estimate is present.

- [ ] **Step 3: Create the required BGM terms note**

Create `.tmp/audio-generation/theSeventhMirror/music-terms-note.md` with real operator facts:

```markdown
# Eleven Music preflight

- Account/plan: Pro
- API pricing checked: 2026-08-16
- Music Terms / Music API Terms / model-specific terms checked: 2026-08-16
- Intended distribution: Aquila hobby visual-novel game distribution
- Decision: current account/use permits this test generation and intended distribution after manual review
```

If the actual account plan is not `Pro`, write the actual plan instead. Do not commit this file.

- [ ] **Step 4: Run exactly two real logical requests**

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key camera-shutter \
  --key dawn-apartment \
  --candidate-count 1 \
  --max-requests 2 > .tmp/hpa-608-smoke-run.json
```

Verify the report says exactly two logical generation requests were executed.

- [ ] **Step 5: Inspect strict receipts and returned media**

For each candidate:

- receipt parses through `AudioCandidateReceiptV1Schema`;
- receipt `storyId === 'the_seventh_mirror'`;
- source bytes exist and checksum verify;
- returned `mediaType` begins with `audio/`;
- `actualDurationMs` may remain `null`;
- no API key/private headers are persisted.

- [ ] **Step 6: Select both candidates explicitly**

Use the actual candidate ids reported by the run:

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

If either key's actual id differs because prior local attempts consumed ids, use that reported id instead.

- [ ] **Step 7: Prove HPA-609 handoff requires no provider access**

Load `selection.json` through `AudioSelectionFileV1Schema`, then resolve/read both candidates through the strict receipt store with `ELEVENLABS_API_KEY` unset.

Expected: selected source bytes verify with no network/provider call.

- [ ] **Step 8: Final diff/scope check**

```bash
git status --short
git diff --check
```

Only Task 1's intentional `audio-plan.json` correction plus the new `audio-generation` implementation/tests and package scripts should be tracked. `.tmp/` remains ignored.

---

## Risk checkpoints during implementation

- **Story identity:** if any receipt/selection writes `theSeventhMirror` into `storyId`, stop and fix before proceeding; path and contract identities are intentionally different.
- **Provider duration:** if another plan key violates provider bounds, add it to the aggregated planner diagnostics and correct authoring intent explicitly; never introduce clamping.
- **JSON stdout:** if any operator example uses `bun --filter @aquila/stories audio:generate` as captured JSON, replace it with direct file invocation.
- **Stored success:** if a code path counts receipt + file existence without hashing actual bytes, it is incomplete.
- **Provider response:** if 2xx non-audio bytes can reach `writeSuccess`, Task 3 is incomplete.
- **Schema boundary:** if HPA-609 would need a second ad hoc `JSON.parse` shape for receipt/selection, expose/reuse the strict Zod schemas instead.

## Final acceptance checklist

- [ ] `camera-shutter` is explicitly corrected to at least `500ms`; no provider clamping exists.
- [ ] All provider-illegal plan keys are listed together before any paid request.
- [ ] Raw folder lookup and runtime `storyId` are distinct and tested.
- [ ] `--missing` skips only checksum-verified current-spec successes.
- [ ] Success/failure/selection contracts are strict Zod schema v1.
- [ ] Failed/orphan ids are consumed; resume uses a new candidate id.
- [ ] `--max-requests` is required for paid runs and execution is sequential.
- [ ] 429/5xx retries are bounded; ambiguous network failures are not retried.
- [ ] 2xx provider responses require `Content-Type: audio/*`.
- [ ] Music `auto` output records returned media type/derived extension rather than assuming MP3.
- [ ] BGM paid work requires a non-empty human terms note.
- [ ] Parseable JSON is proven through direct `bun packages/stories/src/audio-generation/cli.ts ...` invocation.
- [ ] HPA-609 can parse selections/receipts and verify selected bytes with no ElevenLabs access.
- [ ] Real API smoke executes no more than one SFX + one BGM logical request and publishes nothing.
- [ ] `bun --filter @aquila/stories test`, `bun --filter @aquila/stories lint`, and `bun run compile:check` pass.
