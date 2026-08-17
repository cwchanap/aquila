# HPA-609 Audio R2 Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish explicitly selected Aquila SFX/BGM as independently versioned immutable MP3 releases through the existing R2 source/delivery infrastructure, with private archival, deterministic coverage, deep verification, explicit activation, rollback, and range-tested HTTP delivery.

**Architecture:** Keep the visual manifest/encoder unchanged. Add audio-specific runtime/source/MP3 modules, reuse `DeliveryStore`, extract only media-neutral immutable create/reuse logic, and add a small visual/audio dispatch inside the existing activation/release-history services so CAS/clock/rollback semantics remain single-owned. Runtime MP3 objects reuse the existing `vn/objects/` immutable namespace; audio manifest/pointer state remains separately namespaced. Audio `publish` writes immutables only and never activates.

**Tech Stack:** TypeScript, Bun, Vitest, Zod, Node child processes, system `ffmpeg`/`ffprobe`, AWS S3 client for Cloudflare R2, existing `@aquila/stories` compiler/runtime/audio-generation modules.

## Global Constraints

- Keep `RuntimeAssetManifestV1`, visual object paths, visual encoder policy, visual pointer paths, and default visual CLI behavior unchanged.
- Runtime audio v1 is MP3 only: MPEG Layer III, 44.1 kHz, exactly 128000 bit/s, `audio/mpeg`, stripped metadata/artwork.
- Runtime MP3 path is `vn/objects/<sha256>.mp3`; audio release manifests/pointers remain under `vn/audio/...` or `vn/previews/<id>/audio/...`.
- Production audio `publish` never mutates `current.json`; only explicit `activate --media audio` may do so.
- Keep `R2_PUBLISHER_*` scoped to `aquila-vn-delivery` only. Source archival uses separate `R2_SOURCE_ARCHIVE_*` credentials scoped only to `aquila-vn-source`.
- Reuse the existing two Cloudflare cache rules unchanged; do not add or edit a live cache rule for audio objects.
- Public audio manifest/object metadata/reports contain no prompt, provider/model/request id, candidate id, receipt, source path, or local absolute path.
- Compiler-used cues must be selected or explicitly omitted with a non-empty reason; there is no `--allow-missing` mode.
- Selected-but-unused cues are warnings and are not uploaded.
- System `ffmpeg` and `ffprobe` are publisher prerequisites; unit tests inject the process runner.
- Do not add a generic media adapter/plugin framework, second S3 client implementation, database, daemon, Worker, queue, multiple runtime codecs, loudness mastering, or loop editing.

---

## Risks

### Source archive credential

The current live `R2_PUBLISHER_*` token is deliberately delivery-only. The implementation must use a second Object Read & Write token scoped only to `aquila-vn-source`; widening the delivery token is not an allowed fallback.

### Local audio tooling

`ffmpeg`/`ffprobe` are external prerequisites. The CLI must fail configuration before writes when either tool is unavailable.

### CDN range/cache behavior

Unit tests cannot prove Cloudflare/R2 Range semantics. The final isolated preview smoke must exercise a real MP3 through `assets.aquila.cwchanap.dev`, including a 206 response and an exact 404 for private archive keys.

---

### Task 1: Add the audio runtime contract and path grammar

**Files:**
- Create: `packages/stories/src/runtime-assets/audio.ts`
- Modify: `packages/stories/src/runtime-assets/paths.ts`
- Modify: `packages/stories/src/runtime-assets/index.ts`
- Test: `packages/stories/src/runtime-assets/__tests__/audio.test.ts`

**Interfaces:**

```ts
export type AudioAssetType = 'sfx' | 'bgm';

export interface RuntimeAudioAssetV1 {
    readonly identity: { readonly type: AudioAssetType; readonly key: string };
    readonly format: 'mp3';
    readonly path: string;
    readonly sha256: ObjectContentSha256;
    readonly byteLength: number;
    readonly durationMs: number;
    readonly loop: boolean;
}

export interface RuntimeAudioManifestV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly releaseId: string;
    readonly assets: readonly RuntimeAudioAssetV1[];
}

export function getAudioObjectPath(
    sha256: ObjectContentSha256
): string;

export function getAudioReleaseManifestPath(
    storyId: string,
    releaseId: string,
    target: PublicationTarget
): string;

export function getAudioCurrentPointerPath(
    storyId: string,
    target: PublicationTarget
): string;

export function parseRuntimeAudioManifest(
    input: unknown
): RuntimeAudioManifestV1;

export function canonicalAudioReleaseContent(
    manifest: RuntimeAudioManifestV1
): string;

export function assertAudioReleaseIdMatchesContentSha256(
    manifest: RuntimeAudioManifestV1,
    contentSha256: ReleaseContentSha256
): void;

export function parseAudioActiveReleasePointer(
    input: unknown,
    target: PublicationTarget,
    expectedStoryId: string
): ActiveReleasePointerV1;

export function validateAudioPointerManifestPair(
    pointer: ActiveReleasePointerV1,
    manifest: RuntimeAudioManifestV1,
    actualManifestSha256: ManifestByteSha256
): void;
```

- [ ] **Step 1: Write failing exact-path tests**

