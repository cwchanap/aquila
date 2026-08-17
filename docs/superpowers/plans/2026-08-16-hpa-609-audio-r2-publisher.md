# HPA-609 Audio R2 Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish explicitly selected Aquila SFX/BGM as independently versioned, immutable MP3 releases through the existing R2 source/delivery infrastructure, with explicit activation, deep verification, rollback, and deterministic coverage.

**Architecture:** Keep the visual manifest/encoder unchanged. Add audio-specific runtime/source/MP3 modules, reuse `DeliveryStore`, extract only the already-generic immutable-candidate operations, and add a small visual/audio dispatch inside the existing activation/release-history services so pointer CAS and rollback semantics stay single-owned. Audio `publish` writes and verifies immutable data only; `activate` is always a separate command.

**Tech Stack:** TypeScript, Bun, Vitest, Zod, Node `child_process`, system `ffmpeg`/`ffprobe`, AWS S3 client for Cloudflare R2, existing `@aquila/stories` runtime/compiler/audio-generation modules.

## Global Constraints

- Keep `RuntimeAssetManifestV1` and all visual background/portrait wire behavior unchanged.
- Runtime audio v1 is MP3 only: MPEG Layer III, 44.1 kHz, 128 kbit/s, `audio/mpeg`, stripped metadata/artwork.
- Production audio publication never mutates `current.json`; only the explicit `activate --media audio` command may do so.
- Reuse `aquila-vn-source`, `aquila-vn-delivery`, `assets.aquila.cwchanap.dev`, the existing R2 credentials, preview namespace, and the existing two Cloudflare cache rules.
- Public audio manifests/object metadata contain no prompt, provider/model/request id, candidate id, receipt, source path, or local absolute path.
- Compiler-used cues must be selected or explicitly omitted with a non-empty reason; there is no `--allow-missing` mode.
- Do not add a generic media adapter/plugin framework, database, daemon, Worker, queue, second S3 client implementation, multiple codecs, loudness mastering, or loop editing.
- System `ffmpeg` and `ffprobe` are publisher prerequisites; tests inject the process runner instead of requiring the binaries.
- Visual CLI behavior remains the default when `--media` is absent.

---

### Task 1: Add the audio runtime contract and path grammar

**Files:**
- Create: `packages/stories/src/runtime-assets/audio.ts`
- Modify: `packages/stories/src/runtime-assets/paths.ts`
- Modify: `packages/stories/src/runtime-assets/index.ts`
- Test: `packages/stories/src/runtime-assets/__tests__/audio.test.ts`

**Interfaces:**
- Consumes: `canonicalJson`, `releaseIdFromContentSha256`, `assertSha256`, `compareQualifiedAssetIds`, `isSafeLogicalKey`, `isStoryId`, `isReleaseId`, `PublicationTarget`, `ActiveReleasePointerV1Schema`, SHA-purpose types.
- Produces:

```ts
export type AudioAssetType = 'sfx' | 'bgm';
export interface RuntimeAudioAssetV1 {
    identity: { type: AudioAssetType; key: string };
    format: 'mp3';
    path: string;
    sha256: ObjectContentSha256;
    byteLength: number;
    durationMs: number;
    loop: boolean;
}
export interface RuntimeAudioManifestV1 {
    schemaVersion: 1;
    storyId: string;
    releaseId: string;
    assets: RuntimeAudioAssetV1[];
}
export type AudioActiveReleasePointerV1 = ActiveReleasePointerV1;

export function getAudioObjectPath(sha256: ObjectContentSha256): string;
export function getAudioReleaseManifestPath(
    storyId: string,
    releaseId: string,
    target: PublicationTarget
): string;
export function getAudioCurrentPointerPath(
    storyId: string,
    target: PublicationTarget
): string;
export function parseRuntimeAudioManifest(input: unknown): RuntimeAudioManifestV1;
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
): AudioActiveReleasePointerV1;
export function validateAudioPointerManifestPair(
    pointer: AudioActiveReleasePointerV1,
    manifest: RuntimeAudioManifestV1,
    actualManifestSha256: ManifestByteSha256
): void;
```

- [ ] **Step 1: Write failing path and schema tests**

Add tests that assert the exact production/preview keys and the schema invariants:

```ts
expect(getAudioObjectPath(digest)).toBe(`vn/audio/objects/${digest}.mp3`);
expect(getAudioReleaseManifestPath('demo_story', releaseId, { kind: 'production' }))
    .toBe(`vn/audio/stories/demo_story/releases/${releaseId}/runtime-manifest.json`);
expect(getAudioCurrentPointerPath('demo_story', {
    kind: 'preview', previewId: 'gate-1',
})).toBe('vn/previews/gate-1/audio/stories/demo_story/current.json');
```

