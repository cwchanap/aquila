# Aquila Visual Novel Runtime Asset Contract V1

**Date:** 2026-07-23  
**Status:** Accepted for HPA-227 downstream implementation  
**Owners:** `@aquila/stories` runtime contract, HPA-230 publisher, HPA-228 reader

## Purpose and boundary

The compiler's generated `image-assets.json` remains the private authoring
manifest. It describes desired artwork and may contain generation prompts and
repository-relative PNG source paths.

The public runtime manifest defined here is a separate artifact. It contains
only immutable delivery data required by a reader. It never contains prompts,
source paths, provider metadata, credentials, or environment-specific absolute
URLs.

The V1 types, schemas, validators, path helpers, resolver boundary, fixtures,
and policies live at:

```ts
import {
  RuntimeAssetManifestV1Schema,
  ActiveReleasePointerV1Schema,
  StoryAssetReleasePlanV1Schema,
} from '@aquila/stories/runtime-assets';
```

HPA-228 implements network loading, image decoding, UI fallback, and the
bounded browser cache behind `AssetResolver`. HPA-230 implements conversion,
hashing, coverage enforcement, upload, and activation.

## Normative wire formats

All JSON documents use UTF-8. Writers emit canonical JSON with lexicographically
sorted object keys, no insignificant whitespace, and exactly one final LF.
Readers ignore unknown additive fields after rejecting the explicitly forbidden
runtime metadata names. A breaking shape or semantic change requires a new
`schemaVersion`.

### Type-qualified logical identity

An asset is identified by this pair:

```json
{
  "type": "background",
  "key": "第一章/鏡 房/夜"
}
```

`type` is exactly `background` or `portrait`. `key` is Unicode NFC, may contain
CJK characters, spaces, and nested `/`-separated segments, and may not contain
empty, `.`, or `..` segments, control characters, or backslashes.

Identity equality is the pair `(type, key)`, represented internally by
`qualifyAssetIdentity()` as `"<type>:<NFC key>"`. A background and portrait may
therefore share the same key without collision. Logical keys are never appended
to runtime object URLs. `encodeLogicalAssetIdentity()` exists for logs, cache
keys, and tools that need a safe segment-by-segment encoded representation.

### `RuntimeAssetManifestV1`

```json
{
  "schemaVersion": 1,
  "storyId": "the_seventh_mirror",
  "releaseId": "sha256-<64 lowercase hex>",
  "assets": [
    {
      "identity": {
        "type": "background",
        "key": "chapter_1/ch1_act1_s0"
      },
      "variants": {
        "webp": {
          "format": "webp",
          "path": "vn/objects/<sha256>.webp",
          "sha256": "<sha256>",
          "byteLength": 123456
        },
        "avif": {
          "format": "avif",
          "path": "vn/objects/<sha256>.avif",
          "sha256": "<sha256>",
          "byteLength": 98765
        }
      },
      "width": 1920,
      "height": 1080,
      "placeholder": {
        "format": "webp",
        "path": "vn/objects/<sha256>.webp",
        "sha256": "<sha256>",
        "width": 32,
        "height": 18
      },
      "section": "chapter_1"
    }
  ]
}
```

Rules:

- `storyId` is a lowercase underscore slug.
- `releaseId` is `sha256-` plus the full release-content digest.
- `assets` is sorted by type-qualified identity and contains no duplicates.
- WebP is required. AVIF is optional. A reader prefers AVIF when it can decode
  it and always retains WebP as the compatibility path.
- Each variant path is relative and must equal
  `vn/objects/<its sha256>.<its format>`.
- `width` and `height` are the intrinsic dimensions of the full runtime
  variants. WebP and AVIF encode the same pixels at the same dimensions.
- A placeholder is optional, always WebP in V1, content-addressed, and smaller
  in both dimensions than the full image.
- `section` is optional non-sensitive coverage metadata.

### `ActiveReleasePointerV1` (`current.json`)

```json
{
  "schemaVersion": 1,
  "storyId": "the_seventh_mirror",
  "releaseId": "sha256-<release content digest>",
  "manifestPath": "vn/stories/the_seventh_mirror/releases/sha256-<digest>/runtime-manifest.json",
  "manifestSha256": "<digest of exact uploaded manifest bytes>",
  "publishedAt": "2026-07-23T18:30:00.000Z"
}
```

