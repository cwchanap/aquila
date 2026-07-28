import { createHash, webcrypto } from 'node:crypto';
import {
    canonicalReleaseContent,
    getReleaseManifestPath,
    type AssetResolverSource,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidatedReleaseStore } from '../validated-release-store';
import {
    WebAssetResolver,
    type ValidatedReleaseRecord,
} from '../web-asset-resolver';
import previewPointerText from '../../../../public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json?raw';

// Resolve the manifest at runtime from the pointer's manifestPath instead of
// importing a release directory containing a hard-coded SHA-256 hash. This
// keeps the test resilient to release rotation.
const releaseManifests = import.meta.glob(
    '../../../../public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/*/runtime-manifest.json',
    { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

const SOURCE: AssetResolverSource = {
    environment: 'local',
    storyId: 'the_seventh_mirror',
    baseUrl: 'http://localhost:5090/assets/',
    target: { kind: 'preview', previewId: 'hpa-228-local' },
};
const NOW = Date.parse('2026-07-26T12:00:00.000Z');
const ONE_DAY_MS = 86_400_000;
const WEBP_SHA = 'a'.repeat(64);

type Documents = {
    pointer: {
        schemaVersion: 1;
        storyId: string;
        releaseId: string;
        manifestPath: string;
        manifestSha256: string;
        publishedAt: string;
    };
    pointerText: string;
    manifest: RuntimeAssetManifestV1;
    manifestText: string;
};

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>(next => {
        resolve = next;
    });
    return { promise, resolve };
}

function digest(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function createDocuments({
    key = '第一章/鏡 房/夜',
    storyId = SOURCE.storyId,
    publishedAt = '2026-07-26T10:00:00.000Z',
    target = SOURCE.target,
}: {
    key?: string;
    storyId?: string;
    publishedAt?: string;
    target?: PublicationTarget;
} = {}): Documents {
    const manifestWithPlaceholderId = {
        schemaVersion: 1 as const,
        storyId,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets: [
            {
                identity: { type: 'background' as const, key },
                variants: {
                    webp: {
                        format: 'webp' as const,
                        path: `vn/objects/${WEBP_SHA}.webp`,
                        sha256: WEBP_SHA,
                        byteLength: 123,
                    },
                },
                width: 1600,
                height: 900,
            },
        ],
    } as RuntimeAssetManifestV1;
    const releaseId = `sha256-${digest(
        canonicalReleaseContent(manifestWithPlaceholderId)
    )}`;
    const manifest = {
        ...manifestWithPlaceholderId,
        releaseId,
    } as RuntimeAssetManifestV1;
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const pointer = {
        schemaVersion: 1 as const,
        storyId,
        releaseId,
        manifestPath: getReleaseManifestPath(storyId, releaseId, target),
        manifestSha256: digest(manifestText),
        publishedAt,
    };
    return {
        pointer,
        pointerText: `${JSON.stringify(pointer, null, 2)}\n`,
        manifest,
        manifestText,
    };
}

function createFetch(documents: Documents): typeof fetch {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/current.json')) {
            return new Response(documents.pointerText);
        }
        if (url.endsWith('/runtime-manifest.json')) {
            return new Response(documents.manifestText);
        }
        return new Response('missing', { status: 404 });
    }) as typeof fetch;
}

function createMemoryStorage(initial: unknown[] = []): Storage {
    let value: string | null = JSON.stringify(initial);
    return {
        getItem: () => value,
        setItem: (_key: string, next: string) => {
            value = next;
        },
        removeItem: () => {
            value = null;
        },
        clear: () => {
            value = null;
        },
        key: () => null,
        get length() {
            return value === null ? 0 : 1;
        },
    };
}

function storedRecord(
    documents: Documents,
    {
        validatedAt = NOW - 1_000,
        lastUsedAt = NOW - 1_000,
        target = SOURCE.target,
        source,
    }: {
        validatedAt?: number;
        lastUsedAt?: number;
        target?: PublicationTarget;
        source?: AssetResolverSource;
    } = {}
): ValidatedReleaseRecord {
    const recordSource: AssetResolverSource = source ?? {
        environment: 'local',
        storyId: documents.pointer.storyId,
        baseUrl: SOURCE.baseUrl,
        target,
    };

    return {
        source: recordSource,
        releaseId: documents.pointer.releaseId,
        pointerText: documents.pointerText,
        manifestText: documents.manifestText,
        validatedAt,
        lastUsedAt,
    };
}

function createResolver(
    documents: Documents,
    options: {
        fetchImpl?: typeof fetch;
        store?: ValidatedReleaseStore;
        now?: () => number;
    } = {}
): WebAssetResolver {
    return new WebAssetResolver(SOURCE, {
        fetchImpl: options.fetchImpl ?? createFetch(documents),
        store:
            options.store ?? new ValidatedReleaseStore(createMemoryStorage()),
        now: options.now ?? (() => NOW),
    });
}

