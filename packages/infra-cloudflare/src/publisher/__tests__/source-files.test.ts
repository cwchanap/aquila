import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createSourceFixture } from '../test-fixtures';
import { PublisherError } from '../errors';
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
});
