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
    it('lowercases, replaces slashes, and appends a ref digest', () => {
        // The digest is over the NFC ref before lowercasing, so the slug stays
        // readable while refs that slugify identically remain distinct.
        expect(derivePreviewId('feature/Foo_Bar')).toMatch(
            /^feature-foo_bar-[0-9a-f]{12}$/
        );
    });

    it('strips leading and trailing separators before digesting', () => {
        expect(derivePreviewId('-HPA-229-')).toMatch(/^hpa-229-[0-9a-f]{12}$/);
    });

    it('collapses runs of separators before digesting', () => {
        expect(derivePreviewId('a///b')).toMatch(/^a-b-[0-9a-f]{12}$/);
        expect(derivePreviewId('a__b')).toMatch(/^a-b-[0-9a-f]{12}$/);
        expect(derivePreviewId('a-_-b')).toMatch(/^a-b-[0-9a-f]{12}$/);
    });

    it('clamps the slug prefix so the whole id stays within 64 characters', () => {
        const result = derivePreviewId(`${'a'.repeat(62)}-${'b'.repeat(20)}`);
        expect(result.length).toBeLessThanOrEqual(64);
        expect(isPreviewId(result)).toBe(true);
    });

    it('appends a digest to every non-empty slug, even when it fits', () => {
        // The discriminator is not conditional on truncation: a bare slug
        // would merge refs that slugify identically (`feature/foo` and
        // `feature-foo`), so every non-empty slug gets one. The prefix is
        // clamped to 51 chars, leaving room for `-` plus the 12-hex digest,
        // so the whole id stays within the 64-char isPreviewId limit.
        expect(derivePreviewId('a'.repeat(63))).toMatch(/^a{51}-[0-9a-f]{12}$/);
        expect(derivePreviewId('a'.repeat(64))).toMatch(/^a{51}-[0-9a-f]{12}$/);
        expect(derivePreviewId('a'.repeat(65))).toMatch(/^a{51}-[0-9a-f]{12}$/);
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

    it('derives ids deterministically', () => {
        expect(derivePreviewId(LONG_BRANCH)).toBe(derivePreviewId(LONG_BRANCH));
        expect(derivePreviewId('feature/Foo_Bar')).toBe(
            derivePreviewId('feature/Foo_Bar')
        );
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
        const id = previewIdForEnv(CONFIGURED_ENV);
        expect(id).toBe(derivePreviewId('feature/Foo_Bar'));
        expect(id).toMatch(/^feature-foo_bar-[0-9a-f]{12}$/);
        expect(isPreviewId(id)).toBe(true);
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

    it('fails the build when the branch ref is missing', () => {
        // Hashing the empty string is deterministic, so every ref-less build
        // would collapse onto one shared preview namespace. Fail instead of
        // silently sharing one — the operator must set the ref or an explicit
        // PUBLIC_ASSET_PREVIEW_ID.
        expect(() =>
            previewIdForEnv({
                ...CONFIGURED_ENV,
                VERCEL_GIT_COMMIT_REF: undefined,
            })
        ).toThrow(/VERCEL_GIT_COMMIT_REF is absent/);
        expect(() =>
            previewIdForEnv({
                ...CONFIGURED_ENV,
                VERCEL_GIT_COMMIT_REF: '   ',
            })
        ).toThrow(/VERCEL_GIT_COMMIT_REF is absent/);
    });

    it('honours an explicit id when the branch ref is missing', () => {
        // The absent-ref failure is the derive path only; an explicit id
        // bypasses it, so spoiler-sensitive previews can still publish without
        // a branch ref.
        const explicit = 'unguessable-preview-9f3a';
        expect(
            previewIdForEnv({
                ...CONFIGURED_ENV,
                VERCEL_GIT_COMMIT_REF: undefined,
                PUBLIC_ASSET_PREVIEW_ID: explicit,
            })
        ).toBe(explicit);
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
