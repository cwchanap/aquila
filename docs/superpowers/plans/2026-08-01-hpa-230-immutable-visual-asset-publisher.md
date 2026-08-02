# HPA-230 Immutable Visual Asset Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic visual-asset publisher that plans, encodes, content-addresses, publishes, verifies, mirrors, activates, lists, and rolls back Aquila visual-novel releases without exposing authoring data or performing unsafe pointer writes.

**Architecture:** Extend `@aquila/infra-cloudflare` with a storage-independent publisher core and two `DeliveryStore` adapters: local filesystem and Cloudflare R2. Immutable objects and release manifests are created with preconditions and verified through the selected store; active release changes are isolated to a final compare-and-swap of `current.json`, using a fresh ETag and strictly monotonic `publishedAt`. Production candidates are built once in the production namespace with `--no-activate`, mirrored byte-for-byte to preview for HPA-233, then activated in production without re-reading sources or rerunning Sharp.

**Tech Stack:** Bun, TypeScript, Vitest, Zod, Sharp `0.34.5`, AWS SDK for JavaScript v3 `@aws-sdk/client-s3`, Node.js filesystem/crypto APIs, Cloudflare R2.

**Design specs:**
- `docs/superpowers/specs/2026-08-01-hpa-230-immutable-visual-asset-publisher-design.md`

The accepted third-pass clarifications were consolidated into the primary
design by Task 16; the standalone addendum was then deleted.

## Global Constraints

- **Delivery rule:** HPA-230 remains one Linear ticket and one pull request. Use focused Conventional Commits inside PR #43; do not open a second implementation PR.
- **Execution setup:** Before Task 1, fetch `origin/main`, rebase the HPA-230 branch onto it, and execute in an isolated worktree created with `superpowers:using-git-worktrees`.
- **Inherited contracts:** Import schemas, path helpers, canonicalization, branded digest helpers, coverage validators, activation guard, and cache/dimension policies only from `@aquila/stories/runtime-assets`. Do not copy or fork their logic.
- **Publication layout:** Always use `getObjectPath()`, `getReleaseManifestPath()`, and `getCurrentPointerPath()`. Never hand-build runtime object, manifest, or pointer paths.
- **Encoding policy:** Backgrounds produce WebP and AVIF. Portraits produce alpha-preserving WebP only. Do not emit placeholders in V1.
- **Release invariant:** Every publishable V1 release contains at least one background, so it exposes at least one AVIF object. Empty, all-omitted, and portrait-only included sets fail planning.
- **Dimensions:** `1600×900` and `900×1200` are maximum bounding boxes. `fit: inside` may produce dimensions such as `1599×900`; manifests store actual output dimensions.
- **Aspect diagnostics:** Warn only when relative aspect error exceeds `0.005`. Aggregate repeated warnings deterministically by diagnostic code and asset type.
- **Authoring privacy:** Prompt text, provider metadata, private bucket names, credentials, absolute paths, and raw SDK requests never enter publisher domain objects, reports, runtime manifests, or object metadata.
- **Identity:** Normalize generated logical keys to Unicode NFC before authoring-catalog construction, qualification, duplicate detection, section derivation, or plan comparison. Release-plan keys must already satisfy the HPA-227 NFC contract.
- **Source paths:** Included plan `sourcePath` values must equal generated authoring source paths byte-for-byte. `availableSourcePaths` contains those exact plan-relative strings only.
- **Manifest bytes:** Serialize as `canonicalJson(manifest) + '\n'`. The pointer checksum is the branded SHA-256 of those exact UTF-8 bytes.
- **Immutable writes:** Objects and release manifests use `IfNoneMatch: '*'`. Existing paths are reusable only after exact body and required metadata verification. Never overwrite an immutable path.
- **Pointer writes:** `current.json` is the only mutable runtime object. Use `IfMatch` with a freshly read opaque ETag, or `IfNoneMatch: '*'` when absent. Never issue an unconditional pointer write.
- **Pointer time:** Every generated pointer has `publishedAt` strictly later than the snapshot used for its CAS. `MAX_PUBLISHER_FUTURE_SKEW_MS` is `300_000`.
- **Production gate:** Build a production candidate once with `publish --environment production --no-activate`; mirror exact manifest bytes to preview; gate the preview mirror; activate the retained production release without encoding.
- **Confirmation:** `--confirm-production <storyId>` is required only for production pointer mutation: activating `publish`, `activate`, `rollback`, or `--reactivate`. It is not required for production `--no-activate`, mirroring, verification, or listing.
- **Destination safety:** Omitted `--destination` means `local`; local requires `--destination-root`; R2 rejects `--destination-root`; missing R2 credentials are exit code `1` and never fall back to local.
- **ETags:** Treat R2 ETags as opaque strings and round-trip them exactly. Do not parse, hash, strip, or add quotes.
- **R2 conditionals:** Use typed `PutObjectCommandInput.IfMatch` and `IfNoneMatch`; do not add custom middleware for these headers.
- **Style:** Four-space indentation, single quotes, semicolons, strict TypeScript, existing ESLint/Prettier conventions.
- **Tests:** Follow TDD. Every task writes a failing focused test, confirms the failure, implements the minimum behavior, reruns focused tests, then commits.
- **No production migration:** HPA-230 ships fixture plans and publisher infrastructure only. HPA-231 owns The Seventh Mirror’s production plan and asset classification.

## File Structure

| File | Responsibility |
|---|---|
| `packages/infra-cloudflare/package.json` | Publisher script and runtime dependencies |
| `packages/infra-cloudflare/src/publisher/types.ts` | Store-neutral publisher domain types |
| `packages/infra-cloudflare/src/publisher/errors.ts` | Typed publisher errors and exit-class mapping |
| `packages/infra-cloudflare/src/publisher/hash.ts` | SHA-256 helpers returning HPA-227 branded digests |
| `packages/infra-cloudflare/src/publisher/authoring-catalog.ts` | Generated manifest discovery, NFC reduction, prompt stripping |
| `packages/infra-cloudflare/src/publisher/release-plan.ts` | Plan-path resolution and HPA-227 plan parsing |
| `packages/infra-cloudflare/src/publisher/source-files.ts` | Realpath containment, supported source decoding, exact relative path set |
| `packages/infra-cloudflare/src/publisher/encoder-policy.ts` | Immutable encoder policy, aspect diagnostics, fingerprint |
| `packages/infra-cloudflare/src/publisher/image-encoder.ts` | Deterministic Sharp normalization and variants |
| `packages/infra-cloudflare/src/publisher/runtime-release.ts` | Sorted runtime entries, canonical release ID, exact manifest bytes |
| `packages/infra-cloudflare/src/publisher/stores/delivery-store.ts` | Storage-neutral immutable and CAS interface |
| `packages/infra-cloudflare/src/publisher/stores/local-delivery-store.ts` | Filesystem implementation with atomic pointer CAS |
| `packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts` | R2 implementation with typed conditional inputs |
| `packages/infra-cloudflare/src/publisher/candidate-verifier.ts` | Shallow/deep stored release verification |
| `packages/infra-cloudflare/src/publisher/activation.ts` | Monotonic pointer creation and fresh-snapshot CAS |
| `packages/infra-cloudflare/src/publisher/publication-plan.ts` | Full no-write encode and destination action plan |
| `packages/infra-cloudflare/src/publisher/publish.ts` | Immutable upload, verification, optional activation |
| `packages/infra-cloudflare/src/publisher/mirror-preview.ts` | Production manifest to preview immutable copy |
| `packages/infra-cloudflare/src/publisher/release-history.ts` | Exact release listing and recovery-intent rollback |
| `packages/infra-cloudflare/src/publisher/report.ts` | Versioned report, human output, progress, exit codes |
| `packages/infra-cloudflare/src/publisher/cli.ts` | Argument parsing, destination selection, command dispatch |
| `packages/infra-cloudflare/src/publisher/test-fixtures.ts` | Temporary source images, catalogs, plans, fake stores |
| `packages/infra-cloudflare/src/publisher/__tests__/*.test.ts` | Focused unit and integration coverage |
| `packages/infra-cloudflare/src/seed.ts` | Thin HPA-229 smoke-fixture publisher wrapper |
| `packages/infra-cloudflare/src/publisher/__fixtures__/smoke-release-plan.v1.json` | Explicit two-asset preview classification |
| `.github/workflows/r2-publisher-preview.yml` | Secret-gated production-candidate/preview-mirror integration |
| `.env.example` | Source-root and R2 publisher environment variables |
| `docs/infrastructure/visual-asset-publisher.md` | Operator runbook |
| `docs/infrastructure/r2-visual-asset-delivery.md` | Updated HPA-229 seeding boundary |

---

## Execution Preflight

- [ ] Fetch and rebase the existing HPA-230 branch before code changes:

```bash
git fetch origin
git switch jack65786656/hpa-230-build-aquila-immutable-visual-asset-publisher
git rebase origin/main
```

Expected: the design and plan remain the only HPA-230 changes before
implementation commits begin.

- [ ] Create the isolated worktree required by the execution skill:

```bash
git worktree add ../aquila-hpa-230 \
  jack65786656/hpa-230-build-aquila-immutable-visual-asset-publisher
cd ../aquila-hpa-230
git status --short --branch
```

Expected: clean worktree on the HPA-230 branch.

- [ ] Record the baseline checks before editing:

```bash
bun install
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare lint
bun --filter @aquila/stories test
bun run compile:check
```

Expected: all baseline checks pass. Any pre-existing failure is recorded in the
PR before Task 1 rather than being silently attributed to HPA-230.

---

### Task 1: Publisher package shell, shared types, errors, and branded hashes

**Files:**
- Modify: `packages/infra-cloudflare/package.json`
- Modify: `bun.lock`
- Modify: `.env.example`
- Create: `packages/infra-cloudflare/src/publisher/types.ts`
- Create: `packages/infra-cloudflare/src/publisher/errors.ts`
- Create: `packages/infra-cloudflare/src/publisher/hash.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/hash.test.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/errors.test.ts`

