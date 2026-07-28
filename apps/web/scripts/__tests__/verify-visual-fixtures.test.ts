/**
 * Tests for scripts/verify-visual-fixtures.ts
 *
 * The verifier reads the authoring image-assets catalog, a release plan, the
 * active pointer, the runtime manifest, and every referenced object file, then
 * aggregates problems. We mock `node:fs/promises` (access/readFile) and `sharp`
 * so we can drive each error-handling branch without real fixtures on disk.
 * The `@aquila/stories/runtime-assets` package is used for real — its parsers
 * and validators exercise the actual contract logic.
 */
import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    assertSha256,
    canonicalReleaseContent,
    getObjectPath,
    getReleaseManifestPath,
    releaseIdFromContentSha256,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';

// ─── Stable mock refs (created before vi.mock hoisting) ────────────────────

const mockAccess = vi.fn<(path: string) => Promise<void>>();
const mockReadFile =
    vi.fn<(path: string, encoding?: string) => Promise<string | Buffer>>();

vi.mock('node:fs/promises', () => ({
    access: mockAccess,
    readFile: mockReadFile,
    default: { access: mockAccess, readFile: mockReadFile },
}));

const metadataMock = vi.fn();
const sharpMock = vi.fn();

vi.mock('sharp', () => ({
    default: sharpMock,
}));

// ─── Shared constants matching the script ───────────────────────────────────

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_TARGET = { kind: 'preview', previewId: 'hpa-228-local' } as const;

// The four fixtures the build script encodes. The verifier reads the authoring
// catalog (image-assets.json) and the release plan, both of which list these.
const FIXTURE_IDENTITIES = [
    { type: 'background' as const, key: 'chapter_1/ch1_act2_s0' },
    { type: 'background' as const, key: 'chapter_1/ch1_act2_s1' },
    { type: 'portrait' as const, key: 'asakura_mio/base' },
    { type: 'portrait' as const, key: 'asakura_yuma/base' },
];

const FIXTURE_SOURCE_PATHS = [
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
    'the_seventh_mirror/characters/asakura_mio/base.png',
    'the_seventh_mirror/characters/asakura_yuma/base.png',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

/** The authoring image-assets catalog read from packages/stories. */
function imageAssetsJson() {
    return JSON.stringify({
        storyId: STORY_ID,
        backgrounds: [
            { key: 'chapter_1/ch1_act2_s0', path: FIXTURE_SOURCE_PATHS[0] },
            { key: 'chapter_1/ch1_act2_s1', path: FIXTURE_SOURCE_PATHS[1] },
        ],
        portraits: [
            { key: 'asakura_mio/base', path: FIXTURE_SOURCE_PATHS[2] },
            { key: 'asakura_yuma/base', path: FIXTURE_SOURCE_PATHS[3] },
        ],
    });
}

/** The release plan read from the web app fixtures directory. */
function releasePlanJson() {
    return JSON.stringify({
        schemaVersion: 1,
        storyId: STORY_ID,
        channel: 'preview',
        entries: FIXTURE_IDENTITIES.map((identity, index) => ({
            identity,
            disposition: 'included',
            sourcePath: FIXTURE_SOURCE_PATHS[index],
            section: 'chapter_1',
        })),
    });
}

/**
 * Builds a consistent pointer + manifest + object bytes for the happy path.
 * Returns the manifest text, pointer text, and a map of object path -> buffer.
 */
function buildConsistentRelease() {
    const assets: RuntimeAssetManifestV1['assets'] = [];
    const objectBuffers = new Map<string, Buffer>();

    for (let i = 0; i < FIXTURE_IDENTITIES.length; i++) {
        const buffer = Buffer.from(`webp-bytes-${i}`, 'utf8');
        const objectSha = assertSha256<'object-content'>(sha256(buffer));
        const objectPath = getObjectPath(objectSha, 'webp');
        objectBuffers.set(objectPath, buffer);
        assets.push({
            identity: FIXTURE_IDENTITIES[i],
            variants: {
                webp: {
                    format: 'webp',
                    path: objectPath,
                    sha256: objectSha,
                    byteLength: buffer.byteLength,
                },
            },
            width: 960,
            height: 540,
            section: 'chapter_1',
        });
    }

    // Sort assets by qualified identity (the manifest schema requires this).
    assets.sort((a, b) => {
        const qa = `${a.identity.type}:${a.identity.key}`;
        const qb = `${b.identity.type}:${b.identity.key}`;
        return qa < qb ? -1 : qa > qb ? 1 : 0;
    });

    const draftManifest: RuntimeAssetManifestV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    };
    const releaseId = releaseIdFromContentSha256(
        assertSha256<'release-content'>(
            sha256(canonicalReleaseContent(draftManifest))
        )
    );
    const manifest: RuntimeAssetManifestV1 = { ...draftManifest, releaseId };
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestSha256 = assertSha256<'manifest-bytes'>(sha256(manifestText));
    const manifestPath = getReleaseManifestPath(
        STORY_ID,
        releaseId,
        PREVIEW_TARGET
    );
    const pointerText = `${JSON.stringify(
        {
            schemaVersion: 1,
            storyId: STORY_ID,
            releaseId,
            manifestPath,
            manifestSha256,
            publishedAt: '2026-07-26T00:00:00.000Z',
        },
        null,
        2
    )}\n`;

    return { manifestText, pointerText, objectBuffers, manifestPath };
}

