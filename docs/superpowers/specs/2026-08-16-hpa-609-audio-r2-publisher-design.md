# HPA-609 Audio R2 Publisher Design

**Issue:** HPA-609 — Add an immutable Aquila audio release contract and R2 publisher  
**Date:** 2026-08-16  
**Status:** Proposed

## Context

HPA-604/HPA-605 added SFX/BGM authoring and playback, HPA-606 added provider-neutral per-story `audio-plan.json`, HPA-607 completed The Seventh Mirror audio direction, and HPA-608 now owns local paid generation, candidate receipts, and explicit candidate selection.

HPA-609 is the next release-boundary slice. It should make approved audio publishable without reopening the completed visual release architecture.

Current seams to reuse:

- `packages/stories/src/runtime-assets/*` already owns canonical JSON, content-addressed release ids, safe path/story/preview validation, pointer integrity, and cache policy.
- `packages/infra-cloudflare/src/publisher/stores/delivery-store.ts` is already media-neutral bytes + metadata + immutable create + pointer compare-and-swap.
- `R2DeliveryStore` already implements that interface using the existing publisher credentials.
- visual `activation.ts` and `release-history.ts` already own monotonic pointer time, conflict handling, production confirmation, rollback, and reactivation behavior.
- `@aquila/stories/audio-generation` already exposes HPA-608's strict receipt/selection parsers and checksum-verifying local store.
- the story compiler already owns cue collection and the deterministic audio-usage report.
- `aquila-vn-source`, `aquila-vn-delivery`, and `assets.aquila.cwchanap.dev` already exist.

One infrastructure detail is load-bearing: the current immutable Cloudflare cache rule matches `/vn/objects/*` plus any `runtime-manifest.json`. Audio manifests therefore match it already, but `/vn/audio/objects/*.mp3` does not. HPA-609 extends that **same** rule; Aquila still uses exactly two cache rules.

## Goals

1. Add a thin prompt-free runtime audio v1 contract without weakening the image contract.
2. Turn HPA-608 selections into one normalized MP3 object per included compiler-used cue.
3. Reuse the existing R2 stores, preview convention, immutable-object model, pointer CAS, release listing, rollback, and publisher credentials.
4. Archive selected originals and their exact HPA-608 success receipts in the existing private source bucket before public publication.
5. Produce deterministic coverage from compiler usage + plan + selections/omissions + manifest.
6. Keep audio release identity independent from visual releases and Vercel deployment.
7. Make activation explicit: audio `publish` writes immutable data only; only `activate --media audio` changes `current.json`.

## Non-goals

- A generic media-release/plugin framework.
- Polymorphizing `RuntimeAssetManifestV1` or changing visual background/portrait behavior.
- New buckets, domains, cache rules, Workers, queues, databases, approval ledgers, or CMS infrastructure.
- Browser/runtime generation.
- HLS, AAC, Opus, WAV runtime variants, stems, waveforms, adaptive bitrate, loudness mastering, or seamless-loop editing.
- Automatic candidate ranking or automatic production activation.
- Publishing The Seventh Mirror's real catalog; HPA-611 owns that operation.

## Approaches considered

### A. Thin audio contract + shared storage/release primitives — chosen

Keep audio schema, source preparation, MP3 normalization, and MP3 verification audio-specific. Reuse `DeliveryStore`, extract only the immutable-object operations that are already media-neutral, and add one small `visual | audio` selector inside the existing activation/history services so the pointer algorithm remains single-owned.

This is the smallest design that reuses HPA-230's valuable release semantics without turning the visual publisher into a framework.

### B. Generalize the visual publisher into a media framework — rejected

An adapter layer for encoders, manifests, paths, coverage, reports, and verification would add more configuration than the second media shape needs. It would also make a mature image path harder to reason about.

### C. Copy the visual publisher into an audio publisher — rejected

Copying is initially fast but duplicates exactly the difficult behavior HPA-609 is supposed to reuse: immutable conflict checks, pointer CAS, timestamp monotonicity, release history, rollback, and reactivation.

## Runtime audio contract

Add audio-specific v1 symbols under the existing `@aquila/stories/runtime-assets` boundary. Keep `RuntimeAssetManifestV1` unchanged.

