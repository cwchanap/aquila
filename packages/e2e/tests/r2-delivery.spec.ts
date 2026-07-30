import { expect, test, type Page } from '@playwright/test';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    type AssetFormat,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';

/**
 * Acceptance criterion 1 of HPA-229 says *a browser* can fetch the published
 * assets. The shell verifier (`bun --filter @aquila/infra-cloudflare verify`)
 * already proves the headers, the publication layout, and that source objects
 * stay private, but `fetch` in a shell enforces no CORS policy and decodes no
 * images. Those two are all this spec asserts, from a page served by the web
 * app so the delivery host is genuinely cross-origin.
 *
 * The checks need live Cloudflare infrastructure and a seeded release, so they
 * are gated behind R2_LIVE_CHECK and skipped in the default suite — for anyone
 * who has neither they could only ever fail.
 */

const ASSET_BASE = 'https://assets.aquila.cwchanap.dev';
const DELIVERY_BUCKET = 'aquila-vn-delivery';
const STORY_ID = 'the_seventh_mirror';
const PREVIEW_ID = 'smoke';
const TARGET: PublicationTarget = { kind: 'preview', previewId: PREVIEW_ID };

// Any non-empty value enables the check, so `R2_LIVE_CHECK=true` is not a
// silently ignored run.
const LIVE_CHECK_ENABLED = (process.env.R2_LIVE_CHECK ?? '').trim() !== '';

const PREREQUISITES =
    `Requires ${ASSET_BASE} connected as a custom domain of the ` +
    `${DELIVERY_BUCKET} bucket with its CORS policy and cache rules applied, ` +
    `and the "${PREVIEW_ID}" preview release of ${STORY_ID} published ` +
    '(bun --filter @aquila/infra-cloudflare seed).';
const SKIP_REASON = `needs R2_LIVE_CHECK=1 and live infrastructure. ${PREREQUISITES}`;

// Per-request deadlines come from the HPA-227 cache policy so a hung object is
// named in the failure instead of expiring the whole test.
const DEADLINES = RUNTIME_ASSET_CACHE_POLICY.timeoutMs;

function directives(header: string | null): string[] {
    return (header ?? '')
        .split(',')
        .map(part => part.trim().toLowerCase())
        .filter(Boolean);
}

// Read from the contract rather than restated here, and compared as a set so
// any directive order is accepted.
const REQUIRED_POINTER_DIRECTIVES = directives(
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl
);

type FailureReason = 'timeout' | 'blocked' | 'status' | 'body' | 'decode';

/**
 * The browser classifies what went wrong; the sentence an operator reads is
 * composed here, so the in-page code stays small and the wording lives once.
 */
const FAILURE_PHRASES: Record<FailureReason, string> = {
    timeout: 'did not answer in time',
    blocked:
        'was unreadable to page script — a missing ' +
        'access-control-allow-origin, a rejected preflight, or a DNS/TLS ' +
        'failure all look like this',
    status: 'returned an error status',
    body: 'did not return JSON',
    decode: 'returned bytes the browser could not decode as an image',
};

function unusable(url: string, reason: FailureReason, detail: string): Error {
    return new Error(
        `GET ${url} ${FAILURE_PHRASES[reason]}: ${detail}\n${PREREQUISITES}`
    );
}

type DecodedSize = { width: number; height: number };

// This workspace's tsconfig carries no DOM lib, so the browser globals used
// inside page.evaluate are untyped. Only the decoder needs describing, and only
// the members used below.
declare function createImageBitmap(
    blob: Blob
): Promise<DecodedSize & { close(): void }>;

/** Exactly one of `text` and `size` is populated, per the requested `as`. */
type PageProbe = {
    cacheControl: string | null;
    text: string | null;
    size: DecodedSize | null;
};

