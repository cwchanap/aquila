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
    // Static `import.meta.env.PUBLIC_X` member expressions are the only form
    // Vite/Astro guarantee to inline into the client bundle. Passing
    // `import.meta.env` as a bare object and indexing it with a computed key
    // fails silently in the worst possible direction: the config comes back
    // empty, resolution takes the "nothing configured" branch, and production
    // quietly serves local fixture paths.
    config: AssetSourceConfig = readAssetSourceConfigFromEnv({
        PUBLIC_ASSET_BASE_URL: import.meta.env.PUBLIC_ASSET_BASE_URL,
        PUBLIC_ASSET_ENVIRONMENT: import.meta.env.PUBLIC_ASSET_ENVIRONMENT,
        PUBLIC_ASSET_PREVIEW_ID: import.meta.env.PUBLIC_ASSET_PREVIEW_ID,
    })
): VisualReaderRuntime | null {
    // A misconfigured environment must degrade to no-visuals, not take the
    // reader down: the caller is an unguarded Svelte `$effect`, so a throw
    // here escapes into render. `resolveAssetSource` and the WebAssetResolver
    // constructor both reject bad config loudly, which is correct — this is
    // the boundary that turns that into a resolver-less runtime instead.
    let resolver: WebAssetResolver | null = null;
    try {
        const source = getAssetResolverSource(storyId, origin, config);
        if (source) {
            const store = new ValidatedReleaseStore(getBrowserStorage());
            resolver = new WebAssetResolver(source, { store });
        }
    } catch (error) {
        console.error(
            'Visual assets disabled — invalid asset source configuration:',
            error
        );
    }
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
