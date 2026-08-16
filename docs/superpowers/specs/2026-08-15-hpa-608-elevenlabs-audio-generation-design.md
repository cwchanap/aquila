# HPA-608 ElevenLabs Audio Generation Design

**Issue:** HPA-608 — Build a resumable ElevenLabs SFX and music generation CLI for Aquila stories  
**Date:** 2026-08-15  
**Status:** Proposed

## Context

HPA-606 established one provider-neutral `audio-plan.json` per story and HPA-607 expanded The Seventh Mirror to its complete story-wide audio direction. HPA-608 consumes that contract as a local content-production tool. It does not add a runtime service, release framework, or second authored inventory.

Current repository seams to reuse:

- `packages/stories/src/audio-plan.ts` — strict provider-neutral `AudioPlanV1` / `AudioPlanAsset`.
- `packages/stories/src/audio-plan-loader.ts` — Node-only `loadAudioPlan`.
- `packages/stories/src/runtime-assets/canonical.ts` — strict `canonicalJson` used for deterministic hashes.
- `packages/stories/src/runtime-assets/paths.ts` — existing `isStoryId` / `isSha256` validation.
- `packages/stories/src/compiler/cli.ts` — current raw-story discovery and `compiler.config.ts` loading.
- `.tmp/` — already ignored local scratch root.
- `packages/infra-cloudflare/src/publisher/*` — conventions worth mirroring for CLI/report/error taxonomy, but not imported because `@aquila/infra-cloudflare` already depends on `@aquila/stories`.

For The Seventh Mirror the CLI-facing raw folder and runtime story id are intentionally different:

```text
storyFolder = theSeventhMirror
storyId     = the_seventh_mirror
```

The current plan contains 41 assets: 28 SFX and 13 BGM. `camera-shutter` is currently `400ms`, while the Sound Effects API requires an explicit duration of at least `500ms`; HPA-608 corrects that authoring value rather than clamping provider-neutral plan data.

HPA-609 owns source probing, normalization/encoding, R2 archive/publication, runtime manifests, activation, verification, and rollback. HPA-608 must give HPA-609 one verified selected local source without requiring ElevenLabs credentials.

## Goals

1. Turn validated `audio-plan.json` rows into reviewable local ElevenLabs SFX/BGM candidates.
2. Keep generation explicit, sequential, bounded, and resumable for one local operator.
3. Preserve exact paid-generation input and returned-source provenance without exposing credentials publicly.
4. Define stored success strongly enough that dry-run, `--missing`, selection, and HPA-609 all agree.
5. Keep the raw folder name as the filesystem selector while persisting the runtime/publisher `storyId` in JSON contracts.
6. Give HPA-609 a supported Node-only package subpath for selection/receipt verification rather than forcing a deep import or duplicate parser.
7. Verify the real provider contract before most mocked orchestration tests crystallize assumptions.
8. Keep all new abstractions justified by immediate testability or the HPA-609 handoff.

## Non-goals

- Runtime/browser generation.
- Cloudflare R2 publication or runtime manifests.
- Automatic candidate ranking/approval.
- Prompt rewriting or prompt optimization.
- Composition plans, references, finetunes, inpainting, stems, streaming, or C2PA workflow machinery.
- Narration/dialogue TTS.
- Loudness normalization, mastering, trimming, transcoding, or duration probing.
- Dashboard, queue, worker, database, generic provider registry, or reusable media-pipeline package.
- Legal automation.
- Backward-compatibility machinery for local CLI behavior.

## Chosen approach

Use built-in `fetch` for the two paid endpoints behind one injected `AudioGenerationProvider` seam. Keep generation state in a small story-local filesystem store under `.tmp/`.

Rejected alternatives:

- **Official SDK:** two POST endpoints do not justify another dependency and the SDK does not remove the local store/resume/selection work.
- **Generic provider/media platform:** there is one provider, one operator, and no runtime generation.
- **Reuse infra publisher storage/hash code:** dependency direction would invert (`infra-cloudflare -> stories` already exists), and the publisher store models R2 keys/pointers/etags rather than local paid candidates.

## File boundary

Create:

