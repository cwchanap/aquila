import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { GATE_FIXTURES } from '../r2-gate-fixtures';

const execFileAsync = promisify(execFile);
const fixtureScript = new URL('../r2-gate-fixtures.ts', import.meta.url);

describe('R2 publisher gate fixtures', () => {
    it('generates the three isolated source variants from the infra workspace', async () => {
        const outputRoot = await mkdtemp(join(tmpdir(), 'aquila-r2-gate-'));

        try {
            await execFileAsync('bun', [
                fileURLToPath(fixtureScript),
                outputRoot,
            ]);

            for (const fixture of GATE_FIXTURES) {
                const image = sharp(join(outputRoot, fixture.relativePath));
                const metadata = await image.metadata();
                const { data } = await image.raw().toBuffer({
                    resolveWithObject: true,
                });

                expect(metadata.width).toBe(fixture.width);
                expect(metadata.height).toBe(fixture.height);
                expect([
                    ...data.subarray(0, fixture.expectedPixel.length),
                ]).toEqual([...fixture.expectedPixel]);
            }
        } finally {
            await rm(outputRoot, { recursive: true, force: true });
        }
    }, 10_000);
});
