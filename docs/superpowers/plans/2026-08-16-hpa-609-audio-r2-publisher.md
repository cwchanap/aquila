# HPA-609 Audio R2 Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish explicitly selected Aquila SFX/BGM as independently versioned immutable MP3 releases through the existing R2 source/delivery infrastructure, with deterministic coverage, deep verification, explicit activation, rollback, and reactivation.

**Architecture:** Keep the visual manifest/encoder unchanged. Add audio-specific runtime/source/MP3 modules, reuse `DeliveryStore`, extract only the already-generic immutable-candidate operations, and add a small visual/audio selector inside existing activation/release-history services so pointer CAS semantics stay single-owned. Audio `publish` archives/writes/verifies immutable data only; `activate --media audio` is always a separate command.

**Tech Stack:** TypeScript, Bun, Vitest, Zod, Node child processes, system `ffmpeg`/`ffprobe`, AWS S3 client for Cloudflare R2, existing `@aquila/stories` runtime/compiler/audio-generation modules.

## Global Constraints

- Keep `RuntimeAssetManifestV1` and visual background/portrait behavior unchanged.
- Audio v1 is MP3 only: MPEG Layer III, 44.1 kHz, 128 kbit/s target, `audio/mpeg`, metadata/artwork stripped.
- Audio `publish` never mutates `current.json`; only explicit `activate --media audio` may do so.
- Reuse `aquila-vn-source`, `aquila-vn-delivery`, `assets.aquila.cwchanap.dev`, existing R2 credentials, preview namespace, and exactly two Cloudflare cache rules.
- Public audio manifest/object metadata/reporting contains no prompt, provider/model/request id, candidate id, receipt, source path, credential, or local absolute path.
- Every compiler-used cue is selected or explicitly omitted with a non-empty reason; no `--allow-missing` escape hatch.
- Do not add a generic media adapter/plugin framework, database, daemon, Worker, queue, second R2 client implementation, extra codec, loudness mastering, or loop editing.
- `ffmpeg` and `ffprobe` are publisher prerequisites; unit tests inject the process runner instead of requiring those binaries.
- Existing CLI behavior remains visual when `--media` is absent.

---

### Task 1: Add the runtime audio contract and path grammar

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

- [ ] **Step 1: Write failing path tests**

```ts
expect(getAudioObjectPath(digest)).toBe(`vn/audio/objects/${digest}.mp3`);
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

Also reject invalid story/preview/release ids.

- [ ] **Step 2: Write failing schema tests**

Start from one valid SFX and BGM entry. Separately assert rejection for duplicate identity, reverse sort order, bad SHA, path/SHA mismatch, zero/negative byte length, zero/negative duration, `sfx + loop:true`, `bgm + loop:false`, unknown public fields, prompt/provider/source-path fields, and absolute URL/path values.

- [ ] **Step 3: Run the focused test and verify failure**

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
```

Expected: FAIL because audio exports do not exist.

- [ ] **Step 4: Add audio path helpers next to the existing visual helpers**

Reuse the private `assertPublicationTarget` in `paths.ts` and keep current visual functions unchanged:

```ts
export function getAudioObjectPath(
    sha256: ObjectContentSha256
): string {
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
        throw new AssetResolverError(
            'unsafe-path',
            `Invalid release id: ${releaseId}`
        );
    }
    const prefix =
        target.kind === 'production'
            ? 'vn/audio'
            : `vn/previews/${target.previewId}/audio`;
    return `${prefix}/stories/${storyId}/releases/${releaseId}/runtime-manifest.json`;
}

export function getAudioCurrentPointerPath(
    storyId: string,
    target: PublicationTarget
): string {
    assertPublicationTarget(storyId, target);
    const prefix =
        target.kind === 'production'
            ? 'vn/audio'
            : `vn/previews/${target.previewId}/audio`;
    return `${prefix}/stories/${storyId}/current.json`;
}
```

- [ ] **Step 5: Implement strict audio manifest/pointer schemas**

Use `.strict()` Zod objects. Require key to pass the current audio-plan slug regex and `isSafeLogicalKey`. In `superRefine`, walk assets in input order and reject duplicate or unsorted `${type}:${key}` values; enforce the loop invariant and exact `getAudioObjectPath(assertSha256(...))` match.

