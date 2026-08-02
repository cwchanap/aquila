import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const outputRoot = process.argv[2];

if (!outputRoot) {
    throw new Error('R2 gate fixture output root is required');
}

await mkdir(join(outputRoot, 'source-b/gate'), { recursive: true });
await mkdir(join(outputRoot, 'source-c/gate'), { recursive: true });

await sharp({
    create: {
        width: 1672,
        height: 941,
        channels: 3,
        background: { r: 12, g: 140, b: 210 },
    },
})
    .png()
    .toFile(join(outputRoot, 'source-b/gate/background.png'));

await sharp({
    create: {
        width: 1672,
        height: 941,
        channels: 3,
        background: { r: 188, g: 74, b: 42 },
    },
})
    .png()
    .toFile(join(outputRoot, 'source-c/gate/background.png'));

await sharp({
    create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 64, g: 198, b: 104, alpha: 0.5 },
    },
})
    .png()
    .toFile(join(outputRoot, 'source-c/gate/portrait.png'));