Use one valid SFX entry and one valid BGM entry, then separately assert failures for duplicate identity, reverse sort order, bad SHA, path/SHA mismatch, zero/negative duration, `sfx + loop:true`, and `bgm + loop:false`.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
```

Expected: FAIL because the audio contract/path exports do not exist.

- [ ] **Step 3: Add audio path helpers without changing visual paths**

In `paths.ts`, reuse the existing target validation and publication prefix. Keep visual helpers unchanged and add:

```ts
export function getAudioObjectPath(sha256: ObjectContentSha256): string {
    if (!isSha256(sha256)) {
        throw new AssetResolverError('integrity', 'Invalid SHA-256 digest');
    }
    return `vn/audio/objects/${sha256}.mp3`;
}

export function getAudioReleaseManifestPath(
    storyId: string,
    releaseId: string,
    target: PublicationTarget
): string {
    assertPublicationTarget(storyId, target);
    if (!isReleaseId(releaseId)) {
        throw new AssetResolverError('unsafe-path', `Invalid release id: ${releaseId}`);
    }
    const prefix = target.kind === 'production'
        ? 'vn/audio'
        : `vn/previews/${target.previewId}/audio`;
    return `${prefix}/stories/${storyId}/releases/${releaseId}/runtime-manifest.json`;
}

export function getAudioCurrentPointerPath(
    storyId: string,
    target: PublicationTarget
): string {
    assertPublicationTarget(storyId, target);
    const prefix = target.kind === 'production'
        ? 'vn/audio'
        : `vn/previews/${target.previewId}/audio`;
    return `${prefix}/stories/${storyId}/current.json`;
}
```

- [ ] **Step 4: Implement the strict audio manifest and pointer validation**

In `audio.ts`, use Zod with the existing path/hash predicates. Require sorted unique `${type}:${key}` entries and enforce loop by type in `superRefine`. Reuse the existing forbidden-runtime-field scan pattern by keeping the audio parser strict and recursively rejecting keys containing `prompt`, `provider`, `sourcePath`, `credential`, `token`, or `apiKey`; do not weaken the visual parser.

Canonicalize exactly:

```ts
return canonicalJson({
    schemaVersion: manifest.schemaVersion,
    storyId: manifest.storyId,
    assets: [...manifest.assets].sort((a, b) =>
        compareQualifiedAssetIds(
            `${a.identity.type}:${a.identity.key}`,
            `${b.identity.type}:${b.identity.key}`
        )
    ),
});
```

`parseAudioActiveReleasePointer` parses with the existing pointer field schema, then requires `storyId === expectedStoryId` and `manifestPath === getAudioReleaseManifestPath(...)`.

- [ ] **Step 5: Export the audio contract**

Add only the new audio symbols to `runtime-assets/index.ts`. Do not re-export Node-only publisher/compiler code here.

- [ ] **Step 6: Run focused and package tests**

Run:

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
```

Expected: PASS, including all pre-existing visual runtime-asset tests.

- [ ] **Step 7: Commit**

```bash
git add packages/stories/src/runtime-assets
git commit -m "feat: add runtime audio release contract"
```

---

### Task 2: Complete the HPA-608 handoff and expose compiler-owned audio publishing inputs

**Files:**
- Modify: `packages/stories/src/audio-generation/index.ts`
- Create: `packages/stories/src/audio-publishing.ts`
- Modify: `packages/stories/package.json`
- Test: `packages/stories/src/audio-generation/__tests__/index.test.ts`
- Test: `packages/stories/src/compiler/__tests__/audio-publishing.test.ts`

**Interfaces:**
- Consumes: `buildAudioGenerationSpec`, `audioGenerationSpecSha256`, `STORIES_RAW_ROOT`, `loadStoryCompilerConfig`, `compileStory`, `loadAudioPlan`, `collectAudioUsage`, `buildAudioUsageReport`.
- Produces:

```ts
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

and supported HPA-608 exports:

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';
```

- [ ] **Step 1: Add failing export and context tests**

The generation index test imports both spec helpers through `@aquila/stories/audio-generation` and proves that changing an authored `durationMs` changes the current spec hash.

The publishing-context test creates a temp raw-story fixture with `compiler.config.ts`, characters, one scene, and `docs/audio-plan.json`, then expects:

