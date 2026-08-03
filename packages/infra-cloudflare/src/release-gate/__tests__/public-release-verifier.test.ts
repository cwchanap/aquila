import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
    canonicalReleaseContent,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseRuntimeAssetManifest,
} from '@aquila/stories/runtime-assets';
import {
    verifyPublicRelease,
    type PublicVerifierDependencies,
} from '../public-release-verifier';
import type {
    PublicReleaseVerificationInputV1,
    PublicReleaseVerificationResultV1,
} from '../schemas';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'preview', previewId: 'hpa-233' } as const;
const ASSET_BASE_URL = 'https://assets.example.test';
const BROWSER_ORIGIN = 'https://preview.example.test';
const POINTER_CACHE = 'no-cache, max-age=0, must-revalidate';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

type Dimensions = { width: number; height: number };

type FixtureVariant = {
    format: 'webp' | 'avif';
    body: string;
    path: string;
    sha256: string;
    byteLength: number;
};

type FixtureAsset = {
    identity: { type: 'background' | 'portrait'; key: string };
    width: number;
    height: number;
    variants: FixtureVariant[];
};

type ReleaseFixture = {
    releaseId: string;
    manifestSha256: string;
    manifestText: string;
    pointerText: string;
    assets: FixtureAsset[];
    dimensionsByBody: ReadonlyMap<string, Dimensions>;
};

function sha256(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
}

function createVariant(format: 'webp' | 'avif', body: string): FixtureVariant {
    const digest = sha256(body);
    return {
        format,
        body,
        sha256: digest,
        byteLength: Buffer.byteLength(body),
        path: getObjectPath(
            digest as Parameters<typeof getObjectPath>[0],
            format
        ),
    };
}

function buildFixture(
    options: {
        manifestExtra?: Record<string, unknown>;
        includeAvif?: boolean;
    } = {}
): ReleaseFixture {
    const includeAvif = options.includeAvif ?? true;
    const assets: FixtureAsset[] = [
        {
            identity: { type: 'background', key: 'chapter_1/opening' },
            width: 640,
            height: 360,
            variants: [
                createVariant('webp', 'background-webp-01'),
                ...(includeAvif
                    ? [createVariant('avif', 'background-avif-01')]
                    : []),
            ],
        },
        {
            identity: { type: 'portrait', key: 'characters/mira' },
            width: 360,
            height: 640,
            variants: [
                createVariant('webp', 'portrait-webp-01'),
                ...(includeAvif
                    ? [createVariant('avif', 'portrait-avif-01')]
                    : []),
            ],
        },
    ];

    const manifestWithoutRelease = {
        schemaVersion: 1 as const,
        storyId: STORY_ID,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets: assets.map(asset => ({
            identity: asset.identity,
            variants: Object.fromEntries(
                asset.variants.map(variant => [variant.format, variant])
            ),
            width: asset.width,
            height: asset.height,
        })),
    };
    const parsedWithoutRelease = parseRuntimeAssetManifest(
        manifestWithoutRelease
    );
    const releaseId = `sha256-${sha256(
        canonicalReleaseContent(parsedWithoutRelease)
    )}`;
    const manifest = {
        ...manifestWithoutRelease,
        releaseId,
        ...options.manifestExtra,
    };
    const manifestText = JSON.stringify(manifest);
    const manifestSha256 = sha256(manifestText);
    const pointerText = JSON.stringify({
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId,
        manifestPath: getReleaseManifestPath(STORY_ID, releaseId, TARGET),
        manifestSha256,
        publishedAt: '2026-08-03T12:00:00.000Z',
    });
    const dimensionsByBody = new Map<string, Dimensions>();
    for (const asset of assets) {
        for (const variant of asset.variants) {
            dimensionsByBody.set(variant.body, {
                width: asset.width,
                height: asset.height,
            });
        }
    }
    return {
        releaseId,
        manifestSha256,
        manifestText,
        pointerText,
        assets,
        dimensionsByBody,
    };
}

type FixtureFetchOptions = {
    requests?: string[];
    pointerHeaders?: Record<string, string>;
    manifestHeaders?: Record<string, string>;
    objectHeaders?: Record<string, string>;
    objectBodies?: ReadonlyMap<string, string>;
};