```ts
expect(getAudioObjectPath(digest)).toBe(`vn/objects/${digest}.mp3`);
expect(
    getAudioReleaseManifestPath('demo_story', releaseId, {
        kind: 'production',
    })
).toBe(
    `vn/audio/stories/demo_story/releases/${releaseId}/runtime-manifest.json`
);
expect(
    getAudioCurrentPointerPath('demo_story', {
        kind: 'preview',
        previewId: 'gate-1',
    })
).toBe('vn/previews/gate-1/audio/stories/demo_story/current.json');
```

Also assert the existing visual `getObjectPath(digest, 'webp')` remains `vn/objects/<digest>.webp`.

- [ ] **Step 2: Write failing schema tests**

Use one valid SFX and one BGM entry. Separately reject duplicate identity, reverse sort order, unsafe key/path, malformed SHA, path/SHA mismatch, zero/negative duration, `sfx + loop:true`, and `bgm + loop:false`.

Assert public parsers reject additive keys named `prompt`, `provider`, `sourcePath`, `candidateId`, `receipt`, `credential`, `token`, or `apiKey`.

- [ ] **Step 3: Run the focused test**

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
```

Expected: FAIL because the audio contract/path exports do not exist.

- [ ] **Step 4: Implement audio paths without changing visual paths**

In `paths.ts`, reuse the existing story/preview/release validation and add:

```ts
export function getAudioObjectPath(
    sha256: ObjectContentSha256
): string {
    if (!isSha256(sha256)) {
        throw new AssetResolverError('integrity', 'Invalid SHA-256 digest');
    }
    return `vn/objects/${sha256}.mp3`;
}
```

Audio manifest/pointer prefix is `vn/audio` for production and `vn/previews/<previewId>/audio` for preview.

- [ ] **Step 5: Implement the strict audio manifest/pointer parser**

Reuse `canonicalJson`, SHA brands, release-id helpers, safe-key/path predicates, and lexical comparator. Canonical content is:

```ts
canonicalJson({
    schemaVersion: manifest.schemaVersion,
    storyId: manifest.storyId,
    assets: [...manifest.assets].sort((left, right) =>
        compareQualifiedAssetIds(
            `${left.identity.type}:${left.identity.key}`,
            `${right.identity.type}:${right.identity.key}`
        )
    ),
});
```

`parseAudioActiveReleasePointer` uses the existing pointer wire schema then requires the audio manifest path produced by `getAudioReleaseManifestPath`.

- [ ] **Step 6: Export only runtime-safe audio symbols**

Update `runtime-assets/index.ts`; do not expose compiler or Node publisher code from the root stories entry.

- [ ] **Step 7: Run tests/typecheck and commit**

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
git add packages/stories/src/runtime-assets
git commit -m "feat: add runtime audio release contract"
```

---

### Task 2: Complete the HPA-608 handoff and expose compiler-owned publishing input

**Files:**
- Modify: `packages/stories/src/audio-generation/index.ts`
- Create: `packages/stories/src/audio-publishing.ts`
- Modify: `packages/stories/package.json`
- Test: `packages/stories/src/audio-generation/__tests__/index.test.ts`
- Test: `packages/stories/src/compiler/__tests__/audio-publishing.test.ts`

**Interfaces:**

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';

export interface AudioPublishingContext {
    readonly storyFolder: string;
    readonly storyId: string;
    readonly plan: AudioPlanV1;
    readonly usage: AudioUsageReport;
}

export async function loadAudioPublishingContext(
    storyFolder: string
): Promise<AudioPublishingContext>;
```

- [ ] **Step 1: Add failing supported-subpath tests**

Import the two spec helpers from `@aquila/stories/audio-generation` and prove changing plan `durationMs` changes the current spec hash.

- [ ] **Step 2: Add a real temp raw-story publishing-context test**

Create `compiler.config.ts`, characters, one scene with one SFX cue, and `docs/audio-plan.json`. Expect:

```ts
const context = await loadAudioPublishingContext(fixture.storyFolder);
expect(context.storyId).toBe('fixture_story');
expect(context.usage.assets).toEqual([
    expect.objectContaining({
        type: 'sfx',
        key: 'door-close',
        usageCount: 1,
    }),
]);
```

- [ ] **Step 3: Run and confirm missing export/module failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/index.test.ts src/compiler/__tests__/audio-publishing.test.ts
```

- [ ] **Step 4: Export only the spec builder/hash**

Do not export provider HTTP or CLI internals.

- [ ] **Step 5: Implement `loadAudioPublishingContext`**

Reuse `STORIES_RAW_ROOT`, `loadStoryCompilerConfig`, `compileStory({writeOutputs:false})`, `loadAudioPlan`, `collectAudioUsage`, and `buildAudioUsageReport`. Require a plan and cross-check `story.storyId === config.storyId`.

- [ ] **Step 6: Add the Node-only package subpath**

```json
"./audio-publishing": "./src/audio-publishing.ts"
```

Do not add it to `packages/stories/src/index.ts`.

