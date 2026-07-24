import type { AssetResolverError } from './errors';
import type {
    ActiveReleasePointerV1,
    LogicalAssetIdentity,
    PublicationTarget,
    RuntimeAssetEntryV1,
    RuntimeAssetManifestV1,
} from './schemas';

type AssetResolverSourceBase = {
    storyId: string;
    baseUrl: string;
};

export type AssetResolverSource =
    | (AssetResolverSourceBase & {
          environment: 'local';
          target: PublicationTarget;
      })
    | (AssetResolverSourceBase & {
          environment: 'preview';
          target: Extract<PublicationTarget, { kind: 'preview' }>;
      })
    | (AssetResolverSourceBase & {
          environment: 'production';
          target: Extract<PublicationTarget, { kind: 'production' }>;
      });

export type ValidatedAssetRelease = {
    pointer: ActiveReleasePointerV1;
    manifest: RuntimeAssetManifestV1;
    validatedAt: string;
    source: 'network' | 'last-validated-release';
};

export type ResolvedAsset = {
    status: 'resolved';
    asset: RuntimeAssetEntryV1;
    webpUrl: URL;
    avifUrl?: URL;
    placeholderUrl?: URL;
};

export type AssetFallbackReason =
    | 'not-found'
    | 'release-unavailable'
    | 'invalid-release'
    | 'integrity-failure';

export type AssetFallback = {
    status: 'fallback';
    identity: LogicalAssetIdentity;
    reason: AssetFallbackReason;
    error?: AssetResolverError;
};

export type AssetResolutionResult = ResolvedAsset | AssetFallback;

export type PrefetchNextEdgeRequest = {
    fromSceneId: string;
    toSceneId: string;
    /** All assets on the single immediately reachable edge. */
    assets: readonly LogicalAssetIdentity[];
    signal?: AbortSignal;
};

export type PrefetchNextEdgeResult = {
    requested: number;
    cached: number;
    failed: readonly AssetFallback[];
};

/**
 * HPA-227 defines this boundary; HPA-228 implements its fetch/decode/cache
 * behavior for the web reader.
 */
export interface AssetResolver {
    readonly source: AssetResolverSource;
    loadActiveRelease(options?: {
        signal?: AbortSignal;
    }): Promise<ValidatedAssetRelease>;
    resolve(identity: LogicalAssetIdentity): AssetResolutionResult;
    prefetchNextEdge(
        request: PrefetchNextEdgeRequest
    ): Promise<PrefetchNextEdgeResult>;
    clear(): void;
}
