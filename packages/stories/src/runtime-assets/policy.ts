export const RUNTIME_ASSET_CACHE_POLICY = {
    currentPointer: {
        responseCacheControl: 'no-cache, max-age=0, must-revalidate',
        revalidateAfterMs: 60_000,
        staleIfErrorMs: 86_400_000,
    },
    immutableRelease: {
        responseCacheControl: 'public, max-age=31536000, immutable',
    },
    clientBounds: {
        maxValidatedReleases: 2,
        maxDecodedAssets: 48,
        maxDecodedBytes: 96 * 1024 * 1024,
    },
    timeoutMs: {
        pointer: 5_000,
        manifest: 10_000,
        asset: 15_000,
    },
    prefetch: {
        maxNavigationEdges: 1,
        maxConcurrentRequests: 2,
    },
} as const;

export const RUNTIME_ASSET_DIMENSION_POLICY = {
    background: {
        aspectRatio: '16:9',
        preferredSource: { width: 1920, height: 1080 },
        minimumSource: { width: 1600, height: 900 },
        preferredRuntime: { width: 1600, height: 900 },
    },
    portrait: {
        aspectRatio: '3:4',
        preferredSource: { width: 1200, height: 1600 },
        minimumSource: { width: 900, height: 1200 },
        preferredRuntime: { width: 900, height: 1200 },
    },
} as const;
