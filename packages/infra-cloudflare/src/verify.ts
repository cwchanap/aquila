import { createHash } from 'node:crypto';
import {
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    validatePointerManifestPair,
    type ActiveReleasePointerV1,
    type AssetFormat,
    type ManifestByteSha256,
    type ReleaseContentSha256,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import {
    assertContentType,
    assertImmutable,
    assertPointerRevalidation,
    findForbiddenKeys,
    type CheckResult,
} from './assertions';
import { loadR2DeliveryConfig } from './config';
import { summarize, type ManifestVariant } from './documents';

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_ID = 'smoke';
const TARGET = { kind: 'preview', previewId: PREVIEW_ID } as const;
// Stands in for the web app origin a browser would send, so the delivery host's
// CORS policy is exercised rather than bypassed. Exported so the CORS tests use
// the same value the verifier probes with.
export const ORIGIN = 'https://aquila.cwchanap.dev';
// An authoring key from the private source bucket. There is deliberately no
// path helper for source keys — they are not part of the public publication
// layout. Probing the delivery host for this key proves it was not copied into
// the delivery bucket; it does NOT prove the source bucket itself is private.
// Source-bucket privacy (no r2.dev URL, no custom domain) is a separate
// infrastructure configuration check that requires authenticated access to the
// R2 API, and is documented as a manual acceptance step in the runbook.
const SOURCE_PROBE_KEY =
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png';
const MIME_TYPES: Record<AssetFormat, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
};
const CACHE_HIT_ATTEMPTS = 4;
const CACHE_HIT_DELAY_MS = 1000;
// Per-request deadline covering both header arrival and body consumption. A
// connection that accepts the request but never returns headers — or returns
// headers and stalls the body — would otherwise block the sequential run
// forever instead of producing a failed check. The signal is passed to `fetch`
// so the abort covers the body read too (the response stream is tied to the
// fetch signal); the timer is unref'd so a response already consumed does not
// keep the process alive waiting for a deadline that has nothing left to abort.
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
let requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS;

/** @internal Overrides the per-request deadline for tests. */
export function _setRequestTimeout(ms: number): void {
    requestTimeoutMs = ms;
}

function deadlineSignal(): AbortSignal {
    const controller = new AbortController();
    const timer = setTimeout(
        () =>
            controller.abort(
                new Error(`request timed out after ${requestTimeoutMs}ms`)
            ),
        requestTimeoutMs
    );
    timer.unref?.();
    return controller.signal;
}

/**
 * Raised when a fetch the remaining checks depend on cannot be evaluated, so
 * the run reports one comprehensible failure instead of cascading noise.
 */
class CheckAborted extends Error {
    constructor(
        readonly check: string,
        readonly detail: string
    ) {
        super(`${check}: ${detail}`);
        this.name = 'CheckAborted';
    }
}

function describeError(error: unknown): string {
    if (!(error instanceof Error)) return String(error);
    const cause =
        error.cause instanceof Error ? ` (${error.cause.message})` : '';
    return `${error.message}${cause}`;
}

/**
 * SHA-256 of a UTF-8 string, returned as lowercase hex. Mirrors the reader's
 * `sha256Utf8Text` so the verifier computes the same digest the reader compares
 * against `pointer.manifestSha256` and the canonical release-content digest.
 */
