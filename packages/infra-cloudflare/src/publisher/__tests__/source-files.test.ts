import { symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSourceFixture } from '../test-fixtures';
import { resolveIncludedSources } from '../source-files';

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
