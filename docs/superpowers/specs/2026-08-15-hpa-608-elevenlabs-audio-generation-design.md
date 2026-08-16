# HPA-608 ElevenLabs Audio Generation Design

**Issue:** HPA-608 — Build a resumable ElevenLabs SFX and music generation CLI for Aquila stories  
**Date:** 2026-08-15  
**Status:** Proposed

## Context

HPA-606 established the authored audio-plan contract and HPA-607 has expanded The Seventh Mirror to its complete story-level direction. HPA-608 therefore does not need another inventory or authoring format:

- `packages/stories/raw/<story>/docs/audio-plan.json` owns provider-neutral key, kind, prompt, intended duration, and BGM loop intent.
- `packages/stories/src/audio-plan.ts` validates that contract strictly.
- `packages/stories/src/audio-plan-loader.ts` is already a Node-only loader kept out of browser exports.
- `.tmp/` is already ignored for local scratch/output.
- HPA-609 expects an explicitly selected source candidate and owns publication/R2 work.

The current Seventh Mirror plan has 41 assets: 28 SFX totaling 148.8 seconds and 13 BGM tracks totaling 19.5 minutes. At ElevenAPI's listed 2026-08-15 rates ($0.12/minute Sound Effects, $0.15/minute Music), one candidate for every current key is roughly $3.22 before taxes or plan-specific effects. That scale does not justify a queue, database, worker, or service.

Current provider facts that affect the contract:

- Sound Effects: `POST /v1/sound-generation`, one API effect per request, explicit duration 0.5–30 seconds, v2 sound model supports `loop`.
- Music: `POST /v1/music`, `music_v2`, prompt duration 3,000–600,000 ms, `force_instrumental` supported.
- Music v2 `output_format=auto` currently selects MP3 48 kHz / 192 kbps. Sound Effects exposes format selection, while the endpoint response contract documents MP3; HPA-608 preserves provider bytes and does not invent a WAV-transcoding stage.
- ElevenAPI's current pricing page describes API billing in USD. Dry-run should estimate the current billing unit with an explicit pricing date, not synthesize a credits conversion.
- Current Music terms have plan/use-case restrictions and define “Studio Games.” The workflow needs a manual recorded preflight, not legal logic in TypeScript.

Provider references checked for this design:

- https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
- https://elevenlabs.io/docs/api-reference/music/compose
- https://elevenlabs.io/docs/changelog/2026/6/15
- https://elevenlabs.io/pricing/api
- https://elevenlabs.io/music-terms
- https://elevenlabs.io/eleven-music-model-specific-terms

## Goals

1. Turn validated `audio-plan.json` rows into reviewable local ElevenLabs candidates.
2. Support SFX and instrumental BGM through one small Bun/TypeScript workflow.
3. Skip unchanged successful candidates using a deterministic generation-spec hash.
4. Preserve completed output across failure/Ctrl-C and make the next run continue only the remaining logical deficit.
5. Bound paid work with explicit targeting, candidate-count bounds, dry-run, and a hard per-run request cap.
6. Persist enough private provenance to audit each candidate without leaking credentials into logs, Git, or runtime manifests.
7. Make human selection explicit and machine-verifiable for HPA-609.
8. Keep provider-specific behavior behind exactly one narrow injected interface.
9. Keep external pricing/rights assumptions visible and easy to refresh.

## Non-goals

- Browser/runtime generation.
- R2 upload, release manifests, activation, rollback, or runtime asset resolution.
- Automatic ranking/approval or prompt rewriting.
- Composition plans, references, finetunes, inpainting, stems, streaming, or C2PA workflows.
- Dialogue TTS/voices.
- Mastering, loudness normalization, trimming, or publication encoding.
- Dashboard, queue, database, worker, provider registry, or generic media package.
- Legal automation.
- Backward-compatibility machinery for this local-only feature.

## Approaches considered

### A. Direct HTTP + one injected provider interface — chosen

Use built-in `fetch` for the two generation endpoints. Keep request mapping, retries, binary response handling, and whitelisted response headers in one `elevenlabs.ts` module.

**Pros:** no dependency; exact paid requests remain obvious; raw bytes/headers are easy to test; credential-redaction behavior is under local control.  
**Cons:** a small amount of HTTP mapping is maintained locally.

### B. Official `@elevenlabs/elevenlabs-js` SDK

**Rejected for now:** two endpoints do not justify another dependency, and the SDK does not remove the real HPA-608 work: resumability, receipts, request caps, private storage, and selection. The provider interface keeps later migration cheap if the API surface grows.