- [ ] **Step 7: Run package checks and commit**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
git add packages/stories/src/audio-generation/index.ts packages/stories/src/audio-generation/__tests__/index.test.ts packages/stories/src/audio-publishing.ts packages/stories/src/compiler/__tests__/audio-publishing.test.ts packages/stories/package.json
git commit -m "feat: expose audio publishing inputs"
```

---

### Task 3: Extract immutable operations and extend both stores with the correct credential boundary

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/immutable-candidate.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/immutable-candidate.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publication-plan.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publish.ts`
- Modify: `packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts`
- Modify: `packages/infra-cloudflare/src/publisher/stores/local-delivery-store.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/local-delivery-store.test.ts`
- Modify: `packages/infra-cloudflare/package.json`
- Modify: `.env.example`

**Interfaces:**

```ts
export interface PlannedImmutableCandidate {
    readonly kind: 'object' | 'manifest' | 'source';
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly cacheControl: string;
    readonly status: 'create' | 'reuse';
    readonly identity?: string;
}

export async function inspectImmutableCandidate(
    store: DeliveryStore,
    candidate: Omit<PlannedImmutableCandidate, 'status'>
): Promise<PlannedImmutableCandidate>;

export async function publishImmutableCandidate(
    store: DeliveryStore,
    candidate: PlannedImmutableCandidate
): Promise<'created' | 'reused'>;
```

R2 factory remains one implementation:

```ts
static async createFromEnvironment(options: {
    configPath?: string;
    environment?: Readonly<Record<string, string | undefined>>;
    bucket?: 'delivery' | 'source';
} = {}): Promise<R2DeliveryStore>;
```

Credential selection is load-bearing:

```ts
const bucketKind = options.bucket ?? 'delivery';
const accessKeyId =
    bucketKind === 'delivery'
        ? environment.R2_PUBLISHER_ACCESS_KEY_ID
        : environment.R2_SOURCE_ARCHIVE_ACCESS_KEY_ID;
const secretAccessKey =
    bucketKind === 'delivery'
        ? environment.R2_PUBLISHER_SECRET_ACCESS_KEY
        : environment.R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY;
```

- [ ] **Step 1: Write immutable helper tests from current visual behavior**

Cover absent → create, exact metadata/bytes → reuse, metadata conflict, byte conflict, create race + exact read-back, and read-back mismatch. Run one case with `kind:'source'` to prove no media assumptions.

- [ ] **Step 2: Extract only media-neutral create/reuse logic**

Move candidate inspection/create/read-back logic out of visual `publication-plan.ts`/`publish.ts`. Do not move visual coverage, encoder, pointer, or report code.

- [ ] **Step 3: Prove visual plan/publish remains green**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/immutable-candidate.test.ts src/publisher/__tests__/publication-plan.test.ts src/publisher/__tests__/publish.integration.test.ts
```

- [ ] **Step 4: Write credential-scope tests before changing the R2 factory**

Require:

- delivery factory succeeds with only `R2_PUBLISHER_*`;
- source factory succeeds with only `R2_SOURCE_ARCHIVE_*`;
- source factory fails when only delivery credentials exist;
- delivery factory fails when only source credentials exist;
- each factory selects only its configured bucket.

- [ ] **Step 5: Implement bucket-specific credential selection**

Reuse `R2DeliveryStore` and the same SDK client construction. Do not add another R2 class.

- [ ] **Step 6: Add audio pointer grammar to R2 and local stores**

Both stores accept exactly:

```text
vn/audio/stories/<storyId>/current.json
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

in addition to existing visual forms. Add matching positive/negative tests in both store test files.

- [ ] **Step 7: Add infra typecheck and blank source credential placeholders**

`packages/infra-cloudflare/package.json`:

```json
"typecheck": "tsc --noEmit"
```

`.env.example`:

```text
# Scoped write credentials for aquila-vn-delivery.
R2_PUBLISHER_ACCESS_KEY_ID=
R2_PUBLISHER_SECRET_ACCESS_KEY=

# Separate scoped write credentials for private aquila-vn-source archival.
R2_SOURCE_ARCHIVE_ACCESS_KEY_ID=
R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY=
```

- [ ] **Step 8: Run focused/full checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/immutable-candidate.test.ts src/publisher/__tests__/r2-delivery-store.test.ts src/publisher/__tests__/local-delivery-store.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/immutable-candidate.ts packages/infra-cloudflare/src/publisher/__tests__/immutable-candidate.test.ts packages/infra-cloudflare/src/publisher/publication-plan.ts packages/infra-cloudflare/src/publisher/publish.ts packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts packages/infra-cloudflare/src/publisher/stores/local-delivery-store.ts packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts packages/infra-cloudflare/src/publisher/__tests__/local-delivery-store.test.ts packages/infra-cloudflare/package.json .env.example
git commit -m "refactor: share immutable publication primitives"
```

---

### Task 4: Validate selections, omissions, coverage, and archive candidates

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-source.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-source.test.ts`

**Interfaces:**

