# HPA-609 Audio R2 Publisher Design

**Issue:** HPA-609 — Add an immutable Aquila audio release contract and R2 publisher  
**Date:** 2026-08-16  
**Status:** Proposed

## Context

HPA-604/HPA-605 added authored SFX/BGM playback, HPA-606 added the provider-neutral `audio-plan.json`, HPA-607 completed The Seventh Mirror audio direction, and HPA-608 now owns local paid generation, immutable candidate receipts, checksum verification, and explicit candidate selection.

HPA-609 is the release-boundary slice. It must publish approved audio through the existing Cloudflare R2 source/delivery infrastructure without turning the visual publisher into a general media platform.

Current seams to reuse:

- `packages/stories/src/runtime-assets/*` — canonical JSON, safe paths/story/release validation, SHA brands, active-pointer wire fields, and cache policy.
- `packages/infra-cloudflare/src/publisher/stores/delivery-store.ts` — media-neutral immutable bytes + metadata + pointer compare-and-swap.
- `LocalDeliveryStore` / `R2DeliveryStore` — existing local/R2 storage implementations.
- visual `activation.ts` / `release-history.ts` — deep verification before mutation, monotonic `publishedAt`, CAS conflict handling, rollback/reactivation, and production confirmation.
- `@aquila/stories/audio-generation` — HPA-608 receipt/selection contracts and verified candidate bytes.
- compiler `collectAudioUsage` / `buildAudioUsageReport` — assembled story usage truth.
- `packages/infra-cloudflare/src/assertions.ts` and `verify.ts` — deployed HTTP/CORS/cache/integrity verification.
- private `aquila-vn-source`, public `aquila-vn-delivery`, and `assets.aquila.cwchanap.dev`.

Two infrastructure constraints are load-bearing:

1. `R2_PUBLISHER_*` is deliberately scoped to **`aquila-vn-delivery` only**. Audio source archival must not widen that credential.
2. the current immutable cache rule already matches `/vn/objects/` and every `runtime-manifest.json`. Runtime MP3 objects can reuse the existing object namespace, so HPA-609 needs no live cache-rule edit.

## Goals

1. Add a thin prompt-free audio runtime contract without polymorphizing `RuntimeAssetManifestV1`.
2. Turn HPA-608 selections into normalized runtime MP3 objects.
3. Reuse existing storage, immutable-create/reuse, pointer CAS, release listing, rollback, preview scoping, and HTTP verification where they are already media-neutral.
4. Archive the exact selected source and HPA-608 receipt privately **before** public publication using a separate source-bucket credential.
5. Produce deterministic complete coverage over compiler usage, the audio plan, selections, omissions, and the resulting manifest.
6. Keep audio release identity independent from visual release identity and Vercel deployment.
7. Keep activation explicit: audio `publish` writes immutable data only; `activate --media audio` is the only normal pointer mutation.

## Non-goals

- A generic media/plugin/adapter registry.
- Changing the visual background/portrait manifest, encoder, or resolver contract.
- New buckets, domains, cache rules, Workers, queues, databases, approval ledgers, or CMS infrastructure.
- Browser/runtime generation.
- HLS, AAC, Opus, WAV runtime variants, stems, waveforms, adaptive bitrate, loudness mastering, or seamless-loop editing.
- Automatic candidate ranking or automatic production activation.
- Publishing the full Seventh Mirror catalog; HPA-611 owns the production pack.

## Chosen architecture

Keep audio-specific source preparation, MP3 normalization, runtime manifest creation, and deep audio verification. Reuse only seams that are already media-neutral.

Rejected alternatives:

- **General media adapter framework:** two media shapes do not justify a registry/configuration layer.
- **Copy the visual publisher:** duplicates CAS, clock-skew, history, and rollback behavior — the highest-risk code.
- **Share the delivery credential with source archival:** conflicts with the current least-privilege live setup.
- **Parallel audio HTTP verifier:** duplicates mature CORS/cache/pointer checks already in `verify.ts` and risks silently omitting hard-earned checks such as pointer edge-cache bypass.