Use a strict pointer schema with the existing six fields, then require:

```ts
pointer.storyId === expectedStoryId;
pointer.manifestPath === getAudioReleaseManifestPath(
    pointer.storyId,
    pointer.releaseId,
    target
);
```

- [ ] **Step 6: Implement canonical release identity**

```ts
export function canonicalAudioReleaseContent(
    manifest: RuntimeAudioManifestV1
): string {
    return canonicalJson({
        schemaVersion: manifest.schemaVersion,
        storyId: manifest.storyId,
        assets: manifest.assets,
    });
}
```

Use the same release-id helper and SHA-purpose brands as the visual contract.

- [ ] **Step 7: Export and run the full stories checks**

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
```

Expected: PASS, including all existing visual runtime-asset tests.

- [ ] **Step 8: Commit**

```bash
git add packages/stories/src/runtime-assets
git commit -m "feat: add runtime audio release contract"
```

---

### Task 2: Complete the HPA-608 handoff and expose compiler-owned publication inputs

**Files:**
- Modify: `packages/stories/src/audio-generation/index.ts`
- Create: `packages/stories/src/audio-publishing.ts`
- Modify: `packages/stories/package.json`
- Test: `packages/stories/src/audio-generation/__tests__/index.test.ts`
- Test: `packages/stories/src/compiler/__tests__/audio-publishing.test.ts`

**Interfaces:**

```ts
export { buildAudioGenerationSpec, audioGenerationSpecSha256 } from './spec';
```

and:

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

- [ ] **Step 1: Write failing supported-export tests**

Import both spec helpers through `@aquila/stories/audio-generation`; prove the current spec hash changes when a plan row's paid request input changes.

- [ ] **Step 2: Write a failing temp-story context test**

Create a temp raw story with `compiler.config.ts`, characters, one scene, and `docs/audio-plan.json`, then assert:

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

- [ ] **Step 3: Run and verify the missing-module/export failure**

```bash
bun --filter @aquila/stories test -- src/audio-generation/__tests__/index.test.ts src/compiler/__tests__/audio-publishing.test.ts
```

- [ ] **Step 4: Export only the two current-spec helpers**

Do not expose ElevenLabs HTTP clients, generation runner internals, or CLI functions.

- [ ] **Step 5: Implement the Node-only compiler wrapper**

Reuse `STORIES_RAW_ROOT`, `loadStoryCompilerConfig`, `compileStory`, `loadAudioPlan`, `collectAudioUsage`, and `buildAudioUsageReport`:

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
if (plan === undefined) {
    throw new Error(`Story ${storyFolder} has no docs/audio-plan.json`);
}
return {
    storyFolder,
    storyId: config.storyId,
    plan,
    usage: buildAudioUsageReport(
        storyFolder,
        collectAudioUsage(story),
        plan
    ),
};
```

- [ ] **Step 6: Add the package subpath only**

```json
"./audio-publishing": "./src/audio-publishing.ts"
```

Do not export it from `src/index.ts`.

- [ ] **Step 7: Run package checks and commit**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
git add packages/stories/src/audio-generation/index.ts packages/stories/src/audio-publishing.ts packages/stories/package.json packages/stories/src/audio-generation/__tests__/index.test.ts packages/stories/src/compiler/__tests__/audio-publishing.test.ts
git commit -m "feat: expose audio publishing inputs"
```

---

### Task 3: Share immutable-object operations and extend existing R2/cache primitives

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/immutable-candidate.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/immutable-candidate.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publication-plan.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publish.ts`
- Modify: `packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts`
- Modify: `packages/infra-cloudflare/src/rules.ts`
- Modify: `packages/infra-cloudflare/src/__tests__/rules.test.ts`
- Modify: `packages/infra-cloudflare/package.json`

**Interfaces:**

