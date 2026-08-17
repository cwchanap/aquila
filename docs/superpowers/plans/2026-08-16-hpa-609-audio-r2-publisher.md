# HPA-609 Audio R2 Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish explicitly selected Aquila SFX/BGM as independently versioned immutable MP3 releases through the existing R2 source/delivery infrastructure, with private archival, deterministic coverage, deep verification, explicit activation, rollback, and range-tested HTTP delivery.

**Architecture:** Keep visual manifests/encoding unchanged. Add audio-specific runtime/source/MP3 modules, reuse `DeliveryStore`, extract only media-neutral immutable create/reuse logic, use one shared pointer-key grammar, and add small visual/audio dispatches inside existing activation/history/public-verification pipelines. Runtime MP3 objects reuse `vn/objects/`; audio manifest/pointer state remains separately namespaced. Audio `publish` writes immutables only and never activates.

**Tech Stack:** TypeScript, Bun, Vitest, Zod, Node child processes, system `ffmpeg`/`ffprobe`, AWS S3 client for Cloudflare R2, existing `@aquila/stories` compiler/runtime/audio-generation modules.

## Global Constraints

- Keep `RuntimeAssetManifestV1`, visual object paths, visual encoder policy, visual pointer paths, and default visual CLI/verifier behavior unchanged.
- Runtime audio v1 is MP3 only: MPEG Layer III, 44.1 kHz, exactly 128000 bit/s, `audio/mpeg`, stripped metadata/artwork.
- Runtime MP3 path is `vn/objects/<sha256>.mp3`; audio manifests/pointers remain under `vn/audio/...` or `vn/previews/<id>/audio/...`.
- Keep `loop` in the v1 wire contract: `sfx => false`, `bgm => true`.
- Production audio `publish` never mutates `current.json`; only explicit `activate --media audio` may do so.
- Keep `R2_PUBLISHER_*` scoped to `aquila-vn-delivery` only. Source archival uses separate `R2_SOURCE_ARCHIVE_*` credentials scoped only to `aquila-vn-source`.
- Reuse the existing two Cloudflare cache rules unchanged.
- Public audio manifest/object metadata/reports contain no prompt, provider/model/request id, candidate id, receipt, source path, compiler usage path, or local absolute path.
- Compiler-used cues must be selected or explicitly omitted with a non-empty reason; there is no `--allow-missing` mode.
- Selected-but-unused cues are warnings and are not uploaded.
- System `ffmpeg` and `ffprobe` are publisher prerequisites; tests inject the process runner.
- Do not add a generic media adapter/plugin framework, second S3 client implementation, database, daemon, Worker, queue, multiple runtime codecs, loudness mastering, or loop editing.

---

## Risks

### Source archive credential

The current live `R2_PUBLISHER_*` token is delivery-only. Use a second Object Read & Write token scoped only to `aquila-vn-source`; widening the delivery token is not an allowed fallback.

### Local audio tooling

`ffmpeg`/`ffprobe` are external prerequisites. Audio publish must fail configuration before writes when either is unavailable.

### CDN range/cache behavior

Unit tests cannot prove live R2/custom-domain Range behavior. The final preview smoke must run the existing public verifier in audio mode, including the pointer edge-bypass check, manifest cache check, a real 206 Range response, and exact 404s for private archive keys.

---

### Task 1: Add the audio runtime contract, reuse generic integrity helpers, and centralize pointer grammar

**Files:**
- Create: `packages/stories/src/runtime-assets/audio.ts`
- Modify: `packages/stories/src/runtime-assets/paths.ts`
- Modify: `packages/stories/src/runtime-assets/canonical.ts`
- Modify: `packages/stories/src/runtime-assets/validation.ts`
- Modify: `packages/stories/src/runtime-assets/index.ts`
- Test: `packages/stories/src/runtime-assets/__tests__/audio.test.ts`
- Modify/Test: existing canonical/validation/path tests as needed

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

export function isRuntimePointerKey(key: string): boolean;

export function parseRuntimeAudioManifest(
    input: unknown
): RuntimeAudioManifestV1;