```ts
const context = await loadAudioPublishingContext(fixture.storyFolder);
expect(context.storyId).toBe('fixture_story');
expect(context.usage.assets).toEqual([
    expect.objectContaining({ type: 'sfx', key: 'door-close', usageCount: 1 }),
]);
```

- [ ] **Step 2: Run the tests and confirm missing-export failures**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/index.test.ts src/compiler/__tests__/audio-publishing.test.ts
```

Expected: FAIL on missing exports/module.

- [ ] **Step 3: Export only the two current-spec helpers from the existing Node-only subpath**

Update `audio-generation/index.ts`; do not expose provider HTTP clients or CLI internals.

- [ ] **Step 4: Implement `loadAudioPublishingContext` as a thin compiler wrapper**

Resolve `<STORIES_RAW_ROOT>/<storyFolder>`, load the config, call `compileStory` with `writeOutputs: false`, load the plan, and build the report from the returned `StoryIR`:

```ts
const story = compileStory({
    rawDir,
    name: storyFolder,
    outDir: join(rawDir, '.unused-generated'),
    choicesPath: join(rawDir, '.unused-choices.ts'),
    config,
    writeOutputs: false,
});
const plan = loadAudioPlan(rawDir);
if (plan === undefined) throw new Error(`Story ${storyFolder} has no docs/audio-plan.json`);
const usage = buildAudioUsageReport(
    storyFolder,
    collectAudioUsage(story),
    plan
);
return { storyFolder, storyId: config.storyId, plan, usage };
```

No output path is written because `writeOutputs:false`.

- [ ] **Step 5: Add the Node-only package subpath**

In `packages/stories/package.json`:

```json
"./audio-publishing": "./src/audio-publishing.ts"
```

Do not add it to `src/index.ts`.

- [ ] **Step 6: Run package tests/typecheck**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/stories/src/audio-generation/index.ts packages/stories/src/audio-publishing.ts packages/stories/package.json packages/stories/src/audio-generation/__tests__ packages/stories/src/compiler/__tests__/audio-publishing.test.ts
git commit -m "feat: expose audio publishing inputs"
```

---

### Task 3: Extract immutable-candidate operations and extend the existing R2/cache primitives

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/immutable-candidate.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publication-plan.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publish.ts`
- Modify: `packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts`
- Modify: `packages/infra-cloudflare/src/rules.ts`
- Modify: `packages/infra-cloudflare/src/__tests__/rules.test.ts`
- Modify: `packages/infra-cloudflare/package.json`

**Interfaces:**
- Produces:

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
    input: Omit<PlannedImmutableCandidate, 'status'>
): Promise<PlannedImmutableCandidate>;

export async function publishImmutableCandidate(
    store: DeliveryStore,
    candidate: PlannedImmutableCandidate
): Promise<'created' | 'reused'>;
```

- `R2DeliveryStore.createFromEnvironment({ bucket?: 'delivery' | 'source', ... })` keeps `'delivery'` as the default.

- [ ] **Step 1: Add tests for the shared immutable helper**

Move the existing publication-plan/publish assertions for create/reuse metadata conflict and exact read-back conflict into a focused helper test. Require `source` candidates to use the same immutability behavior.

- [ ] **Step 2: Extract the existing generic logic without changing behavior**

Move `PlannedImmutableCandidate`, `inspectImmutableCandidate`, create/read-back verification, and byte equality to `immutable-candidate.ts`. Update visual `publication-plan.ts` and `publish.ts` to import them.

Do not move visual coverage, encoding, pointer, or report code.

- [ ] **Step 3: Run the visual publisher tests before any audio-specific R2 changes**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/publication-plan.test.ts src/publisher/__tests__/publish.integration.test.ts
```

Expected: PASS with the same visual behavior.

- [ ] **Step 4: Add source/delivery bucket selection to the existing R2 factory**

Change the factory option to:

```ts
static async createFromEnvironment(options: {
    configPath?: string;
    environment?: Readonly<Record<string, string | undefined>>;
    bucket?: 'delivery' | 'source';
} = {}): Promise<R2DeliveryStore>
```

Select:

```ts
bucket: config.buckets[options.bucket ?? 'delivery']
```

Keep one SDK-client implementation and the same credentials.

- [ ] **Step 5: Extend only the pointer-key allowlist**

Add production audio:

```text
vn/audio/stories/<storyId>/current.json
```

and preview audio:

```text
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

Keep every other arbitrary `current.json` path rejected.