```ts
export type ImmutableCandidateKind = 'object' | 'manifest' | 'source';

export interface PlannedImmutableCandidate {
    readonly kind: ImmutableCandidateKind;
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

`R2DeliveryStore.createFromEnvironment` additionally accepts `bucket?: 'delivery' | 'source'`, default `delivery`.

- [ ] **Step 1: Write immutable-helper tests from existing visual behavior**

Cover absent -> create, exact metadata+bytes -> reuse, metadata conflict -> integrity error, byte conflict -> integrity error, create race -> read-back exact match, and exact read-back failure. Run them against `object`, `manifest`, and one `source` candidate.

- [ ] **Step 2: Extract only media-neutral candidate logic**

Move the candidate interface, destination inspection, create/reuse, byte equality, and exact read-back verification out of visual `publication-plan.ts`/`publish.ts`. Keep visual encoder/coverage/pointer/report logic where it is.

- [ ] **Step 3: Run visual plan/publish tests before R2 changes**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/immutable-candidate.test.ts src/publisher/__tests__/publication-plan.test.ts src/publisher/__tests__/publish.integration.test.ts
```

Expected: PASS with unchanged visual behavior.

- [ ] **Step 4: Add existing-store source/delivery bucket selection**

```ts
static async createFromEnvironment(options: {
    configPath?: string;
    environment?: Readonly<Record<string, string | undefined>>;
    bucket?: 'delivery' | 'source';
} = {}): Promise<R2DeliveryStore> {
    // ...load existing config/credentials...
    return new R2DeliveryStore({
        bucket: config.buckets[options.bucket ?? 'delivery'],
        client,
    });
}
```

No second S3 client class.

- [ ] **Step 5: Add only the two audio pointer grammars to the store allowlist**

Accept:

```text
vn/audio/stories/<storyId>/current.json
vn/previews/<previewId>/audio/stories/<storyId>/current.json
```

Continue rejecting arbitrary `current.json` paths.

- [ ] **Step 6: Extend existing immutable cache rule 1**

Change only its predicate:

```ts
'(starts_with(http.request.uri.path, "/vn/objects/") or starts_with(http.request.uri.path, "/vn/audio/objects/") or ends_with(http.request.uri.path, "/runtime-manifest.json"))'
```

Keep the rule count at two and pointer bypass rule unchanged.

- [ ] **Step 7: Add the missing infra typecheck script**

```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 8: Run focused/full checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/immutable-candidate.test.ts src/publisher/__tests__/r2-delivery-store.test.ts src/__tests__/rules.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/immutable-candidate.ts packages/infra-cloudflare/src/publisher/__tests__/immutable-candidate.test.ts packages/infra-cloudflare/src/publisher/publication-plan.ts packages/infra-cloudflare/src/publisher/publish.ts packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts packages/infra-cloudflare/src/rules.ts packages/infra-cloudflare/src/__tests__/rules.test.ts packages/infra-cloudflare/package.json
git commit -m "refactor: share immutable publication primitives"
```

---

### Task 4: Validate selections, omissions, coverage, and source-archive candidates

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

export function sourceArchiveCandidates(
    plan: AudioSourcePlan
): readonly Omit<PlannedImmutableCandidate, 'status'>[];
```

- [ ] **Step 1: Create a valid temp HPA-608 fixture test**

Write one verified candidate + receipt + matching `selection.json`, compile one use of the same key, and assert one included source/coverage row.

- [ ] **Step 2: Add rejection tests before implementation**

One mutation per test:

- selection story mismatch;
- stale selection `specSha256` after current plan/spec change;
- bad `sourceSha256`;
- missing/tampered candidate or receipt;
- compiler-used key neither selected nor omitted;
- same key selected and omitted;
- omission for unknown or compiler-unused key;
- empty omission reason.

Also prove selected-but-unused and plan-unused keys are warnings/report data and never appear in `sources`.

- [ ] **Step 3: Run and verify failure**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts
```

- [ ] **Step 4: Implement strict omissions parsing**

Use `.strict()` and current audio key validation. Normalize each reason with `trim`, require `1..500` chars. Missing file means no omissions for the requested story.

- [ ] **Step 5: Load only supported stories package subpaths**

```ts
import { loadAudioPublishingContext } from '@aquila/stories/audio-publishing';
import {
    AudioSelectionFileV1Schema,
    LocalAudioGenerationStore,
    buildAudioGenerationSpec,
    audioGenerationSpecSha256,
} from '@aquila/stories/audio-generation';
```

