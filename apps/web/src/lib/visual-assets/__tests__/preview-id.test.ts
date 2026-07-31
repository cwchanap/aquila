import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPreviewId } from '@aquila/stories/runtime-assets';
import {
    derivePreviewId,
    main,
    previewIdForEnv,
    writePreviewId,
} from '../../../../scripts/asset-preview-id';

// The branch this feature was built on: `author/ticket-long-description` is the
// convention in use here, and it already overflows the 64-character clamp.
const LONG_BRANCH =
    'jack65786656/hpa-229-provision-isolated-aquila-r2-visual-asset-delivery';

const CONFIGURED_ENV = {
    VERCEL_ENV: 'preview',
    VERCEL_GIT_COMMIT_REF: 'feature/Foo_Bar',
    PUBLIC_ASSET_BASE_URL: 'https://assets.aquila.cwchanap.dev/',
    PUBLIC_ASSET_ENVIRONMENT: 'preview',
};

describe('derivePreviewId', () => {
    it('lowercases and replaces slashes', () => {
        expect(derivePreviewId('feature/Foo_Bar')).toBe('feature-foo_bar');
    });

    it('strips leading and trailing separators', () => {
        expect(derivePreviewId('-HPA-229-')).toBe('hpa-229');
    });

    it('collapses runs of separators', () => {
        expect(derivePreviewId('a///b')).toBe('a-b');
        expect(derivePreviewId('a__b')).toBe('a-b');
        expect(derivePreviewId('a-_-b')).toBe('a-b');
    });

    it('clamps to 64 characters without a trailing separator', () => {
        const result = derivePreviewId(`${'a'.repeat(62)}-${'b'.repeat(20)}`);
        expect(result.length).toBeLessThanOrEqual(64);
        expect(isPreviewId(result)).toBe(true);
    });

    it('leaves an id that already fits untouched', () => {
        expect(derivePreviewId('a'.repeat(63))).toBe('a'.repeat(63));
        expect(derivePreviewId('a'.repeat(64))).toBe('a'.repeat(64));
        expect(derivePreviewId('feature/Foo_Bar')).toBe('feature-foo_bar');
    });

    it('appends a hash suffix only when it truncates', () => {
        // 64 characters is the longest id isPreviewId() accepts, so the
        // truncation path only triggers at 65 and above.
        expect(derivePreviewId('a'.repeat(64))).toBe('a'.repeat(64));
        expect(derivePreviewId('a'.repeat(65))).toMatch(/^a{54}-[0-9a-f]{6}$/);
    });

    it('keeps sibling branches that differ only past the clamp distinct', () => {
        const siblings = [
            LONG_BRANCH,
            `${LONG_BRANCH}-followup`,
            'jack65786656/hpa-229-provision-isolated-aquila-r2-visual-asset-fix',
        ];
        const ids = siblings.map(derivePreviewId);

        expect(new Set(ids).size).toBe(siblings.length);
        for (const id of ids) {
            expect(id.length).toBeLessThanOrEqual(64);
            expect(isPreviewId(id)).toBe(true);
        }
    });

    it('derives truncated ids deterministically', () => {
        expect(derivePreviewId(LONG_BRANCH)).toBe(derivePreviewId(LONG_BRANCH));
    });

    it('falls back to a deterministic hash when nothing survives', () => {
        const first = derivePreviewId('日本語');
        expect(first).toMatch(/^preview-[0-9a-f]{8}$/);
        expect(derivePreviewId('日本語')).toBe(first);
    });

    it('gives canonically equivalent refs the same id', () => {
        // 'e' + combining acute normalizes to precomposed 'é'. Both take the
        // hash-fallback path, so the hash input must be normalized as well.
        expect(derivePreviewId('e\u0301')).toBe(derivePreviewId('\u00e9'));
    });

    it('always produces a valid preview id', () => {
        for (const ref of [
            'main',
            'HPA-229',
            'feature/Foo_Bar',
            '日本語',
            '___',
            LONG_BRANCH,
            `${'x'.repeat(200)}`,
        ]) {
            expect(isPreviewId(derivePreviewId(ref))).toBe(true);
        }
    });
});

describe('previewIdForEnv', () => {
    it('derives an id for a fully configured preview build', () => {
        expect(previewIdForEnv(CONFIGURED_ENV)).toBe('feature-foo_bar');
    });

    it('emits nothing outside a preview build', () => {
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                VERCEL_ENV: 'production',
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toBe('');
        expect(
            previewIdForEnv({ ...CONFIGURED_ENV, VERCEL_ENV: undefined })
        ).toBe('');
    });

    it('emits nothing when the rest of the asset config is absent', () => {
        expect(
            previewIdForEnv({
                VERCEL_ENV: 'preview',
                VERCEL_GIT_COMMIT_REF: 'feature/Foo_Bar',
            })
        ).toBe('');
    });

    it('emits nothing when only the base URL is configured', () => {
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                PUBLIC_ASSET_ENVIRONMENT: undefined,
            })
        ).toBe('');
    });

    it('emits nothing when the asset environment is not preview', () => {
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                PUBLIC_ASSET_ENVIRONMENT: 'production',
            })
        ).toBe('');
    });

    it('treats blank configuration as absent, like the reader does', () => {
        expect(
            previewIdForEnv({ ...CONFIGURED_ENV, PUBLIC_ASSET_BASE_URL: '   ' })
        ).toBe('');
    });

    it('still yields a valid id when the branch ref is missing', () => {
        const id = previewIdForEnv({
            ...CONFIGURED_ENV,
            VERCEL_GIT_COMMIT_REF: undefined,
        });
        expect(id).toMatch(/^preview-[0-9a-f]{8}$/);
        expect(isPreviewId(id)).toBe(true);
    });
});

describe('writePreviewId', () => {
    const capture = (): { stdout: string[]; stderr: string[] } => ({
        stdout: [],
        stderr: [],
    });
    const streams = (cap: ReturnType<typeof capture>) => ({
        stdout: { write: (s: string) => void cap.stdout.push(s) },
        stderr: { write: (s: string) => void cap.stderr.push(s) },
    });

    it('writes a valid id to stdout and exits 0', () => {
        const cap = capture();
        const code = writePreviewId(
            'hpa-229',
            streams(cap).stdout,
            streams(cap).stderr
        );
        expect(code).toBe(0);
        expect(cap.stdout).toEqual(['hpa-229']);
        expect(cap.stderr).toEqual([]);
    });

    it('writes nothing and exits 0 for an empty id', () => {
        const cap = capture();
        const code = writePreviewId(
            '',
            streams(cap).stdout,
            streams(cap).stderr
        );
        expect(code).toBe(0);
        expect(cap.stdout).toEqual(['']);
        expect(cap.stderr).toEqual([]);
    });

    it('rejects an invalid id via stderr and exits 1', () => {
        const cap = capture();
        const code = writePreviewId(
            'UPPERCASE-with-/"bad"',
            streams(cap).stdout,
            streams(cap).stderr
        );
        expect(code).toBe(1);
        expect(cap.stdout).toEqual([]);
        expect(cap.stderr[0]).toMatch(
            /invalid preview id: UPPERCASE-with-\/"bad"/
        );
    });
});

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
        expect(cap.stdout).toEqual(['feature-foo_bar']);
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
        expect(result.stdout).toBe('feature-foo_bar');
        expect(result.stderr).toBe('');
    });

    it('emits an empty string and exits 0 outside a preview build', () => {
        const result = run({ VERCEL_ENV: 'production' });
        expect(result.status).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
    });
});
