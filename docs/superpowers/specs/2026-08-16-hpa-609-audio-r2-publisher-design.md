# HPA-609 Audio R2 Publisher Design

**Issue:** HPA-609 — Add an immutable Aquila audio release contract and R2 publisher  
**Date:** 2026-08-16  
**Status:** Proposed

## Context

HPA-604/HPA-605 added SFX/BGM authoring and runtime playback, HPA-606 added the provider-neutral per-story `audio-plan.json`, HPA-607 completed The Seventh Mirror plan, and HPA-608 now owns local paid generation, candidate receipts, and explicit candidate selection.

HPA-609 is the next release-boundary slice. It must publish approved audio without reopening the completed visual asset architecture.

Current seams to reuse:

- `packages/stories/src/runtime-assets/*` already owns canonical JSON, content-addressed release IDs, safe story/release/path validation, pointer integrity, and cache policy.
- `packages/infra-cloudflare/src/publisher/stores/delivery-store.ts` is already media-neutral bytes + metadata + immutable create + pointer compare-and-swap.
- `R2DeliveryStore` already implements those operations over the existing R2 publisher credentials and delivery bucket.
- visual `publish.ts`, `activation.ts`, `release-history.ts`, and the CLI establish the release-operation vocabulary and the production confirmation/concurrency behavior.
- `@aquila/stories/audio-generation` already exports strict HPA-608 receipt/selection parsers and `LocalAudioGenerationStore` candidate-byte verification.
- the story compiler already has `collectAudioUsage` / `buildAudioUsageReport` and validates plan membership/type after assembled `StoryIR` exists.
- `aquila-vn-source` is the existing private authoring bucket; `aquila-vn-delivery` and `assets.aquila.cwchanap.dev` are the existing public delivery path.

One current infrastructure detail is load-bearing: the immutable Cloudflare cache rule matches `/vn/objects/*` plus any `runtime-manifest.json`. Audio manifests would therefore cache without a new rule, but `/vn/audio/objects/*.mp3` would not. HPA-609 extends that same immutable rule predicate; the zone still has exactly two Aquila cache rules.

## Goals

1. Add a thin prompt-free audio runtime contract without weakening the visual image contract.
2. Turn HPA-608 selections into one normalized MP3 object per included used cue.
3. Reuse the existing delivery store, preview convention, immutable-manifest model, pointer CAS semantics, release listing, rollback, and R2 credentials.
4. Archive the selected original and its generation receipt in the existing private source bucket before public publication.
5. Produce deterministic coverage over compiler usage, the audio plan, explicit selections, omissions, and the resulting manifest.
6. Make audio publication independent from visual publication and Vercel deployment.
7. Keep production activation explicit: audio `publish` writes only immutable data; `activate` is the only command that changes `current.json`.

## Non-goals

- A generic media-release framework.
- Polymorphizing the visual background/portrait manifest.
- New R2 buckets, domains, cache rules, Workers, queues, databases, approval ledgers, or CMS infrastructure.
- Browser/runtime generation.
- HLS, AAC, Opus, WAV runtime variants, stems, waveforms, adaptive bitrate, loudness mastering, or seamless-loop editing.
- Automatic candidate ranking or automatic production activation.
- Publishing the full Seventh Mirror catalog; HPA-611 owns the real pack.

## Approaches considered

### A. Thin audio contract + shared storage/release primitives — chosen

Keep audio schemas, source preparation, MP3 verification, and manifest verification audio-specific. Reuse the existing media-neutral `DeliveryStore` and extract only the small immutable-object helpers that are already generic. Extend the existing activation/release-history services with one `media: 'visual' | 'audio'` dispatch point while keeping their pointer timing/CAS logic single-owned.

This introduces the least new machinery while avoiding a second implementation of the most failure-prone release logic.

### B. Generalize the visual publisher into a media framework — rejected