Require `context.storyId === expectedStoryId` before opening candidate bytes.

- [ ] **Step 6: Verify each compiler-used selection against current spec + actual bytes**

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

Read the exact existing `candidate-NNN.receipt.json` bytes for archival; do not reconstruct receipt JSON.

- [ ] **Step 7: Build deterministic coverage and archive candidates**

Sort coverage by `${type}:${key}`. Archive keys:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<safe-ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

Archive candidate metadata:

```ts
{
    kind: 'source',
    contentType: sourceMediaType | 'application/json',
    cacheControl: 'private, max-age=0, no-store',
}
```

Do not publish here; Task 8 owns writes.

- [ ] **Step 8: Run focused checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-source.test.ts
git add packages/infra-cloudflare/src/publisher/audio-source.ts packages/infra-cloudflare/src/publisher/__tests__/audio-source.test.ts
git commit -m "feat: validate selected audio sources"
```

---

### Task 5: Normalize and probe runtime MP3 files

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-encoder.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts`

**Interfaces:**

```ts
export interface ProbedAudio {
    readonly codecName: string;
    readonly sampleRate: number;
    readonly durationMs: number;
    readonly bitRate?: number;
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

export async function probeAudioFile(
    path: string,
    run?: AudioProcessRunner
): Promise<ProbedAudio>;

export async function normalizeRuntimeAudio(
    source: PreparedAudioSource,
    options?: { readonly run?: AudioProcessRunner }
): Promise<{
    readonly asset: NormalizedAudioAsset;
    readonly warnings: readonly PublisherDiagnosticV1[];
}>;
```

- [ ] **Step 1: Write exact process-argv tests**

Capture the ffmpeg invocation and require:

```text
-nostdin -hide_banner -loglevel error
-i <input>
-map 0:a:0 -vn -map_metadata -1
-ar 44100 -c:a libmp3lame -b:a 128k
-id3v2_version 0 -write_id3v1 0
<output.mp3>
```

The implementation passes argv directly with no shell interpolation.

- [ ] **Step 2: Write probe/validation failure tests**

Require `PublisherError` for missing executable/process failure, no audio stream, empty output, non-positive/non-finite duration, output codec not `mp3`, output sample rate not `44100`, reported output bitrate not `128000`, SFX over `30000ms`, and BGM over `600000ms`.

- [ ] **Step 3: Add duration-drift warning test**

If measured duration differs from planned by more than `max(500ms, planned * 0.1)`, return a sanitized warning without failing. The warning must not contain a local path or prompt.

- [ ] **Step 4: Run and verify failure**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
```

- [ ] **Step 5: Implement the default child-process runner and `ffprobe` parser**

Use `spawn` or `execFile`, never `shell:true`. Probe:

```text
ffprobe -v error -select_streams a:0 \
  -show_entries stream=codec_name,sample_rate,bit_rate \
  -show_entries format=duration \
  -of json <path>
```

Keep only a short sanitized stderr suffix on process errors.

- [ ] **Step 6: Normalize via a temporary directory and re-probe output**

Write verified source bytes to temp input, run ffmpeg to temp output, read output, then delete the temp directory in `finally`.

- [ ] **Step 7: Hash normalized bytes and derive public path**

```ts
const sha256 = assertSha256<'object-content'>(sha256Hex(outputBytes));
return {
    asset: {
        type: source.type,
        key: source.key,
        bytes: outputBytes,
        sha256,
        path: getAudioObjectPath(sha256),
        byteLength: outputBytes.byteLength,
        durationMs: Math.round(probe.durationMs),
        loop: source.loop,
        contentType: 'audio/mpeg',
    },
    warnings,
};
```

- [ ] **Step 8: Run focused checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-encoder.ts packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts
git commit -m "feat: normalize runtime MP3 audio"
```

---

### Task 6: Build deterministic audio releases and publication plans

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

export interface AudioPublicationPlan {
    readonly sourcePlan: AudioSourcePlan;
    readonly preparedRelease: PreparedAudioRelease;
    readonly objects: readonly PlannedImmutableCandidate[];
    readonly manifest: PlannedImmutableCandidate;
    readonly advisoryPointer: AdvisoryPointerState;
    readonly report: PublisherReportV1;
}

