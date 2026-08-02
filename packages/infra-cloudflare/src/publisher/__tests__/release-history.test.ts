import sharp from 'sharp';
import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    canonicalJson,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    type ActiveReleasePointerV1,
    type PublicationTarget,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError, publisherExitCode } from '../errors';
import { sha256Bytes } from '../hash';
import { listReleases, rollbackRelease } from '../release-history';
import { publisherReportExitCode } from '../report';
import { buildPreparedRelease } from '../runtime-release';
import type {
    DeliveryStore,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import type { EncodedAsset, EncodedVariant, PreparedRelease } from '../types';
import { R2DeliveryStore } from '../stores/r2-delivery-store';

const STORY_ID = 'example_story';
const PREVIEW_TARGET = {
    kind: 'preview',
    previewId: 'release-history',
} as const;
const PRODUCTION_TARGET = { kind: 'production' } as const;
const IMMUTABLE_CACHE =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
const POINTER_CACHE =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let previewReleaseA: PreparedRelease;
let previewReleaseB: PreparedRelease;
let productionReleaseA: PreparedRelease;

function coverage(): StoryAssetCoverageReport {
    return {
        storyId: STORY_ID,
        byType: {
            background: { total: 1, included: 1, omitted: 0, unclassified: 0 },
            portrait: { total: 0, included: 0, omitted: 0, unclassified: 0 },
        },
        bySection: {
            chapter_1: { total: 1, included: 1, omitted: 0, unclassified: 0 },
        },
        totals: { total: 1, included: 1, omitted: 0, unclassified: 0 },
    };
}

async function encodedVariant(
    format: 'webp' | 'avif',
    color: { r: number; g: number; b: number }
): Promise<EncodedVariant> {
    const image = sharp({
        create: {
            width: 16,
            height: 9,
            channels: 3,
            background: color,
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

async function preparedRelease(
    target: PublicationTarget,
    color: { r: number; g: number; b: number }
): Promise<PreparedRelease> {
    const sourcePath = 'example/backgrounds/chapter_1/room.png';
    const encodedAssets: EncodedAsset[] = [
        {
            identity: { type: 'background', key: 'chapter_1/room' },
            sourcePath,
            authoringSection: 'chapter_1',
            variants: [
                await encodedVariant('webp', color),
                await encodedVariant('avif', color),
            ],
            width: 16,
            height: 9,
            sourceHasAlpha: false,
            outputHasAlpha: false,
        },
    ];
    const releasePlan: StoryAssetReleasePlanV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        channel: target.kind === 'production' ? 'production' : 'preview',
        entries: [
            {
                identity: encodedAssets[0]!.identity,
                disposition: 'included',
                sourcePath,
                section: 'chapter_1',
            },
        ],
    };
    return buildPreparedRelease({
        storyId: STORY_ID,
        target,
        releasePlan,
        encodedAssets,
        coverage: coverage(),
    });
}

beforeAll(async () => {
    previewReleaseA = await preparedRelease(PREVIEW_TARGET, {
        r: 10,
        g: 20,
        b: 30,
    });
    previewReleaseB = await preparedRelease(PREVIEW_TARGET, {
        r: 90,
        g: 80,
        b: 70,
    });
    productionReleaseA = await preparedRelease(PRODUCTION_TARGET, {
        r: 10,
        g: 20,
        b: 30,
    });
});

function cloneObject(object: StoredObject): StoredObject {
    return { ...object, bytes: Uint8Array.from(object.bytes) };
}

function metadata(object: StoredObject): StoredObjectMetadata {
    return {
        key: object.key,
        etag: object.etag,
        byteLength: object.byteLength,
        contentType: object.contentType,
        cacheControl: object.cacheControl,
        customMetadata: object.customMetadata,
    };
}

class HistoryStore implements DeliveryStore {
    readonly events: string[] = [];
    readonly pointerWrites: PointerWriteRequest[] = [];
    listedKeys: string[];
    listFailure?: unknown;
    listKeysFailure?: unknown;
    statFailure?: unknown;
    beforeCompareAndSwap?: (
        store: HistoryStore,
        request: PointerWriteRequest,
        attempt: number
    ) => void;

    private readonly objects = new Map<string, StoredObject>();
    private pointer: Extract<PointerSnapshot, { exists: true }> | null = null;
    private pointerVersion = 0;
    private compareAndSwapAttempts = 0;

    constructor(...releases: PreparedRelease[]) {
        for (const release of releases) this.seedRelease(release);
        this.listedKeys = releases.map(release =>
            getReleaseManifestPath(
                release.storyId,
                release.releaseId,
                release.target
            )
        );
    }

    get authoringCatalog(): never {
        throw new Error('release history touched authoring input');
    }

    get releasePlan(): never {
        throw new Error('release history touched plan input');
    }

    get sourceRoot(): never {
        throw new Error('release history touched source input');
    }

    get encoder(): never {
        throw new Error('release history touched encoder input');
    }

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        this.events.push(`stat:${key}`);
        if (this.statFailure !== undefined) throw this.statFailure;
        const object = this.objects.get(key);
        return object === undefined ? null : metadata(object);
    }

    async read(key: string): Promise<StoredObject> {
        this.events.push(`read:${key}`);
        const object = this.objects.get(key);
        if (object === undefined) throw new Error('missing test object');
        return cloneObject(object);
    }

    createImmutable(): Promise<{ status: 'created' | 'already-exists' }> {
        throw new Error('release history must not create immutable objects');
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        this.events.push(`inspect-pointer:${key}`);
        return this.pointerSnapshot();
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        this.events.push(`read-pointer:${key}`);
        return this.pointerSnapshot();
    }

    async compareAndSwapPointer(request: PointerWriteRequest): Promise<{
        status: 'written' | 'precondition-failed';
        etag?: string;
    }> {
        this.compareAndSwapAttempts += 1;
        this.events.push(`cas:${request.key}`);
        this.pointerWrites.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
        });
        this.beforeCompareAndSwap?.(this, request, this.compareAndSwapAttempts);
        const matches =
            this.pointer === null
                ? request.expected.exists === false
                : request.expected.exists === true &&
                  request.expected.etag === this.pointer.etag;
        if (!matches) return { status: 'precondition-failed' };
        const etag = this.forcePointer(request.bytes, {
            contentType: request.contentType,
            cacheControl: request.cacheControl,
        });
        return { status: 'written', etag };
    }

    async *list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        this.events.push(`list:${prefix}`);
        if (this.listFailure !== undefined) throw this.listFailure;
        for (const key of this.listedKeys) {
            const object = this.objects.get(key);
            yield object === undefined
                ? {
                      key,
                      etag: `listed:${key}`,
                      byteLength: 0,
                      contentType: 'application/json',
                      cacheControl: IMMUTABLE_CACHE,
                      customMetadata: {},
                  }
                : metadata(object);
        }
    }

    async *listKeys(prefix: string): AsyncIterable<string> {
        this.events.push(`list-keys:${prefix}`);
        if (this.listKeysFailure !== undefined) throw this.listKeysFailure;
        yield* this.listedKeys;
    }

    async close(): Promise<void> {}

    forcePointer(
        bytes: Uint8Array,
        metadataValue: { contentType: string; cacheControl: string } = {
            contentType: 'application/json',
            cacheControl: POINTER_CACHE,
        }
    ): string {
        this.pointerVersion += 1;
        const etag = `W/"opaque-${this.pointerVersion}"`;
        this.pointer = {
            exists: true,
            etag,
            bytes: Uint8Array.from(bytes),
            contentType: metadataValue.contentType,
            cacheControl: metadataValue.cacheControl,
        };
        return etag;
    }

    remove(key: string): void {
        this.objects.delete(key);
    }

    mutate(key: string, mutate: (object: StoredObject) => StoredObject): void {
        const object = this.objects.get(key);
        if (object === undefined) throw new Error('missing test object');
        this.objects.set(key, mutate(cloneObject(object)));
    }

    currentPointerBytes(): Uint8Array | null {
        return this.pointer === null
            ? null
            : Uint8Array.from(this.pointer.bytes);
    }

    private pointerSnapshot(): PointerSnapshot {
        return this.pointer === null
            ? { exists: false }
            : { ...this.pointer, bytes: Uint8Array.from(this.pointer.bytes) };
    }

    private seedRelease(release: PreparedRelease): void {
        for (const asset of release.encodedAssets) {
            for (const variant of asset.variants) {
                this.objects.set(variant.path, {
                    key: variant.path,
                    etag: `immutable-${variant.sha256}`,
                    bytes: Uint8Array.from(variant.bytes),
                    byteLength: variant.bytes.byteLength,
                    contentType: variant.contentType,
                    cacheControl: IMMUTABLE_CACHE,
                    customMetadata: {},
                });
            }
        }
        const manifestPath = getReleaseManifestPath(
            release.storyId,
            release.releaseId,
            release.target
        );
        this.objects.set(manifestPath, {
            key: manifestPath,
            etag: `manifest-${release.manifestSha256}`,
            bytes: Uint8Array.from(release.manifestBytes),
            byteLength: release.manifestBytes.byteLength,
            contentType: 'application/json',
            cacheControl: IMMUTABLE_CACHE,
            customMetadata: {},
        });
    }
}

