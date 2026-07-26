import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyVisualFixtures } from '../../../../scripts/verify-visual-fixtures';

const publicRoot = resolve(process.cwd(), 'public/assets');
const pointerFile = resolve(
    publicRoot,
    'vn/previews/hpa-228-local/stories/the_seventh_mirror/current.json'
);

describe('checked-in visual fixtures', () => {
    it('match source coverage and every content address', async () => {
        await expect(verifyVisualFixtures()).resolves.toBeUndefined();
    });

    it('aggregates independent pointer, release, and coverage mismatches', async () => {
        const pointerText = await readFile(pointerFile, 'utf8');
        const pointer = JSON.parse(pointerText) as {
            manifestPath: string;
            [key: string]: unknown;
        };
        const manifest = JSON.parse(
            await readFile(resolve(publicRoot, pointer.manifestPath), 'utf8')
        ) as { releaseId: string; assets: unknown[]; [key: string]: unknown };
        const wrongReleaseId = `sha256-${'f'.repeat(64)}`;
        const wrongManifestPath = `vn/previews/hpa-228-local/stories/the_seventh_mirror/releases/${wrongReleaseId}/runtime-manifest.json`;
        const wrongManifestFile = resolve(publicRoot, wrongManifestPath);
        const extraAsset = structuredClone(manifest.assets[2]) as {
            identity: { type: string; key: string };
        };
        extraAsset.identity.key = 'asakura_mio/extra';
        manifest.releaseId = wrongReleaseId;
        manifest.assets.splice(3, 0, extraAsset);

        try {
            await mkdir(dirname(wrongManifestFile), { recursive: true });
            await writeFile(
                wrongManifestFile,
                `${JSON.stringify(manifest, null, 2)}\n`
            );
            await writeFile(
                pointerFile,
                `${JSON.stringify(
                    {
                        ...pointer,
                        releaseId: wrongReleaseId,
                        manifestPath: wrongManifestPath,
                        manifestSha256: '0'.repeat(64),
                    },
                    null,
                    2
                )}\n`
            );
            const error = await verifyVisualFixtures().then(
                () =>
                    new Error(
                        'Expected corrupted fixtures to fail verification'
                    ),
                failure => failure
            );
            expect(error).toBeInstanceOf(Error);
            const message = (error as Error).message;
            expect(message).toContain('Manifest bytes do not match');
            expect(message).toContain(
                'release id does not match canonical release content'
            );
            expect(message).toContain(
                'Runtime manifest does not match its release plan'
            );
        } finally {
            await writeFile(pointerFile, pointerText);
            await rm(dirname(wrongManifestFile), {
                recursive: true,
                force: true,
            });
        }
    });
});