/**
 * Wires `mockReadFile` and `mockAccess` to serve the consistent release so the
 * verifier's happy path proceeds without problems. `overrides` lets a test
 * replace specific file contents to inject faults.
 */
function wireHappyPath(overrides?: {
    imageAssets?: string;
    releasePlan?: string;
    pointerText?: string;
    manifestText?: string;
    objectBytes?: Map<string, Buffer>;
    objectDimensions?: (path: string) => { width: number; height: number };
}) {
    const release = buildConsistentRelease();
    const imageAssets = overrides?.imageAssets ?? imageAssetsJson();
    const releasePlan = overrides?.releasePlan ?? releasePlanJson();
    const pointerText = overrides?.pointerText ?? release.pointerText;
    const manifestText = overrides?.manifestText ?? release.manifestText;
    const objectBytes = overrides?.objectBytes ?? release.objectBuffers;

    mockAccess.mockImplementation(async () => undefined);
    mockReadFile.mockImplementation(async (path: string) => {
        const p = String(path);
        if (p.includes('image-assets.json')) return imageAssets;
        if (p.endsWith('the-seventh-mirror.preview.v1.json'))
            return releasePlan;
        if (p.endsWith('current.json')) return pointerText;
        if (p.endsWith('runtime-manifest.json')) return manifestText;
        // Object file read — the verifier calls readFile without an encoding,
        // so return the raw Buffer (which has byteLength and works with sha256).
        for (const [objectPath, buffer] of objectBytes) {
            if (p.includes(objectPath)) {
                return buffer;
            }
        }
        throw new Error(`Unexpected readFile path: ${p}`);
    });

    // sharp metadata for object dimension checks. The verifier calls
    // sharp(bytes).metadata() and compares to asset.width/height. The bytes
    // are passed to `sharp(bytes)`, so we capture them there and thread them
    // into the metadata call.
    const dims = overrides?.objectDimensions;
    if (dims) {
        sharpMock.mockImplementation((input: unknown) => {
            const content = String(input);
            let resolved = { width: 960, height: 540 };
            for (const [objectPath, buffer] of objectBytes) {
                if (content === buffer.toString('utf8')) {
                    resolved = dims(objectPath);
                    break;
                }
            }
            return {
                metadata: vi.fn(async () => resolved),
            };
        });
    } else {
        sharpMock.mockImplementation(() => ({
            metadata: metadataMock,
        }));
        metadataMock.mockImplementation(async () => {
            // Default: 960x540 matches the consistent release manifest.
            return { width: 960, height: 540 };
        });
    }
}

/** Dynamically (re-)imports the script under test. */
async function importVerify(): Promise<
    typeof import('../verify-visual-fixtures')