function fixtureFetch(
    fixture: ReleaseFixture,
    options: FixtureFetchOptions = {}
): typeof globalThis.fetch {
    const pointerUrl = `${ASSET_BASE_URL}/${getCurrentPointerPath(
        STORY_ID,
        TARGET
    )}`;
    const manifestUrl = `${ASSET_BASE_URL}/${getReleaseManifestPath(
        STORY_ID,
        fixture.releaseId,
        TARGET
    )}`;
    const objects = new Map<string, FixtureVariant>();
    for (const asset of fixture.assets) {
        for (const variant of asset.variants) {
            objects.set(variant.path, variant);
        }
    }

    return (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        options.requests?.push(url);
        if (url === pointerUrl) {
            return new Response(fixture.pointerText, {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                    'cache-control': POINTER_CACHE,
                    'access-control-allow-origin': '*',
                    'cf-cache-status': 'BYPASS',
                    ...options.pointerHeaders,
                },
            });
        }
        if (url === manifestUrl) {
            return new Response(fixture.manifestText, {
                status: 200,
                headers: {
                    'content-type': 'application/json',
                    'cache-control': IMMUTABLE_CACHE,
                    'access-control-allow-origin': '*',
                    'cf-cache-status': 'HIT',
                    ...options.manifestHeaders,
                },
            });
        }
        for (const [path, variant] of objects) {
            if (url === `${ASSET_BASE_URL}/${path}`) {
                return new Response(
                    options.objectBodies?.get(path) ?? variant.body,
                    {
                        status: 200,
                        headers: {
                            'content-type':
                                variant.format === 'webp'
                                    ? 'image/webp'
                                    : 'image/avif',
                            'cache-control': IMMUTABLE_CACHE,
                            'access-control-allow-origin': '*',
                            'cf-cache-status': 'HIT',
                            ...options.objectHeaders,
                        },
                    }
                );
            }
        }
        return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;
}

function fixtureDecoder(
    fixture: ReleaseFixture,
    overrides: ReadonlyMap<string, Dimensions> = new Map()
): PublicVerifierDependencies['decodeImage'] {
    return async bytes => {
        const body = new TextDecoder().decode(bytes);
        const dimensions =
            overrides.get(body) ?? fixture.dimensionsByBody.get(body);
        if (dimensions === undefined) {
            throw new Error('fixture image cannot be decoded');
        }
        return dimensions;
    };
}

function candidateInput(
    fixture: ReleaseFixture,
    overrides: Partial<PublicReleaseVerificationInputV1> = {}
): PublicReleaseVerificationInputV1 {
    return {
        storyId: STORY_ID,
        target: TARGET,
        assetBaseUrl: ASSET_BASE_URL,
        browserOrigin: BROWSER_ORIGIN,
        mode: 'candidate',
        releaseId: fixture.releaseId,
        expectedManifestSha256: fixture.manifestSha256,
        omittedIdentities: [],
        ...overrides,
    } as PublicReleaseVerificationInputV1;
}

function activeInput(): PublicReleaseVerificationInputV1 {
    return {
        storyId: STORY_ID,
        target: TARGET,
        assetBaseUrl: ASSET_BASE_URL,
        browserOrigin: BROWSER_ORIGIN,
        mode: 'active',
        omittedIdentities: [],
    };
}

function statusOf(
    result: PublicReleaseVerificationResultV1,
    id: string
): 'passed' | 'failed' | undefined {
    return result.checks.find(check => check.id === id)?.status;
}