export function canonicalAudioReleaseContent(
    manifest: RuntimeAudioManifestV1
): string;

export function parseAudioActiveReleasePointer(
    input: unknown,
    target: PublicationTarget,
    expectedStoryId: string
): ActiveReleasePointerV1;
```

Widen existing helpers; do **not** add audio twins:

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

- [ ] **Step 1: Write failing path + pointer-key tests**

Require exact paths:

```ts
expect(getAudioObjectPath(digest)).toBe(`vn/objects/${digest}.mp3`);
expect(getAudioReleaseManifestPath('demo_story', releaseId, { kind: 'production' }))
    .toBe(`vn/audio/stories/demo_story/releases/${releaseId}/runtime-manifest.json`);
expect(getAudioCurrentPointerPath('demo_story', {
    kind: 'preview', previewId: 'gate-1',
})).toBe('vn/previews/gate-1/audio/stories/demo_story/current.json');
```

`isRuntimePointerKey` must accept exactly these four grammar families:

```text
vn/stories/<story>/current.json
vn/previews/<preview>/stories/<story>/current.json
vn/audio/stories/<story>/current.json
vn/previews/<preview>/audio/stories/<story>/current.json
```

Reject malformed story/preview ids, extra/missing segments, and arbitrary `current.json` paths.

- [ ] **Step 2: Write failing audio schema tests**

Use one valid SFX and one valid BGM. Separately reject duplicate identity, reverse sort order, unsafe key/path, malformed SHA, path/SHA mismatch, zero/negative duration, `sfx + loop:true`, and `bgm + loop:false`.

Assert additive forbidden runtime keys such as `prompt`, `provider`, `sourcePath`, `candidateId`, `receipt`, `credential`, `token`, and `apiKey` are rejected.

- [ ] **Step 3: Write structural-helper regression tests**

Call existing `assertReleaseIdMatchesContentSha256` with a minimal `{ releaseId }` object and existing `validatePointerManifestPair` with a minimal `{ storyId, releaseId }` manifest-shaped object. Existing visual tests must remain unchanged.

- [ ] **Step 4: Run focused tests and confirm failure**

```bash
bun --filter @aquila/stories test -- src/runtime-assets/__tests__/audio.test.ts
```

- [ ] **Step 5: Implement audio paths + one shared pointer predicate**

`getAudioObjectPath` returns `vn/objects/<digest>.mp3`; visual `getObjectPath` stays unchanged.

Build `isRuntimePointerKey` from exact segment grammar and existing `isStoryId`/`isPreviewId`; do not put a media switch into the stores.

- [ ] **Step 6: Implement audio schema/canonical/pointer parsing**

Canonical release content is:

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

`parseAudioActiveReleasePointer` parses the existing pointer fields and then requires `manifestPath === getAudioReleaseManifestPath(...)`.

- [ ] **Step 7: Widen the two existing integrity helper signatures**

Change parameter types only; keep runtime behavior/error taxonomy and visual call sites intact.

- [ ] **Step 8: Export runtime-safe symbols and run regression**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
git add packages/stories/src/runtime-assets
git commit -m "feat: add runtime audio release contract"
```

---

### Task 2: Reuse named-story compilation and complete the HPA-608 handoff

**Files:**
- Create: `packages/stories/src/compiler/compile-named-story.ts`
- Modify: `packages/stories/src/compiler/cli.ts`
- Modify: `packages/stories/src/audio-generation/index.ts`
- Create: `packages/stories/src/audio-publishing.ts`
- Modify: `packages/stories/package.json`
- Test: `packages/stories/src/compiler/__tests__/compile-named-story.test.ts`
- Test: `packages/stories/src/compiler/__tests__/audio-publishing.test.ts`
- Test: `packages/stories/src/audio-generation/__tests__/index.test.ts`

**Interfaces:**

