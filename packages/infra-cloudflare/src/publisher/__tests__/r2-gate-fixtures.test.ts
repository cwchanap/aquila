import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const fixtureScript = new URL('../r2-gate-fixtures.ts', import.meta.url);

describe('R2 publisher gate fixtures', () => {
    it('generates the three isolated source variants from the infra workspace', async () => {
        const outputRoot = await mkdtemp(join(tmpdir(), 'aquila-r2-gate-'));

        try {
            await execFileAsync('bun', [fixtureScript.pathname, outputRoot]);

            const variants = [
                ['source-b/gate/background.png', 1672, 941, [12, 140, 210]],
                ['source-c/gate/background.png', 1672, 941, [188, 74, 42]],
                ['source-c/gate/portrait.png', 1024, 1024, [64, 198, 104, 128]],
            ] as const;

            for (const [
                relativePath,
                width,
                height,
                expectedPixel,
            ] of variants) {
                const image = sharp(join(outputRoot, relativePath));
                const metadata = await image.metadata();
                const { data } = await image.raw().toBuffer({
                    resolveWithObject: true,
                });

                expect(metadata.width).toBe(width);
                expect(metadata.height).toBe(height);
                expect([...data.subarray(0, expectedPixel.length)]).toEqual(
                    expectedPixel
                );
            }
        } finally {
            await rm(outputRoot, { recursive: true, force: true });
        }
    });
});
