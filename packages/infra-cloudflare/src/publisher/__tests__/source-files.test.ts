import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createSourceFixture } from '../test-fixtures';
import { PublisherError } from '../errors';
import { evaluateSourceDiagnostics } from '../encoder-policy';
import { resolveIncludedSources, resolveSourceRoot } from '../source-files';

const createdFixtures: Array<() => Promise<void>> = [];

afterEach(async () => {
    await Promise.all(createdFixtures.splice(0).map(cleanup => cleanup()));
});

function expectPrivatePathIsNotRetained(error: unknown, root: string): boolean {
    expect(error).toBeInstanceOf(PublisherError);
    const publisherError = error as PublisherError;
    expect(JSON.stringify(publisherError.context)).not.toContain(root);
    expect(String(publisherError.cause ?? '')).not.toContain(root);
    return true;
}

describe('source-file failure diagnostics', () => {
    it('does not retain an absolute path when resolving a missing source root', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);

        await expect(
            resolveSourceRoot({
                repositoryRoot: fixture.root,
                explicitPath: join(fixture.root, 'missing-media'),
                environment: {},
            })
        ).rejects.toSatisfy(error =>
            expectPrivatePathIsNotRetained(error, fixture.root)
        );
    });

    it('does not retain an absolute path when resolving a missing source file', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);

        await expect(
            resolveIncludedSources({
                sourceRoot: fixture.sourceRoot,
                includedEntries: [
                    {
                        identity: {
                            type: 'background',
                            key: 'chapter_1/missing',
                        },
                        sourcePath: 'missing.png',
                    },
                ],
            })
        ).rejects.toSatisfy(error =>
            expectPrivatePathIsNotRetained(error, fixture.root)
        );
    });
});

describe('resolveIncludedSources', () => {
    it('keys availableSourcePaths by exact plan-relative strings', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const result = await resolveIncludedSources({
            sourceRoot: fixture.sourceRoot,
            includedEntries: [
                {
                    identity: { type: 'background', key: 'chapter_1/bg' },
                    sourcePath: fixture.backgroundPath,
                    section: 'chapter_1',
                },
            ],
        });

        expect([...result.availableSourcePaths]).toEqual([
            fixture.backgroundPath,
        ]);
        expect([...result.availableSourcePaths][0]).not.toContain(
            fixture.sourceRoot
        );
    });

    it('rejects a symlink that escapes the real source root', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const outside = join(fixture.root, 'outside.png');
        await writeFile(outside, 'not inside');
        await symlink(outside, join(fixture.sourceRoot, 'escape.png'));

        await expect(
            resolveIncludedSources({
                sourceRoot: fixture.sourceRoot,
                includedEntries: [
                    {
                        identity: {
                            type: 'background',
                            key: 'chapter_1/escape',
                        },
                        sourcePath: 'escape.png',
                    },
                ],
            })
        ).rejects.toThrow(/outside.*source root/i);
    });

    it('rejects a non-PNG/JPEG/WebP image as an unsupported source', async () => {
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const gifBytes = await sharp({
            create: {
                width: 2,
                height: 2,
                channels: 3,
                background: '#000000',
            },
        })
            .gif()
            .toBuffer();
        await writeFile(join(fixture.sourceRoot, 'wrong-format.gif'), gifBytes);

        await expect(
            resolveIncludedSources({
                sourceRoot: fixture.sourceRoot,
                includedEntries: [
                    {
                        identity: {
                            type: 'background',
                            key: 'chapter_1/wrong-format',
                        },
                        sourcePath: 'wrong-format.gif',
                    },
                ],
            })
        ).rejects.toThrow(/single-frame PNG, JPEG, or WebP/);
    });

    it('normalizes EXIF orientation before evaluating a portrait source', async () => {
        // A portrait stored as 1200×900 with EXIF orientation 6 displays as
        // 900×1200 (3:4). Raw metadata dimensions would evaluate it as a
        // landscape background and emit a wrong aspect warning; the loader
        // must pass orientation-normalized dimensions into diagnostics so the
        // portrait is evaluated correctly and produces no aspect warning.
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const relativePath = 'example/characters/mio/rotated.jpg';
        const filePath = join(fixture.sourceRoot, relativePath);
        await mkdir(dirname(filePath), { recursive: true });
        const portraitBytes = await sharp({
            create: {
                width: 1200,
                height: 900,
                channels: 3,
                background: { r: 40, g: 60, b: 80 },
            },
        })
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();
        await writeFile(filePath, portraitBytes);

        const result = await resolveIncludedSources({
            sourceRoot: fixture.sourceRoot,
            includedEntries: [
                {
                    identity: { type: 'portrait', key: 'mio/rotated' },
                    sourcePath: relativePath,
                },
            ],
        });

        const [source] = result.sources;
        expect(source.metadata.width).toBe(900);
        expect(source.metadata.height).toBe(1200);
        // 900×1200 matches the portrait preferred aspect (3:4) and meets the
        // 900×1200 minimum, so no diagnostics should fire. Without orientation
        // normalization the raw 1200×900 would trigger a false aspect warning.
        expect(evaluateSourceDiagnostics(source)).toEqual([]);
    });

    it('reports a minimum-dimension warning for an undersized rotated portrait', async () => {
        // A portrait stored as 1000×750 with EXIF orientation 6 displays as
        // 750×1000 (3:4). The aspect is correct (no aspect warning) but both
        // dimensions are below the 900×1200 portrait minimum, so a
        // minimum-dimension warning must fire.
        const fixture = await createSourceFixture();
        createdFixtures.push(fixture.cleanup);
        const relativePath = 'example/characters/mio/undersized.jpg';
        const filePath = join(fixture.sourceRoot, relativePath);
        await mkdir(dirname(filePath), { recursive: true });
        const portraitBytes = await sharp({
            create: {
                width: 1000,
                height: 750,
                channels: 3,
                background: { r: 50, g: 70, b: 90 },
            },
        })
            .jpeg()
            .withMetadata({ orientation: 6 })
            .toBuffer();
        await writeFile(filePath, portraitBytes);

        const result = await resolveIncludedSources({
            sourceRoot: fixture.sourceRoot,
            includedEntries: [
                {
                    identity: { type: 'portrait', key: 'mio/undersized' },
                    sourcePath: relativePath,
                },
            ],
        });

        const [source] = result.sources;
        expect(source.metadata.width).toBe(750);
        expect(source.metadata.height).toBe(1000);
        const diagnostics = evaluateSourceDiagnostics(source);
        expect(diagnostics.map(d => d.code)).toEqual([
            'source/minimum-dimension',
        ]);
    });
});