- [ ] **Step 6: Extend the existing immutable cache rule**

Update its predicate to exactly:

```ts
'(starts_with(http.request.uri.path, "/vn/objects/") or starts_with(http.request.uri.path, "/vn/audio/objects/") or ends_with(http.request.uri.path, "/runtime-manifest.json"))'
```

Keep the rule count at two and the pointer bypass expression unchanged.

- [ ] **Step 7: Add the missing infra typecheck script**

In `packages/infra-cloudflare/package.json` add:

```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 8: Run the focused store/rule tests plus typecheck**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/r2-delivery-store.test.ts src/__tests__/rules.test.ts
bun --filter @aquila/infra-cloudflare typecheck
```

- [ ] **Step 9: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/immutable-candidate.ts packages/infra-cloudflare/src/publisher/publication-plan.ts packages/infra-cloudflare/src/publisher/publish.ts packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts packages/infra-cloudflare/src/rules.ts packages/infra-cloudflare/src/__tests__/rules.test.ts packages/infra-cloudflare/package.json
git commit -m "refactor: share immutable publication primitives"
```

---

### Task 4: Validate selections, omissions, coverage, and private source archive inputs

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
          readonly candidateId: string;
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

export async function archivePreparedAudioSources(input: {
    readonly store: DeliveryStore;
    readonly plan: AudioSourcePlan;
}): Promise<void>;
```

- [ ] **Step 1: Write fixture tests for valid selection and all rejection paths**

Build a tiny temp HPA-608 store with one success receipt/candidate and a matching `selection.json`. Assert one included coverage entry.

Then mutate one thing per test and require failure before an injected archive store receives any create call:

- selection `storyId` mismatch;
- stale `specSha256` after the audio-plan row changes;
- wrong `sourceSha256`;
- missing candidate/receipt bytes;
- used key neither selected nor omitted;
- selected and omitted same key;
- omission for unknown or unused key;
- empty omission reason.

Also assert selected-but-unused and plan-unused keys appear only as warnings/report data and are not returned in `sources`.

- [ ] **Step 2: Run the test and confirm it fails**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts
```

- [ ] **Step 3: Implement the strict omissions parser**

Use Zod `.strict()` and the current plan key schema. Normalize reasons with `.trim().min(1).max(500)`.

No file means:

```ts
{ schemaVersion: 1, storyId: expectedStoryId, omissions: {} }
```

- [ ] **Step 4: Load the compiler context and HPA-608 selection**

Use only supported package subpaths:

```ts
import { loadAudioPublishingContext } from '@aquila/stories/audio-publishing';
import {
    AudioSelectionFileV1Schema,
    LocalAudioGenerationStore,
    buildAudioGenerationSpec,
    audioGenerationSpecSha256,
} from '@aquila/stories/audio-generation';
```

Cross-check `context.storyId === expectedStoryId` before opening candidates.

- [ ] **Step 5: Verify current spec and selected bytes**

For each compiler-used selected key:

```ts
const asset = context.plan.assets.find(item => item.key === key)!;
const currentSpecSha256 = audioGenerationSpecSha256(
    buildAudioGenerationSpec(asset)
);
if (selected.specSha256 !== currentSpecSha256) throw sourceError(...);
const candidate = await store.readVerifiedCandidate(key, selected.candidateId);
if (candidate === null) throw sourceError(...);
if (candidate.receipt.specSha256 !== currentSpecSha256) throw sourceError(...);
if (sha256Bytes(candidate.bytes) !== selected.sourceSha256) throw sourceError(...);
```

Read the exact receipt file bytes for private archival; do not reconstruct receipt JSON.

- [ ] **Step 6: Build sorted deterministic coverage**

Sort by `${type}:${key}` and classify only compiler-used keys. Set `loop` from the current plan (`bgm` true, SFX false). Do not expose prompts/source paths in the returned coverage.

- [ ] **Step 7: Implement private archive keys and immutable reuse**

For each included source create/reuse:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<safe-extension>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

Use `application/json` for receipts and the verified source media type for originals. Use `private, max-age=0, no-store` as archive object cache-control even though the source bucket is private.

Call `inspectImmutableCandidate` followed by `publishImmutableCandidate` so a conflicting existing archive object fails closed.

- [ ] **Step 8: Run the source tests**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-source.ts packages/infra-cloudflare/src/publisher/__tests__/audio-source.test.ts
git commit -m "feat: validate selected audio publication sources"
```

---

