/**
 * Tests for auth-config.ts: pure resolvers that let auth.ts deduce its base URL
 * and trusted origins from the request hostname (Vercel system env vars) instead
 * of requiring BETTER_AUTH_URL / TRUSTED_ORIGINS to be set by hand.
 */
import { describe, it, expect } from 'vitest';
import { resolveBaseURL, resolveTrustedOrigins } from '../auth-config';

describe('resolveBaseURL', () => {
    it('returns the localhost dev URL when nothing is set and not production', () => {
        expect(resolveBaseURL({}, false)).toBe('http://localhost:5090');
    });

    it('prefers an explicit BETTER_AUTH_URL over the Vercel domain in production', () => {
        const url = resolveBaseURL(
            {
                BETTER_AUTH_URL: 'https://auth.example.com',
                VERCEL_PROJECT_PRODUCTION_URL: 'aquila.cwchanap.dev',
            },
            true
        );
        expect(url).toBe('https://auth.example.com');
    });

    it('derives https://<VERCEL_PROJECT_PRODUCTION_URL> when no explicit URL is set in production', () => {
        const url = resolveBaseURL(
            { VERCEL_PROJECT_PRODUCTION_URL: 'aquila.cwchanap.dev' },
            true
        );
        expect(url).toBe('https://aquila.cwchanap.dev');
    });

    it('trims surrounding whitespace on an explicit URL', () => {
        const url = resolveBaseURL(
            { BETTER_AUTH_URL: '  https://auth.example.com  ' },
            true
        );
        expect(url).toBe('https://auth.example.com');
    });

    it('throws in production when neither an explicit URL nor a Vercel domain is available', () => {
        expect(() => resolveBaseURL({}, true)).toThrow(
            /BETTER_AUTH_URL must be set in production/
        );
    });

    it('throws in production when the explicit URL is local', () => {
        expect(() =>
            resolveBaseURL({ BETTER_AUTH_URL: 'http://localhost:5090' }, true)
        ).toThrow(/non-local URL in production/);
    });

    it('throws in production when the explicit URL is a bracketed IPv6 loopback', () => {
        // `new URL('http://[::1]:5090').hostname` returns `[::1]` (bracketed),
        // so the loopback check must strip the brackets to recognize `::1`.
        expect(() =>
            resolveBaseURL({ BETTER_AUTH_URL: 'http://[::1]:5090' }, true)
        ).toThrow(/non-local URL in production/);
    });

    it('throws in production when the explicit URL is not a valid URL', () => {
        expect(() =>
            resolveBaseURL({ BETTER_AUTH_URL: 'not-a-url' }, true)
        ).toThrow(/valid URL in production/);
    });

    it('allows a localhost override in development without throwing', () => {
        expect(
            resolveBaseURL({ BETTER_AUTH_URL: 'http://localhost:3000' }, false)
        ).toBe('http://localhost:3000');
    });
});