The pointer's story, release, and canonical manifest path must agree with the
requested story and selected runtime manifest. The reader hashes the exact
manifest response bytes before parsing and compares them with
`manifestSha256`.

`publishedAt` is the activation time, not the manifest creation time. A rollback
therefore republishes the prior release identity with a new, later
`publishedAt`; this distinguishes an intentional rollback from a stale cache
returning an older pointer.

### `StoryAssetReleasePlanV1`

Release plans are checked-in publisher input. Production plans live at:

```text
packages/stories/release-plans/<storyId>.json
```

The first production migration creates its story plan. HPA-227 includes a
complete fixture at
`packages/stories/src/runtime-assets/__fixtures__/release-plan.v1.json`; it does
not migrate a production story.

```json
{
  "schemaVersion": 1,
  "storyId": "the_seventh_mirror",
  "channel": "production",
  "entries": [
    {
      "identity": {
        "type": "background",
        "key": "chapter_1/ch1_act1_s0"
      },
      "disposition": "included",
      "sourcePath": "the_seventh_mirror/backgrounds/chapter_1/ch1_act1_s0.png",
      "section": "chapter_1"
    },
    {
      "identity": {
        "type": "portrait",
        "key": "asakura_mio/shocked"
      },
      "disposition": "omitted",
      "reason": "The launch reader intentionally uses its portrait fallback.",
      "section": "chapter_1"
    }
  ]
}
```

For `channel: "production"` every type-qualified key in the compiler authoring
manifest must have exactly one plan entry:

- `included` requires the exact authoring source path and an existing file.
- `omitted` requires a non-empty reason and has no source path.
- Unknown plan keys, duplicate classifications, unclassified authoring keys,
  source-path mismatches, and missing included files fail publication.
- Runtime manifests contain every included key and no omitted or unplanned key.

`validateReleaseCoverage()` first requires the compiler authoring catalog and
release plan to name the same story, then produces totals grouped by asset type
and by `section` (falling back to `_unassigned`). A preview plan may leave keys
unclassified, but included entries still require their source files.
`assertActivationAllowed()` prevents a preview plan from updating a production
pointer.

## Content addressing and release identity

The only V1 publication layout is:

```text
vn/objects/<sha256>.<format>
vn/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/stories/<storyId>/current.json
```

Preview and staging publications use an isolated namespace:

```text
vn/previews/<previewId>/stories/<storyId>/releases/<releaseId>/runtime-manifest.json
vn/previews/<previewId>/stories/<storyId>/current.json
```

Preview manifests still reference the shared immutable `vn/objects/` pool.
Object reuse is safe because names are hashes of exact bytes.

Canonical hashing rules:

1. Normalize logical keys to Unicode NFC before constructing a manifest.
2. Transcode the source independently to WebP and optional AVIF.
3. Hash the exact encoded bytes with SHA-256. The lowercase hex digest selects
   `vn/objects/<digest>.<format>`.
4. Construct the release content from exactly `schemaVersion`, `storyId`, and
   assets sorted by type-qualified identity. Do not include `releaseId`.
5. Serialize that value with `canonicalReleaseContent()` and hash its UTF-8
   bytes. `releaseIdFromContentSha256()` produces
   `sha256-<full 64-character digest>`.
6. Add `releaseId`, serialize the complete manifest as canonical JSON plus one
   LF, and hash those exact uploaded bytes for the pointer's
   `manifestSha256`.

No path uses platform separators, percent-decoded input, a leading slash,
queries, fragments, schemes, credentials, empty segments, or traversal
segments.

## Publication, activation, rollback, and caching

Publication order is:

1. Validate the release plan against the authoring manifest and source files.
2. Produce and validate all variants.
3. Upload missing content-addressed objects. Existing matching objects are
   reused.
4. Upload the immutable release manifest.
5. Read back and verify the manifest bytes and checksum.
6. Replace the appropriate `current.json` in one object-store write.

The last pointer write is the atomic activation boundary. Failure before it
leaves the active release unchanged. Rollback repeats only step 6 with a prior
immutable manifest path/checksum and a new `publishedAt`.

