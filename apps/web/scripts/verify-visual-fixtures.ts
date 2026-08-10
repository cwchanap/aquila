import { createHash } from 'node:crypto';
import { access, lstat, readdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import {
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    parseStoryAssetReleasePlan,
    validatePointerManifestPair,
    validateReleaseCoverage,
    validateRuntimeManifestCoverage,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_TARGET = { kind: 'preview', previewId: 'hpa-228-local' } as const;
const webRoot = process.cwd();
const repositoryRoot = resolve(webRoot, '../..');
const defaultPublicRoot = resolve(webRoot, 'public/assets');
const MAX_FIXTURE_FILE_BYTES = 768 * 1024;
type FixtureSourceExpectation = {
    width: number;
    height: number;
    requiresAlpha: boolean;
};

const APPROVED_FIXTURE_SOURCES = new Map<string, FixtureSourceExpectation>([
    [
        'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
        { width: 1672, height: 941, requiresAlpha: false },
    ],
    [
        'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
        { width: 1672, height: 941, requiresAlpha: false },
    ],
    [
        'the_seventh_mirror/characters/asakura_mio/base.png',
        { width: 450, height: 600, requiresAlpha: true },
    ],
    [
        'the_seventh_mirror/characters/asakura_yuma/base.png',
        { width: 450, height: 600, requiresAlpha: true },
    ],
] as const);

export type VerifyVisualFixturesOptions = {
    publicRoot?: string;
    mediaRoot?: string;
};

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8'));
}

async function walkFiles(root: string): Promise<string[]> {
    const rootStats = await lstat(root);
    if (rootStats.isSymbolicLink()) {
        throw new Error(`symbolic link rejected in fixture tree: ${root}`);
    }
    const files: string[] = [];
    async function walk(dir: string): Promise<void> {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const path = resolve(dir, entry.name);
            if (entry.isSymbolicLink()) {
                throw new Error(
                    `symbolic link rejected in fixture tree: ${path}`
                );
            }
            if (entry.isDirectory()) await walk(path);
            else if (entry.isFile()) files.push(path);
        }
    }
    await walk(root);
    return files;
}

