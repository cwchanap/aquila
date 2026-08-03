import type { Page } from '@playwright/test';

export type DecodedImageSize = { width: number; height: number };

type ProbeFailureReason = 'timeout' | 'blocked' | 'status' | 'body' | 'decode';

type BrowserPageProbeSuccess = {
    ok: true;
    cacheControl: string | null;
    text: string | null;
    size: DecodedImageSize | null;
};

type BrowserPageProbeFailure = {
    ok: false;
    reason: ProbeFailureReason;
    detail: string;
};

export type BrowserPageProbe =
    | BrowserPageProbeSuccess
    | BrowserPageProbeFailure;

const FAILURE_PHRASES: Record<ProbeFailureReason, string> = {
    timeout: 'did not answer in time',
    blocked:
        'was unreadable to page script — a missing ' +
        'access-control-allow-origin, a rejected preflight, or a DNS/TLS ' +
        'failure all look like this',
    status: 'returned an error status',
    body: 'did not return JSON',
    decode: 'returned bytes the browser could not decode as an image',
};

// This workspace's tsconfig carries no DOM lib, so the browser globals used
// inside page.evaluate are untyped. Only the decoder needs describing, and only
// the members used below.
declare function createImageBitmap(
    blob: Blob
): Promise<DecodedImageSize & { close(): void }>;

/**
 * Preserves repeated directives so callers can distinguish an exact cache
 * contract from one that only happens to contain the same unique values.
 */
export function cacheDirectives(header: string | null): string[] {
    return (header ?? '')
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean);
}

function safeUrl(value: string): string {
    try {
        const url = new URL(value);
        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch {
        return '<invalid URL>';
    }
}

function unusable(
    url: string,
    reason: ProbeFailureReason,
    detail: string,
    prerequisites: string
): Error {
    const requirement = prerequisites === '' ? '' : `\n${prerequisites}`;
    return new Error(
        `GET ${safeUrl(url)} ${FAILURE_PHRASES[reason]}: ${detail}${requirement}`
    );
}

/**
 * Turns page-side fetch failures into stable, operator-readable diagnostics.
 * The browser, not a shell client, determines whether CORS permits the read.
 */
export function assertCorsReadable(
    url: string,
    probe: BrowserPageProbe,
    prerequisites: string
): BrowserPageProbeSuccess {
    if (!probe.ok) {
        throw unusable(url, probe.reason, probe.detail, prerequisites);
    }
    return probe;
}

/**
 * Fetches from inside the page, so browser CORS enforcement and image decoding
 * are exercised rather than bypassed by a shell request.
 */
async function probeFromPage(
    page: Page,
    url: string,
    deadlineMs: number,
    as: 'text' | 'image',
    prerequisites: string
): Promise<BrowserPageProbeSuccess> {
    const probe = (await page.evaluate(
        async ({ target, timeoutMs, want }) => {
            try {
                const response = await fetch(target, {
                    mode: 'cors',
                    signal: AbortSignal.timeout(timeoutMs),
                });
                if (!response.ok) {
                    return {
                        ok: false as const,
                        reason: 'status' as const,
                        detail: `HTTP ${response.status} ${response.statusText}`,
                    };
                }
                const cacheControl = response.headers.get('cache-control');
                if (want === 'text') {
                    const text = await response.text();
                    return {
                        ok: true as const,
                        cacheControl,
                        text,
                        size: null,
                    };
                }
                const blob = await response.blob();
                try {
                    const bitmap = await createImageBitmap(blob);
                    const size = {
                        width: bitmap.width,
                        height: bitmap.height,
                    };
                    bitmap.close();
                    return {
                        ok: true as const,
                        cacheControl,
                        text: null,
                        size,
                    };
                } catch (error) {
                    return {
                        ok: false as const,
                        reason: 'decode' as const,
                        detail:
                            `${blob.size} byte(s) of ` +
                            `${blob.type || 'an unknown media type'} — ` +
                            `${error instanceof Error ? error.message : String(error)}`,
                    };
                }
            } catch (error) {
                const raised =
                    error instanceof Error ? error : new Error(String(error));
                return {
                    ok: false as const,
                    reason:
                        raised.name === 'TimeoutError'
                            ? ('timeout' as const)
                            : ('blocked' as const),
                    detail: `${raised.name}: ${raised.message}`,
                };
            }
        },
        { target: url, timeoutMs: deadlineMs, want: as }
    )) as BrowserPageProbe;

    return assertCorsReadable(url, probe, prerequisites);
}

export type PageJsonProbe = {
    body: unknown;
    cacheControl: string | null;
};

export async function probeJsonFromPage(
    page: Page,
    url: string,
    deadlineMs: number,
    prerequisites = ''
): Promise<PageJsonProbe> {
    const { text, cacheControl } = await probeFromPage(
        page,
        url,
        deadlineMs,
        'text',
        prerequisites
    );
    try {
        return { body: JSON.parse(text ?? '') as unknown, cacheControl };
    } catch {
        const collapsed = (text ?? '').replace(/\s+/g, ' ').trim();
        throw unusable(
            url,
            'body',
            collapsed.slice(0, 160) || '<empty body>',
            prerequisites
        );
    }
}

export type PageImageProbe = {
    cacheControl: string | null;
    size: DecodedImageSize;
};

export async function probeImageFromPage(
    page: Page,
    url: string,
    deadlineMs: number,
    prerequisites = ''
): Promise<PageImageProbe> {
    const { cacheControl, size } = await probeFromPage(
        page,
        url,
        deadlineMs,
        'image',
        prerequisites
    );
    if (size === null) {
        throw unusable(
            url,
            'decode',
            'the browser produced no bitmap',
            prerequisites
        );
    }
    return { cacheControl, size };
}