```text
packages/stories/src/audio-generation/
  index.ts        # Node-only supported subpath for HPA-609
  spec.ts         # current paid spec/hash/provider validation + cost scope
  store.ts        # candidate persistence + strict success receipt parser
  elevenlabs.ts   # direct HTTP provider adapter
  run.ts          # story context, planning, sequential generation/resume
  select.ts       # strict selection contract + verification
  cli.ts          # parseArgs, JSON report, exit codes
```

Tests live under `audio-generation/__tests__/`.

Do **not** export this module from `packages/stories/src/index.ts`. Instead add one explicit package subpath:

```json
{
  "exports": {
    "./audio-generation": "./src/audio-generation/index.ts"
  }
}
```

`audio-generation/index.ts` exports only the Node-side handoff required by HPA-609:

- `AudioCandidateReceiptV1Schema` and type;
- `AudioSelectionFileV1Schema` and type;
- the stored-generation-spec parser/type required by the receipt;
- `LocalAudioGenerationStore` / verified candidate type.

The browser/root entry remains unchanged. HPA-609 consumes `@aquila/stories/audio-generation`; it does not deep-import `src/audio-generation/*`.

## One owner for raw-story config loading

HPA-608 must not create a second definition of `packages/stories/raw/<folder>/compiler.config.ts`.

Extract from the current compiler CLI into `packages/stories/src/compiler/config.ts`:

```ts
export const STORIES_RAW_ROOT: string;

export async function loadStoryCompilerConfig(
    rawDir: string
): Promise<StoryCompilerConfig>;
```

`compileNamedStory` and HPA-608 both reuse these helpers. The compiler config modules continue to import `StoryCompilerConfig` as a type only; nothing is added to the root package export.

## Story identity boundary

Operator input:

```text
--story theSeventhMirror
```

Resolution:

```text
rawDir = <STORIES_RAW_ROOT>/theSeventhMirror
config = loadStoryCompilerConfig(rawDir)
storyId = config.storyId
```

Validate `storyId` with the existing `isStoryId` helper.

Staging path uses the folder:

```text
.tmp/audio-generation/theSeventhMirror/
```

Persisted success/selection JSON uses:

```json
{ "storyId": "the_seventh_mirror" }
```

Construct the store once per story:

```ts
new LocalAudioGenerationStore({
    root: '.tmp/audio-generation/theSeventhMirror',
    storyId: 'the_seventh_mirror',
});
```

Store methods do not accept a repeated `storyId` argument. Receipt/story cross-checking is owned by the store and cannot be skipped by callers.

## Provider compatibility validation

`AudioPlanV1` remains provider-neutral and accepts any positive `durationMs`. HPA-608 applies ElevenLabs limits while deriving paid specs:

- SFX explicit duration: `500..30000ms`.
- BGM prompt duration: `3000..600000ms`.
- Never clamp.

Task 1 changes the existing `camera-shutter` row from `400` to `500ms`.

The planner validates the whole requested asset set and aggregates every provider-illegal key in plan order:

```ts
interface AudioGenerationSpecIssue {
    readonly key: string;
    readonly type: 'sfx' | 'bgm';
    readonly message: string;
}
```

If any issue exists, paid execution is zero and the command exits with the invalid-plan exit code.

A normal `@aquila/stories` test loads the committed Seventh Mirror plan and asserts `buildAudioGenerationSpecSet(plan.assets).issues` is empty. This catches the next provider-illegal authored duration before anyone reaches for an API key.

## Current paid-generation spec

The current builder emits exact values for every paid request input so changing model/output/request policy changes the spec hash.

Conceptually:

```ts
type CurrentAudioGenerationSpec =
    | {
          schemaVersion: 1;
          key: string;
          type: 'sfx';
          prompt: string;
          durationMs: number;
          provider: 'elevenlabs';
          modelId: 'eleven_text_to_sound_v2';
          outputFormat: 'mp3_44100_128';
          loop: false;
          promptInfluence: 0.3;
      }
    | {
          schemaVersion: 1;
          key: string;
          type: 'bgm';
          prompt: string;
          durationMs: number;
          provider: 'elevenlabs';
          modelId: 'music_v2';
          outputFormat: 'auto';
          loopIntent: true;
          forceInstrumental: true;
      };
```