export async function buildAudioPublicationPlan(
    options: BuildAudioPublicationPlanOptions
): Promise<AudioPublicationPlan>;
```

- [ ] **Step 1: Write deterministic release-id tests**

Feed identical logical assets in different input orders and assert identical sorted manifest, canonical bytes, manifest SHA, and release id. Changing normalized object digest, measured duration, or loop changes the release id.

- [ ] **Step 2: Implement `buildPreparedAudioRelease`**

```ts
const draft = parseRuntimeAudioManifest({
    schemaVersion: 1,
    storyId: input.storyId,
    releaseId: `sha256-${'0'.repeat(64)}`,
    assets: sortedAssets,
});
const releaseContentSha256 = sha256ReleaseContent(
    canonicalAudioReleaseContent(draft)
);
const releaseId = releaseIdFromContentSha256(releaseContentSha256);
const manifest = parseRuntimeAudioManifest({ ...draft, releaseId });
const manifestBytes = new TextEncoder().encode(
    `${canonicalJson(manifest)}\n`
);
const manifestSha256 = sha256ManifestBytes(manifestBytes);
```

Require exact one-to-one agreement between manifest entries and included coverage rows. Omitted rows do not enter the manifest.

- [ ] **Step 3: Write publication-plan tests**

Using an in-memory `DeliveryStore`, assert:

- MP3 candidate metadata is `audio/mpeg` + immutable cache policy;
- manifest is `application/json` + immutable cache policy;
- exact pre-existing objects/manifests become reuse;
- conflicts fail closed;
- production/preview manifest+pointer paths differ while MP3 object paths remain shared;
- advisory read observes only the audio pointer;
- no source/archive/delivery write occurs during `plan`.

- [ ] **Step 4: Implement `buildAudioPublicationPlan`**

Exact order:

```text
prepareAudioSources
normalizeRuntimeAudio for included sources
buildPreparedAudioRelease
inspect each unique MP3 candidate
inspect manifest candidate
inspect/parse advisory audio pointer
build deterministic report/actions
```

Use `getAudioCurrentPointerPath` + `parseAudioActiveReleasePointer` for advisory state.

- [ ] **Step 5: Extend report typing minimally**

Add only optional audio fields:

```ts
media?: 'audio';
audioCoverage?: readonly AudioCoverageEntryV1[];
```

Allow sanitized `sfx:<key>` / `bgm:<key>` identities for audio reports. Existing visual reports without `media` must serialize exactly as before.

- [ ] **Step 6: Run focused/full tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-runtime-release.test.ts src/publisher/__tests__/audio-publication-plan.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-runtime-release.ts packages/infra-cloudflare/src/publisher/audio-publication-plan.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/report.ts packages/infra-cloudflare/src/publisher/__tests__/audio-runtime-release.test.ts packages/infra-cloudflare/src/publisher/__tests__/audio-publication-plan.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat: plan immutable audio releases"
```

---

### Task 7: Deep-verify stored audio releases

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
    readonly pointerCandidate: AudioActiveReleasePointerV1;
    readonly validatePointer: (
        pointer: AudioActiveReleasePointerV1
    ) => void;
}

export async function verifyStoredAudioRelease(
    options: {
        readonly store: DeliveryStore;
        readonly storyId: string;
        readonly target: PublicationTarget;
        readonly releaseId: string;
        readonly depth?: AudioVerificationDepth;
        readonly expectedManifestSha256?: ManifestByteSha256;
        readonly runAudioProcess?: AudioProcessRunner;
    }
): Promise<VerifiedStoredAudioRelease>;

export async function verifyPreparedAudioRelease(input: {
    readonly store: DeliveryStore;
    readonly preparedRelease: PreparedAudioRelease;
    readonly depth?: AudioVerificationDepth;
    readonly runAudioProcess?: AudioProcessRunner;
}): Promise<VerifiedStoredAudioRelease>;
```

- [ ] **Step 1: Write shallow-verification tests**

Reject wrong manifest key/content type/cache control/byte length, invalid JSON/schema, story/release mismatch, non-canonical bytes, wrong expected manifest SHA, release-content identity mismatch, unsafe object reference, and path/hash mismatch. Prove shallow mode never reads/probes MP3 objects.

- [ ] **Step 2: Write deep-verification tests**

Reject wrong MP3 MIME/cache/length/body hash, wrong codec, wrong sample rate, reported bitrate other than `128000`, non-positive duration, and measured duration more than **25 ms** away from manifest `durationMs`.

When two entries reference the same digest/path, assert the object is read/probed only once.

- [ ] **Step 3: Run and verify failure**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-candidate-verifier.test.ts
```