function assetUrl(objectPath: string): string {
    return `${ASSET_BASE}/${objectPath}`;
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
async function probeFromPage(
    page: Page,
    url: string,
    deadlineMs: number,
    as: 'text' | 'image'
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
    if (!probe.ok) throw unusable(url, probe.reason, probe.detail);
    return probe;
}

type FetchedDocument = { body: unknown; cacheControl: string | null };

async function fetchJsonFromPage(
    page: Page,
    url: string,
    deadlineMs: number
): Promise<FetchedDocument> {
    const { text, cacheControl } = await probeFromPage(
        page,
        url,
        deadlineMs,
        'text'
    );
    try {
        return { body: JSON.parse(text ?? '') as unknown, cacheControl };
    } catch {
        const collapsed = (text ?? '').replace(/\s+/g, ' ').trim();
        throw unusable(url, 'body', collapsed.slice(0, 160) || '<empty body>');
    }
}

/**
 * Decodes the first object of `format` the manifest offers, or returns null
 * when it offers none. The object path is recomputed from the variant digest
 * with the layout helper rather than taken from the manifest verbatim, so a
 * manifest pointing somewhere else could not redirect this fetch.
 */
async function decodeFirstVariant(
    page: Page,
    manifest: RuntimeAssetManifestV1,
    format: AssetFormat
): Promise<DecodedSize | null> {
    for (const asset of manifest.assets) {
        const variant = asset.variants[format];
        if (!variant) continue;
        const url = assetUrl(getObjectPath(variant.sha256, format));
        const { size } = await probeFromPage(
            page,
            url,
            DEADLINES.asset,
            'image'
        );
        if (size === null) {
            throw unusable(url, 'decode', 'the browser produced no bitmap');
        }
        return size;
    }
    return null;
}

test.describe('R2 visual asset delivery', () => {
    test.skip(() => !LIVE_CHECK_ENABLED, SKIP_REASON);

    test('a browser fetches and decodes the seeded release cross-origin', async ({
        page,
    }) => {
        // Four requests, each with its own deadline from the cache policy; the
        // default 30s test budget would expire before the last one could name
        // the object that never answered.
        test.setTimeout(
            DEADLINES.pointer +
                DEADLINES.manifest +
                2 * DEADLINES.asset +
                30_000
        );

        // Requests are issued from the web app's own origin, so the delivery
        // host is cross-origin and its CORS policy is exercised, not bypassed.
        await page.goto('/en/');

        const pointerUrl = assetUrl(getCurrentPointerPath(STORY_ID, TARGET));
        const pointerDocument = await fetchJsonFromPage(
            page,
            pointerUrl,
            DEADLINES.pointer
        );
        const pointer = parseActiveReleasePointer(
            pointerDocument.body,
            TARGET,
            STORY_ID
        );

        const manifestUrl = assetUrl(
            getReleaseManifestPath(STORY_ID, pointer.releaseId, TARGET)
        );
        const manifestDocument = await fetchJsonFromPage(
            page,
            manifestUrl,
            DEADLINES.manifest
        );
        const manifest = parseRuntimeAssetManifest(manifestDocument.body);
        expect(manifest.storyId).toBe(STORY_ID);

        const webp = await decodeFirstVariant(page, manifest, 'webp');
        if (webp === null) {
            throw new Error(
                `${manifestUrl} offers no webp variant, and webp is the ` +
                    'required compatibility path of the delivery contract.'
            );
        }
        expect(webp.width, 'decoded webp width').toBeGreaterThan(0);
        expect(webp.height, 'decoded webp height').toBeGreaterThan(0);

        // AVIF is optional in the contract, so a release without it is
        // recorded rather than failed. Published AVIF bytes must still decode
        // in the browser this spec runs in, which supports AVIF.
        const avif = await decodeFirstVariant(page, manifest, 'avif');
        if (avif === null) {
            test.info().annotations.push({
                type: 'note',
                description: `${manifestUrl} offers no avif variant`,
            });
            return;
        }
        expect(avif.width, 'decoded avif width').toBeGreaterThan(0);
        expect(avif.height, 'decoded avif height').toBeGreaterThan(0);
    });

    test('page script reads the pointer revalidation directives', async ({
        page,
    }) => {
        await page.goto('/en/');

        const pointerUrl = assetUrl(getCurrentPointerPath(STORY_ID, TARGET));
        const { cacheControl } = await fetchJsonFromPage(
            page,
            pointerUrl,
            DEADLINES.pointer
        );

        // A client can only re-read the pointer on every navigation if the
        // revalidation directives survive into page script. The shell verifier
        // sees the same header on the wire; only a browser shows it reaching
        // the code that has to honour it.
        expect(
            directives(cacheControl),
            `cache-control on ${pointerUrl} was "${cacheControl ?? '<missing>'}"`
        ).toEqual(expect.arrayContaining(REQUIRED_POINTER_DIRECTIVES));
    });
});
