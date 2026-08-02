import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

export const GATE_FIXTURES = [
    {
        relativePath: 'source-b/gate/background.png',
        width: 1672,
        height: 941,
        channels: 3,
        background: { r: 12, g: 140, b: 210 },
        expectedPixel: [12, 140, 210],
    },
    {
        relativePath: 'source-c/gate/background.png',
        width: 1672,
        height: 941,
        channels: 3,
        background: { r: 188, g: 74, b: 42 },
        expectedPixel: [188, 74, 42],
    },
    {
        relativePath: 'source-c/gate/portrait.png',
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 64, g: 198, b: 104, alpha: 0.5 },
        expectedPixel: [64, 198, 104, 128],
    },
] as const;

if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    const outputRoot = process.argv[2];

    if (!outputRoot) {
        throw new Error('R2 gate fixture output root is required');
    }

    for (const fixture of GATE_FIXTURES) {
        await mkdir(join(outputRoot, dirname(fixture.relativePath)), {
            recursive: true,
        });
        await sharp({
            create: {
                width: fixture.width,
                height: fixture.height,
                channels: fixture.channels,
                background: fixture.background,
            },
        })
            .png()
            .toFile(join(outputRoot, fixture.relativePath));
    }
}
