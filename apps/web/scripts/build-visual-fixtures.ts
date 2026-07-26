import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
    assertSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    releaseIdFromContentSha256,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_TARGET = { kind: 'preview', previewId: 'hpa-228-local' } as const;
const PUBLISHED_AT = '2026-07-26T00:00:00.000Z';
const FIXTURES = [
    {
        type: 'background',
        key: 'chapter_1/ch1_act2_s0',
        sourcePath: 'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
        resize: { width: 960, height: 540, fit: 'inside' as const },
    },
    {
        type: 'background',
        key: 'chapter_1/ch1_act2_s1',
        sourcePath: 'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s1.png',
        resize: { width: 960, height: 540, fit: 'inside' as const },
    },
    {
        type: 'portrait',
        key: 'asakura_mio/base',
        sourcePath: 'the_seventh_mirror/characters/asakura_mio/base.png',
        resize: { width: 450, height: 600, fit: 'inside' as const },
    },
    {
        type: 'portrait',
        key: 'asakura_yuma/base',
        sourcePath: 'the_seventh_mirror/characters/asakura_yuma/base.png',
        resize: { width: 450, height: 600, fit: 'inside' as const },
    },
] as const;

const webRoot = process.cwd();
const repositoryRoot = resolve(webRoot, '../..');
const publicRoot = resolve(webRoot, 'public/assets');

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

async function writeFixture(path: string, contents: Uint8Array | string) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
}

export async function buildVisualFixtures(): Promise<void> {
    const assets: RuntimeAssetManifestV1['assets'] = [];

    for (const fixture of FIXTURES) {
        const source = resolve(
            repositoryRoot,
            'packages/assets/media',
            fixture.sourcePath
        );
        const bytes = await sharp(source)
            .resize({ ...fixture.resize, withoutEnlargement: true })
            .webp({ quality: 82, effort: 6, smartSubsample: true })
            .toBuffer();
        const objectSha256 = assertSha256<'object-content'>(sha256(bytes));
        const metadata = await sharp(bytes).metadata();
        if (!metadata.width || !metadata.height) {
            throw new Error(
                `Unable to read dimensions for ${fixture.sourcePath}`
            );
        }

        const objectPath = getObjectPath(objectSha256, 'webp');
        await writeFixture(resolve(publicRoot, objectPath), bytes);
        assets.push({
            identity: { type: fixture.type, key: fixture.key },
            variants: {
                webp: {
                    format: 'webp',
                    path: objectPath,
                    sha256: objectSha256,
                    byteLength: bytes.byteLength,
                },
            },
            width: metadata.width,
            height: metadata.height,
            section: 'chapter_1',
        });
    }

    const draftManifest: RuntimeAssetManifestV1 = {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets,
    };
    const releaseId = releaseIdFromContentSha256(
        assertSha256<'release-content'>(
            sha256(canonicalReleaseContent(draftManifest))
        )
    );
    const manifest: RuntimeAssetManifestV1 = { ...draftManifest, releaseId };
    const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
    const manifestSha256 = assertSha256<'manifest-bytes'>(sha256(manifestText));
    const manifestPath = getReleaseManifestPath(
        STORY_ID,
        releaseId,
        PREVIEW_TARGET
    );

    await writeFixture(resolve(publicRoot, manifestPath), manifestText);
    await writeFixture(
        resolve(publicRoot, getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)),
        `${JSON.stringify(
            {
                schemaVersion: 1,
                storyId: STORY_ID,
                releaseId,
                manifestPath,
                manifestSha256,
                publishedAt: PUBLISHED_AT,
            },
            null,
            2
        )}\n`
    );
    await mkdir(resolve(webRoot, 'src/lib/visual-assets'), { recursive: true });
    await sharp({
        create: {
            width: 1,
            height: 1,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .avif({ quality: 1, effort: 0 })
        .toFile(resolve(webRoot, 'src/lib/visual-assets/avif-probe.avif'));
}

if (import.meta.main) {
    await buildVisualFixtures();
}