```ts
export interface AudioOmissionsV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly omissions: Readonly<Record<string, string>>;
}

export type AudioCoverageEntryV1 =
    | {
          readonly type: 'sfx' | 'bgm';
          readonly key: string;
          readonly usageCount: number;
          readonly disposition: 'included';
      }
    | {
          readonly type: 'sfx' | 'bgm';
          readonly key: string;
          readonly usageCount: number;
          readonly disposition: 'omitted';
          readonly reason: string;
      };

export interface PreparedAudioSource {
    readonly type: 'sfx' | 'bgm';
    readonly key: string;
    readonly plannedDurationMs: number;
    readonly loop: boolean;
    readonly candidateId: string;
    readonly sourceSha256: string;
    readonly sourceBytes: Uint8Array;
    readonly sourceFilename: string;
    readonly sourceMediaType: string;
    readonly receiptBytes: Uint8Array;
}

export interface AudioSourcePlan {
    readonly storyId: string;
    readonly sources: readonly PreparedAudioSource[];
    readonly coverage: readonly AudioCoverageEntryV1[];
    readonly unusedPlanKeys: readonly string[];
    readonly selectedUnusedKeys: readonly string[];
}

export async function prepareAudioSources(input: {
    readonly storyFolder: string;
    readonly expectedStoryId: string;
    readonly generationRoot: string;
    readonly omissionsPath?: string;
}): Promise<AudioSourcePlan>;

export function sourceArchiveCandidates(
    plan: AudioSourcePlan
): readonly Omit<PlannedImmutableCandidate, 'status'>[];
```

`candidateId` is intentionally internal to `PreparedAudioSource`; it is not present in `AudioCoverageEntryV1`.

- [ ] **Step 1: Create a valid temp HPA-608 handoff fixture**

Write a verified candidate + receipt + matching `selection.json`, compile one use of the key, and assert one included source + coverage row. Assert the coverage row has no `candidateId`, `sourceSha256`, source filename, or receipt field.

- [ ] **Step 2: Add rejection tests**

One mutation per test:

- selection story mismatch;
- stale selection spec hash after current plan change;
- bad selection source hash;
- missing/tampered candidate or receipt;
- compiler-used key neither selected nor omitted;
- same key selected and omitted;
- omission for unknown/compiler-unused key;
- empty omission reason.

Also prove selected-but-unused and plan-unused rows become warning data and never enter `sources`.

- [ ] **Step 3: Run and verify failure**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts
```

- [ ] **Step 4: Implement strict omissions parsing**

Use `.strict()`, current audio key validation, trimmed `1..500` character reasons, and story-id equality. Missing file means no omissions.

- [ ] **Step 5: Load only supported stories subpaths**

```ts
import { loadAudioPublishingContext } from '@aquila/stories/audio-publishing';
import {
    AudioSelectionFileV1Schema,
    LocalAudioGenerationStore,
    buildAudioGenerationSpec,
    audioGenerationSpecSha256,
} from '@aquila/stories/audio-generation';
```

- [ ] **Step 6: Verify every used selected candidate against current spec + actual bytes**

```ts
const currentSpecSha256 = audioGenerationSpecSha256(
    buildAudioGenerationSpec(planAsset)
);
if (selection.specSha256 !== currentSpecSha256) throw sourceError(...);
const candidate = await generationStore.readVerifiedCandidate(
    key,
    selection.candidateId
);
if (candidate === null) throw sourceError(...);
if (candidate.receipt.specSha256 !== currentSpecSha256) throw sourceError(...);
if (sha256Bytes(candidate.bytes) !== selection.sourceSha256) {
    throw sourceError(...);
}
```

Read exact receipt bytes from the existing receipt file for archival; do not reconstruct them.

- [ ] **Step 7: Build deterministic coverage + private archive candidate keys**

Sort coverage by `${type}:${key}`. Archive:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<safe-ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

Use `kind:'source'`, original media type / `application/json`, and `private, max-age=0, no-store`. Do not write storage in this task.

- [ ] **Step 8: Run and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts
git add packages/infra-cloudflare/src/publisher/audio-source.ts packages/infra-cloudflare/src/publisher/__tests__/audio-source.test.ts
git commit -m "feat: validate selected audio sources"
```

---

### Task 5: Normalize sources and define one strict runtime MP3 probe

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-encoder.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts`

**Interfaces:**

```ts
export interface SourceAudioProbe {
    readonly durationMs: number;
}

export interface RuntimeMp3Probe {
    readonly codecName: 'mp3';
    readonly sampleRate: 44100;
    readonly bitRate: 128000;
    readonly durationMs: number;
}

export interface AudioProcessResult {
    readonly exitCode: number;
    readonly stdout: Uint8Array;
    readonly stderr: string;
}

export type AudioProcessRunner = (
    executable: 'ffmpeg' | 'ffprobe',
    args: readonly string[]
) => Promise<AudioProcessResult>;

export async function probeSourceAudioFile(
    path: string,
    run?: AudioProcessRunner
): Promise<SourceAudioProbe>;

export async function probeRuntimeMp3File(
    path: string,
    run?: AudioProcessRunner
): Promise<RuntimeMp3Probe>;

