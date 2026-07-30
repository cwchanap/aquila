import {
    assertSha256,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    type AssetFormat,
} from '@aquila/stories/runtime-assets';
import {
    assertContentType,
    assertImmutable,
    assertPointerRevalidation,
    findForbiddenKeys,
    type CheckResult,
} from './assertions';
import { loadR2DeliveryConfig } from './config';

const STORY_ID = 'the_seventh_mirror';
const PREVIEW_ID = 'smoke';
const TARGET = { kind: 'preview', previewId: PREVIEW_ID } as const;
// Stands in for the web app origin a browser would send, so the delivery host's
// CORS policy is exercised rather than bypassed.
const ORIGIN = 'https://aquila.cwchanap.dev';
// An authoring key from the private source bucket. There is deliberately no
// path helper for source keys — they are not part of the public publication
// layout, which is exactly what this probe proves.
const SOURCE_PROBE_KEY =
    'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png';
const MIME_TYPES: Record<AssetFormat, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
};
const CACHE_HIT_ATTEMPTS = 4;
const CACHE_HIT_DELAY_MS = 1000;

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

function summarize(body: string): string {
    const collapsed = body.replace(/\s+/g, ' ').trim();
    return collapsed.length > 120
        ? `${collapsed.slice(0, 120)}...`
        : collapsed || '<empty body>';
}

function delay(milliseconds: number): Promise<void> {
    return new Promise(done => setTimeout(done, milliseconds));
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function readString(value: unknown, key: string): string | null {
    const field = asRecord(value)?.[key];
    return typeof field === 'string' ? field : null;
}

type RequestOutcome =
    | { ok: true; response: Response }
    | { ok: false; detail: string };

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
        return { ok: true, response: await fetch(url, { headers }) };
    } catch (error) {
        return { ok: false, detail: describeError(error) };
    }
}

type JsonDocument = { response: Response; body: unknown };

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
        return { response, body: JSON.parse(text) as unknown };
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

type ManifestVariant = { path: string; sha256: string };

function findVariant(
    manifestBody: unknown,
    format: AssetFormat
): ManifestVariant | null {
    const assets = asRecord(manifestBody)?.assets;
    if (!Array.isArray(assets)) return null;
    for (const asset of assets) {
        const variant = asRecord(asRecord(asset)?.variants)?.[format];
        const path = readString(variant, 'path');
        const sha256 = readString(variant, 'sha256');
        if (path !== null && sha256 !== null) return { path, sha256 };
    }
    return null;
}

async function checkObject(
    base: string,
    objectPath: string,
    format: AssetFormat,
    results: CheckResult[]
): Promise<void> {
    const outcome = await request(`${base}/${objectPath}`, { origin: ORIGIN });
    if (!outcome.ok) {
        results.push({
            name: `${format} object`,
            ok: false,
            detail: `GET ${objectPath} failed: ${outcome.detail}`,
        });
        return;
    }
    if (outcome.response.status !== 200) {
        results.push({
            name: `${format} object`,
            ok: false,
            detail: `GET ${objectPath} returned HTTP ${outcome.response.status}`,
        });
        return;
    }
    const { headers } = outcome.response;
    results.push(
        named(
            `${format} content-type`,
            assertContentType(headers.get('content-type'), MIME_TYPES[format])
        )
    );
    results.push(
        named(
            `${format} immutable`,
            assertImmutable(headers.get('cache-control'))
        )
    );
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
    let status = '<no request made>';
    let attempts = 0;
    for (let attempt = 0; attempt < CACHE_HIT_ATTEMPTS; attempt += 1) {
        attempts += 1;
        const outcome = await request(`${base}/${objectPath}`);
        if (!outcome.ok) {
            return {
                name: 'object cache hit',
                ok: false,
                detail: `GET ${objectPath} failed: ${outcome.detail}`,
                warning: true,
            };
        }
        status = outcome.response.headers.get('cf-cache-status') ?? '<missing>';
        if (status === 'HIT') break;
        if (attempt < CACHE_HIT_ATTEMPTS - 1) await delay(CACHE_HIT_DELAY_MS);
    }
    return {
        name: 'object cache hit',
        ok: status === 'HIT',
        detail: `cf-cache-status: ${status} after ${attempts} request(s)`,
        warning: true,
    };
}