> {
    return await import('../verify-visual-fixtures');
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('verify-visual-fixtures', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    it('passes silently when all fixtures are consistent', async () => {
        wireHappyPath();
        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).resolves.toBeUndefined();
    });

    it('reports a problem when validateReleaseCoverage throws (lines 90-91)', async () => {
        // Make the release plan reference an identity absent from the authoring
        // catalog so validateReleaseCoverage throws "Release plan contains
        // identities absent from the authoring manifest".
        const plan = JSON.parse(releasePlanJson());
        plan.entries.push({
            identity: { type: 'portrait', key: 'ghost/unknown' },
            disposition: 'included',
            sourcePath: 'the_seventh_mirror/characters/ghost/unknown.png',
            section: 'chapter_1',
        });
        wireHappyPath({ releasePlan: JSON.stringify(plan) });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /release coverage:/
        );
    });

    it('reports a problem when the pointer cannot be read (lines 112-113)', async () => {
        wireHappyPath();
        // Override the pointer read to throw.
        mockReadFile.mockImplementation(async (path: string) => {
            const p = String(path);
            if (p.includes('image-assets.json')) return imageAssetsJson();
            if (p.endsWith('the-seventh-mirror.preview.v1.json'))
                return releasePlanJson();
            if (p.endsWith('current.json')) {
                throw new Error('pointer missing');
            }
            throw new Error(`Unexpected readFile path: ${p}`);
        });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /release documents:/
        );
    });

    it('reports a problem when the manifest read fails (lines 112-113)', async () => {
        const release = buildConsistentRelease();
        wireHappyPath();
        // Override: pointer parses, but manifest file read throws.
        mockReadFile.mockImplementation(async (path: string) => {
            const p = String(path);
            if (p.includes('image-assets.json')) return imageAssetsJson();
            if (p.endsWith('the-seventh-mirror.preview.v1.json'))
                return releasePlanJson();
            if (p.endsWith('current.json')) return release.pointerText;
            if (p.endsWith('runtime-manifest.json')) {
                throw new Error('manifest missing');
            }
            throw new Error(`Unexpected readFile path: ${p}`);
        });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /release documents:/
        );
    });

    it('reports an object SHA-256 mismatch (lines 145-146)', async () => {
        const release = buildConsistentRelease();
        // Corrupt one object's bytes so its sha256 no longer matches.
        const corrupted = new Map(release.objectBuffers);
        const firstPath = [...corrupted.keys()][0]!;
        corrupted.set(firstPath, Buffer.from('corrupted-bytes', 'utf8'));
        wireHappyPath({ objectBytes: corrupted });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /object SHA-256 mismatch:/
        );
    });

    it('reports an object byte length mismatch (lines 148-151)', async () => {
        const release = buildConsistentRelease();
        // Replace one object with bytes that hash to the same sha256 is
        // impossible, so instead tamper the manifest's declared byteLength to
        // differ from the actual bytes while keeping the sha256 consistent.
        const manifest = JSON.parse(release.manifestText);
        manifest.assets[0].variants.webp.byteLength = 999999;
        const tamperedManifestText = `${JSON.stringify(manifest, null, 2)}\n`;
        wireHappyPath({ manifestText: tamperedManifestText });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /object byte length mismatch:/
        );
    });

    it('reports an object dimensions mismatch (lines 157-158)', async () => {
        // Return dimensions that differ from the manifest's declared 960x540.
        wireHappyPath({
            objectDimensions: () => ({ width: 1, height: 1 }),
        });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /object dimensions mismatch:/
        );
    });

    it('reports a problem when an object file read fails (lines 160-161)', async () => {
        const release = buildConsistentRelease();
        wireHappyPath();
        // Override: object file read throws.
        const firstObjectPath = [...release.objectBuffers.keys()][0]!;
        mockReadFile.mockImplementation(async (path: string) => {
            const p = String(path);
            if (p.includes('image-assets.json')) return imageAssetsJson();
            if (p.endsWith('the-seventh-mirror.preview.v1.json'))
                return releasePlanJson();
            if (p.endsWith('current.json')) return release.pointerText;
            if (p.endsWith('runtime-manifest.json'))
                return release.manifestText;
            if (p.includes(firstObjectPath)) {
                throw new Error('object read failed');
            }
            // Other objects: return their bytes as Buffers.
            for (const [objectPath, buffer] of release.objectBuffers) {
                if (p.includes(objectPath)) return buffer;
            }
            throw new Error(`Unexpected readFile path: ${p}`);
        });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            new RegExp(`object ${firstObjectPath.replace(/\//g, '\\/')}:`)
        );
    });

    it('aggregates multiple independent object problems', async () => {
        const release = buildConsistentRelease();
        // Corrupt all object bytes so every object reports a SHA-256 mismatch.
        const corrupted = new Map<string, Buffer>();
        for (const [path] of release.objectBuffers) {
            corrupted.set(path, Buffer.from('corrupted', 'utf8'));
        }
        wireHappyPath({ objectBytes: corrupted });

        const { verifyVisualFixtures } = await importVerify();
        await expect(verifyVisualFixtures()).rejects.toThrow(
            /Visual fixture verification failed:/
        );
        // The error message should mention SHA-256 mismatch for each object.
        const error = await verifyVisualFixtures().then(
            () => null,
            failure => failure as Error
        );
        expect(error).not.toBeNull();
        const matches = error!.message.match(/object SHA-256 mismatch:/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBe(FIXTURE_IDENTITIES.length);
    });
});
