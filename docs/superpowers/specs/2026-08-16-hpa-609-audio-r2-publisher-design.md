# HPA-609 Audio R2 Publisher Design

**Issue:** HPA-609 — Add an immutable Aquila audio release contract and R2 publisher  
**Date:** 2026-08-16  
**Status:** Proposed

## Context

HPA-604/HPA-605 added SFX/BGM authoring and reader playback, HPA-606 added the provider-neutral per-story `audio-plan.json`, HPA-607 completed The Seventh Mirror audio direction, and HPA-608 now owns local paid generation, immutable candidate receipts, checksum verification, and explicit candidate selection.

HPA-609 is the next release-boundary slice. It publishes approved audio through the same Cloudflare R2 account/domain and the same release semantics as visual assets without weakening the image-specific runtime contract.

Current seams to reuse:

- `packages/stories/src/runtime-assets/*` — canonical JSON, safe path/story/release validation, SHA brands, active-pointer wire fields, and cache policy.
- `packages/infra-cloudflare/src/publisher/stores/delivery-store.ts` — media-neutral immutable bytes + metadata + pointer compare-and-swap.
- `LocalDeliveryStore` / `R2DeliveryStore` — existing storage implementations.
- visual `activation.ts` / `release-history.ts` — deep verification before mutation, monotonic `publishedAt`, CAS conflict handling, rollback/reactivation, and production confirmation.
- `@aquila/stories/audio-generation` — HPA-608 receipt/selection contracts and verified candidate bytes.
- compiler `collectAudioUsage` / `buildAudioUsageReport` — assembled story usage truth.
- `packages/infra-cloudflare/src/assertions.ts` — cache/content-type/pointer HTTP assertions.
- `packages/infra-cloudflare/src/verify.ts` — public-host source-key absence check.
- existing private `aquila-vn-source` and public `aquila-vn-delivery` buckets plus `assets.aquila.cwchanap.dev`.

Two existing infrastructure constraints are load-bearing:

1. `R2_PUBLISHER_*` is intentionally scoped to **`aquila-vn-delivery` only**. Audio source archival must not widen that credential.
2. the current immutable cache rule already matches `/vn/objects/` and every `runtime-manifest.json`. Runtime MP3 objects can reuse the existing content-addressed object namespace and therefore do not require a live cache-rule edit.

## Goals

1. Add a thin prompt-free audio runtime contract without polymorphizing `RuntimeAssetManifestV1`.
2. Turn HPA-608 selections into normalized runtime MP3 objects.
3. Reuse `DeliveryStore`, immutable create/reuse, preview scoping, pointer CAS, release listing, rollback, and R2 credentials where their scope already fits.
4. Archive the selected original and exact HPA-608 success receipt privately **before** public publication using a separate source-bucket credential.
5. Produce deterministic complete coverage over compiler usage, the audio plan, selections, omissions, and the resulting manifest.
6. Keep audio release identity independent from visual release identity and Vercel deployment.
7. Keep production activation explicit: audio `publish` writes immutable data only; `activate --media audio` is the only pointer mutation.

## Non-goals

- A generic media/plugin framework.
- Changing the visual background/portrait manifest, encoder, or resolver contract.
- New R2 buckets, domains, cache rules, Workers, queues, databases, approval ledgers, or CMS infrastructure.
- Browser/runtime generation.
- HLS, AAC, Opus, WAV runtime variants, stems, waveforms, adaptive bitrate, loudness mastering, or seamless-loop editing.
- Automatic candidate ranking or automatic production activation.
- Publishing the full Seventh Mirror catalog; HPA-611 owns the production pack.

## Chosen architecture

Use an audio-specific runtime/source/MP3 path and reuse only the existing media-neutral release primitives.

Rejected alternatives:

- **Generalize the visual publisher into a media adapter framework:** too much configuration and churn for two media shapes.
- **Copy the visual publisher:** duplicates the highest-risk CAS, clock, verification, and rollback logic.
- **Share the delivery publisher credential with the source archive:** conflicts with the already-reviewed least-privilege boundary and fails against the current live token scope.

The justified shared extraction is small:

```text
immutable-candidate.ts
```

It owns immutable destination inspection, create/reuse, and exact read-back verification. Encoders, manifests, coverage, and media-specific deep verification remain separate.

Activation/history keep one algorithm and gain only an internal visual/audio selector for path/parser/verifier functions.

