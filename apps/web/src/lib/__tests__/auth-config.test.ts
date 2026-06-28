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
});
