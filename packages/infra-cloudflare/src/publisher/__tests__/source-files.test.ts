import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSourceFixture } from '../test-fixtures';
import { PublisherError } from '../errors';
import { resolveIncludedSources, resolveSourceRoot } from '../source-files';

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
});