A `MediaReleaseAdapter`/plugin framework could abstract manifests, encoders, verifiers, paths, reports, and histories. There are only two media shapes and the visual path is intentionally image-specific. The configuration surface would be larger than the audio implementation and would make the already-working visual publisher harder to reason about.

### C. Copy the visual publisher into an audio publisher — rejected

This is initially fast, but it duplicates pointer CAS, clock-skew handling, release listing, rollback/reactivation, immutable conflict detection, and R2 behavior. Those are exactly the behaviors HPA-609 is supposed to reuse from HPA-230.

## Runtime audio contract

Add audio-specific v1 types under the existing `@aquila/stories/runtime-assets` package boundary. Keep `RuntimeAssetManifestV1` unchanged.

Conceptually:

```ts
type AudioAssetType = 'sfx' | 'bgm';

interface RuntimeAudioAssetV1 {
    identity: { type: AudioAssetType; key: string };
    format: 'mp3';
    path: string;
    sha256: string;
    byteLength: number;
    durationMs: number;
    loop: boolean;
}

interface RuntimeAudioManifestV1 {
    schemaVersion: 1;
    storyId: string;
    releaseId: string;
    assets: RuntimeAudioAssetV1[];
}
```

Rules:

- `identity.key` uses the existing safe logical-key predicate and the audio-plan key grammar.
- `sfx` entries require `loop: false`; `bgm` entries require `loop: true` in v1.
- `durationMs` is the measured duration of the normalized runtime MP3, rounded to a positive integer.
- entries are unique and sorted by `${type}:${key}` using the existing lexical comparator.
- `sha256` is a lowercase SHA-256 digest and `path` must equal `getAudioObjectPath(sha256)`.
- the runtime manifest carries no prompt, candidate id, provider/model/request id, source path, receipt, generation spec, or selection note.
- canonical release content excludes `releaseId`, exactly like the visual release contract. Reuse `canonicalJson`, `releaseIdFromContentSha256`, and the existing SHA-purpose brands.

The active pointer keeps the existing wire shape:

```ts
interface ActiveReleasePointerV1 {
    schemaVersion: 1;
    storyId: string;
    releaseId: string;
    manifestPath: string;
    manifestSha256: string;
    publishedAt: string;
}
```

Do not invent a second pointer document. Add an audio-specific parser/validator because `manifestPath` follows the audio path grammar instead of the visual one.

## Path grammar

Production:

```text
vn/audio/objects/<sha256>.mp3
vn/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/audio/stories/<storyId>/current.json
```

Preview keeps the existing convention: immutable content-addressed objects are shared, while manifest/pointer state is preview-scoped.

```text
vn/audio/objects/<sha256>.mp3
vn/previews/<previewId>/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

Add `getAudioObjectPath`, `getAudioReleaseManifestPath`, and `getAudioCurrentPointerPath` beside the visual path helpers. Visual path functions remain byte-for-byte compatible.

`R2DeliveryStore.assertPointerKey` accepts both the existing visual `current.json` grammar and these two audio pointer grammars. No arbitrary pointer keys are opened up.

## HPA-608 selection handoff

HPA-608 already validates receipt JSON and candidate bytes, but HPA-609 also needs to prove that a selected candidate still matches the **current** generation spec. The current supported subpath does not export the spec builder/hash used to make that comparison.

Make one targeted handoff addition to `@aquila/stories/audio-generation`:

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';
```

For every included cue HPA-609:

1. derives the current spec from the current audio-plan row;
2. hashes it with `audioGenerationSpecSha256`;
3. requires `selection.specSha256` to equal that current hash;
4. loads `LocalAudioGenerationStore.readVerifiedCandidate(key, candidateId)`;
5. requires receipt story/key/type/candidate/spec hash to match;
6. requires `selection.sourceSha256` to equal the verified candidate bytes hash.

Any mismatch is a source/input failure before source archive, delivery upload, or pointer work.

## Compiler/plan input seam

Do not reimplement story parsing in `infra-cloudflare` and do not shell out to `audio:report`.

