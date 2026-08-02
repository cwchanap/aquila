import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    canonicalJson,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    validatePointerManifestPair,
    type ActiveReleasePointerV1,
    type PublicationTarget,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import {
    MAX_PUBLISHER_FUTURE_SKEW_MS,
    activateStoredRelease,
    nextPublishedAt,
} from '../activation';
import { PublisherError } from '../errors';
import { sha256Bytes } from '../hash';
import { buildPreparedRelease } from '../runtime-release';
import type {
    DeliveryStore,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import type { EncodedAsset, EncodedVariant, PreparedRelease } from '../types';

const STORY_ID = 'example_story';
const PREVIEW_TARGET = { kind: 'preview', previewId: 'activation' } as const;
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

class ActivationStore implements DeliveryStore {
    readonly events: string[] = [];
    readonly pointerWrites: PointerWriteRequest[] = [];
    beforeCompareAndSwap?: (
        store: ActivationStore,
        request: PointerWriteRequest,
        attempt: number
    ) => void;

    private readonly objects = new Map<string, StoredObject>();
    private pointer: Extract<PointerSnapshot, { exists: true }> | null = null;
    private pointerVersion = 0;
    private compareAndSwapAttempts = 0;

    constructor(...releases: PreparedRelease[]) {
        for (const release of releases) this.seedRelease(release);
    }

    get authoringCatalog(): never {
        throw new Error('activation touched authoring input');
    }

    get releasePlan(): never {
        throw new Error('activation touched plan input');
    }

    get sourceRoot(): never {
        throw new Error('activation touched source input');
    }

    get encoder(): never {
        throw new Error('activation touched encoder input');
    }

    stat(): Promise<StoredObjectMetadata | null> {
        throw new Error('activation must not stat unrelated storage');
    }

    async read(key: string): Promise<StoredObject> {
        this.events.push(`read:${key}`);
        const object = this.objects.get(key);
        if (object === undefined) throw new Error('missing test object');
        return cloneObject(object);
    }

    createImmutable(): Promise<{
        status: 'created' | 'already-exists';
    }> {
        throw new Error('activation must not create immutable objects');
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        this.events.push(`read-pointer:${key}`);
        if (this.pointer === null) return { exists: false };
        return { ...this.pointer, bytes: Uint8Array.from(this.pointer.bytes) };
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        return this.readPointer(key);
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
        const expectationMatches =
            this.pointer === null
                ? request.expected.exists === false
                : request.expected.exists === true &&
                  request.expected.etag === this.pointer.etag;
        if (!expectationMatches) return { status: 'precondition-failed' };
        const etag = this.forcePointer(request.bytes, {
            contentType: request.contentType,
            cacheControl: request.cacheControl,
        });
        return { status: 'written', etag };
    }

    list(): AsyncIterable<StoredObjectMetadata> {
        throw new Error('activation must not list storage');
    }

    async close(): Promise<void> {}

    forcePointer(
        bytes: Uint8Array,
        metadata: { contentType: string; cacheControl: string } = {
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
            contentType: metadata.contentType,
            cacheControl: metadata.cacheControl,
        };
        return etag;
    }

    currentPointerBytes(): Uint8Array | null {
        return this.pointer === null
            ? null
            : Uint8Array.from(this.pointer.bytes);
    }

    corruptObject(key: string): void {
        const object = this.objects.get(key);
        if (object === undefined) throw new Error('missing test object');
        this.objects.set(key, {
            ...object,
            bytes: textEncoder.encode('not-an-image'),
            byteLength: textEncoder.encode('not-an-image').byteLength,
        });
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

function activate(
    store: DeliveryStore,
    release: PreparedRelease,
    options: {
        nowMs?: number;
        now?: () => number;
        reactivate?: boolean;
        overrideConcurrentPointer?: boolean;
        confirmProduction?: string;
    } = {}
) {
    return activateStoredRelease({
        store,
        storyId: release.storyId,
        target: release.target,
        releaseId: release.releaseId,
        expectedManifestSha256: release.manifestSha256,
        now:
            options.now ??
            (() => options.nowMs ?? Date.parse('2026-08-01T20:00:00.000Z')),
        reactivate: options.reactivate,
        overrideConcurrentPointer: options.overrideConcurrentPointer,
        confirmProduction: options.confirmProduction,
    });
}

describe('nextPublishedAt', () => {
    it('uses the local clock when no pointer exists', () => {
        expect(
            nextPublishedAt(
                { exists: false },
                Date.parse('2026-08-01T20:00:00.050Z')
            )
        ).toBe('2026-08-01T20:00:00.050Z');
    });

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

    it('normalizes a fractional local millisecond without repeating the prior timestamp', () => {
        expect(
            nextPublishedAt(
                {
                    exists: true,
                    pointer: {
                        publishedAt: '1970-01-01T00:00:00.100Z',
                    },
                },
                100.9
            )
        ).toBe('1970-01-01T00:00:00.101Z');
    });

    it('allows exactly five minutes of future skew and advances beyond it', () => {
        expect(
            nextPublishedAt(
                {
                    exists: true,
                    pointer: {
                        publishedAt: '2026-08-01T20:05:00.000Z',
                    },
                },
                Date.parse('2026-08-01T20:00:00.000Z')
            )
        ).toBe('2026-08-01T20:05:00.001Z');
    });

    it('rejects a pointer more than five minutes ahead without exposing pointer bytes', () => {
        let thrown: unknown;
        try {
            nextPublishedAt(
                {
                    exists: true,
                    pointer: {
                        publishedAt: '2026-08-01T20:05:00.001Z',
                    },
                },
                Date.parse('2026-08-01T20:00:00.000Z')
            );
        } catch (error) {
            thrown = error;
        }
        expect(MAX_PUBLISHER_FUTURE_SKEW_MS).toBe(300_000);
        expect(thrown).toMatchObject({
            name: 'PublisherError',
            code: 'clock-skew',
            context: {
                previousPublishedAt: '2026-08-01T20:05:00.001Z',
                localNow: '2026-08-01T20:00:00.000Z',
            },
        });
    });
});

describe('activateStoredRelease', () => {
    it('deep-verifies the stored target, then fresh-reads and writes only current.json', async () => {
        const store = new ActivationStore(previewReleaseA);

        const result = await activate(store, previewReleaseA);

        const pointerKey = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            previewReleaseA.releaseId,
            PREVIEW_TARGET
        );
        const pointerRead = store.events.indexOf(`read-pointer:${pointerKey}`);
        expect(result).toMatchObject({
            status: 'success',
            releaseId: previewReleaseA.releaseId,
            manifestSha256: previewReleaseA.manifestSha256,
            overrideAttempted: false,
        });
        expect(store.events[0]).toBe(`read:${manifestPath}`);
        expect(
            store.events.filter(event => event.startsWith('read:')).length
        ).toBe(3);
        expect(store.events.slice(pointerRead)).toEqual([
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

        const writtenText = textDecoder.decode(store.pointerWrites[0]!.bytes);
        const expectedText = `{"manifestPath":"${manifestPath}","manifestSha256":"${previewReleaseA.manifestSha256}","publishedAt":"2026-08-01T20:00:00.000Z","releaseId":"${previewReleaseA.releaseId}","schemaVersion":1,"storyId":"${STORY_ID}"}\n`;
        expect(writtenText).toBe(expectedText);
        const parsed = parseActiveReleasePointer(
            JSON.parse(writtenText),
            PREVIEW_TARGET,
            STORY_ID
        );
        expect(() =>
            validatePointerManifestPair(
                parsed,
                previewReleaseA.manifest,
                previewReleaseA.manifestSha256
            )
        ).not.toThrow();
    });

    it('rejects a corrupt stored object before reading or mutating the pointer', async () => {
        const store = new ActivationStore(previewReleaseA);
        store.corruptObject(
            previewReleaseA.encodedAssets[0]!.variants[0]!.path
        );

        await expect(activate(store, previewReleaseA)).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
        expect(
            store.events.some(event => event.startsWith('read-pointer:'))
        ).toBe(false);
        expect(store.pointerWrites).toEqual([]);
    });

    it('reports an already active release as a no-op without production confirmation', async () => {
        const store = new ActivationStore(productionReleaseA);
        const active = pointerFor(
            productionReleaseA,
            '2026-08-01T19:59:00.000Z'
        );
        store.forcePointer(pointerBytes(active));

        const result = await activate(store, productionReleaseA);

        expect(result).toMatchObject({
            status: 'no-op',
            releaseId: productionReleaseA.releaseId,
            overrideAttempted: false,
        });
        expect(store.pointerWrites).toEqual([]);
        expect(decodePointer(store.currentPointerBytes()!).publishedAt).toBe(
            '2026-08-01T19:59:00.000Z'
        );
    });

    it('rejects a same-release pointer whose manifest checksum does not match the verified target', async () => {
        const store = new ActivationStore(previewReleaseA);
        store.forcePointer(
            pointerBytes({
                ...pointerFor(previewReleaseA, '2026-08-01T19:59:00.000Z'),
                manifestSha256: '0'.repeat(
                    64
                ) as PreparedRelease['manifestSha256'],
            })
        );

        await expect(activate(store, previewReleaseA)).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'activation-target',
        });
        expect(store.pointerWrites).toEqual([]);
    });

    it('reactivates the same release with a strictly newer timestamp', async () => {
        const store = new ActivationStore(previewReleaseA);
        store.forcePointer(
            pointerBytes(
                pointerFor(previewReleaseA, '2026-08-01T20:00:00.100Z')
            )
        );

        const result = await activate(store, previewReleaseA, {
            nowMs: Date.parse('2026-08-01T20:00:00.050Z'),
            reactivate: true,
        });

        expect(result.status).toBe('success');
        expect(decodePointer(store.pointerWrites[0]!.bytes).publishedAt).toBe(
            '2026-08-01T20:00:00.101Z'
        );
    });

    it('returns conflict when the fresh opaque ETag loses its conditional write', async () => {
        const store = new ActivationStore(previewReleaseA, previewReleaseB);
        store.beforeCompareAndSwap = (current, _request, attempt) => {
            if (attempt === 1) {
                current.forcePointer(
                    pointerBytes(
                        pointerFor(previewReleaseB, '2026-08-01T20:00:00.010Z')
                    )
                );
            }
        };

        const result = await activate(store, previewReleaseA);

        expect(result).toMatchObject({
            status: 'conflict',
            overrideAttempted: false,
        });
        expect(store.pointerWrites).toHaveLength(1);
        expect(store.pointerWrites[0]!.expected).toEqual({ exists: false });
        expect(decodePointer(store.currentPointerBytes()!).releaseId).toBe(
            previewReleaseB.releaseId
        );
    });

    it('deep-reverifies, then fresh-rereads and makes one refreshed CAS on override', async () => {
        const store = new ActivationStore(previewReleaseA, previewReleaseB);
        store.beforeCompareAndSwap = (current, _request, attempt) => {
            if (attempt === 1) {
                current.forcePointer(
                    pointerBytes(
                        pointerFor(previewReleaseB, '2026-08-01T20:00:00.010Z')
                    )
                );
            }
        };

        const result = await activate(store, previewReleaseA, {
            overrideConcurrentPointer: true,
            now: () => {
                store.events.push('now');
                return Date.parse('2026-08-01T20:00:00.000Z');
            },
        });

        const pointerKey = getCurrentPointerPath(STORY_ID, PREVIEW_TARGET);
        const manifestPath = getReleaseManifestPath(
            STORY_ID,
            previewReleaseA.releaseId,
            PREVIEW_TARGET
        );
        expect(result).toMatchObject({
            status: 'success',
            overrideAttempted: true,
        });
        expect(
            store.events.filter(event => event === `read-pointer:${pointerKey}`)
        ).toHaveLength(2);
        expect(
            store.events.filter(event => event === `read:${manifestPath}`)
        ).toHaveLength(2);
        expect(store.pointerWrites).toHaveLength(2);
        expect(store.pointerWrites[1]!.expected).toEqual({
            exists: true,
            etag: 'W/"opaque-1"',
        });
        const secondRead = store.events.lastIndexOf(
            `read-pointer:${pointerKey}`
        );
        const secondManifestRead = store.events.lastIndexOf(
            `read:${manifestPath}`
        );
        const secondCas = store.events.lastIndexOf(`cas:${pointerKey}`);
        const secondNow = store.events.lastIndexOf('now');
        expect(secondManifestRead).toBeLessThan(secondRead);
        expect(secondRead).toBeLessThan(secondNow);
        expect(secondNow).toBeLessThan(secondCas);
        expect(store.events.slice(secondRead)).toEqual([
            `read-pointer:${pointerKey}`,
            'now',
            `cas:${pointerKey}`,
        ]);
        expect(decodePointer(store.pointerWrites[1]!.bytes).publishedAt).toBe(
            '2026-08-01T20:00:00.011Z'
        );
    });

    it('bounds an override to one refreshed CAS', async () => {
        const store = new ActivationStore(previewReleaseA, previewReleaseB);
        store.beforeCompareAndSwap = (current, _request, attempt) => {
            const release = attempt === 1 ? previewReleaseB : previewReleaseA;
            current.forcePointer(
                pointerBytes(
                    pointerFor(release, `2026-08-01T20:00:00.0${attempt}0Z`)
                )
            );
        };

        const result = await activate(store, previewReleaseA, {
            overrideConcurrentPointer: true,
        });

        expect(result).toMatchObject({
            status: 'conflict',
            overrideAttempted: true,
        });
        expect(store.pointerWrites).toHaveLength(2);
    });

    it('creates distinct canonical bytes and increasing timestamps for A to B to A', async () => {
        const store = new ActivationStore(previewReleaseA, previewReleaseB);
        const nowMs = Date.parse('2026-08-01T20:00:00.000Z');

        await activate(store, previewReleaseA, { nowMs });
        await activate(store, previewReleaseB, { nowMs });
        await activate(store, previewReleaseA, { nowMs });

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

    it('rejects malformed current pointers with a safe activation-target error', async () => {
        const store = new ActivationStore(previewReleaseA);
        const secret = 'authoring-secret-do-not-report';
        store.forcePointer(textEncoder.encode(`{"publishedAt":"${secret}"`));

        let thrown: unknown;
        try {
            await activate(store, previewReleaseA);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(PublisherError);
        expect(thrown).toMatchObject({
            code: 'activation-target',
            context: {
                stage: 'activation',
                key: getCurrentPointerPath(STORY_ID, PREVIEW_TARGET),
            },
        });
        expect(String(thrown)).not.toContain(secret);
        expect(
            JSON.stringify((thrown as PublisherError).context)
        ).not.toContain(secret);
        expect(store.pointerWrites).toEqual([]);
    });

    it('requires an exact story confirmation only for production mutation', async () => {
        const missingConfirmation = new ActivationStore(productionReleaseA);
        const wrongConfirmation = new ActivationStore(productionReleaseA);

        await expect(
            activate(missingConfirmation, productionReleaseA)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'activation-target',
        });
        await expect(
            activate(wrongConfirmation, productionReleaseA, {
                confirmProduction: `${STORY_ID}_wrong`,
            })
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'activation-target',
        });
        expect(missingConfirmation.pointerWrites).toEqual([]);
        expect(wrongConfirmation.pointerWrites).toEqual([]);

        const confirmed = new ActivationStore(productionReleaseA);
        await expect(
            activate(confirmed, productionReleaseA, {
                confirmProduction: STORY_ID,
            })
        ).resolves.toMatchObject({ status: 'success' });
        expect(confirmed.pointerWrites).toHaveLength(1);
    });
});