### C. Generic provider/media pipeline

**Rejected:** one local operator + one provider + two generation types is not a platform problem.

## Decision

Create a Node/Bun-only module under:

```text
packages/stories/src/audio-generation/
  spec.ts          # plan row -> exact generation spec/hash + cost estimate
  store.ts         # private local candidate/receipt/selection persistence
  elevenlabs.ts    # direct HTTP adapter + retry classification
  run.ts           # deterministic batch planning/execution/resume
  select.ts        # explicit selection validation
  cli.ts           # parseArgs and dependency wiring only
```

Tests live under `audio-generation/__tests__/`.

Add package scripts:

```json
{
  "audio:generate": "bun src/audio-generation/cli.ts generate",
  "audio:select": "bun src/audio-generation/cli.ts select"
}
```

Do not export these modules from `packages/stories/src/index.ts` or the package `exports` map.

## CLI contract

### Generation

```bash
bun --filter @aquila/stories audio:generate \
  --story theSeventhMirror \
  --key door-open \
  --candidate-count 2 \
  --max-requests 2
```

Options:

- `--story <story>` required.
- repeatable `--key <key>`: explicit target mode.
- `--missing`: resume mode; target plan rows with fewer than `candidate-count` successful current-spec candidates.
- `--candidate-count <n>`: default `1`, allowed `1..4`.
- `--dry-run`: validate/plan only; no credentials, provider calls, or candidate writes.
- `--force`: explicit-key-only; request `candidate-count` additional candidates even when enough current-spec successes already exist.
- `--max-requests <n>`: required for non-dry generation, allowed `1..100`.

Exactly one target mode is allowed: one or more `--key`, or `--missing`. There is deliberately no implicit “all keys” mode.

Planning order is stable: `audio-plan.json` order, then candidate ordinal. If the logical deficit exceeds `--max-requests`, execute only the deterministic prefix and report the remaining count. A subsequent `--missing` run continues from persisted success receipts.

`--max-requests` counts logical candidate generations; the provider adapter has its own fixed internal retry ceiling.

### Dry-run report

Dry-run returns structured JSON with selected/current counts, intended durations, logical candidate requests, capped execution count, deferred count, Music-preflight presence, and a dated provider estimate. For the current full plan with no candidates, one candidate per key is approximately:

```json
{
  "storyId": "theSeventhMirror",
  "sfx": { "keys": 28, "durationMs": 148800 },
  "bgm": { "keys": 13, "durationMs": 1170000 },
  "candidateCount": 1,
  "logicalRequests": 41,
  "estimatedCost": {
    "currency": "USD",
    "amount": 3.22,
    "pricingAsOf": "2026-08-15"
  }
}
```

The estimate is advisory and explicitly dated. A future pricing change is one constant update, not a pricing subsystem.

### Selection

```bash
bun --filter @aquila/stories audio:select \
  --story theSeventhMirror \
  --key door-open \
  --candidate candidate-001
```

Selection verifies the current plan-derived spec hash, success receipt, byte length, and source SHA-256 before updating the private story `selection.json`. Non-selected candidates are retained; there is no deletion or auto-ranking command.

## Deterministic generation spec

`audio-plan.json` stays provider-neutral. `spec.ts` derives exactly what changes provider output:

```ts
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
```

Hash SHA-256 over the existing `canonicalJson(spec)` helper. Reuse only that deterministic JSON primitive; do not reuse/widen visual runtime manifest schemas.

Any change to prompt, duration, kind, provider/model, output format, or provider-affecting settings changes the hash. Old files stay available for comparison but no longer satisfy `--missing` for the current spec.

`notes` are not hashed because they are not provider input.

## Provider mapping

### SFX

```text
POST /v1/sound-generation?output_format=mp3_44100_128
```

```json
{
  "text": "<plan prompt>",
  "duration_seconds": 2.2,
  "loop": false,
  "prompt_influence": 0.3,
  "model_id": "eleven_text_to_sound_v2"
}
```

Reject durations outside 0.5–30 seconds; never clamp. Preserve returned bytes/MIME type/format/hash. Do not add a WAV wrapper/transcoder solely for HPA-608; HPA-609 owns publication normalization.

### BGM

```text
POST /v1/music?output_format=auto
```

```json
{
  "prompt": "<plan prompt>",
  "music_length_ms": 90000,
  "model_id": "music_v2",
  "force_instrumental": true,
  "store_for_inpainting": false,
  "sign_with_c2pa": false
}
```