function sha256Hex(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/**
 * SHA-256 of an object's raw bytes, returned as lowercase hex. Mirrors the
 * reader's `sha256Hex(bytes)` so the verifier computes the same digest the
 * reader compares against `variant.sha256` before decoding an image.
 */
function sha256HexBytes(bytes: ArrayBuffer | Uint8Array): string {
    return createHash('sha256')
        .update(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes)
        .digest('hex');
}

/**
 * Runs `assertion` and converts a thrown error into a failed CheckResult so a
 * contract failure is reported as a check line rather than crashing the run.
 * Returns `true` when the assertion passed.
 */
function runIntegrityCheck(
    name: string,
    assertion: () => void,
    results: CheckResult[]
): boolean {
    try {
        assertion();
        results.push({ name, ok: true, detail: 'accepted' });
        return true;
    } catch (error) {
        results.push({ name, ok: false, detail: describeError(error) });
        return false;
    }
}

function delay(milliseconds: number): Promise<void> {
    return new Promise(done => setTimeout(done, milliseconds));
}

type RequestOutcome =
    | { ok: true; response: Response }
    | { ok: false; detail: string };

/**
 * Indirection so tests can substitute a fake `fetch` and exercise `runChecks`
 * against fixture documents without touching the network. The CLI path uses
 * the global `fetch`.
 */
let fetchImpl: typeof fetch = fetch;

/** @internal Replaces the fetch implementation used by `runChecks`. */
export function _setFetchImpl(impl: typeof fetch): void {
    fetchImpl = impl;
}

/**
 * Only unauthenticated public requests are made: the verifier proves what any
 * browser sees, so it must never hold an R2 credential or Cloudflare token.
 * A transport failure is returned rather than thrown so a single unreachable
 * object cannot hide the checks that follow it.
 */
async function request(
    url: string,
    headers: Record<string, string> = {}
): Promise<RequestOutcome> {
    try {
        return {
            ok: true,
            response: await fetchImpl(url, {
                headers,
                signal: deadlineSignal(),
            }),
        };
    } catch (error) {
        return { ok: false, detail: describeError(error) };
    }
}

type JsonDocument = { response: Response; body: unknown; text: string };

async function requireJsonDocument(
    url: string,
    check: string
): Promise<JsonDocument> {
    const outcome = await request(url, { origin: ORIGIN });
    if (!outcome.ok) {
        throw new CheckAborted(check, `GET ${url} failed: ${outcome.detail}`);
    }
    const { response } = outcome;
    if (response.status !== 200) {
        throw new CheckAborted(
            check,
            `GET ${url} returned HTTP ${response.status}`
        );
    }
    let text: string;
    try {
        text = await response.text();
    } catch (error) {
        throw new CheckAborted(
            check,
            `reading ${url} failed: ${describeError(error)}`
        );
    }
    try {
        return { response, body: JSON.parse(text) as unknown, text };
    } catch {
        throw new CheckAborted(
            check,
            `GET ${url} did not return JSON: ${summarize(text)}`
        );
    }
}

function named(
    name: string,
    assertion: { ok: boolean; detail: string }
): CheckResult {
    return { name, ...assertion };
}

async function checkObject(
    base: string,
    objectPath: string,
    format: AssetFormat,
    variant: ManifestVariant,
    label: string,
    results: CheckResult[]
): Promise<void> {
    const outcome = await request(`${base}/${objectPath}`, { origin: ORIGIN });
    if (!outcome.ok) {
        results.push({
            name: `${format} ${label} object`,
            ok: false,
            detail: `GET ${objectPath} failed: ${outcome.detail}`,
        });
        return;
    }
    if (outcome.response.status !== 200) {
        results.push({
            name: `${format} ${label} object`,
            ok: false,
            detail: `GET ${objectPath} returned HTTP ${outcome.response.status}`,
        });
        return;
    }
    const { headers } = outcome.response;
    results.push(
        named(
            `${format} ${label} content-type`,
            assertContentType(headers.get('content-type'), MIME_TYPES[format])
        )
    );
    results.push(
        named(
            `${format} ${label} immutable`,
            assertImmutable(headers.get('cache-control'))
        )
    );

    // The reader verifies the object's byte length and SHA-256 against the
    // manifest variant before it decodes the image (decoded-asset-cache.ts).
    // A content-addressed object can be overwritten or corrupted while keeping
    // valid image headers — and potentially remaining decodable — so checking
    // only status and headers would let a release the reader rejects pass the
    // verifier. Read the body and run the same two integrity checks the reader
    // does, so a release the reader rejects cannot pass verification.
    let bytes: ArrayBuffer;
    try {
        bytes = await outcome.response.arrayBuffer();
    } catch (error) {
        results.push({
            name: `${format} ${label} object bytes`,
            ok: false,
            detail: `reading ${objectPath} body failed: ${describeError(error)}`,
        });
        return;
    }
    const byteLengthOk = bytes.byteLength === variant.byteLength;
    results.push({
        name: `${format} ${label} object byte length`,
        ok: byteLengthOk,
        detail: `body is ${bytes.byteLength} bytes (manifest declares ${variant.byteLength})`,
    });
    if (!byteLengthOk) return;
    const digest = sha256HexBytes(bytes);
    const checksumOk = digest === variant.sha256;
    results.push({
        name: `${format} ${label} object checksum`,
        ok: checksumOk,
        detail: `sha256(body): ${digest} (manifest declares ${variant.sha256})`,
    });
}

/**
 * Cache HIT is corroboration, not the binding criterion: sequential requests
 * can land on different colos and cache fill is asynchronous, so this is
 * reported as a warning and never fails the run. The Origin header is
 * deliberately omitted — a CORS-varying response makes repeated probes less
 * likely to share one cache entry.
 */
async function checkCacheHit(
    base: string,
    objectPath: string
): Promise<CheckResult> {
    const observed: string[] = [];
    for (let attempt = 0; attempt < CACHE_HIT_ATTEMPTS; attempt += 1) {
        const outcome = await request(`${base}/${objectPath}`);
        if (!outcome.ok) {
            return {
                name: 'object cache hit',
                ok: false,
                detail: `GET ${objectPath} failed: ${outcome.detail}`,
                warning: true,
            };
        }
        observed.push(
            outcome.response.headers.get('cf-cache-status') ?? '<missing>'
        );
        if (observed.at(-1) === 'HIT') break;
        if (attempt < CACHE_HIT_ATTEMPTS - 1) await delay(CACHE_HIT_DELAY_MS);
    }
    return {
        name: 'object cache hit',
        ok: observed.at(-1) === 'HIT',
        detail: `cf-cache-status: ${observed.join(' -> ')} over ${observed.length} request(s)`,
        warning: true,
    };
}

async function checkSourceKeyAbsentFromDelivery(
    base: string
): Promise<CheckResult> {
    const outcome = await request(`${base}/${SOURCE_PROBE_KEY}`);
    if (!outcome.ok) {
        return {
            name: 'source key absent from delivery bucket',
            ok: false,
            detail: `GET ${SOURCE_PROBE_KEY} failed: ${outcome.detail}`,
        };
    }
    const { status } = outcome.response;
    // Only 404 is a definitive absence response on a world-readable delivery
    // host. A 403 is ambiguous — an object present but blocked from being
    // served would also answer 403 — so it must not be blessed as "absent".
    return {
        name: 'source key absent from delivery bucket',
        ok: status === 404,
        detail: `HTTP ${status} for ${SOURCE_PROBE_KEY} on the delivery host (expected 404)`,
    };
}

function checkForbiddenKeys(
    documents: Array<{ label: string; body: unknown }>
): CheckResult {
    const forbidden = documents.flatMap(({ label, body }) =>
        findForbiddenKeys(body).map(path => `${label}.${path}`)
    );
    return {
        name: 'no forbidden keys in public json',
        ok: forbidden.length === 0,
        detail: forbidden.length > 0 ? forbidden.join(', ') : 'clean',
    };
}

export async function runChecks(
    base: string,
    results: CheckResult[]
): Promise<void> {
    const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
    const pointer = await requireJsonDocument(
        `${base}/${pointerPath}`,
        'pointer fetch'
    );
    const pointerHeaders = pointer.response.headers;
    results.push(
        named(
            'pointer content-type',
            assertContentType(
                pointerHeaders.get('content-type'),
                'application/json'
            )
        )
    );
    results.push(
        named(
            'pointer revalidation',
            assertPointerRevalidation(pointerHeaders.get('cache-control'))
        )
    );
    // The pointer rule bypasses the edge cache (`cache: false`), so an
    // edge-cached pointer means the rule is missing or no longer matching and
    // a published release can go unseen — this deployment served `current.json`
    // as a cache HIT for two hours while carrying the correct revalidation
    // headers, and every other check passed. A cached response always carries
    // `age`; `DYNAMIC`/`BYPASS` with no `age` means the edge never stored it.
    // `HIT`/`MISS`/`EXPIRED`/`REVALIDATED` on the pointer therefore fails the
    // run, not merely warns (runbook §5).
    const cacheStatus = pointerHeaders.get('cf-cache-status')?.toUpperCase();
    const age = pointerHeaders.get('age');
    const edgeBypassed =
        (cacheStatus === 'DYNAMIC' || cacheStatus === 'BYPASS') && age === null;
    results.push({
        name: 'pointer edge bypass',
        ok: edgeBypassed,
        detail: `cf-cache-status: ${cacheStatus ?? '<missing>'} (age: ${age ?? '<none>'})`,
    });
    // A browser running from `ORIGIN` can only read the pointer when the
    // response carries `*`. Checking only for the header's presence would let
    // an unrelated allow-origin (e.g. `https://wrong.example`) pass the
    // verifier while every real browser blocked the read — the shell verifier
    // must not rely on the manually gated `R2_LIVE_CHECK` e2e suite to catch
    // an invalid CORS policy. The wildcard is the only valid policy for this
    // delivery host: an exact allowlist cannot cover ephemeral `*.vercel.app`
    // preview origins, so the production origin is not an acceptable
    // substitute — the committed config and the runbook both require `*`.
    const allowOrigin = pointerHeaders.get('access-control-allow-origin');
    const corsOk = allowOrigin === '*';
    results.push({
        name: 'pointer CORS',
        ok: corsOk,
        detail: `access-control-allow-origin: ${allowOrigin ?? '<missing>'} (contract requires *)`,
    });

    // Parse the pointer with the same contract parser the reader uses
    // (web-asset-resolver.ts). A pointer that fails this is one the reader
    // rejects, so the verifier must reject it too — previously the verifier
    // only spot-checked `releaseId` and `manifestPath` with `readString`, which
    // a tampered pointer carrying a valid first field could pass.
    let pointerParsed: ActiveReleasePointerV1;
    try {
        pointerParsed = parseActiveReleasePointer(
            pointer.body,
            TARGET,
            STORY_ID
        );
        results.push({
            name: 'pointer contract',
            ok: true,
            detail: 'accepted',
        });
    } catch (error) {
        results.push({
            name: 'pointer contract',
            ok: false,
            detail: describeError(error),
        });
        throw new CheckAborted(
            'pointer contract',
            'pointer failed contract parsing (dependent checks skipped)'
        );
    }

    // The manifest URL is computed from the layout helper, never taken from the
    // pointer verbatim, and the pointer is then held to that same path — the
    // agreement a runtime client depends on.
    let manifestPath: string;
    try {
        manifestPath = getReleaseManifestPath(
            STORY_ID,
            pointerParsed.releaseId,
            TARGET
        );
    } catch (error) {
        throw new CheckAborted(
            'pointer releaseId',
            `${pointerPath} carries an unusable releaseId ${pointerParsed.releaseId}: ${describeError(error)}`
        );
    }
    results.push({
        name: 'pointer manifestPath matches publication layout',
        ok: pointerParsed.manifestPath === manifestPath,
        detail: `manifestPath: ${pointerParsed.manifestPath} (expected ${manifestPath})`,
    });

    const manifest = await requireJsonDocument(
        `${base}/${manifestPath}`,
        'manifest fetch'
    );
    const manifestHeaders = manifest.response.headers;
    results.push(
        named(
            'manifest content-type',
            assertContentType(
                manifestHeaders.get('content-type'),
                'application/json'
            )
        )
    );
    results.push(
        named(
            'manifest immutable',
            assertImmutable(manifestHeaders.get('cache-control'))
        )
    );
    // The immutable cache rule has two branches — `/vn/objects/*` and
    // `*/runtime-manifest.json`. JSON is not edge-cached by default on
    // Cloudflare, so the manifest's cacheability is entirely the rule's doing:
    // remove or break only the manifest branch and every object check still
    // passes, including the object cache-HIT probe, while release manifests go
    // uncached. The manifest's `cf-cache-status` on this initial response is
    // therefore a hard check, not corroboration: a cacheable state (MISS, HIT,
    // EXPIRED, REVALIDATED) means the rule matched, while DYNAMIC, BYPASS, or a
    // missing header means it did not. This mirrors the pointer's edge-bypass
    // check in the opposite direction — there a cached state fails, here an
    // uncached state fails.
    const manifestCacheStatus = manifestHeaders
        .get('cf-cache-status')
        ?.toUpperCase();
    const manifestCacheEligible =
        manifestCacheStatus === 'MISS' ||
        manifestCacheStatus === 'HIT' ||
        manifestCacheStatus === 'EXPIRED' ||
        manifestCacheStatus === 'REVALIDATED';
    results.push({
        name: 'manifest edge cache eligible',
        ok: manifestCacheEligible,
        detail: `cf-cache-status: ${manifestCacheStatus ?? '<missing>'}`,
    });

    // The manifest byte digest must match the pointer's `manifestSha256` — the
    // same check the reader makes before it trusts the manifest. Without it a
    // manifest edited after publication (but with a valid first webp/avif
    // entry) could pass every other check while the reader rejects it with
    // "Manifest checksum mismatch".
    const manifestByteDigest = assertSha256<'manifest-bytes'>(
        sha256Hex(manifest.text)
    ) as ManifestByteSha256;
    const checksumMatches = manifestByteDigest === pointerParsed.manifestSha256;
    results.push({
        name: 'manifest checksum matches pointer',
        ok: checksumMatches,
        detail: `sha256(manifest bytes): ${manifestByteDigest} (pointer.manifestSha256: ${pointerParsed.manifestSha256})`,
    });
    if (!checksumMatches) {
        throw new CheckAborted(
            'manifest checksum',
            'manifest bytes do not match pointer.manifestSha256 (dependent checks skipped)'
        );
    }

    // Parse the manifest with the reader's contract parser, then validate the
    // pointer/manifest pair and re-derive the releaseId from canonical manifest
    // content. These are the integrity checks that make the verifier's verdict
    // match the reader's: a release the reader rejects cannot pass the verifier.
    let manifestParsed: RuntimeAssetManifestV1;
    try {
        manifestParsed = parseRuntimeAssetManifest(manifest.body);
        results.push({
            name: 'manifest contract',
            ok: true,
            detail: 'accepted',
        });
    } catch (error) {
        results.push({
            name: 'manifest contract',
            ok: false,
            detail: describeError(error),
        });
        throw new CheckAborted(
            'manifest contract',
            'manifest failed contract parsing (dependent checks skipped)'
        );
    }
    if (
        !runIntegrityCheck(
            'pointer/manifest pair',
            () => {
                validatePointerManifestPair(
                    pointerParsed,
                    manifestParsed,
                    manifestByteDigest
                );
            },
            results
        )
    ) {
        throw new CheckAborted(
            'pointer/manifest pair',
            'pair validation failed (dependent checks skipped)'
        );
    }
    if (
        !runIntegrityCheck(
            'releaseId matches canonical content',
            () => {
                const canonicalDigest = assertSha256<'release-content'>(
                    sha256Hex(canonicalReleaseContent(manifestParsed))
                ) as ReleaseContentSha256;
                assertReleaseIdMatchesContentSha256(
                    manifestParsed,
                    canonicalDigest
                );
            },
            results
        )
    ) {
        throw new CheckAborted(
            'releaseId',
            'releaseId does not match canonical content digest (dependent checks skipped)'
        );
    }

    // Verify every present variant of every asset, not just the first usable
    // one per format. `findVariant` returned the first usable variant, so a
    // release with N assets checked only one WebP and one AVIF object — a
    // later portrait or background that was missing, corrupted, or carried a
    // bad checksum passed verification while the reader rejected it. Objects
    // are content-addressed, so two assets referencing the same digest share
    // one object: deduplicate by (format, sha256) so each unique object is
    // fetched and checked once, and a release with N assets is checked against
    // up to N objects per format. The check names carry the first 16 hex of the
    // object's sha256 so an operator can map a failed line back to the asset,
    // and two distinct objects of the same format cannot produce duplicate
    // names (results are looked up by name).
    //
    // The dedupe key is (format, sha256), but two manifest entries may legally
    // reference the same digest while declaring different metadata. The
    // manifest schema validates that each path matches the digest and that
    // byteLength is positive, but it does not enforce consistent byte lengths
    // or dimensions across references sharing a digest. The reader checks
    // bytes.byteLength against each asset's variant.byteLength before decoding
    // (decoded-asset-cache.ts), so a second asset declaring a different
    // byteLength for an already-fetched object is rejected at runtime. A Set
    // would skip the second reference entirely and let that pass the verifier;
    // a Map records the first reference's metadata and compares every later
    // reference against it, failing on disagreement.
    const verifiedObjects = new Map<
        string,
        { byteLength: number; path: string; width: number; height: number }
    >();
    let cacheProbePath: string | null = null;
    let offeredWebp = false;
    let offeredAvif = false;
    for (const [index, asset] of manifestParsed.assets.entries()) {
        for (const format of ['webp', 'avif'] as const) {
            const variant = asset.variants[format];
            if (!variant) continue;
            if (format === 'webp') offeredWebp = true;
            else offeredAvif = true;

            const dedupeKey = `${format}:${variant.sha256}`;
            const label = variant.sha256.slice(0, 16);
            const prior = verifiedObjects.get(dedupeKey);
            if (prior !== undefined) {
                // Same digest, same format — the object is fetched once, but
                // every manifest reference must agree on the metadata the
                // reader will check against the fetched bytes. byteLength and
                // path are variant-level; width and height are asset-level
                // but must also match, since identical bytes decode to
                // identical dimensions.
                const conflicts: string[] = [];
                if (prior.byteLength !== variant.byteLength) {
                    conflicts.push(
                        `byteLength ${variant.byteLength} (was ${prior.byteLength})`
                    );
                }
                if (prior.path !== variant.path) {
                    conflicts.push(`path ${variant.path} (was ${prior.path})`);
                }
                if (prior.width !== asset.width) {
                    conflicts.push(`width ${asset.width} (was ${prior.width})`);
                }
                if (prior.height !== asset.height) {
                    conflicts.push(
                        `height ${asset.height} (was ${prior.height})`
                    );
                }
                results.push({
                    name: `${format} ${label} object reference consistent`,
                    ok: conflicts.length === 0,
                    detail:
                        conflicts.length === 0
                            ? `assets.${index} agrees with the first reference to ${variant.sha256}`
                            : `assets.${index} disagrees with the first reference to ${variant.sha256}: ${conflicts.join(', ')}`,
                });
                continue;
            }
            verifiedObjects.set(dedupeKey, {
                byteLength: variant.byteLength,
                path: variant.path,
                width: asset.width,
                height: asset.height,
            });

            let objectPath: string;
            try {
                objectPath = getObjectPath(
                    assertSha256<'object-content'>(variant.sha256),
                    format
                );
            } catch (error) {
                results.push({
                    name: `${format} ${label} object`,
                    ok: false,
                    detail: `assets.${index} ${format} sha256 ${variant.sha256} is unusable: ${describeError(error)}`,
                });
                continue;
            }
            results.push({
                name: `${format} ${label} object path is content-addressed`,
                ok: variant.path === objectPath,
                detail: `path: ${variant.path} (expected ${objectPath})`,
            });
            cacheProbePath ??= objectPath;
            await checkObject(
                base,
                objectPath,
                format,
                {
                    path: variant.path,
                    sha256: variant.sha256,
                    byteLength: variant.byteLength,
                },
                label,
                results
            );
        }
    }

    // webp is required per asset in the contract, so an absent webp means the
    // release published no assets at all. avif is optional per asset in the
    // HPA-227 schema, but `image/avif` content-type is an enumerated
    // acceptance criterion for HPA-229 (design check 3) and the only check
    // that can prove a release serves a real AVIF object. A release that
    // offers no avif therefore hard-fails — downgrading it to a warning would
    // let the only evidence for that criterion disappear without anyone
    // noticing (runbook §"The seeder must emit AVIF"). The runbook is
    // authoritative here: the per-asset optionality in the schema does not
    // override the release-level acceptance requirement.
    if (!offeredWebp) {
        results.push({
            name: 'webp object',
            ok: false,
            detail: `no webp variant among ${manifestParsed.assets.length} asset(s) in ${manifestPath}`,
        });
    }
    if (!offeredAvif) {
        results.push({
            name: 'avif object',
            ok: false,
            detail: `no avif variant among ${manifestParsed.assets.length} asset(s) in ${manifestPath} — image/avif is an HPA-229 acceptance criterion`,
        });
    }

    if (cacheProbePath !== null) {
        results.push(await checkCacheHit(base, cacheProbePath));
    }
    results.push(await checkSourceKeyAbsentFromDelivery(base));
    results.push(
        checkForbiddenKeys([
            { label: 'pointer', body: pointer.body },
            { label: 'manifest', body: manifest.body },
        ])
    );
}

/**
 * Sets `exitCode` rather than calling `process.exit`, which can truncate
 * buffered stdout when it is a pipe — exactly the CI log capture where an
 * operator needs the check lines most.
 */
function report(results: CheckResult[]): void {
    let failed = 0;
    for (const result of results) {
        const label = result.ok ? 'PASS' : result.warning ? 'WARN' : 'FAIL';
        if (!result.ok && !result.warning) failed += 1;
        console.log(`${label}  ${result.name} — ${result.detail}`);
    }
    if (failed > 0) {
        console.error(`\n${failed} check(s) failed.`);
        process.exitCode = 1;
        return;
    }
    console.log('\nAll required checks passed.');
}

async function main(): Promise<void> {
    const config = await loadR2DeliveryConfig();
    const base = `https://${config.hostname}`;
    const results: CheckResult[] = [];
    console.log(
        `Verifying ${base} — story ${STORY_ID}, preview ${PREVIEW_ID}\n`
    );
    try {
        await runChecks(base, results);
    } catch (error) {
        if (!(error instanceof CheckAborted)) throw error;
        results.push({
            name: error.check,
            ok: false,
            detail: `${error.detail} (dependent checks skipped)`,
        });
    }
    report(results);
}

// Entry-point guard, intentionally false whenever this module is imported
// (including by tests); the true branch is exercised by `bun src/verify.ts`.
// `import.meta.main` is a Bun extension, so it is read through a narrow cast
// rather than depending on Bun's type definitions here.
/* v8 ignore next */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    try {
        await main();
    } catch (error) {
        console.error(`Verification could not run: ${describeError(error)}`);
        process.exitCode = 1;
    }
}