**Interfaces:**
- Consumes: `assertSha256`, digest brands, `PublicationTarget`, and `StoryAssetCoverageReport` from `@aquila/stories/runtime-assets`.
- Produces:
  - `sha256Bytes(bytes): ObjectContentSha256`
  - `sha256ReleaseContent(text): ReleaseContentSha256`
  - `sha256ManifestBytes(bytes): ManifestByteSha256`
  - `PublisherError`, `PublisherErrorCode`, `publisherExitCode(error)`
  - `EncoderFingerprintV1`, `PublicationDestination`, `PublisherProgressEvent`, `PublisherCommandName`

- [ ] **Step 1: Write failing branded-hash tests**

`packages/infra-cloudflare/src/publisher/__tests__/hash.test.ts`:

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    sha256Bytes,
    sha256ManifestBytes,
    sha256ReleaseContent,
} from '../hash';

describe('publisher hash helpers', () => {
    it('returns the exact SHA-256 for object bytes', () => {
        const bytes = Uint8Array.from([1, 2, 3]);
        expect(sha256Bytes(bytes)).toBe(
            createHash('sha256').update(bytes).digest('hex')
        );
    });

    it('brands release content and manifest bytes through separate helpers', () => {
        expect(sha256ReleaseContent('release')).toMatch(/^[0-9a-f]{64}$/);
        expect(sha256ManifestBytes(new TextEncoder().encode('manifest'))).toMatch(
            /^[0-9a-f]{64}$/
        );
    });
});
```

- [ ] **Step 2: Write failing error-to-exit-code tests**

`packages/infra-cloudflare/src/publisher/__tests__/errors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PublisherError, publisherExitCode } from '../errors';

describe('publisherExitCode', () => {
    it.each([
        ['configuration', 1],
        ['coverage', 2],
        ['storage', 3],
        ['concurrency', 4],
        ['activation-target', 5],
        ['clock-skew', 5],
        ['non-monotonic-pointer-time', 5],
    ] as const)('%s maps to %d', (code, expected) => {
        expect(publisherExitCode(new PublisherError(code, 'failure'))).toBe(
            expected
        );
    });
});
```

- [ ] **Step 3: Run focused tests and confirm they fail**

Run:

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/hash.test.ts \
  src/publisher/__tests__/errors.test.ts
```

Expected: FAIL because `../hash` and `../errors` do not exist.

- [ ] **Step 4: Move Sharp to runtime dependencies and add the publisher script**

Update `packages/infra-cloudflare/package.json`:

```json
{
  "scripts": {
    "assets": "bun src/publisher/cli.ts"
  },
  "dependencies": {
    "@aquila/stories": "workspace:*",
    "@aws-sdk/client-s3": "^3.1100.0",
    "sharp": "0.34.5",
    "zod": "^3.24.2"
  }
}
```

Remove `sharp` from `devDependencies`. Preserve the existing `lint`, `test`, `seed`, and `verify` scripts.

Update `.env.example` with:

```dotenv
# Optional local source root used by the immutable visual-asset publisher.
# CLI --source-root takes precedence.
AQUILA_ASSET_SOURCE_ROOT=packages/assets/media

# Scoped write credentials for aquila-vn-delivery.
R2_PUBLISHER_ACCESS_KEY_ID=
R2_PUBLISHER_SECRET_ACCESS_KEY=
```

Run: `bun install`

Expected: `bun.lock` records Sharp as a production dependency without changing its pinned version.

- [ ] **Step 5: Implement domain types and errors**

`packages/infra-cloudflare/src/publisher/types.ts`:

```ts
import type {
    LogicalAssetIdentity,
    ManifestByteSha256,
    ObjectContentSha256,
    PublicationTarget,
    ReleaseContentSha256,
    RuntimeAssetManifestV1,
    StoryAssetCoverageReport,
} from '@aquila/stories/runtime-assets';

export type PublisherCommandName =
    | 'plan'
    | 'publish'
    | 'mirror-preview'
    | 'activate'
    | 'verify'
    | 'releases'
    | 'rollback';

export type PublicationDestination =
    | { kind: 'local'; root: string }
    | { kind: 'r2' };

export interface EncoderFingerprintV1 {
    schemaVersion: 1;
    policyId: 'aquila-vn-encoder-v1';
    sharpVersion: string;
    libvipsVersion: string;
    platform: NodeJS.Platform;
    arch: string;
}

export interface PublisherDiagnosticV1 {
    code: string;
    stage: string;
    message: string;
    assetType?: 'background' | 'portrait';
    identity?: string;
    safePath?: string;
    count?: number;
    sampleIdentities?: string[];
}

export interface PublisherActionV1 {
    stage: string;
    kind:
        | 'include'
        | 'omit'
        | 'reuse-object'
        | 'create-object'
        | 'reuse-manifest'
        | 'create-manifest'
        | 'write-pointer'
        | 'no-op';
    identity?: string;
    key?: string;
}

export interface PublisherCountsV1 {
    included: number;
    omitted: number;
    objectsCreated: number;
    objectsReused: number;
    manifestsCreated: number;
    manifestsReused: number;
    pointersWritten: number;
}

export interface EncodedVariant {
    format: 'webp' | 'avif';
    bytes: Uint8Array;
    sha256: ObjectContentSha256;
    path: string;
    byteLength: number;
    contentType: 'image/webp' | 'image/avif';
}

export interface EncodedAsset {
    identity: LogicalAssetIdentity;
    sourcePath: string;
    authoringSection?: string;
    planSection?: string;
    variants: EncodedVariant[];
    width: number;
    height: number;
    sourceHasAlpha: boolean;
    outputHasAlpha: boolean;
}

export interface PreparedRelease {
    storyId: string;
    target: PublicationTarget;
    releaseId: `sha256-${string}`;
    releaseContentSha256: ReleaseContentSha256;
    manifest: RuntimeAssetManifestV1;
    manifestSha256: ManifestByteSha256;
    manifestBytes: Uint8Array;
    encodedAssets: EncodedAsset[];
    coverage: StoryAssetCoverageReport;
}

export interface PublisherProgressEvent {
    stage:
        | 'input'
        | 'source'
        | 'encode'
        | 'inspect'
        | 'upload'
        | 'verify'
        | 'activate';
    completed: number;
    total: number;
    message: string;
}
```

`packages/infra-cloudflare/src/publisher/errors.ts`:

```ts
export type PublisherErrorCode =
    | 'configuration'
    | 'input'
    | 'coverage'
    | 'source'
    | 'encoding'
    | 'integrity'
    | 'storage'
    | 'concurrency'
    | 'activation-target'
    | 'clock-skew'
    | 'non-monotonic-pointer-time';

export class PublisherError extends Error {
    constructor(
        readonly code: PublisherErrorCode,
        message: string,
        options?: ErrorOptions & { context?: Readonly<Record<string, unknown>> }
    ) {
        super(message, options);
        this.name = 'PublisherError';
        this.context = options?.context ?? {};
    }

    readonly context: Readonly<Record<string, unknown>>;
}

export function publisherExitCode(error: unknown): number {
    if (!(error instanceof PublisherError)) return 3;
    if (error.code === 'configuration') return 1;
    if (
        error.code === 'input' ||
        error.code === 'coverage' ||
        error.code === 'source' ||
        error.code === 'encoding' ||
        error.code === 'integrity'
    ) {
        return 2;
    }
    if (error.code === 'storage') return 3;
    if (error.code === 'concurrency') return 4;
    return 5;
}
```

- [ ] **Step 6: Implement branded SHA-256 helpers**

`packages/infra-cloudflare/src/publisher/hash.ts`:

```ts
import { createHash } from 'node:crypto';
import {
    assertSha256,
    type ManifestByteSha256,
    type ObjectContentSha256,
    type ReleaseContentSha256,
} from '@aquila/stories/runtime-assets';

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function sha256Bytes(bytes: Uint8Array): ObjectContentSha256 {
    return assertSha256<'object-content'>(sha256(bytes));
}

export function sha256ReleaseContent(text: string): ReleaseContentSha256 {
    return assertSha256<'release-content'>(sha256(text));
}

export function sha256ManifestBytes(
    bytes: Uint8Array
): ManifestByteSha256 {
    return assertSha256<'manifest-bytes'>(sha256(bytes));
}
```

- [ ] **Step 7: Run focused and package tests**

Run:

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/hash.test.ts \
  src/publisher/__tests__/errors.test.ts
bun --filter @aquila/infra-cloudflare lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/infra-cloudflare/package.json bun.lock .env.example \
  packages/infra-cloudflare/src/publisher/types.ts \
  packages/infra-cloudflare/src/publisher/errors.ts \
  packages/infra-cloudflare/src/publisher/hash.ts \
  packages/infra-cloudflare/src/publisher/__tests__/hash.test.ts \
  packages/infra-cloudflare/src/publisher/__tests__/errors.test.ts
git commit -m "feat(infra): scaffold visual asset publisher"
```

---

### Task 2: Authoring catalog discovery, NFC reduction, and release-plan resolution

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/authoring-catalog.ts`
- Create: `packages/infra-cloudflare/src/publisher/release-plan.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/authoring-catalog.test.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/release-plan.test.ts`

**Interfaces:**
- Consumes: `AuthoringAssetCatalog`, `parseStoryAssetReleasePlan()`, `qualifyAssetIdentity()`, `isSafeLogicalKey()`.
- Produces:
  - `discoverAuthoringCatalog(repositoryRoot, storyId): Promise<AuthoringAssetCatalog>`
  - `reduceAuthoringManifest(input): AuthoringAssetCatalog`
  - `resolveReleasePlanPath(options): Promise<string>`
  - `loadReleasePlan(path): Promise<StoryAssetReleasePlanV1>`