The only publisher extraction is:

```text
immutable-candidate.ts
```

It owns immutable destination inspection, create/reuse, and exact read-back verification. Encoders, manifests, coverage, and media-specific object verification remain separate.

Activation/history keep one algorithm and gain a small internal `visual | audio` selector for path/parser/verifier functions. Public HTTP verification gains the same media selector; there is no plugin registry.

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
- no prompt, candidate id, receipt, provider/model/request id, source path, generation spec, or selection note appears in public runtime data;
- canonical release content excludes `releaseId` and reuses `canonicalJson` plus existing SHA/release-id helpers.

`loop` is derivable from `identity.type` in v1, but is intentionally retained. It is part of HPA-609's accepted contract and makes the HPA-610 runtime release self-contained instead of requiring the web resolver to know authoring-type inference rules. The cost is one validated boolean, not a new subsystem.

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

Audio gets a separate pointer **parser** because `manifestPath` has different grammar. It does not get a second pointer schema.

## Reuse existing release-integrity helpers

Two visual helpers are structurally media-neutral today; only their parameter types are image-specific.

Widen them instead of creating audio copies:

```ts
export function assertReleaseIdMatchesContentSha256(
    manifest: { readonly releaseId: string },
    contentSha256: ReleaseContentSha256
): void;

export function validatePointerManifestPair(
    pointer: ActiveReleasePointerV1,
    manifest: {
        readonly storyId: string;
        readonly releaseId: string;
    },
    actualManifestSha256: ManifestByteSha256
): void;
```

Existing visual callers remain valid by structural typing. Audio reuses both functions.

Audio still needs genuinely different functions:

```ts
canonicalAudioReleaseContent(manifest)
parseRuntimeAudioManifest(input)
parseAudioActiveReleasePointer(input, target, expectedStoryId)
```

## Path grammar

Runtime MP3s reuse the existing global content-addressed object namespace:

```text
vn/objects/<sha256>.mp3
```

This is deliberate:

- the deployed immutable rule already matches `/vn/objects/`;
- `.mp3` cannot collide with `.webp`/`.avif` for the same digest;
- objects are immutable content, not release identity;
- release identity remains separate because audio manifests/pointers are namespaced independently.

Production audio state:

```text
vn/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/audio/stories/<storyId>/current.json
```

Preview audio state:

```text
vn/previews/<previewId>/audio/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

Add:

```ts
getAudioObjectPath(sha256)
getAudioReleaseManifestPath(storyId, releaseId, target)
getAudioCurrentPointerPath(storyId, target)
isRuntimePointerKey(key)
```

`isRuntimePointerKey` accepts exactly the existing visual production/preview pointer forms plus the two audio forms. Both `LocalDeliveryStore` and `R2DeliveryStore` call this single predicate instead of carrying duplicate pointer grammar.

Visual path builders remain unchanged.

## HPA-608 selection handoff

HPA-609 must prove each selection still matches the **current** generation spec. Extend the Node-only supported subpath with only:

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';
```

For every compiler-used included cue:

1. derive the current generation spec from the current plan row;
2. compute its current spec hash;
3. require `selection.specSha256` to equal it;
4. load `LocalAudioGenerationStore.readVerifiedCandidate(key, candidateId)`;
5. require receipt story/key/type/candidate/spec hash to agree;
6. require `selection.sourceSha256` to equal the verified source bytes hash.

Any mismatch fails before either R2 bucket is written.

## Compiler-owned publishing input

Do not reparse Markdown in `infra-cloudflare` and do not shell out to `audio:report`.

The existing compiler CLI already owns `compileNamedStory`. Move that helper out of `cli.ts` into a small compiler module and reuse it from both the CLI and a Node-only `@aquila/stories/audio-publishing` subpath.

