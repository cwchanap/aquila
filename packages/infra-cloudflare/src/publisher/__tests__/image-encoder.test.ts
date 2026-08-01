import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { createSourceFixture } from '../test-fixtures';
import { encodeAsset, getEncoderFingerprint } from '../image-encoder';

describe('encodeAsset', () => {
    it('encodes backgrounds as WebP and AVIF inside the maximum box', async () => {
        const fixture = await createSourceFixture();
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
});