- [ ] **Step 4: Implement shallow manifest verification**

Read exact `getAudioReleaseManifestPath(...)`, require JSON/immutable metadata, parse `RuntimeAudioManifestV1`, recompute canonical release-content digest, verify canonical bytes, and build an audio pointer candidate with the existing pointer wire fields.

- [ ] **Step 5: Implement grouped deep MP3 verification**

For each unique digest/path, read once, verify stored metadata/body digest, write bytes to a temp file, call shared `probeAudioFile`, compare MP3/44.1k/bitrate/duration, then remove temp file in `finally`.

- [ ] **Step 6: Implement prepared-evidence agreement**

`verifyPreparedAudioRelease` calls stored verification with expected manifest SHA, then additionally requires exact manifest bytes/release content SHA and exact agreement with each `NormalizedAudioAsset` carried by the prepared release.

- [ ] **Step 7: Run focused checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-candidate-verifier.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts
git commit -m "feat: verify stored audio releases"
```

---

### Task 8: Publish private archive + public immutables without pointer mutation

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-publish.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts`

**Interfaces:**

```ts
export interface PublishAudioReleaseOptions
    extends BuildAudioPublicationPlanOptions {
    readonly sourceStore: DeliveryStore;
    readonly runAudioProcess?: AudioProcessRunner;
}

export async function publishAudioRelease(
    options: PublishAudioReleaseOptions
): Promise<PublisherReportV1>;
```

- [ ] **Step 1: Write ordering tests first**

Instrument source and delivery stores with a shared call log. Require:

```text
all validation/normalization/planning
source archive create/reuse + read-back
public MP3 create/reuse + read-back
manifest create/reuse + read-back
deep verify
return
```

Force source archive failure and assert zero delivery writes.

- [ ] **Step 2: Write the pointer-mutation regression test**

Instrument `compareAndSwapPointer` and require **zero calls** for both preview and production `publishAudioRelease`, including when an advisory pointer points at an older release.

- [ ] **Step 3: Run and verify failure**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts
```

- [ ] **Step 4: Implement source archive publication with exact reuse checks**

For every `sourceArchiveCandidates(plan.sourcePlan)`:

```ts
const planned = await inspectImmutableCandidate(
    options.sourceStore,
    candidate
);
await publishImmutableCandidate(options.sourceStore, planned);
```

Read-back verification comes from the shared helper.

- [ ] **Step 5: Publish public MP3s + manifest and deep-verify**

```ts
for (const candidate of plan.objects) {
    await publishImmutableCandidate(options.store, candidate);
}
await publishImmutableCandidate(options.store, plan.manifest);
await verifyPreparedAudioRelease({
    store: options.store,
    preparedRelease: plan.preparedRelease,
    depth: 'deep',
    runAudioProcess: options.runAudioProcess,
});
```

There is no activation import/call in `audio-publish.ts`.

- [ ] **Step 6: Return a report with unchanged pointer state**

Report created/reused counts and:

```ts
pointer: {
    ...(plan.advisoryPointer.beforeReleaseId === undefined
        ? {}
        : { beforeReleaseId: plan.advisoryPointer.beforeReleaseId }),
    changed: false,
}
```

Do not invent `afterReleaseId` for an unactivated release.

- [ ] **Step 7: Run focused checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-publish.ts packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts
git commit -m "feat: publish immutable audio releases"
```

---