## Runtime audio contract

Add audio-specific v1 types under `@aquila/stories/runtime-assets`. Keep `RuntimeAssetManifestV1` unchanged.

```ts
type RuntimeAudioAssetV1 = {
    identity: { type: 'sfx' | 'bgm'; key: string };
    format: 'mp3';
    path: string;
    sha256: ObjectContentSha256;
    byteLength: number;
    durationMs: number;
    loop: boolean;
};

interface RuntimeAudioManifestV1 {
    schemaVersion: 1;
    storyId: string;
    releaseId: string;
    assets: RuntimeAudioAssetV1[];
}
```

Rules:

- keys satisfy the existing audio-plan key grammar and safe logical-key predicate;
- `sfx` requires `loop:false`; `bgm` requires `loop:true`;
- `durationMs` is the measured normalized runtime duration, rounded to a positive integer;
- entries are unique and sorted by `${type}:${key}`;
- digest is lowercase SHA-256;
- `path === getAudioObjectPath(sha256)`;
- no prompt, candidate id, receipt, provider/model/request id, source path, generation spec, or selection note may appear in public runtime data;
- canonical release content excludes `releaseId` and reuses `canonicalJson` plus the existing SHA-purpose/release-id helpers.

The active pointer keeps the existing wire fields:

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

Audio gets an audio-specific parser because `manifestPath` uses the audio release path grammar. Do not add another pointer schema shape.

## Path grammar

Runtime MP3s reuse the existing global content-addressed object namespace:

```text
vn/objects/<sha256>.mp3
```

This is intentional:

- the current immutable cache rule already matches `/vn/objects/`;
- `.mp3` cannot collide with `.webp`/`.avif` keys even for identical digests;
- objects are immutable content, not release identity;
- audio release identity remains independent because manifests/pointers stay under the audio namespace.

Production audio release state:

```text
vn/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/audio/stories/<storyId>/current.json
```

Preview audio release state:

```text
vn/previews/<previewId>/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

Add:

```ts
getAudioObjectPath(sha256)
getAudioReleaseManifestPath(storyId, releaseId, target)
getAudioCurrentPointerPath(storyId, target)
```

Visual path helpers remain unchanged.

Both `LocalDeliveryStore.assertPointerKey` and `R2DeliveryStore.assertPointerKey` must accept the two audio `current.json` forms while continuing to reject arbitrary pointer paths.

## HPA-608 selection handoff

HPA-609 must prove each selection still matches the **current** generation spec. Extend the existing Node-only supported subpath with only:

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';
```

For each compiler-used included cue:

1. derive the current generation spec from the current plan row;
2. compute its current spec hash;
3. require `selection.specSha256` to equal it;
4. load `LocalAudioGenerationStore.readVerifiedCandidate(key, candidateId)`;
5. require receipt story/key/type/candidate/spec hash to agree;
6. require `selection.sourceSha256` to equal the verified source bytes hash.

Any mismatch fails before private archive upload, public object upload, manifest write, or pointer work.

## Compiler-owned publishing input

Do not reparse Markdown in `infra-cloudflare` and do not shell out to `audio:report`.

Add a Node-only `@aquila/stories/audio-publishing` subpath:

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

It wraps `STORIES_RAW_ROOT`, `loadStoryCompilerConfig`, `compileStory({writeOutputs:false})`, `loadAudioPlan`, `collectAudioUsage`, and `buildAudioUsageReport`, then cross-checks the runtime `storyId`.

Nothing from this adapter is exported from the browser/root entry.

## Coverage and explicit omissions

A selected candidate is included automatically; do not create a second included-assets list.

The only extra input is an optional omissions file:

```json
{
  "schemaVersion": 1,
  "storyId": "example_story",
  "omissions": {
    "optional-chime": "defer until the next audio pass"
  }
}
```

Rules:

- missing file means no omissions;
- reasons are trimmed and non-empty;
- unknown/compiler-unused omissions are errors;
- selected + omitted is an error;
- every compiler-used cue is exactly one of selected or omitted;
- plan-unused rows are warnings, not release obligations;
- selected-but-unused candidates are warnings and are not uploaded;
- there is no `--allow-missing` escape hatch.

Public/report coverage deliberately excludes candidate/receipt/source data:

```ts
type AudioCoverageEntryV1 =
    | {
          type: 'sfx' | 'bgm';
          key: string;
          usageCount: number;
          disposition: 'included';
      }
    | {
          type: 'sfx' | 'bgm';
          key: string;
          usageCount: number;
          disposition: 'omitted';
          reason: string;
      };
```

`candidateId`, source digest/path, receipt bytes, and provider metadata remain internal to `PreparedAudioSource` only.

## Runtime MP3 policy

Use system `ffprobe`/`ffmpeg` behind one injected process-runner seam. No JS/WASM codec stack or service.

V1 normalized policy:

```text
container/codec: MP3 / MPEG Layer III
sample rate:     44.1 kHz
bitrate:         128000 bit/s
metadata:        stripped
video/artwork:   removed
runtime MIME:    audio/mpeg
```

Normalize every selected source:

```text
ffmpeg -nostdin -hide_banner -loglevel error \
  -i <input> -map 0:a:0 -vn -map_metadata -1 \
  -ar 44100 -c:a libmp3lame -b:a 128k \
  -id3v2_version 0 -write_id3v1 0 <output.mp3>
```

Arguments are passed directly, never through a shell.

Use a generic source probe only to establish a readable audio stream and positive duration. Use one strict runtime-MP3 probe parser for both:

- normalized output verification during encoding;
- stored-object deep verification.

The strict runtime parser requires all of:

- codec `mp3`;
- sample rate `44100`;
- **present** bitrate exactly `128000`;
- finite positive duration.

Missing `bit_rate` is an integrity failure, not an optional pass.

Other hard failures:

- empty/unreadable/no audio stream;
- SFX longer than 30 seconds after normalization;
- BGM longer than 600 seconds after normalization;
- type/loop intent mismatch.

A material difference from authored target duration is a sanitized warning. Manifest duration always uses measured normalized duration.

Deep verification allows at most **25 ms** difference between the manifest duration and a fresh probe to cover integer rounding/probe precision; larger drift is integrity failure.

## Private source archive and credentials

Archive the exact selected original and exact HPA-608 success receipt before any public immutable write.

Keys:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

The archive prefix is content-addressed by the verified source digest. Re-publishing the same selected source reuses the same immutable archive objects.

Credential rule:

- `R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` remain scoped to **`aquila-vn-delivery` only**.
- add `R2_SOURCE_ARCHIVE_ACCESS_KEY_ID` / `R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY` for a second **Object Read & Write** token scoped only to **`aquila-vn-source`**.
- never widen `R2_PUBLISHER_*` to the source bucket.
- never give the source archive credential access to the delivery bucket.

Reuse the same `R2DeliveryStore` class/S3-client implementation. `createFromEnvironment({bucket:'source'})` selects the source bucket **and** the `R2_SOURCE_ARCHIVE_*` pair; `bucket:'delivery'` keeps the current `R2_PUBLISHER_*` behavior.

For local mode use sibling roots:

```text
<destination-root>/delivery/...
<destination-root>/source/...
```

Receipts never enter the delivery store. Public custom metadata for MP3/manifest/pointer objects stays empty.

## Publication preparation

Add focused audio modules:

```text
packages/infra-cloudflare/src/publisher/
  audio-source.ts
  audio-encoder.ts
  audio-runtime-release.ts
  audio-publication-plan.ts
  audio-candidate-verifier.ts
  audio-publish.ts
```

Extract only:

```text
immutable-candidate.ts
```

from the visual plan/publish code. Do not extract a general encoder/manifest/coverage adapter.

Audio publication ordering is fixed:

1. validate compiler context, plan, selection, omission coverage;
2. verify source candidates against current spec and bytes;
3. normalize runtime MP3s;
4. compute deterministic manifest/release id;
5. plan source + delivery immutable reuse/create;
6. archive selected originals + exact receipts to the private source store;
7. upload public MP3 objects + manifest;
8. deep-verify the stored audio release;
9. return with pointer unchanged.

If source archival fails, no public write occurs.

## Stored audio verification

Shallow verification checks:

- exact manifest path, JSON MIME, immutable cache metadata, and canonical bytes;
- schema/story/release id;
- canonical release-content digest;
- every entry path/digest/byte length;
- valid audio pointer candidate.

Deep verification additionally reads each unique MP3 object and requires:

- key, `audio/mpeg`, immutable cache metadata, and byte length;
- object SHA-256 equals its key/manifest digest;
- strict runtime-MP3 probe passes codec/sample-rate/**required bitrate**/duration;
- probed duration differs from manifest by at most 25 ms.

