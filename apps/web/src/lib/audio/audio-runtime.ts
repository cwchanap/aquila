import {
    AssetResolverError,
    canonicalAudioReleaseContent,
    getAudioCurrentPointerPath,
    parseAudioActiveReleasePointer,
    parseRuntimeAudioManifest,
    resolveAssetUrl,
    type AudioAssetType,
    type RuntimeAudioAssetV1,
    type RuntimeAudioManifestV1,
} from '@aquila/stories/runtime-assets';
import { logger } from '@/lib/logger';
import { resolveLocalBgmUrl } from './bgm-catalog';
import { resolveLocalSfxUrl } from './sfx-catalog';
import {
    readAssetSourceConfigFromEnv,
    resolveAssetSource,
    type AssetSourceConfig,
} from '../visual-assets/asset-source-config';
import { REMOTE_ASSET_STORY_ID } from '../visual-assets/source-factory';
import type { RuntimeReleaseIdentity } from '../visual-assets/types';
import {
    loadValidatedRelease,
    type LoadedRuntimeRelease,
    type RuntimeReleaseCodecs,
} from '../runtime-assets/release-loader';

const AUDIO_RELEASE_CODECS = {
    getCurrentPointerPath: getAudioCurrentPointerPath,
    parsePointer: parseAudioActiveReleasePointer,
    parseManifest: parseRuntimeAudioManifest,
    canonicalReleaseContent: canonicalAudioReleaseContent,
} satisfies RuntimeReleaseCodecs<RuntimeAudioManifestV1>;

export type AudioCueResolution =
    | {
          status: 'resolved';
          url: string;
          asset: RuntimeAudioAssetV1 | null;
      }
    | {
          status: 'unavailable';
          reason:
              | 'release-not-loaded'
              | 'cue-not-in-release'
              | 'local-cue-missing';
      };

export interface AudioReaderRuntime {
    loadActiveRelease(): Promise<RuntimeReleaseIdentity | null>;
    softRevalidate(): Promise<RuntimeReleaseIdentity | null>;
    resolve(type: AudioAssetType, key: string): AudioCueResolution;
    dispose(): void;
}

export type AudioReaderRuntimeOptions = {
    fetchImpl?: typeof fetch;
};

type AudioSource = ReturnType<typeof resolveAssetSource>;

function qualifiedAudioIdentity(type: AudioAssetType, key: string): string {
    return `${type}:${key}`;
}

function localAudioUrl(type: AudioAssetType, key: string): string | undefined {
    if (type === 'sfx') return resolveLocalSfxUrl(key);
    if (type === 'bgm') return resolveLocalBgmUrl(key);
    return undefined;
}

class SessionAudioRuntime implements AudioReaderRuntime {
    private readonly source: AudioSource;
    private readonly fetchImpl: typeof fetch;
    private readonly assets = new Map<string, RuntimeAudioAssetV1>();
    private acceptedRelease: LoadedRuntimeRelease<RuntimeAudioManifestV1> | null =
        null;
    private newestPublishedAt = Number.NEGATIVE_INFINITY;
    private generation = 0;
    private inFlightController: AbortController | null = null;
    private disposed = false;

    constructor(source: AudioSource, options: AudioReaderRuntimeOptions) {
        this.source = source;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    }

    async loadActiveRelease(): Promise<RuntimeReleaseIdentity | null> {
        return this.loadRemoteRelease();
    }

    async softRevalidate(): Promise<RuntimeReleaseIdentity | null> {
        return this.loadRemoteRelease();
    }