- [ ] **Step 1: Write failing NFC, prompt-stripping, and collision tests**

```ts
import { describe, expect, it } from 'vitest';
import { reduceAuthoringManifest } from '../authoring-catalog';

describe('reduceAuthoringManifest', () => {
    it('normalizes generated logical keys before catalog construction', () => {
        const result = reduceAuthoringManifest({
            storyId: 'example_story',
            backgrounds: [
                {
                    key: 'chapter_1/cafe\u0301',
                    path: 'example/background.png',
                    prompt: 'private prompt',
                },
            ],
            portraits: [],
        });

        expect(result.assets[0].identity.key).toBe('chapter_1/café');
        expect(result.assets[0]).not.toHaveProperty('prompt');
    });

    it('rejects identities that collide after NFC normalization', () => {
        expect(() =>
            reduceAuthoringManifest({
                storyId: 'example_story',
                backgrounds: [
                    {
                        key: 'chapter_1/café',
                        path: 'a.png',
                        prompt: 'a',
                    },
                    {
                        key: 'chapter_1/cafe\u0301',
                        path: 'b.png',
                        prompt: 'b',
                    },
                ],
                portraits: [],
            })
        ).toThrow(/duplicate.*normalization/i);
    });
});
```

- [ ] **Step 2: Write failing discovery and plan precedence tests**

