import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPreviewId } from '@aquila/stories/runtime-assets';
import { main } from '../../../../scripts/asset-preview-id';

// `derivePreviewId`, `previewIdForEnv`, and `writePreviewId` are unit-tested
// in the co-located `apps/web/scripts/__tests__/asset-preview-id.test.ts`
// suite. This file covers only the `main` composition and the
// `import.meta.main` Bun CLI entrypoint — the parts that must be driven the
// way the build drives them.

describe('main', () => {
    const capture = (): { stdout: string[]; stderr: string[] } => ({
        stdout: [],
        stderr: [],
    });
    const streams = (cap: ReturnType<typeof capture>) => ({
        stdout: { write: (s: string) => void cap.stdout.push(s) },
        stderr: { write: (s: string) => void cap.stderr.push(s) },
    });

    it('composes previewIdForEnv and writePreviewId for a configured build', () => {
        const cap = capture();
        const code = main(
            {
                VERCEL_ENV: 'preview',
                VERCEL_GIT_COMMIT_REF: 'feature/Foo_Bar',
                PUBLIC_ASSET_BASE_URL: 'https://assets.example.com/',
                PUBLIC_ASSET_ENVIRONMENT: 'preview',
            },
            streams(cap).stdout,
            streams(cap).stderr
        );
        expect(code).toBe(0);
        expect(cap.stdout).toHaveLength(1);
        expect(cap.stdout[0]).toMatch(/^feature-foo_bar-[0-9a-f]{12}$/);
        expect(isPreviewId(cap.stdout[0])).toBe(true);
    });

    it('emits nothing and exits 0 outside a preview build', () => {
        const cap = capture();
        const code = main(
            { VERCEL_ENV: 'production' },
            streams(cap).stdout,
            streams(cap).stderr
        );
        expect(code).toBe(0);
        expect(cap.stdout).toEqual(['']);
        expect(cap.stderr).toEqual([]);
    });
});

describe('asset-preview-id CLI', () => {
    // Exercises the `import.meta.main` entrypoint the same way the build does
    // (`bun scripts/asset-preview-id.ts`), so the thin caller stays covered.
    // The script relies on `import.meta.main`, a Bun-specific API, so it must
    // be run under bun rather than whatever `process.execPath` resolves to
    // (vitest may run under node).
    const scriptPath = resolve(
        __dirname,
        '../../../../scripts/asset-preview-id.ts'
    );
    const run = (env: Record<string, string>) =>
        spawnSync('bun', [scriptPath], {
            env: { ...process.env, ...env },
            encoding: 'utf8',
        });

    it('emits a derived id on stdout for a configured preview build', () => {
        const result = run({
            VERCEL_ENV: 'preview',
            VERCEL_GIT_COMMIT_REF: 'feature/Foo_Bar',
            PUBLIC_ASSET_BASE_URL: 'https://assets.example.com/',
            PUBLIC_ASSET_ENVIRONMENT: 'preview',
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/^feature-foo_bar-[0-9a-f]{12}$/);
        expect(isPreviewId(result.stdout)).toBe(true);
        expect(result.stderr).toBe('');
    });

    it('fails with a non-zero exit when the branch ref is missing', () => {
        // The build gate throws when VERCEL_GIT_COMMIT_REF is absent, so the
        // CLI exits non-zero instead of emitting a colliding shared id.
        const result = run({
            VERCEL_ENV: 'preview',
            PUBLIC_ASSET_BASE_URL: 'https://assets.example.com/',
            PUBLIC_ASSET_ENVIRONMENT: 'preview',
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/VERCEL_GIT_COMMIT_REF is absent/);
    });

    it('emits an empty string and exits 0 outside a preview build', () => {
        const result = run({ VERCEL_ENV: 'production' });
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
    });
});
