import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
    parseStoryAssetReleasePlan,
    type AuthoringAssetCatalog,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';

const NO_ARTWORK_REASON = 'No artwork in the source root yet';

/**
 * The release plan a story gets when none is given: every asset the story
 * references is included if its source file exists under the source root and
 * omitted otherwise. Publishing a story means publishing whatever art is
 * ready — there is no per-story plan file to keep in step.
 */
export async function deriveReleasePlan(
    catalog: AuthoringAssetCatalog,
    sourceRoot: string
): Promise<StoryAssetReleasePlanV1> {
    const entries = await Promise.all(
        catalog.assets.map(async asset =>
            (await sourceExists(sourceRoot, asset.sourcePath))
                ? {
                      identity: asset.identity,
                      disposition: 'included' as const,
                      sourcePath: asset.sourcePath,
                  }
                : {
                      identity: asset.identity,
                      disposition: 'omitted' as const,
                      reason: NO_ARTWORK_REASON,
                  }
        )
    );
    if (!entries.some(entry => entry.disposition === 'included')) {
        throw new PublisherError('input', 'Story has no artwork to publish', {
            context: { source: 'asset-source-root', storyId: catalog.storyId },
        });
    }
    return parseStoryAssetReleasePlan({
        schemaVersion: 1,
        storyId: catalog.storyId,
        channel: 'production',
        entries,
    });
}

// Only a genuinely usable file counts as ready art — a missing path, a
// directory, or a dangling symlink means "art not ready". Any other failure
// is left for source resolution, which reports it as a sanitized source error.
async function sourceExists(
    sourceRoot: string,
    sourcePath: string
): Promise<boolean> {
    try {
        const source = await stat(join(sourceRoot, sourcePath));
        return source.isFile();
    } catch (error) {
        return !(
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: unknown }).code === 'ENOENT'
        );
    }
}

export async function loadReleasePlan(
    path: string
): Promise<StoryAssetReleasePlanV1> {
    let text: string;
    try {
        text = await readFile(path, 'utf8');
    } catch (error) {
        throw new PublisherError('input', 'Unable to read release plan', {
            cause: error,
            context: { source: 'release-plan' },
        });
    }
    try {
        return parseStoryAssetReleasePlan(JSON.parse(text));
    } catch (error) {
        throw new PublisherError('input', 'Invalid release plan', {
            cause: error,
            context: { source: 'release-plan' },
        });
    }
}
