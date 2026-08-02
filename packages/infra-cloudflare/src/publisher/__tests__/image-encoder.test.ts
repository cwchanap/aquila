import { afterEach, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createSourceFixture } from '../test-fixtures';
import { PublisherError } from '../errors';
import { encodeAsset, getEncoderFingerprint } from '../image-encoder';

const createdFixtures: Array<() => Promise<void>> = [];

afterEach(async () => {
    await Promise.all(createdFixtures.splice(0).map(cleanup => cleanup()));
});

describe('encodeAsset', () => {
    it('encodes backgrounds as WebP and AVIF inside the maximum box', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const bytes = await readFile(
            join(fixture.sourceRoot, fixture.backgroundPath)
        );

        const result = await encodeAsset({
            identity: { type: 'background', key: 'chapter_1/bg' },
            sourcePath: fixture.backgroundPath,
            bytes,
        });

        expect(result.variants.map(variant => variant.format)).toEqual([
            'webp',
            'avif',
        ]);
        expect(result.width).toBeLessThanOrEqual(1600);
        expect(result.height).toBeLessThanOrEqual(900);
        expect(result.width).toBe(1599);
        expect(result.height).toBe(900);
        expect(result.variants.map(variant => variant.path)).toEqual(
            result.variants.map(
                variant => `vn/objects/${variant.sha256}.${variant.format}`
            )
        );
    });

    it('encodes portraits as alpha-preserving WebP only', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const bytes = await readFile(
            join(fixture.sourceRoot, fixture.portraitPath)
        );

        const result = await encodeAsset({
            identity: { type: 'portrait', key: 'mio/base' },
            sourcePath: fixture.portraitPath,
            bytes,
        });

        expect(result.variants.map(variant => variant.format)).toEqual([
            'webp',
        ]);
        expect(
            (await sharp(result.variants[0].bytes).metadata()).hasAlpha
        ).toBe(true);
        expect(result.width).toBe(900);
        expect(result.height).toBe(1200);
        expect(result.sourceHasAlpha).toBe(true);
        expect(result.outputHasAlpha).toBe(true);
    });

    it('normalizes EXIF orientation and has deterministic output bytes', async () => {
        const bytes = await sharp({
            create: {
                width: 1200,
                height: 900,
                channels: 3,
                background: { r: 20, g: 40, b: 60 },
            },
        })
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();
        const input = {
            identity: { type: 'background' as const, key: 'chapter_1/rotated' },
            sourcePath: 'example/backgrounds/chapter_1/rotated.jpg',
            bytes,
        };

        const [first, second] = await Promise.all([
            encodeAsset(input),
            encodeAsset(input),
        ]);

        expect(first.width).toBe(675);
        expect(first.height).toBe(900);
        const metadata = await sharp(first.variants[0].bytes).metadata();
        expect(metadata).toMatchObject({ width: 675, height: 900 });
        expect(metadata.orientation).toBeUndefined();
        expect(first.variants.map(variant => variant.bytes)).toEqual(
            second.variants.map(variant => variant.bytes)
        );
    });

    it('reports the pinned encoder toolchain fingerprint', () => {
        expect(getEncoderFingerprint()).toMatchObject({
            schemaVersion: 1,
            policyId: 'aquila-vn-encoder-v1',
            sharpVersion: sharp.versions.sharp,
            libvipsVersion: sharp.versions.vips,
        });
    });

    it('rejects an unsafe source path before encoding', async () => {
        const bytes = await sharp({
            create: {
                width: 1,
                height: 1,
                channels: 3,
                background: 'black',
            },
        })
            .png()
            .toBuffer();

        await expect(
            encodeAsset({
                identity: { type: 'background', key: 'chapter_1/bg' },
                sourcePath: 'https://example.test/private.png',
                bytes,
            })
        ).rejects.toBeInstanceOf(PublisherError);
    });

    it('classifies a Sharp pipeline failure as an encoding error', async () => {
        // Corrupt bytes that sharp cannot decode trigger a libvips failure
        // inside the encoding pipeline. Without sanitization this escapes as
        // a raw error and the CLI classifies it as a storage failure (exit
        // 3); it must surface as a deterministic encoding failure (exit 2).
        const corruptBytes = Buffer.from(
            'not an image, just text bytes that libvips cannot decode'
        );

        const result = encodeAsset({
            identity: { type: 'background', key: 'chapter_1/bg' },
            sourcePath: 'example/backgrounds/chapter_1/bg.png',
            bytes: corruptBytes,
        });

        await expect(result).rejects.toBeInstanceOf(PublisherError);
        await expect(result).rejects.toMatchObject({
            code: 'encoding',
            context: { stage: 'encode' },
        });
    });
});
