# HPA-608 ElevenLabs Audio Generation Design

**Issue:** HPA-608 — Build a resumable ElevenLabs SFX and music generation CLI for Aquila stories  
**Date:** 2026-08-15  
**Status:** Proposed

## Context

HPA-606 established the authored audio-plan contract and HPA-607 has now expanded The Seventh Mirror to its complete story-level direction. The source of truth is already sufficient for generation:

- `packages/stories/raw/<story>/docs/audio-plan.json` owns provider-neutral cue identity, kind, prompt, intended duration, and BGM loop intent.
- `packages/stories/src/audio-plan.ts` validates that contract strictly.
- `packages/stories/src/audio-plan-loader.ts` is intentionally Node-only and kept out of the browser package entry.
- `.tmp/` is already gitignored for local scratch output.
- HPA-609 will consume an explicit selected source candidate; HPA-608 must not publish to R2 or create runtime manifests.

The current Seventh Mirror plan contains 41 assets: 28 SFX totaling 148.8 seconds and 13 BGM tracks totaling 19.5 minutes. At ElevenAPI's listed 2026-08-15 rates ($0.12/minute for Sound Effects and $0.15/minute for Music), one candidate for every current key is roughly $3.22 before taxes or plan-specific effects. That is small enough that the workflow should optimize for explicitness and resumability rather than build a queue, database, or service.

Current provider facts that affect the design:

- Sound Effects uses `POST /v1/sound-generation`; one API request returns one effect, explicit duration is 0.5–30 seconds, and the v2 sound model supports a `loop` flag.
- Music uses `POST /v1/music`; `music_v2` accepts prompt-based generation from 3,000–600,000 ms and supports `force_instrumental`.
- The Music v2 `auto` output is currently MP3 48 kHz / 192 kbps. The Sound Effects endpoint exposes output-format selection but its API response contract documents MP3 output; HPA-608 will therefore preserve the provider bytes instead of inventing a WAV transcoding step.
- ElevenAPI's current pricing page says API use is billed in USD, not credits. Dry-run output must therefore estimate the provider's current billing unit and identify the pricing date; it must not invent a credit conversion.
- Current Music terms have plan- and use-case-specific rights, including a separate definition for “Studio Games.” HPA-608 should enforce a human preflight note, not encode legal interpretation in TypeScript.

Provider references checked for this design:

- https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert
- https://elevenlabs.io/docs/api-reference/music/compose
- https://elevenlabs.io/docs/changelog/2026/6/15
- https://elevenlabs.io/pricing/api
- https://elevenlabs.io/music-terms
- https://elevenlabs.io/eleven-music-model-specific-terms

## Goals

1. Turn a validated story `audio-plan.json` into reviewable local ElevenLabs candidates.
2. Support both SFX and instrumental BGM through one small Bun/TypeScript workflow.
3. Make reruns safe: unchanged successful candidates are skipped by deterministic generation-spec hash.
4. Make interruption cheap: completed files and receipts remain usable after failure or Ctrl-C.
5. Bound paid work with explicit targeting, candidate-count limits, dry-run, and a hard request cap.
6. Preserve enough private provenance to audit what produced every candidate without leaking credentials into logs, Git, or runtime manifests.
7. Keep human selection explicit and machine-verifiable so HPA-609 can consume one chosen source per logical key.
8. Keep the code provider-specific only at a narrow adapter seam; do not build a general media platform.
9. Keep current ElevenLabs pricing and Music-rights assumptions visible and easy to refresh.

## Non-goals

- Runtime/browser generation.
- Cloudflare R2 upload, immutable releases, manifests, pointers, activation, or rollback.
- Automatic candidate ranking or auto-approval.
- Prompt rewriting, prompt optimization, or provider-side composition-plan generation.
- Music audio references, finetunes, inpainting, stems, streaming, or C2PA configuration.
- Narration, dialogue TTS, or voice cloning.
- Loudness normalization, mastering, trimming, or runtime MP3 encoding; HPA-609 owns publication normalization.
- A dashboard, worker, queue, database, job server, generic provider registry, or reusable “media pipeline” package.
- Legal automation. The CLI records/checks a human preflight note only.
- Backward-compatibility machinery for this local-only workflow.

