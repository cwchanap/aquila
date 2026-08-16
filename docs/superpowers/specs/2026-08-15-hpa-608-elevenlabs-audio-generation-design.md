# HPA-608 ElevenLabs Audio Generation Design

**Issue:** HPA-608 — Build a resumable ElevenLabs SFX and music generation CLI for Aquila stories  
**Date:** 2026-08-15  
**Status:** Proposed

## Context

HPA-606 established one provider-neutral `audio-plan.json` per story and HPA-607 expanded The Seventh Mirror to its complete story-wide audio direction. HPA-608 should consume that existing contract without adding a second authored inventory or a service.

Relevant current seams:

- `packages/stories/src/audio-plan.ts` owns the strict `AudioPlanV1` / `AudioPlanAsset` contract.
- `packages/stories/src/audio-plan-loader.ts` is the Node-only plan loader.
- `packages/stories/src/runtime-assets/canonical.ts` owns the repository's strict canonical JSON helper.
- `packages/stories/src/compiler/cli.ts` establishes that the CLI-facing story name is the raw folder name, e.g. `theSeventhMirror`.
- `packages/stories/raw/theSeventhMirror/compiler.config.ts` establishes the runtime/publisher story id as `the_seventh_mirror`.
- `.tmp/` is already ignored and is the correct local scratch root.
- HPA-609 will consume a verified selected source candidate and owns encoding, duration probing, R2 publication, manifests, activation, and rollback.

The current Seventh Mirror plan contains 41 assets: 28 SFX and 13 BGM tracks. One current row, `camera-shutter`, has `durationMs: 400`, while the ElevenLabs Sound Effects API requires an explicit duration of at least 0.5 seconds. HPA-608 must not silently clamp provider-illegal plan data. The implementation therefore starts with one explicit authoring correction (`camera-shutter` to at least `500ms`) and keeps provider validation capable of reporting every offending key in a plan.

Current ElevenLabs facts used by this design:

- Sound Effects: `POST /v1/sound-generation`, model `eleven_text_to_sound_v2`, explicit duration `0.5..30` seconds, non-looping for Aquila SFX.
- Music: `POST /v1/music`, model `music_v2`, prompt-based duration `3000..600000ms`, `force_instrumental: true` for The Seventh Mirror.
- The simple endpoints return audio bytes. Successful responses must also advertise an `audio/*` content type before bytes are accepted as a candidate.
- Music `output_format=auto` is intentionally retained; the receipt records the returned media type/derived extension instead of assuming the container forever remains MP3.
- Current API pricing is represented as dated advisory USD. It is not a credit accounting system.
- Music rights/plan eligibility remains a human preflight note, not TypeScript legal logic.

## Goals

1. Turn a validated story `audio-plan.json` into local reviewable ElevenLabs SFX/BGM candidates.
2. Support one local operator with an explicit, sequential, resumable workflow.
3. Bound paid work through explicit targeting, candidate count, dry-run, and `--max-requests`.
4. Make unchanged successful candidates safely reusable by deterministic generation-spec hash.
5. Define “successful candidate” strongly enough that `--missing`, selection, and HPA-609 agree: strict receipt + existing bytes + matching SHA-256.
6. Keep raw folder identity and runtime/publisher identity distinct without adding a mapping layer later.
7. Persist strict, versioned receipt and selection JSON that HPA-609 can parse directly.
8. Keep provider-specific behavior behind one small test seam, not a provider platform.
9. Keep credentials, prompts, receipts, and candidates out of browser/runtime/public manifests.

## Non-goals

- Runtime/browser generation.
- Cloudflare R2 upload, runtime manifests, pointers, activation, rollback, or release history.
- Automatic candidate ranking or approval.
- Prompt rewriting or optimization.
- Composition plans, audio references, finetunes, inpainting, stems, streaming, or C2PA workflow machinery.
- Narration/dialogue TTS.
- Loudness normalization, mastering, trimming, transcoding, or duration probing.
- Dashboard, queue, worker, database, generic provider registry, or reusable media-pipeline package.
- Legal automation.
- Backward-compatibility/migration code for local-only schema v1 files.