```ts
interface RuntimeAudioAssetV1 {
    identity: { type: 'sfx' | 'bgm'; key: string };
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

Contract rules:

- key uses the existing safe logical-key predicate plus the audio-plan slug grammar;
- entries are unique and sorted by `${type}:${key}`;
- `sfx` requires `loop:false`; `bgm` requires `loop:true`;
- `format` is exactly `mp3`;
- `sha256` is a lowercase SHA-256 digest;
- `path` must equal `getAudioObjectPath(sha256)`;
- `byteLength` and measured `durationMs` are positive integers;
- manifest and pointer schemas are strict, so unknown public fields are rejected rather than silently stripped;
- public data carries no prompt, provider/model/request id, candidate id, receipt, generation spec, source path, selection note, credential, or absolute URL/path.

Audio release identity uses the same rule as visual release identity: canonical release content excludes `releaseId`; `releaseId` is `sha256-<canonical-content-digest>`. Reuse `canonicalJson`, SHA-purpose brands, and `releaseIdFromContentSha256`; do not duplicate hashing utilities.

The pointer keeps the existing wire shape (`schemaVersion`, `storyId`, `releaseId`, `manifestPath`, `manifestSha256`, `publishedAt`). Add an audio parser/validator because its `manifestPath` grammar differs from the visual one; do not add a second pointer document shape.

## Path grammar

Production:

```text
vn/audio/objects/<sha256>.mp3
vn/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/audio/stories/<storyId>/current.json
```

Preview mirrors the existing visual convention: content-addressed objects are shared while manifest/pointer state is preview-scoped.

```text
vn/audio/objects/<sha256>.mp3
vn/previews/<previewId>/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

Add `getAudioObjectPath`, `getAudioReleaseManifestPath`, and `getAudioCurrentPointerPath` next to the visual helpers. Keep all existing visual path functions unchanged.

`R2DeliveryStore.assertPointerKey` gains only these production/preview audio `current.json` forms in addition to its existing visual allowlist.

## HPA-608 selection handoff

HPA-608 proves the saved receipt and candidate bytes are internally valid, but HPA-609 must also prove the selection still matches the **current** plan/generation policy. Its supported subpath currently does not expose the current spec builder/hash.

Add only:

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';
```

to `@aquila/stories/audio-generation`.

For each included cue HPA-609:

1. derives the current generation spec from the current audio-plan row;
2. hashes it with `audioGenerationSpecSha256`;
3. requires `selection.specSha256` to equal that current hash;
4. loads `LocalAudioGenerationStore.readVerifiedCandidate(key, candidateId)`;
5. requires receipt story/key/type/candidate/spec hash agreement;
6. requires `selection.sourceSha256` to equal the actual verified candidate-byte digest.

Any mismatch fails before source archival, delivery upload, or pointer work.

## Compiler-owned publisher input seam

Do not reimplement story parsing in `infra-cloudflare` and do not shell out to `audio:report`.

Add one Node-only `@aquila/stories/audio-publishing` subpath:

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

Its implementation reuses `STORIES_RAW_ROOT`, `loadStoryCompilerConfig`, `compileStory({ writeOutputs:false })`, `loadAudioPlan`, `collectAudioUsage`, and `buildAudioUsageReport`. The root/browser entry does not export it.

This is one narrow bridge for publisher input, not a general compiler API.

## Coverage and explicit omissions

A selected candidate is included automatically. Do not add a second authored inclusion list.

The only extra publisher input is an optional omissions file for a compiler-used key intentionally left silent:

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

- no file means no omissions;
- reason is trimmed and non-empty;
- unknown or compiler-unused omission is an error;
- a key cannot be both selected and omitted;
- every compiler-used cue is exactly selected or omitted;
- plan entries unused by the compiler are warnings, not release obligations;
- selected-but-unused candidates are not uploaded and produce a warning.

`AudioPublisherCoverageV1` is sorted by `${type}:${key}` and records `usageCount` plus either `included` or `omitted` + reason. It carries no prompts/provider/source paths.

Preview and production use the same coverage rule. There is no `--allow-missing` escape hatch.

## Runtime MP3 policy

HPA-609 is an offline publisher. Use system `ffprobe`/`ffmpeg` through one injected process-runner seam rather than adding a large JS/WASM audio dependency or service.

V1 policy:

```text
container/codec: MP3 / MPEG Layer III
sample rate:     44.1 kHz
bitrate target:  128 kbit/s
metadata/artwork: stripped
runtime MIME:    audio/mpeg
```

Normalize every selected source:

```text
ffmpeg -nostdin -hide_banner -loglevel error \
  -i <input> -map 0:a:0 -vn -map_metadata -1 \
  -ar 44100 -c:a libmp3lame -b:a 128k \
  -id3v2_version 0 -write_id3v1 0 <output.mp3>