export interface NormalizedAudioAsset {
    readonly type: 'sfx' | 'bgm';
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly sha256: ObjectContentSha256;
    readonly path: string;
    readonly byteLength: number;
    readonly durationMs: number;
    readonly loop: boolean;
    readonly contentType: 'audio/mpeg';
}
```

`probeRuntimeMp3File` is the **single strict runtime parser** reused here and by Task 7 deep verification.

- [ ] **Step 1: Write exact ffmpeg argv tests**

Require direct argv equivalent to:

```text
-nostdin -hide_banner -loglevel error
-i <input>
-map 0:a:0 -vn -map_metadata -1
-ar 44100 -c:a libmp3lame -b:a 128k
-id3v2_version 0 -write_id3v1 0
<output.mp3>
```

Assert the runner is never called with `shell:true` semantics.

- [ ] **Step 2: Write source-probe failures**

Fail missing executable/process failure, no audio stream, and non-positive/non-finite duration.

- [ ] **Step 3: Write strict runtime-probe failures**

Fail each of:

- codec absent/not `mp3`;
- sample rate absent/not `44100`;
- **bit_rate absent**;
- bit rate non-numeric;
- bit rate not exactly `128000`;
- duration absent/non-finite/non-positive.

This closes the silent missing-bitrate pass.

- [ ] **Step 4: Add duration/type policy tests**

SFX > 30000 ms and BGM > 600000 ms fail. A normalized duration differing from authored target by more than `max(500ms, planned * 0.1)` emits a sanitized warning only.

- [ ] **Step 5: Run and verify failure**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
```

- [ ] **Step 6: Implement the injected/default process runner and parsers**

Use `spawn` or `execFile`; never shell interpolation. Use a generic source ffprobe query for stream existence/duration and a strict runtime query:

```text
ffprobe -v error -select_streams a:0 \
  -show_entries stream=codec_name,sample_rate,bit_rate \
  -show_entries format=duration \
  -of json <path>
```

- [ ] **Step 7: Normalize in a temporary directory and verify with the strict parser**

Write source bytes, probe source, run ffmpeg, read output, reject empty output, call `probeRuntimeMp3File(outputPath)`, then clean temp files in `finally`.

- [ ] **Step 8: Hash bytes and derive the reused immutable path**

```ts
const sha256 = assertSha256<'object-content'>(sha256Hex(outputBytes));
const path = getAudioObjectPath(sha256); // vn/objects/<sha>.mp3
```

Manifest duration uses `Math.round(runtimeProbe.durationMs)`.

- [ ] **Step 9: Run checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-encoder.ts packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts
git commit -m "feat: normalize runtime MP3 audio"
```

---

### Task 6: Build deterministic audio releases and public publication plans

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-runtime-release.ts`
- Create: `packages/infra-cloudflare/src/publisher/audio-publication-plan.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: `packages/infra-cloudflare/src/publisher/report.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-publication-plan.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/report.test.ts`

**Interfaces:**

```ts
export interface PreparedAudioRelease {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: `sha256-${string}`;
    readonly releaseContentSha256: ReleaseContentSha256;
    readonly manifest: RuntimeAudioManifestV1;
    readonly manifestSha256: ManifestByteSha256;
    readonly manifestBytes: Uint8Array;
    readonly assets: readonly NormalizedAudioAsset[];
    readonly coverage: readonly AudioCoverageEntryV1[];
}

export function buildPreparedAudioRelease(input: {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly assets: readonly NormalizedAudioAsset[];
    readonly coverage: readonly AudioCoverageEntryV1[];
}): PreparedAudioRelease;
```

`AudioPublicationPlan` contains the source plan, prepared release, public MP3 candidates, manifest candidate, advisory audio pointer state, warnings, and report. It does **not** inspect/write the private source store.

- [ ] **Step 1: Write deterministic release tests**

Build the same logical inputs in different array order and require byte-identical canonical manifest, release id, manifest digest, and sorted entries.

- [ ] **Step 2: Prove audio/visual release identity independence**

A visual release change must not alter an audio release id, and vice versa. The audio manifest references only `.mp3` paths returned by `getAudioObjectPath`.

- [ ] **Step 3: Write publication-plan create/reuse/conflict tests**

Use `LocalDeliveryStore`; verify public MP3/manifest immutable status and advisory **audio** pointer. Planning never writes a pointer and never requires source archive credentials.

- [ ] **Step 4: Add report coverage tests**

Audio report may contain:

```ts
media: 'audio'
audioCoverage: AudioCoverageEntryV1[]
```

Assert serialized JSON contains no `candidateId`, `receipt`, `sourceSha256`, source path, prompt, provider, or model field. Existing visual report output stays unchanged when `media` is absent.

- [ ] **Step 5: Implement prepared release canonicalization**

Derive `releaseId` from `canonicalAudioReleaseContent`, then exact manifest bytes via `${canonicalJson(manifest)}\n`.

- [ ] **Step 6: Inspect only delivery MP3/manifest candidates**

Use `inspectImmutableCandidate`. Public MP3 candidate metadata:

```ts
{
    kind: 'object',
    key: asset.path,
    bytes: asset.bytes,
    contentType: 'audio/mpeg',
    cacheControl:
        RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl,
}
```

- [ ] **Step 7: Run and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-runtime-release.test.ts src/publisher/__tests__/audio-publication-plan.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-runtime-release.ts packages/infra-cloudflare/src/publisher/audio-publication-plan.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/report.ts packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts packages/infra-cloudflare/src/publisher/__tests__/audio-publication-plan.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat: plan immutable audio releases"
```