HTTP caching is fixed by `RUNTIME_ASSET_CACHE_POLICY`:

- `current.json`: `no-cache, max-age=0, must-revalidate`; the client
  revalidates after 60 seconds.
- Release manifests and object files:
  `public, max-age=31536000, immutable`.
- Pointer, manifest, and image request timeouts are 5, 10, and 15 seconds.
- The browser cache retains at most two validated releases, 48 decoded assets,
  and 96 MiB of decoded pixels.
- Prefetch is limited to the single immediately reachable story edge with at
  most two concurrent requests.

The client activates a release only after pointer path validation, exact
manifest-byte integrity verification, schema validation, and story/release
matching. A candidate that fails any check is never partially activated.

If pointer loading, manifest loading, parsing, or integrity validation
temporarily fails, the client may continue the last fully validated release for
the same story for at most 24 hours. With no eligible cached release it returns
a fallback result. A pointer with an older `publishedAt` than the cached pointer
is treated as stale and cannot downgrade the client. A rollback is accepted
because its pointer has a newer activation timestamp.

## Resolver boundary and typed failures

`AssetResolver` is configured with a `storyId`, an HTTP(S) `baseUrl`, and an
explicit environment:

- `environment: "local"` with either production-like or preview fixture paths;
- `environment: "preview"` with `{ kind: "preview", previewId }`; or
- `environment: "production"` with `{ kind: "production" }`.

The same resolver works with a local fixture origin such as
`http://127.0.0.1:5090/assets/` and an R2 custom domain such as
`https://assets.example.com/`. The reader supplies no URL-building logic beyond
this configuration.

The interface exposes:

- `loadActiveRelease()` for a validated pointer/manifest pair;
- `resolve(identity)` for a resolved WebP/AVIF/placeholder URL set or a typed
  fallback;
- `prefetchNextEdge()` for one immediately reachable story edge; and
- `clear()` for logout, story change, or tests.

Failures use `AssetResolverError` and one of:

```text
unknown-schema-version
validation
unsafe-path
integrity
story-mismatch
release-mismatch
coverage
timeout
network
unavailable
not-found
```

Resolution never returns an unchecked URL. Missing or intentionally omitted
identities produce a `fallback` result rather than an exception at render time.

## Presentation and image dimensions

The story compiler reads optional character metadata:

```md
- **Portrait Slot**: left
```

Allowed values are `left`, `center`, and `right`. It emits
`generated/<story>/presentation.ts`. Every synchronous and async story loader
returns this generated `presentation` value alongside dialogue and choices.

V1 renders at most one active portrait. `presentation.portrait.activeLimit` is
`1`; absent character assignments use `defaultSlot: "center"`. The slot is an
anchor for the one portrait, not a request to keep multiple characters on
screen.

The source targets in `RUNTIME_ASSET_DIMENSION_POLICY` are:

| Type | Aspect ratio | Preferred source | Minimum source | Preferred runtime |
|---|---:|---:|---:|---:|
| Background | 16:9 | 1920×1080 | 1600×900 | 1600×900 |
| Portrait | 3:4 | 1200×1600 | 900×1200 | 900×1200 |

The publisher preserves aspect ratio; it never stretches a source
non-uniformly. Existing nonconforming sources must be cropped/padded during a
production migration or explicitly rejected by that migration's policy. The
reader always uses manifest `width` and `height` for layout and must not assume
that every image has the preferred dimensions.

## Compatibility rules

- Unknown `schemaVersion` values are explicit
  `unknown-schema-version` failures.
- Unknown additive fields are ignored by V1 readers.
- Runtime fields named like prompts, source/local paths, provider metadata,
  credentials, secrets, or tokens are rejected even when otherwise unknown.
- A changed meaning, removed field, new required field, new identity rule, or
  incompatible path/hash policy requires schema V2.
- A V1 client may keep only a previously validated same-story release under the
  bounded stale-if-error rule; unvalidated bytes are never cached as a release.

The executable examples are:

```text
packages/stories/src/runtime-assets/__fixtures__/runtime-manifest.v1.json
packages/stories/src/runtime-assets/__fixtures__/current.v1.json
packages/stories/src/runtime-assets/__fixtures__/release-plan.v1.json
```