```

Pass argv + temporary file paths directly; never construct a shell command string.

Probe source and normalized output. Hard failures:

- empty/unreadable/no audio stream;
- non-positive/non-finite duration;
- SFX longer than 30,000 ms after normalization;
- BGM longer than 600,000 ms after normalization;
- plan/receipt type or loop-intent mismatch;
- normalized output is not MP3 at 44.1 kHz;
- when `ffprobe` reports a stream bitrate, it is not 128,000 bit/s.

The ffmpeg argv is the authoritative encoding-policy check; the deep stored verifier independently checks codec/sample rate/duration/hash and validates the reported bitrate when available.

A material duration difference from the authored target is only a warning because generated audio can legitimately drift. The manifest records the measured normalized duration.

Deep verification accepts a **25 ms** absolute difference between the manifest's rounded duration and a fresh probe. Larger differences fail integrity verification.

Do not add loudness targets, channel-layout normalization, gapless-loop editing, or waveform analysis in v1.

## Private source archive

Archive the selected original and exact HPA-608 success-receipt bytes in `aquila-vn-source` **before** any public immutable upload.

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

The verified source digest makes archive keys idempotent. Re-publishing the same approved source reuses the same archive objects.

Reuse `R2DeliveryStore` with a factory option selecting `source` or `delivery`; do not add a second S3/R2 client implementation. Source archival only needs `stat/read/createImmutable`.

Local mode creates sibling roots:

```text
<destination-root>/delivery/...
<destination-root>/source/...
```

Receipts never enter the delivery store. Delivery custom metadata stays empty for MP3/manifest/pointer objects.

## Publication modules

Keep media-specific work focused:

```text
packages/infra-cloudflare/src/publisher/
  audio-source.ts
  audio-encoder.ts
  audio-runtime-release.ts
  audio-publication-plan.ts
  audio-candidate-verifier.ts
  audio-publish.ts