describe('verifyPublicRelease', () => {
    it('verifies an immutable candidate without reading the active pointer', async () => {
        const fixture = buildFixture();
        const requests: string[] = [];
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture, { requests }),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('passed');
        expect(requests).not.toContainEqual(
            expect.stringContaining('/current.json')
        );
        expect(result.releaseId).toBe(fixture.releaseId);
        expect(result.manifestSha256).toBe(fixture.manifestSha256);
        expect(statusOf(result, 'manifest.integrity')).toBe('passed');
        expect(statusOf(result, 'object.decode')).toBe('passed');
    });

    it('derives release and checksum from validated active documents', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(activeInput(), {
            fetch: fixtureFetch(fixture),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('passed');
        expect(result.releaseId).toBe(fixture.releaseId);
        expect(result.manifestSha256).toBe(fixture.manifestSha256);
        expect(statusOf(result, 'pointer.fetch')).toBe('passed');
        expect(statusOf(result, 'pointer.cache')).toBe('passed');
    });

    it('returns a failed candidate result when the immutable manifest is unavailable', async () => {
        const fixture = buildFixture();
        const manifestUrl = `${ASSET_BASE_URL}/${getReleaseManifestPath(
            STORY_ID,
            fixture.releaseId,
            TARGET
        )}`;
        const baseFetch = fixtureFetch(fixture);
        const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            if (url === manifestUrl)
                return new Response('not found', { status: 404 });
            return baseFetch(input, init);
        }) as typeof globalThis.fetch;

        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch,
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(result.releaseId).toBe(fixture.releaseId);
        expect(result.manifestSha256).toBe(fixture.manifestSha256);
        expect(statusOf(result, 'manifest.fetch')).toBe('failed');
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'manifest/fetch',
                stage: 'manifest',
                releaseId: fixture.releaseId,
                manifestSha256: fixture.manifestSha256,
            })
        );
    });

    it('returns a failed active result when the immutable manifest is not JSON', async () => {
        const fixture = buildFixture();
        const malformedManifest = '{not-json';
        const manifestUrl = `${ASSET_BASE_URL}/${getReleaseManifestPath(
            STORY_ID,
            fixture.releaseId,
            TARGET
        )}`;
        const baseFetch = fixtureFetch(fixture);
        const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string' ? input : input.toString();
            if (url === manifestUrl) {
                return new Response(malformedManifest, {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }
            return baseFetch(input, init);
        }) as typeof globalThis.fetch;

        const result = await verifyPublicRelease(activeInput(), {
            fetch,
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(result.releaseId).toBe(fixture.releaseId);
        expect(result.manifestSha256).toBe(sha256(malformedManifest));
        expect(statusOf(result, 'manifest.fetch')).toBe('failed');
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'manifest/fetch',
                stage: 'manifest',
                releaseId: fixture.releaseId,
                manifestSha256: sha256(malformedManifest),
            })
        );
    });

    it('reports wrong pointer CORS with a stable, safe diagnostic', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(activeInput(), {
            fetch: fixtureFetch(fixture, {
                pointerHeaders: {
                    'access-control-allow-origin': 'https://wrong.example.test',
                },
            }),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'pointer.cors')).toBe('failed');
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'pointer/cors',
                stage: 'pointer',
                storyId: STORY_ID,
                target: TARGET,
                releaseId: fixture.releaseId,
                manifestSha256: fixture.manifestSha256,
            })
        );
    });

    it('rejects invalid immutable cache directives', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture, {
                manifestHeaders: { 'cache-control': 'no-cache' },
            }),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'manifest.cache')).toBe('failed');
        expect(
            result.diagnostics.some(
                diagnostic => diagnostic.code === 'manifest/cache'
            )
        ).toBe(true);
    });

    it('rejects an object with the wrong media type', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture, {
                objectHeaders: { 'content-type': 'application/octet-stream' },
            }),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'object.media-type')).toBe('failed');
    });

    it('rejects an otherwise immutable object that bypassed the edge cache', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture, {
                objectHeaders: { 'cf-cache-status': 'DYNAMIC' },
            }),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'object.cache')).toBe('failed');
        expect(
            result.diagnostics.some(
                diagnostic => diagnostic.code === 'public-object/cache'
            )
        ).toBe(true);
    });

    it('retains the HPA-229 requirement for at least one AVIF object', async () => {
        const fixture = buildFixture({ includeAvif: false });
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'object.media-type')).toBe('failed');
        expect(
            result.diagnostics.some(
                diagnostic => diagnostic.code === 'public-object/avif-missing'
            )
        ).toBe(true);
    });

    it('rejects an object whose checksum does not match the manifest', async () => {
        const fixture = buildFixture();
        const corrupted = new Map<string, string>();
        const firstObject = fixture.assets[0]?.variants[0];
        if (firstObject === undefined) throw new Error('fixture is incomplete');
        corrupted.set(firstObject.path, 'zzckground-webp-01');
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture, { objectBodies: corrupted }),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'object.integrity')).toBe('failed');
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'public-object/integrity',
                identity: 'background:chapter_1/opening',
                safePath: firstObject.path,
                publicUrl: `${ASSET_BASE_URL}/${firstObject.path}`,
            })
        );
    });

    it('rejects a decodable object with manifest-inconsistent dimensions', async () => {
        const fixture = buildFixture();
        const firstObject = fixture.assets[0]?.variants[0];
        if (firstObject === undefined) throw new Error('fixture is incomplete');
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture),
            decodeImage: fixtureDecoder(
                fixture,
                new Map([[firstObject.body, { width: 641, height: 360 }]])
            ),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'object.decode')).toBe('failed');
        expect(
            result.diagnostics.some(
                diagnostic => diagnostic.code === 'browser-decode/dimensions'
            )
        ).toBe(true);
    });

    it('reports forbidden public fields without accepting the document', async () => {
        const fixture = buildFixture({
            manifestExtra: { prompt: 'private prompt' },
        });
        const result = await verifyPublicRelease(candidateInput(fixture), {
            fetch: fixtureFetch(fixture),
            decodeImage: fixtureDecoder(fixture),
        });

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'manifest.privacy')).toBe('failed');
        expect(statusOf(result, 'manifest.integrity')).toBe('failed');
        expect(
            result.diagnostics.some(
                diagnostic => diagnostic.code === 'manifest/privacy'
            )
        ).toBe(true);
    });

    it('fails when an omitted identity leaks into the public manifest', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(
            candidateInput(fixture, {
                omittedIdentities: ['portrait:characters/mira'],
            }),
            {
                fetch: fixtureFetch(fixture),
                decodeImage: fixtureDecoder(fixture),
            }
        );

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'coverage.omitted-absent')).toBe('failed');
        expect(result.diagnostics).toContainEqual(
            expect.objectContaining({
                code: 'coverage/omitted-present',
                identity: 'portrait:characters/mira',
                stage: 'coverage',
            })
        );
    });

    it('fails when the observed manifest bytes differ from the expected checksum', async () => {
        const fixture = buildFixture();
        const result = await verifyPublicRelease(
            candidateInput(fixture, {
                expectedManifestSha256: 'f'.repeat(64),
            }),
            {
                fetch: fixtureFetch(fixture),
                decodeImage: fixtureDecoder(fixture),
            }
        );

        expect(result.status).toBe('failed');
        expect(statusOf(result, 'manifest.integrity')).toBe('failed');
        expect(
            result.diagnostics.some(
                diagnostic => diagnostic.code === 'manifest/expected-checksum'
            )
        ).toBe(true);
    });
});