### Task 5: Normalize and probe runtime MP3 files

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-encoder.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts`

**Interfaces:**

```ts
export interface AudioProcessResult {
    readonly exitCode: number;
    readonly stdout: Uint8Array;
    readonly stderr: string;
}

export type AudioProcessRunner = (
    executable: 'ffmpeg' | 'ffprobe',
    args: readonly string[]
) => Promise<AudioProcessResult>;

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

export async function normalizeRuntimeAudio(
    source: PreparedAudioSource,
    options?: { readonly run?: AudioProcessRunner }
): Promise<{ asset: NormalizedAudioAsset; warnings: PublisherDiagnosticV1[] }>;
```

- [ ] **Step 1: Write process-runner tests for the exact command policy**

Fake `ffprobe` responses as JSON and capture the `ffmpeg` argv. Assert the normalization command includes, in order-independent groups:

```text
-nostdin -hide_banner -loglevel error
-map 0:a:0 -vn -map_metadata -1
-ar 44100 -c:a libmp3lame -b:a 128k
-id3v2_version 0 -write_id3v1 0
```

Use temp input/output files so no shell interpolation is required.

- [ ] **Step 2: Add rejection tests**

Require a typed `PublisherError` for:

- ffprobe/ffmpeg executable failure;
- no audio stream;
- empty output;
- normalized codec not `mp3`;
- normalized sample rate not `44100`;
- non-positive duration;
- SFX duration `> 30_000ms`;
- BGM duration `> 600_000ms`.

Add one warning test where measured duration differs from `plannedDurationMs` by more than `max(500ms, planned * 0.1)`; this must not fail publication.

- [ ] **Step 3: Run the test and confirm it fails**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
```

- [ ] **Step 4: Implement the default child-process runner**

Use `spawn`/`execFile`, never `shell:true`. Limit stderr retained in an error to a short sanitized suffix and never include local source paths in `PublisherDiagnosticV1`.

- [ ] **Step 5: Probe the source, normalize, then probe output**

Parse only the fields needed from `ffprobe -v error -show_entries stream=codec_name,sample_rate -show_entries format=duration -of json`.

Write source bytes to a temp directory, invoke ffmpeg to a sibling `.mp3`, read bytes, then remove the temp directory in `finally`.

- [ ] **Step 6: Hash the normalized bytes and derive the public object path**

```ts
const digest = assertSha256<'object-content'>(sha256Hex(outputBytes));
const path = getAudioObjectPath(digest);
```

Set `contentType: 'audio/mpeg'` and measured rounded `durationMs`.

- [ ] **Step 7: Run tests/typecheck**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
bun --filter @aquila/infra-cloudflare typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-encoder.ts packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts
git commit -m "feat: normalize runtime MP3 audio"
```

---

### Task 6: Build deterministic audio releases and publish immutable data without activation

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-runtime-release.ts`
- Create: `packages/infra-cloudflare/src/publisher/audio-publication-plan.ts`
- Create: `packages/infra-cloudflare/src/publisher/audio-publish.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: `packages/infra-cloudflare/src/publisher/report.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-publication-plan.test.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts`

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

export async function buildAudioPublicationPlan(
    options: BuildAudioPublicationPlanOptions
): Promise<AudioPublicationPlan>;

export async function publishAudioRelease(
    options: PublishAudioReleaseOptions
): Promise<PublisherReportV1>;
```

- [ ] **Step 1: Add deterministic release tests**

Construct the same logical assets in different input orders and assert identical sorted manifests, canonical bytes, manifest SHA, and release id. Mutating one MP3 digest/duration/loop flag must change the release id.

- [ ] **Step 2: Implement `buildPreparedAudioRelease`**

Build entries from normalized assets, parse through `parseRuntimeAudioManifest`, compute:

```ts
const releaseContentSha256 = sha256ReleaseContent(
    canonicalAudioReleaseContent(draft)
);
const releaseId = releaseIdFromContentSha256(releaseContentSha256);
const manifest = parseRuntimeAudioManifest({ ...draft, releaseId });
const manifestBytes = new TextEncoder().encode(`${canonicalJson(manifest)}\n`);
const manifestSha256 = sha256ManifestBytes(manifestBytes);
```

Require every included coverage identity to exist in the manifest and every manifest identity to have included coverage.

- [ ] **Step 3: Add publication-plan tests**

Use an in-memory `DeliveryStore`. Assert:

- normalized objects use `public, max-age=31536000, immutable` + `audio/mpeg`;
- manifest uses the same immutable cache policy + `application/json`;
- existing exact objects/manifests become `reuse`;
- conflicting bytes/metadata fail;
- production and preview use different manifest/pointer paths but the same `vn/audio/objects/<sha>.mp3`;
- advisory pointer is audio-scoped and does not inspect the visual pointer.

- [ ] **Step 4: Implement `buildAudioPublicationPlan`**

Sequence:

```text
prepareAudioSources
normalizeRuntimeAudio for included sources
buildPreparedAudioRelease
inspect unique MP3 candidates
inspect manifest candidate
inspect audio advisory pointer
render deterministic report/actions
```

`plan` must not archive or upload anything.

- [ ] **Step 5: Add publish integration tests that prove no pointer write**

Instrument `compareAndSwapPointer` and assert call count is zero for both preview and production `publishAudioRelease`.

Also assert source archival occurs before the first delivery `createImmutable`. Force archive failure and require zero delivery writes.

- [ ] **Step 6: Implement `publishAudioRelease`**

Order:

```ts
const plan = await buildAudioPublicationPlan(options);
await archivePreparedAudioSources({ store: options.sourceStore, plan: plan.sourcePlan });
for (const candidate of plan.objects) await publishImmutableCandidate(options.store, candidate);
await publishImmutableCandidate(options.store, plan.manifest);
await verifyPreparedAudioRelease({
    store: options.store,
    preparedRelease: plan.preparedRelease,
    depth: 'deep',
});
return reportWithPointerChangedFalse(plan);
```

Do not call activation from this module.

- [ ] **Step 7: Extend report typing minimally**

Keep visual JSON unchanged. Add optional audio-only fields:

```ts
media?: 'audio';
audioCoverage?: readonly AudioCoverageEntryV1[];
```

Update report sanitization so `sfx:<safe-key>` and `bgm:<safe-key>` identities are allowed only in audio diagnostics. Do not add prompts/source paths to report fields.

- [ ] **Step 8: Run focused tests**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/audio-runtime-release.test.ts \
  src/publisher/__tests__/audio-publication-plan.test.ts \
  src/publisher/__tests__/audio-publish.integration.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-runtime-release.ts packages/infra-cloudflare/src/publisher/audio-publication-plan.ts packages/infra-cloudflare/src/publisher/audio-publish.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/report.ts packages/infra-cloudflare/src/publisher/__tests__/audio-*.test.ts
git commit -m "feat: publish immutable audio releases"
```

---

### Task 7: Add stored MP3 verification and reuse the existing activation/history semantics

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts`
- Modify: `packages/infra-cloudflare/src/publisher/activation.ts`
- Modify: `packages/infra-cloudflare/src/publisher/release-history.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts`

**Interfaces:**

```ts
export interface VerifiedStoredAudioRelease {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly manifestPath: string;
    readonly manifest: RuntimeAudioManifestV1;
    readonly manifestBytes: Uint8Array;
    readonly manifestSha256: ManifestByteSha256;
    readonly releaseContentSha256: ReleaseContentSha256;
    readonly pointerCandidate: AudioActiveReleasePointerV1;
    readonly validatePointer: (pointer: AudioActiveReleasePointerV1) => void;
}

export async function verifyStoredAudioRelease(
    options: VerifyStoredAudioReleaseOptions
): Promise<VerifiedStoredAudioRelease>;

export async function verifyPreparedAudioRelease(
    options: VerifyPreparedAudioReleaseOptions
): Promise<VerifiedStoredAudioRelease>;
```

Extend release operations with:

```ts
export type PublisherMedia = 'visual' | 'audio';
```

and optional `media?: PublisherMedia`, defaulting to visual.

- [ ] **Step 1: Write shallow/deep audio verifier tests**

Shallow must reject bad manifest metadata, non-canonical bytes, story/release mismatch, release digest mismatch, object path mismatch, and wrong expected manifest hash without probing MP3 bodies.

Deep must additionally reject wrong MIME/cache/length/body hash, non-MP3 codec, wrong sample rate, non-positive duration, and manifest duration outside a 25ms probe-rounding tolerance.

- [ ] **Step 2: Implement the audio verifier without changing the image verifier**

Group references by object SHA/path and read each unique MP3 once. Reuse the `audio-encoder.ts` probe parser/runner, not Sharp.

Build the pointer candidate with `getAudioReleaseManifestPath` and validate it with `parseAudioActiveReleasePointer` + `validateAudioPointerManifestPair`.

- [ ] **Step 3: Add audio activation tests before changing activation code**

Copy the existing behavioral assertions using audio paths/verifier injection:

