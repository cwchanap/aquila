import { readdir, readFile } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import {
    isSafeLogicalKey,
    qualifyAssetIdentity,
    type AuthoringAssetCatalog,
} from '@aquila/stories/runtime-assets';
import { z } from 'zod';
import { PublisherError } from './errors';

const GeneratedAssetEntrySchema = z.object({
    key: z.string(),
    path: z.string(),
    section: z.string().optional(),
});

// Generated manifests include authoring-only fields such as prompts. Parsing a
// narrow schema here strips them before anything reaches publisher diagnostics.
const GeneratedImageAssetsSchema = z.object({
    storyId: z.string(),
    backgrounds: z.array(GeneratedAssetEntrySchema),
    portraits: z.array(GeneratedAssetEntrySchema),
});

export function reduceAuthoringManifest(input: unknown): AuthoringAssetCatalog {
    const parsed = GeneratedImageAssetsSchema.safeParse(input);
    if (!parsed.success) {
        throw new PublisherError(
            'input',
            'Invalid generated image-assets manifest',
            {
                cause: parsed.error,
            }
        );
    }

    const seen = new Set<string>();
    const assets: AuthoringAssetCatalog['assets'][number][] = [];
    for (const [type, entries] of [
        ['background', parsed.data.backgrounds],
        ['portrait', parsed.data.portraits],
    ] as const) {
        for (const raw of entries) {
            const normalizedKey = raw.key.normalize('NFC');
            if (!isSafeLogicalKey(normalizedKey)) {
                throw new PublisherError(
                    'input',
                    'Generated logical key is unsafe',
                    {
                        context: { type, key: normalizedKey },
                    }
                );
            }
            const identity = { type, key: normalizedKey };
            const qualified = qualifyAssetIdentity(identity);
            if (seen.has(qualified)) {
                throw new PublisherError(
                    'input',
                    'Duplicate generated identity after NFC normalization',
                    { context: { identity: qualified } }
                );
            }
            seen.add(qualified);
            assets.push({
                identity,
                sourcePath: raw.path,
                ...(raw.section === undefined ? {} : { section: raw.section }),
            });
        }
    }

    return { storyId: parsed.data.storyId, assets };
}

export async function discoverAuthoringCatalog(
    repositoryRoot: string,
    storyId: string
): Promise<AuthoringAssetCatalog> {
    const generatedRoot = join(
        repositoryRoot,
        'packages/stories/src/generated'
    );
    let directories: Dirent<string>[];
    try {
        directories = await readdir(generatedRoot, { withFileTypes: true });
    } catch (error) {
        throw new PublisherError(
            'input',
            'Unable to read generated image manifests',
            {
                cause: error,
                context: { storyId },
            }
        );
    }

    const candidates = directories
        .filter(entry => entry.isDirectory())
        .map(entry => join(generatedRoot, entry.name, 'image-assets.json'));
    const catalogs = await Promise.all(
        candidates.map(async path => {
            let text: string;
            try {
                text = await readFile(path, 'utf8');
            } catch (error) {
                if (
                    error instanceof Error &&
                    'code' in error &&
                    error.code === 'ENOENT'
                ) {
                    return null;
                }
                throw new PublisherError(
                    'input',
                    'Unable to read generated image manifest',
                    {
                        cause: error,
                        context: { path },
                    }
                );
            }
            try {
                return reduceAuthoringManifest(JSON.parse(text));
            } catch (error) {
                if (error instanceof PublisherError) throw error;
                throw new PublisherError(
                    'input',
                    'Invalid generated image manifest',
                    {
                        cause: error,
                        context: { path },
                    }
                );
            }
        })
    );
    const matches = catalogs.filter(
        (catalog): catalog is AuthoringAssetCatalog =>
            catalog !== null && catalog.storyId === storyId
    );
    if (matches.length !== 1) {
        throw new PublisherError(
            'input',
            `Expected exactly one generated image manifest for story ${storyId}`,
            { context: { storyId, matches: matches.length } }
        );
    }
    return matches[0];
}