## Approaches considered

### A. Direct ElevenLabs HTTP behind one injected provider interface — chosen

Use built-in `fetch` for the two generation endpoints and keep request/response mapping in one `elevenlabs.ts` module.

**Pros:** no new dependency; binary bytes and response headers stay explicit; easiest credential-redaction story; tests can inject `fetch`; the exact paid request is obvious in review.  
**Cons:** a small amount of request mapping is maintained locally.

### B. Official `@elevenlabs/elevenlabs-js` SDK

Use the official Node SDK for Sound Effects and Music.

**Rejected for now:** HPA-608 needs only two POST endpoints. Adding an SDK does not remove the filesystem/resume/selection work and makes raw binary/header behavior depend on SDK-specific wrappers. If the API surface grows later, the single provider interface leaves a straightforward migration seam.

### C. Generic provider/media pipeline

Create a common provider registry, job model, queue, storage abstraction, and provider-agnostic orchestration layer.

**Rejected:** there is one provider, one local operator, two generation types, and no runtime use. This is exactly the abstraction HPA-608 does not need.

## Decision

Build a Node/Bun-only `audio-generation` module under `packages/stories/src/`. The root `@aquila/stories` browser entry does not export it.

The workflow has five responsibilities only:

1. map validated plan rows to deterministic provider generation specs;
2. plan a bounded local batch and estimate cost;
3. call ElevenLabs through an injected provider interface;
4. persist source bytes, success/failure receipts, and resume state in `.tmp/`;
5. explicitly select one verified candidate per key.

No new package and no new runtime schema are introduced.

## Package and file boundary

Create:

```text
packages/stories/src/audio-generation/
  spec.ts          # plan row -> canonical generation spec/hash + cost estimate
  store.ts         # .tmp candidate/receipt/selection persistence and integrity checks
  elevenlabs.ts    # direct HTTP provider adapter + bounded retry classification
  run.ts           # batch planning/execution/resume orchestration
  select.ts        # explicit candidate selection and validation
  cli.ts           # parseArgs + command wiring only
```

Tests live beside the module under `audio-generation/__tests__/`.

Modify `packages/stories/package.json` with two scripts:

```json
{
  "audio:generate": "bun src/audio-generation/cli.ts generate",
  "audio:select": "bun src/audio-generation/cli.ts select"
}
```

Do not export these modules from `packages/stories/src/index.ts`.

## CLI contract

### Generate

```bash
bun --filter @aquila/stories audio:generate -- \
  --story theSeventhMirror \
  --key door-open \
  --candidate-count 2 \
  --max-requests 2
```

Supported options:

- `--story <story>` — required.
- repeatable `--key <logical-key>` — explicit target mode.
- `--missing` — resume mode; targets plan rows that do not yet have `candidate-count` successful candidates matching the current spec hash.
- `--candidate-count <n>` — desired successful candidates per key; default `1`, allowed `1..4`.
- `--dry-run` — validates and plans without credentials, filesystem mutation, or provider calls.
- `--force` — only valid with explicit `--key`; ignores matching successful-candidate count and asks for `candidate-count` additional candidates, never overwriting old files.
- `--max-requests <n>` — required for non-dry runs, allowed `1..100`; caps logical generation requests in this invocation.

Exactly one target mode is required: at least one `--key`, or `--missing`. `--missing` and `--key` are not combined. This avoids an implicit “generate the whole story” command.

The plan is always ordered by `audio-plan.json` order, then candidate ordinal. If more logical requests are missing than `--max-requests`, execute the deterministic prefix and report how many remain. Re-running `--missing` continues from persisted receipts.

`--max-requests` counts logical candidate generations, not internal retry attempts. Internal retries are separately fixed and bounded.

### Dry run

Dry run prints structured JSON containing at least:

```json
{
  "storyId": "theSeventhMirror",
  "keys": 41,
  "sfx": { "keys": 28, "durationMs": 148800 },
  "bgm": { "keys": 13, "durationMs": 1170000 },
  "candidateCount": 1,
  "logicalRequests": 41,
  "wouldExecute": 10,
  "deferredByRequestCap": 31,
  "estimatedCost": {
    "currency": "USD",
    "amount": 3.22,
    "pricingAsOf": "2026-08-15"
  }
}
```

The exact values reflect the selected keys/current files. The estimate is advisory and explicitly dated. If ElevenLabs changes billing, update the two constants and `pricingAsOf` before relying on the estimate.

### Select

```bash
bun --filter @aquila/stories audio:select -- \
  --story theSeventhMirror \
  --key door-open \
  --candidate candidate-001
```

Selection is intentionally one key at a time. The command verifies the current plan-derived spec hash, the candidate receipt, the file length, and SHA-256 before updating `selection.json`. Rejected/non-selected candidates are retained; there is no delete or auto-rank command.

## Deterministic generation spec

`audio-plan.json` remains provider-neutral. `spec.ts` derives the exact provider input used for resumability:

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

Hash `canonicalJson(spec)` with SHA-256. Reuse the existing strict canonical JSON helper from `runtime-assets/canonical.ts`; do not widen or reuse the visual/runtime manifest schemas.

Changing any paid-generation input — prompt, duration, kind, model, output format, loop/instrumental setting, or prompt influence — changes the hash and therefore makes old candidates stale for `--missing`. Old bytes/receipts stay on disk for review; they simply stop satisfying the current spec.

Plan `notes` are not hashed because they are not sent to ElevenLabs. If notes later become provider input, add the translated input field to the spec instead of hashing unrelated authoring metadata.

## Provider mapping

### SFX

Request:

```text
POST /v1/sound-generation?output_format=mp3_44100_128
```

Body:

```json
{
  "text": "<plan prompt>",
  "duration_seconds": 2.2,
  "loop": false,
  "prompt_influence": 0.3,
  "model_id": "eleven_text_to_sound_v2"
}
```

Validate the plan duration is within the provider's documented 0.5–30 second range. Do not clamp silently.

HPA-608 deliberately does not synthesize a WAV container or transcode source bytes. The chosen API endpoint's response contract currently documents MP3. Store exactly what the provider returns and record MIME type/extension/hash. HPA-609 owns the publication encoder.

### BGM

Request:

```text
POST /v1/music?output_format=auto
```

Body:

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

Validate duration is within 3,000–600,000 ms. The plan's `loop: true` is recorded as `loopIntent`; the current Music API has no simple seamless-loop request flag. The authored prompt remains responsible for asking for loop-friendly material.

Use the simple binary compose endpoint, not composition plans, detailed multipart responses, streaming, finetunes, or inpainting.

## Retry and failure policy

Use at most three HTTP attempts for a logical candidate: initial attempt plus two retries.

Retry only:

- HTTP 429;
- HTTP 5xx.

Use fixed short backoff of 1 second then 2 seconds through an injected `sleep` function so tests remain instant.

Do not retry:

- 400/401/402/403/404/409/422 and other deterministic 4xx failures;
- thrown/network errors where it is unclear whether the provider accepted and billed the request.

For a final failure:

1. write a sanitized failure receipt for the candidate attempt;
2. stop the run;
3. leave all earlier completed files untouched.

A later `--missing` run retries only the incomplete candidate. Stopping on the first final failure avoids turning a provider outage or account problem into dozens of failed requests.

## Local staging and receipts

Use the existing ignored `.tmp/` root:

```text
.tmp/audio-generation/<story>/
  music-terms-note.md
  selection.json
  <key>/
    candidate-001.mp3
    candidate-001.receipt.json
    candidate-001.attempt-001.failure.json
    candidate-002.mp3
    candidate-002.receipt.json
```

