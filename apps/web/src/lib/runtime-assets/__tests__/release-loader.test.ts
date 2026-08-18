import { webcrypto } from 'node:crypto';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    type ActiveReleasePointerV1,
    type AssetResolverSource,
    type ManifestByteSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadValidatedRelease } from '../release-loader';

const SOURCE: AssetResolverSource = {
    environment: 'preview',
    storyId: 'story_id',
    baseUrl: 'https://assets.example.test/',
    target: { kind: 'preview', previewId: 'preview-id' },
};

type LoaderFixture = {
    fetch: typeof fetch;
    source: AssetResolverSource;
    getCurrentPointerPath: (
        storyId: string,
        target: PublicationTarget
    ) => string;
    parsePointer: (
        input: unknown,
        target: PublicationTarget,
        storyId: string
    ) => ActiveReleasePointerV1;
    pointer: ActiveReleasePointerV1;
    manifestText: string;
};

function makeLoaderFixture(
    options: {
        pointerManifestSha256?: string;
        manifestText?: string;
        onRequest?: (url: string, init?: RequestInit) => void;
    } = {}
): LoaderFixture {
    const manifestText = options.manifestText ?? '{"schemaVersion":1}';
    const pointer = {
        schemaVersion: 1 as const,
        storyId: SOURCE.storyId,
        releaseId: `sha256-${'b'.repeat(64)}`,
        manifestPath: 'manifest.json',
        manifestSha256: (options.pointerManifestSha256 ??
            'c'.repeat(64)) as ManifestByteSha256,
        publishedAt: '2026-08-18T10:00:00.000Z',
    };
    const pointerText = JSON.stringify(pointer);
    const fetchImpl = vi.fn(
        async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            options.onRequest?.(url, init);
            if (url.endsWith('/current.json')) {
                return new Response(pointerText);
            }
            return new Response(manifestText);
        }
    ) as typeof fetch;

    return {
        fetch: fetchImpl,
        source: SOURCE,
        getCurrentPointerPath: () => 'current.json',
        parsePointer: () => pointer,
        pointer,
        manifestText,
    };
}

describe('loadValidatedRelease', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', webcrypto);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('rejects a manifest checksum mismatch before parsing the manifest', async () => {
        const parseManifest = vi.fn();
        const fixture = makeLoaderFixture({
            pointerManifestSha256: 'a'.repeat(64),
            manifestText: '{"schemaVersion":1}',
        });

        await expect(
            loadValidatedRelease({
                fetchImpl: fixture.fetch,
                source: fixture.source,
                codecs: {
                    getCurrentPointerPath: fixture.getCurrentPointerPath,
                    parsePointer: fixture.parsePointer,
                    parseManifest,
                    canonicalReleaseContent: vi.fn(),
                },
            })
        ).rejects.toMatchObject({ code: 'integrity' });

        expect(parseManifest).not.toHaveBeenCalled();
    });

    it('aborts a pointer request at the configured pointer timeout', async () => {
        vi.useFakeTimers();
        let requestSignal: AbortSignal | undefined;
        const fetchImpl = vi.fn(
            (_input: RequestInfo | URL, init?: RequestInit) => {
                requestSignal = init?.signal ?? undefined;
                return new Promise<Response>((_resolve, reject) => {
                    const abort = () =>
                        reject(new DOMException('aborted', 'AbortError'));
                    if (requestSignal?.aborted) abort();
                    else
                        requestSignal?.addEventListener('abort', abort, {
                            once: true,
                        });
                });
            }
        ) as typeof fetch;
        const pending = loadValidatedRelease({
            fetchImpl,
            source: SOURCE,
            codecs: {
                getCurrentPointerPath: () => 'current.json',
                parsePointer: vi.fn(),
                parseManifest: vi.fn(),
                canonicalReleaseContent: vi.fn(),
            },
        });
        const rejection = expect(pending).rejects.toMatchObject({
            code: 'timeout',
        });

        await vi.advanceTimersByTimeAsync(
            RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer
        );
        await rejection;
        expect(requestSignal?.aborted).toBe(true);
    });

    it('runs pointer acceptance after parsing and before the manifest request', async () => {
        const events: string[] = [];
        const fixture = makeLoaderFixture({
            onRequest: url =>
                events.push(
                    url.endsWith('/current.json')
                        ? 'pointer-request'
                        : 'manifest-request'
                ),
        });
        const parsePointer = vi.fn(
            (...args: Parameters<typeof fixture.parsePointer>) => {
                events.push('pointer-parse');
                return fixture.parsePointer(...args);
            }
        );
        const assertPointerAcceptable = vi.fn(() => {
            events.push('pointer-accepted');
            throw new Error('pointer rejected by caller');
        });

        await expect(
            loadValidatedRelease({
                fetchImpl: fixture.fetch,
                source: fixture.source,
                codecs: {
                    getCurrentPointerPath: fixture.getCurrentPointerPath,
                    parsePointer,
                    parseManifest: vi.fn(),
                    canonicalReleaseContent: vi.fn(),
                },
                assertPointerAcceptable,
            })
        ).rejects.toThrow('pointer rejected by caller');

        expect(events).toEqual([
            'pointer-request',
            'pointer-parse',
            'pointer-accepted',
        ]);
        expect(assertPointerAcceptable).toHaveBeenCalledWith(fixture.pointer);
    });
});
