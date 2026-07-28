import type { DialogueEntry } from '@aquila/stories';
import type { AssetResolverSource } from '@aquila/stories/runtime-assets';
import { getBrowserStorage } from '@/lib/reader-mode';
import { DecodedAssetCache } from './decoded-asset-cache';
import { ValidatedReleaseStore } from './validated-release-store';
import { VisualStateController } from './visual-state-controller';
import { WebAssetResolver } from './web-asset-resolver';

export type VisualReaderRuntime = {
    controller: VisualStateController;
    softRevalidate: () => Promise<void>;
    dispose: () => Promise<void>;
};

export function getAssetResolverSource(
    storyId: string,
    origin: string
): AssetResolverSource | null {
    if (storyId !== 'the_seventh_mirror') return null;
    return {
        environment: 'local',
        storyId,
        baseUrl: new URL('/assets/', origin).href,
        target: { kind: 'preview', previewId: 'hpa-228-local' },
    };
}

export function createVisualRuntime(
    storyId: string,
    origin: string,
    getSceneDialogue: (
        storyId: string,
        sceneId: string
    ) => readonly DialogueEntry[] | null
): VisualReaderRuntime | null {
    const source = getAssetResolverSource(storyId, origin);
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
