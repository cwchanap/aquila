import { createHash, webcrypto } from 'node:crypto';
import {
    canonicalAudioReleaseContent,
    canonicalJson,
    getAudioReleaseManifestPath,
    parseRuntimeAudioManifest,
    type RuntimeAudioAssetV1,
    type RuntimeAudioManifestV1,
} from '@aquila/stories/runtime-assets';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createAudioRuntime,
    type AudioReaderRuntime,
} from '@/lib/audio/audio-runtime';
import { REMOTE_ASSET_STORY_ID } from '@/lib/visual-assets/source-factory';

const ORIGIN = 'http://localhost:5090';
const REMOTE_CONFIG = {
    baseUrl: 'https://assets.example.test/',
    environment: 'preview',
    previewId: 'preview-610',
};
const STORY_ID = REMOTE_ASSET_STORY_ID;

type AudioReleaseFixture = {
    storyId: string;
    releaseId: string;
    manifestSha256: string;
    publishedAt: string;
    manifest: RuntimeAudioManifestV1;
    pointerText: string;
    manifestText: string;
    fetch: typeof fetch;
};

function digest(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

function audioAsset(
    type: 'sfx' | 'bgm',
    key: string,
    objectSha = type === 'sfx' ? 'a'.repeat(64) : 'b'.repeat(64)
): RuntimeAudioAssetV1 {
    return {
        identity: { type, key },
        format: 'mp3',
        path: `vn/objects/${objectSha}.mp3`,
        sha256: objectSha as RuntimeAudioAssetV1['sha256'],
        byteLength: 123,
        durationMs: 1_000,
        loop: type === 'bgm',
    };
}

function makeAudioReleaseFixture(
    options: {
        storyId?: string;
        publishedAt?: string;
        assets?: readonly RuntimeAudioAssetV1[];
    } = {}
): AudioReleaseFixture {
    const storyId = options.storyId ?? STORY_ID;
    const assets = [...(options.assets ?? [])].sort((left, right) =>
        `${left.identity.type}:${left.identity.key}`.localeCompare(
            `${right.identity.type}:${right.identity.key}`
        )
    );
    const draft = parseRuntimeAudioManifest({
        schemaVersion: 1,
        storyId,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    });
    const releaseId = `sha256-${digest(canonicalAudioReleaseContent(draft))}`;
    const manifest = parseRuntimeAudioManifest({ ...draft, releaseId });
    const manifestText = `${canonicalJson(manifest as never)}\n`;
    const target = { kind: 'preview' as const, previewId: 'preview-610' };
    const pointer = {
        schemaVersion: 1 as const,
        storyId,
        releaseId,
        manifestPath: getAudioReleaseManifestPath(storyId, releaseId, target),
        manifestSha256: digest(manifestText),
        publishedAt: options.publishedAt ?? '2026-08-18T10:00:00.000Z',
    };
    const pointerText = `${canonicalJson(pointer as never)}\n`;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/current.json')) return new Response(pointerText);
        if (url.endsWith('/runtime-manifest.json')) {
            return new Response(manifestText);
        }
        return new Response('missing', { status: 404 });
    }) as typeof fetch;
    return {
        storyId,
        releaseId,
        manifestSha256: pointer.manifestSha256,
        publishedAt: pointer.publishedAt,
        manifest,
        pointerText,
        manifestText,
        fetch: fetchImpl,
    };
}

function createRemoteAudioRuntime(
    fixture: AudioReleaseFixture
): AudioReaderRuntime {
    return createAudioRuntime(fixture.storyId, ORIGIN, REMOTE_CONFIG, {
        fetchImpl: fixture.fetch,
    })!;
}

