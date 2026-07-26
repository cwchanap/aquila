import type { AssetResolverSource } from '@aquila/stories/runtime-assets';

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
