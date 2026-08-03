export type VisualReleaseState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'stale-but-usable'
    | 'unavailable'
    | 'invalid';

export type VisualLayerState =
    | 'omitted'
    | 'loading'
    | 'ready'
    | 'missing'
    | 'failed';

export type DecodedAsset = {
    cacheKey: string;
    objectUrl: string;
    byteLength: number;
    width: number;
    height: number;
    decodedBytes: number;
};

export type VisualImageLayer = {
    state: VisualLayerState;
    identity: string | null;
    objectUrl: string | null;
    width: number | null;
    height: number | null;
};

export type VisualPortraitLayer = VisualImageLayer & {
    slot: 'left' | 'center' | 'right';
};

export type VisualReleaseIdentity = Readonly<{
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
}>;

export type VisualSnapshot = {
    release: VisualReleaseState;
    releaseIdentity: VisualReleaseIdentity | null;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portrait: VisualPortraitLayer;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
