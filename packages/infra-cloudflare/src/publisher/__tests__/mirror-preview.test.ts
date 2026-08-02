import sharp from 'sharp';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    getObjectPath,
    getReleaseManifestPath,
    type ManifestByteSha256,
    type PublicationTarget,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { verifyStoredRelease } from '../candidate-verifier';
import { PublisherError } from '../errors';
import { sha256Bytes } from '../hash';
import {
    mirrorProductionReleaseToPreview,
    type MirrorProductionReleaseToPreviewOptions,
} from '../mirror-preview';
import { buildPreparedRelease } from '../runtime-release';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import type { EncodedAsset, EncodedVariant, PreparedRelease } from '../types';

const STORY_ID = 'example_story';
const PRODUCTION_TARGET: PublicationTarget = { kind: 'production' };
const PREVIEW_TARGET: PublicationTarget = {
    kind: 'preview',
    previewId: 'gate-123',
};
const IMMUTABLE_CACHE =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;

function cloneObject(object: StoredObject): StoredObject {
    return {
        ...object,
        bytes: Uint8Array.from(object.bytes),
        customMetadata: { ...object.customMetadata },
    };
}

class RecordingMemoryStore implements DeliveryStore {
    private readonly objects = new Map<string, StoredObject>();
    readonly reads: string[] = [];
    readonly immutableRequests: ImmutableCreateRequest[] = [];
    readonly pointerRequests: PointerWriteRequest[] = [];

    seed(request: ImmutableCreateRequest): void {
        const bytes = Uint8Array.from(request.bytes);
        this.objects.set(request.key, {
            key: request.key,
            etag: `memory-${sha256Bytes(bytes)}`,
            byteLength: bytes.byteLength,
            bytes,
            contentType: request.contentType,
            cacheControl: request.cacheControl,
            customMetadata: { ...(request.customMetadata ?? {}) },
        });
    }

    remove(key: string): void {
        this.objects.delete(key);
    }

    object(key: string): StoredObject {
        const object = this.objects.get(key);
        if (object === undefined) throw new Error('test object is missing');
        return cloneObject(object);
    }

    resetRecords(): void {
        this.reads.length = 0;
        this.immutableRequests.length = 0;
        this.pointerRequests.length = 0;
    }

    private metadata(object: StoredObject): StoredObjectMetadata {
        return {
            key: object.key,
            etag: object.etag,
            byteLength: object.byteLength,
            contentType: object.contentType,
            cacheControl: object.cacheControl,
            customMetadata: { ...object.customMetadata },
        };
    }

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        const object = this.objects.get(key);
        if (object === undefined) return null;
        return this.metadata(object);
    }

    async read(key: string): Promise<StoredObject> {
        this.reads.push(key);
        const object = this.objects.get(key);
        if (object === undefined) {
            throw new Error('SDK request failed with secret transport details');
        }
        return cloneObject(object);
    }

    async createImmutable(request: ImmutableCreateRequest) {
        this.immutableRequests.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
            customMetadata: { ...(request.customMetadata ?? {}) },
        });
        if (this.objects.has(request.key)) {
            return { status: 'already-exists' as const };
        }
        this.seed(request);
        return { status: 'created' as const };
    }

    async inspectPointer(): Promise<PointerSnapshot> {
        return { exists: false };
    }

    async readPointer(): Promise<PointerSnapshot> {
        return { exists: false };
    }

    async compareAndSwapPointer(request: PointerWriteRequest) {
        this.pointerRequests.push(request);
        return { status: 'written' as const };
    }

    async *list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        for (const [key, object] of this.objects) {
            if (!key.startsWith(prefix)) continue;
            yield this.metadata(object);
        }
    }

    async *listKeys(prefix: string): AsyncIterable<string> {
        for (const key of this.objects.keys()) {
            if (key.startsWith(prefix)) yield key;
        }
    }

    async close(): Promise<void> {}
}

function coverage(): StoryAssetCoverageReport {
    const included = { total: 1, included: 1, omitted: 0, unclassified: 0 };
    const empty = { total: 0, included: 0, omitted: 0, unclassified: 0 };
    return {
        storyId: STORY_ID,
        byType: { background: included, portrait: empty },
        bySection: { chapter_1: included },
        totals: included,
    };
}

async function variant(format: 'webp' | 'avif'): Promise<EncodedVariant> {
    const image = sharp({
        create: {
            width: 16,
            height: 9,
            channels: 3,
            background: { r: 30, g: 60, b: 90 },
        },
    });
    const bytes = new Uint8Array(
        await (format === 'webp' ? image.webp() : image.avif()).toBuffer()
    );
    const sha256 = sha256Bytes(bytes);
    return {
        format,
        bytes,
        sha256,
        path: getObjectPath(sha256, format),
        byteLength: bytes.byteLength,
        contentType: format === 'webp' ? 'image/webp' : 'image/avif',
    };
}

