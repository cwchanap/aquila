import {
    AssetResolverError,
    RUNTIME_ASSET_CACHE_POLICY,
    type ResolvedAsset,
    type RuntimeAssetEntryV1,
} from '@aquila/stories/runtime-assets';
import { sha256Hex } from './hash';
import type { DecodedAsset } from './types';

export type DecodeResult = {
    width: number;
    height: number;
    close: () => void;
};

export type DecodeImage = (blob: Blob) => Promise<DecodeResult>;

export type DecodedAssetCacheOptions = {
    fetchImpl?: typeof fetch;
    decodeImage?: DecodeImage;
};

type AssetVariant = RuntimeAssetEntryV1['variants']['webp'];
type AvifAssetVariant = NonNullable<RuntimeAssetEntryV1['variants']['avif']>;
type SupportedAssetVariant = AssetVariant | AvifAssetVariant;

type SelectedVariant = {
    variant: SupportedAssetVariant;
    url: URL;
};

type PendingLoad = {
    controller: AbortController;
    promise: Promise<DecodedAsset>;
};

type AvifSupportProbe = {
    controller: AbortController;
    promise: Promise<boolean>;
    subscribers: number;
    settled: boolean;
};

type AssetBytes = Uint8Array<ArrayBuffer>;

const defaultDecodeImage: DecodeImage = async blob => {
    const bitmap = await createImageBitmap(blob);
    return {
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
    };
};

const avifSupportProbes = new WeakMap<
    DecodeImage,
    WeakMap<typeof fetch, AvifSupportProbe>
>();

function createAvifSupportProbe(
    decodeImage: DecodeImage,
    fetchImpl: typeof fetch
): AvifSupportProbe {
    const controller = new AbortController();
    const probe = {
        controller,
        promise: Promise.resolve(false),
        subscribers: 0,
        settled: false,
    };
    const aborted = new Promise<boolean>(resolve => {
        controller.signal.addEventListener('abort', () => resolve(false), {
            once: true,
        });
    });
    const attempted = fetchImpl(new URL('./avif-probe.avif', import.meta.url), {
        signal: controller.signal,
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('AVIF capability probe was unavailable');
            }
            return response.blob();
        })
        .then(decodeImage)
        .then(image => {
            image.close();
            return true;
        })
        .catch(() => false);
    const timeout = globalThis.setTimeout(
        () => controller.abort(),
        RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset
    );
    probe.promise = Promise.race([attempted, aborted]).finally(() => {
        globalThis.clearTimeout(timeout);
        probe.settled = true;
    });
    return probe;
}

function waitForSignal<T>(
    promise: Promise<T>,
    signal: AbortSignal
): Promise<T> {
    if (signal.aborted) return Promise.reject(abortError(signal));
    return new Promise<T>((resolve, reject) => {
        const abort = () => {
            signal.removeEventListener('abort', abort);
            reject(abortError(signal));
        };
        signal.addEventListener('abort', abort, { once: true });
        promise.then(
            value => {
                signal.removeEventListener('abort', abort);
                resolve(value);
            },
            error => {
                signal.removeEventListener('abort', abort);
                reject(error);
            }
        );
    });
}

async function supportsAvif(
    decodeImage: DecodeImage,
    fetchImpl: typeof fetch,
    signal: AbortSignal
): Promise<boolean> {
    let probesForFetcher = avifSupportProbes.get(decodeImage);
    if (!probesForFetcher) {
        probesForFetcher = new WeakMap();
        avifSupportProbes.set(decodeImage, probesForFetcher);
    }
    let probe = probesForFetcher.get(fetchImpl);
    if (!probe) {
        probe = createAvifSupportProbe(decodeImage, fetchImpl);
        probesForFetcher.set(fetchImpl, probe);
    }
    probe.subscribers += 1;
    try {
        return await waitForSignal(probe.promise, signal);
    } finally {
        probe.subscribers -= 1;
        if (!probe.settled && probe.subscribers === 0) {
            if (probesForFetcher.get(fetchImpl) === probe) {
                probesForFetcher.delete(fetchImpl);
            }
            probe.controller.abort();
        }
    }
}

function cacheKeyFor(variant: SupportedAssetVariant): string {
    // HPA-227 objects are globally content-addressed, so identical immutable
    // bytes intentionally share one decoded entry across releases.
    return `${variant.format}:${variant.sha256}`;
}

function abortError(signal: AbortSignal): unknown {
    return (
        signal.reason ??
        new DOMException('The operation was aborted', 'AbortError')
    );
}

function asNetworkError(error: unknown, message: string): AssetResolverError {
    return error instanceof AssetResolverError
        ? error
        : new AssetResolverError('network', message, { cause: error });
}

export class DecodedAssetCache {
    private readonly fetchImpl: typeof fetch;
    private readonly decodeImage: DecodeImage;
    private readonly entries = new Map<string, DecodedAsset>();
    private readonly pendingLoads = new Map<string, PendingLoad>();
    private readonly fallbackKeys = new Map<string, string>();