Add one Node-only `@aquila/stories/audio-publishing` subpath that wraps the compiler-owned pieces and returns publisher-safe inputs:

```ts
interface AudioPublishingContext {
    storyFolder: string;
    storyId: string;
    plan: AudioPlanV1;
    usage: AudioUsageReport;
}

async function loadAudioPublishingContext(
    storyFolder: string
): Promise<AudioPublishingContext>;
```

The implementation reuses `STORIES_RAW_ROOT`, `loadStoryCompilerConfig`, `compileStory({ writeOutputs: false })`, `loadAudioPlan`, `collectAudioUsage`, and `buildAudioUsageReport`. It cross-checks the runtime `storyId`. Nothing from this Node-only adapter is exported from the browser/root entry.

This is a narrow cross-package seam, not a general compiler API.

## Coverage and explicit omissions

A selected candidate is included automatically; do not create a second list of included assets.

The only extra publisher input is an **optional omissions file**, used only when a compiler-used key intentionally has no selected candidate:

```json
{
  "schemaVersion": 1,
  "storyId": "example_story",
  "omissions": {
    "optional-chime": "defer until the next audio pass"
  }
}
```

Properties:

- no omissions file means no omissions;
- each reason is trimmed and non-empty;
- an omission for an unknown or compiler-unused key is an error;
- a key cannot be both selected and omitted;
- every compiler-used cue must resolve to exactly one of selected or omitted;
- plan entries that are unused by the compiler are warnings, not release obligations;
- selected-but-unused candidates are not uploaded and produce a warning.

The resulting deterministic `AudioPublisherCoverageV1` is keyed by sorted `${type}:${key}` and records usage count plus `included` or `omitted` disposition. It does not contain prompts, provider metadata, source paths, or local absolute paths.

Production and preview use the same coverage rule. There is no `--allow-missing` escape hatch.

## Runtime MP3 policy

HPA-609 is an offline publisher, so prefer a local tool prerequisite over adding a large JS/WASM audio stack.

Use the system `ffprobe`/`ffmpeg` binaries through one small injected process-runner seam that tests can fake. No daemon or transcoding service is added.

V1 normalized output policy:

```text
container/codec: MP3 / MPEG Layer III
sample rate:     44.1 kHz
bitrate:         128 kbit/s
metadata:        stripped
video/artwork:   removed
runtime MIME:    audio/mpeg
```

Normalize every selected source rather than trying to preserve arbitrary provider muxing metadata:

```text
ffmpeg -nostdin -hide_banner -loglevel error \
  -i <input> -map 0:a:0 -vn -map_metadata -1 \
  -ar 44100 -c:a libmp3lame -b:a 128k \
  -id3v2_version 0 -write_id3v1 0 <output.mp3>
```

Implementation should pass temporary file paths rather than shell interpolation. The exact child-process argv is test-covered.

Probe both source and normalized output. Hard failures:

- empty/unreadable/no audio stream;
- non-positive or non-finite measured duration;
- SFX longer than 30 seconds after normalization;
- BGM longer than 600 seconds after normalization;
- current plan/receipt type or loop intent mismatch;
- normalized output is not MP3 at 44.1 kHz.

A material difference from the authored target duration is a warning rather than a release blocker; generative audio duration can legitimately drift. The manifest always records measured normalized duration, not planned duration.

Do not add loudness targets, channel-layout normalization, gapless-loop editing, or waveform analysis in v1.

## Private source archive

The selected original and exact HPA-608 success receipt are private release evidence. Archive them in `aquila-vn-source` before any public immutable upload.

Keys:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

The directory is content-addressed by the verified source digest. Re-publishing the same approved source reuses the same archive objects.

Use the existing `R2DeliveryStore` implementation with an explicit `bucket: 'source' | 'delivery'` factory selection; do not add a second S3/R2 client class. Source archive code only uses `stat/read/createImmutable`.

For local mode, create two sibling roots under the requested destination root:

```text
<destination-root>/delivery/...
<destination-root>/source/...
```

This keeps public and private artifacts visibly separate in fixture/smoke runs without another CLI option.

Receipts are never copied into the delivery store. Delivery custom metadata is empty for MP3/manifest/pointer objects.

## Publication preparation

Create audio-specific preparation modules rather than pushing audio branches through Sharp/image code:

```text
packages/infra-cloudflare/src/publisher/
  audio-source.ts             # context + selections + omissions + coverage + private archive inputs
  audio-encoder.ts            # ffprobe/ffmpeg runtime MP3 normalization
  audio-runtime-release.ts    # deterministic audio manifest/release id
  audio-publication-plan.ts   # immutable object/manifest candidates + advisory pointer
  audio-candidate-verifier.ts # shallow/deep stored audio verification
```

Extract one small existing generic helper:

```text
immutable-candidate.ts
```

It owns `PlannedImmutableCandidate`, destination inspection, immutable create/reuse, and exact read-back verification. Visual `publication-plan.ts` / `publish.ts` use the extracted helper unchanged in behavior; audio uses the same helper. Do not extract encoders, manifests, coverage, or media adapters.

## Stored audio verification

Shallow verification checks:

- exact manifest key, `application/json`, immutable cache metadata, and canonical bytes;
- manifest schema/story/release id;
- canonical release-content digest;
- every entry path/digest/byte length and audio pointer candidate.

Deep verification additionally reads each unique MP3 object and requires:

- key, `audio/mpeg`, immutable cache metadata, and byte length;
- object SHA-256 equals its content-addressed key/manifest digest;
- `ffprobe` identifies MP3 at 44.1 kHz with positive duration;
- measured duration agrees with the manifest within a small probe-rounding tolerance.

Verification groups shared object digests exactly as the image verifier does, so one object referenced more than once is read/probed once.

## Activation and release history

The visual activation implementation contains valuable single-owned behavior: deep verification immediately before pointer mutation, monotonic timestamps, clock-skew rejection, compare-and-swap, conflict reporting, explicit production confirmation, rollback, and reactivation.

Keep those behaviors in the existing services. Add an internal media selector:

```ts
type PublisherMedia = 'visual' | 'audio';
```

`visual` remains the default for current callers/tests. The selector chooses only:

- current-pointer path function;
- pointer parser;
- deep stored-release verifier;
- release-manifest path/parser/canonical identity verifier for history listing.

Do not introduce a public adapter/plugin registry.

Audio `publish` never calls activation. After immutables are written and deep-verified, the report states that activation is pending. `assets activate --media audio ...` is the only audio path that can mutate a pointer.

Rollback and reactivation only rewrite the audio pointer and reuse an already verified audio manifest/object set.

## CLI

Keep the existing command vocabulary and add one explicit option:

```text
--media visual|audio
```

`visual` is the default, so existing commands and JSON output remain unchanged.

Audio examples:

```bash
# inspect local work without writing a pointer
bun --filter @aquila/infra-cloudflare assets -- \
  plan --media audio --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --destination local --destination-root .tmp/hpa-609

# publish immutable preview data only
bun --filter @aquila/infra-cloudflare assets -- \
  publish --media audio --story the_seventh_mirror \
  --story-folder theSeventhMirror \
  --environment preview --preview-id hpa-609-smoke \
  --destination r2

# explicit preview activation
bun --filter @aquila/infra-cloudflare assets -- \
  activate --media audio --story the_seventh_mirror \
  --environment preview --preview-id hpa-609-smoke \
  --release sha256-<digest> --destination r2
```

Audio `plan`/`publish` accept:

- required `--story-folder` to resolve the raw-story compiler/audio-plan context and cross-check `--story`;
- optional `--audio-generation-root` overriding `.tmp/audio-generation/<storyFolder>`;
- optional `--omissions <path>`.

Audio `activate`, `verify`, `releases`, and `rollback` need only the runtime `--story` plus the existing target/release/destination options.

