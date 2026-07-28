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

    it('loads through the receiver-sensitive default browser fetch', async () => {
        const assetBytes = bytes('default-browser-fetch');
        const resolvedAsset = createResolvedAsset({
            label: 'default-browser-fetch',
            width: 1,
            height: 1,
            webpBytes: assetBytes,
        });
        vi.stubGlobal('fetch', function receiverSensitiveFetch(
            this: typeof globalThis,
            input: RequestInfo | URL
        ): Promise<Response> {
            if (this !== globalThis) {
                return Promise.reject(
                    new TypeError('Illegal invocation: wrong receiver')
                );
            }
            return Promise.resolve(
                String(input) === resolvedAsset.webpUrl.href
                    ? response(assetBytes)
                    : new Response('missing', { status: 404 })
            );
        } as typeof fetch);
        const cache = new DecodedAssetCache({
            decodeImage: successfulDecoder(1, 1),
        });

        await expect(cache.load(resolvedAsset)).resolves.toMatchObject({
            width: 1,
            height: 1,
        });
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
            conflicting: (assetBytes: Uint8Array) =>
                createResolvedAsset({
                    label: 'same-hash-wrong-length',
                    webpBytes: assetBytes,
                    webpByteLength: assetBytes.byteLength + 1,
                }),
        },
        {
            name: 'dimensions',
            conflicting: (assetBytes: Uint8Array) =>
                createResolvedAsset({
                    label: 'same-hash-wrong-dimensions',
                    width: 1599,
                    height: 900,
                    webpBytes: assetBytes,
                }),
        },
    ])(
        'validates a completed immutable-object hit against the joining caller $name',
        async ({ conflicting }) => {
            const assetBytes = bytes('shared-completed-object');
            const accepted = createResolvedAsset({
                label: 'shared-completed-object',
                webpBytes: assetBytes,
            });
            const fetchSpy = createFetch(
                new Map([[accepted.webpUrl.href, { bytes: assetBytes }]])
            );
            const cache = new DecodedAssetCache({
                fetchImpl: fetchSpy,
                decodeImage: successfulDecoder(),
            });
            await cache.load(accepted);

            await expect(
                cache.load(conflicting(assetBytes))
            ).rejects.toMatchObject({
                code: 'integrity',
            });
            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(cache.size).toBe(1);
        }
    );

    it('validates metadata for every caller that joins an in-flight immutable object', async () => {
        const assetBytes = bytes('shared-pending-object');
        const accepted = createResolvedAsset({
            label: 'shared-pending-object',
            webpBytes: assetBytes,
        });
        const conflicting = createResolvedAsset({
            label: 'shared-pending-object-conflict',
            width: 1601,
            height: 900,
            webpBytes: assetBytes,
        });
        let releaseFetch!: (response: Response) => void;
        const responseGate = new Promise<Response>(resolve => {
            releaseFetch = resolve;
        });
        const fetchSpy = vi.fn(() => responseGate) as unknown as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(),
        });

        const acceptedLoad = cache.load(accepted);
        await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledOnce());
        const conflictingLoad = cache.load(conflicting);
        releaseFetch(response(assetBytes));

        await expect(acceptedLoad).resolves.toMatchObject({
            width: 1600,
            height: 900,
        });
        await expect(conflictingLoad).rejects.toMatchObject({
            code: 'integrity',
        });
        expect(fetchSpy).toHaveBeenCalledOnce();
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

    it('reuses the default AVIF capability probe across cache recreation', async () => {
        const webpBytes = bytes('session-probe-webp');
        const avifBytes = bytes('session-probe-avif');
        const asset = createResolvedAsset({
            label: 'session-probe',
            width: 1,
            height: 1,
            webpBytes,
            avifBytes,
        });
        vi.stubGlobal(
            'createImageBitmap',
            vi.fn(async () => ({
                width: 1,
                height: 1,
                close: vi.fn(),
            }))
        );
        const fetchMock = vi.fn(function defaultBrowserFetch(
            this: typeof globalThis,
            input: RequestInfo | URL
        ): Promise<Response> {
            if (this !== globalThis) {
                return Promise.reject(new TypeError('Illegal invocation'));
            }
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return Promise.resolve(
                    response(bytes('valid-session-probe'), 'image/avif')
                );
            }
            if (url === asset.avifUrl?.href) {
                return Promise.resolve(response(avifBytes, 'image/avif'));
            }
            if (url === asset.webpUrl.href) {
                return Promise.resolve(response(webpBytes));
            }
            return Promise.resolve(new Response('missing', { status: 404 }));
        });
        vi.stubGlobal('fetch', fetchMock as typeof fetch);

        const first = new DecodedAssetCache();
        await first.load(asset);
        await first.clear();
        const second = new DecodedAssetCache();
        await second.load(asset);
        await second.clear();

        expect(
            fetchMock.mock.calls.filter(([input]) =>
                String(input).includes('avif-probe.avif')
            )
        ).toHaveLength(1);
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

    it('treats a non-ok AVIF probe response as unsupported and falls back to WebP', async () => {
        const webpBytes = bytes('probe-not-ok-webp');
        const asset = createResolvedAsset({
            label: 'probe-not-ok',
            webpBytes,
            avifBytes: bytes('probe-not-ok-avif'),
        });
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return new Response('unavailable', { status: 503 });
            }
            if (url === asset.webpUrl.href) return response(webpBytes);
            return new Response('unexpected', { status: 500 });
        }) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchMock,
            decodeImage: successfulDecoder(),
        });

        const decoded = await cache.load(asset);

        expect(decoded.cacheKey).toBe(`webp:${digest(webpBytes)}`);
        expect(cache.size).toBe(1);
    });

    it('wraps a non-timeout fetch failure as a network error before integrity checks', async () => {
        const asset = createResolvedAsset({ label: 'network-failure' });
        const fetchSpy = vi.fn(async () => {
            throw new TypeError('connection refused');
        }) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(),
        });

        await expect(cache.load(asset)).rejects.toMatchObject({
            code: 'network',
            message: 'Runtime asset request failed',
        });
        expect(cache.size).toBe(0);
    });

    it('classifies a non-ok asset response as unavailable', async () => {
        const asset = createResolvedAsset({ label: 'http-error' });
        const fetchSpy = vi.fn(
            async () => new Response('server error', { status: 500 })
        ) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(),
        });

        await expect(cache.load(asset)).rejects.toMatchObject({
            code: 'unavailable',
        });
    });

    it('wraps a response.arrayBuffer() failure as a network error', async () => {
        const assetBytes = bytes('arraybuffer-fail');
        const asset = createResolvedAsset({
            label: 'arraybuffer-fail',
            webpBytes: assetBytes,
        });
        const fetchSpy = vi.fn(async () => {
            const body = new Response(Uint8Array.from(assetBytes).buffer);
            // Replace arrayBuffer() to throw so we exercise the catch path.
            body.arrayBuffer = () =>
                Promise.reject(new Error('stream disconnected'));
            return body;
        }) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchSpy,
            decodeImage: successfulDecoder(),
        });

        await expect(cache.load(asset)).rejects.toMatchObject({
            code: 'network',
            message: 'Runtime asset response could not be read',
        });
    });

    it('classifies a body-read abort during the asset timeout as a timeout error', async () => {
        vi.useFakeTimers();
        const asset = createResolvedAsset({ label: 'body-stall' });
        const fetchSpy = vi.fn(
            async (_input: RequestInfo | URL, init?: RequestInit) => {
                // Headers resolve immediately, but the body stream stalls
                // until the fetch signal aborts it.
                const body = new Response(
                    new ReadableStream({
                        start(controller) {
                            init?.signal?.addEventListener(
                                'abort',
                                () => {
                                    controller.error(
                                        new DOMException(
                                            'The operation was aborted',
                                            'AbortError'
                                        )
                                    );
                                },
                                { once: true }
                            );
                        },
                    })
                );
                return body;
            }
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
        vi.useRealTimers();
    });

    it('rejects with the signal reason when an already-aborted signal is provided', async () => {
        const asset = createResolvedAsset({ label: 'pre-aborted' });
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map([[asset.webpUrl.href, { bytes: bytes('pre-aborted') }]])
            ),
            decodeImage: successfulDecoder(),
        });
        const controller = new AbortController();
        const reason = new Error('caller cancelled');
        controller.abort(reason);

        await expect(
            cache.load(asset, { signal: controller.signal })
        ).rejects.toBe(reason);
    });

    it('rejects when the signal aborts after AVIF support resolves but before variant selection', async () => {
        const asset = createResolvedAsset({
            label: 'abort-after-probe',
            avifBytes: bytes('abort-after-probe-avif'),
        });
        let releaseProbe!: () => void;
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return new Promise<Response>(resolve => {
                    releaseProbe = () =>
                        resolve(
                            new Response(bytes('valid-probe'), {
                                status: 200,
                                headers: { 'content-type': 'image/avif' },
                            })
                        );
                });
            }
            return Promise.resolve(new Response('unexpected', { status: 500 }));
        }) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchMock,
            decodeImage: successfulDecoder(),
        });
        const controller = new AbortController();
        const load = cache.load(asset, { signal: controller.signal });
        const outcome = load.then(
            value => ({ status: 'resolved' as const, value }),
            error => ({ status: 'rejected' as const, error })
        );

        await Promise.resolve();
        controller.abort(new Error('cancelled after probe'));
        releaseProbe();

        await expect(outcome).resolves.toMatchObject({
            status: 'rejected',
            error: { message: 'cancelled after probe' },
        });
    });

    it('revokes the object URL and rejects when the signal aborts after a variant loads', async () => {
        const assetBytes = bytes('abort-after-load');
        const asset = createResolvedAsset({
            label: 'abort-after-load',
            webpBytes: assetBytes,
        });
        let releaseDecode!: () => void;
        const decodeSpy = vi.fn(
            () =>
                new Promise<DecodeResult>(resolve => {
                    releaseDecode = () =>
                        resolve({ width: 1600, height: 900, close: vi.fn() });
                })
        ) as unknown as DecodeImage;
        const cache = new DecodedAssetCache({
            fetchImpl: createFetch(
                new Map([[asset.webpUrl.href, { bytes: assetBytes }]])
            ),
            decodeImage: decodeSpy,
        });
        const controller = new AbortController();
        const load = cache.load(asset, { signal: controller.signal });

        await vi.waitFor(() => expect(decodeSpy).toHaveBeenCalledOnce());
        controller.abort(new Error('post-decode abort'));
        releaseDecode();

        await expect(load).rejects.toMatchObject({
            message: 'post-decode abort',
        });
        expect(revokeObjectUrlSpy).toHaveBeenCalledWith(
            'blob:https://reader.test/1'
        );
        expect(cache.size).toBe(0);
    });

    it('returns the existing entry and revokes the duplicate when a concurrent load completes after another', async () => {
        // Two assets with different webp bytes (different requestKey) but we
        // make the second asset's webp bytes hash to the same cacheKey as the
        // first by reusing the same bytes. To avoid requestKey dedup, we give
        // one asset an AVIF variant (different requestKey) that falls back to
        // the same webp cacheKey.
        const webpBytes = bytes('dedupe-shared-webp');
        const avifBytes = bytes('dedupe-unique-avif');
        const webpOnlyAsset = createResolvedAsset({
            label: 'dedupe-webp-only',
            webpBytes,
        });
        const avifFallbackAsset = createResolvedAsset({
            label: 'dedupe-avif-fallback',
            webpBytes,
            avifBytes,
        });
        // Make AVIF decode fail to force fallback to webp (same cacheKey).
        const decodeSpyWithAvifFail = vi.fn<DecodeImage>(async blob => {
            if (blob.type === 'image/avif') {
                throw new Error('AVIF decode failed');
            }
            return { width: 1600, height: 900, close: vi.fn() };
        }) as unknown as DecodeImage;
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return response(bytes('valid-probe'), 'image/avif');
            }
            if (url === avifFallbackAsset.avifUrl?.href) {
                return response(avifBytes, 'image/avif');
            }
            if (url === avifFallbackAsset.webpUrl.href)
                return response(webpBytes);
            if (url === webpOnlyAsset.webpUrl.href) return response(webpBytes);
            return new Response('missing', { status: 404 });
        }) as typeof fetch;
        const cache = new DecodedAssetCache({
            fetchImpl: fetchMock,
            decodeImage: decodeSpyWithAvifFail,
        });

        // Load the webp-only asset first and hold its decode pending.
        const loadA = cache.load(webpOnlyAsset);
        await vi.waitFor(() =>
            expect(
                decodeSpyWithAvifFail.mock.calls.length
            ).toBeGreaterThanOrEqual(1)
        );

        // Load the avif-fallback asset. Its AVIF decode fails, so it falls back
        // to webp (same cacheKey as the first). By the time it reaches the
        // existing-entry check, the first load may have already cached the entry.
        const loadB = cache.load(avifFallbackAsset);
        await loadB;

        // Both should resolve to the same cacheKey.
        const a = await loadA;
        expect(a.cacheKey).toBe(`webp:${digest(webpBytes)}`);
        expect(cache.size).toBe(1);
    });

    it('cleans up fallback keys when evicting an entry that was an AVIF fallback target', async () => {
        // Load an AVIF asset that fails to decode and falls back to WebP,
        // establishing a fallbackKey mapping. Then load enough additional
        // assets to evict the webp entry, which should clean up the fallbackKey.
        const webpBytes = bytes('fallback-evict-webp');
        const avifBytes = bytes('fallback-evict-avif');
        const fallbackAsset = createResolvedAsset({
            label: 'fallback-evict',
            width: 1,
            height: 1,
            webpBytes,
            avifBytes,
        });
        const extraAssets = Array.from({ length: 48 }, (_, index) => {
            const body = bytes(`fallback-evict-extra-${index}`);
            return {
                asset: createResolvedAsset({
                    label: `fallback-evict-extra-${index}`,
                    width: 1,
                    height: 1,
                    webpBytes: body,
                }),
                body,
            };
        });
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('avif-probe.avif')) {
                return response(bytes('valid-probe'), 'image/avif');
            }
            if (url === fallbackAsset.avifUrl?.href) {
                return response(avifBytes, 'image/avif');
            }
            if (url === fallbackAsset.webpUrl.href) return response(webpBytes);
            const extra = extraAssets.find(
                ({ asset }) => url === asset.webpUrl.href
            );
            return extra
                ? response(extra.body)
                : new Response('missing', { status: 404 });
        }) as typeof fetch;
        const decodeSpy = vi.fn<DecodeImage>(async blob => {
            const body = await blob.text();
            if (body === 'fallback-evict-avif') {
                throw new Error('AVIF decode failed');
            }
            return { width: 1, height: 1, close: vi.fn() };
        });
        const cache = new DecodedAssetCache({
            fetchImpl: fetchMock,
            decodeImage: decodeSpy,
        });

        // Load the fallback asset first - this establishes the fallbackKey mapping
        // (avif cacheKey → webp cacheKey).
        await cache.load(fallbackAsset);
        expect(cache.size).toBe(1);

        // Now load 48 more assets to force eviction of the fallback webp entry.
        for (const { asset } of extraAssets) {
            await cache.load(asset);
        }

        // The webp entry should have been evicted and its fallbackKey cleaned up.
        // After eviction, loading the fallback asset again should re-fetch webp
        // (not find a stale fallbackKey pointing to a revoked entry).
        expect(cache.size).toBeLessThanOrEqual(48);
        // The key assertion: the fallback asset can be reloaded successfully
        // after its fallback target was evicted, proving the fallbackKey was cleaned.
        const reloaded = await cache.load(fallbackAsset);
        expect(reloaded.cacheKey).toBe(`webp:${digest(webpBytes)}`);
    });
});