### Task 9: Reuse activation, release listing, rollback, and reactivation for audio

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/activation.ts`
- Modify: `packages/infra-cloudflare/src/publisher/release-history.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts`

**Interfaces:**

```ts
export type PublisherMedia = 'visual' | 'audio';
```

Add optional `media?: PublisherMedia` to activation/history option types; absence means `visual`.

- [ ] **Step 1: Add audio cases to existing activation tests before implementation**

Using an audio stored-release fixture, prove:

- first activation writes audio pointer only;
- same release is no-op unless `reactivate:true`;
- stale CAS returns conflict;
- override performs the same single fresh verification/read behavior as visual;
- `publishedAt` remains strictly monotonic;
- production confirmation still requires exact story id;
- visual pointer is never touched.

- [ ] **Step 2: Add only verifier/path dispatch to activation**

Keep the CAS algorithm unchanged. Define a common internal verified shape:

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

Select current-pointer path and deep verifier by `options.media ?? 'visual'`. Keep `nextPublishedAt`, confirmation, fresh reads, CAS, conflict override, and result logic shared.

- [ ] **Step 3: Add audio release-history tests**

Under production and preview audio namespaces, prove release discovery, shallow/deep status, invalid manifest classification, active release detection, rollback, and reactivation. Visual listing must ignore audio manifests; audio listing must ignore visual manifests.

- [ ] **Step 4: Add minimal history dispatch**

Keep one listing/rollback algorithm. Add private media-specific selectors:

```ts
manifestPathFor(media, storyId, releaseId, target)
currentPointerPathFor(media, storyId, target)
parseManifestFor(media, bytes)
releaseIdentityValidFor(media, manifest, releaseId)
verifyStoredFor(media, options)
```

Do not add a public adapter registry.

- [ ] **Step 5: Run audio + existing visual tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/activation.test.ts src/publisher/__tests__/release-history.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/activation.ts packages/infra-cloudflare/src/publisher/release-history.ts packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts
git commit -m "feat: activate and rollback audio releases"
```

---

### Task 10: Add `--media audio` CLI dispatch and separate local source/delivery roots

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/cli.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/__tests__/report.test.ts`

**Interfaces:**

```ts
interface BaseParsedCommand {
    readonly media: PublisherMedia;
    // existing fields remain
    readonly storyFolder?: string;
    readonly audioGenerationRoot?: string;
    readonly omissionsPath?: string;
    readonly sourceArchiveStore?: DeliveryStore;
}
```

- [ ] **Step 1: Write visual-default and audio-matrix CLI tests**

Existing commands without `--media` must parse/run as visual.

Valid audio forms:

```text
plan/publish --media audio --story <runtime-id> --story-folder <raw-folder> ...
activate/verify/releases/rollback --media audio --story <runtime-id> ...
```

Reject unknown media, audio plan/publish without story folder, story folder on visual, `mirror-preview --media audio`, audio `publish --reactivate`, audio pointer-mutation flags on publish, and audio-only source flags on release-operation commands.

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

Append concise audio examples to help; do not rewrite existing visual examples.

- [ ] **Step 3: Resolve local audio roots**

For:

```text
--destination local --destination-root .tmp/hpa-609
```

create:

```text
.tmp/hpa-609/delivery
.tmp/hpa-609/source
```

Run existing destination safety checks on both resolved roots and their inputs.

- [ ] **Step 4: Resolve two R2 store instances with the existing implementation**

```ts
const delivery = await R2DeliveryStore.createFromEnvironment({
    bucket: 'delivery',
});
const source = await R2DeliveryStore.createFromEnvironment({
    bucket: 'source',
});
```

Close both in `finally`; preserve the first command error if close also fails.

- [ ] **Step 5: Dispatch audio plan/publish**

`plan` calls `buildAudioPublicationPlan` and creates no source archive store write.

`publish` calls `publishAudioRelease` with both stores and never activates.

- [ ] **Step 6: Dispatch release operations by media**

Pass `media` to activation, verifier, release listing, and rollback. Visual remains default.

- [ ] **Step 7: Test report compatibility**

Audio JSON includes `media:"audio"` + sorted `audioCoverage`. Existing visual snapshots/golden reports remain unchanged when `media` is absent.

- [ ] **Step 8: Run package checks and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/cli.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat: add audio publisher CLI dispatch"
```

---

### Task 11: Document and prove HTTP delivery, cache behavior, range requests, and preview rollback

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