`mirror-preview --media audio` is deliberately unsupported. Audio preview publication can prepare the same content-addressed object plus a preview-scoped manifest directly; no second copy/mirroring workflow is needed for HPA-609.

## R2/cache integration

No resource is added.

`R2DeliveryStore.createFromEnvironment` gains an explicit bucket selection while preserving delivery as the default for visual callers. Its pointer-key allowlist gains only the two audio `current.json` grammars.

Extend the existing immutable cache-rule expression from:

```text
/vn/objects/* OR */runtime-manifest.json
```

to:

```text
/vn/objects/* OR /vn/audio/objects/* OR */runtime-manifest.json
```

The existing `ends_with(..., "/current.json")` bypass rule already covers audio pointers. Existing CORS already allows `Range` and exposes content length/ETag. Update the runbook and rule tests; do not add a third rule.

## Failure ordering

For `plan` / `publish`, perform work in this order:

1. resolve story folder/config and cross-check runtime story id;
2. load compiler usage + audio plan;
3. parse selection and optional omissions;
4. validate coverage and every selected current spec/source checksum;
5. probe/normalize included sources;
6. prepare deterministic manifest/release id;
7. inspect delivery candidates and advisory audio pointer;
8. on publish, archive selected originals/receipts privately;
9. create/reuse public MP3 objects and manifest;
10. read back and deep-verify the complete release;
11. stop — no pointer mutation.

This guarantees stale/missing selections fail before any R2 write, and a source-archive failure fails before public delivery mutation. There is no transactional promise across source and delivery buckets; immutable writes are safe to leave behind and reuse after a failed attempt.

## Testing

### Stories contract tests

Cover:

- audio identity and MP3 path grammar;
- duplicate/unsorted manifest entries;
- bad digest/path mismatch;
- invalid duration/loop/type combinations;
- canonical release identity determinism;
- audio pointer path validation for production/preview;
- forbidden public prompt/provider/source-path metadata;
- HPA-608 current-spec hash export;
- Node-only audio-publishing context using a temp raw-story fixture.

### Infra unit/integration tests

Cover:

- exact ffprobe/ffmpeg argv and malformed/unplayable inputs through an injected process runner;
- selection current-spec/source checksum validation;
- included/omitted/unclassified coverage;
- deterministic manifest and object reuse;
- private archive reuse and public metadata redaction;
- shallow/deep MP3 verification;
- publish never writing a pointer;
- audio activation conflict/no-op/reactivation/rollback while visual tests remain unchanged;
- release listing in production and preview namespaces;
- R2 store source-bucket selection and audio pointer allowlist;
- existing two cache rules with the new audio-object predicate;
- CLI parse/report behavior for `--media audio` and unchanged default visual mode.

### Focused live smoke

Use one tiny fixture release, not The Seventh Mirror catalog:

1. local plan/publish/verify;
2. isolated preview R2 publish;
3. fetch the MP3 through `assets.aquila.cwchanap.dev` and verify `audio/mpeg`, content length, immutable cache-control, and content digest;
4. repeat to observe a cache-eligible response;
5. request `Range: bytes=0-1023` and require `206` plus a valid `Content-Range`;
6. activate preview, verify pointer/manifest;
7. publish a second fixture release, activate it, rollback to the first, then reactivate the second;
8. verify production audio pointer was never changed.

## Verification commands

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

`@aquila/infra-cloudflare` currently has no `typecheck` script even though HPA-609 lists that command. Add `"typecheck": "tsc --noEmit"` as part of this ticket rather than leaving a verification command that cannot run.

## Resulting scope

HPA-609 adds one audio wire contract, one offline MP3 preparation path, one private archive path, and the minimum release-operation dispatch needed to make audio a first-class immutable release. It deliberately does not create a generalized media platform. HPA-610 can consume the resulting `current.json` + audio manifest/object contract without knowing anything about ElevenLabs, local candidate storage, or the visual image release.