export async function verifyVisualFixtures(
    options: VerifyVisualFixturesOptions = {}
): Promise<void> {
    const publicRoot = options.publicRoot ?? defaultPublicRoot;
    const mediaRoot =
        options.mediaRoot ?? resolve(repositoryRoot, 'packages/assets/media');
    const problems: string[] = [];
    const imageAssets = (await readJson(
        resolve(
            repositoryRoot,
            'packages/stories/src/generated/theSeventhMirror/image-assets.json'
        )
    )) as {
        storyId: string;
        backgrounds: { key: string; path: string }[];
        portraits: { key: string; path: string }[];
    };
    const plan = parseStoryAssetReleasePlan(
        await readJson(
            resolve(
                webRoot,
                'src/lib/visual-assets/__fixtures__/release-plans/the-seventh-mirror.preview.v1.json'
            )
        )
    );
    const authoringCatalog = {
        storyId: imageAssets.storyId,
        assets: [
            ...imageAssets.backgrounds.map(entry => ({
                identity: { type: 'background' as const, key: entry.key },
                sourcePath: entry.path,
            })),
            ...imageAssets.portraits.map(entry => ({
                identity: { type: 'portrait' as const, key: entry.key },
                sourcePath: entry.path,
            })),
        ],
    };
    const availableSourcePaths = new Set<string>();
    for (const asset of authoringCatalog.assets) {
        try {
            await access(resolve(mediaRoot, asset.sourcePath));
            availableSourcePaths.add(asset.sourcePath);
        } catch {
            // Coverage validation reports an included plan entry whose source is absent.
        }
    }

    try {
        validateReleaseCoverage(authoringCatalog, plan, availableSourcePaths);
    } catch (error) {
        problems.push(`release coverage: ${String(error)}`);
    }

    const sourceFiles = await walkFiles(resolve(mediaRoot, STORY_ID));
    const presentSources = new Set<string>();
    for (const path of sourceFiles) {
        const rel = relative(mediaRoot, path).split('\\').join('/');
        presentSources.add(rel);
        const expected = APPROVED_FIXTURE_SOURCES.get(rel);
        if (!expected) {
            problems.push(`unexpected Seventh Mirror fixture source: ${rel}`);
            continue;
        }
        const bytes = (await stat(path)).size;
        if (bytes > MAX_FIXTURE_FILE_BYTES) {
            problems.push(
                `fixture source exceeds ${MAX_FIXTURE_FILE_BYTES} bytes: ${rel}`
            );
        }
        try {
            const metadata = await sharp(path).metadata();
            const metadataMatches =
                metadata.format === 'png' &&
                metadata.width === expected.width &&
                metadata.height === expected.height &&
                (!expected.requiresAlpha || metadata.hasAlpha === true);
            if (!metadataMatches) {
                const description = expected.requiresAlpha
                    ? `portrait source must be a ${expected.width} x ${expected.height} PNG with alpha`
                    : `background source must be a ${expected.width} x ${expected.height} PNG`;
                problems.push(`${description}: ${rel}`);
            }
        } catch (error) {
            problems.push(`source metadata ${rel}: ${String(error)}`);
        }
    }
    for (const approved of APPROVED_FIXTURE_SOURCES.keys()) {
        if (!presentSources.has(approved)) {
            problems.push(`approved fixture source missing: ${approved}`);
        }
    }

    const pointerPath = resolve(
        publicRoot,
        getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)
    );
    let pointer: ReturnType<typeof parseActiveReleasePointer> | undefined;
    let manifest: ReturnType<typeof parseRuntimeAssetManifest> | undefined;
    let manifestText: string | undefined;
    try {
        pointer = parseActiveReleasePointer(
            await readJson(pointerPath),
            PREVIEW_TARGET,
            STORY_ID
        );
        manifestText = await readFile(
            resolve(publicRoot, pointer.manifestPath),
            'utf8'
        );
        manifest = parseRuntimeAssetManifest(JSON.parse(manifestText));
    } catch (error) {
        problems.push(`release documents: ${String(error)}`);
    }

    if (pointer && manifest && manifestText !== undefined) {
        const manifestSha256 = assertSha256<'manifest-bytes'>(
            createHash('sha256').update(manifestText, 'utf8').digest('hex')
        );
        const releaseContentSha256 = assertSha256<'release-content'>(
            createHash('sha256')
                .update(canonicalReleaseContent(manifest), 'utf8')
                .digest('hex')
        );
        try {
            validatePointerManifestPair(pointer, manifest, manifestSha256);
        } catch (error) {
            problems.push(`pointer/manifest integrity: ${String(error)}`);
        }
        try {
            assertReleaseIdMatchesContentSha256(manifest, releaseContentSha256);
        } catch (error) {
            problems.push(`release content integrity: ${String(error)}`);
        }
        try {
            validateRuntimeManifestCoverage(manifest, plan);
        } catch (error) {
            problems.push(`runtime coverage: ${String(error)}`);
        }

        for (const asset of manifest.assets) {
            const assetId = `${asset.identity.type}/${asset.identity.key}`;
            try {
                const object = asset.variants.webp;
                if (!object) {
                    problems.push(`object missing webp variant: ${assetId}`);
                    continue;
                }
                const bytes = await readFile(resolve(publicRoot, object.path));
                if (sha256(bytes) !== object.sha256) {
                    problems.push(`object SHA-256 mismatch: ${object.path}`);
                }
                if (bytes.byteLength !== object.byteLength) {
                    problems.push(
                        `object byte length mismatch: ${object.path}`
                    );
                }
                const metadata = await sharp(bytes).metadata();
                if (
                    metadata.width !== asset.width ||
                    metadata.height !== asset.height
                ) {
                    problems.push(`object dimensions mismatch: ${object.path}`);
                }
                if (
                    asset.identity.type === 'portrait' &&
                    metadata.hasAlpha !== true
                ) {
                    problems.push(
                        `portrait object does not preserve alpha: ${object.path}`
                    );
                }
            } catch (error) {
                problems.push(`object ${assetId}: ${String(error)}`);
            }
        }

        const storyRoot = resolve(
            publicRoot,
            'vn/previews/hpa-228-local/stories/the_seventh_mirror'
        );
        const allowedStoryFiles = new Set([
            resolve(
                publicRoot,
                getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)
            ),
            resolve(publicRoot, pointer.manifestPath),
        ]);
        for (const path of await walkFiles(storyRoot)) {
            if (!allowedStoryFiles.has(path)) {
                problems.push(
                    `stale Seventh Mirror fixture release document: ${relative(publicRoot, path)}`
                );
            }
        }
    }

    if (problems.length > 0) {
        throw new Error(
            `Visual fixture verification failed:\n${problems.join('\n')}`
        );
    }
}

if (import.meta.main) {
    await verifyVisualFixtures();
}