    private protectedKeys = new Set<string>();
    private beforeRevoke: (objectUrl: string) => Promise<void> = async () => {};
    private totalDecodedBytes = 0;
    private lifecycleGeneration = 0;

    constructor(options: DecodedAssetCacheOptions = {}) {
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
        this.decodeImage = options.decodeImage ?? defaultDecodeImage;
    }

    get size(): number {
        return this.entries.size;
    }

    get decodedBytes(): number {
        return this.totalDecodedBytes;
    }

    get inFlight(): number {
        return this.pendingLoads.size;
    }

    async load(
        asset: ResolvedAsset,
        options?: { signal?: AbortSignal }
    ): Promise<DecodedAsset> {
        if (options?.signal?.aborted) throw abortError(options.signal);
        const generation = this.lifecycleGeneration;
        const avif =
            asset.asset.variants.avif && asset.avifUrl
                ? {
                      variant: asset.asset.variants.avif,
                      url: asset.avifUrl,
                  }
                : null;
        const webp: SelectedVariant = {
            variant: asset.asset.variants.webp,
            url: asset.webpUrl,
        };
        const requestKey =
            avif === null
                ? cacheKeyFor(webp.variant)
                : `${cacheKeyFor(avif.variant)}|${cacheKeyFor(webp.variant)}`;
        const pending = this.pendingLoads.get(requestKey);
        if (pending) return pending.promise;

        const controller = new AbortController();
        const abort = () => controller.abort(options?.signal?.reason);
        options?.signal?.addEventListener('abort', abort, { once: true });
        const promise = this.selectAndLoad(
            asset,
            avif,
            webp,
            controller.signal,
            generation
        ).finally(() => {
            options?.signal?.removeEventListener('abort', abort);
            const current = this.pendingLoads.get(requestKey);
            if (current?.promise === promise) {
                this.pendingLoads.delete(requestKey);
            }
        });
        this.pendingLoads.set(requestKey, { controller, promise });
        return promise;
    }

    async prefetch(
        asset: ResolvedAsset,
        options?: { signal?: AbortSignal }
    ): Promise<void> {
        try {
            await this.load(asset, options);
        } catch {
            // Decode prefetch is opportunistic. A foreground load must be able
            // to retry the same immutable object after any prefetch failure.
        }
    }

    setProtectedKeys(keys: ReadonlySet<string>): void {
        this.protectedKeys = new Set(keys);
    }

    setBeforeRevoke(hook: (objectUrl: string) => Promise<void>): void {
        this.beforeRevoke = hook;
    }

    async clear(): Promise<void> {
        this.lifecycleGeneration += 1;
        const pending = [...this.pendingLoads.values()];
        for (const load of pending) load.controller.abort();
        await Promise.allSettled(pending.map(load => load.promise));

        const completed = [...this.entries.values()];
        this.entries.clear();
        this.fallbackKeys.clear();
        this.totalDecodedBytes = 0;
        for (const decoded of completed) {
            await this.detachAndRevoke(decoded.objectUrl);
        }
    }

    private async selectAndLoad(
        asset: ResolvedAsset,
        avif: SelectedVariant | null,
        webp: SelectedVariant,
        signal: AbortSignal,
        generation: number
    ): Promise<DecodedAsset> {
        const useAvif =
            avif !== null &&
            (await supportsAvif(this.decodeImage, this.fetchImpl, signal));
        if (signal.aborted || generation !== this.lifecycleGeneration) {
            throw signal.aborted
                ? abortError(signal)
                : new DOMException('The operation was aborted', 'AbortError');
        }
        const primary = useAvif && avif ? avif : webp;
        const primaryKey = cacheKeyFor(primary.variant);
        const knownFallbackKey = this.fallbackKeys.get(primaryKey);
        const completed =
            this.touch(primaryKey) ??
            (knownFallbackKey ? this.touch(knownFallbackKey) : undefined);
        if (completed) return completed;
        return this.loadAndCache(asset, primary, webp, signal, generation);
    }

    private async loadAndCache(
        asset: ResolvedAsset,
        primary: SelectedVariant,
        webp: SelectedVariant,
        signal: AbortSignal,
        generation: number
    ): Promise<DecodedAsset> {
        let loaded: DecodedAsset;
        try {
            loaded = await this.loadVariant(asset, primary, signal);
        } catch (error) {
            if (
                primary.variant.format !== 'avif' ||
                signal.aborted ||
                generation !== this.lifecycleGeneration
            ) {
                throw error;
            }
            loaded = await this.loadVariant(asset, webp, signal);
            this.fallbackKeys.set(
                cacheKeyFor(primary.variant),
                loaded.cacheKey
            );
        }

        if (signal.aborted || generation !== this.lifecycleGeneration) {
            await this.detachAndRevoke(loaded.objectUrl);
            throw signal.aborted
                ? abortError(signal)
                : new DOMException('The operation was aborted', 'AbortError');
        }

        const existing = this.touch(loaded.cacheKey);
        if (existing) {
            await this.detachAndRevoke(loaded.objectUrl);
            return existing;
        }
        this.entries.set(loaded.cacheKey, loaded);
        this.totalDecodedBytes += loaded.decodedBytes;
        await this.evictToBounds();
        if (signal.aborted || generation !== this.lifecycleGeneration) {
            throw signal.aborted
                ? abortError(signal)
                : new DOMException('The operation was aborted', 'AbortError');
        }
        const admitted =
            this.entries.get(loaded.cacheKey) === loaded &&
            !this.exceedsBounds();
        if (!admitted) {
            if (this.entries.get(loaded.cacheKey) === loaded) {
                this.entries.delete(loaded.cacheKey);
                this.totalDecodedBytes -= loaded.decodedBytes;
                for (const [primaryKey, fallbackKey] of this.fallbackKeys) {
                    if (fallbackKey === loaded.cacheKey) {
                        this.fallbackKeys.delete(primaryKey);
                    }
                }
                await this.detachAndRevoke(loaded.objectUrl);
            }
            throw new AssetResolverError(
                'unavailable',
                'Decoded asset exceeds cache bounds'
            );
        }
        return loaded;
    }