## Approaches considered

### A. Direct HTTP behind one injected provider seam — chosen

Use built-in `fetch` for the two paid endpoints. Keep exact request mapping, retry classification, response validation, and returned metadata in one `elevenlabs.ts` module.

**Pros:** no new dependency; exact paid request is obvious; raw headers/content type stay available; credential redaction is straightforward; tests inject `fetch`.  
**Cons:** a small amount of request mapping is maintained locally.

### B. Official ElevenLabs SDK

Rejected for v1. Two POST endpoints do not justify another dependency, and the SDK does not remove the filesystem/resume/selection work.

### C. Generic media/provider platform

Rejected. There is one provider, one local operator, two media kinds, and no runtime generation.

## Decision

Create one Node/Bun-only module:

```text
packages/stories/src/audio-generation/
  spec.ts          # strict provider spec schema/hash + provider validation + cost estimate
  store.ts         # strict receipt schemas + verified local persistence
  elevenlabs.ts    # direct HTTP adapter + bounded retries + audio response validation
  run.ts           # story context, planning, sequential generation, resume
  select.ts        # strict selection schema + candidate verification
  cli.ts           # parseArgs + command wiring only
```

Tests live under `audio-generation/__tests__/`.

Do not export these modules from `packages/stories/src/index.ts`.

## Story identity boundary

`--story` continues to mean the **raw directory name**, matching the existing compiler CLI:

```text
--story theSeventhMirror
```

The CLI resolves:

```text
packages/stories/raw/theSeventhMirror/compiler.config.ts
packages/stories/raw/theSeventhMirror/docs/audio-plan.json
```

It imports `compiler.config.ts`, reads `config.storyId`, and validates the runtime id with the existing `isStoryId` helper.

For The Seventh Mirror:

```text
storyFolder = theSeventhMirror
storyId     = the_seventh_mirror
```

Filesystem staging remains human-friendly and keyed by the raw folder:

```text
.tmp/audio-generation/theSeventhMirror/
```

Every persisted JSON contract stores `storyId: "the_seventh_mirror"`. It does **not** store the raw folder as `storyId`.

This lets HPA-609 consume receipts/selection without a later camelCase-to-snake_case translation layer.

## Provider legality and the existing 400ms cue

`AudioPlanV1` correctly allows any positive `durationMs`; provider limits do not belong in the provider-neutral authoring schema.

HPA-608 therefore validates provider compatibility when deriving generation specs:

- SFX explicit duration: `500..30000ms`.
- BGM duration: `3000..600000ms`.
- No silent clamping.

The implementation prerequisite is:

```text
camera-shutter: 400ms -> 500ms
```

That is an authoring correction in `audio-plan.json`, not a CLI workaround.

Planner validation must aggregate all provider-illegal rows before returning. A dry-run for a bad plan should still identify the story/counts and return a deterministic `providerIssues[]` list such as:

```json
{
  "providerIssues": [
    {
      "key": "camera-shutter",
      "type": "sfx",
      "message": "SFX duration must be between 500 and 30000ms"
    }
  ]
}
```

A plan with any provider issue exits non-zero and performs zero provider requests.

## CLI contract

Operator-facing JSON commands are invoked directly by file path from the repository root:

```bash
bun packages/stories/src/audio-generation/cli.ts generate \
  --story theSeventhMirror \
  --key door-open \
  --candidate-count 2 \
  --max-requests 2
```

and:

```bash
bun packages/stories/src/audio-generation/cli.ts select \
  --story theSeventhMirror \
  --key door-open \
  --candidate candidate-001
```

Package scripts may remain as convenience aliases, but documentation/tests that assert parseable JSON stdout use the direct file path. The repository already records that recent Bun `--filter` execution prefixes stdout lines and corrupts JSON capture.

### Generate options

- `--story <raw-folder>` — required.
- repeatable `--key <logical-key>` — explicit target mode.
- `--missing` — resume mode.
- `--candidate-count <n>` — desired successful candidates per key; default `1`, allowed `1..4`.
- `--dry-run` — validates/plans only; no API key required, no local mutation, no provider calls.
- `--force` — explicit-key-only; request `candidate-count` additional candidates without overwriting history.
- `--max-requests <n>` — required on non-dry runs, allowed `1..100`.