async function productionRelease(): Promise<PreparedRelease> {
    const background: EncodedAsset = {
        identity: { type: 'background', key: 'chapter_1/room' },
        sourcePath: 'example/backgrounds/chapter_1/room.png',
        authoringSection: 'chapter_1',
        variants: [await variant('webp'), await variant('avif')],
        width: 16,
        height: 9,
        sourceHasAlpha: false,
        outputHasAlpha: false,
    };
    const releasePlan: StoryAssetReleasePlanV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        channel: 'production',
        entries: [
            {
                identity: background.identity,
                disposition: 'included',
                sourcePath: background.sourcePath,
                section: 'chapter_1',
            },
        ],
    };
    return buildPreparedRelease({
        storyId: STORY_ID,
        target: PRODUCTION_TARGET,
        releasePlan,
        encodedAssets: [background],
        coverage: coverage(),
    });
}

async function fixture(): Promise<{
    store: RecordingMemoryStore;
    release: PreparedRelease;
    productionManifestPath: string;
    previewManifestPath: string;
}> {
    const store = new RecordingMemoryStore();
    const release = await productionRelease();
    for (const asset of release.encodedAssets) {
        for (const encoded of asset.variants) {
            store.seed({
                key: encoded.path,
                bytes: encoded.bytes,
                contentType: encoded.contentType,
                cacheControl: IMMUTABLE_CACHE,
            });
        }
    }
    const productionManifestPath = getReleaseManifestPath(
        STORY_ID,
        release.releaseId,
        PRODUCTION_TARGET
    );
    const previewManifestPath = getReleaseManifestPath(
        STORY_ID,
        release.releaseId,
        PREVIEW_TARGET
    );
    store.seed({
        key: productionManifestPath,
        bytes: release.manifestBytes,
        contentType: 'application/json',
        cacheControl: IMMUTABLE_CACHE,
        customMetadata: { release: 'candidate' },
    });
    store.resetRecords();
    return {
        store,
        release,
        productionManifestPath,
        previewManifestPath,
    };
}

function options(
    value: Awaited<ReturnType<typeof fixture>>,
    overrides: Partial<MirrorProductionReleaseToPreviewOptions> = {}
): MirrorProductionReleaseToPreviewOptions {
    return {
        store: value.store,
        storyId: STORY_ID,
        sourceTarget: PRODUCTION_TARGET,
        releaseId: value.release.releaseId,
        previewId: 'gate-123',
        ...overrides,
    };
}