---

### Task 7: Deep-verify stored audio releases before publishing service integration

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts`

**Interfaces:**

```ts
export type AudioVerificationDepth = 'shallow' | 'deep';

export interface VerifiedStoredAudioRelease {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly manifestPath: string;
    readonly manifest: RuntimeAudioManifestV1;
    readonly manifestBytes: Uint8Array;
    readonly manifestSha256: ManifestByteSha256;
    readonly releaseContentSha256: ReleaseContentSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}

export async function verifyStoredAudioRelease(options: {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly expectedManifestSha256?: ManifestByteSha256;
    readonly depth?: AudioVerificationDepth;
    readonly runAudioProcess?: AudioProcessRunner;
}): Promise<VerifiedStoredAudioRelease>;
```

- [ ] **Step 1: Write shallow verifier tests**

Require exact manifest path, `application/json`, immutable cache metadata, canonical bytes, story/release equality, canonical release digest, and valid pointer candidate.

- [ ] **Step 2: Write deep object integrity tests**

Reject wrong object key, wrong `audio/mpeg`, wrong cache header, byte-length mismatch, body SHA mismatch, and manifest path/hash mismatch.

- [ ] **Step 3: Reuse the strict runtime MP3 parser**

Deep verification writes stored bytes to a temp file and calls `probeRuntimeMp3File`. Add failures for missing bitrate and non-128000 bitrate; do not duplicate the ffprobe JSON parser in this file.

- [ ] **Step 4: Enforce exact duration tolerance**

```ts
const durationDeltaMs = Math.abs(
    probe.durationMs - manifestAsset.durationMs
);
if (durationDeltaMs > 25) {
    throw integrityError(...);
}
```

- [ ] **Step 5: Group shared digest references**

Read/probe each unique MP3 path once, then validate all manifest references in the group.

- [ ] **Step 6: Run and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-candidate-verifier.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts
git commit -m "feat: verify stored audio releases"
```

---

### Task 8: Publish private archive first, then public immutables, with no activation path

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-publish.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts`

**Interfaces:**

```ts
export async function publishAudioRelease(options: {
    readonly store: DeliveryStore;
    readonly sourceStore: DeliveryStore;
    readonly repositoryRoot: string;
    readonly storyId: string;
    readonly storyFolder: string;
    readonly target: PublicationTarget;
    readonly generationRoot: string;
    readonly omissionsPath?: string;
    readonly progress?: ProgressSink;
    readonly runAudioProcess?: AudioProcessRunner;
}): Promise<PublisherReportV1>;
```

- [ ] **Step 1: Write an archive-failure-before-public-write test**

Inject a source store that fails the first immutable archive create. Assert zero delivery `createImmutable` calls and zero pointer calls.

- [ ] **Step 2: Write successful ordering test**

Record operations and require:

```text
validate inputs
normalize
inspect/verify archive candidate
write+read-back source archive
write+read-back public MP3
write+read-back public manifest
deep verify stored audio release
return
```

- [ ] **Step 3: Prove exact receipt bytes archive privately**

Read source/receipt archive objects from the source store and compare to verified source bytes + original receipt file bytes. Assert neither archive key exists in the delivery store.

- [ ] **Step 4: Prove no activation dependency**

`audio-publish.ts` imports no activation module. Tests make `compareAndSwapPointer` throw if called; publish must still pass with zero calls.

- [ ] **Step 5: Implement archive writes using shared immutable helpers**

For each `sourceArchiveCandidates(sourcePlan)`:

```ts
const planned = await inspectImmutableCandidate(
    options.sourceStore,
    candidate
);
await publishImmutableCandidate(options.sourceStore, planned);
```

Only after all archive candidates are verified does delivery publication begin.

- [ ] **Step 6: Publish public candidates and deep-verify**

Publish MP3 candidates, then manifest, then call `verifyStoredAudioRelease(..., depth:'deep')` with the prepared manifest checksum.

- [ ] **Step 7: Return pointer unchanged**

Do not set `afterReleaseId` for an unactivated release. `pointer.changed` is always false.

- [ ] **Step 8: Run and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-publish.ts packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts
git commit -m "feat: publish immutable audio releases"
```

---

### Task 9: Reuse activation, listing, rollback, and reactivation for audio

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/activation.ts`
- Modify: `packages/infra-cloudflare/src/publisher/release-history.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts`

**Interfaces:**

```ts
export type PublisherMedia = 'visual' | 'audio';
```

Add optional `media?: PublisherMedia`; absence means visual.

Internal common verified shape:

```ts
interface ActivatableStoredRelease {
    readonly releaseId: string;
    readonly manifestSha256: ManifestByteSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (
        pointer: ActiveReleasePointerV1
    ) => void;
}
```

- [ ] **Step 1: Add audio activation cases to the existing tests**

Prove first activation writes only audio pointer, same release no-op unless `reactivate:true`, stale CAS conflict, override behavior, monotonic timestamp, exact production confirmation, and untouched visual pointer.

- [ ] **Step 2: Add only verifier/path dispatch**

Keep `nextPublishedAt`, pointer reads, CAS, conflict override, confirmation, and result logic unchanged. Choose current-pointer path + deep verifier by media.

- [ ] **Step 3: Add audio release-history tests**

Prove production/preview discovery, shallow/deep status, invalid-manifest classification, active release detection, rollback, and reactivation. Visual listing ignores audio; audio listing ignores visual.

- [ ] **Step 4: Implement minimal history selectors**

```ts
manifestPathFor(media, storyId, releaseId, target)
currentPointerPathFor(media, storyId, target)
parseManifestFor(media, bytes)
releaseIdentityValidFor(media, manifest, releaseId)
verifyStoredFor(media, options)
```

No public plugin registry.

- [ ] **Step 5: Run full infra regression and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/activation.test.ts src/publisher/__tests__/release-history.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/activation.ts packages/infra-cloudflare/src/publisher/release-history.ts packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts
git commit -m "feat: activate and rollback audio releases"
```

