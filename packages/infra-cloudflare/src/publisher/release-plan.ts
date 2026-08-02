import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
    isStoryId,
    parseStoryAssetReleasePlan,
    type PublicationTarget,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';

export interface ResolveReleasePlanOptions {
    repositoryRoot: string;
    storyId: string;
    target: PublicationTarget;
    explicitPath?: string;
}

export async function resolveReleasePlanPath(
    options: ResolveReleasePlanOptions
): Promise<string> {
    if (options.explicitPath !== undefined) return options.explicitPath;
    if (!isStoryId(options.storyId)) {
        throw new PublisherError('input', 'Release-plan story id is unsafe', {
            context: { input: 'storyId' },
        });
    }

    const plansRoot = join(
        options.repositoryRoot,
        'packages/stories/release-plans'
    );
    if (options.target.kind === 'preview') {
        const previewPath = join(plansRoot, `${options.storyId}.preview.json`);
        try {
            // lstat (not access) so a dangling symlink is NOT treated as
            // absent. access() follows symlinks, so a broken preview
            // companion would return ENOENT and silently fall back to the
            // production plan, publishing under a different classification
            // than the operator intended. lstat succeeds for any directory
            // entry (including a dangling symlink); loadReleasePlan() then
            // reports the unreadable target.
            await lstat(previewPath);
            return previewPath;
        } catch (error) {
            // Only a genuinely absent preview companion (ENOENT from lstat)
            // is optional. Other filesystem errors (EACCES, EIO, ...) must
            // surface as a sanitized input error; silently falling back to
            // the production plan would publish under a different
            // classification than the operator intended.
            const code =
                typeof error === 'object' && error !== null && 'code' in error
                    ? (error as { code?: unknown }).code
                    : undefined;
            if (code !== 'ENOENT') {
                throw new PublisherError(
                    'input',
                    'Unable to verify preview release plan',
                    { cause: error, context: { source: 'release-plan' } }
                );
            }
        }
    }
    return join(plansRoot, `${options.storyId}.json`);
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