    private async loadVariant(
        asset: ResolvedAsset,
        selected: SelectedVariant,
        signal: AbortSignal
    ): Promise<DecodedAsset> {
        const bytes = await this.fetchBytes(
            selected.url,
            selected.variant,
            signal
        );
        const blob = new Blob([bytes.buffer], {
            type: `image/${selected.variant.format}`,
        });
        let decoded: DecodeResult;
        try {
            decoded = await this.decodeImage(blob);
        } catch (cause) {
            throw new AssetResolverError(
                'unavailable',
                'Asset image could not be decoded',
                { cause }
            );
        }
        if (
            decoded.width !== asset.asset.width ||
            decoded.height !== asset.asset.height
        ) {
            decoded.close();
            throw new AssetResolverError(
                'integrity',
                'Asset dimensions mismatch'
            );
        }
        decoded.close();
        return {
            cacheKey: cacheKeyFor(selected.variant),
            objectUrl: URL.createObjectURL(blob),
            width: decoded.width,
            height: decoded.height,
            decodedBytes: decoded.width * decoded.height * 4,
        };
    }

    private async fetchBytes(
        url: URL,
        variant: SupportedAssetVariant,
        parentSignal: AbortSignal
    ): Promise<AssetBytes> {
        const controller = new AbortController();
        let timedOut = false;
        const timeout = globalThis.setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset);
        const abort = () => controller.abort(parentSignal.reason);
        parentSignal.addEventListener('abort', abort, { once: true });
        try {
            let response: Response;
            try {
                response = await this.fetchImpl(url, {
                    cache: 'force-cache',
                    signal: controller.signal,
                });
            } catch (cause) {
                if (timedOut) {
                    throw new AssetResolverError(
                        'timeout',
                        `Runtime asset request timed out after ${RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset}ms`,
                        { cause }
                    );
                }
                if (parentSignal.aborted) throw abortError(parentSignal);
                throw asNetworkError(cause, 'Runtime asset request failed');
            }
            if (!response.ok) {
                throw new AssetResolverError(
                    'unavailable',
                    `Runtime asset request returned HTTP ${response.status}`
                );
            }
            let bytes: AssetBytes;
            try {
                bytes = new Uint8Array(await response.arrayBuffer());
            } catch (cause) {
                throw asNetworkError(
                    cause,
                    'Runtime asset response could not be read'
                );
            }
            if (bytes.byteLength !== variant.byteLength) {
                throw new AssetResolverError(
                    'integrity',
                    'Asset byte length mismatch'
                );
            }
            if ((await sha256Hex(bytes.buffer)) !== variant.sha256) {
                throw new AssetResolverError(
                    'integrity',
                    'Asset checksum mismatch'
                );
            }
            return bytes;
        } finally {
            globalThis.clearTimeout(timeout);
            parentSignal.removeEventListener('abort', abort);
        }
    }

    private touch(key: string): DecodedAsset | undefined {
        const decoded = this.entries.get(key);
        if (!decoded) return undefined;
        this.entries.delete(key);
        this.entries.set(key, decoded);
        return decoded;
    }

    private async evictToBounds(): Promise<void> {
        while (this.exceedsBounds()) {
            const candidate = [...this.entries.entries()].find(
                ([key]) => !this.protectedKeys.has(key)
            );
            if (!candidate) return;
            const [key, decoded] = candidate;
            this.entries.delete(key);
            this.totalDecodedBytes -= decoded.decodedBytes;
            for (const [primaryKey, fallbackKey] of this.fallbackKeys) {
                if (fallbackKey === key) this.fallbackKeys.delete(primaryKey);
            }
            await this.detachAndRevoke(decoded.objectUrl);
        }
    }

    private exceedsBounds(): boolean {
        const { maxDecodedAssets, maxDecodedBytes } =
            RUNTIME_ASSET_CACHE_POLICY.clientBounds;
        return (
            this.entries.size > maxDecodedAssets ||
            this.totalDecodedBytes > maxDecodedBytes
        );
    }

    private async detachAndRevoke(objectUrl: string): Promise<void> {
        await this.beforeRevoke(objectUrl);
        URL.revokeObjectURL(objectUrl);
    }
}
