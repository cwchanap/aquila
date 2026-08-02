import type {
    LogicalAssetIdentity,
    ManifestByteSha256,
    ObjectContentSha256,
    PublicationTarget,
    ReleaseContentSha256,
    RuntimeAssetManifestV1,
    StoryAssetCoverageReport,
} from '@aquila/stories/runtime-assets';

export type PublisherCommandName =
    | 'plan'
    | 'publish'
    | 'mirror-preview'
    | 'activate'
    | 'verify'
    | 'releases'
    | 'rollback';

export type PublicationDestination =
    | { kind: 'local'; root: string }
    | { kind: 'r2' };

export interface EncoderFingerprintV1 {
    schemaVersion: 1;
    policyId: 'aquila-vn-encoder-v1';
    sharpVersion: string;
    libvipsVersion: string;
    platform: NodeJS.Platform;
    arch: string;
}

export interface PublisherDiagnosticV1 {
    code: string;
    stage: string;
    message: string;
    assetType?: 'background' | 'portrait';
    identity?: string;
    safePath?: string;
    count?: number;
    sampleIdentities?: string[];
    sampleSafePaths?: string[];
    previousPublishedAt?: string;
    localNow?: string;
}

export interface PublisherActionV1 {
    stage: string;
    kind:
        | 'include'
        | 'omit'
        | 'reuse-object'
        | 'create-object'
        | 'reuse-manifest'
        | 'create-manifest'
        | 'write-pointer'
        | 'no-op';
    identity?: string;
    key?: string;
}

export interface PublisherCountsV1 {
    included: number;
    omitted: number;
    objectsCreated: number;
    objectsReused: number;
    manifestsCreated: number;
    manifestsReused: number;
    pointersWritten: number;
}

export interface EncodedVariant {
    format: 'webp' | 'avif';
    bytes: Uint8Array;
    sha256: ObjectContentSha256;
    path: string;
    byteLength: number;
    contentType: 'image/webp' | 'image/avif';
}

export interface EncodedAsset {
    identity: LogicalAssetIdentity;
    sourcePath: string;
    authoringSection?: string;
    planSection?: string;
    variants: EncodedVariant[];
    width: number;
    height: number;
    sourceHasAlpha: boolean;
    outputHasAlpha: boolean;
}

export interface PreparedRelease {
    storyId: string;
    target: PublicationTarget;
    releaseId: `sha256-${string}`;
    releaseContentSha256: ReleaseContentSha256;
    manifest: RuntimeAssetManifestV1;
    manifestSha256: ManifestByteSha256;
    manifestBytes: Uint8Array;
    encodedAssets: EncodedAsset[];
    coverage: StoryAssetCoverageReport;
}

export interface PublisherProgressEvent {
    stage:
        | 'input'
        | 'source'
        | 'encode'
        | 'inspect'
        | 'upload'
        | 'verify'
        | 'activate';
    completed: number;
    total: number;
    message: string;
}
