import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

export async function createSourceFixture(): Promise<{
    root: string;
    sourceRoot: string;
    backgroundPath: string;
    portraitPath: string;
}> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-publisher-'));
    const sourceRoot = join(root, 'media');
    const backgroundPath = 'example/backgrounds/chapter_1/bg.png';
    const portraitPath = 'example/characters/mio/base.png';

    for (const relative of [backgroundPath, portraitPath]) {
        await mkdir(dirname(join(sourceRoot, relative)), { recursive: true });
    }

    await sharp({
        create: {
            width: 1672,
            height: 941,
            channels: 3,
            background: { r: 30, g: 50, b: 70 },
        },
    })
        .png()
        .toFile(join(sourceRoot, backgroundPath));

    await sharp({
        create: {
            width: 1086,
            height: 1448,
            channels: 4,
            background: { r: 120, g: 40, b: 70, alpha: 0.5 },
        },
    })
        .png()
        .toFile(join(sourceRoot, portraitPath));

    return { root, sourceRoot, backgroundPath, portraitPath };
}