Shared object digests are read/probed once.

## Activation and release history

Keep the current CAS/clock/retry semantics single-owned.

Add internal:

```ts
type PublisherMedia = 'visual' | 'audio';
```

Visual remains the default. The selector chooses only:

- current-pointer path;
- pointer parser;
- deep stored-release verifier;
- manifest path/parser/release-identity verification for listing/history.

Do not add a public adapter registry.

Audio `publish` has no activation import and never calls `compareAndSwapPointer`. `activate --media audio` is the only normal audio pointer mutation. Rollback/reactivation rewrite only the audio pointer and reuse already verified immutables.

`mirror-preview --media audio` remains unsupported; audio can publish directly to a preview namespace.

## CLI

Keep the command vocabulary and add:

```text
--media visual|audio
```

`visual` is the default, preserving existing CLI behavior.

Audio plan/publish requires `--story-folder` because operator raw-folder identity can differ from runtime story id. Release operations need only runtime story id.

For R2 audio `plan`, no source archive credential is required because planning performs no source-bucket write. Audio `publish` requires both credential pairs before beginning any write.

Production audio `publish` is always immutable-only. `--confirm-production` is required only by explicit production activation/rollback, not by immutable publish.

## HTTP delivery verification

Do not re-derive cache/MIME policy in a parallel verifier.

A focused audio HTTP smoke imports and reuses:

```ts
assertImmutable
assertContentType
assertPointerRevalidation
```

from `packages/infra-cloudflare/src/assertions.ts`.

Extend the existing `verify.ts` source-absence helper so it accepts an explicit source key and can be reused by the audio smoke. For both the selected source archive key and receipt key, the public delivery host must return **exactly 404**. `403` is not accepted because it does not prove absence.

The only new HTTP assertion is Range behavior:

```http
Range: bytes=0-1023
```

For an MP3 larger than 1,024 bytes require `206`, exactly 1,024 body bytes, and a correct `Content-Range` total.

Because MP3 objects use `/vn/objects/`, the existing immutable cache rule already applies. No Cloudflare dashboard/cache-rule mutation is part of HPA-609.

## Risks and mitigations

### Source-archive token availability

The existing publisher token cannot write `aquila-vn-source`. The live smoke must provision/use a separate source-only Object Read & Write token. Mitigation: preflight both credential pairs and bucket access before the first release attempt; do not widen the delivery token.

### Local ffmpeg/ffprobe prerequisite

Publisher execution depends on installed system binaries. Mitigation: fail configuration before writes when either executable is unavailable; unit tests inject the runner.

### CDN Range/cache behavior

R2/custom-domain behavior must be proven against a real MP3. Mitigation: one isolated preview smoke verifies full GET, cache eligibility, 206 Range, source-key 404s, activation, rollback, and reactivation.

## Acceptance criteria

- Audio schema rejects duplicate/unsorted identities, unsafe paths, invalid digests, path/hash mismatch, invalid duration, and loop/type mismatch.
- Runtime MP3 object path is `vn/objects/<sha256>.mp3`; audio manifest/pointer remain under the audio namespace.
- Deterministic fixtures prove stable release ids/manifests and content-addressed reuse.
- Stale/missing/tampered selection fails before any R2 write.
- Coverage has no candidate/receipt/source data; every compiler-used cue is included or explicitly omitted.
- Approved originals/receipts archive privately before public writes using `R2_SOURCE_ARCHIVE_*`, never `R2_PUBLISHER_*`.
- Delivery-host GETs for archived source/receipt keys return exactly 404.
- Runtime objects carry `audio/mpeg`, exact length, immutable cache policy, 44.1 kHz MP3, and required 128000 bit/s bitrate.
- Full and Range GETs work through the existing custom domain and immutable rule without editing live cache rules.
- Preview publish/deep verify leaves production unchanged.
- Audio `publish` cannot mutate a pointer; explicit activate/rollback/reactivation affect only audio `current.json`.
- Existing visual publisher/runtime tests and default CLI behavior pass unchanged.
- Audio-only release does not rebuild Vercel or republish visual objects.

## Verification

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

Then run one local fixture release and one isolated preview R2 release through publish → deep verify → explicit activate → HTTP full/Range checks → second release → rollback → reactivation, while proving production pointer unchanged and private archive keys 404 on the delivery host.
