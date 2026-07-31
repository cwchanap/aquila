import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
import { loadR2DeliveryConfig, type R2DeliveryConfig } from './config';

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
 * Builds the S3 client used to publish to the delivery bucket. Auth is the
 * scoped R2 publisher token minted by `create-publisher-token.ts` — never the
 * account-wide `CLOUDFLARE_API_TOKEN` — so a leaked seeder credential can only
 * touch `aquila-vn-delivery`, not the source bucket or anything else in the
 * account. R2 exposes an S3-compatible API at
 * `https://<accountId>.r2.cloudflarestorage.com`; `region: 'auto'` lets the
 * SDK pick the jurisdiction from the access key.
 */
function createPublisherClient(config: R2DeliveryConfig): S3Client {
    const accessKeyId = process.env.R2_PUBLISHER_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_PUBLISHER_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
        throw new Error(
            'R2_PUBLISHER_ACCESS_KEY_ID and R2_PUBLISHER_SECRET_ACCESS_KEY must be set ' +
                '(scoped publisher credentials — mint with create-publisher-token.ts).'
        );
    }
    return new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });
}

/**
 * `ContentType` is mandatory: R2 does not infer a type from the key and would
 * store `application/octet-stream`, which fails verification and breaks image
 * decoding in the browser. `CacheControl` is set explicitly for the same
 * reason — the edge rule overrides it for immutable objects, but the header
 * still reaches the browser and the pointer relies on its own.
 */
async function put(
    client: S3Client,
    bucket: string,
    key: string,
    file: string,
    contentType: string,
    cacheControl: string
): Promise<void> {
    const body = await readFile(file);
    try {
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
                CacheControl: cacheControl,
            })
        );
    } catch (cause) {
        throw new Error(`S3 upload failed for ${key}`, { cause });
    }
}

async function main(): Promise<void> {
    const config = await loadR2DeliveryConfig();
    const bucket = config.buckets.delivery;
    const immutable =
        RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
    const pointerCacheControl =
        RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
    const client = createPublisherClient(config);
    const scratch = await mkdtemp(join(tmpdir(), 'aquila-seed-'));
    try {
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
            const webp = await pipeline
                .clone()
                .webp({ quality: 82 })
                .toBuffer();
            const avif = await pipeline
                .clone()
                .avif({ quality: 50 })
                .toBuffer();
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
            await put(
                client,
                bucket,
                webpPath,
                webpFile,
                'image/webp',
                immutable
            );
            await put(
                client,
                bucket,
                avifPath,
                avifFile,
                'image/avif',
                immutable
            );

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
            assertSha256<'release-content'>(
                sha256(canonicalReleaseContent(draft))
            )
        );
        const manifest: RuntimeAssetManifestV1 = { ...draft, releaseId };
        // Parse what is about to be published: a malformed release is far cheaper
        // to catch here than as a verifier failure against the live host.
        parseRuntimeAssetManifest(manifest);
        const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            releaseId,
            TARGET
        );
        const manifestFile = join(scratch, 'runtime-manifest.json');
        await writeFile(manifestFile, manifestText);
        await put(
            client,
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
            client,
            bucket,
            getCurrentPointerPath(STORY_ID, TARGET),
            pointerFile,
            'application/json',
            pointerCacheControl
        );

        console.log(`Seeded release ${releaseId}`);
        console.log(`Pointer: ${getCurrentPointerPath(STORY_ID, TARGET)}`);
    } finally {
        // The scratch directory holds the rendered WebP/AVIF/JSON files only
        // until they are uploaded; remove it on both success and failure so a
        // crashed or aborted seed does not leak temp files across runs.
        await rm(scratch, { recursive: true, force: true });
        client.destroy();
    }
}

await main();
