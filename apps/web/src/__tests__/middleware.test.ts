import { describe, it, expect, vi, beforeEach } from 'vitest';

// astro:middleware is aliased to a stub in vitest.config.ts
import { onRequest } from '../middleware';

type MiddlewareContext = {
    url: URL;
    locals: Record<string, string>;
};

function makeContext(pathname: string): MiddlewareContext {
    return {
        url: new URL(`http://localhost${pathname}`),
        locals: {},
    };
}

const next = vi.fn(() => new Response(null, { status: 200 }));

describe('middleware', () => {
    beforeEach(() => {
        next.mockClear();
    });

    describe('skipped paths', () => {
        it('passes through /api/ routes without locale check', async () => {
            const ctx = makeContext('/api/users');
            await onRequest(ctx as any, next);
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.locals.currentLocale).toBeUndefined();
        });

        it('passes through /_astro paths', async () => {
            const ctx = makeContext('/_astro/chunk.js');
            await onRequest(ctx as any, next);
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.locals.currentLocale).toBeUndefined();
        });

        it('passes through /favicon paths', async () => {
            const ctx = makeContext('/favicon.ico');
            await onRequest(ctx as any, next);
            expect(next).toHaveBeenCalledOnce();
            expect(ctx.locals.currentLocale).toBeUndefined();
        });
    });

    describe('locale detection', () => {
        it('sets currentLocale to "en" for /en/ paths', async () => {
            const ctx = makeContext('/en/');
            await onRequest(ctx as any, next);
            expect(ctx.locals.currentLocale).toBe('en');
            expect(next).toHaveBeenCalledOnce();
        });

        it('sets currentLocale to "zh" for /zh/ paths', async () => {
            const ctx = makeContext('/zh/stories');
            await onRequest(ctx as any, next);
            expect(ctx.locals.currentLocale).toBe('zh');
            expect(next).toHaveBeenCalledOnce();
        });

        it('sets currentLocale for deep nested /en/ paths', async () => {
            const ctx = makeContext('/en/story/setup');
            await onRequest(ctx as any, next);
            expect(ctx.locals.currentLocale).toBe('en');
            expect(next).toHaveBeenCalledOnce();
        });
    });

    describe('redirect behavior', () => {
        it('redirects to /en/ when no locale prefix is present', async () => {
            const ctx = makeContext('/');
            const result = await onRequest(ctx as any, next);
            expect(next).not.toHaveBeenCalled();
            expect(result?.status).toBe(302);
            expect(result?.headers.get('Location')).toBe('/en/');
        });

        it('redirects to /en/ for unknown locale prefix', async () => {
            const ctx = makeContext('/fr/stories');
            const result = await onRequest(ctx as any, next);
            expect(next).not.toHaveBeenCalled();
            expect(result?.status).toBe(302);
            expect(result?.headers.get('Location')).toBe('/en/');
        });

        it('redirects to /en/ for unknown locale like /de/stories', async () => {
            const ctx = makeContext('/de/');
            const result = await onRequest(ctx as any, next);
            expect(next).not.toHaveBeenCalled();
            expect(result?.status).toBe(302);
            expect(result?.headers.get('Location')).toBe('/en/');
        });
    });
});