---

### Task 10: Add `--media audio` CLI dispatch with isolated source credentials

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/cli.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/report.test.ts`

**Parsed shape:**

```ts
interface BaseParsedCommand {
    readonly media: PublisherMedia;
    readonly storyFolder?: string;
    readonly audioGenerationRoot?: string;
    readonly omissionsPath?: string;
    // existing fields remain
}
```

- [ ] **Step 1: Write visual-default + audio command-matrix tests**

Valid:

```text
plan/publish --media audio --story <runtime-id> --story-folder <raw-folder> ...
activate/verify/releases/rollback --media audio --story <runtime-id> ...
```

Reject unknown media, missing story folder on audio plan/publish, story folder on visual, `mirror-preview --media audio`, `publish --media audio --reactivate`, and audio pointer-mutation flags on publish.

- [ ] **Step 2: Implement media parsing with visual default**

```ts
function parseMedia(values: CliValues): PublisherMedia {
    const value = values.media ?? 'visual';
    if (value !== 'visual' && value !== 'audio') {
        throw configurationError('--media must be visual or audio');
    }
    return value;
}
```

- [ ] **Step 3: Resolve local audio stores**

For local `publish`:

```text
<destination-root>/delivery
<destination-root>/source
```

Create two `LocalDeliveryStore` instances. Run existing destination overlap/safety checks on both. For audio `plan`, create only the delivery store because no private write/inspection is required.

- [ ] **Step 4: Resolve R2 stores with separate credential pairs**

Audio `plan`:

```ts
const delivery = await R2DeliveryStore.createFromEnvironment({
    bucket: 'delivery',
});
```

Audio `publish`:

```ts
const delivery = await R2DeliveryStore.createFromEnvironment({
    bucket: 'delivery',
});
const source = await R2DeliveryStore.createFromEnvironment({
    bucket: 'source',
});
```

The source factory reads `R2_SOURCE_ARCHIVE_*`, never `R2_PUBLISHER_*`. Close created stores in `finally` while preserving the first command error.

- [ ] **Step 5: Add pre-write dependency/tool checks**

Before audio publish creates either store object, verify both credential pairs are present and `ffmpeg`/`ffprobe` are runnable. Missing dependencies fail as configuration with zero writes.

- [ ] **Step 6: Dispatch plan/publish/release operations**

- audio `plan` → `buildAudioPublicationPlan`;
- audio `publish` → `publishAudioRelease` with both stores;
- release operations pass `media:'audio'` to activation/verifier/history;
- visual behavior remains unchanged.

- [ ] **Step 7: Test sanitized report compatibility**

Audio JSON includes `media:'audio'` + sorted `audioCoverage`, but no candidate/receipt/source fields. Existing visual snapshots remain unchanged when `--media` is absent.

- [ ] **Step 8: Run checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/cli.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat: add audio publisher CLI dispatch"
```

---