```ts
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    discoverAuthoringCatalog,
} from '../authoring-catalog';
import { resolveReleasePlanPath } from '../release-plan';

describe('publisher input discovery', () => {
    it('selects by embedded storyId rather than generated directory casing', async () => {
        const root = await mkdtemp(join(tmpdir(), 'catalog-'));
        const generated = join(
            root,
            'packages/stories/src/generated/theSeventhMirror'
        );
        await mkdir(generated, { recursive: true });
        await writeFile(
            join(generated, 'image-assets.json'),
            JSON.stringify({
                storyId: 'the_seventh_mirror',
                backgrounds: [],
                portraits: [],
            })
        );

        await expect(
            discoverAuthoringCatalog(root, 'the_seventh_mirror')
        ).resolves.toMatchObject({ storyId: 'the_seventh_mirror' });
    });

    it('prefers explicit, then preview companion, then production plan', async () => {
        const root = await mkdtemp(join(tmpdir(), 'plans-'));
        const plans = join(root, 'packages/stories/release-plans');
        await mkdir(plans, { recursive: true });
        await writeFile(
            join(plans, 'example_story.json'),
            JSON.stringify({ schemaVersion: 1 })
        );
        await writeFile(
            join(plans, 'example_story.preview.json'),
            JSON.stringify({ schemaVersion: 1 })
        );

        const resolved = await resolveReleasePlanPath({
            repositoryRoot: root,
            storyId: 'example_story',
            target: { kind: 'preview', previewId: 'test' },
        });
        expect(resolved.endsWith('example_story.preview.json')).toBe(true);
    });
});
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/authoring-catalog.test.ts \
  src/publisher/__tests__/release-plan.test.ts
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement generated manifest reduction**

`authoring-catalog.ts` must:

```ts
const normalizedKey = raw.key.normalize('NFC');
if (!isSafeLogicalKey(normalizedKey)) {
    throw new PublisherError('input', 'Generated logical key is unsafe', {
        context: { type, key: normalizedKey },
    });
}
const identity = { type, key: normalizedKey };
const qualified = qualifyAssetIdentity(identity);
if (seen.has(qualified)) {
    throw new PublisherError(
        'input',
        'Duplicate generated identity after NFC normalization',
        { context: { identity: qualified } }
    );
}
```

Use an internal Zod schema containing only `storyId`, `backgrounds[]`, and
`portraits[]`. Reduce each item to `{ identity, sourcePath, section? }`; do not
return or log `prompt`.

Discovery must glob only:

```text
packages/stories/src/generated/*/image-assets.json
```

Parse every candidate and require exactly one embedded `storyId` match. Zero or
multiple matches are `PublisherError('input', ...)`.

- [ ] **Step 5: Implement release-plan resolution and parsing**

`release-plan.ts` resolves:

```ts
export interface ResolveReleasePlanOptions {
    repositoryRoot: string;
    storyId: string;
    target: PublicationTarget;
    explicitPath?: string;
}

export async function resolveReleasePlanPath(
    options: ResolveReleasePlanOptions
): Promise<string>;
```

Precedence:

1. `explicitPath`
2. `<storyId>.preview.json` for preview when present
3. `<storyId>.json`

`loadReleasePlan(path)` parses JSON then calls `parseStoryAssetReleasePlan()`.
A production target must later call `assertActivationAllowed()`; do not
duplicate its channel rule here.

- [ ] **Step 6: Add source-path maintenance test**

Add:

```ts
it('preserves generated sourcePath byte-for-byte', () => {
    const result = reduceAuthoringManifest({
        storyId: 'example_story',
        backgrounds: [
            {
                key: 'chapter_1/bg',
                path: 'Example/Background.PNG',
                prompt: 'private',
            },
        ],
        portraits: [],
    });

    expect(result.assets[0].sourcePath).toBe('Example/Background.PNG');
});
```

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/authoring-catalog.test.ts \
  src/publisher/__tests__/release-plan.test.ts
git add packages/infra-cloudflare/src/publisher/authoring-catalog.ts \
  packages/infra-cloudflare/src/publisher/release-plan.ts \
  packages/infra-cloudflare/src/publisher/__tests__/authoring-catalog.test.ts \
  packages/infra-cloudflare/src/publisher/__tests__/release-plan.test.ts
git commit -m "feat(infra): load publisher catalogs and release plans"
```

---

### Task 3: Source containment, exact available-path keying, and coverage validation

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/source-files.ts`
- Create: `packages/infra-cloudflare/src/publisher/coverage.ts`
- Create: `packages/infra-cloudflare/src/publisher/test-fixtures.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/source-files.test.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/coverage.test.ts`

**Interfaces:**
- Consumes: `AuthoringAssetCatalog`, `StoryAssetReleasePlanV1`, `validateReleaseCoverage()`.
- Produces:
  - `resolveSourceRoot(options): Promise<string>`
  - `resolveIncludedSources(options): Promise<ResolvedSourceSet>`
  - `validatePublisherCoverage(options): StoryAssetCoverageReport`
  - `ResolvedSourceSet.availableSourcePaths: ReadonlySet<string>`

- [ ] **Step 1: Create a reusable temporary fixture builder**

`test-fixtures.ts`:

```ts
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

export async function createSourceFixture(): Promise<{
    root: string;
    sourceRoot: string;
    backgroundPath: string;
    portraitPath: string;
}> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-publisher-'));
    const sourceRoot = join(root, 'media');
    const backgroundPath = 'example/backgrounds/chapter_1/bg.png';
    const portraitPath = 'example/characters/mio/base.png';

    for (const relative of [backgroundPath, portraitPath]) {
        await mkdir(dirname(join(sourceRoot, relative)), { recursive: true });
    }

    await sharp({
        create: {
            width: 1672,
            height: 941,
            channels: 3,
            background: { r: 30, g: 50, b: 70 },
        },
    })
        .png()
        .toFile(join(sourceRoot, backgroundPath));

    await sharp({
        create: {
            width: 1086,
            height: 1448,
            channels: 4,
            background: { r: 120, g: 40, b: 70, alpha: 0.5 },
        },
    })
        .png()
        .toFile(join(sourceRoot, portraitPath));

    return { root, sourceRoot, backgroundPath, portraitPath };
}
```

- [ ] **Step 2: Write failing containment and exact-key tests**

```ts
import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSourceFixture } from '../test-fixtures';
import { resolveIncludedSources } from '../source-files';

describe('resolveIncludedSources', () => {
    it('keys availableSourcePaths by exact plan-relative strings', async () => {
        const fixture = await createSourceFixture();
        const result = await resolveIncludedSources({
            sourceRoot: fixture.sourceRoot,
            includedEntries: [
                {
                    identity: { type: 'background', key: 'chapter_1/bg' },
                    sourcePath: fixture.backgroundPath,
                    section: 'chapter_1',
                },
            ],
        });

        expect([...result.availableSourcePaths]).toEqual([
            fixture.backgroundPath,
        ]);
        expect([...result.availableSourcePaths][0]).not.toContain(
            fixture.sourceRoot
        );
    });

    it('rejects a symlink that escapes the real source root', async () => {
        const fixture = await createSourceFixture();
        const outside = join(fixture.root, 'outside.png');
        await writeFile(outside, 'not inside');
        await symlink(outside, join(fixture.sourceRoot, 'escape.png'));

        await expect(
            resolveIncludedSources({
                sourceRoot: fixture.sourceRoot,
                includedEntries: [
                    {
                        identity: {
                            type: 'background',
                            key: 'chapter_1/escape',
                        },
                        sourcePath: 'escape.png',
                    },
                ],
            })
        ).rejects.toThrow(/outside.*source root/i);
    });
});
```

- [ ] **Step 3: Write failing coverage mismatch and activation-guard tests**

```ts
import { describe, expect, it } from 'vitest';
import { validatePublisherCoverage } from '../coverage';

describe('validatePublisherCoverage', () => {
    it('reports a byte-for-byte source-path mismatch separately', () => {
        expect(() =>
            validatePublisherCoverage({
                catalog: {
                    storyId: 'example_story',
                    assets: [
                        {
                            identity: {
                                type: 'background',
                                key: 'chapter_1/bg',
                            },
                            sourcePath: 'A/bg.png',
                        },
                    ],
                },
                plan: {
                    schemaVersion: 1,
                    storyId: 'example_story',
                    channel: 'production',
                    entries: [
                        {
                            identity: {
                                type: 'background',
                                key: 'chapter_1/bg',
                            },
                            disposition: 'included',
                            sourcePath: 'a/bg.png',
                        },
                    ],
                },
                target: { kind: 'production' },
                availableSourcePaths: new Set(['a/bg.png']),
            })
        ).toThrow(/source-path-mismatch/i);
    });

    it('rejects a preview-channel plan for a production target', () => {
        expect(() =>
            validatePublisherCoverage({
                catalog: { storyId: 'example_story', assets: [] },
                plan: {
                    schemaVersion: 1,
                    storyId: 'example_story',
                    channel: 'preview',
                    entries: [],
                },
                target: { kind: 'production' },
                availableSourcePaths: new Set(),
            })
        ).toThrow();
    });
});
```

- [ ] **Step 4: Run tests and confirm failure**

Run:

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/source-files.test.ts \
  src/publisher/__tests__/coverage.test.ts
```

Expected: FAIL because the modules are missing.

- [ ] **Step 5: Implement source-root precedence and realpath containment**

`resolveSourceRoot()` precedence:

```ts
const selected =
    options.explicitPath ??
    options.environment.AQUILA_ASSET_SOURCE_ROOT ??
    join(options.repositoryRoot, 'packages/assets/media');
return realpath(selected);
```

For every included entry:

```ts
const root = await realpath(sourceRoot);
const joined = resolve(root, entry.sourcePath);
const finalPath = await realpath(joined);
const relative = pathRelative(root, finalPath);

if (
    relative === '' ||
    (!relative.startsWith(`..${sep}`) && relative !== '..')
) {
    // inside root
} else {
    throw new PublisherError('source', 'Source resolves outside source root', {
        context: { sourcePath: entry.sourcePath },
    });
}
```

Require a readable regular file. Inspect Sharp metadata to allow only
single-frame PNG, JPEG, and WebP. Return safe relative paths, bytes, and source
metadata; never return absolute paths in diagnostics.

- [ ] **Step 6: Implement coverage wrapper**

`validatePublisherCoverage()` must call:

```ts
assertActivationAllowed(plan, target);
const report = validateReleaseCoverage(
    catalog,
    plan,
    availableSourcePaths
);
```

Catch the inherited coverage exception only to translate it into
`PublisherError('coverage', ...)` with safe diagnostic codes, including
`coverage/source-path-mismatch`. Do not reinterpret or silently repair path
differences.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/source-files.test.ts \
  src/publisher/__tests__/coverage.test.ts
git add packages/infra-cloudflare/src/publisher/source-files.ts \
  packages/infra-cloudflare/src/publisher/coverage.ts \
  packages/infra-cloudflare/src/publisher/test-fixtures.ts \
  packages/infra-cloudflare/src/publisher/__tests__/source-files.test.ts \
  packages/infra-cloudflare/src/publisher/__tests__/coverage.test.ts
git commit -m "feat(infra): validate publisher sources and coverage"
```

---

### Task 4: Deterministic image encoder, fingerprint, dimensions, and diagnostics

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/encoder-policy.ts`
- Create: `packages/infra-cloudflare/src/publisher/image-encoder.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/image-encoder.test.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/encoder-policy.test.ts`

**Interfaces:**
- Consumes: resolved source bytes/metadata and HPA-227 dimension policy.
- Produces:
  - `ENCODER_POLICY_V1`
  - `getEncoderFingerprint(): EncoderFingerprintV1`
  - `encodeAsset(input): Promise<EncodedAsset>`
  - `evaluateSourceDiagnostics(input): PublisherDiagnosticV1[]`

- [ ] **Step 1: Write failing output-policy tests**

```ts
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createSourceFixture } from '../test-fixtures';
import { encodeAsset } from '../image-encoder';

describe('encodeAsset', () => {
    it('encodes backgrounds as WebP and AVIF inside the maximum box', async () => {
        const fixture = await createSourceFixture();
        const bytes = await Bun.file(
            `${fixture.sourceRoot}/${fixture.backgroundPath}`
        ).bytes();

        const result = await encodeAsset({
            identity: { type: 'background', key: 'chapter_1/bg' },
            sourcePath: fixture.backgroundPath,
            bytes,
        });

        expect(result.variants.map(variant => variant.format)).toEqual([
            'webp',
            'avif',
        ]);
        expect(result.width).toBeLessThanOrEqual(1600);
        expect(result.height).toBeLessThanOrEqual(900);
        expect(result.width).toBe(1599);
        expect(result.height).toBe(900);
    });

    it('encodes portraits as alpha-preserving WebP only', async () => {
        const fixture = await createSourceFixture();
        const bytes = await Bun.file(
            `${fixture.sourceRoot}/${fixture.portraitPath}`
        ).bytes();

        const result = await encodeAsset({
            identity: { type: 'portrait', key: 'mio/base' },
            sourcePath: fixture.portraitPath,
            bytes,
        });

        expect(result.variants.map(variant => variant.format)).toEqual(['webp']);
        expect((await sharp(result.variants[0].bytes).metadata()).hasAlpha).toBe(
            true
        );
        expect(result.width).toBe(900);
        expect(result.height).toBe(1200);
    });
});
```

- [ ] **Step 2: Write failing aspect-tolerance and aggregation tests**

```ts
import { describe, expect, it } from 'vitest';
import {
    aggregateDiagnostics,
    sourceAspectDiagnostic,
} from '../encoder-policy';

describe('source aspect diagnostics', () => {
    it('does not warn for 1672×941', () => {
        expect(
            sourceAspectDiagnostic('background', 1672, 941)
        ).toBeUndefined();
    });

    it('warns above 0.5 percent and aggregates deterministically', () => {
        const warning = sourceAspectDiagnostic('background', 1400, 900);
        expect(warning?.code).toBe('source/aspect-ratio');
        expect(
            aggregateDiagnostics([
                { ...warning!, identity: 'background:b' },
                { ...warning!, identity: 'background:a' },
            ])[0]
        ).toMatchObject({
            count: 2,
            sampleIdentities: ['background:a', 'background:b'],
        });
    });
});
```

- [ ] **Step 3: Run tests and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/image-encoder.test.ts \
  src/publisher/__tests__/encoder-policy.test.ts
```

Expected: FAIL because encoder modules are missing.

- [ ] **Step 4: Implement immutable encoder policy**

`encoder-policy.ts`:

```ts
export const ENCODER_POLICY_V1 = {
    id: 'aquila-vn-encoder-v1',
    aspectWarningRelativeError: 0.005,
    background: {
        width: 1600,
        height: 900,
        formats: ['webp', 'avif'] as const,
    },
    portrait: {
        width: 900,
        height: 1200,
        formats: ['webp'] as const,
    },
    webp: {
        quality: 82,
        alphaQuality: 100,
        effort: 6,
        lossless: false,
        smartSubsample: true,
        preset: 'picture' as const,
    },
    avif: {
        quality: 50,
        effort: 6,
        lossless: false,
        chromaSubsampling: '4:4:4' as const,
    },
} as const;
```

`sourceAspectDiagnostic()` computes:

```ts
const relativeError = Math.abs(actualAspect / preferredAspect - 1);
return relativeError > ENCODER_POLICY_V1.aspectWarningRelativeError
    ? diagnostic
    : undefined;
```

- [ ] **Step 5: Implement Sharp normalization and variants**

`image-encoder.ts` must:

```ts
const base = sharp(input.bytes, {
    failOn: 'warning',
    animated: false,
})
    .rotate()
    .toColourspace('srgb')
    .resize({
        width: maximum.width,
        height: maximum.height,
        fit: 'inside',
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
    });
```

Do not call `withMetadata()`, `keepMetadata()`, or ICC-preserving methods.

Encode each variant from `base.clone()`. Hash exact bytes with `sha256Bytes()`,
derive `getObjectPath()`, and read dimensions from the final WebP bytes.
Background WebP and AVIF dimensions must match. Return actual dimensions and
source/output alpha facts.

`getEncoderFingerprint()` returns:

```ts
{
    schemaVersion: 1,
    policyId: 'aquila-vn-encoder-v1',
    sharpVersion: sharp.versions.sharp,
    libvipsVersion: sharp.versions.vips,
    platform: process.platform,
    arch: process.arch,
}
```

- [ ] **Step 6: Add EXIF orientation and deterministic-byte tests**

Generate a 1200×900 JPEG with orientation `6`, encode it, and assert final
orientation is normalized and output bytes are identical across two calls in
the same toolchain.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/image-encoder.test.ts \
  src/publisher/__tests__/encoder-policy.test.ts
git add packages/infra-cloudflare/src/publisher/encoder-policy.ts \
  packages/infra-cloudflare/src/publisher/image-encoder.ts \
  packages/infra-cloudflare/src/publisher/__tests__/image-encoder.test.ts \
  packages/infra-cloudflare/src/publisher/__tests__/encoder-policy.test.ts
git commit -m "feat(infra): add deterministic visual asset encoder"
```

---

### Task 5: Canonical runtime release builder and section propagation

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/runtime-release.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/runtime-release.test.ts`

**Interfaces:**
- Consumes: encoded assets, release-plan entries, coverage report, HPA-227 canonical helpers.
- Produces:
  - `buildPreparedRelease(input): PreparedRelease`
  - `PreparedRelease.manifest: RuntimeAssetManifestV1`
  - exact canonical `manifestBytes`, `manifestSha256`, and `releaseId`

- [ ] **Step 1: Write failing section precedence and release-ID tests**

```ts
import { describe, expect, it } from 'vitest';
import {
    canonicalReleaseContent,
    qualifyAssetIdentity,
} from '@aquila/stories/runtime-assets';
import { buildPreparedRelease } from '../runtime-release';

describe('buildPreparedRelease', () => {
    it('uses plan section over authoring section and includes it in identity', () => {
        const first = buildPreparedRelease(
            fixtureInput({
                planSection: 'chapter_1',
                authoringSection: 'character_mio',
            })
        );
        const second = buildPreparedRelease(
            fixtureInput({
                planSection: 'chapter_2',
                authoringSection: 'character_mio',
            })
        );

        expect(first.manifest.assets[0].section).toBe('chapter_1');
        expect(first.releaseId).not.toBe(second.releaseId);
    });

    it('sorts by qualified identity and emits one final LF', () => {
        const result = buildPreparedRelease(fixtureInput());
        const identities = result.manifest.assets.map(asset =>
            qualifyAssetIdentity(asset.identity)
        );

        expect(identities).toEqual([...identities].sort());
        expect(new TextDecoder().decode(result.manifestBytes).endsWith('\n')).toBe(
            true
        );
        expect(new TextDecoder().decode(result.manifestBytes).endsWith('\n\n')).toBe(
            false
        );
        expect(canonicalReleaseContent(result.manifest)).not.toContain(
            result.releaseId
        );
    });
});
```

- [ ] **Step 2: Write failing placeholder-draft validation test**

```ts
it('parses the placeholder draft before canonicalization', () => {
    expect(() =>
        buildPreparedRelease(
            fixtureInput({
                mutateDraft: draft => ({
                    ...draft,
                    storyId: 'INVALID STORY',
                }),
            })
        )
    ).toThrow(/validation/i);
});
```

- [ ] **Step 3: Run the focused test and confirm failure**

Run:

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/runtime-release.test.ts
```

Expected: FAIL because `runtime-release.ts` is missing.

- [ ] **Step 4: Implement runtime entry construction**

For each included encoded asset:

```ts
const section = planEntry.section ?? authoringAsset.section;
const entry: RuntimeAssetEntryV1 = {
    identity: encoded.identity,
    variants: buildVariants(encoded.variants),
    width: encoded.width,
    height: encoded.height,
    ...(section === undefined ? {} : { section }),
};
```

Sort with `compareQualifiedAssetIds(qualifyAssetIdentity(...), ...)`.

- [ ] **Step 5: Implement validated placeholder draft and final manifest**

```ts
const draftObject = {
    schemaVersion: 1,
    storyId,
    releaseId: `sha256-${'0'.repeat(64)}`,
    assets,
};

const validatedDraft = parseRuntimeAssetManifest(draftObject);
const releaseContent = canonicalReleaseContent(validatedDraft);
const releaseContentSha256 = sha256ReleaseContent(releaseContent);
const releaseId = releaseIdFromContentSha256(releaseContentSha256);

const manifest = parseRuntimeAssetManifest({
    ...validatedDraft,
    releaseId,
});
assertReleaseIdMatchesContentSha256(manifest, releaseContentSha256);

const manifestBytes = new TextEncoder().encode(
    `${canonicalJson(manifest)}\n`
);
const manifestSha256 = sha256ManifestBytes(manifestBytes);
validateRuntimeManifestCoverage(manifest, releasePlan);
```

No unchecked cast is permitted.

- [ ] **Step 6: Add format and background invariant tests**

Assert:
- every asset has WebP;
- every background has AVIF;
- no portrait has AVIF;
- at least one background exists;
- empty and portrait-only input throws `PublisherError('coverage', ...)`.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/runtime-release.test.ts
git add packages/infra-cloudflare/src/publisher/runtime-release.ts \
  packages/infra-cloudflare/src/publisher/__tests__/runtime-release.test.ts
git commit -m "feat(infra): build canonical visual asset releases"
```

---

### Task 6: DeliveryStore contract and local filesystem adapter

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/stores/delivery-store.ts`
- Create: `packages/infra-cloudflare/src/publisher/stores/local-delivery-store.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/local-delivery-store.test.ts`

**Interfaces:**
- Produces:
  - `DeliveryStore`
  - `StoredObject`, `StoredObjectMetadata`, `PointerSnapshot`
  - `ImmutableCreateRequest`, `PointerWriteRequest`
  - `LocalDeliveryStore`

- [ ] **Step 1: Define the failing local-store behavior tests**

```ts
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalDeliveryStore } from '../stores/local-delivery-store';

describe('LocalDeliveryStore', () => {
    it('creates immutable bytes once and rejects a conflicting second body', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-store-'))
        );
        const first = await store.createImmutable({
            key: 'vn/objects/abc.webp',
            bytes: new TextEncoder().encode('first'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });
        const second = await store.createImmutable({
            key: 'vn/objects/abc.webp',
            bytes: new TextEncoder().encode('second'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });

        expect(first.status).toBe('created');
        expect(second.status).toBe('already-exists');
        await expect(store.read('vn/objects/abc.webp')).resolves.toMatchObject({
            contentType: 'image/webp',
        });
    });

    it('performs pointer CAS under a lock', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-pointer-'))
        );
        const first = await store.compareAndSwapPointer({
            key: 'vn/stories/example/current.json',
            expected: { exists: false },
            bytes: new TextEncoder().encode('A'),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        });
        const stale = await store.compareAndSwapPointer({
            key: 'vn/stories/example/current.json',
            expected: { exists: false },
            bytes: new TextEncoder().encode('B'),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        });

        expect(first.status).toBe('written');
        expect(stale.status).toBe('precondition-failed');
    });
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/local-delivery-store.test.ts
```

Expected: FAIL because the store modules are missing.

- [ ] **Step 3: Implement the store-neutral interface**

`delivery-store.ts`:

```ts
export interface StoredObjectMetadata {
    key: string;
    etag: string;
    byteLength: number;
    contentType: string;
    cacheControl: string;
    customMetadata: Readonly<Record<string, string>>;
}

export interface StoredObject extends StoredObjectMetadata {
    bytes: Uint8Array;
}

export type PointerSnapshot =
    | { exists: false }
    | {
          exists: true;
          etag: string;
          bytes: Uint8Array;
          contentType: string;
          cacheControl: string;
      };

export interface DeliveryStore {
    stat(key: string): Promise<StoredObjectMetadata | null>;
    read(key: string): Promise<StoredObject>;
    createImmutable(
        request: ImmutableCreateRequest
    ): Promise<{ status: 'created' | 'already-exists' }>;
    readPointer(key: string): Promise<PointerSnapshot>;
    compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }>;
    list(prefix: string): AsyncIterable<StoredObjectMetadata>;
    close(): Promise<void>;
}
```

The core interface has no unconditional put.

- [ ] **Step 4: Implement local immutable storage and metadata**

Store body bytes under the exact runtime key. Store adapter-only metadata under:

```text
.publisher-metadata/<sha256-of-key>.json
```

The sidecar contains key, content type, cache control, custom metadata, byte
length, and local ETag. Immutable body creation uses `open(path, 'wx')`.
A partially created body without valid metadata is an integrity failure on read,
not an invitation to overwrite.

- [ ] **Step 5: Implement local pointer CAS**

Use a sibling lock file acquired with exclusive creation. Under the lock:

1. read the current pointer and calculate its local ETag as
   `local-sha256-<body sha256>`;
2. compare against `request.expected`;
3. write body and metadata to unique temporary files;
4. flush and rename them atomically;
5. release the lock in `finally`.

The local ETag remains opaque to callers.

- [ ] **Step 6: Add exact-prefix listing tests**

Create multiple release keys plus `current.json` and assert `list(releasesPrefix)`
returns only keys under that prefix, with pagination-independent ordering left to
the caller.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/local-delivery-store.test.ts
git add packages/infra-cloudflare/src/publisher/stores/delivery-store.ts \
  packages/infra-cloudflare/src/publisher/stores/local-delivery-store.ts \
  packages/infra-cloudflare/src/publisher/__tests__/local-delivery-store.test.ts
git commit -m "feat(infra): add local publisher delivery store"
```

---

### Task 7: Cloudflare R2 adapter with typed conditionals and opaque ETags

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts`
- Modify: `packages/infra-cloudflare/src/config.ts` only if a reusable publisher client factory belongs there

**Interfaces:**
- Consumes: existing `loadR2DeliveryConfig()`, scoped R2 publisher credentials.
- Produces: `R2DeliveryStore.createFromEnvironment()` implementing `DeliveryStore`.

- [ ] **Step 1: Write failing typed-command tests with a fake S3 client**

```ts
import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';
import { R2DeliveryStore } from '../stores/r2-delivery-store';

it('uses typed IfNoneMatch for immutable creation', async () => {
    const sent: unknown[] = [];
    const store = new R2DeliveryStore({
        bucket: 'delivery',
        client: {
            send: async command => {
                sent.push(command);
                return { ETag: '"opaque-etag"' };
            },
            destroy: () => undefined,
        },
    });

    await store.createImmutable({
        key: 'vn/objects/hash.webp',
        bytes: new Uint8Array([1]),
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
    });

    const input = (sent[0] as PutObjectCommand).input;
    expect(input.IfNoneMatch).toBe('*');
    expect(input.IfMatch).toBeUndefined();
});

it('round-trips the exact opaque ETag through IfMatch', async () => {
    const sent: PutObjectCommand[] = [];
    const store = fakeStoreThatCaptures(sent);

    await store.compareAndSwapPointer({
        key: 'vn/stories/example/current.json',
        expected: { exists: true, etag: 'W/"opaque-value"' },
        bytes: new Uint8Array([1]),
        contentType: 'application/json',
        cacheControl: 'no-cache, max-age=0, must-revalidate',
    });

    expect(sent[0].input.IfMatch).toBe('W/"opaque-value"');
});
```

- [ ] **Step 2: Write failing credential and pagination tests**

Assert:
- missing either R2 credential throws `PublisherError('configuration', ...)`;
- no local fallback occurs;
- multiple `ListObjectsV2Command` pages are consumed;
- only exact returned metadata is normalized.

- [ ] **Step 3: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/r2-delivery-store.test.ts
```

Expected: FAIL because the R2 adapter is missing.

- [ ] **Step 4: Implement client construction**

```ts
const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId,
        secretAccessKey,
    },
});
```

Use only the delivery bucket. The adapter never receives source-bucket
credentials.

- [ ] **Step 5: Implement immutable and CAS writes**

Immutable:

```ts
new PutObjectCommand({
    Bucket: bucket,
    Key: request.key,
    Body: request.bytes,
    ContentType: request.contentType,
    CacheControl: request.cacheControl,
    Metadata: request.customMetadata,
    IfNoneMatch: '*',
});
```

Pointer CAS:

```ts
new PutObjectCommand({
    Bucket: bucket,
    Key: request.key,
    Body: request.bytes,
    ContentType: request.contentType,
    CacheControl: request.cacheControl,
    ...(request.expected.exists
        ? { IfMatch: request.expected.etag }
        : { IfNoneMatch: '*' }),
});
```

Map HTTP 412 / `PreconditionFailed` to `precondition-failed`; do not retry it.
Do not attach custom middleware.

- [ ] **Step 6: Implement reads and paginated listing**

Use `HeadObjectCommand`, `GetObjectCommand`, and `ListObjectsV2Command`.
Fully consume body streams into `Uint8Array`. Preserve returned ETag exactly.
Paginate with `ContinuationToken` until `IsTruncated` is false.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/r2-delivery-store.test.ts
git add packages/infra-cloudflare/src/publisher/stores/r2-delivery-store.ts \
  packages/infra-cloudflare/src/publisher/__tests__/r2-delivery-store.test.ts \
  packages/infra-cloudflare/src/config.ts
git commit -m "feat(infra): add R2 publisher delivery store"
```

---

### Task 8: Stored candidate verifier

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/candidate-verifier.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/candidate-verifier.test.ts`

**Interfaces:**
- Consumes: `DeliveryStore`, HPA-227 parsers/path/canonical helpers, Sharp.
- Produces:
  - `verifyStoredRelease(options): Promise<VerifiedStoredRelease>`
  - `verifyPreparedRelease(options): Promise<VerifiedStoredRelease>`
  - `VerificationDepth = 'shallow' | 'deep'`

- [ ] **Step 1: Write failing exact-manifest and object-verification tests**

Create a local store fixture containing a valid prepared release. Assert deep
verification returns the parsed manifest, exact bytes, branded checksum, and
release ID.

Corrupt each of:
- manifest content type;
- manifest cache control;
- manifest body;
- object byte length;
- object digest;
- object content type;
- object cache control;
- decoded dimensions;
- portrait AVIF presence;
- missing background.

Each corruption must fail before activation.

- [ ] **Step 2: Write failing pointer-pair test**

```ts
it('uses validatePointerManifestPair for a candidate pointer', async () => {
    const verified = await verifyStoredRelease(validFixture());
    expect(() =>
        verified.validatePointer({
            ...verified.pointerCandidate,
            manifestSha256: '0'.repeat(64),
        })
    ).toThrow();
});
```

- [ ] **Step 3: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/candidate-verifier.test.ts
```

Expected: FAIL because the verifier is missing.

- [ ] **Step 4: Implement shallow verification**

Shallow verification:

1. derive exact manifest path with `getReleaseManifestPath()`;
2. read body and required metadata;
3. brand exact body digest with `sha256ManifestBytes()`;
4. parse raw JSON with `parseRuntimeAssetManifest()`;
5. derive and brand `canonicalReleaseContent()`;
6. call `assertReleaseIdMatchesContentSha256()`;
7. verify story, target path, release ID, at least one background, and V1 variant policy.

- [ ] **Step 5: Implement deep object verification**

For each unique `(format, sha256)`:
- brand object digest with `assertSha256<'object-content'>()`;
- recompute `getObjectPath()` and compare;
- read body and metadata;
- compare byte length and exact SHA-256;
- decode with Sharp;
- compare actual width/height with every manifest reference;
- require WebP for all, AVIF for backgrounds, no AVIF for portraits.

Deduplicate body reads but validate metadata consistency across all references to
the same content-addressed object.

- [ ] **Step 6: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/candidate-verifier.test.ts
git add packages/infra-cloudflare/src/publisher/candidate-verifier.ts \
  packages/infra-cloudflare/src/publisher/__tests__/candidate-verifier.test.ts
git commit -m "feat(infra): verify stored visual asset candidates"
```

---

### Task 9: Monotonic pointer creation and source-independent activation

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/activation.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts`

**Interfaces:**
- Consumes: `DeliveryStore`, `verifyStoredRelease()`, HPA-227 pointer parser/pair validator.
- Produces:
  - `MAX_PUBLISHER_FUTURE_SKEW_MS = 300_000`
  - `nextPublishedAt(snapshot, nowMs): string`
  - `activateStoredRelease(options): Promise<ActivationResult>`

- [ ] **Step 1: Write failing monotonic time tests**

```ts
import { describe, expect, it } from 'vitest';
import { nextPublishedAt } from '../activation';

describe('nextPublishedAt', () => {
    it('advances one millisecond when the local clock is slightly behind', () => {
        expect(
            nextPublishedAt(
                {
                    exists: true,
                    pointer: {
                        publishedAt: '2026-08-01T20:00:00.100Z',
                    },
                },
                Date.parse('2026-08-01T20:00:00.050Z')
            )
        ).toBe('2026-08-01T20:00:00.101Z');
    });

    it('rejects a pointer more than five minutes ahead', () => {
        expect(() =>
            nextPublishedAt(
                {
                    exists: true,
                    pointer: {
                        publishedAt: '2026-08-01T20:06:00.000Z',
                    },
                },
                Date.parse('2026-08-01T20:00:00.000Z')
            )
        ).toThrow(/clock-skew/i);
    });
});
```

- [ ] **Step 2: Write failing source-independent activation tests**

Use a fake store that throws if authoring, plan, source, or encoder collaborators
are touched. Assert `activateStoredRelease()` deep-verifies the stored target,
reads the pointer immediately before writing, validates the pointer/manifest
pair, and writes only `current.json`.

- [ ] **Step 3: Write failing conflict, override, no-op, and ABA tests**

Tests:
- already active release is no-op;
- `reactivate: true` writes a newer timestamp;
- pointer changes after fresh read → precondition conflict;
- override rereads, deep-verifies again, and attempts one refreshed CAS;
- A→B→A rollback produces different pointer bytes and increasing timestamps.

- [ ] **Step 4: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/activation.test.ts
```

Expected: FAIL because `activation.ts` is missing.

- [ ] **Step 5: Implement monotonic timestamp policy**

```ts
export const MAX_PUBLISHER_FUTURE_SKEW_MS = 300_000;

export function nextPublishedAt(
    snapshot: ParsedPointerSnapshot,
    nowMs: number
): string {
    if (!snapshot.exists) return new Date(nowMs).toISOString();

    const previousMs = Date.parse(snapshot.pointer.publishedAt);
    if (previousMs > nowMs + MAX_PUBLISHER_FUTURE_SKEW_MS) {
        throw new PublisherError('clock-skew', 'Pointer timestamp is too far ahead', {
            context: {
                previousPublishedAt: snapshot.pointer.publishedAt,
                localNow: new Date(nowMs).toISOString(),
            },
        });
    }

    const result = Math.max(nowMs, previousMs + 1);
    if (result <= previousMs) {
        throw new PublisherError(
            'non-monotonic-pointer-time',
            'Pointer timestamp did not advance'
        );
    }
    return new Date(result).toISOString();
}
```

- [ ] **Step 6: Implement activation**

`activateStoredRelease()`:

1. deep-verifies stored release and optional expected manifest checksum;
2. reads and parses the current pointer immediately before mutation;
3. returns no-op when already active and not reactivating;
4. generates monotonic `publishedAt`;
5. builds canonical pointer bytes as `canonicalJson(pointer) + '\n'`;
6. attaches `application/json` and
   `RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl`;
7. calls `validatePointerManifestPair()`;
8. performs CAS with fresh opaque ETag;
9. on conflict, returns conflict unless override is enabled;
10. override performs one new read, one complete deep verification, and one
   refreshed CAS.

Production mutation requires exact `confirmProduction === storyId`.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/activation.test.ts
git add packages/infra-cloudflare/src/publisher/activation.ts \
  packages/infra-cloudflare/src/publisher/__tests__/activation.test.ts
git commit -m "feat(infra): add conditional visual release activation"
```

---

### Task 10: Full no-write publication planner and report model

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/publication-plan.ts`
- Create: `packages/infra-cloudflare/src/publisher/report.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/publication-plan.test.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/report.test.ts`

**Interfaces:**
- Consumes: input loaders, source resolver, coverage, encoder, release builder, store.
- Produces:
  - `buildPublicationPlan(options): Promise<PublicationPlan>`
  - `PublisherReportV1`
  - `renderHumanReport()`, `renderJsonReport()`
  - `ProgressSink`

- [ ] **Step 1: Write failing no-write and deterministic action tests**

Use a spy store whose write methods throw. `buildPublicationPlan()` must:
- resolve and encode every included source;
- inspect objects, release manifest, and advisory pointer;
- produce exact release ID/checksum;
- classify new/reused/conflicting objects;
- never call either write method.

Assert actions and warnings have deterministic order.

- [ ] **Step 2: Write failing plan-delta tests**

Plan once into an empty local destination, materialize the planned files using
test helpers, then:
- unchanged input → all immutable items reusable;
- one changed background → two new objects plus one new manifest;
- one changed portrait → one new object plus one new manifest.

The advisory pointer snapshot reports whether activation would be needed but is
not retained as the final CAS token.

- [ ] **Step 3: Write failing report and progress tests**

`PublisherReportV1.command` includes:
`plan`, `publish`, `mirror-preview`, `activate`, `verify`, `releases`, `rollback`.

Assert:
- status distinguishes `success`, `no-op`, `failed`, and `conflict`;
- exit code `0` covers success and no-op;
- JSON output contains no prompts or absolute paths;
- human progress goes to stderr only;
- repeated aspect warnings aggregate with bounded sorted samples.

- [ ] **Step 4: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/publication-plan.test.ts \
  src/publisher/__tests__/report.test.ts
```

Expected: FAIL because planner/report modules are missing.

- [ ] **Step 5: Implement `PublisherReportV1`**

```ts
export interface PublisherReportV1 {
    schemaVersion: 1;
    command: PublisherCommandName;
    status: 'success' | 'no-op' | 'failed' | 'conflict';
    storyId: string;
    target: PublicationTarget;
    releaseId?: string;
    manifestSha256?: string;
    encoderFingerprint?: EncoderFingerprintV1;
    coverage?: StoryAssetCoverageReport;
    counts: PublisherCountsV1;
    actions: PublisherActionV1[];
    warnings: PublisherDiagnosticV1[];
    errors: PublisherDiagnosticV1[];
    pointer?: {
        beforeReleaseId?: string;
        afterReleaseId?: string;
        changed: boolean;
    };
}
```

- [ ] **Step 6: Implement the planner pipeline**

Exact order:

```text
load catalog and plan
resolve included source files
build exact availableSourcePaths
validate coverage and activation guard
encode included assets
enforce at-least-one-background
build prepared release
inspect each object
inspect immutable manifest
read advisory pointer snapshot
calculate ordered actions, counts, warnings, and activation intent
```

Use a unique temporary workspace and remove it in `finally`. The planner returns
encoded bytes needed by `publish` but performs no writes.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/publication-plan.test.ts \
  src/publisher/__tests__/report.test.ts
git add packages/infra-cloudflare/src/publisher/publication-plan.ts \
  packages/infra-cloudflare/src/publisher/report.ts \
  packages/infra-cloudflare/src/publisher/__tests__/publication-plan.test.ts \
  packages/infra-cloudflare/src/publisher/__tests__/report.test.ts
git commit -m "feat(infra): plan immutable visual asset publications"
```

---

### Task 11: Immutable publication and fresh final CAS

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/publish.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/publish.integration.test.ts`

**Interfaces:**
- Consumes: `PublicationPlan`, `DeliveryStore`, verifier, activation service.
- Produces: `publishRelease(options): Promise<PublisherReportV1>`

- [ ] **Step 1: Write failing first-publication and no-op integration tests**

Against `LocalDeliveryStore`:
- first publish creates objects, verifies them, creates manifest, verifies full
  candidate, and finally writes pointer;
- second unchanged publish performs zero writes and returns `no-op`;
- `noActivate: true` creates/verifies immutable candidate and never creates a
  pointer.

Record filesystem state before/after, not only report status.

- [ ] **Step 2: Write failing immutable race tests**

Simulate another publisher winning object or manifest `IfNoneMatch`:
- identical stored bytes and metadata are verified/reused;
- mismatch fails with pointer unchanged;
- no compensating deletion occurs.

- [ ] **Step 3: Write failing fresh-snapshot tests**

During encoding, change the advisory pointer. After candidate verification:
- `publish` performs a fresh read;
- changed pointer produces conflict before CAS;
- with override, candidate is reverified, another fresh snapshot is taken, and
  exactly one refreshed CAS is attempted;
- a change after the fresh read fails the store precondition.

- [ ] **Step 4: Write failing production-confirmation tests**

Assert:
- production `noActivate: true` succeeds without confirmation when plan channel
  is production;
- production activating publish requires exact story confirmation;
- preview-channel plan targeting production fails through
  `assertActivationAllowed()` before object writes.

- [ ] **Step 5: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/publish.integration.test.ts
```

Expected: FAIL because `publish.ts` is missing.

- [ ] **Step 6: Implement immutable publication order**

```text
create/reuse all objects
read back and verify every object
create/reuse immutable release manifest
deep-verify stored candidate
if --no-activate: stop
fresh-read pointer
detect change from advisory snapshot
activate with monotonic timestamp and fresh CAS
```

Object and manifest requests carry exact D9 content type/cache control.
`createImmutable()` status `already-exists` always triggers verification.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/publish.integration.test.ts
git add packages/infra-cloudflare/src/publisher/publish.ts \
  packages/infra-cloudflare/src/publisher/__tests__/publish.integration.test.ts
git commit -m "feat(infra): publish and activate immutable visual releases"
```

---

### Task 12: Production-candidate preview mirroring

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/mirror-preview.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/mirror-preview.test.ts`

**Interfaces:**
- Consumes: production stored release verifier, `DeliveryStore`.
- Produces:
  - `mirrorProductionReleaseToPreview(options): Promise<PublisherReportV1>`

- [ ] **Step 1: Write failing byte-identical mirror test**

Create a production candidate with `--no-activate`. Call mirror for preview ID
`gate-123`. Assert:
- preview manifest path is derived with HPA-227 helpers;
- preview body bytes equal production body bytes exactly;
- metadata equals production immutable JSON metadata;
- no object bodies are copied;
- neither pointer is written;
- preview deep verification passes.

- [ ] **Step 2: Write failing safety tests**

Assert:
- a preview source target cannot be supplied;
- expected checksum mismatch fails before write;
- existing byte-identical preview manifest is reused;
- existing conflicting body or metadata fails;
- a missing/corrupt production object prevents mirroring.

- [ ] **Step 3: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/mirror-preview.test.ts
```

Expected: FAIL because `mirror-preview.ts` is missing.

- [ ] **Step 4: Implement production-only mirroring**

`mirrorProductionReleaseToPreview()`:

1. deep-verifies `{ kind: 'production' }`;
2. compares optional expected manifest checksum;
3. computes preview path with `{ kind: 'preview', previewId }`;
4. calls `createImmutable()` with exact production manifest bytes and metadata;
5. verifies/reuses identical existing preview manifest;
6. deep-verifies the preview target;
7. returns report with no pointer change.

There is no preview-to-production mirror function.

- [ ] **Step 5: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/mirror-preview.test.ts
git add packages/infra-cloudflare/src/publisher/mirror-preview.ts \
  packages/infra-cloudflare/src/publisher/__tests__/mirror-preview.test.ts
git commit -m "feat(infra): mirror production candidates to preview"
```

---

### Task 13: Release discovery, verification command, and rollback

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/release-history.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts`

**Interfaces:**
- Consumes: exact target prefix, verifier, activation service.
- Produces:
  - `listReleases(options): Promise<ReleaseSummary[]>`
  - `rollbackRelease(options): Promise<PublisherReportV1>`
  - exact key grammar `<releasePrefix><releaseId>/runtime-manifest.json`

- [ ] **Step 1: Write failing exact-key filtering tests**

Seed:
- valid release manifest key;
- `current.json`;
- nested junk;
- doubled-slash key;
- malformed release ID;
- metadata sidecar.

Assert only the exact manifest key whose recomputed
`getReleaseManifestPath()` matches is accepted.

- [ ] **Step 2: Write failing shallow/deep listing tests**

`listReleases({ deep: false })` verifies manifest bytes, identity, structure,
content type, and immutable cache metadata without reading objects.
`deep: true` verifies all referenced objects. Mark active release by parsed
current pointer.

- [ ] **Step 3: Write failing rollback tests**

Assert rollback:
- deep-verifies target;
- reads fresh pointer;
- writes only `current.json`;
- uses monotonic timestamp;
- requires production confirmation for production;
- override rereads and deep-verifies again before one refreshed CAS;
- missing/invalid target is exit class `5`;
- A→B→A pointer bytes remain distinct.

- [ ] **Step 4: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/release-history.test.ts
```

Expected: FAIL because `release-history.ts` is missing.

- [ ] **Step 5: Implement exact prefix and grammar**

Prefixes:

```ts
const releasePrefix =
    target.kind === 'production'
        ? `vn/stories/${storyId}/releases/`
        : `vn/previews/${target.previewId}/stories/${storyId}/releases/`;
```

Accepted key:

```text
<releasePrefix><releaseId>/runtime-manifest.json
```

Extract release ID, validate it, and require
`getReleaseManifestPath(storyId, releaseId, target) === key`.

- [ ] **Step 6: Implement rollback using shared activation**

Use the activation service with `intent: 'rollback'`, deep verification, and no
authoring/plan/source/encoder access. Preserve separate command/report semantics
from candidate activation.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/release-history.test.ts
git add packages/infra-cloudflare/src/publisher/release-history.ts \
  packages/infra-cloudflare/src/publisher/__tests__/release-history.test.ts
git commit -m "feat(infra): list and roll back visual releases"
```

---

### Task 14: CLI parsing, destination safety, and command dispatch

**Files:**
- Create: `packages/infra-cloudflare/src/publisher/cli.ts`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts`

**Interfaces:**
- Consumes: all command services and report renderer.
- Produces: executable `assets` CLI.

- [ ] **Step 1: Write failing destination-default tests**

Using an injected command runner:
- omitted destination chooses local;
- missing local root is configuration error;
- R2 with destination root is configuration error;
- R2 without credentials is configuration error and never constructs local
  store.

- [ ] **Step 2: Write failing command/flag matrix tests**

Command surface:

```text
plan
publish
mirror-preview
activate
verify
releases
rollback
```

Reject:
- `publish --no-activate --reactivate`;
- `publish --no-activate --override-concurrent-pointer`;
- source/plan flags on `activate`, `verify`, `releases`, `rollback`, or
  `mirror-preview`;
- preview command without preview ID where required;
- production pointer mutation without exact confirmation.

Allow:
- production `publish --no-activate` without confirmation;
- `mirror-preview` without production confirmation;
- verify/list without confirmation.

- [ ] **Step 3: Write failing output tests**

Assert:
- `--json` emits exactly one JSON document to stdout;
- diagnostics and progress use stderr;
- secrets and absolute paths are absent;
- no-op exits `0`;
- concurrency exits `4`;
- invalid activation target or clock skew exits `5`.

- [ ] **Step 4: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/cli.test.ts
```

Expected: FAIL because `cli.ts` is missing.

- [ ] **Step 5: Implement parsing with Node `parseArgs`**

Use `node:util` `parseArgs()` and explicit per-command option schemas. Do not add
a CLI dependency.

Dispatch examples:

```ts
switch (command) {
    case 'plan':
        return runPlan(options);
    case 'publish':
        return runPublish(options);
    case 'mirror-preview':
        return runMirrorPreview(options);
    case 'activate':
        return runActivate(options);
    case 'verify':
        return runVerify(options);
    case 'releases':
        return runReleases(options);
    case 'rollback':
        return runRollback(options);
}
```

Instantiate and close the selected store in `try/finally`.

- [ ] **Step 6: Add documented examples to CLI help**

Help must include:
- local plan with explicit root;
- production `--no-activate`;
- production-to-preview mirror with expected checksum;
- preview activation;
- production activation with confirmation;
- release listing and rollback.

- [ ] **Step 7: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/cli.test.ts
bun --filter @aquila/infra-cloudflare lint
git add packages/infra-cloudflare/src/publisher/cli.ts \
  packages/infra-cloudflare/src/publisher/__tests__/cli.test.ts
git commit -m "feat(infra): expose visual asset publisher CLI"
```

---

### Task 15: Replace the duplicate seeder with a publisher fixture client

**Files:**
- Modify: `packages/infra-cloudflare/src/seed.ts`
- Create: `packages/infra-cloudflare/src/publisher/__fixtures__/smoke-release-plan.v1.json`
- Create: `packages/infra-cloudflare/src/publisher/__tests__/seed.test.ts`
- Modify: `packages/infra-cloudflare/package.json`

**Interfaces:**
- Consumes: publisher CLI/service surface.
- Produces: HPA-229-compatible smoke release without duplicate encoding/upload logic.

- [ ] **Step 1: Create explicit smoke preview plan**

The fixture plan includes:
- background `chapter_1/ch1_act2_s0`;
- portrait `asakura_mio/base`;
- exact generated source paths used by the current seeder;
- explicit `section: 'chapter_1'`;
- `channel: 'preview'`.

It contains no prompts.

- [ ] **Step 2: Write failing thin-wrapper test**

Mock the publisher entry point and assert `seed.ts` supplies:
- story `the_seventh_mirror`;
- preview ID `smoke`;
- fixture release-plan path;
- source root `packages/assets/media`;
- destination `r2`;
- activation enabled.

Assert `seed.ts` contains no direct `sharp`, `S3Client`, `PutObjectCommand`,
hashing, canonical manifest, or pointer-building import.

- [ ] **Step 3: Run and confirm failure**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/seed.test.ts
```

Expected: FAIL because the existing seeder still duplicates the pipeline.

- [ ] **Step 4: Rewrite `seed.ts` as a thin invocation**

`seed.ts` should import a callable CLI/service function and pass the fixed smoke
arguments. It may format the final release ID and pointer path, but it must not
encode, hash, upload, or construct runtime documents itself.

- [ ] **Step 5: Run tests and commit**

```bash
bun --filter @aquila/infra-cloudflare test -- \
  src/publisher/__tests__/seed.test.ts
git add packages/infra-cloudflare/src/seed.ts \
  packages/infra-cloudflare/src/publisher/__fixtures__/smoke-release-plan.v1.json \
  packages/infra-cloudflare/src/publisher/__tests__/seed.test.ts \
  packages/infra-cloudflare/package.json
git commit -m "refactor(infra): route smoke seeding through publisher"
```

---

### Task 16: Runbook, gated R2 workflow, design consolidation, and final verification

**Files:**
- Create: `docs/infrastructure/visual-asset-publisher.md`
- Modify: `docs/infrastructure/r2-visual-asset-delivery.md`
- Create: `.github/workflows/r2-publisher-preview.yml`
- Modify: `docs/superpowers/specs/2026-08-01-hpa-230-immutable-visual-asset-publisher-design.md`
- Delete: `docs/superpowers/specs/2026-08-01-hpa-230-third-pass-normative-clarifications.md`
- Modify: `docs/superpowers/plans/2026-08-01-hpa-230-immutable-visual-asset-publisher.md` only for corrections discovered during execution

**Interfaces:**
- Produces: one consolidated approved design, operator workflow, and live evidence.

- [ ] **Step 1: Consolidate the third-pass addendum into the primary design**

Integrate every A1–A14 rule into its corresponding D-section:
- production-first candidate/mirror workflow;
- monotonic timestamp with safe prior-pointer/local-clock JSON diagnostics;
- fresh CAS snapshot;
- typed SDK fields;
- NFC;
- HPA-231 plan/generated-asset/`compile:check` consistency ownership without a
  premature global `compile:check` change;
- exact source paths;
- aspect tolerance;
- confirmation semantics;
- opaque ETags/ABA;
- validated placeholder draft;
- exact listing grammar;
- named tests;
- HPA-233 handoff.

Set the primary design status to:

```text
Approved for implementation
```

Delete the addendum only after a side-by-side checklist confirms no normative
requirement was lost.

- [ ] **Step 2: Write the publisher runbook**

`docs/infrastructure/visual-asset-publisher.md` must contain executable examples.
The production `publish --json` report is saved to `.tmp/publish-report.json`;
subsequent commands export `RELEASE_ID` and `MANIFEST_SHA256` from that report
before using them:

```bash
RELEASE_ID=$(bun -e 'const value = await Bun.file(process.argv[1]).json(); console.log(value.releaseId)' .tmp/publish-report.json)
MANIFEST_SHA256=$(bun -e 'const value = await Bun.file(process.argv[1]).json(); console.log(value.manifestSha256)' .tmp/publish-report.json)

# Local plan
bun --filter @aquila/infra-cloudflare assets -- plan \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id local-check \
  --destination local \
  --destination-root .tmp/aquila-assets

# Production candidate, no active pointer mutation
bun --filter @aquila/infra-cloudflare assets -- publish \
  --story the_seventh_mirror \
  --environment production \
  --destination r2 \
  --no-activate

# Exact production candidate mirrored to preview
bun --filter @aquila/infra-cloudflare assets -- mirror-preview \
  --story the_seventh_mirror \
  --release "$RELEASE_ID" \
  --preview-id hpa-230-gate \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2

# Preview activation
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment preview \
  --preview-id hpa-230-gate \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --destination r2

# Production activation after approval
bun --filter @aquila/infra-cloudflare assets -- activate \
  --story the_seventh_mirror \
  --environment production \
  --release "$RELEASE_ID" \
  --expect-manifest-sha256 "$MANIFEST_SHA256" \
  --confirm-production the_seventh_mirror \
  --destination r2
```

Explain that HPA-231 must create the production plan before The Seventh Mirror
can use the production commands.

- [ ] **Step 3: Update the HPA-229 runbook**

Replace direct seeder implementation details with the thin `seed` wrapper and
publisher responsibilities. Preserve HPA-229 ownership of public CORS/cache
verification.

- [ ] **Step 4: Add the gated preview workflow**

`.github/workflows/r2-publisher-preview.yml`:
- `workflow_dispatch`;
- dedicated preview ID derived from run ID;
- production fixture candidate with `--no-activate`;
- exact manifest mirroring;
- preview activation;
- existing public `verify` command against the pre-existing HPA-229 smoke
  fixture, without seeding or run-scoped claims;
- unchanged rerun/no-op;
- controlled revision candidate;
- stale-advisory conflict through the publisher CLI with exit 4 and zero pointer
  writes;
- source-independent activation;
- rollback;
- assert only preview pointer changes during activation/rollback;
- never write production pointer in this workflow.

Use repository secrets for scoped R2 credentials. Normal pull-request CI remains
credential-free.

- [ ] **Step 5: Run focused package verification**

```bash
bun --filter @aquila/infra-cloudflare test
bun --filter @aquila/infra-cloudflare lint
bun --filter @aquila/stories test
bun run compile:check
```

Expected: all pass.

- [ ] **Step 6: Run repository-wide verification when exports/config changed**

```bash
bun test
bun lint
```

Expected: all pass. If root commands use Turbo filters, run the repository’s
documented equivalents and record exact commands in the PR.

- [ ] **Step 7: Run the gated R2 preview integration**

Trigger `.github/workflows/r2-publisher-preview.yml`. Retain:
- release ID;
- manifest checksum;
- preview ID;
- JSON publisher reports;
- HPA-229 verifier output;
- activation/rollback pointer before/after evidence.

Expected: workflow succeeds without production pointer mutation.

- [ ] **Step 8: Self-review against design and plan**

Check:
- every D-section and A-section maps to a passing named test;
- no prompt/source/provider data appears in public JSON or reports;
- no unconditional `PutObject` path exists;
- no custom conditional middleware remains;
- every pointer mutation uses fresh snapshot, monotonic time, and CAS;
- production candidate is encoded once and preview manifest is byte-identical;
- `assertActivationAllowed()` is directly tested;
- no unresolved implementation markers or vague follow-up text remain;
- types/signatures match this plan.

- [ ] **Step 9: Commit**

```bash
git add docs/infrastructure/visual-asset-publisher.md \
  docs/infrastructure/r2-visual-asset-delivery.md \
  .github/workflows/r2-publisher-preview.yml \
  docs/superpowers/specs/2026-08-01-hpa-230-immutable-visual-asset-publisher-design.md \
  docs/superpowers/specs/2026-08-01-hpa-230-third-pass-normative-clarifications.md \
  docs/superpowers/plans/2026-08-01-hpa-230-immutable-visual-asset-publisher.md
git commit -m "docs(infra): document immutable asset publishing"
```

- [ ] **Step 10: Update PR #43**

Update the draft PR body with:
- implementation summary by task/commit;
- candidate/mirror/activation workflow;
- test commands and results;
- gated workflow link/evidence;
- known HPA-231 prerequisite;
- rollback instructions.

Keep the PR draft until all local and gated checks pass, then mark it ready for
review without opening another PR.
