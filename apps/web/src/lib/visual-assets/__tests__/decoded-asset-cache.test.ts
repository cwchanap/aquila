import { createHash, webcrypto } from 'node:crypto';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    assertSha256,
    type ResolvedAsset,
} from '@aquila/stories/runtime-assets';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DecodedAssetCache } from '../decoded-asset-cache';

const OriginalURL = globalThis.URL;
const MiB = 1024 * 1024;

type DecodeResult = {
    width: number;
    height: number;
    close: () => void;
};

type DecodeImage = (blob: Blob) => Promise<DecodeResult>;

function digest(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function bytes(label: string): Uint8Array {
    return new TextEncoder().encode(label);
}

function response(body: Uint8Array, type = 'image/webp'): Response {
    return new Response(Uint8Array.from(body).buffer, {
        status: 200,
        headers: { 'content-type': type },
    });
}

function createResolvedAsset({
    label = 'webp',
    width = 1600,
    height = 900,
    webpBytes = bytes(label),
    webpSha256 = digest(webpBytes),
    webpByteLength = webpBytes.byteLength,
    avifBytes,
}: {
    label?: string;
    width?: number;
    height?: number;
    webpBytes?: Uint8Array;
    webpSha256?: string;
    webpByteLength?: number;
    avifBytes?: Uint8Array;
} = {}): ResolvedAsset {
    const webp = {
        format: 'webp' as const,
        path: `vn/objects/${webpSha256}.webp`,
        sha256: assertSha256<'object-content'>(webpSha256),
        byteLength: webpByteLength,
    };
    const avifSha256 = avifBytes ? digest(avifBytes) : undefined;
    return {
        status: 'resolved',
        asset: {
            identity: { type: 'background', key: label },
            variants: {
                webp,
                avif:
                    avifBytes && avifSha256
                        ? {
                              format: 'avif',
                              path: `vn/objects/${avifSha256}.avif`,
                              sha256: assertSha256<'object-content'>(
                                  avifSha256
                              ),
                              byteLength: avifBytes.byteLength,
                          }
                        : undefined,
            },
            width,
            height,
        },
        webpUrl: new URL(`https://cdn.example.test/${webp.path}`),
        avifUrl:
            avifBytes && avifSha256
                ? new URL(
                      `https://cdn.example.test/vn/objects/${avifSha256}.avif`
                  )
                : undefined,
    };
}

function createFetch(
    bodies: ReadonlyMap<string, { bytes: Uint8Array; type?: string }>
): typeof fetch {
    return vi.fn(async (input: RequestInfo | URL) => {
        const body = bodies.get(String(input));
        return body
            ? response(body.bytes, body.type)
            : new Response('missing', { status: 404 });
    }) as typeof fetch;
}

function successfulDecoder(
    width = 1600,
    height = 900
): ReturnType<typeof vi.fn<DecodeImage>> {
    return vi.fn(async () => ({
        width,
        height,
        close: vi.fn(),
    }));
}

describe('DecodedAssetCache', () => {
    let createObjectUrlSpy: ReturnType<typeof vi.fn>;
    let revokeObjectUrlSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
        let nextObjectUrl = 0;
        createObjectUrlSpy = vi.fn(
            () => `blob:https://reader.test/${++nextObjectUrl}`
        );
        revokeObjectUrlSpy = vi.fn();
        class URLWithBlobMethods extends OriginalURL {
            static createObjectURL = createObjectUrlSpy;
            static revokeObjectURL = revokeObjectUrlSpy;
        }
        vi.stubGlobal('URL', URLWithBlobMethods);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('deduplicates the same immutable object and verifies it once', async () => {
        const assetBytes = bytes('same-object');
        const resolvedAsset = createResolvedAsset({
            label: 'same-object',
            webpBytes: assetBytes,
        });
        const fetchSpy = createFetch(
            new Map([[resolvedAsset.webpUrl.href, { bytes: assetBytes }]])
        );
        const decodeSpy = successfulDecoder();
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: decodeSpy,
        });

        const [first, second] = await Promise.all([
            cache.load(resolvedAsset),
            cache.load(resolvedAsset),
        ]);

        expect(first).toBe(second);
        expect(first.cacheKey).toBe(`webp:${digest(assetBytes)}`);
        expect(fetchSpy).toHaveBeenCalledOnce();
        expect(decodeSpy).toHaveBeenCalledOnce();
        expect(cache.size).toBe(1);
        expect(cache.decodedBytes).toBe(1600 * 900 * 4);
    });

    it.each([
        {
            name: 'byte length',
            build: () => {
                const assetBytes = bytes('wrong-length');
                return {
                    asset: createResolvedAsset({
                        label: 'wrong-length',
                        webpBytes: assetBytes,
                        webpByteLength: assetBytes.byteLength + 1,
                    }),
                    assetBytes,
                };
            },
        },
        {
            name: 'checksum',
            build: () => {
                const assetBytes = bytes('wrong-checksum');
                return {
                    asset: createResolvedAsset({
                        label: 'wrong-checksum',
                        webpBytes: assetBytes,
                        webpSha256: 'a'.repeat(64),
                    }),
                    assetBytes,
                };
            },
        },
    ])(
        'rejects a $name mismatch without caching an object URL',
        async entry => {
            const { asset, assetBytes } = entry.build();
            const cache = new DecodedAssetCache({
                fetchImpl: createFetch(
                    new Map([[asset.webpUrl.href, { bytes: assetBytes }]])
                ),
                decodeImage: successfulDecoder(),
            });

            await expect(cache.load(asset)).rejects.toMatchObject({
                code: 'integrity',
            });

            expect(cache.size).toBe(0);
            expect(createObjectUrlSpy).not.toHaveBeenCalled();
        }
    );

    it('rejects an intrinsic-dimension mismatch and closes the decoded image', async () => {
        const assetBytes = bytes('wrong-dimensions');
        const asset = createResolvedAsset({
            label: 'wrong-dimensions',
            webpBytes: assetBytes,
        });
        const close = vi.fn();
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map([[asset.webpUrl.href, { bytes: assetBytes }]])
            ),
            decodeImage: vi.fn(async () => ({
                width: 1599,
                height: 900,
                close,
            })),
        });

        await expect(cache.load(asset)).rejects.toMatchObject({
            code: 'integrity',
        });

        expect(close).toHaveBeenCalledOnce();
        expect(cache.size).toBe(0);
        expect(createObjectUrlSpy).not.toHaveBeenCalled();
    });

    it('reports the exact 15-second asset timeout without retaining the load', async () => {
        vi.useFakeTimers();
        const asset = createResolvedAsset({ label: 'timeout' });
        const fetchSpy = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener(
                        'abort',
                        () =>
                            reject(
                                new DOMException(
                                    'The operation was aborted',
                                    'AbortError'
                                )
                            ),
                        { once: true }
                    );
                })
        ) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(),
        });

        const load = cache.load(asset);
        const rejection = expect(load).rejects.toMatchObject({
            code: 'timeout',
        });
        await vi.advanceTimersByTimeAsync(
            RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset
        );

        await rejection;
        expect(cache.size).toBe(0);
        expect(cache.inFlight).toBe(0);
    });

    it('tracks a stalled AVIF probe and falls back to WebP after 15 seconds', async () => {
        vi.useFakeTimers();
        const webpBytes = bytes('probe-timeout-webp');
        const asset = createResolvedAsset({
            label: 'probe-timeout',
            webpBytes,
            avifBytes: bytes('probe-timeout-avif'),
        });
        let releaseProbe!: () => void;
        const fetchMock = vi.fn(
            (input: RequestInfo | URL, init?: RequestInit) => {
                if (String(input).includes('avif-probe.avif')) {
                    return new Promise<Response>((resolve, reject) => {
                        releaseProbe = () =>
                            resolve(
                                new Response('late probe', { status: 503 })
                            );
                        init?.signal?.addEventListener(
                            'abort',
                            () =>
                                reject(
                                    new DOMException(
                                        'The operation was aborted',
                                        'AbortError'
                                    )
                                ),
                            { once: true }
                        );
                    });
                }
                if (String(input) === asset.webpUrl.href) {
                    return Promise.resolve(response(webpBytes));
                }
                return Promise.resolve(
                    new Response('unexpected', { status: 500 })
                );
            }
        );
        const cache = new DecodedAssetCache({
            fetchImpl: fetchMock as typeof fetch,
            decodeImage: successfulDecoder(),
        });
        const load = cache.load(asset);
        const outcome = load.then(
            value => ({ status: 'resolved' as const, value }),
            error => ({ status: 'rejected' as const, error })
        );

        try {
            await Promise.resolve();
            expect(cache.inFlight).toBe(1);
            await vi.advanceTimersByTimeAsync(
                RUNTIME_ASSET_CACHE_POLICY.timeoutMs.asset
            );

            await expect(outcome).resolves.toMatchObject({
                status: 'resolved',
                value: {
                    cacheKey: `webp:${digest(webpBytes)}`,
                },
            });
            expect(
                fetchMock.mock.calls.some(([input]) =>
                    String(input).includes(asset.avifUrl?.href ?? '')
                )
            ).toBe(false);
        } finally {
            releaseProbe();
            await outcome;
            await cache.clear();
        }
    });

    it('clear aborts and waits for a load that is probing AVIF support', async () => {
        const asset = createResolvedAsset({
            label: 'clear-during-probe',
            avifBytes: bytes('clear-during-probe-avif'),
        });
        let releaseProbe!: () => void;
        let probeAborted = false;
        const fetchMock = vi.fn(
            (input: RequestInfo | URL, init?: RequestInit) => {
                if (String(input).includes('avif-probe.avif')) {
                    return new Promise<Response>((resolve, reject) => {
                        releaseProbe = () =>
                            resolve(
                                new Response('late probe', { status: 503 })
                            );
                        init?.signal?.addEventListener(
                            'abort',
                            () => {
                                probeAborted = true;
                                reject(
                                    new DOMException(
                                        'The operation was aborted',
                                        'AbortError'
                                    )
                                );
                            },
                            { once: true }
                        );
                    });
                }
                return Promise.resolve(
                    new Response('unexpected', { status: 500 })
                );
            }
        );
        const cache = new DecodedAssetCache({
            fetchImpl: fetchMock as typeof fetch,
            decodeImage: successfulDecoder(),
        });
        const load = cache.load(asset);
        const outcome = load.then(
            value => ({ status: 'resolved' as const, value }),
            error => ({ status: 'rejected' as const, error })
        );

        try {
            await Promise.resolve();
            await cache.clear();

            expect(probeAborted).toBe(true);
            await expect(outcome).resolves.toMatchObject({
                status: 'rejected',
                error: { name: 'AbortError' },
            });
            expect(cache.inFlight).toBe(0);
        } finally {
            releaseProbe();
            await outcome;
        }
    });

    it('does not retain a failed decode or prefetch promise', async () => {
        const assetBytes = bytes('retry-after-decode');
        const asset = createResolvedAsset({
            label: 'retry-after-decode',
            webpBytes: assetBytes,
        });
        const fetchSpy = createFetch(
            new Map([[asset.webpUrl.href, { bytes: assetBytes }]])
        );
        const decodeSpy = successfulDecoder();
        decodeSpy
            .mockRejectedValueOnce(new Error('foreground decode failed'))
            .mockRejectedValueOnce(new Error('prefetch decode failed'));
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: decodeSpy,
        });

        await expect(cache.load(asset)).rejects.toMatchObject({
            code: 'unavailable',
        });
        await expect(cache.prefetch(asset)).resolves.toBeUndefined();
        await expect(cache.load(asset)).resolves.toMatchObject({
            width: 1600,
            height: 900,
        });

        expect(fetchSpy).toHaveBeenCalledTimes(3);
        expect(decodeSpy).toHaveBeenCalledTimes(3);
        expect(cache.size).toBe(1);
    });

    it('probes AVIF once and uses required WebP when the browser cannot decode the probe', async () => {
        const firstWebp = bytes('first-webp');
        const firstAvif = bytes('first-avif');
        const secondWebp = bytes('second-webp');
        const secondAvif = bytes('second-avif');
        const first = createResolvedAsset({
            label: 'first-avif-capability',
            webpBytes: firstWebp,
            avifBytes: firstAvif,
        });
        const second = createResolvedAsset({
            label: 'second-avif-capability',
            webpBytes: secondWebp,
            avifBytes: secondAvif,
        });
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return response(bytes('unsupported-probe'), 'image/avif');
            }
            const bodies = new Map([
                [first.webpUrl.href, firstWebp],
                [second.webpUrl.href, secondWebp],
            ]);
            const body = bodies.get(url);
            return body
                ? response(body)
                : new Response('unexpected', { status: 500 });
        });
        const fetchSpy = fetchMock as typeof fetch;
        const decodeSpy = vi.fn<DecodeImage>(async blob => {
            if (blob.type === 'image/avif') {
                throw new Error('AVIF unsupported');
            }
            return { width: 1600, height: 900, close: vi.fn() };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: decodeSpy,
        });

        await cache.load(first);
        await cache.load(second);

        expect(
            fetchMock.mock.calls.filter(([input]) =>
                String(input).includes('avif-probe.avif')
            )
        ).toHaveLength(1);
        expect(
            fetchMock.mock.calls.some(([input]) =>
                String(input).endsWith('.avif')
            )
        ).toBe(true);
        expect(
            fetchMock.mock.calls.filter(([input]) =>
                String(input).includes('/vn/objects/')
            )
        ).toEqual([
            [first.webpUrl, expect.any(Object)],
            [second.webpUrl, expect.any(Object)],
        ]);
    });

    it('falls back to required WebP when a supported AVIF object fails to decode', async () => {
        const webpBytes = bytes('fallback-webp');
        const avifBytes = bytes('broken-avif');
        const asset = createResolvedAsset({
            label: 'broken-avif',
            webpBytes,
            avifBytes,
        });
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return response(bytes('valid-avif-probe'), 'image/avif');
            }
            if (url === asset.avifUrl?.href) {
                return response(avifBytes, 'image/avif');
            }
            if (url === asset.webpUrl.href) return response(webpBytes);
            return new Response('unexpected', { status: 500 });
        });
        const fetchSpy = fetchMock as typeof fetch;
        const decodeSpy = vi.fn<DecodeImage>(async blob => {
            const body = await blob.text();
            if (body === 'broken-avif') throw new Error('invalid AVIF');
            return { width: 1600, height: 900, close: vi.fn() };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: decodeSpy,
        });

        const decoded = await cache.load(asset);

        expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
            expect.stringContaining('avif-probe.avif'),
            asset.avifUrl?.href,
            asset.webpUrl.href,
        ]);
        expect(decoded.objectUrl).toBe('blob:https://reader.test/1');
        expect(cache.size).toBe(1);
    });

    it('evicts least-recently-used entries at 48 objects and keeps recently used entries', async () => {
        const assets = Array.from({ length: 49 }, (_, index) => {
            const body = bytes(`count-${index}`);
            return {
                asset: createResolvedAsset({
                    label: `count-${index}`,
                    width: 1,
                    height: 1,
                    webpBytes: body,
                }),
                body,
            };
        });
        const fetchSpy = createFetch(
            new Map(
                assets.map(({ asset, body }) => [
                    asset.webpUrl.href,
                    { bytes: body },
                ])
            )
        );
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(1, 1),
        });
        const decoded = [];
        for (const { asset } of assets.slice(0, 48)) {
            decoded.push(await cache.load(asset));
        }
        await cache.load(assets[0].asset);

        await cache.load(assets[48].asset);

        expect(cache.size).toBe(48);
        expect(revokeObjectUrlSpy).toHaveBeenCalledOnce();
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith(decoded[1].objectUrl);
        expect(revokeObjectUrlSpy).not.toHaveBeenCalledWith(
            decoded[0].objectUrl
        );
    });

    it('evicts to 96 MiB of decoded pixels without evicting protected keys', async () => {
        const assets = Array.from({ length: 26 }, (_, index) => {
            const body = bytes(`pixels-${index}`);
            return {
                asset: createResolvedAsset({
                    label: `pixels-${index}`,
                    width: 1024,
                    height: 1024,
                    webpBytes: body,
                }),
                body,
            };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map(
                    assets.map(({ asset, body }) => [
                        asset.webpUrl.href,
                        { bytes: body },
                    ])
                )
            ),
            decodeImage: successfulDecoder(1024, 1024),
        });
        const active = await cache.load(assets[0].asset);
        const staging = await cache.load(assets[1].asset);
        const previous = await cache.load(assets[2].asset);
        cache.setProtectedKeys(
            new Set([active.cacheKey, staging.cacheKey, previous.cacheKey])
        );

        for (const { asset } of assets.slice(3)) await cache.load(asset);

        expect(cache.size).toBeLessThanOrEqual(48);
        expect(cache.decodedBytes).toBeLessThanOrEqual(96 * MiB);
        expect(revokeObjectUrlSpy).not.toHaveBeenCalledWith(active.objectUrl);
        expect(revokeObjectUrlSpy).not.toHaveBeenCalledWith(staging.objectUrl);
        expect(revokeObjectUrlSpy).not.toHaveBeenCalledWith(previous.objectUrl);
    });

    it('rejects a new object when protected entries consume the decoded budget', async () => {
        const assets = Array.from({ length: 4 }, (_, index) => {
            const body = bytes(`protected-budget-${index}`);
            return {
                asset: createResolvedAsset({
                    label: `protected-budget-${index}`,
                    width: 4096,
                    height: 2048,
                    webpBytes: body,
                }),
                body,
            };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map(
                    assets.map(({ asset, body }) => [
                        asset.webpUrl.href,
                        { bytes: body },
                    ])
                )
            ),
            decodeImage: successfulDecoder(4096, 2048),
        });
        const protectedAssets = [];
        for (const { asset } of assets.slice(0, 3)) {
            protectedAssets.push(await cache.load(asset));
        }
        cache.setProtectedKeys(
            new Set(protectedAssets.map(asset => asset.cacheKey))
        );

        await expect(cache.load(assets[3].asset)).rejects.toMatchObject({
            code: 'unavailable',
        });

        expect(cache.size).toBe(3);
        expect(cache.decodedBytes).toBe(96 * MiB);
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith(
            'blob:https://reader.test/4'
        );
        for (const asset of protectedAssets) {
            expect(revokeObjectUrlSpy).not.toHaveBeenCalledWith(
                asset.objectUrl
            );
        }
    });

    it('rejects an oversized decoded object after safely revoking its URL', async () => {
        const assetBytes = bytes('oversized-object');
        const asset = createResolvedAsset({
            label: 'oversized-object',
            width: 8192,
            height: 4096,
            webpBytes: assetBytes,
        });
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map([[asset.webpUrl.href, { bytes: assetBytes }]])
            ),
            decodeImage: successfulDecoder(8192, 4096),
        });

        await expect(cache.load(asset)).rejects.toMatchObject({
            code: 'unavailable',
        });

        expect(cache.size).toBe(0);
        expect(cache.decodedBytes).toBe(0);
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith(
            'blob:https://reader.test/1'
        );
    });

    it('awaits URL detachment before eviction revokes an object URL', async () => {
        const assets = Array.from({ length: 49 }, (_, index) => {
            const body = bytes(`detach-${index}`);
            return {
                asset: createResolvedAsset({
                    label: `detach-${index}`,
                    width: 1,
                    height: 1,
                    webpBytes: body,
                }),
                body,
            };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map(
                    assets.map(({ asset, body }) => [
                        asset.webpUrl.href,
                        { bytes: body },
                    ])
                )
            ),
            decodeImage: successfulDecoder(1, 1),
        });
        for (const { asset } of assets.slice(0, 48)) await cache.load(asset);
        let releaseDetach!: () => void;
        const detachGate = new Promise<void>(resolve => {
            releaseDetach = resolve;
        });
        const beforeRevoke = vi.fn<(objectUrl: string) => Promise<void>>(
            () => detachGate
        );
        cache.setBeforeRevoke(beforeRevoke);

        const load = cache.load(assets[48].asset);
        await vi.waitFor(() => expect(beforeRevoke).toHaveBeenCalledOnce());
        expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
        releaseDetach();
        await load;

        expect(revokeObjectUrlSpy).toHaveBeenCalledWith(
            beforeRevoke.mock.calls[0][0]
        );
    });

    it('clear aborts in-flight work and detaches completed URLs before revoking them', async () => {
        const completedBytes = bytes('completed-before-clear');
        const completedAsset = createResolvedAsset({
            label: 'completed-before-clear',
            webpBytes: completedBytes,
        });
        const pendingAsset = createResolvedAsset({
            label: 'pending-at-clear',
        });
        const fetchSpy = vi.fn(
            (input: RequestInfo | URL, init?: RequestInit) => {
                if (String(input) === completedAsset.webpUrl.href) {
                    return Promise.resolve(response(completedBytes));
                }
                return new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener(
                        'abort',
                        () =>
                            reject(
                                new DOMException(
                                    'The operation was aborted',
                                    'AbortError'
                                )
                            ),
                        { once: true }
                    );
                });
            }
        ) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(),
        });
        const completed = await cache.load(completedAsset);
        const pending = cache.load(pendingAsset);
        const pendingRejection = expect(pending).rejects.toMatchObject({
            name: 'AbortError',
        });
        let releaseDetach!: () => void;
        const detachGate = new Promise<void>(resolve => {
            releaseDetach = resolve;
        });
        const beforeRevoke = vi.fn(() => detachGate);
        cache.setBeforeRevoke(beforeRevoke);

        const clearing = cache.clear();
        await vi.waitFor(() =>
            expect(beforeRevoke).toHaveBeenCalledWith(completed.objectUrl)
        );
        expect(revokeObjectUrlSpy).not.toHaveBeenCalled();
        releaseDetach();

        await pendingRejection;
        await clearing;
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith(completed.objectUrl);
        expect(cache.size).toBe(0);
        expect(cache.inFlight).toBe(0);
    });

    it('clear aborts a load that is awaiting asynchronous eviction teardown', async () => {
        const assets = Array.from({ length: 49 }, (_, index) => {
            const body = bytes(`clear-during-eviction-${index}`);
            return {
                asset: createResolvedAsset({
                    label: `clear-during-eviction-${index}`,
                    width: 1,
                    height: 1,
                    webpBytes: body,
                }),
                body,
            };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map(
                    assets.map(({ asset, body }) => [
                        asset.webpUrl.href,
                        { bytes: body },
                    ])
                )
            ),
            decodeImage: successfulDecoder(1, 1),
        });
        for (const { asset } of assets.slice(0, 48)) await cache.load(asset);
        let releaseDetach!: () => void;
        const detachGate = new Promise<void>(resolve => {
            releaseDetach = resolve;
        });
        const beforeRevoke = vi.fn<(objectUrl: string) => Promise<void>>(
            () => detachGate
        );
        cache.setBeforeRevoke(beforeRevoke);
        const load = cache.load(assets[48].asset);
        await vi.waitFor(() => expect(beforeRevoke).toHaveBeenCalledOnce());
        const rejection = expect(load).rejects.toMatchObject({
            name: 'AbortError',
        });

        const clearing = cache.clear();
        releaseDetach();

        await rejection;
        await clearing;
        expect(cache.size).toBe(0);
        expect(cache.inFlight).toBe(0);
    });
});