```ts
export async function compileNamedStory(
    storyFolder: string,
    writeOutputs: boolean
): Promise<StoryIR>;

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

- [ ] **Step 1: Extract the current CLI helper under test**

Move the existing `compileNamedStory` behavior from `compiler/cli.ts` into `compile-named-story.ts`. It owns the real generated output + choices paths. The CLI imports it.

Regression test: `compileNamedStory(name, false)` compiles without creating generated/choices output; `true` keeps existing CLI output paths.

- [ ] **Step 2: Add supported HPA-608 export test**

Import `buildAudioGenerationSpec` and `audioGenerationSpecSha256` through `@aquila/stories/audio-generation`; prove a duration change changes the hash.

- [ ] **Step 3: Add real audio-publishing context test**

Create a temp raw-story fixture with compiler config, characters, one SFX scene, and `docs/audio-plan.json`. Assert runtime story id and usage count.

- [ ] **Step 4: Implement `loadAudioPublishingContext` using `compileNamedStory(..., false)`**

Do not pass fake `.unused-*` output paths. Load the plan and build usage from the returned `StoryIR`.

- [ ] **Step 5: Add the Node-only subpath**

```json
"./audio-publishing": "./src/audio-publishing.ts"
```

Do not export it from `src/index.ts`.

- [ ] **Step 6: Run package checks and commit**

```bash
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
git add packages/stories/src/compiler/compile-named-story.ts packages/stories/src/compiler/cli.ts packages/stories/src/audio-generation/index.ts packages/stories/src/audio-publishing.ts packages/stories/package.json packages/stories/src/compiler/__tests__ packages/stories/src/audio-generation/__tests__/index.test.ts
git commit -m "feat: expose audio publishing inputs"
```

---

### Task 3: Extract immutable operations and extend existing stores with isolated credentials

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/immutable-candidate.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/immutable-candidate.test.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publication-plan.ts`
- Modify: `packages/infra-cloudflare/src/publisher/publish.ts`
- Modify: `packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts`
- Modify: `packages/infra-cloudflare/src/publisher/stores/local-delivery-store.ts`
- Modify: both store tests
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

`R2DeliveryStore.createFromEnvironment` keeps one class but selects bucket + credentials together:

```ts
static async createFromEnvironment(options: {
    configPath?: string;
    environment?: Readonly<Record<string, string | undefined>>;
    bucket?: 'delivery' | 'source';
} = {}): Promise<R2DeliveryStore>;
```

- [ ] **Step 1: Write immutable helper tests from current visual behavior**

Cover absent → create, exact metadata/bytes → reuse, metadata conflict, byte conflict, create race + exact read-back, and read-back mismatch. Include `kind:'source'` to prove no image assumptions.

- [ ] **Step 2: Extract only generic immutable logic**

Move destination inspection/create/read-back logic out of visual plan/publish. Do not move coverage, encoder, pointer, or report code.

- [ ] **Step 3: Prove visual plan/publish remains green**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/immutable-candidate.test.ts src/publisher/__tests__/publication-plan.test.ts src/publisher/__tests__/publish.integration.test.ts
```

- [ ] **Step 4: Write credential-scope tests**

Require delivery factory with only `R2_PUBLISHER_*`, source factory with only `R2_SOURCE_ARCHIVE_*`, cross-pair failure, and correct configured bucket selection.

- [ ] **Step 5: Implement bucket-specific credential selection**

Source uses only `R2_SOURCE_ARCHIVE_ACCESS_KEY_ID` / `R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY`; delivery retains current publisher variables.

- [ ] **Step 6: Replace both store-local pointer grammars with `isRuntimePointerKey`**

`LocalDeliveryStore.assertPointerKey` and `R2DeliveryStore.assertPointerKey` call the runtime-assets predicate after their own safe-key validation. Add positive audio + existing visual and negative arbitrary-key tests to both stores.

- [ ] **Step 7: Add infra typecheck + blank env placeholders**

```json
"typecheck": "tsc --noEmit"
```

```text
R2_SOURCE_ARCHIVE_ACCESS_KEY_ID=
R2_SOURCE_ARCHIVE_SECRET_ACCESS_KEY=
```

- [ ] **Step 8: Run full infra regression and commit**

```bash
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher packages/infra-cloudflare/package.json .env.example
git commit -m "refactor: share immutable publication primitives"
```

---

### Task 4: Validate selections, omissions, coverage, and private archive candidates

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
```

