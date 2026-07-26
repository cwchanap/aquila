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
import previewManifestText from '../../../../public/assets/vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/sha256-9ec642a37a531d9d59fb22470ef95e35493e6b7b9c92b240fd59ff0014fa1b4d/runtime-manifest.json?raw';

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
    }: {
        validatedAt?: number;
        lastUsedAt?: number;
        target?: PublicationTarget;
    } = {}
): ValidatedReleaseRecord {
    return {
        storyId: documents.pointer.storyId,
        target,
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

    it('uses no-cache and rejects an older publishedAt pointer', async () => {
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

        await expect(resolver.loadActiveRelease()).rejects.toMatchObject({
            code: 'stale-pointer',
        });
        expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
            cache: 'no-cache',
        });
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
            createMemoryStorage([storedRecord(other, { target: otherTarget })])
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
});