```ts
async function compileNamedStory(
    storyFolder: string,
    writeOutputs: boolean
): Promise<StoryIR>;

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

This avoids dummy `outDir`/`choicesPath` values and preserves one definition of generated/story paths. Nothing from this adapter is exported from the browser/root entry.

## Coverage and explicit omissions

A selected candidate is included automatically; there is no second included-assets list.

Optional omissions are the only extra input:

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

`candidateId`, source digest/path, source filename, receipt bytes, and compiler `usages[].sourcePath` stay internal. JSON report tests serialize a sentinel source path/candidate id and prove neither survives sanitization.

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

Use a generic source probe only to establish a readable audio stream and positive duration. Use one strict runtime-MP3 probe parser for both normalized output and stored deep verification.

The strict runtime parser requires:

- codec `mp3`;
- sample rate `44100`;
- **present** bitrate exactly `128000`;
- finite positive duration.

Missing `bit_rate` is an integrity failure.

Other hard failures:

- empty/unreadable/no audio stream;
- SFX longer than 30 seconds after normalization;
- BGM longer than 600 seconds after normalization;
- type/loop intent mismatch.

A material difference from authored target duration is a sanitized warning. Manifest duration always uses measured normalized duration.

Deep verification permits at most **25 ms** difference between manifest duration and a fresh probe to cover integer rounding/probe precision.

## Private source archive and credential boundary

Archive the exact selected original and exact HPA-608 success receipt before any public immutable write:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

The archive prefix is content-addressed by verified source digest. Re-publishing the same source reuses the same immutable archive objects.

Credential rule:

- `R2_PUBLISHER_ACCESS_KEY_ID` / `R2_PUBLISHER_SECRET_ACCESS_KEY` remain scoped to **`aquila-vn-delivery` only**.
- `R2_SOURCE_ARCHIVE_ACCESS_KEY_ID` / `R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY` belong to a second **Object Read & Write** token scoped only to **`aquila-vn-source`**.
- never widen `R2_PUBLISHER_*` to the source bucket;
- never give the source archive credential access to delivery.

Reuse the same `R2DeliveryStore` class/S3 client. Bucket selection also selects the appropriate credential pair.

Local mode uses sibling roots:

```text
<destination-root>/delivery/...
<destination-root>/source/...
```

Receipts never enter delivery. Public custom metadata for MP3/manifest/pointer objects stays empty.

## Publication preparation and ordering

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

Extract only `immutable-candidate.ts` from visual plan/publish code.

Fixed ordering:

1. validate compiler context, plan, selections, omissions, and coverage;
2. verify source candidates against current spec and bytes;
3. normalize runtime MP3s;
4. compute deterministic manifest/release id;
5. plan source + delivery immutable reuse/create;
6. archive selected originals + exact receipts privately;
7. only after every archive candidate verifies, upload public MP3s + manifest;
8. deep-verify the stored audio release;
9. return with pointer unchanged.

If archival fails, no public write occurs. There is no cross-bucket transaction: immutable source leftovers from a failed later delivery step are safe to reuse.

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

Keep CAS/clock/conflict semantics single-owned.

Add internal:

```ts
type PublisherMedia = 'visual' | 'audio';
```

Visual remains default. Media-specific selectors cover **all** media-sensitive operations:

```text
current pointer path
pointer parser
stored-release deep verifier
release manifest path
manifest parser
canonical release-content function
release-identity verification
```

The pointer parser is load-bearing: after the first audio activation, subsequent activation/rollback/history reads must parse `vn/audio/...` instead of passing the stored pointer through visual-only `parseActiveReleasePointer`.

Audio `publish` has no activation import and never calls `compareAndSwapPointer`. `activate --media audio` is the only normal audio pointer mutation. Rollback/reactivation rewrite only the audio pointer and reuse already verified immutables.

`mirror-preview --media audio` remains unsupported; audio publishes directly to preview.

## CLI and local path safety

Keep the command vocabulary and add:

```text
--media visual|audio
```

`visual` remains default.

Audio plan/publish requires `--story-folder` because the raw folder can differ from runtime story id. Release operations need only runtime story id.

For R2 audio `plan`, no source archive credential is required because planning performs no source-bucket write. Audio `publish` requires both credential pairs before any write.

For local audio plan/publish, destination-overlap safety must explicitly include:

- the resolved HPA-608 generation root;
- the omissions file when present;
- the two local destination roots (`source/`, `delivery/`).

Extend the existing canonical path-overlap helper to accept additional read-only input paths; visual callers pass none. A generation root must never sit inside a destination root or contain it.

Production audio `publish` is immutable-only. `--confirm-production` is required only by explicit production activation/rollback.

## HTTP delivery verification

Do **not** add `audio-http-smoke.ts`.

Extend the existing `packages/infra-cloudflare/src/verify.ts` pipeline with `media?: 'visual' | 'audio'`, defaulting to visual. The media selector chooses:

- current-pointer path and parser;
- release-manifest path and parser;
- canonical release-content function;
- object-reference extraction/path/content type.

Everything else stays shared:

- HTTPS/base URL safety;
- pointer MIME/revalidation/CORS and the hard **edge-bypass** check;
- manifest MIME/immutability/CORS and the hard edge-cache-eligibility check;
- manifest-byte SHA checks;
- pointer/manifest pairing;
- release-id canonical-content verification;
- forbidden-key scanning;
- object byte length, SHA, immutable headers, and cache-HIT corroboration;
- structured `CheckResult[]`, human output, and `--json` CLI.

For audio object references, verify every unique MP3 object and add one new Range row for the first MP3 larger than 1,024 bytes:

```http
Range: bytes=0-1023
```

Require `206`, exactly 1,024 response bytes, and correct `Content-Range` total.

Parameterize the existing source-absence check. Audio live verification passes the selected private source and receipt archive keys and requires **exactly 404** for each on the public delivery host; `403` is not accepted.

CLI usage becomes the existing command with media selection, for example:

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id hpa-609-smoke \
  --archive-probe-key audio/approved/.../source.mp3 \
  --archive-probe-key audio/approved/.../receipt.json
```