Hash `canonicalJson(spec)` using a local `node:crypto.createHash('sha256')`. Do not import the infra publisher hash helper and do not widen visual runtime schemas.

`notes` are excluded because they are not sent to ElevenLabs.

### Historical receipt readability

The **builder** keeps current literals. The **persisted receipt parser** must not pin values that are expected to change between paid generations.

The nested stored spec keeps the same strict field structure but parses provider/model/output/request-setting values by type (for example `provider/modelId/outputFormat: z.string()`, booleans as booleans, prompt influence as number). This lets an old paid receipt remain readable after `music_v2 -> music_v3` or an output-policy change.

Staleness is determined by comparing the stored `specSha256` with the hash of the current builder output, not by making historical receipts fail schema parsing.

Use existing `isSha256` refinements for `specSha256`, source/output digests, and `isStoryId` for persisted `storyId`.

## Provider contract

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

`loopIntent` is local production intent; no BGM `loop` field is sent.

### Provider success

A 2xx status alone is not success. Require the returned `Content-Type` (parameters stripped) to start with `audio/` before accepting bytes. The returned media type determines the stored extension/format where `output_format=auto` is used.

Do not retry a 2xx non-audio response.

## Early real-provider contract probe

Do not wait until the final assembled CLI smoke to learn whether the paid request assumptions match reality.

Before writing the exhaustive adapter/orchestration mocks, run one **throwaway, uncommitted** probe under `.tmp/`:

- one `500ms` SFX;
- one `3000ms` instrumental BGM;
- hard two-request cap;
- same direct HTTP request fields intended for `elevenlabs.ts`;
- record status, sanitized response headers, `Content-Type`, byte count, and a short hex/magic-byte prefix;
- never print/store the API key.

The BGM probe requires the same concise Music terms/account preflight note as later real generation.

This probe is not production code and is deleted/left ignored after recording the local transcript. Task 3's exact HTTP mocks are then written from the observed contract rather than assumptions alone.

The final task still performs a second two-request smoke through the assembled CLI. Total planned real generations for HPA-608 implementation are therefore capped at four: two contract-probe requests plus two final CLI requests.

## Retry policy

For one logical candidate, at most three HTTP attempts total:

- retry `429` and `5xx` only;
- injected sleeps: `1000ms`, then `2000ms`;
- deterministic 4xx: no retry;
- thrown/network errors: no retry because provider acceptance/billing is ambiguous;
- 2xx non-audio: no retry.

Stop the batch on the first final failure.

`--max-requests` counts logical paid generations, not internal retry attempts.

## Local store and candidate ids

Story root:

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

Candidate ids are immutable local ordinals. Success bytes, orphan bytes, or a failure marker consume the ordinal; a later run allocates the next unused id.

### Success receipt

`AudioCandidateReceiptV1Schema` is a strict, versioned cross-package contract because HPA-609 reads it through `@aquila/stories/audio-generation`.

It records at least:

```text
schemaVersion: 1
storyId
key / type / candidateId
stored exact generation spec
specSha256
provider / model
createdAt
intendedDurationMs
actualDurationMs: number | null
output.filename / mediaType / format / byteLength / sha256
approved non-secret provider identifiers when available
```

`actualDurationMs` stays `null` unless ElevenLabs returns a measured duration. HPA-609 probes selected source duration during normalization.

### Definition of stored success

A candidate counts for `--missing` / candidate count only when all are true:

1. success receipt exists;
2. receipt parses through `AudioCandidateReceiptV1Schema`;
3. receipt `storyId`, key, candidate id, and current spec hash agree;
4. referenced bytes exist;
5. byte length matches;
6. SHA-256 of the **actual bytes** matches the receipt.

Dry-run and paid runs use this same checksum-verified definition. Candidate files are small; there is no unverified fast path.

Write candidate bytes first. Write the receipt to a temporary sibling and rename atomically. Orphan bytes never count as success.

### Failure marker

Do not build a second parsed/versioned failure contract. On final failure, write a simple immutable:

```text
candidate-NNN.failure.json
```

containing candidate id, runtime story id, exact spec/hash, timestamp, and sanitized failure kind/status/message. Runtime code never trusts/parses it as a contract; `nextCandidateId` only needs the filename to see that the ordinal is consumed.