- [ ] **Step 1: Build a valid HPA-608 handoff fixture**

Write verified candidate/receipt/selection data and one compiler usage. Assert the included coverage row contains only type/key/usageCount/disposition — no candidate/source/receipt fields.

- [ ] **Step 2: Add rejection tests**

One mutation each: story mismatch, stale spec hash, bad source digest, missing/tampered candidate/receipt, used key neither selected nor omitted, selected+omitted, unknown/unused omission, empty reason.

Prove selected-but-unused and plan-unused rows are warnings and never enter `sources`.

- [ ] **Step 3: Implement strict omissions parsing and current-spec verification**

Use only supported stories subpaths. For a selected used cue:

```ts
const currentSpecSha256 = audioGenerationSpecSha256(
    buildAudioGenerationSpec(planAsset)
);
if (selection.specSha256 !== currentSpecSha256) throw sourceError(...);
const candidate = await generationStore.readVerifiedCandidate(key, selection.candidateId);
if (candidate === null) throw sourceError(...);
if (candidate.receipt.specSha256 !== currentSpecSha256) throw sourceError(...);
if (sha256Bytes(candidate.bytes) !== selection.sourceSha256) throw sourceError(...);
```

Read exact existing receipt file bytes for archival; do not reconstruct JSON.

- [ ] **Step 4: Build deterministic coverage and archive candidates**

Sort by `${type}:${key}`. Archive keys:

```text
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/source.<safe-ext>
audio/approved/<storyId>/<type>/<key>/<sourceSha256>/receipt.json
```

Use `private, max-age=0, no-store`; do not write storage yet.

- [ ] **Step 5: Run and commit**

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
export interface RuntimeMp3Probe {
    readonly codecName: 'mp3';
    readonly sampleRate: 44100;
    readonly bitRate: 128000;
    readonly durationMs: number;
}

export type AudioProcessRunner = (
    executable: 'ffmpeg' | 'ffprobe',
    args: readonly string[]
) => Promise<{
    exitCode: number;
    stdout: Uint8Array;
    stderr: string;
}>;

export async function probeRuntimeMp3File(
    path: string,
    run?: AudioProcessRunner
): Promise<RuntimeMp3Probe>;
```

- [ ] **Step 1: Test exact ffmpeg argv**

Require direct argv equivalent to:

```text
-nostdin -hide_banner -loglevel error
-i <input> -map 0:a:0 -vn -map_metadata -1
-ar 44100 -c:a libmp3lame -b:a 128k
-id3v2_version 0 -write_id3v1 0
<output.mp3>
```

Never `shell:true`.

- [ ] **Step 2: Test strict probe failures**

Reject missing executable/process failure/no audio/empty output/non-positive duration/wrong codec/wrong sample rate/**missing bitrate**/non-128000 bitrate/SFX >30s/BGM >600s.

- [ ] **Step 3: Test sanitized duration warning**

Material plan-vs-measured duration drift warns but does not fail and contains no prompt/path.

- [ ] **Step 4: Implement source probe + normalization + shared strict runtime parser**

Probe source for readable audio only. Normalize to a temp output, then call `probeRuntimeMp3File` on the normalized result. The same function will be reused by stored deep verification.

- [ ] **Step 5: Hash bytes and produce normalized asset**

```ts
const sha256 = assertSha256<'object-content'>(sha256Hex(bytes));
return {
    type: source.type,
    key: source.key,
    bytes,
    sha256,
    path: getAudioObjectPath(sha256),
    byteLength: bytes.byteLength,
    durationMs: Math.round(probe.durationMs),
    loop: source.loop,
    contentType: 'audio/mpeg',
};
```

- [ ] **Step 6: Run/typecheck/commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-encoder.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-encoder.ts packages/infra-cloudflare/src/publisher/__tests__/audio-encoder.test.ts
git commit -m "feat: normalize runtime MP3 audio"
```

---