### Task 11: Reuse HTTP assertions and prove Range + private archive absence

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-http-smoke.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/audio-http-smoke.test.ts`
- Modify: `packages/infra-cloudflare/src/verify.ts`
- Modify: `packages/infra-cloudflare/src/__tests__/verify.test.ts`
- Modify: `packages/infra-cloudflare/package.json`
- Modify: `docs/infrastructure/r2-visual-asset-delivery.md`

**Interfaces:**

First make the existing source absence helper reusable:

```ts
export async function checkSourceKeyAbsentFromDelivery(
    baseUrl: string,
    key: string,
    fetchImpl: typeof fetch
): Promise<CheckResult>;
```

Existing visual verification calls it with its current `SOURCE_PROBE_KEY`.

Audio smoke:

```ts
export async function verifyAudioHttpDelivery(input: {
    readonly baseUrl: string;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly privateArchiveKeys: readonly [string, string];
    readonly fetchImpl?: typeof fetch;
}): Promise<void>;
```

- [ ] **Step 1: Refactor the source-absence helper with no visual behavior change**

Parameterize the current fixed key and export the helper. Preserve its rule that only `404` proves absence; `403` fails.

Run:

```bash
bun --filter @aquila/infra-cloudflare test -- src/__tests__/verify.test.ts
```

- [ ] **Step 2: Write audio mocked HTTP tests using existing assertion helpers**

Import:

```ts
import {
    assertContentType,
    assertImmutable,
    assertPointerRevalidation,
} from '../assertions';
```

Do not restate cache policy strings in the new verifier.

Require:

- pointer `application/json` + `assertPointerRevalidation`;
- manifest `application/json` + `assertImmutable`;
- MP3 `audio/mpeg` + `assertImmutable` + exact content length;
- manifest/body SHA checks;
- both private archive keys return exactly 404 on delivery host.

- [ ] **Step 3: Add only the new Range assertion**

Fixture MP3 must exceed 1024 bytes. Request:

```http
Range: bytes=0-1023
```

Require status `206`, exactly 1024 response bytes, and `Content-Range: bytes 0-1023/<full-length>`.

- [ ] **Step 4: Implement the focused audio HTTP verifier**

Parse pointer/manifest using runtime audio parsers, fetch one MP3, reuse assertions, then range-fetch it and 404-probe the supplied source + receipt archive keys.

- [ ] **Step 5: Add package script**

```json
"verify:audio": "bun src/publisher/audio-http-smoke.ts"
```

The executable accepts base/story/preview plus two archive probe keys. It prints only sanitized pass/fail headers/statuses and never receipt contents or credentials.

- [ ] **Step 6: Update the R2 runbook**

Document:

- MP3 objects reuse `vn/objects/<sha>.mp3` and therefore the existing immutable rule unchanged;
- audio manifests/pointers use the audio namespace;
- `R2_PUBLISHER_*` remains delivery-only;
- a separate source-only Object Read & Write token supplies `R2_SOURCE_ARCHIVE_*`;
- private archive keys must return 404 through `assets.aquila.cwchanap.dev`.

Do not instruct an immutable cache-rule dashboard edit.

- [ ] **Step 7: Run mocked/static verification**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-http-smoke.test.ts src/__tests__/verify.test.ts src/__tests__/rules.test.ts
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

- [ ] **Step 8: Run one local fixture release end-to-end**

Execute audio plan → publish → deep verify. Confirm source+receipt objects exist only under local `source/`, public MP3/manifest only under `delivery/`, and no audio `current.json` exists until explicit local activation.

- [ ] **Step 9: Preflight live source archive credential separately**

Using the source-only credential, verify access to `aquila-vn-source` and no access to `aquila-vn-delivery`. Using `R2_PUBLISHER_*`, verify delivery access and no source-bucket access. Do not widen either token if the preflight fails.

- [ ] **Step 10: Run isolated preview R2 publish + HTTP smoke**

Use a unique preview id `hpa-609-smoke-<short-sha>`:

1. record production audio pointer bytes/ETag or absence;
2. publish preview immutables with `--media audio`;
3. deep verify preview release;
4. explicitly activate preview audio release;
5. run full MP3 GET through `https://assets.aquila.cwchanap.dev` and require `MISS`, `HIT`, `EXPIRED`, or `REVALIDATED` cache eligibility;
6. run the 0-1023 Range check and require 206;
7. GET the exact selected `audio/approved/.../source.*` archive key through the delivery host and require 404;
8. GET the matching `audio/approved/.../receipt.json` through the delivery host and require 404;
9. publish/activate a second fixture release;
10. rollback to the first;
11. reactivate the second;
12. compare production audio pointer bytes/ETag to step 1 and require no change.

Record only sanitized command results/status/header facts.

- [ ] **Step 11: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-http-smoke.ts packages/infra-cloudflare/src/publisher/__tests__/audio-http-smoke.test.ts packages/infra-cloudflare/src/verify.ts packages/infra-cloudflare/src/__tests__/verify.test.ts packages/infra-cloudflare/package.json docs/infrastructure/r2-visual-asset-delivery.md
git commit -m "docs: add R2 audio delivery verification"
```

---

## Final Verification

- [ ] Run:

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

- [ ] Confirm `RuntimeAudioManifestV1`, delivery custom metadata, `AudioCoverageEntryV1`, and publisher JSON reports contain no prompt/provider/model/source-path/candidate/receipt fields.
- [ ] Confirm `candidateId` exists only in internal HPA-608/`PreparedAudioSource` flow, never report coverage.
- [ ] Confirm `R2_PUBLISHER_*` still targets delivery only and source archival uses only `R2_SOURCE_ARCHIVE_*`.
- [ ] Confirm both LocalDeliveryStore and R2DeliveryStore accept only the two added audio pointer grammars plus existing visual forms.
- [ ] Confirm runtime MP3 path is `vn/objects/<sha>.mp3` and `rules.ts` requires no HPA-609 predicate change.
- [ ] Confirm missing runtime `bit_rate` fails both normalized-output and stored deep verification through the same strict parser.
- [ ] Confirm delivery-host GETs for the exact archived source and receipt keys return 404, not 403.
- [ ] Confirm `audio-publish.ts` has no activation import and audio publish has zero `compareAndSwapPointer` call paths.
- [ ] Confirm audio activation/rollback/reactivation can write only `vn/audio/.../current.json` or `vn/previews/<id>/audio/.../current.json`.
- [ ] Confirm existing visual publisher/runtime tests/default CLI output remain unchanged except internal immutable-helper imports.
- [ ] Confirm HPA-610 can resolve using only base URL + audio pointer + audio manifest + MP3 paths.
