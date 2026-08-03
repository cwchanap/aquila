import { expect, test, type Page } from '@playwright/test';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    resolveAssetUrl,
    type AssetFormat,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import {
    cacheDirectives,
    probeImageFromPage,
    probeJsonFromPage,
    type DecodedImageSize,
} from './support/r2-browser-probe';

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

// Playwright's list reporter prints a bare dash for a skipped test and never
// its skip annotation — only the HTML and JSON reporters serialize those. So
// the reason is also written to the console while this file is loaded, which
// every reporter forwards to the terminal. Without this a default-suite run
// would hide why these two tests did nothing.
//
// Only during collection: every worker loads this file too, and TEST_WORKER_INDEX
// is set only in workers, so the guard keeps this to one line per run.
if (!LIVE_CHECK_ENABLED && process.env.TEST_WORKER_INDEX === undefined) {
    console.warn(`[r2-delivery] skipped: ${SKIP_REASON}`);
}

// Per-request deadlines come from the HPA-227 cache policy so a hung object is
// named in the failure instead of expiring the whole test.
const DEADLINES = RUNTIME_ASSET_CACHE_POLICY.timeoutMs;

// Read from the contract rather than restated here, and compared as a set so
// any directive order is accepted.
const REQUIRED_POINTER_DIRECTIVES = cacheDirectives(
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl
);

/**
 * Joins with the sanctioned joiner rather than string concatenation, so the
 * relative path is checked for traversal and the base for scheme and
 * credential-freeness before anything is fetched.
 */