### Task 6: Build deterministic audio releases, publication plans, and sanitized reports

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-runtime-release.ts`
- Create: `packages/infra-cloudflare/src/publisher/audio-publication-plan.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: `packages/infra-cloudflare/src/publisher/report.ts`
- Test: audio runtime/publication/report tests

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
```

`PublisherReportV1` gains optional audio-only fields:

```ts
media?: 'audio';
audioCoverage?: readonly AudioCoverageEntryV1[];
```

Visual output does not gain `media:'visual'`.

- [ ] **Step 1: Test deterministic canonical release identity**

Same normalized inputs in different input order produce byte-identical sorted manifest/release id. Changing runtime bytes/duration/loop changes the release id.

- [ ] **Step 2: Build manifest with shared release-id helper**

Hash `canonicalAudioReleaseContent`, derive release id, then call the structurally widened `assertReleaseIdMatchesContentSha256` — no audio copy.

- [ ] **Step 3: Test publication candidate create/reuse/conflict**

MP3 candidate uses `vn/objects/<sha>.mp3`, `audio/mpeg`, immutable cache control; manifest uses audio release path and JSON/immutable metadata.

- [ ] **Step 4: Add audio pointer advisory read using the audio parser**

Planning may inspect current pointer to report activation-needed state, but never writes it.

- [ ] **Step 5: Add report redaction tests with sentinels**

Inject `candidate-999`, `/tmp/SECRET-USAGE-PATH`, a generation root, source filename, and `sourcePath` into internal context. Serialize/render the final audio report and assert none of those strings/fields appear. `audioCoverage` contains only the approved public fields.

- [ ] **Step 6: Run/commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-runtime-release.test.ts src/publisher/__tests__/audio-publication-plan.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-runtime-release.ts packages/infra-cloudflare/src/publisher/audio-publication-plan.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/report.ts packages/infra-cloudflare/src/publisher/__tests__
git commit -m "feat: plan immutable audio releases"
```

---

### Task 7: Deep-verify stored audio releases

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts`

**Interfaces:**

```ts
export interface VerifiedStoredAudioRelease {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly manifest: RuntimeAudioManifestV1;
    readonly manifestBytes: Uint8Array;
    readonly manifestSha256: ManifestByteSha256;
    readonly releaseContentSha256: ReleaseContentSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}
```

- [ ] **Step 1: Test shallow manifest integrity**

Require correct path, JSON MIME, immutable cache metadata, canonical bytes, story/release identity, release digest, and audio pointer candidate.

Use shared `assertReleaseIdMatchesContentSha256` and `validatePointerManifestPair` — no audio copies.

- [ ] **Step 2: Test deep object integrity**

Reject wrong key/MIME/cache control/length/SHA and manifest path/hash mismatch.

- [ ] **Step 3: Reuse `probeRuntimeMp3File`**

Deep verification writes stored bytes to temp file and calls the Task 5 strict parser. Missing bitrate must fail exactly as it does after encoding.

- [ ] **Step 4: Enforce duration tolerance**

```ts
if (Math.abs(probe.durationMs - manifestAsset.durationMs) > 25) {
    throw integrityError(...);
}
```

- [ ] **Step 5: Dedupe shared object digests**

Read/probe each unique MP3 path once, while validating every manifest reference.

- [ ] **Step 6: Run/commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-candidate-verifier.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-candidate-verifier.ts packages/infra-cloudflare/src/publisher/__tests__/audio-candidate-verifier.test.ts
git commit -m "feat: verify stored audio releases"
```

---

### Task 8: Publish archive first, then delivery immutables, with no activation dependency

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/audio-publish.ts`
- Test: `packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts`

- [ ] **Step 1: Test archive failure before public writes**

Source store fails first immutable create. Assert zero delivery `createImmutable` and zero pointer calls.

- [ ] **Step 2: Test exact operation ordering**

Require:

```text
validate -> normalize -> inspect archive -> archive+readback
-> public MP3+readback -> manifest+readback -> deep verify -> return
```

- [ ] **Step 3: Prove exact receipt/source bytes archive privately**

Read source-store archive objects and compare exact bytes. Assert their keys do not exist in delivery.

- [ ] **Step 4: Prove structural no-activation invariant**

`audio-publish.ts` imports no activation module. Configure `compareAndSwapPointer` to throw if called; a successful immutable publish must make zero calls.

- [ ] **Step 5: Implement using shared immutable helpers**

Publish every source archive candidate first. Only after all archive candidates read back exactly, publish MP3 candidates then manifest. Finally call stored audio deep verification.

- [ ] **Step 6: Return pointer unchanged**

`pointer.changed === false`; do not invent `afterReleaseId` for an unactivated release.

- [ ] **Step 7: Run/commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/audio-publish.integration.test.ts
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/audio-publish.ts packages/infra-cloudflare/src/publisher/__tests__/audio-publish.integration.test.ts
git commit -m "feat: publish immutable audio releases"
```

