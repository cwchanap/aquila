import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const captureScript = new URL('../r2-gate-capture-state.ts', import.meta.url);

describe('R2 publisher gate state capture', () => {
    it('resolves package-owned imports before validating arguments', async () => {
        await expect(
            execFileAsync('bun', [fileURLToPath(captureScript)])
        ).rejects.toMatchObject({
            code: 1,
            stderr: expect.stringContaining('capture arguments missing'),
        });
    }, 10_000);
});