function pointerFor(
    release: PreparedRelease,
    publishedAt: string
): ActiveReleasePointerV1 {
    return {
        schemaVersion: 1,
        storyId: release.storyId,
        releaseId: release.releaseId,
        manifestPath: getReleaseManifestPath(
            release.storyId,
            release.releaseId,
            release.target
        ),
        manifestSha256: release.manifestSha256,
        publishedAt,
    };
}

function pointerBytes(pointer: ActiveReleasePointerV1): Uint8Array {
    return textEncoder.encode(`${canonicalJson(pointer)}\n`);
}

function decodePointer(bytes: Uint8Array): ActiveReleasePointerV1 {
    return JSON.parse(textDecoder.decode(bytes)) as ActiveReleasePointerV1;
}

function rollback(
    store: DeliveryStore,
    release: PreparedRelease,
    options: {
        confirmProduction?: string;
        overrideConcurrentPointer?: boolean;
        now?: () => number;
    } = {}
) {
    return rollbackRelease({
        store,
        storyId: release.storyId,
        target: release.target,
        releaseId: release.releaseId,
        expectedManifestSha256: release.manifestSha256,
        confirmProduction: options.confirmProduction,
        overrideConcurrentPointer: options.overrideConcurrentPointer,
        now: options.now ?? (() => Date.parse('2026-08-01T20:00:00.000Z')),
    });
}