- first activation writes audio pointer;
- same release returns no-op unless `reactivate`;
- stale CAS returns conflict;
- override performs one fresh re-verify/read attempt;
- timestamp monotonically advances;
- production confirmation still requires exact story id;
- visual pointer remains untouched.

- [ ] **Step 4: Add the minimum activation dispatch**

Inside `activation.ts`, define one internal shape used by the CAS logic:

```ts
interface ActivatableStoredRelease {
    readonly releaseId: string;
    readonly manifestSha256: ManifestByteSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}
```

Dispatch only verifier/path/parser by `options.media ?? 'visual'`. Keep `nextPublishedAt`, confirmation, CAS, conflict override, and report result logic shared.

- [ ] **Step 5: Add audio release-history tests**

Under `vn/audio/...` and preview audio namespaces, assert release discovery, shallow/deep flags, invalid manifest classification, active release detection, rollback, and reactivation. Assert visual release listing ignores audio manifests and audio listing ignores visual manifests.

- [ ] **Step 6: Extend release history with media-specific path/parser/verifier selection**

Keep one listing/rollback algorithm. Use small private functions:

```ts
manifestPathFor(media, storyId, releaseId, target)
currentPointerPathFor(media, storyId, target)
parseManifestFor(media, bytes)
classifyReleaseIdentityFor(media, manifest)
verifyStoredFor(media, options)
```

Do not expose a generic adapter registry.

- [ ] **Step 7: Run verifier/activation/history plus all existing visual tests**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/audio-candidate-verifier.test.ts \
  src/publisher/__tests__/activation.test.ts \
  src/publisher/__tests__/release-history.test.ts
bun --filter @aquila/infra-cloudflare test
```

- [ ] **Step 8: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts packages/infra-cloudflare/src/publisher/activation.ts packages/infra-cloudflare/src/publisher/release-history.ts packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts
git commit -m "feat: verify and activate audio releases"
```

---

### Task 8: Add `--media audio` CLI dispatch and local source/delivery separation

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/cli.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts`

**Interfaces:**

```ts
interface BaseParsedCommand {
    readonly media: 'visual' | 'audio';
    // existing fields unchanged
    readonly storyFolder?: string;
    readonly audioGenerationRoot?: string;
    readonly omissionsPath?: string;
    readonly sourceArchiveStore?: DeliveryStore;
}
```

- [ ] **Step 1: Add CLI parsing tests first**

Assert existing input still parses as visual without a `--media` flag.

Add audio cases:

```text
plan/publish --media audio --story demo_story --story-folder demoStory ...
activate/verify/releases/rollback --media audio --story demo_story ...
```

Reject:

- unknown media;
- audio plan/publish without `--story-folder`;
- `--story-folder` on visual mode;
- `mirror-preview --media audio`;
- audio `publish --reactivate` or pointer-mutation flags;
- audio-only input flags on activate/verify/releases/rollback.

- [ ] **Step 2: Add `--media` to common option parsing with visual default**

```ts
function parseMedia(values: CliValues): PublisherMedia {
    const media = values.media ?? 'visual';
    if (media !== 'visual' && media !== 'audio') {
        throw configurationError('--media must be visual or audio');
    }
    return media;
}
```

Keep current help/examples and append a short audio section rather than rewriting visual documentation.

- [ ] **Step 3: Resolve audio local/R2 stores**

For visual, preserve current store construction.

For local audio:

```text
--destination-root .tmp/hpa-609
  -> delivery store root .tmp/hpa-609/delivery
  -> source archive root .tmp/hpa-609/source
```

For R2 audio:

```ts
const delivery = await R2DeliveryStore.createFromEnvironment({ bucket: 'delivery' });
const source = await R2DeliveryStore.createFromEnvironment({ bucket: 'source' });
```

Ensure both stores close in `finally`, and if the second close fails preserve the first command error.

- [ ] **Step 4: Dispatch plan/publish to audio services**

`plan --media audio` calls `buildAudioPublicationPlan` and never archives/writes.

`publish --media audio` calls `publishAudioRelease` with both stores and never activates.

- [ ] **Step 5: Dispatch release operations by media**

Pass `media` through `activateStoredRelease`, stored verifier, `listReleases`, and `rollbackRelease`. Keep visual default behavior identical.

- [ ] **Step 6: Extend report rendering/sanitization tests**

Require JSON report output for audio to include `media: "audio"` and deterministic `audioCoverage`, while visual golden/report tests remain unchanged.

- [ ] **Step 7: Run CLI and package tests**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
```