- [ ] **Step 1: Write mocked pointer -> manifest -> MP3 HTTP tests**

Require:

```text
pointer: application/json + no-cache,max-age=0,must-revalidate
manifest: application/json + public,max-age=31536000,immutable
MP3: audio/mpeg + public,max-age=31536000,immutable + exact content-length
Range: 206 + Content-Range bytes 0-1023/<full-length>
```

The fixture MP3 must be **larger than 1,024 bytes**. Verify manifest and MP3 SHA-256 against response bodies.

- [ ] **Step 2: Implement the focused HTTP verifier**

Parse audio pointer/manifest through the runtime contract, fetch one manifest asset, check body hash/length/MIME/cache headers, then request:

```http
Range: bytes=0-1023
```

Require `206`, exactly 1,024 response bytes, and a matching `Content-Range` total length.

- [ ] **Step 3: Add a package script**

```json
"verify:audio": "bun src/publisher/audio-http-smoke.ts"
```

The executable reads base URL + story/preview args; no credentials or receipt data are printed.

- [ ] **Step 4: Update the existing R2 runbook**

Document audio production/preview paths, private archive paths, reuse of current source/delivery buckets/domain/CORS, and the immutable rule change. Explicitly state that code only generates/tests the intended rule; HPA-229 has no rule reconciler.

- [ ] **Step 5: Run mocked smoke + all static verification**

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

Use a tiny fixture candidate store and execute plan -> publish -> deep verify. Confirm no audio `current.json` exists until explicit local `activate --media audio`.

- [ ] **Step 7: Manually edit the existing live immutable cache rule before R2 cache smoke**

In Cloudflare dashboard, edit **`aquila-vn: immutable objects and manifests`** so its expression matches the repository's generated expression including:

```text
starts_with(http.request.uri.path, "/vn/audio/objects/")
```

Keep the existing description, one-year edge TTL, browser TTL respect-origin, strong ETag setting, and pointer bypass rule. Verify there are still exactly **two** Aquila cache rules. Do not create a third rule.

- [ ] **Step 8: Run isolated preview R2 publish + HTTP smoke**

Use a unique preview id such as `hpa-609-smoke-<short-sha>`:

1. record production audio pointer bytes/ETag or absence;
2. `publish --media audio --environment preview --preview-id <id> --destination r2`;
3. `verify --media audio ... --deep`;
4. explicit `activate --media audio ...`;
5. run `verify:audio` through `https://assets.aquila.cwchanap.dev`;
6. repeat the full MP3 GET and require a cache-eligible `cf-cache-status`: `MISS`, `HIT`, `EXPIRED`, or `REVALIDATED`;
7. run the 0-1023 range check;
8. publish/activate a second fixture release;
9. rollback to the first;
10. reactivate the second;
11. compare production audio pointer bytes/ETag to step 1 and require no change.

Record only sanitized command results/headers in the PR or Linear comment; never paste credentials or private receipt contents.

- [ ] **Step 9: Commit**

```bash
git add packages/infra-cloudflare/src/publisher/audio-http-smoke.ts packages/infra-cloudflare/src/publisher/__tests__/audio-http-smoke.test.ts packages/infra-cloudflare/package.json docs/infrastructure/r2-visual-asset-delivery.md
git commit -m "docs: add R2 audio delivery verification"
```

---

## Final Verification

- [ ] Run the complete required suite:

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

- [ ] Confirm no prompt/provider/model/source-path/candidate/receipt data appears in `RuntimeAudioManifestV1`, public custom metadata, or audio publisher JSON reports.
- [ ] Confirm visual publisher paths, schemas, and default CLI behavior are unchanged except internal import movement caused by `immutable-candidate.ts`.
- [ ] Confirm there are exactly two Aquila Cloudflare cache rules and live immutable rule 1 includes `/vn/audio/objects/`.
- [ ] Confirm `audio-publish.ts` has no activation import and audio `publish` has zero `compareAndSwapPointer` call paths.
- [ ] Confirm audio activation/rollback/reactivation can write only `vn/audio/.../current.json` or `vn/previews/<id>/audio/.../current.json`.
- [ ] Confirm HPA-610 can resolve a release using only base URL + audio pointer + audio manifest + MP3 object paths.