describe('resolveTrustedOrigins', () => {
    it('splits an explicit comma-separated TRUSTED_ORIGINS, trimming and filtering blanks', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS:
                    'https://a.example.com, https://b.example.com, ,',
            },
            true
        );
        expect(origins).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });

    it('derives origins from the Vercel production, deployment, and branch URLs', () => {
        const origins = resolveTrustedOrigins(
            {
                VERCEL_PROJECT_PRODUCTION_URL: 'aquila.cwchanap.dev',
                VERCEL_URL: 'aquila-abc123.vercel.app',
                VERCEL_BRANCH_URL: 'aquila-git-feature.vercel.app',
            },
            true
        );
        expect(origins).toEqual([
            'https://aquila.cwchanap.dev',
            'https://aquila-abc123.vercel.app',
            'https://aquila-git-feature.vercel.app',
        ]);
    });

    it('dedupes derived origins when Vercel URLs overlap', () => {
        const origins = resolveTrustedOrigins(
            {
                VERCEL_PROJECT_PRODUCTION_URL: 'aquila.cwchanap.dev',
                VERCEL_URL: 'aquila.cwchanap.dev',
            },
            true
        );
        expect(origins).toEqual(['https://aquila.cwchanap.dev']);
    });

    it('includes only the Vercel URLs that are present', () => {
        const origins = resolveTrustedOrigins(
            { VERCEL_URL: 'aquila-abc123.vercel.app' },
            true
        );
        expect(origins).toEqual(['https://aquila-abc123.vercel.app']);
    });

    it('merges an explicit TRUSTED_ORIGINS with the derived Vercel origins (deduped)', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS: 'https://pinned.example.com',
                VERCEL_URL: 'aquila-abc123.vercel.app',
            },
            true
        );
        expect(origins).toEqual([
            'https://pinned.example.com',
            'https://aquila-abc123.vercel.app',
        ]);
    });

    it('dedupes when an explicit origin overlaps a Vercel-derived origin', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS: 'https://aquila.cwchanap.dev',
                VERCEL_PROJECT_PRODUCTION_URL: 'aquila.cwchanap.dev',
            },
            true
        );
        expect(origins).toEqual(['https://aquila.cwchanap.dev']);
    });

    it('throws in production when neither explicit origins nor Vercel URLs are available', () => {
        expect(() => resolveTrustedOrigins({}, true)).toThrow(
            /TRUSTED_ORIGINS must be set in production/
        );
    });

    it('falls back to the localhost dev origin when nothing is set and not production', () => {
        expect(resolveTrustedOrigins({}, false)).toEqual([
            'http://localhost:5090',
        ]);
    });

    it('drops malformed explicit origins', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS: 'not-a-url, https://valid.example.com',
            },
            true
        );
        expect(origins).toEqual(['https://valid.example.com']);
    });

    it('rejects non-http(s) explicit origins', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS:
                    'javascript:alert(1), data:text/html,foo, https://valid.example.com',
            },
            true
        );
        expect(origins).toEqual(['https://valid.example.com']);
    });

    it('normalizes explicit origins to .origin (strips path/query)', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS:
                    'https://a.example.com/some/path?x=1, https://b.example.com',
            },
            true
        );
        expect(origins).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });

    it('rejects localhost explicit origins in production', () => {
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS:
                    'http://localhost:5090, https://valid.example.com',
            },
            true
        );
        expect(origins).toEqual(['https://valid.example.com']);
    });

    it('rejects a bracketed IPv6 loopback explicit origin in production', () => {
        // `new URL('http://[::1]:5090').hostname` returns `[::1]` (bracketed),
        // so the loopback check must strip the brackets to recognize `::1`.
        const origins = resolveTrustedOrigins(
            {
                TRUSTED_ORIGINS: 'http://[::1]:5090, https://valid.example.com',
            },
            true
        );
        expect(origins).toEqual(['https://valid.example.com']);
    });

    it('allows localhost explicit origins in development', () => {
        const origins = resolveTrustedOrigins(
            { TRUSTED_ORIGINS: 'http://localhost:3000' },
            false
        );
        expect(origins).toEqual(['http://localhost:3000']);
    });

    it('throws in production when all explicit origins are invalid and no Vercel URLs are set', () => {
        expect(() =>
            resolveTrustedOrigins({ TRUSTED_ORIGINS: 'not-a-url' }, true)
        ).toThrow(/TRUSTED_ORIGINS must be set in production/);
    });

    describe('wildcard patterns', () => {
        it('preserves a bare wildcard host pattern (no scheme)', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*.example.com' },
                true
            );
            expect(origins).toEqual(['*.example.com']);
        });

        it('preserves a scheme-qualified wildcard origin pattern', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: 'https://*.example.com' },
                true
            );
            expect(origins).toEqual(['https://*.example.com']);
        });

        it('merges wildcard patterns with derived Vercel origins', () => {
            const origins = resolveTrustedOrigins(
                {
                    TRUSTED_ORIGINS: '*.example.com',
                    VERCEL_URL: 'aquila-abc123.vercel.app',
                },
                true
            );
            expect(origins).toEqual([
                '*.example.com',
                'https://aquila-abc123.vercel.app',
            ]);
        });

        it('does not throw in production when only a wildcard is set (no Vercel URLs)', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*.example.com' },
                true
            );
            expect(origins).toEqual(['*.example.com']);
        });

        it('rejects a non-http(s) scheme on a wildcard pattern', () => {
            const origins = resolveTrustedOrigins(
                {
                    TRUSTED_ORIGINS:
                        'file://*.example.com, https://valid.example.com',
                },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects wildcard patterns with multiple stars', () => {
            const origins = resolveTrustedOrigins(
                {
                    TRUSTED_ORIGINS:
                        '*.*.example.com, https://valid.example.com',
                },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects a bare `*` wildcard', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*, https://valid.example.com' },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects a wildcard with no literal label (`*.`)', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*., https://valid.example.com' },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects a glued wildcard label (`*example.com`)', () => {
            // Better Auth compiles `*example.com` to `.*?example\.com`, which
            // matches any host ending in `example.com` (e.g. `evil-example.com`).
            // The `*` must occupy its own DNS label.
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*example.com, https://valid.example.com' },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects a trailing glued wildcard label (`example.*com`)', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: 'example.*com, https://valid.example.com' },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects a wildcard that can only match loopback in production', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*.localhost, https://valid.example.com' },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects a wildcard loopback label with a port in production', () => {
            // `https://*.localhost:3000` splits into labels `['*', 'localhost:3000']`;
            // the loopback check must strip the `:port` to recognize `localhost`.
            const origins = resolveTrustedOrigins(
                {
                    TRUSTED_ORIGINS:
                        'https://*.localhost:3000, https://valid.example.com',
                },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects an IPv4 loopback wildcard in production', () => {
            // `*.127.0.0.1` splits into labels `['*', '127', '0', '0', '1']`;
            // the loopback check must reconstruct the full suffix `127.0.0.1`
            // rather than only inspecting the last dot label `1`.
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*.127.0.0.1, https://valid.example.com' },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('rejects an IPv4 loopback wildcard with a port in production', () => {
            // `https://*.127.0.0.1:3000` splits into labels
            // `['*', '127', '0', '0', '1:3000']`; the loopback check must
            // reconstruct `127.0.0.1:3000` and strip the port to recognize
            // the loopback suffix.
            const origins = resolveTrustedOrigins(
                {
                    TRUSTED_ORIGINS:
                        'https://*.127.0.0.1:3000, https://valid.example.com',
                },
                true
            );
            expect(origins).toEqual(['https://valid.example.com']);
        });

        it('allows a loopback wildcard in development', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '*.localhost' },
                false
            );
            expect(origins).toEqual(['*.localhost']);
        });

        it('trims surrounding whitespace on a wildcard pattern', () => {
            const origins = resolveTrustedOrigins(
                { TRUSTED_ORIGINS: '  *.example.com  ' },
                true
            );
            expect(origins).toEqual(['*.example.com']);
        });
    });
});