describe('mirrorProductionReleaseToPreview', () => {
    let value: Awaited<ReturnType<typeof fixture>>;

    beforeEach(async () => {
        value = await fixture();
    });

    it('mirrors exact production manifest bytes and metadata to the helper-derived preview path without objects or pointers', async () => {
        const production = value.store.object(value.productionManifestPath);

        const report = await mirrorProductionReleaseToPreview(options(value));

        const preview = value.store.object(value.previewManifestPath);
        expect(preview.bytes).toEqual(production.bytes);
        expect({
            contentType: preview.contentType,
            cacheControl: preview.cacheControl,
            customMetadata: preview.customMetadata,
        }).toEqual({
            contentType: production.contentType,
            cacheControl: production.cacheControl,
            customMetadata: production.customMetadata,
        });
        expect(value.store.immutableRequests).toEqual([
            expect.objectContaining({
                key: value.previewManifestPath,
                bytes: production.bytes,
                contentType: 'application/json',
                cacheControl: IMMUTABLE_CACHE,
                customMetadata: { release: 'candidate' },
            }),
        ]);
        expect(
            value.store.immutableRequests.some(request =>
                request.key.startsWith('vn/objects/')
            )
        ).toBe(false);
        expect(value.store.pointerRequests).toEqual([]);
        await expect(
            verifyStoredRelease({
                store: value.store,
                storyId: STORY_ID,
                target: PREVIEW_TARGET,
                releaseId: value.release.releaseId,
                depth: 'deep',
            })
        ).resolves.toMatchObject({
            manifestPath: value.previewManifestPath,
            manifestSha256: value.release.manifestSha256,
        });
        expect(report).toMatchObject({
            schemaVersion: 1,
            command: 'mirror-preview',
            status: 'success',
            storyId: STORY_ID,
            target: PREVIEW_TARGET,
            releaseId: value.release.releaseId,
            manifestSha256: value.release.manifestSha256,
            counts: {
                included: 1,
                omitted: 0,
                objectsCreated: 0,
                objectsReused: 0,
                manifestsCreated: 1,
                manifestsReused: 0,
                pointersWritten: 0,
            },
            actions: [
                {
                    stage: 'manifest-upload',
                    kind: 'create-manifest',
                    key: value.previewManifestPath,
                },
                { stage: 'activation', kind: 'no-op' },
            ],
            pointer: { changed: false },
        });
    });

    it('rejects a preview source target before any read or write', async () => {
        await expect(
            mirrorProductionReleaseToPreview(
                options(value, { sourceTarget: PREVIEW_TARGET })
            )
        ).rejects.toMatchObject({ code: 'input' });
        expect(value.store.reads).toEqual([]);
        expect(value.store.immutableRequests).toEqual([]);
        expect(value.store.pointerRequests).toEqual([]);
    });

    it('rejects an expected production manifest checksum mismatch before writing', async () => {
        const expectedManifestSha256 = '0'.repeat(64) as ManifestByteSha256;

        await expect(
            mirrorProductionReleaseToPreview(
                options(value, { expectedManifestSha256 })
            )
        ).rejects.toMatchObject({
            code: 'integrity',
            message: 'Production manifest checksum does not match expectation',
        });
        expect(value.store.immutableRequests).toEqual([]);
        expect(value.store.pointerRequests).toEqual([]);
    });

    it('reuses an existing byte-identical preview manifest with exact metadata', async () => {
        const production = value.store.object(value.productionManifestPath);
        value.store.seed({
            key: value.previewManifestPath,
            bytes: production.bytes,
            contentType: production.contentType,
            cacheControl: production.cacheControl,
            customMetadata: production.customMetadata,
        });
        value.store.resetRecords();

        const report = await mirrorProductionReleaseToPreview(options(value));

        expect(value.store.immutableRequests).toHaveLength(1);
        expect(report).toMatchObject({
            status: 'no-op',
            counts: {
                manifestsCreated: 0,
                manifestsReused: 1,
                pointersWritten: 0,
            },
            actions: [
                expect.objectContaining({ kind: 'reuse-manifest' }),
                { stage: 'activation', kind: 'no-op' },
            ],
            pointer: { changed: false },
        });
    });

    it.each([
        [
            'body',
            (production: StoredObject) => ({
                ...production,
                bytes: Uint8Array.from(production.bytes, (byte, index) =>
                    index === 0 ? byte ^ 0xff : byte
                ),
            }),
        ],
        [
            'content type',
            (production: StoredObject) => ({
                ...production,
                contentType: 'text/plain',
            }),
        ],
        [
            'custom metadata',
            (production: StoredObject) => ({
                ...production,
                customMetadata: { release: 'different' },
            }),
        ],
    ])(
        'rejects an existing preview manifest with conflicting %s',
        async (_name, conflict) => {
            const conflicting = conflict(
                value.store.object(value.productionManifestPath)
            );
            value.store.seed({
                key: value.previewManifestPath,
                bytes: conflicting.bytes,
                contentType: conflicting.contentType,
                cacheControl: conflicting.cacheControl,
                customMetadata: conflicting.customMetadata,
            });
            value.store.resetRecords();

            await expect(
                mirrorProductionReleaseToPreview(options(value))
            ).rejects.toMatchObject({
                code: 'integrity',
                message:
                    'Existing preview manifest conflicts with production candidate',
            });
            expect(value.store.pointerRequests).toEqual([]);
        }
    );

    it.each(['missing', 'corrupt'] as const)(
        'blocks mirroring when a production object is %s',
        async corruption => {
            const objectPath =
                value.release.encodedAssets[0]!.variants[0]!.path;
            if (corruption === 'missing') {
                value.store.remove(objectPath);
            } else {
                const object = value.store.object(objectPath);
                value.store.seed({
                    key: objectPath,
                    bytes: Uint8Array.from(object.bytes, (byte, index) =>
                        index === 0 ? byte ^ 0xff : byte
                    ),
                    contentType: object.contentType,
                    cacheControl: object.cacheControl,
                    customMetadata: object.customMetadata,
                });
            }
            value.store.resetRecords();

            const failure = mirrorProductionReleaseToPreview(options(value));
            await expect(failure).rejects.toBeInstanceOf(PublisherError);
            await expect(failure).rejects.not.toThrow(
                /secret transport details/
            );
            expect(value.store.immutableRequests).toEqual([]);
            expect(value.store.pointerRequests).toEqual([]);
        }
    );
});
