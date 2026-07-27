import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
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

export type VerifyVisualFixturesOptions = {
    publicRoot?: string;
};

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

async function readJson(path: string): Promise<unknown> {
    return JSON.parse(await readFile(path, 'utf8'));
}

export async function verifyVisualFixtures(
    options: VerifyVisualFixturesOptions = {}
): Promise<void> {
    const publicRoot = options.publicRoot ?? defaultPublicRoot;
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
            await access(
                resolve(
                    repositoryRoot,
                    'packages/assets/media',
                    asset.sourcePath
                )
            );
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

    const pointerPath = resolve(
        publicRoot,
        'vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json'
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
            const object = asset.variants.webp;
            try {
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
            } catch (error) {
                problems.push(`object ${object.path}: ${String(error)}`);
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
