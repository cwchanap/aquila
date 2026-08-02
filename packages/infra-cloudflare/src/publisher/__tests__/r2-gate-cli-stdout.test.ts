import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(
    new URL('../../../../../', import.meta.url)
);
const workflowPath = new URL(
    '../../../../../.github/workflows/r2-publisher-preview.yml',
    import.meta.url
);

describe('R2 publisher gate CLI stdout', () => {
    it('keeps the workflow publisher launcher JSON-only on a controlled error', async () => {
        const workflow = await readFile(workflowPath, 'utf8');
        const launcher = workflow.match(/^\s+(bun .+?) publish \\$/m)?.[1];
        expect(launcher).toBe(
            'bun packages/infra-cloudflare/src/publisher/cli.ts'
        );

        const [executable, ...launcherArgs] = launcher!.split(/\s+/);
        let failure:
            | (Error & { code?: number; stdout?: string; stderr?: string })
            | undefined;
        try {
            await execFileAsync(
                executable,
                [...launcherArgs, 'not-a-command', '--json'],
                { cwd: repositoryRoot }
            );
        } catch (error) {
            failure = error as typeof failure;
        }

        expect(failure?.code).toBe(1);
        const report = JSON.parse(failure?.stdout ?? '') as {
            status: string;
            errors: Array<{ code?: string }>;
        };
        expect(report.status).toBe('failed');
        expect(report.errors[0]?.code).toBe('configuration');
        expect(failure?.stdout?.trim().split('\n')).toHaveLength(1);
    }, 30_000);
});