    resolve(type: AudioAssetType, key: string): AudioCueResolution {
        if (this.source.environment === 'local') {
            const url = localAudioUrl(type, key);
            return url === undefined
                ? { status: 'unavailable', reason: 'local-cue-missing' }
                : { status: 'resolved', url, asset: null };
        }

        if (this.acceptedRelease === null) {
            return {
                status: 'unavailable',
                reason: 'release-not-loaded',
            };
        }
        const asset = this.assets.get(qualifiedAudioIdentity(type, key));
        if (asset === undefined) {
            return {
                status: 'unavailable',
                reason: 'cue-not-in-release',
            };
        }
        try {
            return {
                status: 'resolved',
                url: resolveAssetUrl(this.source.baseUrl, asset.path).href,
                asset,
            };
        } catch {
            return {
                status: 'unavailable',
                reason: 'cue-not-in-release',
            };
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.inFlightController?.abort();
        this.inFlightController = null;
        this.acceptedRelease = null;
        this.newestPublishedAt = Number.NEGATIVE_INFINITY;
        this.assets.clear();
    }

    private async loadRemoteRelease(): Promise<RuntimeReleaseIdentity | null> {
        if (this.disposed || this.source.environment === 'local') {
            return this.identity();
        }

        this.inFlightController?.abort();
        const controller = new AbortController();
        const generation = ++this.generation;
        this.inFlightController = controller;
        try {
            const loaded = await loadValidatedRelease({
                fetchImpl: this.fetchImpl,
                source: this.source,
                codecs: AUDIO_RELEASE_CODECS,
                signal: controller.signal,
                assertPointerAcceptable: pointer =>
                    this.assertNotOlder(pointer),
            });
            if (!this.isCurrent(generation, controller.signal)) {
                return this.identity();
            }
            this.assertNotOlder(loaded.pointer);
            this.accept(loaded);
            return this.identity();
        } catch {
            return this.identity();
        } finally {
            if (this.inFlightController === controller) {
                this.inFlightController = null;
            }
        }
    }

    private isCurrent(generation: number, signal: AbortSignal): boolean {
        return (
            !this.disposed && generation === this.generation && !signal.aborted
        );
    }

    private assertNotOlder(pointer: { publishedAt: string }): void {
        if (Date.parse(pointer.publishedAt) < this.newestPublishedAt) {
            throw new AssetResolverError(
                'stale-pointer',
                'Active-release pointer is older than the accepted release'
            );
        }
    }

    private accept(loaded: LoadedRuntimeRelease<RuntimeAudioManifestV1>): void {
        this.acceptedRelease = loaded;
        this.newestPublishedAt = Math.max(
            this.newestPublishedAt,
            Date.parse(loaded.pointer.publishedAt)
        );
        this.assets.clear();
        for (const asset of loaded.manifest.assets) {
            this.assets.set(
                qualifiedAudioIdentity(asset.identity.type, asset.identity.key),
                asset
            );
        }
    }

    private identity(): RuntimeReleaseIdentity | null {
        const accepted = this.acceptedRelease;
        if (accepted === null) return null;
        return {
            assetEnvironment: this.source.environment,
            previewId:
                this.source.target.kind === 'preview'
                    ? this.source.target.previewId
                    : null,
            releaseId: accepted.pointer.releaseId,
            manifestSha256: accepted.manifestSha256,
        };
    }
}

function runtimeSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AudioSource | null {
    try {
        const source = resolveAssetSource(storyId, origin, config);
        if (
            source.environment !== 'local' &&
            storyId !== REMOTE_ASSET_STORY_ID
        ) {
            return null;
        }
        return source;
    } catch (error) {
        logger.warn('Visual-novel audio unavailable', {
            storyId,
            reason: 'runtime-unavailable',
            error,
        });
        return null;
    }
}

export function createAudioRuntime(
    storyId: string,
    origin: string,
    config: AssetSourceConfig = readAssetSourceConfigFromEnv({
        PUBLIC_ASSET_BASE_URL: import.meta.env.PUBLIC_ASSET_BASE_URL,
        PUBLIC_ASSET_ENVIRONMENT: import.meta.env.PUBLIC_ASSET_ENVIRONMENT,
        PUBLIC_ASSET_PREVIEW_ID: import.meta.env.PUBLIC_ASSET_PREVIEW_ID,
    }),
    options: AudioReaderRuntimeOptions = {}
): AudioReaderRuntime | null {
    const source = runtimeSource(storyId, origin, config);
    if (source === null) return null;
    return new SessionAudioRuntime(source, options);
}