- [ ] **Step 8: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/cli.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat: add audio publisher CLI dispatch"
```

---

### Task 9: Document and prove the R2 audio delivery smoke

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-http-smoke.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-http-smoke.test.ts`
- Modify: `packages/infra-cloudflare/package.json`
- Modify: `docs/infrastructure/r2-visual-asset-delivery.md`

**Interfaces:**

```ts
export async function verifyAudioHttpDelivery(input: {
    readonly baseUrl: string;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly fetchImpl?: typeof fetch;
}): Promise<void>;
```

- [ ] **Step 1: Add mocked HTTP tests**

Model pointer -> manifest -> MP3 full GET -> MP3 range GET.

Require:

```text
pointer: application/json + no-cache,max-age=0,must-revalidate
manifest: application/json + public,max-age=31536000,immutable
MP3: audio/mpeg + public,max-age=31536000,immutable + exact content-length
Range: status 206 + Content-Range bytes 0-1023/<full-length>
```

Verify manifest/object SHA-256 on returned bodies.

- [ ] **Step 2: Implement the focused smoke helper**

Use runtime audio parsers/path resolution and `Range: bytes=0-1023`. Do not turn this into a general web verifier; it exists only for the HPA-609 acceptance smoke.

- [ ] **Step 3: Add the package script**

```json
"verify:audio": "bun src/publisher/audio-http-smoke.ts"
```

The executable entry reads `AQUILA_ASSET_BASE_URL`, story/preview args, and exits non-zero on the first failed invariant.

- [ ] **Step 4: Update the R2 runbook**

Document:

- audio production/preview paths;
- source archive paths are private;
- immutable rule 1 now includes `/vn/audio/objects/`;
- pointer rule remains unchanged;
- existing CORS `range` allowance is reused;
- MP3 live-smoke command.

Do not rename the existing two cache rules.

- [ ] **Step 5: Run mocked smoke tests and full static verification**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-http-smoke.test.ts
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

- [ ] **Step 6: Run one local fixture release end-to-end**

With a tiny checked-in test fixture source/candidate store, run:

```bash
bun --filter @aquila/infra-cloudflare assets -- plan --media audio --story fixture_story --story-folder audioFixture --destination local --destination-root .tmp/hpa-609-local
bun --filter @aquila/infra-cloudflare assets -- publish --media audio --story fixture_story --story-folder audioFixture --destination local --destination-root .tmp/hpa-609-local
bun --filter @aquila/infra-cloudflare assets -- verify --media audio --story fixture_story --environment production --release <release-id-from-json-report> --destination local --destination-root .tmp/hpa-609-local/delivery --deep
```

Confirm no `current.json` exists until running the explicit local `activate --media audio` command.

- [ ] **Step 7: Run the isolated preview R2 smoke**

Use a unique preview id such as `hpa-609-smoke-<short-sha>`:

1. `publish --media audio --environment preview --preview-id <id> --destination r2`;
2. `verify --media audio ... --deep`;
3. `activate --media audio ...`;
4. `verify:audio` through `https://assets.aquila.cwchanap.dev`;
5. publish/activate a second fixture release;
6. rollback to the first;
7. reactivate the second;
8. fetch the production audio pointer before and after and assert its bytes/ETag did not change.

Record the observed headers and command results in the PR description or a Linear comment; do not commit credentials or private receipt contents.

- [ ] **Step 8: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-http-smoke.ts packages/infra-cloudflare/src/publisher/__tests__/audio-http-smoke.test.ts packages/infra-cloudflare/package.json docs/infrastructure/r2-visual-asset-delivery.md
git commit -m "docs: add R2 audio delivery verification"
```

---

## Final verification

- [ ] Run the full required suite:

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

- [ ] Confirm the final diff has no provider prompt/model/source-path data in `RuntimeAudioManifestV1`, public object custom metadata, or audio publisher JSON reports.
- [ ] Confirm existing visual publisher fixture paths and report snapshots are unchanged except for internal imports caused by `immutable-candidate.ts` extraction.
- [ ] Confirm there are still exactly two Aquila Cloudflare cache rules.
- [ ] Confirm audio `publish` has no call path to `compareAndSwapPointer`.
- [ ] Confirm `activate/rollback/reactivate --media audio` can only write `vn/audio/.../current.json` or its preview equivalent.
- [ ] Confirm HPA-610 can resolve the audio release using only the exported runtime contract: base URL + audio pointer + audio manifest + MP3 object paths.
