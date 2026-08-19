import {
    AssetResolverError,
    RUNTIME_ASSET_CACHE_POLICY,
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    resolveAssetUrl,
    validatePointerManifestPair,
    type ActiveReleasePointerV1,
    type AssetResolverSource,
    type ManifestByteSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { sha256Hex, utf8Bytes } from '@/lib/visual-assets/hash';

export type RuntimeReleaseCodecs<
    M extends { storyId: string; releaseId: string },
> = {
    getCurrentPointerPath: (
        storyId: string,
        target: PublicationTarget
    ) => string;
    parsePointer: (
        input: unknown,
        target: PublicationTarget,
        storyId: string
    ) => ActiveReleasePointerV1;
    parseManifest: (input: unknown) => M;
    canonicalReleaseContent: (manifest: M) => string;
};

export type LoadedRuntimeRelease<M> = {
    pointer: ActiveReleasePointerV1;
    manifest: M;
    manifestSha256: ManifestByteSha256;
    pointerText: string;
    manifestText: string;
};

function asResolverError(error: unknown): AssetResolverError {
    return error instanceof AssetResolverError
        ? error
        : new AssetResolverError('network', 'Runtime asset request failed', {
              cause: error,
          });
}

async function fetchWithTimeout<T>(
    fetchImpl: typeof fetch,
    url: URL,
    timeoutMs: number,
    init: RequestInit,
    parentSignal: AbortSignal | undefined,
    callback: (response: Response) => Promise<T>
): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    const abort = () => controller.abort();
    parentSignal?.addEventListener('abort', abort, { once: true });
    try {
        if (parentSignal?.aborted) {
            throw new AssetResolverError(
                'network',
                'Runtime asset request aborted before start'
            );
        }
        const response = await fetchImpl(url, {
            ...init,
            signal: controller.signal,
        });
        return await callback(response);
    } catch (cause) {
        if (timedOut) {
            throw new AssetResolverError(
                'timeout',
                `Runtime asset request timed out after ${timeoutMs}ms`,
                { cause }
            );
        }
        throw cause;
    } finally {
        globalThis.clearTimeout(timeout);
        parentSignal?.removeEventListener('abort', abort);
    }
}

async function readResponseText(
    fetchImpl: typeof fetch,
    url: URL,
    timeoutMs: number,
    cache: RequestCache,
    signal?: AbortSignal
): Promise<string> {
    try {
        return await fetchWithTimeout(
            fetchImpl,
            url,
            timeoutMs,
            { cache },
            signal,
            async response => {
                if (!response.ok) {
                    throw new AssetResolverError(
                        'unavailable',
                        `Runtime asset request returned HTTP ${response.status}`
                    );
                }
                try {
                    return await response.text();
                } catch (cause) {
                    throw new AssetResolverError(
                        'network',
                        'Runtime asset response could not be read',
                        { cause }
                    );
                }
            }
        );
    } catch (error) {
        throw asResolverError(error);
    }
}

function parseJson(text: string, contractName: string): unknown {
    try {
        return JSON.parse(text);
    } catch (cause) {
        throw new AssetResolverError(
            'validation',
            `Invalid ${contractName} JSON`,
            { cause }
        );
    }
}

async function sha256Utf8Text(text: string): Promise<string> {
    return sha256Hex(Uint8Array.from(utf8Bytes(text)));
}

export async function loadValidatedRelease<
    M extends { storyId: string; releaseId: string },
>(options: {
    fetchImpl: typeof fetch;
    source: AssetResolverSource;
    codecs: RuntimeReleaseCodecs<M>;
    signal?: AbortSignal;
    assertPointerAcceptable?: (pointer: ActiveReleasePointerV1) => void;
}): Promise<LoadedRuntimeRelease<M>> {
    const { fetchImpl, source, codecs, signal } = options;
    const pointerText = await readResponseText(
        fetchImpl,
        resolveAssetUrl(
            source.baseUrl,
            codecs.getCurrentPointerPath(source.storyId, source.target)
        ),
        RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer,
        'no-cache',
        signal
    );
    const pointer = codecs.parsePointer(
        parseJson(pointerText, 'active-release pointer'),
        source.target,
        source.storyId
    );
    options.assertPointerAcceptable?.(pointer);

    const manifestText = await readResponseText(
        fetchImpl,
        resolveAssetUrl(source.baseUrl, pointer.manifestPath),
        RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest,
        'force-cache',
        signal
    );
    const manifestSha256 = assertSha256<'manifest-bytes'>(
        await sha256Utf8Text(manifestText)
    );
    if (manifestSha256 !== pointer.manifestSha256) {
        throw new AssetResolverError('integrity', 'Manifest checksum mismatch');
    }
    const manifest = codecs.parseManifest(
        parseJson(manifestText, 'runtime asset manifest')
    );
    validatePointerManifestPair(pointer, manifest, manifestSha256);
    const canonicalDigest = assertSha256<'release-content'>(
        await sha256Utf8Text(codecs.canonicalReleaseContent(manifest))
    );
    assertReleaseIdMatchesContentSha256(manifest, canonicalDigest);

    return {
        pointer,
        manifest,
        manifestSha256,
        pointerText,
        manifestText,
    };
}