function assetUrl(objectPath: string): string {
    return resolveAssetUrl(ASSET_BASE, objectPath).toString();
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
type DecodedVariant = {
    asset: RuntimeAssetManifestV1['assets'][number];
    format: AssetFormat;
    size: DecodedImageSize;
};

async function decodeAllVariants(
    page: Page,
    manifest: RuntimeAssetManifestV1,
    format: AssetFormat
): Promise<DecodedVariant[]> {
    const decoded: DecodedVariant[] = [];
    for (const asset of manifest.assets) {
        const variant = asset.variants[format];
        if (!variant) continue;
        const url = assetUrl(getObjectPath(variant.sha256, format));
        const { size } = await probeImageFromPage(
            page,
            url,
            DEADLINES.asset,
            PREREQUISITES
        );
        decoded.push({ asset, format, size });
    }
    return decoded;
}

test.describe('R2 visual asset delivery', () => {
    test.skip(() => !LIVE_CHECK_ENABLED, SKIP_REASON);

    test('a browser fetches and decodes the seeded release cross-origin', async ({
        page,
    }) => {
        // Each request has its own deadline from the cache policy; the default
        // 30s test budget would expire before the last one could name the
        // object that never answered. The asset count is not known until the
        // manifest is fetched, so the budget is widened after that fetch to
        // cover every variant decode (webp + avif per asset, worst case).
        test.setTimeout(DEADLINES.pointer + DEADLINES.manifest + 30_000);

        // Requests are issued from the web app's own origin, so the delivery
        // host is cross-origin and its CORS policy is exercised, not bypassed.
        await page.goto('/en/');

        const pointerUrl = assetUrl(getCurrentPointerPath(STORY_ID, TARGET));
        const pointerDocument = await probeJsonFromPage(
            page,
            pointerUrl,
            DEADLINES.pointer,
            PREREQUISITES
        );
        const pointer = parseActiveReleasePointer(
            pointerDocument.body,
            TARGET,
            STORY_ID
        );

        const manifestUrl = assetUrl(
            getReleaseManifestPath(STORY_ID, pointer.releaseId, TARGET)
        );
        const manifestDocument = await probeJsonFromPage(
            page,
            manifestUrl,
            DEADLINES.manifest,
            PREREQUISITES
        );
        const manifest = parseRuntimeAssetManifest(manifestDocument.body);
        expect(manifest.storyId).toBe(STORY_ID);
        // The manifest was fetched from the path the pointer's releaseId names,
        // so a manifest declaring a different release means the two documents
        // disagree about what is live. (The full pairing check needs the
        // manifest byte digest; this is the cheap part of it.)
        expect(
            manifest.releaseId,
            `${manifestUrl} declares a different release than the pointer`
        ).toBe(pointer.releaseId);

        // Now that the asset count is known, widen the budget to cover every
        // variant decode (up to two formats per asset).
        test.setTimeout(
            DEADLINES.pointer +
                DEADLINES.manifest +
                manifest.assets.length * 2 * DEADLINES.asset +
                30_000
        );

        // `variants.webp` is required per asset, so this is reachable only when
        // the release published no assets at all.
        const webpVariants = await decodeAllVariants(page, manifest, 'webp');
        if (webpVariants.length === 0) {
            throw new Error(
                `${manifestUrl} published no assets, so there is nothing for ` +
                    'a browser to decode.'
            );
        }
        // The reader rejects an image whose decoded dimensions differ from
        // asset.width / asset.height ("Asset dimensions mismatch" in
        // decoded-asset-cache.ts). A manifest with an incorrect width or height
        // can pass checksum validation and still decode, so the decoded bitmap
        // is compared against the manifest dimensions for every asset — not
        // just the first, and not merely asserted to be greater than zero.
        for (const { asset, size } of webpVariants) {
            const label = `${asset.identity.type}/${asset.identity.key}`;
            expect(
                size.width,
                `decoded webp width for ${label} must match manifest`
            ).toBe(asset.width);
            expect(
                size.height,
                `decoded webp height for ${label} must match manifest`
            ).toBe(asset.height);
        }

        // AVIF is optional per asset in the HPA-227 schema, but `image/avif`
        // content-type is an enumerated HPA-229 acceptance criterion (design
        // check 3) and the shell verifier hard-fails a release that offers no
        // avif. This live check must agree: a smoke release with no avif
        // variant fails here too, so the seeder or publisher stopping avif
        // emission cannot pass both verification paths. Published AVIF bytes
        // must still decode in the browser this spec runs in, which supports
        // AVIF, and their decoded dimensions must match the manifest just as
        // WebP's do.
        const avifVariants = await decodeAllVariants(page, manifest, 'avif');
        expect(
            avifVariants.length,
            `${manifestUrl} offers no avif variant — image/avif is an HPA-229 acceptance criterion`
        ).toBeGreaterThan(0);
        for (const { asset, size } of avifVariants) {
            const label = `${asset.identity.type}/${asset.identity.key}`;
            expect(
                size.width,
                `decoded avif width for ${label} must match manifest`
            ).toBe(asset.width);
            expect(
                size.height,
                `decoded avif height for ${label} must match manifest`
            ).toBe(asset.height);
        }
    });

    test('page script reads the pointer revalidation directives', async ({
        page,
    }) => {
        await page.goto('/en/');

        const pointerUrl = assetUrl(getCurrentPointerPath(STORY_ID, TARGET));
        const { cacheControl } = await probeJsonFromPage(
            page,
            pointerUrl,
            DEADLINES.pointer,
            PREREQUISITES
        );

        // A client can only re-read the pointer on every navigation if the
        // revalidation directives survive into page script. The shell verifier
        // sees the same header on the wire; only a browser shows it reaching
        // the code that has to honour it.
        //
        // Compared as a sorted multiset (not a Set): the contract is exactly
        // these directives in any order, so an extra `immutable` or `s-maxage`
        // on the pointer — which would defeat revalidation — has to fail here,
        // and a duplicate `max-age=0` has to fail too. A `Set` would silently
        // dedupe the duplicate and let it pass; a sorted array keeps every
        // token, matching the shell verifier's `assertPointerRevalidation`.
        expect(
            [...cacheDirectives(cacheControl)].sort(),
            `cache-control on ${pointerUrl} was "${cacheControl ?? '<missing>'}"`
        ).toEqual([...REQUIRED_POINTER_DIRECTIVES].sort());
    });
});
