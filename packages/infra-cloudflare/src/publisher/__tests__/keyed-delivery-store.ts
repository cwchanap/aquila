import {
    RUNTIME_ASSET_CACHE_POLICY,
    getAudioReleaseManifestPath,
    getReleaseManifestPath,
} from '@aquila/stories/runtime-assets';
import type {
    DeliveryStore,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import type { PreparedAudioRelease, PreparedRelease } from '../types';

export const IMMUTABLE_CACHE =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
export const POINTER_CACHE =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;

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

function manifestKeyOf(
    release: PreparedRelease | PreparedAudioRelease
): string {
    return 'encodedAssets' in release
        ? getReleaseManifestPath(
              release.storyId,
              release.releaseId,
              release.target
          )
        : getAudioReleaseManifestPath(
              release.storyId,
              release.releaseId,
              release.target
          );
}

/**
 * Keyed DeliveryStore test double that seeds both visual and audio releases
 * and tracks one pointer slot per key, like a real bucket. Options:
 * - `forbidStorageScans`: stat/list/listKeys throw instead of serving —
 *   activation flows must never touch them, so the throw is a tripwire.
 */
export class KeyedDeliveryStore implements DeliveryStore {
    readonly events: string[] = [];
    readonly pointerWrites: PointerWriteRequest[] = [];
    listedKeys: string[];
    listFailure?: unknown;
    listKeysFailure?: unknown;
    statFailure?: unknown;
    readonly forbidStorageScans: boolean;
    beforeCompareAndSwap?: (
        store: KeyedDeliveryStore,
        request: PointerWriteRequest,
        attempt: number
    ) => void;

    private readonly objects = new Map<string, StoredObject>();
    private readonly pointers = new Map<
        string,
        Extract<PointerSnapshot, { exists: true }>
    >();
    private pointerVersion = 0;
    private compareAndSwapAttempts = 0;

    constructor(
        releases: Array<PreparedRelease | PreparedAudioRelease> = [],
        options: { readonly forbidStorageScans?: boolean } = {}
    ) {
        this.forbidStorageScans = options.forbidStorageScans ?? false;
        for (const release of releases) this.seedRelease(release);
        this.listedKeys = releases.map(manifestKeyOf);
    }

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        this.events.push(`stat:${key}`);
        if (this.forbidStorageScans)
            throw new Error('activation must not stat unrelated storage');
        if (this.statFailure !== undefined) throw this.statFailure;
        const object = this.objects.get(key);
        return object === undefined ? null : metadata(object);
    }

    async read(key: string): Promise<StoredObject> {
        this.events.push(`read:${key}`);
        const object = this.objects.get(key);
        if (object === undefined)
            throw new Error(`missing test object: ${key}`);
        return cloneObject(object);
    }

    createImmutable(): Promise<{ status: 'created' | 'already-exists' }> {
        throw new Error('activation and history must not create objects');
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        this.events.push(`inspect-pointer:${key}`);
        return this.pointerSnapshot(key);
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        this.events.push(`read-pointer:${key}`);
        return this.pointerSnapshot(key);
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
        const current = this.pointers.get(request.key);
        const expectationMatches =
            current === undefined
                ? request.expected.exists === false
                : request.expected.exists === true &&
                  request.expected.etag === current.etag;
        if (!expectationMatches) return { status: 'precondition-failed' };
        const etag = this.forcePointer(request.key, request.bytes, {
            contentType: request.contentType,
            cacheControl: request.cacheControl,
        });
        return { status: 'written', etag };
    }

    async *list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        this.events.push(`list:${prefix}`);
        if (this.forbidStorageScans)
            throw new Error('activation must not list storage');
        if (this.listFailure !== undefined) throw this.listFailure;
        for (const key of this.listedKeys) {
            if (!key.startsWith(prefix)) continue;
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
        if (this.forbidStorageScans)
            throw new Error('activation must not list storage');
        if (this.listKeysFailure !== undefined) throw this.listKeysFailure;
        for (const key of this.listedKeys) {
            if (!key.startsWith(prefix)) continue;
            yield key;
        }
    }

    async close(): Promise<void> {}

    forcePointer(
        key: string,
        bytes: Uint8Array,
        metadataValue: {
            contentType?: string;
            cacheControl?: string;
            customMetadata?: Readonly<Record<string, string>>;
        } = {}
    ): string {
        this.pointerVersion += 1;
        const etag = `W/"media-opaque-${this.pointerVersion}"`;
        this.pointers.set(key, {
            exists: true,
            etag,
            bytes: Uint8Array.from(bytes),
            contentType: metadataValue.contentType ?? 'application/json',
            cacheControl: metadataValue.cacheControl ?? POINTER_CACHE,
            customMetadata: { ...(metadataValue.customMetadata ?? {}) },
        });
        return etag;
    }

    currentPointerBytes(key: string): Uint8Array | null {
        const pointer = this.pointers.get(key);
        return pointer === undefined ? null : Uint8Array.from(pointer.bytes);
    }

    remove(key: string): void {
        this.objects.delete(key);
    }

    mutate(key: string, mutate: (object: StoredObject) => StoredObject): void {
        const object = this.objects.get(key);
        if (object === undefined) throw new Error('missing test object');
        this.objects.set(key, mutate(cloneObject(object)));
    }

    corruptObject(key: string, bytes: Uint8Array): void {
        this.mutate(key, object => ({
            ...object,
            bytes,
            byteLength: bytes.byteLength,
        }));
    }

    private pointerSnapshot(key: string): PointerSnapshot {
        const pointer = this.pointers.get(key);
        return pointer === undefined
            ? { exists: false }
            : { ...pointer, bytes: Uint8Array.from(pointer.bytes) };
    }

    private seedRelease(release: PreparedRelease | PreparedAudioRelease): void {
        if ('encodedAssets' in release) {
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
            return;
        }

        for (const asset of release.assets) {
            this.objects.set(asset.path, {
                key: asset.path,
                etag: `immutable-${asset.sha256}`,
                bytes: Uint8Array.from(asset.bytes),
                byteLength: asset.bytes.byteLength,
                contentType: asset.contentType,
                cacheControl: IMMUTABLE_CACHE,
                customMetadata: {},
            });
        }
        const manifestPath = getAudioReleaseManifestPath(
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
