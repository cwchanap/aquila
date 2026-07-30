import type { DialogueEntry } from '@aquila/stories';
import type { AssetResolverSource } from '@aquila/stories/runtime-assets';
import { getBrowserStorage } from '@/lib/reader-mode';
import {
    readAssetSourceConfigFromEnv,
    resolveAssetSource,
    type AssetSourceConfig,
} from './asset-source-config';
import { DecodedAssetCache } from './decoded-asset-cache';
import { ValidatedReleaseStore } from './validated-release-store';
import { VisualStateController } from './visual-state-controller';
import { WebAssetResolver } from './web-asset-resolver';

export type VisualReaderRuntime = {
    controller: VisualStateController;
    softRevalidate: () => Promise<void>;
    dispose: () => Promise<void>;
};

/**
 * Environment variables change *how* an allowed story resolves, never *which*
 * stories resolve — the allowlist below stays authoritative.
 */
export function getAssetResolverSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AssetResolverSource | null {
    if (storyId !== 'the_seventh_mirror') return null;
    return resolveAssetSource(storyId, origin, config);
}

export function createVisualRuntime(
    storyId: string,
    origin: string,
    getSceneDialogue: (
        storyId: string,
        sceneId: string
    ) => readonly DialogueEntry[] | null,
    config: AssetSourceConfig = readAssetSourceConfigFromEnv(
        import.meta.env as unknown as Record<string, unknown>
    )
): VisualReaderRuntime | null {
    const source = getAssetResolverSource(storyId, origin, config);
    const store = new ValidatedReleaseStore(getBrowserStorage());
    const resolver = source ? new WebAssetResolver(source, { store }) : null;
    const cache = new DecodedAssetCache();
    const controller = new VisualStateController({
        resolver,
        cache,
        getSceneDialogue,
    });
    cache.setBeforeRevoke(objectUrl => controller.detachObjectUrl(objectUrl));
    return {
        controller,
        softRevalidate: () => controller.softRevalidate(),
        dispose: async () => {
            controller.dispose();
            try {
                await cache.clear();
            } finally {
                resolver?.clear();
            }
        },
    };
}
