import type { DialogueEntry } from '@aquila/stories';
import { PRODUCTION_VISUAL_STORY_IDS } from '@aquila/stories/async';
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

export const REMOTE_ASSET_STORY_ID = 'the_seventh_mirror';

/**
 * Environment variables change *how* an allowed story resolves, never *which*
 * stories resolve — the allowlist below stays authoritative.
 */
export function getAssetResolverSource(
    storyId: string,
    origin: string,
    config: AssetSourceConfig
): AssetResolverSource | null {
    // Short-story releases are published once to the production R2 namespace
    // and read from it in every environment, previews included. Without a
    // configured asset host there is nothing to read, so they run text-only.
    if ((PRODUCTION_VISUAL_STORY_IDS as readonly string[]).includes(storyId)) {
        if (!config.baseUrl) return null;
        return resolveAssetSource(storyId, origin, {
            baseUrl: config.baseUrl,
            environment: 'production',
        });
    }
    if (storyId !== REMOTE_ASSET_STORY_ID) return null;
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
    let source: AssetResolverSource | null = null;
    try {
        source = getAssetResolverSource(storyId, origin, config);
        if (source) {
            // Bundled (`local`) releases ship inside this deployment — the
            // bundled pointer is authoritative, and stored releases only
            // exist for remote environments. A storage-less store keeps the
            // resolver's localStorage record list for remote sources alone,
            // so the bundled stories can't evict each other's (or remote)
            // records and never validate against another deployment's tree.
            const store = new ValidatedReleaseStore(
                source.environment === 'local' ? null : getBrowserStorage()
            );
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
        source,
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