---

### Task 9: Reuse activation, release listing, rollback, and reactivation with complete media dispatch

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/activation.ts`
- Modify: `packages/infra-cloudflare/src/publisher/release-history.ts`
- Modify: activation/history tests

**Interfaces:**

```ts
export type PublisherMedia = 'visual' | 'audio';
```

Add optional `media?: PublisherMedia`; absence means visual.

Internal verified shape:

```ts
interface ActivatableStoredRelease {
    readonly releaseId: string;
    readonly manifestSha256: ManifestByteSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}
```

- [ ] **Step 1: Add second-read activation tests before implementation**

Prove:

- first audio activation writes only audio pointer;
- second activation of same release parses the existing audio pointer and returns no-op;
- `reactivate:true` rewrites audio pointer;
- stale CAS/override paths work after an audio pointer exists;
- rollback after activation parses existing audio pointer;
- visual pointer remains untouched.

These cases must fail if any existing pointer is sent through visual-only `parseActiveReleasePointer`.

- [ ] **Step 2: Add complete activation selectors**

Keep `nextPublishedAt`, CAS, conflict handling, confirmation, and result construction shared. Select **all three** media-sensitive activation operations:

```ts
currentPointerPathFor(media, storyId, target)
parsePointerFor(media, input, target, storyId)
verifyStoredFor(media, options)
```

`readPointer` must call `parsePointerFor`, not hard-code `parseActiveReleasePointer`.

- [ ] **Step 3: Add audio history tests**

Prove production/preview discovery, shallow/deep status, active release detection when an audio pointer exists, invalid pointer warning, rollback, and reactivation. Visual listing ignores audio; audio listing ignores visual.

- [ ] **Step 4: Implement complete history selectors**

```ts
manifestPathFor(media, storyId, releaseId, target)
currentPointerPathFor(media, storyId, target)
parsePointerFor(media, input, target, storyId)
parseManifestFor(media, bytes)
canonicalReleaseContentFor(media, manifest)
releaseIdentityValidFor(media, manifest, releaseId)
verifyStoredFor(media, options)
```

No public adapter registry.

- [ ] **Step 5: Run full infra regression and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/activation.test.ts src/publisher/__tests__/release-history.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/activation.ts packages/infra-cloudflare/src/publisher/release-history.ts packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts
git commit -m "feat: activate and rollback audio releases"
```

---

### Task 10: Add `--media audio` CLI dispatch and explicitly protect local input paths

**Files:**
- Modify: `packages/infra-cloudflare/src/publisher/cli.ts`
- Modify: `packages/infra-cloudflare/src/publisher/types.ts`
- Modify: CLI/report tests

- [ ] **Step 1: Write visual-default + audio command matrix tests**

Valid:

```text
plan/publish --media audio --story <runtime-id> --story-folder <raw-folder> ...
activate/verify/releases/rollback --media audio --story <runtime-id> ...
```

Reject unknown media, missing story folder on audio plan/publish, story folder on visual, `mirror-preview --media audio`, audio `publish --reactivate`, and audio pointer-mutation flags on publish.

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

- [ ] **Step 3: Extend destination safety for additional read-only inputs**

Extend the existing safety helper compatibly:

```ts
async function assertDestinationPathSafety(
    repositoryRoot: string,
    destinationRoot: string,
    sourceRoot: string | undefined,
    releasePlanPath: string | undefined,
    additionalInputPaths: readonly string[] = []
): Promise<void>;
```