describe('WebAssetResolver', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('loads exact pointer and manifest bytes and resolves a CJK key safely', async () => {
        const documents = createDocuments();
        const resolver = createResolver(documents);

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'network',
            manifest: { releaseId: documents.pointer.releaseId },
        });
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'resolved',
            webpUrl: new URL(
                `http://localhost:5090/assets/vn/objects/${WEBP_SHA}.webp`
            ),
        });
    });

    it('loads and resolves the checked-in local preview fixture', async () => {
        const pointer = JSON.parse(previewPointerText) as Documents['pointer'];
        const manifestPath = pointer.manifestPath;
        const manifestEntry = Object.entries(releaseManifests).find(([path]) =>
            path.endsWith(manifestPath)
        );
        expect(manifestEntry).toBeDefined();
        const previewManifestText = manifestEntry![1];
        const manifest = JSON.parse(
            previewManifestText
        ) as RuntimeAssetManifestV1;
        const documents = {
            pointer,
            pointerText: previewPointerText,
            manifest,
            manifestText: previewManifestText,
        };
        const resolver = createResolver(documents);

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'network',
            manifest: { releaseId: pointer.releaseId },
        });
        expect(
            resolver.resolve({
                type: 'background',
                key: 'chapter_1/ch1_act2_s0',
            })
        ).toMatchObject({
            status: 'resolved',
            webpUrl: new URL(
                'http://localhost:5090/assets/vn/objects/e7b5e3372ebcb23f63bef4cf2e762679c35e61babc13829ed665eaaa49fdd9f6.webp'
            ),
        });
    });

    it('uses no-cache and continues the accepted release when a pointer is older', async () => {
        const current = createDocuments();
        const older = createDocuments({
            publishedAt: '2026-07-26T09:59:59.999Z',
        });
        let documents = current;
        const fetchSpy = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
            createFetch(documents)(input, init)
        );
        const resolver = createResolver(current, {
            fetchImpl: fetchSpy as typeof fetch,
        });

        await resolver.loadActiveRelease();
        documents = older;

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: current.pointer.releaseId },
        });
        expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
            cache: 'no-cache',
        });
    });

    it('rejects persisted releases from a different normalized source', async () => {
        const documents = createDocuments();

        const otherSources: AssetResolverSource[] = [
            {
                environment: 'local',
                storyId: SOURCE.storyId,
                baseUrl: 'https://other-assets.example/assets/',
                target: SOURCE.target,
            },
            {
                environment: 'preview',
                storyId: SOURCE.storyId,
                baseUrl: SOURCE.baseUrl,
                target: {
                    kind: 'preview',
                    previewId: 'hpa-228-local',
                },
            },
        ];

        for (const otherSource of otherSources) {
            const store = new ValidatedReleaseStore(createMemoryStorage());
            const first = createResolver(documents, { store });
            await first.loadActiveRelease();
            const crossSource = new WebAssetResolver(otherSource, {
                fetchImpl: vi
                    .fn()
                    .mockRejectedValue(
                        new TypeError('cross-source network unavailable')
                    ) as typeof fetch,
                store,
                now: () => NOW,
            });

            await expect(crossSource.loadActiveRelease()).rejects.toMatchObject(
                {
                    code: 'network',
                }
            );
        }
    });

    it('normalizes equivalent base URLs before persisted-source comparison', async () => {
        const documents = createDocuments();
        const store = new ValidatedReleaseStore(createMemoryStorage());
        const first = new WebAssetResolver(
            { ...SOURCE, baseUrl: 'http://localhost:5090/assets' },
            {
                fetchImpl: createFetch(documents),
                store,
                now: () => NOW,
            }
        );
        await first.loadActiveRelease();
        const reloaded = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(reloaded.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: documents.pointer.releaseId },
        });
    });

    it('keeps the same release identity distinct across asset sources', async () => {
        const documents = createDocuments();
        const store = new ValidatedReleaseStore(createMemoryStorage());
        const alternateSource = {
            ...SOURCE,
            baseUrl: 'https://other-assets.example/assets/',
        };
        await createResolver(documents, { store }).loadActiveRelease();
        await new WebAssetResolver(alternateSource, {
            fetchImpl: createFetch(documents),
            store,
            now: () => NOW,
        }).loadActiveRelease();

        const records = store.loadRaw() as ValidatedReleaseRecord[];
        expect(records).toHaveLength(2);
        expect(new Set(records.map(record => record.source.baseUrl))).toEqual(
            new Set([SOURCE.baseUrl, alternateSource.baseUrl])
        );
    });

    it('does not let a slower older release overwrite a newer concurrent load', async () => {
        const older = createDocuments({
            key: 'release/older',
            publishedAt: '2026-07-26T09:00:00.000Z',
        });
        const newer = createDocuments({
            key: 'release/newer',
            publishedAt: '2026-07-26T10:00:00.000Z',
        });
        const olderManifestRequested = deferred<void>();
        const olderManifestResponse = deferred<Response>();
        let pointerRequest = 0;
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/current.json')) {
                const documents = pointerRequest++ === 0 ? older : newer;
                return new Response(documents.pointerText);
            }
            if (url.includes(older.pointer.releaseId)) {
                olderManifestRequested.resolve();
                return olderManifestResponse.promise;
            }
            if (url.includes(newer.pointer.releaseId)) {
                return new Response(newer.manifestText);
            }
            return new Response('missing', { status: 404 });
        });
        const resolver = createResolver(older, {
            fetchImpl: fetchMock as typeof fetch,
        });

        const olderLoad = resolver.loadActiveRelease();
        await olderManifestRequested.promise;
        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            manifest: { releaseId: newer.pointer.releaseId },
        });
        olderManifestResponse.resolve(new Response(older.manifestText));

        await expect(olderLoad).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: newer.pointer.releaseId },
        });
        expect(
            resolver.resolve({ type: 'background', key: 'release/newer' })
        ).toMatchObject({ status: 'resolved' });
        expect(
            resolver.resolve({ type: 'background', key: 'release/older' })
        ).toMatchObject({ status: 'fallback', reason: 'not-found' });
    });

    it('does not deactivate a newer release accepted by a concurrent load when a failing load finishes last', async () => {
        const newer = createDocuments({
            key: 'release/newer',
            publishedAt: '2026-07-26T10:00:00.000Z',
        });
        // A stored record for a *different* source so that the failing
        // load's fallback validation is async (sha256) but produces no
        // candidate for this resolver's source.
        const other = createDocuments({
            key: 'other/source',
            storyId: 'other_story',
            publishedAt: '2026-07-26T09:00:00.000Z',
        });
        const otherRecord = storedRecord(other, {
            source: {
                environment: 'local',
                storyId: 'other_story',
                baseUrl: SOURCE.baseUrl,
                target: SOURCE.target,
            },
        });

        // Store that starts empty (so both seeds are instant) and reveals
        // the other-source record only after the failing load's pointer
        // fetch — making the fallback validation async.
        let showOther = false;
        const store = new ValidatedReleaseStore(createMemoryStorage());
        const originalLoadRaw = store.loadRaw.bind(store);
        store.loadRaw = () =>
            showOther ? [...originalLoadRaw(), otherRecord] : originalLoadRaw();

        // Crypto stub: gate the other-source record's manifestText digest
        // (only hit during the failing load's fallback) so the succeeding
        // load can accept while the failing load is still validating.
        const realDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
        const otherManifestGate = deferred<void>();
        vi.stubGlobal('crypto', {
            ...webcrypto,
            subtle: {
                ...webcrypto.subtle,
                digest: async (alg: string, data: BufferSource) => {
                    const text = new TextDecoder().decode(
                        data instanceof ArrayBuffer
                            ? new Uint8Array(data)
                            : new Uint8Array(
                                  data.buffer,
                                  data.byteOffset,
                                  data.byteLength
                              )
                    );
                    if (text === other.manifestText) {
                        await otherManifestGate.promise;
                    }
                    return realDigest(alg, data);
                },
            },
        });

        let pointerRequest = 0;
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/current.json')) {
                if (pointerRequest++ === 0) {
                    // Failing load's pointer — 404, and reveal the
                    // other-source record so fallback validation is async.
                    showOther = true;
                    return new Response('not found', { status: 404 });
                }
                return new Response(newer.pointerText);
            }
            if (url.includes(newer.pointer.releaseId)) {
                return new Response(newer.manifestText);
            }
            return new Response('missing', { status: 404 });
        });

        const resolver = createResolver(newer, {
            fetchImpl: fetchMock as typeof fetch,
            store,
        });

        // Start the failing load (A) and the succeeding load (B)
        // concurrently. A starts first so its pointer fetch is the first
        // request (returns 404 and reveals the other-source record).
        const failingLoad = resolver.loadActiveRelease();
        const succeedingLoad = resolver.loadActiveRelease();

        // B succeeds while A is gated in fallback validation.
        await expect(succeedingLoad).resolves.toMatchObject({
            manifest: { releaseId: newer.pointer.releaseId },
        });

        // Release A's fallback gate.
        otherManifestGate.resolve();

        // A fails, but must NOT deactivate B's accepted release.
        await expect(failingLoad).rejects.toMatchObject({
            code: 'unavailable',
        });
        expect(
            resolver.resolve({ type: 'background', key: 'release/newer' })
        ).toMatchObject({ status: 'resolved' });
    });

    it('rejects an unsafe source path before fetch', async () => {
        const fetchSpy = vi.fn() as unknown as typeof fetch;
        const resolver = new WebAssetResolver(
            { ...SOURCE, storyId: '../other-story' },
            { fetchImpl: fetchSpy, now: () => NOW }
        );

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'unsafe-path',
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it.each([
        ['pointer', 5_000],
        ['manifest', 10_000],
    ] as const)(
        'classifies a %s request timeout after %i ms',
        async (stage, ms) => {
            vi.useFakeTimers();
            const documents = createDocuments();
            const fetchMock = vi.fn(
                async (_input: RequestInfo | URL, init?: RequestInit) => {
                    if (
                        stage === 'manifest' &&
                        fetchMock.mock.calls.length === 1
                    ) {
                        return new Response(documents.pointerText);
                    }
                    return await new Promise<Response>((_resolve, reject) => {
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
            );
            const resolver = createResolver(documents, {
                fetchImpl: fetchMock as typeof fetch,
            });
            const pending = resolver.loadActiveRelease();
            const rejection = expect(pending).rejects.toMatchObject({
                code: 'timeout',
            });

            await vi.advanceTimersByTimeAsync(ms);

            await rejection;
        }
    );

    it('rejects a checksum of anything except the exact manifest bytes', async () => {
        const documents = createDocuments();
        const fetchImpl = createFetch({
            ...documents,
            manifestText: documents.manifestText.replace(/\n$/, ' \n'),
        });
        const resolver = createResolver(documents, { fetchImpl });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'integrity',
        });
    });

    it('rejects a pointer for a different story before fetching its manifest', async () => {
        const documents = createDocuments({ storyId: 'another_story' });
        const fetchImpl = createFetch(documents);
        const resolver = createResolver(documents, { fetchImpl });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'story-mismatch',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('rejects an unsafe pointer manifest path before fetching it', async () => {
        const documents = createDocuments();
        const pointer = {
            ...documents.pointer,
            manifestPath: '../runtime-manifest.json',
        };
        const fetchImpl = createFetch({
            ...documents,
            pointer,
            pointerText: JSON.stringify(pointer),
        });
        const resolver = createResolver(documents, { fetchImpl });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'unsafe-path',
        });
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('rejects a manifest whose release differs from its pointer', async () => {
        const pointerDocuments = createDocuments({ key: 'chapter/one' });
        const manifestDocuments = createDocuments({ key: 'chapter/two' });
        const pointer = {
            ...pointerDocuments.pointer,
            manifestSha256: digest(manifestDocuments.manifestText),
        };
        const documents = {
            pointer,
            pointerText: JSON.stringify(pointer),
            manifest: manifestDocuments.manifest,
            manifestText: manifestDocuments.manifestText,
        };
        const resolver = createResolver(documents);

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'release-mismatch',
        });
    });

    it('rejects a release id that is not the canonical manifest identity', async () => {
        const documents = createDocuments();
        const releaseId = `sha256-${'f'.repeat(64)}`;
        const manifest = { ...documents.manifest, releaseId };
        const manifestText = JSON.stringify(manifest);
        const pointer = {
            ...documents.pointer,
            releaseId,
            manifestPath: getReleaseManifestPath(
                SOURCE.storyId,
                releaseId,
                SOURCE.target
            ),
            manifestSha256: digest(manifestText),
        };
        const resolver = createResolver({
            pointer,
            pointerText: JSON.stringify(pointer),
            manifest,
            manifestText,
        });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'integrity',
        });
    });

    it.each([
        ['integrity', 'integrity-failure'],
        ['story-mismatch', 'invalid-release'],
    ] as const)(
        'maps a %s load error to the %s render fallback',
        async (code, reason) => {
            const valid = createDocuments();
            const invalid =
                code === 'integrity'
                    ? {
                          ...valid,
                          manifestText: valid.manifestText.replace(
                              /\n$/,
                              ' \n'
                          ),
                      }
                    : createDocuments({ storyId: 'another_story' });
            const resolver = createResolver(valid, {
                fetchImpl: createFetch(invalid),
            });

            await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
                code,
            });
            expect(
                resolver.resolve({
                    type: 'background',
                    key: '第一章/鏡 房/夜',
                })
            ).toMatchObject({
                status: 'fallback',
                reason,
                error: { code },
            });
        }
    );

    it('continues a revalidated stored release when network loading fails', async () => {
        const documents = createDocuments();
        const store = new ValidatedReleaseStore(
            createMemoryStorage([storedRecord(documents)])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: documents.pointer.releaseId },
        });
    });

    it('selects the newest validated stored release instead of the most recently used one', async () => {
        const older = createDocuments({
            key: 'stored/older',
            publishedAt: '2026-07-26T09:00:00.000Z',
        });
        const newer = createDocuments({
            key: 'stored/newer',
            publishedAt: '2026-07-26T10:00:00.000Z',
        });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(older, {
                    validatedAt: NOW - 2_000,
                    lastUsedAt: NOW - 1,
                }),
                storedRecord(newer, {
                    validatedAt: NOW - 1_000,
                    lastUsedAt: NOW - 10_000,
                }),
            ])
        );
        const resolver = createResolver(newer, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: newer.pointer.releaseId },
        });
    });

    it('rejects an older network pointer on a fresh resolver and continues the newer stored release', async () => {
        const older = createDocuments({
            key: 'network/older',
            publishedAt: '2026-07-26T09:00:00.000Z',
        });
        const newer = createDocuments({
            key: 'stored/newer',
            publishedAt: '2026-07-26T10:00:00.000Z',
        });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([storedRecord(newer)])
        );
        const fetchImpl = createFetch(older);
        const resolver = createResolver(older, { fetchImpl, store });

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: newer.pointer.releaseId },
        });
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('discards legacy partial records without a complete source identity', async () => {
        const documents = createDocuments();
        const current = storedRecord(documents);
        const legacyRecord = {
            storyId: current.source.storyId,
            target: current.source.target,
            releaseId: current.releaseId,
            pointerText: current.pointerText,
            manifestText: current.manifestText,
            validatedAt: current.validatedAt,
            lastUsedAt: current.lastUsedAt,
        };
        const store = new ValidatedReleaseStore(
            createMemoryStorage([legacyRecord])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
        expect(store.loadRaw()).toEqual([]);
    });

    it('continues a revalidated stored release when a candidate fails integrity', async () => {
        const stored = createDocuments({ key: 'stored/release' });
        const candidate = createDocuments({ key: 'candidate/release' });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([storedRecord(stored)])
        );
        const resolver = createResolver(candidate, {
            fetchImpl: createFetch({
                ...candidate,
                manifestText: candidate.manifestText.replace(/\n$/, ' \n'),
            }),
            store,
        });

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: stored.pointer.releaseId },
        });
    });

    it('evicts a stored release after its 24-hour validation eligibility expires', async () => {
        const documents = createDocuments();
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(documents, {
                    validatedAt: NOW - ONE_DAY_MS - 1,
                }),
            ])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
        expect(store.loadRaw()).toEqual([]);
    });

    it('deactivates the accepted release when revalidation rejects without a usable fallback', async () => {
        const documents = createDocuments();
        let now = NOW;
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
            createFetch(documents)(input)
        );
        const store = new ValidatedReleaseStore(createMemoryStorage());
        const resolver = createResolver(documents, {
            fetchImpl: fetchImpl as typeof fetch,
            store,
            now: () => now,
        });

        // Successfully activate the release.
        await resolver.loadActiveRelease();
        expect(
            resolver.resolve({ type: 'background', key: '第一章/鏡 房/夜' })
        ).toMatchObject({ status: 'resolved' });

        // Advance beyond the 24-hour eligibility window and make network fail.
        now = NOW + ONE_DAY_MS + 1;
        fetchImpl.mockRejectedValue(new TypeError('offline'));

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });

        // The resolver must not serve assets from the expired release.
        expect(
            resolver.resolve({ type: 'background', key: '第一章/鏡 房/夜' })
        ).toMatchObject({
            status: 'fallback',
            reason: 'release-unavailable',
        });
    });

    it('evicts tampered stored bytes instead of using them as fallback', async () => {
        const documents = createDocuments();
        const tampered = storedRecord(documents);
        tampered.manifestText = tampered.manifestText.replace(
            '"width": 1600',
            '"width": 1601'
        );
        const store = new ValidatedReleaseStore(
            createMemoryStorage([tampered])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
        expect(store.loadRaw()).toEqual([]);
    });

    it('retains valid global LRU records for other publication targets', async () => {
        const otherTarget = {
            kind: 'preview',
            previewId: 'another-preview',
        } as const;
        const other = createDocuments({ target: otherTarget });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(other, {
                    target: otherTarget,
                    source: { ...SOURCE, target: otherTarget },
                }),
            ])
        );
        const resolver = createResolver(createDocuments(), {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
        expect(store.loadRaw()).toHaveLength(1);
    });

    it('persists only the two globally most-recently-used validated releases', async () => {
        const oldest = createDocuments({ key: 'release/oldest' });
        const middle = createDocuments({ key: 'release/middle' });
        const newest = createDocuments({ key: 'release/newest' });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(oldest, { lastUsedAt: NOW - 3_000 }),
                storedRecord(middle, { lastUsedAt: NOW - 2_000 }),
            ])
        );
        const resolver = createResolver(newest, { store });

        await resolver.loadActiveRelease();

        expect(
            (store.loadRaw() as ValidatedReleaseRecord[]).map(
                record => record.releaseId
            )
        ).toEqual([newest.pointer.releaseId, middle.pointer.releaseId]);
    });

    it('keeps an accepted release in memory when persistence throws', async () => {
        const documents = createDocuments();
        const storage = createMemoryStorage();
        storage.setItem = () => {
            throw new DOMException('full', 'QuotaExceededError');
        };
        const resolver = createResolver(documents, {
            store: new ValidatedReleaseStore(storage),
        });

        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'network',
        });
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({ status: 'resolved' });
    });

    it('returns typed fallbacks and counts only resolver-stage successes during prefetch', async () => {
        const documents = createDocuments();
        const resolver = createResolver(documents);
        await resolver.loadActiveRelease();

        await expect(
            resolver.prefetchNextEdge({
                fromSceneId: 's1',
                toSceneId: 's2',
                assets: [
                    { type: 'background', key: '第一章/鏡 房/夜' },
                    { type: 'portrait', key: 'missing' },
                ],
            })
        ).resolves.toMatchObject({
            requested: 2,
            cached: 1,
            failed: [
                {
                    status: 'fallback',
                    reason: 'not-found',
                    identity: { type: 'portrait', key: 'missing' },
                },
            ],
        });
    });

    it('aborts an in-flight load and clears resolved indices', async () => {
        const fetchImpl = vi.fn(
            async (_input: RequestInfo | URL, init?: RequestInit) =>
                await new Promise<Response>((_resolve, reject) => {
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
        const resolver = createResolver(createDocuments(), { fetchImpl });
        const pending = resolver.loadActiveRelease();

        resolver.clear();

        await expect(pending).rejects.toMatchObject({ code: 'network' });
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'fallback',
            reason: 'release-unavailable',
        });
    });

    it('does not resurrect a stored release after clear aborts a reload', async () => {
        const documents = createDocuments();
        const store = new ValidatedReleaseStore(
            createMemoryStorage([storedRecord(documents)])
        );
        const fetchImpl = vi.fn(
            async (_input: RequestInfo | URL, init?: RequestInit) =>
                await new Promise<Response>((_resolve, reject) => {
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
        const resolver = createResolver(documents, { fetchImpl, store });
        const pending = resolver.loadActiveRelease();

        resolver.clear();

        await expect(pending).rejects.toMatchObject({ code: 'network' });
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'fallback',
            reason: 'release-unavailable',
        });
    });

    it('does not activate a release when clear happens after fetch but during hashing', async () => {
        const documents = createDocuments();
        const digestStarted = deferred<void>();
        const continueDigest = deferred<void>();
        const digestMock = vi.fn(
            async (
                algorithm: AlgorithmIdentifier,
                data: BufferSource
            ): Promise<ArrayBuffer> => {
                if (digestMock.mock.calls.length === 1) {
                    digestStarted.resolve();
                    await continueDigest.promise;
                }
                return webcrypto.subtle.digest(algorithm, data);
            }
        );
        vi.stubGlobal('crypto', {
            subtle: { digest: digestMock },
        } as unknown as Crypto);
        const resolver = createResolver(documents);
        const pending = resolver.loadActiveRelease();
        await digestStarted.promise;

        resolver.clear();
        continueDigest.resolve();

        await expect(pending).rejects.toMatchObject({ code: 'network' });
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'fallback',
            reason: 'release-unavailable',
        });
    });

    // --- getBrowserStorage edge cases (lines 59-64) ---
    it('does not crash when globalThis.localStorage is undefined', () => {
        vi.stubGlobal('localStorage', undefined);
        const resolver = new WebAssetResolver(SOURCE, {
            fetchImpl: vi.fn() as unknown as typeof fetch,
            now: () => NOW,
        });
        expect(resolver).toBeInstanceOf(WebAssetResolver);
    });

    it('does not crash when localStorage access throws', () => {
        const original = Object.getOwnPropertyDescriptor(
            globalThis,
            'localStorage'
        );
        Object.defineProperty(globalThis, 'localStorage', {
            get() {
                throw new Error('access denied');
            },
            configurable: true,
        });
        try {
            const resolver = new WebAssetResolver(SOURCE, {
                fetchImpl: vi.fn() as unknown as typeof fetch,
                now: () => NOW,
            });
            expect(resolver).toBeInstanceOf(WebAssetResolver);
        } finally {
            if (original) {
                Object.defineProperty(globalThis, 'localStorage', original);
            }
        }
    });

    // --- parseTarget / parseStoredSource branches ---
    it('rejects a stored record whose production target has extra keys', async () => {
        const documents = createDocuments();
        const badRecord = {
            ...storedRecord(documents),
            source: {
                environment: 'production',
                storyId: SOURCE.storyId,
                baseUrl: SOURCE.baseUrl,
                target: { kind: 'production', extra: 'x' },
            },
        };
        const store = new ValidatedReleaseStore(
            createMemoryStorage([badRecord])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    it('rejects a stored record with an invalid target kind', async () => {
        const documents = createDocuments();
        const badRecord = {
            ...storedRecord(documents),
            source: {
                environment: 'local',
                storyId: SOURCE.storyId,
                baseUrl: SOURCE.baseUrl,
                target: { kind: 'unknown' },
            },
        };
        const store = new ValidatedReleaseStore(
            createMemoryStorage([badRecord])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    it('rejects a stored record with non-string source fields', async () => {
        const documents = createDocuments();
        const badRecord = {
            ...storedRecord(documents),
            source: {
                environment: 'local',
                storyId: 123,
                baseUrl: SOURCE.baseUrl,
                target: SOURCE.target,
            },
        };
        const store = new ValidatedReleaseStore(
            createMemoryStorage([badRecord])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    it('continues a stored release from a preview environment', async () => {
        const previewTarget = {
            kind: 'preview',
            previewId: 'hpa-228-local',
        };
        const previewSource: AssetResolverSource = {
            environment: 'preview',
            storyId: SOURCE.storyId,
            baseUrl: SOURCE.baseUrl,
            target: previewTarget,
        };
        const documents = createDocuments({ target: previewTarget });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(documents, { source: previewSource }),
            ])
        );
        const resolver = new WebAssetResolver(previewSource, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
            now: () => NOW,
        });
        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: documents.pointer.releaseId },
        });
    });

    it('continues a stored release from a production environment', async () => {
        const productionTarget = { kind: 'production' };
        const productionSource: AssetResolverSource = {
            environment: 'production',
            storyId: SOURCE.storyId,
            baseUrl: SOURCE.baseUrl,
            target: productionTarget,
        };
        const documents = createDocuments({ target: productionTarget });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(documents, { source: productionSource }),
            ])
        );
        const resolver = new WebAssetResolver(productionSource, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
            now: () => NOW,
        });
        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: documents.pointer.releaseId },
        });
    });

    it('rejects a stored record whose environment does not match its target kind', async () => {
        const documents = createDocuments();
        const mismatchRecord = {
            ...storedRecord(documents),
            source: {
                environment: 'preview',
                storyId: SOURCE.storyId,
                baseUrl: SOURCE.baseUrl,
                target: { kind: 'production' },
            },
        };
        const store = new ValidatedReleaseStore(
            createMemoryStorage([mismatchRecord])
        );
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    // --- readResponseText / parseJson error paths ---
    it('classifies a non-ok pointer response as unavailable', async () => {
        const documents = createDocuments();
        const fetchImpl = vi.fn(
            async () => new Response('not found', { status: 404 })
        ) as typeof fetch;
        const resolver = createResolver(documents, { fetchImpl });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'unavailable',
        });
    });

    it('classifies a response.text() failure as network', async () => {
        const documents = createDocuments();
        const fetchImpl = vi.fn(async () => ({
            ok: true,
            status: 200,
            text: () => Promise.reject(new TypeError('stream locked')),
        })) as unknown as typeof fetch;
        const resolver = createResolver(documents, { fetchImpl });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    it('classifies invalid pointer JSON as validation', async () => {
        const documents = createDocuments();
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith('/current.json')) {
                return new Response('not valid json {{{');
            }
            return new Response(documents.manifestText);
        }) as typeof fetch;
        const resolver = createResolver(documents, { fetchImpl });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'validation',
        });
    });

    // --- resolve() branches ---
    it('returns an invalid-release fallback for an unsafe identity key', () => {
        const resolver = createResolver(createDocuments());
        expect(
            resolver.resolve({ type: 'background', key: '../escape' })
        ).toMatchObject({
            status: 'fallback',
            reason: 'invalid-release',
            error: { code: 'unsafe-path' },
        });
    });

    it('returns a release-unavailable fallback before any release is loaded', () => {
        const resolver = createResolver(createDocuments());
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'fallback',
            reason: 'release-unavailable',
            error: { code: 'unavailable' },
        });
    });

    it('resolves an avif URL when the manifest includes an avif variant', async () => {
        const AVIF_SHA = 'b'.repeat(64);
        const manifestBase = {
            schemaVersion: 1 as const,
            storyId: SOURCE.storyId,
            releaseId: `sha256-${'0'.repeat(64)}`,
            assets: [
                {
                    identity: {
                        type: 'background' as const,
                        key: '第一章/鏡 房/夜',
                    },
                    variants: {
                        webp: {
                            format: 'webp' as const,
                            path: `vn/objects/${WEBP_SHA}.webp`,
                            sha256: WEBP_SHA,
                            byteLength: 123,
                        },
                        avif: {
                            format: 'avif' as const,
                            path: `vn/objects/${AVIF_SHA}.avif`,
                            sha256: AVIF_SHA,
                            byteLength: 100,
                        },
                    },
                    width: 1600,
                    height: 900,
                },
            ],
        } as RuntimeAssetManifestV1;
        const releaseId = `sha256-${digest(
            canonicalReleaseContent(manifestBase)
        )}`;
        const manifest = {
            ...manifestBase,
            releaseId,
        } as RuntimeAssetManifestV1;
        const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
        const pointer = {
            schemaVersion: 1 as const,
            storyId: SOURCE.storyId,
            releaseId,
            manifestPath: getReleaseManifestPath(
                SOURCE.storyId,
                releaseId,
                SOURCE.target
            ),
            manifestSha256: digest(manifestText),
            publishedAt: '2026-07-26T10:00:00.000Z',
        };
        const documents = {
            pointer,
            pointerText: `${JSON.stringify(pointer, null, 2)}\n`,
            manifest,
            manifestText,
        };
        const resolver = createResolver(documents);
        await resolver.loadActiveRelease();
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'resolved',
            avifUrl: new URL(
                `http://localhost:5090/assets/vn/objects/${AVIF_SHA}.avif`
            ),
        });
    });

    it('resolves a placeholder URL when the manifest includes a placeholder', async () => {
        const PLACEHOLDER_SHA = 'c'.repeat(64);
        const manifestBase = {
            schemaVersion: 1 as const,
            storyId: SOURCE.storyId,
            releaseId: `sha256-${'0'.repeat(64)}`,
            assets: [
                {
                    identity: {
                        type: 'background' as const,
                        key: '第一章/鏡 房/夜',
                    },
                    variants: {
                        webp: {
                            format: 'webp' as const,
                            path: `vn/objects/${WEBP_SHA}.webp`,
                            sha256: WEBP_SHA,
                            byteLength: 123,
                        },
                    },
                    width: 1600,
                    height: 900,
                    placeholder: {
                        format: 'webp' as const,
                        path: `vn/objects/${PLACEHOLDER_SHA}.webp`,
                        sha256: PLACEHOLDER_SHA,
                        width: 80,
                        height: 45,
                    },
                },
            ],
        } as RuntimeAssetManifestV1;
        const releaseId = `sha256-${digest(
            canonicalReleaseContent(manifestBase)
        )}`;
        const manifest = {
            ...manifestBase,
            releaseId,
        } as RuntimeAssetManifestV1;
        const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
        const pointer = {
            schemaVersion: 1 as const,
            storyId: SOURCE.storyId,
            releaseId,
            manifestPath: getReleaseManifestPath(
                SOURCE.storyId,
                releaseId,
                SOURCE.target
            ),
            manifestSha256: digest(manifestText),
            publishedAt: '2026-07-26T10:00:00.000Z',
        };
        const documents = {
            pointer,
            pointerText: `${JSON.stringify(pointer, null, 2)}\n`,
            manifest,
            manifestText,
        };
        const resolver = createResolver(documents);
        await resolver.loadActiveRelease();
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'resolved',
            placeholderUrl: new URL(
                `http://localhost:5090/assets/vn/objects/${PLACEHOLDER_SHA}.webp`
            ),
        });
    });

    it('returns a fallback when resolveAssetUrl throws during resolve', async () => {
        const documents = createDocuments();
        const resolver = createResolver(documents);
        await resolver.loadActiveRelease();
        // Corrupt the source baseUrl so resolveAssetUrl throws
        (resolver as unknown as { source: AssetResolverSource }).source = {
            ...resolver.source,
            baseUrl: 'not-a-url',
        };
        expect(
            resolver.resolve({
                type: 'background',
                key: '第一章/鏡 房/夜',
            })
        ).toMatchObject({
            status: 'fallback',
            reason: 'invalid-release',
        });
    });

    // --- loadStoredFallback sort tiebreaker (line 616) ---
    it('breaks a publishedAt tie by choosing the higher validatedAt', async () => {
        const docA = createDocuments({
            key: 'tie/a',
            publishedAt: '2026-07-26T10:00:00.000Z',
        });
        const docB = createDocuments({
            key: 'tie/b',
            publishedAt: '2026-07-26T10:00:00.000Z',
        });
        const store = new ValidatedReleaseStore(
            createMemoryStorage([
                storedRecord(docA, {
                    validatedAt: NOW - 2_000,
                    lastUsedAt: NOW - 2_000,
                }),
                storedRecord(docB, {
                    validatedAt: NOW - 1_000,
                    lastUsedAt: NOW - 1_000,
                }),
            ])
        );
        const resolver = createResolver(docB, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).resolves.toMatchObject({
            source: 'last-validated-release',
            manifest: { releaseId: docB.pointer.releaseId },
        });
    });

    // --- revalidateStoredRecord edge cases ---
    it('rejects a stored record whose pointer releaseId does not match', async () => {
        const documents = createDocuments();
        const record = storedRecord(documents);
        record.releaseId = `sha256-${'f'.repeat(64)}`;
        const store = new ValidatedReleaseStore(createMemoryStorage([record]));
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    it('rejects a stored record with a non-number validatedAt', async () => {
        const documents = createDocuments();
        const record = storedRecord(documents) as unknown as Record<
            string,
            unknown
        >;
        record.validatedAt = 'not-a-number';
        const store = new ValidatedReleaseStore(createMemoryStorage([record]));
        const resolver = createResolver(documents, {
            fetchImpl: vi
                .fn()
                .mockRejectedValue(new TypeError('offline')) as typeof fetch,
            store,
        });
        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'network',
        });
    });

    // --- abort callbacks (lines 240, 345) ---
    it('aborts an in-flight fetch when the caller signal aborts', async () => {
        const fetchStarted = deferred<void>();
        const fetchImpl = vi.fn(
            async (_input: RequestInfo | URL, init?: RequestInit) => {
                fetchStarted.resolve();
                return await new Promise<Response>((_resolve, reject) => {
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
        const resolver = createResolver(createDocuments(), { fetchImpl });
        const controller = new AbortController();
        const pending = resolver.loadActiveRelease({
            signal: controller.signal,
        });
        await fetchStarted.promise;
        controller.abort();
        await expect(pending).rejects.toMatchObject({ code: 'network' });
    });
});