No second verifier script or dashboard cache-rule step is added.

## Risks and mitigations

### Source archive token availability

The existing publisher token cannot write `aquila-vn-source`. Preflight the separate source-only token before a live publish; never widen the delivery token.

### Local ffmpeg/ffprobe prerequisite

Fail configuration before writes when either executable is unavailable; tests inject the runner.

### CDN Range/cache behavior

Unit tests cannot prove Cloudflare/R2 Range semantics. One isolated preview smoke runs the existing verifier in audio mode and exercises full GET, cache eligibility, 206 Range, private-key 404s, activation, rollback, and reactivation.

## Acceptance criteria

- Audio schema rejects duplicate/unsorted identities, unsafe paths, invalid digests, path/hash mismatch, invalid duration, and loop/type mismatch.
- Runtime MP3 object path is `vn/objects/<sha256>.mp3`; audio manifest/pointer remain under the audio namespace.
- `isRuntimePointerKey` is the single local/R2 pointer-key allowlist grammar.
- Existing release-id and pointer/manifest integrity helpers are reused structurally; no audio twins are added.
- Deterministic fixtures prove stable release IDs/manifests and content-addressed reuse.
- Stale/missing/tampered selection fails before any R2 write.
- Coverage and reports contain no candidate/receipt/source-path data; every compiler-used cue is included or explicitly omitted.
- Approved originals/receipts archive privately before public writes using `R2_SOURCE_ARCHIVE_*`, never `R2_PUBLISHER_*`.
- Runtime objects carry `audio/mpeg`, exact length, immutable cache policy, 44.1 kHz MP3, and required 128000 bit/s bitrate.
- Full/Range GETs pass through the existing `verify.ts` checks without a parallel verifier or cache-rule edit.
- Delivery-host GETs for exact archived source/receipt keys return 404.
- First and subsequent audio activation, history, rollback, and reactivation parse audio pointers correctly and never touch visual pointer state.
- Audio `publish` cannot mutate a pointer.
- Existing visual publisher/runtime/verifier tests and default CLI behavior remain unchanged.
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

Then run one local fixture release and one isolated preview R2 release through publish → deep verify → explicit activate → existing public verifier in audio mode → second release → rollback → reactivation, while proving production pointer unchanged and private archive keys 404 on the delivery host.
