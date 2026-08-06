import type { Page } from '@playwright/test';
import {
    getObjectPath,
    resolveAssetUrl,
    type AssetFormat,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';

/**
 * Page-side browser probes shared by the delivery specs. The checks need a
 * real browser: `fetch` in a shell enforces no CORS policy and decodes no
 * images. Each helper runs inside the page under test so the browser's own
 * CORS enforcement and image pipeline decide whether the bytes are usable.
 *
 * Spec-specific constants (the delivery host, deadlines, and the human
 * prerequisite sentence) are threaded in as parameters so the helpers stay
 * pure — `r2-delivery.spec.ts` and the release-gate spec each supply their
 * own.
 */

export type FailureReason =
    | 'timeout'
    | 'blocked'
    | 'status'
    | 'body'
    | 'decode';

/**
 * The browser classifies what went wrong; the sentence an operator reads is
 * composed here, so the in-page code stays small and the wording lives once.
 */
export const FAILURE_PHRASES: Record<FailureReason, string> = {
    timeout: 'did not answer in time',
    blocked:
        'was unreadable to page script — a missing ' +
        'access-control-allow-origin, a rejected preflight, or a DNS/TLS ' +
        'failure all look like this',
    status: 'returned an error status',
    body: 'did not return JSON',
    decode: 'returned bytes the browser could not decode as an image',
};

/** Everything the probe helpers need that is spec-specific. */
export type ProbeContext = {
    /** Delivery host joined with object paths (e.g. https://assets.example.dev). */
    assetBase: string;
    /** Per-request deadline for one asset fetch/decode. */
    assetDeadlineMs: number;
    /**
     * Human sentence describing what the spec requires; appended to every
     * failure so an operator never reads an unexplained probe error.
     */
    prerequisites: string;
};

export type DecodedSize = { width: number; height: number };

// This workspace's tsconfig carries no DOM lib, so the browser globals used
// inside page.evaluate are untyped. Only the decoder needs describing, and only
// the members used below.
declare function createImageBitmap(
    blob: Blob
): Promise<DecodedSize & { close(): void }>;

/** Exactly one of `text` and `size` is populated, per the requested `as`. */
export type PageProbe = {
    cacheControl: string | null;
    text: string | null;
    size: DecodedSize | null;
};

export function directives(header: string | null): string[] {
    return (header ?? '')
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean);
}

export function unusable(
    url: string,
    reason: FailureReason,
    detail: string,
    prerequisites: string
): Error {
    return new Error(
        `GET ${url} ${FAILURE_PHRASES[reason]}: ${detail}\n${prerequisites}`
    );
}

/**
 * Joins with the sanctioned joiner rather than string concatenation, so the
 * relative path is checked for traversal and the base for scheme and
 * credential-freeness before anything is fetched.
 */
export function assetUrl(assetBase: string, objectPath: string): string {
    return resolveAssetUrl(assetBase, objectPath).toString();
}

/**
 * Fetches one object from inside the page, so the browser's own CORS
 * enforcement decides whether page script may read it, and — for `as: 'image'`
 * — the browser's own image pipeline decides whether the bytes decode. A shell
 * probe can do neither.
 *
 * `cache-control` is a CORS-safelisted response header, so it comes back
 * without any access-control-expose-headers cooperation.
 */
export async function probeFromPage(
    page: Page,
    url: string,
    deadlineMs: number,
    as: 'text' | 'image',
    context: ProbeContext
): Promise<PageProbe> {
    const probe = await page.evaluate(
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
    );
    if (!probe.ok)
        throw unusable(url, probe.reason, probe.detail, context.prerequisites);
    return probe;
}

export type FetchedDocument = { body: unknown; cacheControl: string | null };

export async function fetchJsonFromPage(
    page: Page,
    url: string,
    deadlineMs: number,
    context: ProbeContext
): Promise<FetchedDocument> {
    const { text, cacheControl } = await probeFromPage(
        page,
        url,
        deadlineMs,
        'text',
        context
    );
    try {
        return { body: JSON.parse(text ?? '') as unknown, cacheControl };
    } catch {
        const collapsed = (text ?? '').replace(/\s+/g, ' ').trim();
        throw unusable(
            url,
            'body',
            collapsed.slice(0, 160) || '<empty body>',
            context.prerequisites
        );
    }
}

/**
 * Decodes every asset's variant of `format` the manifest offers, returning each
 * decoded bitmap alongside its manifest asset so the caller can compare the
 * decoded dimensions against `asset.width` / `asset.height` — the same contract
 * the reader enforces in `decoded-asset-cache.ts` ("Asset dimensions mismatch"
 * when the decoded size differs from the manifest). The object path is
 * recomputed from the variant digest with the layout helper rather than taken
 * from the manifest verbatim, so a manifest pointing somewhere else could not
 * redirect this fetch.
 *
 * A manifest with an incorrect width or height can pass pointer integrity,
 * object checksum validation, and browser decoding while the actual reader
 * rejects it — so decoding only the first variant and asserting `> 0` (as this
 * spec once did) is not enough. Every seeded asset is decoded and its
 * dimensions checked against the manifest.
 */
export type DecodedVariant = {
    asset: RuntimeAssetManifestV1['assets'][number];
    format: AssetFormat;
    size: DecodedSize;
};

export async function decodeAllVariants(
    page: Page,
    manifest: RuntimeAssetManifestV1,
    format: AssetFormat,
    context: ProbeContext
): Promise<DecodedVariant[]> {
    const decoded: DecodedVariant[] = [];
    for (const asset of manifest.assets) {
        const variant = asset.variants[format];
        if (!variant) continue;
        const url = assetUrl(
            context.assetBase,
            getObjectPath(variant.sha256, format)
        );
        const { size } = await probeFromPage(
            page,
            url,
            context.assetDeadlineMs,
            'image',
            context
        );
        if (size === null) {
            throw unusable(
                url,
                'decode',
                'the browser produced no bitmap',
                context.prerequisites
            );
        }
        decoded.push({ asset, format, size });
    }
    return decoded;
}