Reject durations outside 3,000–600,000 ms. `loopIntent: true` remains provenance/creative intent because the simple Music endpoint has no dedicated seamless-loop boolean. The authored prompt asks for loop-friendly material.

Use the simple binary compose endpoint, not multipart detailed generation or composition-plan machinery.

## Retry and failure policy

A logical candidate gets at most three HTTP attempts: initial + two retries.

Retry only 429 and 5xx, with injected fixed backoff 1s then 2s. Deterministic 4xx failures and thrown/network failures are not retried; a network exception is intentionally conservative because it may be unclear whether a paid request reached the provider.

On final failure:

1. write one sanitized immutable failure receipt for that candidate ID;
2. stop the run;
3. preserve earlier successes;
4. the next run allocates the next candidate ID for the still-unsatisfied logical key.

This is simpler and more auditable than reopening/overwriting a failed candidate slot.

## Private staging contract

Use the existing ignored root:

```text
.tmp/audio-generation/<story>/
  music-terms-note.md
  selection.json
  <key>/
    candidate-001.mp3
    candidate-001.receipt.json
    candidate-002.failure.json
    candidate-003.mp3
    candidate-003.receipt.json
```

Candidate IDs are monotonically increasing local ordinals per key. Success or failure consumes its ID permanently; no HPA-608 operation overwrites source audio or an existing receipt.

Success receipt:

```ts
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
    readonly providerMetadata: {
        readonly requestId?: string;
        readonly traceId?: string;
        readonly songId?: string;
        readonly billingMetadata?: string;
    };
}
```

`actualDurationMs` stays `null` when the endpoint does not provide a measured duration. Do not copy intended duration into an “actual” field and do not add an audio-probing dependency. HPA-609 can measure the selected source during encoding.

Failure receipts contain only candidate ID, exact spec/hash, timestamp, sanitized failure kind/status/message. Never persist request headers, environment dumps, or API credentials.

Write source bytes first, then success JSON via temp-file + rename. Resume trusts only a complete success receipt referencing an existing source. Orphan bytes from interruption never count as complete.

## Music cost/rights preflight

Before any real BGM request in a run, require a non-empty:

```text
.tmp/audio-generation/<story>/music-terms-note.md
```

The operator records:

- actual ElevenLabs account/plan;
- pricing check date;
- Music Terms, Music API Terms, and model-specific-terms check date;
- intended Aquila distribution/use case;
- concise human decision that generation/distribution is permitted for that account/use.

The CLI checks only existence/non-empty content. It does not infer plan eligibility, classify “Studio Games,” or issue legal conclusions. Dry-run is allowed without the note and reports gate presence. SFX-only real runs do not require it.

## Credential/privacy boundary

`ELEVENLABS_API_KEY` is required only if a real provider call will execute.

- Dry-run does not read/require it.
- The key exists only in memory/request headers.
- Provider/CLI errors are sanitized before logging/persistence.
- Prompts and provider provenance live only under `.tmp/`.
- HPA-609 runtime/release artifacts must not contain prompts, provider receipts, or provider credentials.

No extra secret manager is needed for this single local operator workflow.

## Selection contract

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

`audio:select` re-derives the current spec/hash and re-hashes source bytes. It fails for unknown key, missing/failed candidate, stale spec hash, missing source, byte-length mismatch, or SHA mismatch. Updating one key preserves all other selections and every source/receipt.

## HPA-609 handoff

HPA-609 consumes only:

1. current `audio-plan.json`;
2. selected entry in `.tmp/audio-generation/<story>/selection.json`;
3. verified selected source + success receipt needed for spec/source integrity.

It then encodes/publishes immutable runtime audio. It never needs ElevenLabs credentials or another generation call.

## Test strategy

All automated tests mock provider/fetch and use temp directories. CI makes zero paid requests.

Cover:

- exact SFX/BGM spec mapping, provider duration bounds, deterministic hash;
- dated USD cost estimation;
- candidate-count/target/request-cap planning;
- success/failure persistence, candidate ID monotonicity, orphan handling, staleness, checksum verification;
- exact two endpoint request mappings;
- bounded 429/5xx retries, deterministic 4xx/network no-retry behavior;
- partial-failure resume with next candidate ID;
- Music-note gate;
- credential redaction;
- explicit selection and stale spec/source mismatch failures.

After mocked tests, allow one manual real SFX + one real instrumental BGM smoke, at most two logical generation requests total. Do not generate the full story catalog as implementation validation.

## Verification

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
```