describe('AudioReaderRuntime', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('uses local fixtures without a release fetch', async () => {
        const fetchImpl = vi.fn();
        const runtime = createAudioRuntime(
            'train_adventure',
            ORIGIN,
            {},
            { fetchImpl: fetchImpl as unknown as typeof fetch }
        )!;

        await expect(runtime.loadActiveRelease()).resolves.toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(runtime.resolve('sfx', 'door-open')).toMatchObject({
            status: 'resolved',
            asset: null,
        });
    });

    it('accepts a valid zero-asset release', async () => {
        const fixture = makeAudioReleaseFixture();
        const runtime = createRemoteAudioRuntime(fixture);

        await expect(runtime.loadActiveRelease()).resolves.toMatchObject({
            releaseId: fixture.releaseId,
            manifestSha256: fixture.manifestSha256,
        });
        expect(runtime.resolve('sfx', 'door-open')).toEqual({
            status: 'unavailable',
            reason: 'cue-not-in-release',
        });
    });

    it('allows the remote story and rejects another story', () => {
        const fixture = makeAudioReleaseFixture();
        expect(
            createAudioRuntime(REMOTE_ASSET_STORY_ID, ORIGIN, REMOTE_CONFIG, {
                fetchImpl: fixture.fetch,
            })
        ).not.toBeNull();
        expect(
            createAudioRuntime('train_adventure', ORIGIN, REMOTE_CONFIG, {
                fetchImpl: fixture.fetch,
            })
        ).toBeNull();
    });

    it('reports release-not-loaded before accepting a remote release', () => {
        const fixture = makeAudioReleaseFixture();
        const runtime = createRemoteAudioRuntime(fixture);

        expect(runtime.resolve('sfx', 'door-open')).toEqual({
            status: 'unavailable',
            reason: 'release-not-loaded',
        });
    });

    it('reports local-cue-missing for an unknown local fixture key', () => {
        const runtime = createAudioRuntime('train_adventure', ORIGIN, {})!;

        expect(runtime.resolve('sfx', 'not-a-local-cue')).toEqual({
            status: 'unavailable',
            reason: 'local-cue-missing',
        });
    });

    it('keeps SFX and BGM identities distinct for the same logical key', async () => {
        const fixture = makeAudioReleaseFixture({
            assets: [
                audioAsset('bgm', 'shared-key'),
                audioAsset('sfx', 'shared-key'),
            ],
        });
        const runtime = createRemoteAudioRuntime(fixture);
        await runtime.loadActiveRelease();

        const sfx = runtime.resolve('sfx', 'shared-key');
        const bgm = runtime.resolve('bgm', 'shared-key');
        expect(sfx).toMatchObject({ status: 'resolved' });
        expect(bgm).toMatchObject({ status: 'resolved' });
        expect(sfx).not.toEqual(bgm);
        expect(sfx).toMatchObject({ asset: { identity: { type: 'sfx' } } });
        expect(bgm).toMatchObject({ asset: { identity: { type: 'bgm' } } });
    });

    it('swaps future resolutions after a newer release revalidation', async () => {
        const first = makeAudioReleaseFixture({
            assets: [audioAsset('sfx', 'door-open', 'c'.repeat(64))],
            publishedAt: '2026-08-18T10:00:00.000Z',
        });
        const second = makeAudioReleaseFixture({
            assets: [audioAsset('sfx', 'door-open', 'd'.repeat(64))],
            publishedAt: '2026-08-18T11:00:00.000Z',
        });
        let current = first;
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            return url.endsWith('/current.json')
                ? new Response(current.pointerText)
                : new Response(current.manifestText);
        }) as typeof fetch;
        const runtime = createAudioRuntime(STORY_ID, ORIGIN, REMOTE_CONFIG, {
            fetchImpl,
        })!;

        await runtime.loadActiveRelease();
        expect(runtime.resolve('sfx', 'door-open')).toMatchObject({
            url: expect.stringContaining(`${'c'.repeat(64)}.mp3`),
        });
        current = second;
        await runtime.softRevalidate();
        expect(runtime.resolve('sfx', 'door-open')).toMatchObject({
            url: expect.stringContaining(`${'d'.repeat(64)}.mp3`),
        });
    });

    it('keeps the accepted release when a newer check returns an older pointer', async () => {
        const current = makeAudioReleaseFixture({
            assets: [audioAsset('sfx', 'door-open', 'c'.repeat(64))],
            publishedAt: '2026-08-18T10:00:00.000Z',
        });
        const older = makeAudioReleaseFixture({
            assets: [audioAsset('sfx', 'door-open', 'd'.repeat(64))],
            publishedAt: '2026-08-18T09:00:00.000Z',
        });
        let active = current;
        const fetchImpl = vi.fn(async (input: RequestInfo | URL) =>
            String(input).endsWith('/current.json')
                ? new Response(active.pointerText)
                : new Response(active.manifestText)
        ) as typeof fetch;
        const runtime = createAudioRuntime(STORY_ID, ORIGIN, REMOTE_CONFIG, {
            fetchImpl,
        })!;

        await runtime.loadActiveRelease();
        active = older;
        await expect(runtime.softRevalidate()).resolves.toMatchObject({
            releaseId: current.releaseId,
        });
        expect(runtime.resolve('sfx', 'door-open')).toMatchObject({
            url: expect.stringContaining(`${'c'.repeat(64)}.mp3`),
        });
    });

    it('keeps the accepted release when soft revalidation fails', async () => {
        const fixture = makeAudioReleaseFixture({
            assets: [audioAsset('sfx', 'door-open')],
        });
        const fetchImpl = vi
            .fn()
            .mockImplementationOnce(fixture.fetch)
            .mockImplementationOnce(fixture.fetch)
            .mockRejectedValue(new Error('offline')) as typeof fetch;
        const runtime = createAudioRuntime(STORY_ID, ORIGIN, REMOTE_CONFIG, {
            fetchImpl,
        })!;

        await runtime.loadActiveRelease();
        await expect(runtime.softRevalidate()).resolves.toMatchObject({
            releaseId: fixture.releaseId,
        });
        expect(runtime.resolve('sfx', 'door-open')).toMatchObject({
            status: 'resolved',
        });
    });

    it('does not fetch further or reactivate state when a fetch completes after dispose', async () => {
        const fixture = makeAudioReleaseFixture({
            assets: [audioAsset('sfx', 'door-open')],
        });
        let resolveFetch!: (response: Response) => void;
        let fetchCalls = 0;
        const fetchImpl = vi.fn(() => {
            fetchCalls += 1;
            return new Promise<Response>(resolve => {
                resolveFetch = response => {
                    resolve(response);
                };
            });
        }) as typeof fetch;
        const runtime = createAudioRuntime(STORY_ID, ORIGIN, REMOTE_CONFIG, {
            fetchImpl,
        })!;
        const loading = runtime.loadActiveRelease();
        runtime.dispose();
        resolveFetch(new Response(fixture.pointerText));
        await expect(loading).resolves.toBeNull();
        expect(fetchCalls).toBe(1);
        expect(runtime.resolve('sfx', 'door-open')).toEqual({
            status: 'unavailable',
            reason: 'release-not-loaded',
        });
    });
});