For every extra path, canonicalize it and reject either-direction containment with `destinationRoot` using the existing `pathContains` logic.

Audio local plan/publish passes the resolved HPA-608 generation root and, when present, omissions path. Add tests where generation root is inside destination and where destination is inside generation root; both must fail before writes.

- [ ] **Step 4: Resolve local audio stores**

Local publish creates `<destination-root>/delivery` and `<destination-root>/source`; run destination safety on **both** roots with the generation/omissions inputs. Audio plan creates only delivery.

- [ ] **Step 5: Resolve R2 stores with separate credential pairs**

Audio publish creates delivery with `R2_PUBLISHER_*` and source with `R2_SOURCE_ARCHIVE_*`. Audio plan creates delivery only.

- [ ] **Step 6: Add pre-write tool/credential checks**

Before audio publish creates an immutable object, require both credential pairs and runnable `ffmpeg`/`ffprobe`. Missing prerequisites => configuration failure with zero writes.

- [ ] **Step 7: Dispatch services + test report redaction**

Plan → audio publication plan; publish → immutable audio publish; release operations pass `media:'audio'`. Serialize JSON reports containing internal source-path/candidate sentinels and assert they are absent.

- [ ] **Step 8: Run/commit**

```bash
bun --filter @aquila/infra-cloudflare test -- src/publisher/__tests__/cli.test.ts src/publisher/__tests__/report.test.ts
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
git add packages/infra-cloudflare/src/publisher/cli.ts packages/infra-cloudflare/src/publisher/types.ts packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat: add audio publisher CLI dispatch"
```

---

### Task 11: Extend the existing public verifier for audio and Range delivery

**Files:**
- Modify: `packages/infra-cloudflare/src/verify.ts`
- Modify: `packages/infra-cloudflare/src/__tests__/verify.test.ts`
- Modify: `docs/infrastructure/r2-visual-asset-delivery.md`

**Public verifier additions:**

```ts
export type PublicVerifyInput = {
    storyId: string;
    target: PublicationTarget;
    assetBaseUrl: URL;
    browserOrigin?: URL;
    releaseId?: string;
    expectedManifestSha256?: ManifestByteSha256;
    media?: 'visual' | 'audio';
    archiveProbeKeys?: readonly string[];
};
```

CLI adds:

```text
--media visual|audio
--archive-probe-key <safe-relative-key>   # repeatable
```

Visual remains the default/no-arg behavior.

- [ ] **Step 1: Add media parsing tests without changing visual defaults**

No-arg `parseVerifyArgs` remains current visual preview smoke. `--media audio` accepts production/preview active or candidate modes. Reject invalid media and unsafe archive probe keys.

- [ ] **Step 2: Thread media through active pointer resolution**

Select:

```ts
currentPointerPathFor(media, storyId, target)
parsePointerFor(media, body, target, storyId)
manifestPathFor(media, storyId, releaseId, target)
```

Keep existing pointer content-type, revalidation, CORS, and **pointer edge bypass** checks unchanged and mandatory for both media.

- [ ] **Step 3: Thread media through candidate/manifest integrity**

Select manifest parser and canonical content function. Reuse structurally widened `validatePointerManifestPair` and `assertReleaseIdMatchesContentSha256`.

Keep existing manifest MIME/immutable/CORS/edge-cache-eligibility, manifest-byte SHA, release identity, forbidden-key scan, `CheckResult[]`, `--json`, and error/abort behavior.

- [ ] **Step 4: Split only object-reference verification by media**

Visual path keeps current WebP/AVIF loop unchanged.

Audio path iterates every unique manifest MP3 reference and reuses `checkObject`-level semantics for:

```text
path is content addressed
HTTP 200
content-type audio/mpeg
immutable Cache-Control
content-length / body length
SHA-256 body digest
```

Do not make the public HTTP verifier run ffprobe; stored deep verification already owns codec/sample-rate/bitrate decoding. Public verification proves delivery bytes/headers/integrity.

- [ ] **Step 5: Add one audio Range `CheckResult` row**

For the first MP3 larger than 1,024 bytes, request `Range: bytes=0-1023` and require:

```text
HTTP 206
body length 1024
Content-Range: bytes 0-1023/<full-length>
```

Failure is hard, not a warning.

- [ ] **Step 6: Parameterize the existing source-absence check**

Change it to accept a key. Existing visual verification passes `SOURCE_PROBE_KEY`; audio verification loops `archiveProbeKeys`. Only exact 404 passes; 403 fails.

- [ ] **Step 7: Add regression tests proving audio inherits existing hard checks**

At minimum, an audio pointer returning `cf-cache-status:HIT` or any `age` header must fail the same `pointer edge bypass` check. Also test manifest `DYNAMIC` fails cache eligibility, invalid CORS fails, forbidden JSON keys fail, bad SHA fails, range 200 instead of 206 fails, and archive 403 fails.

- [ ] **Step 8: Update runbook without adding another verifier or cache rule**

Document audio paths, source credentials, archive 404 probes, and the command:

```bash
bun --filter @aquila/infra-cloudflare verify -- \
  --media audio \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id <id> \
  --archive-probe-key audio/approved/.../source.mp3 \
  --archive-probe-key audio/approved/.../receipt.json
```

- [ ] **Step 9: Run mocked/static verification**

```bash
bun --filter @aquila/infra-cloudflare test -- src/__tests__/verify.test.ts
bun --filter @aquila/stories test
bun --filter @aquila/stories typecheck
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare typecheck
bun run lint
bun run build
```

- [ ] **Step 10: Run local fixture end-to-end**

Audio plan → publish → deep verify → explicit local activation. Confirm local source/receipt live only in `source/`, public MP3/manifest only in `delivery/`, and second activation reads the existing audio pointer successfully.

- [ ] **Step 11: Preflight live credential separation**

Source credential: source access succeeds, delivery access fails. Delivery credential: delivery access succeeds, source access fails. Do not widen either token.

- [ ] **Step 12: Run isolated preview R2 smoke using the existing verifier**

1. record production audio pointer bytes/ETag or absence;
2. publish preview immutables;
3. deep verify candidate;
4. explicitly activate preview audio;
5. run `verify --media audio` with exact source + receipt archive probe keys;
6. publish/activate a second fixture release;
7. rollback to first;
8. reactivate second;
9. run `verify --media audio` again;
10. require production audio pointer unchanged.

Record only sanitized results/status/header facts.

- [ ] **Step 13: Commit**

```bash
git add packages/infra-cloudflare/src/verify.ts packages/infra-cloudflare/src/__tests__/verify.test.ts docs/infrastructure/r2-visual-asset-delivery.md
git commit -m "feat: verify R2 audio delivery"
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
- [ ] Confirm report-redaction tests include a compiler `sourcePath` sentinel and candidate-id sentinel.
- [ ] Confirm runtime MP3 path is `vn/objects/<sha>.mp3`; `rules.ts` and live Cloudflare rules require no HPA-609 change.
- [ ] Confirm `isRuntimePointerKey` is the one pointer grammar used by both LocalDeliveryStore and R2DeliveryStore.
- [ ] Confirm `R2_PUBLISHER_*` stays delivery-only and source archival uses only `R2_SOURCE_ARCHIVE_*`.
- [ ] Confirm missing runtime `bit_rate` fails both normalized-output and stored deep verification through the same parser.
- [ ] Confirm `audio-publish.ts` imports no activation code and audio publish has zero `compareAndSwapPointer` call paths.
- [ ] Confirm first **and second** audio activation, rollback, history, and reactivation use the audio pointer parser and affect only audio pointer state.
- [ ] Confirm local destination safety rejects overlap with HPA-608 generation root and omissions input.
- [ ] Confirm the existing public verifier in audio mode retains pointer edge-bypass, manifest cache eligibility, CORS, forbidden-key, digest, immutable-header checks, plus the new Range row and exact archive 404 probes.
- [ ] Confirm existing visual publisher/runtime/verifier defaults remain unchanged except internal reusable helper extraction.
- [ ] Confirm HPA-610 can resolve using only base URL + audio pointer + audio manifest + MP3 object paths/metadata.