Candidate IDs are local ordinals (`candidate-001`, `candidate-002`, ...), allocated per logical key. A failed candidate keeps the same candidate ID on retry and increments its failure-attempt ordinal. `--force` allocates new candidate IDs; it never overwrites previous source audio or success receipts.

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

`actualDurationMs` is `null` when the chosen endpoint does not return measured duration. Do not lie by copying the intended duration into an “actual” field and do not add an audio-probing dependency just for HPA-608. HPA-609's encoder can measure the selected source when it normalizes the publication artifact.

Failure receipts contain only candidate ID, spec/hash, sanitized error class/status/message, and timestamp. Never persist API headers wholesale, request headers, bearer credentials, or environment dumps.

Write candidate bytes first, then atomically replace the JSON receipt through a temporary file + rename. Resume trusts only a complete success receipt whose referenced file exists and whose SHA-256 matches. Orphan bytes from an interruption are ignored and never treated as complete.

## Music cost/rights preflight

Before the first real BGM provider call in a run, require a non-empty:

```text
.tmp/audio-generation/<story>/music-terms-note.md
```

The operator records, in plain Markdown:

- ElevenLabs account/subscription plan;
- date current API pricing was checked;
- date current Music Terms, Music API Terms, and model-specific terms were checked;
- intended Aquila distribution/use case;
- a concise human decision that the planned generation/distribution is permitted for that account/use.

The CLI checks presence/non-empty content only. It does not parse the plan name, infer “Studio Game” status, or make a legal determination.

Dry-run is allowed without this note and reports whether the gate is present. SFX-only real runs do not require the Music note.

## Credential and privacy boundary

`ELEVENLABS_API_KEY` is required only when a real provider request will execute.

- Dry-run never reads or requires the key.
- The key exists only in memory/request headers.
- CLI/provider errors are sanitized before logging or persistence.
- Prompts and provider metadata remain under `.tmp/`, not Git.
- Runtime manifests and HPA-609 release artifacts must not contain prompts, provider IDs, provider receipts, or credentials.

No extra secret manager is needed for this local operator workflow.

## Explicit selection contract

`selection.json` is private local state, separate from provider receipts:

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

`audio:select` must recompute the current generation spec hash and source-file SHA-256. It fails if:

- the key is absent or has the wrong current plan kind;
- the candidate success receipt is missing/invalid;
- receipt `specSha256` differs from the current spec hash;
- the source file is missing;
- source length/hash differs from the receipt.

Selection updates only the one key and leaves all source candidates/receipts intact.

## HPA-609 handoff

HPA-609 should consume only:

1. the current `audio-plan.json` row;
2. the selected candidate entry in `.tmp/audio-generation/<story>/selection.json`;
3. the verified selected source file + receipt required to prove spec/source integrity.

HPA-609 then normalizes the selected source to the runtime publication format and builds the immutable release contract. It must not need ElevenLabs credentials or call ElevenLabs.

## Test strategy

All automated tests use mocked provider/fetch/filesystem temp directories. No paid request runs in CI.

Required coverage:

- plan row -> exact SFX/BGM generation spec and deterministic hash;
- provider duration validation and current USD estimate;
- candidate-count and deterministic request-cap planning;
- candidate persistence, checksum validation, orphan handling, spec-change staleness, `--missing`, and `--force`;
- exact ElevenLabs request mapping for SFX and `music_v2` instrumental BGM;
- 429/5xx bounded retries and immediate deterministic 4xx/network failure;
- partial-failure resume;
- Music terms-note gate;
- API key not appearing in stdout/stderr/failure receipts;
- selection success and checksum/spec mismatch failures.

One manual provider smoke is allowed after mocked tests pass:

- one short SFX candidate;
- one short instrumental `music_v2` candidate;
- at most two successful generation requests total.

Do not generate the full story catalog as an implementation smoke test.

## Verification

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories lint
bun run compile:check
```

For manual provider smoke, additionally run dry-run first and inspect the request/cost summary before using `ELEVENLABS_API_KEY`.
