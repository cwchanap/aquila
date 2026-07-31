import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    assertSha256,
    canonicalReleaseContent,
    compareQualifiedAssetIds,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    qualifyAssetIdentity,
    releaseIdFromContentSha256,
    RUNTIME_ASSET_CACHE_POLICY,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';
import { loadR2DeliveryConfig } from './config';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'preview', previewId: 'smoke' } as const;
// Two assets, one of each type, so the seeded release exercises both halves of
// the logical identity space the runtime resolver understands.
const SOURCES = [
    {
        type: 'background' as const,
        key: 'chapter_1/ch1_act2_s0',
        file: 'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
        resize: { width: 640, height: 360 },
    },
    {
        type: 'portrait' as const,
        key: 'asakura_mio/base',
        file: 'the_seventh_mirror/characters/asakura_mio/base.png',
        resize: { width: 300, height: 400 },
    },
];

const repositoryRoot = resolve(
    fileURLToPath(new URL('.', import.meta.url)),
    '../../..'
);

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

/**
 * `--remote` is load-bearing. Wrangler 4 defaults `r2 object put` to a local
 * miniflare simulation that prints "Upload complete" without ever contacting
 * Cloudflare, so dropping the flag turns the whole seed into a silent no-op
 * that looks like a success. `--content-type` is equally mandatory: R2 does
 * not infer a type from the key and would store `application/octet-stream`,
 * which fails verification and breaks image decoding in the browser.
 */
function put(
    bucket: string,
    key: string,
    file: string,
    contentType: string,
    cacheControl: string
): Promise<void> {
    const child = spawn(
        'wrangler',
        [
            'r2',
            'object',
            'put',
            `${bucket}/${key}`,
            '--file',
            file,
            '--content-type',
            contentType,
            '--cache-control',
            cacheControl,
            '--remote',
        ],
        { stdio: 'inherit' }
    );
    return new Promise((settle, fail) => {
        child.on('error', cause => {
            fail(
                new Error(`wrangler could not be started for ${key}`, { cause })
            );
        });
        child.on('close', (code, signal) => {
            if (code === 0) {
                settle();
                return;
            }
            const reason =
                signal !== null ? `signal ${signal}` : `code ${code}`;
            fail(new Error(`wrangler failed uploading ${key} (${reason})`));
        });
    });
}

async function main(): Promise<void> {
    const config = await loadR2DeliveryConfig();
    const bucket = config.buckets.delivery;
    const immutable =
        RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
    const pointerCacheControl =
        RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
    const scratch = await mkdtemp(join(tmpdir(), 'aquila-seed-'));
    const assets: RuntimeAssetManifestV1['assets'] = [];

    // Objects go up first: nothing may name a key that is not already
    // readable. The manifest follows, and only then the pointer — see the
    // ordering note before the pointer upload.
    for (const source of SOURCES) {
        const input = resolve(
            repositoryRoot,
            'packages/assets/media',
            source.file
        );
        const pipeline = sharp(input).resize({
            ...source.resize,
            fit: 'inside',
            withoutEnlargement: true,
        });

        // AVIF as well as WebP: verification asserts an `image/avif` response,
        // which the WebP-only authoring fixtures cannot satisfy.
        const webp = await pipeline.clone().webp({ quality: 82 }).toBuffer();
        const avif = await pipeline.clone().avif({ quality: 50 }).toBuffer();
        const meta = await sharp(webp).metadata();
        if (!meta.width || !meta.height) {
            throw new Error(`Unable to read dimensions for ${source.file}`);
        }

        const webpSha = assertSha256<'object-content'>(sha256(webp));
        const avifSha = assertSha256<'object-content'>(sha256(avif));
        const webpPath = getObjectPath(webpSha, 'webp');
        const avifPath = getObjectPath(avifSha, 'avif');

        const webpFile = join(scratch, `${webpSha}.webp`);
        const avifFile = join(scratch, `${avifSha}.avif`);
        await writeFile(webpFile, webp);
        await writeFile(avifFile, avif);
        await put(bucket, webpPath, webpFile, 'image/webp', immutable);
        await put(bucket, avifPath, avifFile, 'image/avif', immutable);

        assets.push({
            identity: { type: source.type, key: source.key },
            variants: {
                webp: {
                    format: 'webp',
                    path: webpPath,
                    sha256: webpSha,
                    byteLength: webp.byteLength,
                },
                avif: {
                    format: 'avif',
                    path: avifPath,
                    sha256: avifSha,
                    byteLength: avif.byteLength,
                },
            },
            width: meta.width,
            height: meta.height,
            section: 'chapter_1',
        });
    }

    // The manifest schema requires `assets` to be sorted by type-qualified
    // identity, so sort deliberately rather than relying on `SOURCES` order
    // happening to agree with it.
    assets.sort((left, right) =>
        compareQualifiedAssetIds(
            qualifyAssetIdentity(left.identity),
            qualifyAssetIdentity(right.identity)
        )
    );

    // `canonicalReleaseContent` omits `releaseId` from the digest input, so the
    // placeholder below cannot influence the release id it is replaced by.
    const draft: RuntimeAssetManifestV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    };
    const releaseId = releaseIdFromContentSha256(
        assertSha256<'release-content'>(sha256(canonicalReleaseContent(draft)))
    );
    const manifest: RuntimeAssetManifestV1 = { ...draft, releaseId };
    // Parse what is about to be published: a malformed release is far cheaper
    // to catch here than as a verifier failure against the live host.
    parseRuntimeAssetManifest(manifest);
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestPath = getReleaseManifestPath(STORY_ID, releaseId, TARGET);
    const manifestFile = join(scratch, 'runtime-manifest.json');
    await writeFile(manifestFile, manifestText);
    await put(
        bucket,
        manifestPath,
        manifestFile,
        'application/json',
        immutable
    );

    const pointer = {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId,
        manifestPath,
        manifestSha256: sha256(manifestText),
        publishedAt: new Date().toISOString(),
    };
    // Also checks that `manifestPath` matches the publication layout for
    // TARGET, which is the agreement a runtime client depends on.
    parseActiveReleasePointer(pointer, TARGET, STORY_ID);
    const pointerText = `${JSON.stringify(pointer, null, 2)}\n`;
    const pointerFile = join(scratch, 'current.json');
    await writeFile(pointerFile, pointerText);
    // The pointer is written last, and never earlier: it names a manifest that
    // must already exist, which in turn names objects that must already exist.
    // Publishing it first would expose a release whose contents 404.
    await put(
        bucket,
        getCurrentPointerPath(STORY_ID, TARGET),
        pointerFile,
        'application/json',
        pointerCacheControl
    );

    console.log(`Seeded release ${releaseId}`);
    console.log(`Pointer: ${getCurrentPointerPath(STORY_ID, TARGET)}`);
}

await main();