async function checkSourceNotPublic(base: string): Promise<CheckResult> {
    const outcome = await request(`${base}/${SOURCE_PROBE_KEY}`);
    if (!outcome.ok) {
        return {
            name: 'source objects not public',
            ok: false,
            detail: `GET ${SOURCE_PROBE_KEY} failed: ${outcome.detail}`,
        };
    }
    const { status } = outcome.response;
    return {
        name: 'source objects not public',
        ok: status === 404 || status === 403,
        detail: `HTTP ${status} for ${SOURCE_PROBE_KEY} (expected 403 or 404)`,
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

async function runChecks(base: string, results: CheckResult[]): Promise<void> {
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
    const allowOrigin = pointerHeaders.get('access-control-allow-origin');
    results.push({
        name: 'pointer CORS',
        ok: allowOrigin !== null,
        detail: `access-control-allow-origin: ${allowOrigin ?? '<missing>'} (request origin ${ORIGIN})`,
    });

    // The manifest URL is computed from the layout helper, never taken from the
    // pointer verbatim, and the pointer is then held to that same path — the
    // agreement a runtime client depends on.
    const releaseId = readString(pointer.body, 'releaseId');
    if (releaseId === null) {
        throw new CheckAborted(
            'pointer releaseId',
            `${pointerPath} carries no releaseId string`
        );
    }
    let manifestPath: string;
    try {
        manifestPath = getReleaseManifestPath(STORY_ID, releaseId, TARGET);
    } catch (error) {
        throw new CheckAborted(
            'pointer releaseId',
            `${pointerPath} carries an unusable releaseId ${releaseId}: ${describeError(error)}`
        );
    }
    const declaredManifestPath = readString(pointer.body, 'manifestPath');
    results.push({
        name: 'pointer manifestPath matches publication layout',
        ok: declaredManifestPath === manifestPath,
        detail: `manifestPath: ${declaredManifestPath ?? '<missing>'} (expected ${manifestPath})`,
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

    let cacheProbePath: string | null = null;
    for (const format of ['webp', 'avif'] as const) {
        const variant = findVariant(manifest.body, format);
        if (variant === null) {
            results.push({
                name: `${format} object`,
                ok: false,
                detail: `no ${format} variant in ${manifestPath}`,
            });
            continue;
        }
        let objectPath: string;
        try {
            objectPath = getObjectPath(
                assertSha256<'object-content'>(variant.sha256),
                format
            );
        } catch (error) {
            results.push({
                name: `${format} object`,
                ok: false,
                detail: `manifest ${format} sha256 ${variant.sha256} is unusable: ${describeError(error)}`,
            });
            continue;
        }
        results.push({
            name: `${format} object path is content-addressed`,
            ok: variant.path === objectPath,
            detail: `path: ${variant.path} (expected ${objectPath})`,
        });
        cacheProbePath ??= objectPath;
        await checkObject(base, objectPath, format, results);
    }

    if (cacheProbePath !== null) {
        results.push(await checkCacheHit(base, cacheProbePath));
    }
    results.push(await checkSourceNotPublic(base));
    results.push(
        checkForbiddenKeys([
            { label: 'pointer', body: pointer.body },
            { label: 'manifest', body: manifest.body },
        ])
    );
}

function report(results: CheckResult[]): void {
    let failed = 0;
    for (const result of results) {
        const label = result.ok ? 'PASS' : result.warning ? 'WARN' : 'FAIL';
        if (!result.ok && !result.warning) failed += 1;
        console.log(`${label}  ${result.name} — ${result.detail}`);
    }
    if (failed > 0) {
        console.error(`\n${failed} check(s) failed.`);
        process.exit(1);
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

try {
    await main();
} catch (error) {
    console.error(`Verification could not run: ${describeError(error)}`);
    process.exit(1);
}
