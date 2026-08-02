import { access, readFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import {
    isAbsolute,
    join,
    relative as pathRelative,
    resolve,
    sep,
} from 'node:path';
import {
    isSafeRelativePath,
    type AuthoringAssetReference,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';
import { PublisherError } from './errors';

export interface ResolveSourceRootOptions {
    repositoryRoot: string;
    explicitPath?: string;
    environment: Readonly<Record<string, string | undefined>>;
}

export interface ResolveIncludedSourcesOptions {
    sourceRoot: string;
    includedEntries: readonly AuthoringAssetReference[];
}

export interface ResolvedSourceMetadata {
    format: 'png' | 'jpeg' | 'webp';
    width: number;
    height: number;
    hasAlpha: boolean;
}

export interface ResolvedSource {
    identity: AuthoringAssetReference['identity'];
    sourcePath: string;
    section?: string;
    bytes: Uint8Array;
    metadata: ResolvedSourceMetadata;
}

export interface ResolvedSourceSet {
    sources: readonly ResolvedSource[];
    availableSourcePaths: ReadonlySet<string>;
}

export async function resolveSourceRoot(
    options: ResolveSourceRootOptions
): Promise<string> {
    const selected =
        options.explicitPath ??
        options.environment.AQUILA_ASSET_SOURCE_ROOT ??
        join(options.repositoryRoot, 'packages/assets/media');
    try {
        return await realpath(selected);
    } catch {
        throw new PublisherError('source', 'Unable to resolve source root', {
            context: { source: 'asset-source-root' },
        });
    }
}

function safeSourceContext(
    sourcePath: string
): Readonly<Record<string, string>> {
    return isSafeRelativePath(sourcePath)
        ? { sourcePath }
        : { input: 'sourcePath' };
}

function sourceError(message: string, sourcePath: string): PublisherError {
    return new PublisherError('source', message, {
        context: safeSourceContext(sourcePath),
    });
}

function isInsideSourceRoot(root: string, candidate: string): boolean {
    const relative = pathRelative(root, candidate);
    return (
        relative === '' ||
        (!isAbsolute(relative) &&
            !relative.startsWith(`..${sep}`) &&
            relative !== '..')
    );
}

async function resolveIncludedSource(
    root: string,
    entry: AuthoringAssetReference
): Promise<ResolvedSource> {
    if (!isSafeRelativePath(entry.sourcePath)) {
        throw sourceError('Source path is unsafe', entry.sourcePath);
    }

    let finalPath: string;
    try {
        finalPath = await realpath(resolve(root, entry.sourcePath));
    } catch {
        throw sourceError(
            'Unable to resolve included source file',
            entry.sourcePath
        );
    }
    if (!isInsideSourceRoot(root, finalPath)) {
        throw sourceError(
            'Source resolves outside source root',
            entry.sourcePath
        );
    }

    try {
        const file = await stat(finalPath);
        if (!file.isFile()) {
            throw sourceError(
                'Included source must be a regular file',
                entry.sourcePath
            );
        }
        await access(finalPath, constants.R_OK);
    } catch (error) {
        if (error instanceof PublisherError) throw error;
        throw sourceError(
            'Included source must be a readable regular file',
            entry.sourcePath
        );
    }

    let bytes: Uint8Array;
    let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
    try {
        bytes = await readFile(finalPath);
        metadata = await sharp(bytes, { animated: true }).metadata();
    } catch {
        throw sourceError(
            'Unable to inspect included source image',
            entry.sourcePath
        );
    }
    if (
        (metadata.format !== 'png' &&
            metadata.format !== 'jpeg' &&
            metadata.format !== 'webp') ||
        (metadata.pages ?? 1) !== 1 ||
        metadata.width === undefined ||
        metadata.height === undefined
    ) {
        throw sourceError(
            'Included source must be a single-frame PNG, JPEG, or WebP image',
            entry.sourcePath
        );
    }

    return {
        identity: entry.identity,
        sourcePath: entry.sourcePath,
        ...(entry.section === undefined ? {} : { section: entry.section }),
        bytes,
        metadata: {
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            hasAlpha: metadata.hasAlpha ?? false,
        },
    };
}

const SOURCE_READ_CONCURRENCY = 4;

async function resolveIncludedSourcesBounded(
    root: string,
    entries: readonly AuthoringAssetReference[]
): Promise<ResolvedSource[]> {
    const results = new Array<ResolvedSource>(entries.length);
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(SOURCE_READ_CONCURRENCY, entries.length) },
        async () => {
            while (nextIndex < entries.length) {
                const index = nextIndex;
                nextIndex += 1;
                results[index] = await resolveIncludedSource(
                    root,
                    entries[index]
                );
            }
        }
    );
    await Promise.all(workers);
    return results;
}

export async function resolveIncludedSources(
    options: ResolveIncludedSourcesOptions
): Promise<ResolvedSourceSet> {
    let root: string;
    try {
        root = await realpath(options.sourceRoot);
    } catch {
        throw new PublisherError('source', 'Unable to resolve source root', {
            context: { source: 'asset-source-root' },
        });
    }
    const sources = await resolveIncludedSourcesBounded(
        root,
        options.includedEntries
    );
    return {
        sources,
        availableSourcePaths: new Set(sources.map(source => source.sourcePath)),
    };
}