describe('listReleases', () => {
    it('accepts only exact recomputed manifest keys and ignores lookalikes', async () => {
        const store = new HistoryStore(previewReleaseA);
        const releaseId = previewReleaseA.releaseId;
        const prefix =
            'vn/previews/release-history/stories/example_story/releases/';
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            releaseId,
            PREVIEW_TARGET
        );
        store.listedKeys = [
            manifestPath,
            getCurrentPointerPath(STORY_ID, PREVIEW_TARGET),
            `${prefix}${releaseId}//runtime-manifest.json`,
            `${prefix}${releaseId}/nested/runtime-manifest.json`,
            `${prefix}${releaseId}/runtime-manifest.json.metadata`,
            `${prefix}sha256-${'A'.repeat(64)}/runtime-manifest.json`,
            `${prefix}not-a-release/runtime-manifest.json`,
            `vn/previews/release-history/stories/example_story/releases-lookalike/${releaseId}/runtime-manifest.json`,
        ];
        store.listFailure = new PublisherError(
            'integrity',
            'metadata-deficient lookalike was hydrated'
        );

        const summaries = await listReleases({
            store,
            storyId: STORY_ID,
            target: PREVIEW_TARGET,
            deep: false,
        });

        expect(summaries).toEqual([
            expect.objectContaining({
                releaseId,
                manifestPath,
                manifestValid: true,
                releaseIdentityValid: true,
                shallowVerified: true,
                deepVerified: false,
                active: false,
            }),
        ]);
        expect(store.events[0]).toBe(`list-keys:${prefix}`);
        expect(store.events.join('\n')).not.toContain('releases-lookalike');
        expect(store.events.join('\n')).not.toContain('//runtime-manifest');
    });

    it('filters an R2 lookalike before any HEAD or body read', async () => {
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            previewReleaseA.releaseId,
            PREVIEW_TARGET
        );
        const lookalikePath = `${manifestPath}.metadata`;
        const pointerPath = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
        const commands: Array<
            GetObjectCommand | HeadObjectCommand | ListObjectsV2Command
        > = [];
        const store = new R2DeliveryStore({
            bucket: 'delivery',
            client: {
                async send(command) {
                    if (
                        command instanceof GetObjectCommand ||
                        command instanceof HeadObjectCommand ||
                        command instanceof ListObjectsV2Command
                    ) {
                        commands.push(command);
                    }
                    if (command instanceof ListObjectsV2Command) {
                        return {
                            IsTruncated: false,
                            Contents: [
                                { Key: manifestPath },
                                { Key: lookalikePath },
                            ],
                        };
                    }
                    if (command instanceof HeadObjectCommand) {
                        throw new Error('release listing must not issue HEAD');
                    }
                    if (command instanceof GetObjectCommand) {
                        if (command.input.Key === pointerPath) {
                            throw { $metadata: { httpStatusCode: 404 } };
                        }
                        if (command.input.Key !== manifestPath) {
                            throw new Error(
                                'rejected lookalike must not be read'
                            );
                        }
                        return {
                            ETag: '"manifest"',
                            ContentLength:
                                previewReleaseA.manifestBytes.byteLength,
                            ContentType: 'application/json',
                            CacheControl: IMMUTABLE_CACHE,
                            Metadata: {},
                            Body: {
                                transformToByteArray: async () =>
                                    Uint8Array.from(
                                        previewReleaseA.manifestBytes
                                    ),
                            },
                        };
                    }
                    throw new Error('unexpected R2 command');
                },
                destroy() {},
            },
        });

        await expect(
            listReleases({
                store,
                storyId: STORY_ID,
                target: PREVIEW_TARGET,
                deep: false,
            })
        ).resolves.toEqual([
            expect.objectContaining({
                releaseId: previewReleaseA.releaseId,
                shallowVerified: true,
            }),
        ]);
        expect(
            commands.filter(command => command instanceof HeadObjectCommand)
        ).toEqual([]);
        expect(
            commands.some(
                command =>
                    command instanceof GetObjectCommand &&
                    command.input.Key === lookalikePath
            )
        ).toBe(false);
    });

    it('shallow-verifies manifest structure and metadata without reading referenced objects', async () => {
        const store = new HistoryStore(previewReleaseA);
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            previewReleaseA.releaseId,
            PREVIEW_TARGET
        );
        store.mutate(manifestPath, object => ({
            ...object,
            cacheControl: 'no-cache',
        }));

        const [summary] = await listReleases({
            store,
            storyId: STORY_ID,
            target: PREVIEW_TARGET,
            deep: false,
        });

        expect(summary).toMatchObject({
            manifestValid: true,
            releaseIdentityValid: true,
            shallowVerified: false,
            deepVerified: false,
        });
        expect(
            store.events.some(
                event =>
                    event.startsWith('read:vn/objects/') &&
                    (event.endsWith('.webp') || event.endsWith('.avif'))
            )
        ).toBe(false);
    });

    it('keeps shallow evidence but rejects deep verification when an object is corrupt', async () => {
        const store = new HistoryStore(previewReleaseA);
        const objectPath = previewReleaseA.encodedAssets[0]!.variants[0]!.path;
        store.mutate(objectPath, object => ({
            ...object,
            bytes: textEncoder.encode('corrupt'),
            byteLength: textEncoder.encode('corrupt').byteLength,
        }));

        const [summary] = await listReleases({
            store,
            storyId: STORY_ID,
            target: PREVIEW_TARGET,
            deep: true,
        });

        expect(summary).toMatchObject({
            manifestValid: true,
            releaseIdentityValid: true,
            shallowVerified: true,
            deepVerified: false,
        });
        expect(store.events).toContain(`read:${objectPath}`);
    });

    it('parses the observational current pointer and marks exactly one active release', async () => {
        const store = new HistoryStore(previewReleaseA, previewReleaseB);
        store.forcePointer(
            pointerBytes(
                pointerFor(previewReleaseB, '2026-08-01T19:00:00.000Z')
            )
        );

        const summaries = await listReleases({
            store,
            storyId: STORY_ID,
            target: PREVIEW_TARGET,
            deep: false,
        });

        expect(
            summaries.map(summary => [summary.releaseId, summary.active])
        ).toEqual(
            [
                [previewReleaseA.releaseId, false] as const,
                [previewReleaseB.releaseId, true] as const,
            ].sort(([left], [right]) => left.localeCompare(right))
        );
        expect(store.events).toContain(
            `inspect-pointer:${getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)}`
        );
        expect(
            store.events.some(event => event.startsWith('read-pointer:'))
        ).toBe(false);
    });

    it('consumes the store iterable once, sorts opaque pages, and reports bounded progress', async () => {
        const store = new HistoryStore(previewReleaseA, previewReleaseB);
        store.listedKeys.reverse();
        const progress: Array<{ completed: number; total: number }> = [];

        const summaries = await listReleases({
            store,
            storyId: STORY_ID,
            target: PREVIEW_TARGET,
            deep: false,
            onProgress: event =>
                progress.push({
                    completed: event.completed,
                    total: event.total,
                }),
        });

        expect(summaries.map(summary => summary.releaseId)).toEqual(
            [previewReleaseA.releaseId, previewReleaseB.releaseId].sort()
        );
        expect(progress).toEqual([
            { completed: 1, total: 2 },
            { completed: 2, total: 2 },
        ]);
        expect(
            store.events.filter(event => event.startsWith('list-keys:'))
        ).toHaveLength(1);
    });

    it('sanitizes list and pointer transport failures', async () => {
        const store = new HistoryStore(previewReleaseA);
        const secret = 'Bearer private-token /Users/operator/private';
        store.listKeysFailure = Object.assign(new Error(secret), {
            request: { authorization: secret },
        });

        let thrown: unknown;
        try {
            await listReleases({
                store,
                storyId: STORY_ID,
                target: PREVIEW_TARGET,
                deep: false,
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toMatchObject({
            name: 'PublisherError',
            code: 'storage',
            cause: { classification: 'delivery-store-list-failure' },
        });
        expect(JSON.stringify(thrown)).not.toContain(secret);
    });
});

describe('rollbackRelease', () => {
    it('deep-verifies first, then fresh-reads and mutates only exact current.json', async () => {
        const store = new HistoryStore(previewReleaseA);

        const report = await rollback(store, previewReleaseA);

        const pointerKey = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
        const firstPointerRead = store.events.indexOf(
            `read-pointer:${pointerKey}`
        );
        expect(report).toMatchObject({
            command: 'rollback',
            status: 'success',
            releaseId: previewReleaseA.releaseId,
            manifestSha256: previewReleaseA.manifestSha256,
            counts: { pointersWritten: 1 },
            pointer: {
                afterReleaseId: previewReleaseA.releaseId,
                changed: true,
            },
        });
        expect(store.events.slice(firstPointerRead)).toEqual([
            `read-pointer:${pointerKey}`,
            `cas:${pointerKey}`,
        ]);
        expect(store.pointerWrites).toHaveLength(1);
        expect(store.pointerWrites[0]).toMatchObject({
            key: pointerKey,
            expected: { exists: false },
            contentType: 'application/json',
            cacheControl: POINTER_CACHE,
        });
        expect(
            store.events
                .slice(0, firstPointerRead)
                .filter(event => event.startsWith('read:'))
        ).toHaveLength(3);
    });

    it('requires the exact production confirmation before pointer mutation', async () => {
        for (const confirmProduction of [undefined, `${STORY_ID}_wrong`]) {
            const store = new HistoryStore(productionReleaseA);
            await expect(
                rollback(store, productionReleaseA, { confirmProduction })
            ).rejects.toMatchObject({
                name: 'PublisherError',
                code: 'activation-target',
            });
            expect(store.pointerWrites).toEqual([]);
        }

        const confirmed = new HistoryStore(productionReleaseA);
        await expect(
            rollback(confirmed, productionReleaseA, {
                confirmProduction: STORY_ID,
            })
        ).resolves.toMatchObject({ command: 'rollback', status: 'success' });
    });

    it('creates distinct bytes and strictly increasing timestamps for A to B to A', async () => {
        const store = new HistoryStore(previewReleaseA, previewReleaseB);
        const now = () => Date.parse('2026-08-01T20:00:00.000Z');

        await rollback(store, previewReleaseA, { now });
        await rollback(store, previewReleaseB, { now });
        await rollback(store, previewReleaseA, { now });

        const pointers = store.pointerWrites.map(write =>
            decodePointer(write.bytes)
        );
        expect(pointers.map(pointer => pointer.releaseId)).toEqual([
            previewReleaseA.releaseId,
            previewReleaseB.releaseId,
            previewReleaseA.releaseId,
        ]);
        expect(pointers.map(pointer => pointer.publishedAt)).toEqual([
            '2026-08-01T20:00:00.000Z',
            '2026-08-01T20:00:00.001Z',
            '2026-08-01T20:00:00.002Z',
        ]);
        expect(store.pointerWrites[0]!.bytes).not.toEqual(
            store.pointerWrites[2]!.bytes
        );
    });

    it('override deep-reverifies, fresh-rereads, and attempts one refreshed CAS', async () => {
        const store = new HistoryStore(previewReleaseA, previewReleaseB);
        store.beforeCompareAndSwap = (current, _request, attempt) => {
            current.forcePointer(
                pointerBytes(
                    pointerFor(
                        previewReleaseB,
                        `2026-08-01T20:00:00.00${attempt}Z`
                    )
                )
            );
        };

        const report = await rollback(store, previewReleaseA, {
            overrideConcurrentPointer: true,
        });

        const pointerKey = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            previewReleaseA.releaseId,
            PREVIEW_TARGET
        );
        expect(report).toMatchObject({
            command: 'rollback',
            status: 'conflict',
            counts: { pointersWritten: 0 },
            pointer: {
                beforeReleaseId: previewReleaseB.releaseId,
                changed: false,
            },
        });
        expect(
            store.events.filter(event => event === `read:${manifestPath}`)
        ).toHaveLength(2);
        expect(
            store.events.filter(event => event === `read-pointer:${pointerKey}`)
        ).toHaveLength(2);
        expect(store.pointerWrites).toHaveLength(2);
        const secondManifestRead = store.events.lastIndexOf(
            `read:${manifestPath}`
        );
        const secondPointerRead = store.events.lastIndexOf(
            `read-pointer:${pointerKey}`
        );
        const secondCas = store.events.lastIndexOf(`cas:${pointerKey}`);
        expect(secondManifestRead).toBeLessThan(secondPointerRead);
        expect(secondPointerRead).toBeLessThan(secondCas);
    });

    it.each(['missing', 'invalid'] as const)(
        '%s target maps to exit class 5 without reading or mutating the pointer',
        async condition => {
            const store = new HistoryStore(previewReleaseA);
            const manifestPath = getReleaseManifestPath(
                STORY_ID,
                previewReleaseA.releaseId,
                PREVIEW_TARGET
            );
            if (condition === 'missing') store.remove(manifestPath);
            else {
                store.mutate(manifestPath, object => ({
                    ...object,
                    bytes: textEncoder.encode('{}\n'),
                    byteLength: 3,
                }));
            }

            let thrown: unknown;
            try {
                await rollback(store, previewReleaseA);
            } catch (error) {
                thrown = error;
            }

            expect(thrown).toBeInstanceOf(PublisherError);
            expect(thrown).toMatchObject({ code: 'activation-target' });
            expect(publisherExitCode(thrown)).toBe(5);
            expect(store.pointerWrites).toEqual([]);
            expect(
                store.events.some(event => event.startsWith('read-pointer:'))
            ).toBe(false);
        }
    );

    it('rejects a malformed release ID as exit class 5 before store access', async () => {
        const store = new HistoryStore(previewReleaseA);

        let thrown: unknown;
        try {
            await rollbackRelease({
                store,
                storyId: STORY_ID,
                target: PREVIEW_TARGET,
                releaseId: 'not-a-release-id',
            });
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(PublisherError);
        expect(thrown).toMatchObject({ code: 'activation-target' });
        expect(publisherExitCode(thrown)).toBe(5);
        expect(store.events).toEqual([]);
        expect(store.pointerWrites).toEqual([]);
    });

    it('maps stat-time manifest integrity failure to exit class 5 without pointer access', async () => {
        const store = new HistoryStore(previewReleaseA);
        store.statFailure = new PublisherError(
            'integrity',
            'Invalid R2 object metadata'
        );

        let thrown: unknown;
        try {
            await rollback(store, previewReleaseA);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(PublisherError);
        expect(thrown).toMatchObject({ code: 'activation-target' });
        expect(publisherExitCode(thrown)).toBe(5);
        expect(
            store.events.some(event => event.startsWith('read-pointer:'))
        ).toBe(false);
        expect(store.pointerWrites).toEqual([]);
    });

    it('keeps stat-time transport failure sanitized as storage exit class 3', async () => {
        const store = new HistoryStore(previewReleaseA);
        const secret = 'Bearer private-token /Users/operator/private';
        store.statFailure = Object.assign(new Error(secret), {
            request: { authorization: secret },
        });

        let thrown: unknown;
        try {
            await rollback(store, previewReleaseA);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(PublisherError);
        expect(thrown).toMatchObject({ code: 'storage' });
        expect(publisherExitCode(thrown)).toBe(3);
        expect(JSON.stringify(thrown)).not.toContain(secret);
        expect(
            store.events.some(event => event.startsWith('read-pointer:'))
        ).toBe(false);
        expect(store.pointerWrites).toEqual([]);
    });

    it('reports no-op and conflict distinctly from successful rollback', async () => {
        const active = new HistoryStore(previewReleaseA);
        active.forcePointer(
            pointerBytes(
                pointerFor(previewReleaseA, '2026-08-01T19:00:00.000Z')
            )
        );
        const noOp = await rollback(active, previewReleaseA);
        expect(noOp).toMatchObject({
            command: 'rollback',
            status: 'no-op',
            counts: { pointersWritten: 0 },
            pointer: {
                beforeReleaseId: previewReleaseA.releaseId,
                afterReleaseId: previewReleaseA.releaseId,
                changed: false,
            },
        });
        expect(publisherReportExitCode(noOp)).toBe(0);

        const conflict = new HistoryStore(previewReleaseA, previewReleaseB);
        conflict.beforeCompareAndSwap = current => {
            current.forcePointer(
                pointerBytes(
                    pointerFor(previewReleaseB, '2026-08-01T20:00:00.001Z')
                )
            );
        };
        const conflictReport = await rollback(conflict, previewReleaseA);
        expect(conflictReport).toMatchObject({
            command: 'rollback',
            status: 'conflict',
            counts: { pointersWritten: 0 },
            pointer: { changed: false },
        });
        expect(publisherReportExitCode(conflictReport)).toBe(4);
    });
});