```

Extract exactly one media-neutral helper from the visual publisher:

```text
immutable-candidate.ts
```

It owns planned immutable candidates, exact destination inspection, immutable create/reuse, and exact read-back verification. Visual publication imports it with no behavioral change. Do not extract encoders, manifests, coverage, reporting, or a generic media adapter registry.

## Stored audio verification

Shallow verification checks:

- exact manifest key, `application/json`, immutable cache metadata, canonical bytes;
- schema/story/release identity;
- canonical release-content digest;
- every entry's safe content-addressed path, digest, byte length, duration, and loop/type contract;
- audio pointer candidate construction and pointer/manifest pairing.

Deep verification additionally reads each unique MP3 object once and requires:

- exact key, `audio/mpeg`, immutable cache metadata, and byte length;
- body digest equals manifest/path digest;
- `ffprobe` reports MP3, 44.1 kHz, positive duration, and 128,000 bit/s when a bitrate is reported;
- measured duration is within 25 ms of manifest `durationMs`.

## Activation and release history

Keep pointer behavior single-owned in the existing services. Add only an internal selector:

```ts
type PublisherMedia = 'visual' | 'audio';
```

`visual` remains the default. The selector chooses only:

- current-pointer path function;
- pointer parser;
- deep stored-release verifier;
- release-manifest path/parser/identity checker used by history listing.

`nextPublishedAt`, clock-skew checks, production confirmation, fresh-pointer read, compare-and-swap, conflict/override flow, rollback, and reactivation stay shared.

Do not expose a plugin/adapter registry.

Audio `publish` never calls activation. After immutable source archive + public objects + manifest are written and deep-verified, it returns with the pointer unchanged. `activate --media audio` is the only audio command that mutates a pointer.

Rollback/reactivation rewrite only the audio pointer and reuse already verified immutable manifests/objects.

## CLI

Keep the command vocabulary and add:

```text
--media visual|audio
```

`visual` is the default, preserving current invocations and report output.

Audio `plan`/`publish` additionally accept:

- required `--story-folder` to resolve raw story config and cross-check runtime `--story`;
- optional `--audio-generation-root` overriding `.tmp/audio-generation/<storyFolder>`;
- optional `--omissions <path>`.

Audio `activate`, `verify`, `releases`, and `rollback` need only the runtime story id plus existing target/release/destination inputs.

`mirror-preview --media audio` is intentionally unsupported. Direct preview publication already shares content-addressed MP3 objects and writes the preview-scoped manifest; a second mirror path is unnecessary.

Audio `publish` rejects visual pointer-mutation flags such as `--reactivate` and never accepts an implicit activation mode.

## R2/cache integration

No resource is added.

`R2DeliveryStore.createFromEnvironment` gets an explicit `bucket: 'source' | 'delivery'` selector, with delivery remaining the default for visual callers. Its pointer-key allowlist gains only the two audio pointer grammars.

Update existing immutable rule 1 from:

```text
/vn/objects/* OR */runtime-manifest.json
```

to:

```text
/vn/objects/* OR /vn/audio/objects/* OR */runtime-manifest.json
```

Pointer rule 2 (`*/current.json` -> bypass edge cache) already covers audio. Existing CORS already permits the `Range` request header.

The repository rule generator/tests/runbook must be updated, **and the same existing Cloudflare cache rule must be manually edited in the dashboard before the live cache smoke**. HPA-229 intentionally has no cache-rule provisioning/reconciliation command. Do not create a third rule or claim the code edit changes live Cloudflare state by itself.

## Failure ordering

`plan` / `publish` resolve in this order:

1. story folder/config + runtime story id cross-check;
2. compiler usage + audio plan;
3. selection + optional omissions;
4. complete coverage + current-spec/source checksum validation;
5. probe/normalize included sources;
6. deterministic manifest/release id;
7. delivery-candidate/advisory-audio-pointer inspection;
8. on `publish`, archive selected originals/receipts privately;
9. create/reuse public MP3 objects and manifest;
10. exact read-back + deep release verification;
11. return without pointer mutation.

Therefore stale/missing selections fail before **any** R2 write, and an archive failure fails before delivery mutation. There is no cross-bucket transaction: immutable leftovers are safe to reuse after a later retry.

## Testing

Stories tests cover audio manifest/path/pointer schema invariants, deterministic release identity, public metadata redaction, current-spec helper exports, and the compiler-owned audio-publishing context.

Infra tests cover ffprobe/ffmpeg argv and failures, selection/spec/source verification, coverage/omissions, deterministic manifest and content-addressed reuse, private archive reuse, shallow/deep MP3 verification, publish-without-pointer-write, audio activation conflict/no-op/reactivation/rollback, release history, R2 source-bucket selection, audio pointer allowlist, cache-rule predicate, CLI/report behavior, and unchanged visual tests.

Focused live smoke uses one tiny fixture MP3 **larger than 1,024 bytes**:

1. local plan/publish/deep verify;
2. manually apply the generated immutable-rule predicate to the existing Cloudflare rule, keeping exactly two rules;
3. isolated preview R2 publish/deep verify;
4. full MP3 fetch through `assets.aquila.cwchanap.dev` with MIME/cache/digest checks;
5. repeat full fetch and require a cache-eligible `cf-cache-status` (`MISS`, `HIT`, `EXPIRED`, or `REVALIDATED`);
6. `Range: bytes=0-1023` and require `206` + valid `Content-Range`;
7. explicit preview activation, second release, rollback, and reactivation;
8. verify the production audio pointer bytes/ETag never changed during preview work.

## Verification commands

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

`@aquila/infra-cloudflare` currently has no `typecheck` script even though HPA-609 requires that command. Add `"typecheck": "tsc --noEmit"` in this ticket.

## Resulting scope

HPA-609 adds one audio wire contract, one offline MP3 preparation path, one private source-archive path, and the minimum release-operation dispatch necessary to make audio independently publishable. HPA-610 can consume only audio `current.json` + runtime manifest + MP3 object paths; it does not need ElevenLabs, candidate storage, compiler internals, or the visual manifest.