A single `failures.jsonl` is rejected because an unparsed JSONL log cannot also make filename-based ordinal allocation see a failed candidate id.

## Selection and HPA-609 handoff

`selection.json` is the other strict, versioned cross-package contract.

```ts
interface AudioSelectionFileV1 {
    schemaVersion: 1;
    storyId: string;
    selections: Record<
        string,
        {
            candidateId: string;
            specSha256: string;
            sourceSha256: string;
        }
    >;
}
```

Refine `storyId` with `isStoryId` and hashes with `isSha256`.

Selection is one key at a time. Before atomically updating `selection.json`:

1. resolve the current plan row/spec/hash;
2. call `LocalAudioGenerationStore.readVerifiedCandidate(key, candidateId)`;
3. require candidate `specSha256` to equal the current spec hash;
4. persist the verified source SHA-256.

No auto-ranking or rejection database is added. Non-selected candidates remain on disk.

HPA-609 imports the schema/store through:

```ts
import {
    AudioSelectionFileV1Schema,
    LocalAudioGenerationStore,
} from '@aquila/stories/audio-generation';
```

It can therefore fail stale/tampered selection before publication without reimplementing HPA-608 JSON parsing.

## CLI contract

Use direct file-path invocation for machine-readable output:

```bash
bun packages/stories/src/audio-generation/cli.ts generate ...
bun packages/stories/src/audio-generation/cli.ts select ...
```

Package scripts may exist as human convenience aliases, but tests/docs that parse stdout use the file path. The repository already records Bun `--filter` stdout-prefix behavior that corrupts captured JSON.

### Generate options

- `--story <raw-folder>` — required.
- repeatable `--key <logical-key>` — explicit target mode.
- `--missing` — resume mode.
- `--candidate-count <n>` — desired total matching successes per key; default `1`, range `1..4`.
- `--dry-run` — validates/plans with no credentials, mutation, or provider calls.
- `--max-requests <n>` — required for non-dry runs, range `1..100`.

Exactly one target mode: explicit keys or `--missing`.

There is **no `--force`**. If a key already has one valid success and the operator wants one more candidate, explicitly target it with `--candidate-count 2`; the planner generates only the missing additional success. Stale-spec candidates never satisfy the current count anyway.

### Dry-run report and cost scope

Dry-run reports:

- story folder and runtime story id;
- SFX/BGM asset counts and intended duration;
- desired candidate count;
- logical generations still needed;
- amount executable under the request cap;
- remainder deferred by the cap;
- aggregated provider issues;
- dated advisory estimated USD for the **scheduled repeated-per-candidate spec list**.

Keep the estimator because HPA-608 explicitly requires a pre-spend calculable estimate. It is deliberately tiny: two dated rates plus `duration * scheduled-candidate-count`; it is not a credit ledger. Always show `pricingAsOf` and the raw duration/request counts so the operator can compare current provider pricing before spending.

At implementation time, re-check the official provider pricing page and set the date/rates then; never treat the constants as a live price service.

No implicit full-story generation exists; `--missing` is explicit.

## Exit codes

Machine-readable stdout gets a stable small exit taxonomy mirroring the sibling publisher style without importing it:

```text
0 = success, including a capped run with remainder deferred
1 = configuration / CLI usage
2 = invalid plan, provider-illegal rows, stale/invalid selection input
3 = provider or local I/O failure during execution
```

Implement one `audioGenerationExitCode(error)` function and test every class.

## Music terms preflight

Before a real BGM request require non-empty:

```text
.tmp/audio-generation/<storyFolder>/music-terms-note.md
```

The operator records account/plan, check date, intended Aquila distribution, and concise human conclusion. Code checks only presence/non-empty. Do not turn this into legal automation.

## Test strategy

### Unit/integration tests

- current spec mapping/hash and provider-bound aggregation;
- committed Seventh Mirror plan has zero provider issues;
- story folder -> shared compiler config -> validated runtime story id;
- strict receipt/selection parsing with existing `isStoryId` / `isSha256` refinements;
- historical receipt remains parseable when current model/output constants differ;
- atomic persistence, orphan handling, checksum verification, immutable ids;
- exact HTTP mapping based on the early real-provider transcript;
- `audio/*` success validation and sanitized retry/error behavior;
- request cap, sequential stop-on-failure, interrupted/resumed execution;
- candidate-count additional generation without `--force`;
- selection spec/source drift failures;
- direct-path JSON stdout and exit-code map;
- root `@aquila/stories` entry does not export generation APIs, while `@aquila/stories/audio-generation` resolves in Node tests.

