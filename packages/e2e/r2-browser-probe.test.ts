import { describe, expect, it } from 'bun:test';
import type { Page } from '@playwright/test';
import {
    assertCorsReadable,
    cacheDirectives,
    probeImageFromPage,
    probeJsonFromPage,
    type BrowserPageProbe,
} from './tests/support/r2-browser-probe';

const URL = 'https://assets.example.test/vn/previews/example/current.json';
const PREREQUISITES = 'requires a deployed fixture';

function pageReturning(probe: BrowserPageProbe): Page {
    return {
        evaluate: async () => probe,
    } as unknown as Page;
}

describe('r2 browser probes', () => {
    it('reports a page-side fetch timeout with the live-fixture prerequisite', () => {
        expect(() =>
            assertCorsReadable(
                URL,
                {
                    ok: false,
                    reason: 'timeout',
                    detail: 'TimeoutError: signal timed out',
                },
                PREREQUISITES
            )
        ).toThrow(
            `GET ${URL} did not answer in time: TimeoutError: signal timed out\n${PREREQUISITES}`
        );
    });

    it('reports browser-blocked CORS reads without exposing URL credentials', () => {
        const attempt = () =>
            assertCorsReadable(
                'https://operator:secret@assets.example.test/vn/current.json?token=secret',
                {
                    ok: false,
                    reason: 'blocked',
                    detail: 'TypeError: Failed to fetch',
                },
                PREREQUISITES
            );

        expect(attempt).toThrow('was unreadable to page script');
        expect(attempt).not.toThrow('secret');
    });

    it('reports an HTTP response error returned to a page script', async () => {
        await expect(
            probeJsonFromPage(
                pageReturning({
                    ok: false,
                    reason: 'status',
                    detail: 'HTTP 503 Service Unavailable',
                }),
                URL,
                1_000,
                PREREQUISITES
            )
        ).rejects.toThrow(
            'GET https://assets.example.test/vn/previews/example/current.json returned an error status: HTTP 503 Service Unavailable'
        );
    });

    it('reports invalid JSON from an otherwise readable document', async () => {
        await expect(
            probeJsonFromPage(
                pageReturning({
                    ok: true,
                    cacheControl: 'max-age=0',
                    text: '<html>not json</html>',
                    size: null,
                }),
                URL,
                1_000,
                PREREQUISITES
            )
        ).rejects.toThrow('did not return JSON: <html>not json</html>');
    });

    it('reports browser image decode failures', async () => {
        await expect(
            probeImageFromPage(
                pageReturning({
                    ok: false,
                    reason: 'decode',
                    detail: '17 byte(s) of image/webp — InvalidStateError',
                }),
                'https://assets.example.test/vn/objects/example.webp',
                1_000,
                PREREQUISITES
            )
        ).rejects.toThrow(
            'returned bytes the browser could not decode as an image'
        );
    });

    it('parses cache directives without changing their multiplicity', () => {
        expect(
            cacheDirectives('max-age=0, No-Cache, max-age=0, , immutable')
        ).toEqual(['max-age=0', 'no-cache', 'max-age=0', 'immutable']);
    });

    it('returns browser-decoded image dimensions and cache control', async () => {
        await expect(
            probeImageFromPage(
                pageReturning({
                    ok: true,
                    cacheControl: 'public, max-age=31536000, immutable',
                    text: null,
                    size: { width: 1920, height: 1080 },
                }),
                'https://assets.example.test/vn/objects/example.webp',
                1_000,
                PREREQUISITES
            )
        ).resolves.toEqual({
            cacheControl: 'public, max-age=31536000, immutable',
            size: { width: 1920, height: 1080 },
        });
    });
});