Exactly one target mode is allowed: explicit key(s), or `--missing`.

There is no implicit “generate everything” mode.

### Request-cap semantics

`--max-requests` counts logical paid candidate generations, not internal HTTP retry attempts.

Planning is deterministic in `audio-plan.json` order, then candidate ordinal. If more candidate generations are needed than the cap, execute only the deterministic prefix and report the remainder.

### Dry-run report

After the `camera-shutter` prerequisite, a full current `--missing --candidate-count 1 --dry-run` can report all 41 plan rows. The report contains:

```ts
interface AudioGenerationPlanReportV1 {
    readonly schemaVersion: 1;
    readonly storyFolder: string;
    readonly storyId: string;
    readonly assetCount: number;
    readonly sfx: { readonly count: number; readonly durationMs: number };
    readonly bgm: { readonly count: number; readonly durationMs: number };
    readonly candidateCount: number;
    readonly logicalRequestsNeeded: number;
    readonly wouldExecute: number;
    readonly deferredByRequestCap: number;
    readonly estimatedCost: {
        readonly currency: 'USD';
        readonly amount: number;
        readonly pricingAsOf: string;
    };
    readonly providerIssues: readonly AudioGenerationSpecIssue[];
}
```

If `providerIssues` is non-empty, `wouldExecute` is `0` and the command exits non-zero.

## Deterministic generation spec

`spec.ts` defines a strict Zod schema plus inferred TypeScript type:

```ts
export const AudioGenerationSpecV1Schema = z.discriminatedUnion('type', [
    z.object({
        schemaVersion: z.literal(1),
        key: z.string(),
        type: z.literal('sfx'),
        prompt: z.string(),
        durationMs: z.number().int(),
        provider: z.literal('elevenlabs'),
        modelId: z.literal('eleven_text_to_sound_v2'),
        outputFormat: z.literal('mp3_44100_128'),
        loop: z.literal(false),
        promptInfluence: z.literal(0.3),
    }).strict(),
    z.object({
        schemaVersion: z.literal(1),
        key: z.string(),
        type: z.literal('bgm'),
        prompt: z.string(),
        durationMs: z.number().int(),
        provider: z.literal('elevenlabs'),
        modelId: z.literal('music_v2'),
        outputFormat: z.literal('auto'),
        loopIntent: z.literal(true),
        forceInstrumental: z.literal(true),
    }).strict(),
]);
```

The implementation may factor common fields, but the wire contract remains strict and `schemaVersion: 1` is not migrated.

Hash `canonicalJson(spec)` with SHA-256 using the existing canonical helper. Do not widen/reuse visual runtime manifest schemas.

`notes` are not hashed because they are not provider request input.

## Provider mapping

### SFX

```text
POST /v1/sound-generation?output_format=mp3_44100_128
```

```json
{
  "text": "<prompt>",
  "duration_seconds": 2.2,
  "loop": false,
  "prompt_influence": 0.3,
  "model_id": "eleven_text_to_sound_v2"
}
```

### BGM

```text
POST /v1/music?output_format=auto
```

```json
{
  "prompt": "<prompt>",
  "music_length_ms": 90000,
  "model_id": "music_v2",
  "force_instrumental": true,
  "store_for_inpainting": false,
  "sign_with_c2pa": false
}
```

Do not send a BGM `loop` field. `loopIntent` is local production intent; the prompt remains responsible for requesting loop-friendly material.

## Provider success and retry policy

A successful HTTP status is necessary but not sufficient.

For a 2xx response:

1. read `Content-Type`;
2. strip parameters and require the media type to start with `audio/`;
3. reject missing/non-audio content type as an invalid provider response;
4. only then read/persist the bytes;
5. record the returned media type and derive the local extension from it instead of blindly naming Music `auto` output `.mp3`.

This prevents a 200 JSON error body or future `auto` container change from becoming a false successful candidate.

Retry at most three HTTP attempts total: initial + two retries.

Retry only:

- `429`;
- `5xx`.

Use injected sleeps of 1 second then 2 seconds.

Do not retry:

- deterministic 4xx errors;
- a 2xx non-audio response;
- thrown/network errors where provider acceptance/billing may be ambiguous.

Stop the run on the first final failure.

## Local staging and strict receipts

Staging:

```text
.tmp/audio-generation/<storyFolder>/
  music-terms-note.md
  selection.json
  <key>/
    candidate-001.mp3
    candidate-001.receipt.json
    candidate-002.failure.json
    candidate-003.mp3
    candidate-003.receipt.json
```

Candidate ids are local ordinals and are immutable once observed. Success, failure, or orphan bytes consume an ordinal. Resume allocates the next unused id; it never rewrites a failed id.

### Success receipt

`store.ts` owns `AudioCandidateReceiptV1Schema` and its inferred type. It is strict and embeds `AudioGenerationSpecV1Schema`.

```ts
interface AudioCandidateReceiptV1 {
    readonly schemaVersion: 1;
    readonly storyId: string; // config.storyId, e.g. the_seventh_mirror
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
    readonly providerMetadata: {
        readonly requestId?: string;
        readonly traceId?: string;
        readonly songId?: string;
        readonly billingMetadata?: string;
    };
}
```

`actualDurationMs` remains `null` unless the provider supplies a measured duration. HPA-609 owns source probing/normalization.

### Failure receipt

`AudioCandidateFailureReceiptV1Schema` is also strict, with `schemaVersion: 1`, runtime `storyId`, candidate/spec/hash, timestamp, and only sanitized failure class/status/message.

Unknown fields or unknown schema versions fail loudly. There is no migration layer.

### Definition of a successful stored candidate

A candidate counts toward `--missing` or `candidate-count` **only if all are true**:

1. success receipt exists;
2. receipt parses through `AudioCandidateReceiptV1Schema`;
3. receipt `storyId`, key, candidate id, and current spec hash match;
4. referenced candidate bytes exist;
5. byte length matches;
6. SHA-256 of the actual bytes matches the receipt.

`matchingSuccessfulCandidates` uses this same verified definition for dry-run and paid runs. It does not skip hashing because these local candidate files are small and this verification directly prevents accidental paid-work suppression.

Write candidate bytes first, then atomically replace the success receipt with temp-file + rename. Orphan bytes never count as success.

## Sequential runner and interruption

`run.ts` owns batch planning/execution.

For each target key:

1. derive current provider spec and hash;
2. verify matching successful candidates from disk;
3. calculate missing successful count;
4. allocate the next unused candidate id;
5. call the provider;
6. persist bytes + strict receipt;
7. continue until the target count or invocation request cap is reached.

Execution is sequential. No concurrency pool is added.

If the process is interrupted after bytes but before receipt rename, the bytes are orphaned, consume their candidate id, and do not count as success. The next invocation continues with a new id.

## Strict human selection contract

`select.ts` owns `AudioSelectionFileV1Schema` and inferred type. It is strict and versioned:

```ts
interface AudioSelectionFileV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly selections: readonly {
        readonly key: string;
        readonly type: 'sfx' | 'bgm';
        readonly candidateId: string;
        readonly specSha256: string;
        readonly sourceSha256: string;
    }[];
}
```

Selections are sorted by key for deterministic output.

Selecting a candidate requires:

1. load story folder context and `config.storyId`;
2. load current audio plan and derive the current spec/hash;
3. `readVerifiedCandidate` through the strict receipt schema and checksum verification;
4. require receipt runtime `storyId` to match `config.storyId`;
5. require receipt spec hash to equal current spec hash;
6. replace only that key's selection and atomically rewrite `selection.json`.

HPA-609 can parse `selection.json`, locate the candidate by key/id under the known staging folder, parse the success receipt through the same exported schema, and independently verify the selected bytes. It does not need ElevenLabs credentials.

## Music cost/rights preflight

Before the first real BGM request in a run, require a non-empty:

```text
.tmp/audio-generation/<storyFolder>/music-terms-note.md
```

The operator records:

- ElevenLabs account/plan;
- pricing check date;
- Music/API/model terms check date;
- intended Aquila distribution/use;
- concise human conclusion that generation/distribution is permitted for that account/use.

The CLI checks file presence/non-empty only.

## Cost reporting

Keep two dated constants in `spec.ts`:

```text
Sound Effects: $0.12/min
Music:         $0.15/min
pricingAsOf:   2026-08-15
```

Estimate from intended generated duration and requested candidate count. Do not round inside the pure estimator; round only for report display.

This is advisory scope information, not billing reconciliation.

## Risks and mitigations

### Raw story folder vs runtime `storyId`

**Risk:** storing `theSeventhMirror` as `storyId` forces HPA-609 to invent a mapping later.  
**Mitigation:** `--story` selects the raw folder; every JSON contract persists `compiler.config.ts`'s `the_seventh_mirror`.

### Provider-neutral durations can be provider-illegal

**Risk:** a valid `AudioPlanV1` row can be outside ElevenLabs limits; the current `camera-shutter: 400ms` proves it.  
**Mitigation:** no clamping; fix the known row to `500ms`; planner aggregates all provider issues and makes no paid calls until clean.

### Bun `--filter` can corrupt JSON stdout

**Risk:** operator/report automation receives package-prefixed lines instead of JSON.  
**Mitigation:** all parseable operator commands use direct file-path invocation; `--filter` remains only for tests/lint where stdout is not parsed as the contract.

### Provider returns 2xx non-audio or changes `auto` container

**Risk:** arbitrary bytes get persisted as a valid candidate or mislabeled `.mp3`.  
**Mitigation:** require `audio/*`, record returned media type, derive extension from media type, and keep real two-request smoke as the paid endpoint proof.

### Network failure after provider acceptance

**Risk:** automatic retry might double-charge.  
**Mitigation:** thrown/network errors are not retried; the attempt is recorded as failure and the operator decides whether to retry later.

## Testing strategy

Mocked Vitest coverage owns:

- provider spec mapping and all-duration validation aggregation;
- spec hashing and cost estimation;
- story folder -> runtime story id resolution;
- strict receipt/failure parsing and unknown schema-version rejection;
- checksum-verified successful-candidate lookup;
- orphan/failure candidate-id consumption;
- exact SFX/Music HTTP mapping;
- 429/5xx bounded retries and non-retry classes;
- rejection of 2xx missing/non-`audio/*` content type;
- resume, force, request cap, sequential stop-on-failure;
- strict selection parsing/current-spec verification;
- clean JSON CLI output through direct file invocation.

Manual API smoke owns only what mocks cannot prove: one real short SFX and one real short instrumental BGM, bounded by exactly two logical requests.

## Acceptance criteria

- [ ] Known `camera-shutter` provider-duration mismatch is corrected explicitly in the audio plan; no duration clamping exists.
- [ ] Provider validation reports all offending keys in one planning result and performs zero paid work on invalid plans.
- [ ] `--story` uses raw folder lookup while every receipt/selection persists `config.storyId`.
- [ ] Dry-run performs no network/provider work and reports request/cost scope deterministically.
- [ ] Non-dry generation requires `--max-requests` and runs sequentially.
- [ ] Unchanged candidates are skipped only after strict receipt parsing and SHA-256 verification of actual bytes.
- [ ] Failed/orphan candidate ids are consumed and never overwritten.
- [ ] Receipt, failure, and selection files use strict Zod `schemaVersion: 1` contracts.
- [ ] Provider responses are accepted only when successful and `Content-Type` is `audio/*`.
- [ ] Credentials are environment-only and absent from errors/receipts/logs.
- [ ] BGM generation requires a non-empty human terms note.
- [ ] HPA-609 can consume one verified selection without provider calls or credentials.
- [ ] Parseable JSON operator commands are documented/tested through direct `bun packages/stories/src/audio-generation/cli.ts ...` invocation.
- [ ] One SFX + one BGM real smoke stays within a two-request cap and does not publish anything.

## Verification

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
```

Manual smoke first runs the direct-path dry-run and inspects its JSON before `ELEVENLABS_API_KEY` is used.
