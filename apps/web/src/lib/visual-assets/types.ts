import type { PortraitStageSlot } from './portrait-stage';

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

export type VisualPortraitLayer = VisualImageLayer;
export type VisualPortraitLayers = Readonly<
    Record<PortraitStageSlot, VisualPortraitLayer>
>;

/**
 * Identity of the validated runtime asset release currently serving visuals.
 * Absent (null) until a release validates, and cleared again when the release
 * becomes invalid, the runtime is disposed, or the story changes.
 */
export type RuntimeReleaseIdentity = {
    assetEnvironment: 'local' | 'preview' | 'production';
    previewId: string | null;
    releaseId: string;
    manifestSha256: string;
};

export type VisualReleaseIdentity = RuntimeReleaseIdentity;

export type VisualSnapshot = {
    release: VisualReleaseState;
    activeBackground: VisualImageLayer;
    stagingBackground: VisualImageLayer;
    portraits: VisualPortraitLayers;
    activePortraitSlot: PortraitStageSlot | null;
    releaseIdentity: VisualReleaseIdentity | null;
    status: 'stale' | 'fallback' | 'unavailable' | null;
};