### Real-provider checks

1. Early two-request contract probe before exhaustive HTTP/orchestration mocks.
2. Final two-request assembled CLI smoke: one SFX + one BGM generation.

No production publish occurs in HPA-608.

## Risks and mitigations

- **Wrong story id:** store constructor owns validated runtime `storyId`; callers do not pass it repeatedly.
- **Future provider-illegal authoring:** committed-plan test fails normal stories tests.
- **Paid artifacts become unreadable after model/output change:** persisted spec parser accepts historical string/typed values; current spec hash owns staleness.
- **Mocked provider assumption is wrong:** two-request probe happens before exhaustive adapter/orchestration mocks.
- **JSON stdout polluted by Bun filter prefixes:** parseable commands use direct file invocation.
- **Tampered file suppresses paid generation:** matching success always re-hashes bytes.
- **2xx error body becomes audio candidate:** adapter requires `Content-Type: audio/*`.
- **Provider outage causes broad spend:** sequential execution, request cap, bounded retries, stop on first final failure.
- **Terms check grows into compliance machinery:** gate remains a non-empty human note only.

## Acceptance criteria

- [ ] `camera-shutter` is provider-compatible and the committed Seventh Mirror plan has zero provider issues in normal tests.
- [ ] Dry-run performs zero provider work and reports counts/durations/request scope plus dated advisory estimated USD.
- [ ] `--story` uses raw folder while success/selection JSON uses validated `compiler.config.ts` `storyId`.
- [ ] Shared compiler story-config loading has one owner.
- [ ] Current successful candidates are skipped only after strict parse + actual-byte SHA-256 verification.
- [ ] Old paid receipts remain readable after current model/output constants change; they become stale by spec hash instead.
- [ ] Success receipt and selection are strict versioned schemas available through `@aquila/stories/audio-generation`.
- [ ] HPA-609 can verify a selected source without ElevenLabs credentials or deep imports.
- [ ] No `--force`; additional explicit candidates use a higher desired `--candidate-count`.
- [ ] Provider 2xx responses require `audio/*` before persistence.
- [ ] 429/5xx retry is bounded; thrown/network failures are not retried.
- [ ] Exit codes are stable: 0 success, 1 configuration, 2 invalid input/plan, 3 provider/I/O failure.
- [ ] Early real-provider contract probe is capped at one minimum SFX + one minimum BGM request.
- [ ] Final assembled CLI smoke is capped at one SFX + one BGM request.
- [ ] Generated binaries/receipts/selections/terms notes remain ignored/private and no R2/runtime work is added.

## Review resolution

Accepted from the second review pass:

- supported `@aquila/stories/audio-generation` Node subpath for HPA-609;
- early two-request real-provider probe before exhaustive mocks;
- historical persisted-spec parser that does not pin current model/output/request constants;
- constructor-owned runtime `storyId` plus existing `isStoryId` / `isSha256` validators;
- committed Seventh Mirror provider-compatibility test;
- shared raw-root/compiler-config loader;
- explicit 0/1/2/3 exit-code taxonomy;
- remove `--force`.

Accepted in simplified form:

- remove the strict/versioned failure-receipt schema, but keep one `candidate-NNN.failure.json` marker so the failed ordinal is consumed without parsing a global log.

Intentionally retained:

- dated advisory USD estimate, because it is an explicit HPA-608 pre-spend acceptance requirement and is only a tiny calculation over the scheduled spec list;
- `schemaVersion: 1` on success receipt/selection, because those files are now a supported HPA-609 cross-package handoff rather than private implementation-only scratch.

## YAGNI boundary

Do not add an SDK dependency, provider registry, queue, worker, database, dashboard, job scheduler, auto-ranking, failure database, price service, legal rules engine, audio probe/transcoder, generic media abstraction, browser export, runtime generation, or HPA-609 publication logic.
