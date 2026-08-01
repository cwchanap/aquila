/**
 * Tests for verify.ts `runChecks`.
 *
 * The verifier previously spot-checked only `releaseId` and `manifestPath` with
 * `readString`, so a manifest edited after publication (but carrying a valid
 * first webp/avif entry) could pass every check while the reader rejected it
 * with "Manifest checksum mismatch". These tests prove the verifier now reuses
 * the reader's integrity checks — `parseActiveReleasePointer`,
 * `parseRuntimeAssetManifest`, `validatePointerManifestPair`, the manifest-byte
 * digest, and the canonical release-content digest — so a release the reader
 * rejects cannot pass the verifier.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import {
    canonicalReleaseContent,
    getCurrentPointerPath,
    getReleaseManifestPath,
    getObjectPath,
    parseRuntimeAssetManifest,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import { runChecks, _setFetchImpl, ORIGIN } from '../verify';
import type { CheckResult } from '../assertions';

const STORY_ID = 'the_seventh_mirror';
const TARGET = { kind: 'preview', previewId: 'smoke' } as const;
const BASE = 'https://assets.example.dev';
const POINTER_CACHE = 'no-cache, max-age=0, must-revalidate';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

function sha256Hex(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function jsonResponse(text: string, headers: Record<string, string>): Response {
    return new Response(text, {
        status: 200,
        headers: { 'content-type': 'application/json', ...headers },
    });
}

/**
 * Builds a contract-valid manifest, the pointer that advertises it, and the
 * exact byte digests a publisher would set. `manifestText` is the serialized
 * manifest; `manifestSha256` is sha256 of those bytes; `releaseId` is the
 * canonical release-content digest.
 *
 * The release carries two assets — a background and a portrait, each as WebP
 * and AVIF — mirroring the smoke release the seeder publishes. The verifier
 * must check every object, not just the first asset's, so the fixture exercises
 * the multi-asset path the previous single-asset fixture hid.
 */
type AssetFixture = {
    identity: { type: string; key: string };
    webpBody: string;
    avifBody: string;
    webpSha: string;
    avifSha: string;
    webpPath: string;
    avifPath: string;
    webpLabel: string;
    avifLabel: string;
    width: number;
    height: number;
};

function buildAsset(
    type: string,
    key: string,
    webpBody: string,
    avifBody: string,
    width: number,
    height: number
): AssetFixture {
    const webpSha = sha256Hex(webpBody);
    const avifSha = sha256Hex(avifBody);
    return {
        identity: { type, key },
        webpBody,
        avifBody,
        webpSha,
        avifSha,
        webpPath: getObjectPath(
            webpSha as unknown as Parameters<typeof getObjectPath>[0],
            'webp'
        ),
        avifPath: getObjectPath(
            avifSha as unknown as Parameters<typeof getObjectPath>[0],
            'avif'
        ),
        webpLabel: webpSha.slice(0, 16),
        avifLabel: avifSha.slice(0, 16),
        width,
        height,
    };
}

function buildValidRelease(): {
    pointerText: string;
    manifestText: string;
    manifestObj: RuntimeAssetManifestV1;
    assets: AssetFixture[];
} {
    const assets = [
        buildAsset(
            'background',
            'chapter_1/ch1_act2_s0',
            'webp-bytes',
            'avif-bytes',
            640,
            360
        ),
        buildAsset(
            'portrait',
            'portraits/mira_neutral',
            'webp-portrait-bytes',
            'avif-portrait-bytes',
            512,
            512
        ),
    ];
    const manifestObj = {
        schemaVersion: 1 as const,
        storyId: STORY_ID,
        // placeholder; recomputed from canonical content below
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets: assets.map(a => ({
            identity: a.identity,
            variants: {
                webp: {
                    format: 'webp',
                    path: a.webpPath,
                    sha256: a.webpSha,
                    byteLength: a.webpBody.length,
                },
                avif: {
                    format: 'avif',
                    path: a.avifPath,
                    sha256: a.avifSha,
                    byteLength: a.avifBody.length,
                },
            },
            width: a.width,
            height: a.height,
        })),
    };

    // Parse to get the typed manifest, then derive the real releaseId from
    // canonical content (which excludes releaseId, so the placeholder is fine).
    const parsed = parseRuntimeAssetManifest(manifestObj);
    const releaseId = `sha256-${sha256Hex(canonicalReleaseContent(parsed))}`;
    const finalManifest = { ...manifestObj, releaseId };
    const manifestText = JSON.stringify(finalManifest);
    const manifestSha256 = sha256Hex(manifestText);

    const pointerObj = {
        schemaVersion: 1 as const,
        storyId: STORY_ID,
        releaseId,
        manifestPath: getReleaseManifestPath(STORY_ID, releaseId, TARGET),
        manifestSha256,
        publishedAt: '2026-07-31T00:00:00.000Z',
    };
    const pointerText = JSON.stringify(pointerObj);

    return {
        pointerText,
        manifestText,
        manifestObj: finalManifest as unknown as RuntimeAssetManifestV1,
        assets,
    };
}

/**
 * A fetch that serves the release's documents and objects. Object URLs return
 * immutable image bytes whose length and SHA-256 match the manifest variant;
 * the source-probe key returns 404 (the verifier requires the source key to be
 * absent from the delivery bucket). `corrupt` swaps one asset's format body for
 * different bytes while keeping its headers valid — the scenario where a
 * content-addressed object is overwritten or corrupted but still served with
 * the right content-type. `assetIndex` selects which of the release's assets is
 * corrupted, so the second-asset case the reviewer flagged is exercisable.
 */
function makeFetch(
    release: ReturnType<typeof buildValidRelease>,
    corrupt?: { assetIndex: number; format: 'webp' | 'avif'; body: string },
    sourceProbeStatus = 404
): typeof fetch {
    const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
    const pointerUrl = `${BASE}/${pointerPath}`;
    const manifestUrl = `${BASE}/${getReleaseManifestPath(
        STORY_ID,
        JSON.parse(release.pointerText).releaseId,
        TARGET
    )}`;
    // Map each object path to the body it should serve, applying any
    // corruption to the selected asset's format only.
    const bodies: Record<string, string> = {};
    for (const [index, asset] of release.assets.entries()) {
        bodies[asset.webpPath] =
            corrupt?.assetIndex === index && corrupt.format === 'webp'
                ? corrupt.body
                : asset.webpBody;
        bodies[asset.avifPath] =
            corrupt?.assetIndex === index && corrupt.format === 'avif'
                ? corrupt.body
                : asset.avifBody;
    }
    return (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === pointerUrl) {
            // The live pointer reports `BYPASS` with no `age` — the expected
            // state for the bypass rule (runbook §5). Tests that need a
            // different edge state override these via
            // makeFetchWithPointerCacheState.
            return jsonResponse(release.pointerText, {
                'cache-control': POINTER_CACHE,
                'access-control-allow-origin': '*',
                'cf-cache-status': 'BYPASS',
            });
        }
        if (url === manifestUrl) {
            return jsonResponse(release.manifestText, {
                'cache-control': IMMUTABLE_CACHE,
            });
        }
        for (const [path, body] of Object.entries(bodies)) {
            if (url.endsWith(path)) {
                const format = path.endsWith('.webp') ? 'webp' : 'avif';
                return new Response(body, {
                    status: 200,
                    headers: {
                        'content-type':
                            format === 'webp' ? 'image/webp' : 'image/avif',
                        'cache-control': IMMUTABLE_CACHE,
                        'cf-cache-status': 'HIT',
                    },
                });
            }
        }
        // Source probe key and anything else: unreachable. The verifier treats
        // only 404 as definitive absence of the source key, so the status is
        // overridable to exercise the rejected branches.
        return new Response('not found', { status: sourceProbeStatus });
    }) as typeof fetch;
}

function names(results: CheckResult[]): Record<string, boolean> {
    const map: Record<string, boolean> = {};
    for (const r of results) map[r.name] = r.ok;
    return map;
}

/**
 * `runChecks` throws `CheckAborted` to skip dependent checks after a critical
 * failure (the CLI's `main()` catches it; tests call `runChecks` directly). The
 * failing check is already in `results` before the throw, so the abort is
 * expected — anything else is a real crash.
 */
async function runChecksOrAbort(results: CheckResult[]): Promise<void> {
    try {
        await runChecks(BASE, results);
    } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/dependent checks skipped/);
    }
}

/**
 * Tamper with the first asset's WebP variant byteLength in a serialized
 * manifest, returning the re-serialized text. Used by the post-publication
 * edit scenarios to invalidate the manifest content without touching the
 * pointer's advertised checksum.
 */
function tamperWebpByteLength(manifestText: string): string {
    const tampered = JSON.parse(manifestText) as {
        assets: Array<{
            variants: { webp: { byteLength: number } };
        }>;
    };
    tampered.assets[0].variants.webp.byteLength = 9999;
    return JSON.stringify(tampered);
}

/**
 * Re-signs a manifest and its pointer so both integrity digests match the
 * edited manifest content. `buildValidRelease` signs the original release once;
 * tests that edit the manifest object after the fact (e.g. making two assets
 * share a digest) must re-derive releaseId from canonical content and
 * manifestSha256 from the new bytes, or the contract checks abort before the
 * check under test runs.
 */
function resignRelease(
    release: ReturnType<typeof buildValidRelease>,
    manifestObj: Record<string, unknown>
): void {
    const parsed = parseRuntimeAssetManifest(manifestObj);
    const releaseId = `sha256-${sha256Hex(canonicalReleaseContent(parsed))}`;
    const finalManifest = { ...manifestObj, releaseId };
    const manifestText = JSON.stringify(finalManifest);
    const manifestSha256 = sha256Hex(manifestText);
    const pointer = JSON.parse(release.pointerText) as {
        releaseId: string;
        manifestPath: string;
        manifestSha256: string;
    };
    pointer.releaseId = releaseId;
    pointer.manifestPath = getReleaseManifestPath(STORY_ID, releaseId, TARGET);
    pointer.manifestSha256 = manifestSha256;
    release.manifestText = manifestText;
    release.pointerText = JSON.stringify(pointer);
    release.manifestObj = parseRuntimeAssetManifest(finalManifest);
}

/**
 * A fetch that serves the release's documents and objects but returns a
 * pointer `access-control-allow-origin` other than the wildcard — the
 * scenario where a misconfigured CORS policy lets the verifier pass while
 * every real browser blocks the read. Only `*` is a valid policy for this
 * delivery host: an exact allowlist cannot cover ephemeral `*.vercel.app`
 * preview origins.
 */
function makeFetchWithBadCors(
    release: ReturnType<typeof buildValidRelease>,
    allowOrigin: string
): typeof fetch {
    const base = makeFetch(release);
    const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
    const pointerUrl = `${BASE}/${pointerPath}`;
    return (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === pointerUrl) {
            return jsonResponse(release.pointerText, {
                'cache-control': POINTER_CACHE,
                'access-control-allow-origin': allowOrigin,
            });
        }
        return base(input);
    }) as typeof fetch;
}

/**
 * A fetch that serves the release's documents and objects but reports a
 * pointer `cf-cache-status` (and optional `age`) other than the bypass
 * baseline — the scenario where the pointer rule is missing or no longer
 * matching and `current.json` is edge-cached. The runbook's §5 table declares
 * `HIT`/`MISS`/`EXPIRED`/`REVALIDATED` on the pointer wrong, and a cached
 * response always carries `age`.
 */
function makeFetchWithPointerCacheState(
    release: ReturnType<typeof buildValidRelease>,
    cacheStatus: string,
    age?: string
): typeof fetch {
    const base = makeFetch(release);
    const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
    const pointerUrl = `${BASE}/${pointerPath}`;
    return (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === pointerUrl) {
            return jsonResponse(release.pointerText, {
                'cache-control': POINTER_CACHE,
                'access-control-allow-origin': '*',
                'cf-cache-status': cacheStatus,
                ...(age === undefined ? {} : { age }),
            });
        }
        return base(input);
    }) as typeof fetch;
}

describe('runChecks integrity', () => {
    afterEach(() => {
        _setFetchImpl(fetch);
    });

    it('passes every integrity check for a contract-valid release', async () => {
        const release = buildValidRelease();
        _setFetchImpl(makeFetch(release));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer contract']).toBe(true);
        expect(byName['manifest contract']).toBe(true);
        expect(byName['manifest checksum matches pointer']).toBe(true);
        expect(byName['pointer/manifest pair']).toBe(true);
        expect(byName['releaseId matches canonical content']).toBe(true);
        // The source probe key answers 404 — the only definitive absence
        // response on a world-readable delivery host.
        expect(byName['source key absent from delivery bucket']).toBe(true);
        // Object body integrity: the fetched bytes must match the manifest
        // variant's declared byte length and SHA-256, the same two checks the
        // reader performs before decoding. Every asset's variants are checked,
        // not just the first asset's — the check name carries the first 16 hex
        // of the object's sha256 so a failure points at the asset.
        const [bg, pt] = release.assets;
        expect(byName[`webp ${bg.webpLabel} object byte length`]).toBe(true);
        expect(byName[`webp ${bg.webpLabel} object checksum`]).toBe(true);
        expect(byName[`avif ${bg.avifLabel} object byte length`]).toBe(true);
        expect(byName[`avif ${bg.avifLabel} object checksum`]).toBe(true);
        expect(byName[`webp ${pt.webpLabel} object byte length`]).toBe(true);
        expect(byName[`webp ${pt.webpLabel} object checksum`]).toBe(true);
        expect(byName[`avif ${pt.avifLabel} object byte length`]).toBe(true);
        expect(byName[`avif ${pt.avifLabel} object checksum`]).toBe(true);
        // No integrity check failed.
        expect(results.filter(r => !r.ok && !r.warning)).toEqual([]);
    });

    it('rejects an object whose body is corrupted while its headers stay valid', async () => {
        // The reviewer's scenario: a content-addressed object is overwritten or
        // corrupted, but the response still carries the right content-type and
        // cache-control (and may even remain decodable). The reader rejects it
        // with "Asset byte length mismatch" / "Asset checksum mismatch"; the
        // verifier must too — previously checkObject read only headers, so a
        // release the reader rejected could pass the verifier.
        const release = buildValidRelease();
        const [bg, pt] = release.assets;
        _setFetchImpl(
            makeFetch(release, {
                assetIndex: 0,
                format: 'webp',
                body: 'corrupted-webp-bytes',
            })
        );
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        // Headers still pass.
        expect(byName[`webp ${bg.webpLabel} content-type`]).toBe(true);
        expect(byName[`webp ${bg.webpLabel} immutable`]).toBe(true);
        // Body integrity fails: the byte length no longer matches the manifest.
        expect(byName[`webp ${bg.webpLabel} object byte length`]).toBe(false);
        // The checksum check is skipped once the byte length mismatches, so the
        // run reports one clear failure rather than two redundant ones.
        expect(byName[`webp ${bg.webpLabel} object checksum`]).toBeUndefined();
        // The first asset's avif and the entire second asset are untouched and
        // still pass — proving the verifier checks every object, not just the
        // corrupted one.
        expect(byName[`avif ${bg.avifLabel} object byte length`]).toBe(true);
        expect(byName[`avif ${bg.avifLabel} object checksum`]).toBe(true);
        expect(byName[`webp ${pt.webpLabel} object byte length`]).toBe(true);
        expect(byName[`webp ${pt.webpLabel} object checksum`]).toBe(true);
        // The run reports at least one hard failure.
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects an object whose body matches in length but not in checksum', async () => {
        // Same byte length, different bytes: the byte-length check passes but
        // the SHA-256 check catches the corruption, exactly as the reader does.
        const release = buildValidRelease();
        const [bg] = release.assets;
        const sameLengthCorrupt = 'xxbp-bytes'; // 10 bytes, same length as 'webp-bytes'
        _setFetchImpl(
            makeFetch(release, {
                assetIndex: 0,
                format: 'webp',
                body: sameLengthCorrupt,
            })
        );
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName[`webp ${bg.webpLabel} object byte length`]).toBe(true);
        expect(byName[`webp ${bg.webpLabel} object checksum`]).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a delivery host that answers the source probe with 403', async () => {
        // Only 404 is a definitive absence response on a world-readable
        // delivery host. A 403 is ambiguous — an object present but blocked
        // from being served would also answer 403 — so the verifier must not
        // bless it as proof the source key is absent from the delivery bucket.
        const release = buildValidRelease();
        _setFetchImpl(makeFetch(release, undefined, 403));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['source key absent from delivery bucket']).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a corrupted second asset while the first asset passes', async () => {
        // The reviewer's scenario: a release with multiple assets where only a
        // later object is corrupted. The previous verifier called findVariant,
        // which returns the first usable variant per format, so it checked only
        // the first asset's WebP and AVIF and reported success while the reader
        // rejected the second asset. The verifier must now catch a corrupted
        // portrait (asset 1) even when the background (asset 0) is healthy.
        const release = buildValidRelease();
        const [bg, pt] = release.assets;
        _setFetchImpl(
            makeFetch(release, {
                assetIndex: 1,
                format: 'webp',
                body: 'corrupted-portrait-webp',
            })
        );
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        // The first asset is untouched and passes every check.
        expect(byName[`webp ${bg.webpLabel} object byte length`]).toBe(true);
        expect(byName[`webp ${bg.webpLabel} object checksum`]).toBe(true);
        expect(byName[`avif ${bg.avifLabel} object byte length`]).toBe(true);
        expect(byName[`avif ${bg.avifLabel} object checksum`]).toBe(true);
        // The second asset's WebP is corrupted: byte length mismatches and the
        // checksum check is skipped. Its AVIF is untouched and still passes.
        expect(byName[`webp ${pt.webpLabel} object byte length`]).toBe(false);
        expect(byName[`webp ${pt.webpLabel} object checksum`]).toBeUndefined();
        expect(byName[`avif ${pt.avifLabel} object byte length`]).toBe(true);
        expect(byName[`avif ${pt.avifLabel} object checksum`]).toBe(true);
        // The run reports at least one hard failure.
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a manifest edited after publication (checksum mismatch)', async () => {
        // The reviewer's scenario: a manifest is modified but the pointer still
        // advertises the original manifestSha256. The reader rejects this with
        // "Manifest checksum mismatch"; the verifier must too.
        const release = buildValidRelease();
        release.manifestText = tamperWebpByteLength(release.manifestText);
        _setFetchImpl(makeFetch(release));

        const results: CheckResult[] = [];
        await runChecksOrAbort(results);
        const byName = names(results);
        expect(byName['manifest checksum matches pointer']).toBe(false);
        // Dependent integrity checks are skipped (abort), not silently passed.
        expect(byName['manifest contract']).toBeUndefined();
        expect(byName['pointer/manifest pair']).toBeUndefined();
        expect(byName['releaseId matches canonical content']).toBeUndefined();
        // The run reports at least one hard failure.
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a manifest whose releaseId does not match its content', async () => {
        // The releaseId is a content address. Re-signing the manifest bytes (so
        // the checksum passes) while leaving releaseId at the original digest
        // still fails the canonical-content check the reader performs.
        const release = buildValidRelease();
        const tamperedManifestText = tamperWebpByteLength(release.manifestText);
        release.manifestText = tamperedManifestText;
        // Re-sign the pointer so the manifest-byte checksum passes, but leave
        // releaseId pointing at the original content digest.
        const pointer = JSON.parse(release.pointerText) as {
            manifestSha256: string;
        };
        pointer.manifestSha256 = sha256Hex(tamperedManifestText);
        release.pointerText = JSON.stringify(pointer);
        _setFetchImpl(makeFetch(release));

        const results: CheckResult[] = [];
        await runChecksOrAbort(results);
        const byName = names(results);
        expect(byName['manifest checksum matches pointer']).toBe(true);
        expect(byName['manifest contract']).toBe(true);
        expect(byName['pointer/manifest pair']).toBe(true);
        // The releaseId no longer matches the canonical content digest.
        expect(byName['releaseId matches canonical content']).toBe(false);
    });

    it('rejects a pointer that fails the contract parser', async () => {
        const release = buildValidRelease();
        // Remove manifestSha256 — the contract parser rejects a pointer missing
        // a required field, where the old readString spot-check would not.
        const broken = JSON.parse(release.pointerText) as Record<
            string,
            unknown
        >;
        delete broken.manifestSha256;
        release.pointerText = JSON.stringify(broken);
        _setFetchImpl(makeFetch(release));

        const results: CheckResult[] = [];
        await runChecksOrAbort(results);
        const byName = names(results);
        expect(byName['pointer contract']).toBe(false);
        // Dependent checks are skipped.
        expect(byName['manifest checksum matches pointer']).toBeUndefined();
    });

    it('rejects two assets sharing a digest but declaring conflicting byteLength', async () => {
        // The reviewer's scenario: two manifest entries legally reference the
        // same digest while declaring different metadata. The manifest schema
        // validates that each path matches the digest and byteLength is
        // positive, but not that references sharing a digest agree. The reader
        // checks bytes.byteLength against each asset's variant.byteLength
        // before decoding, so the second asset is rejected at runtime; the
        // verifier's old Set-based dedupe skipped the second reference entirely
        // and let the release pass. The Map-based dedupe must compare the
        // second reference's metadata against the first and fail.
        const release = buildValidRelease();
        const [bg] = release.assets;
        const manifestObj = JSON.parse(release.manifestText) as {
            assets: Array<{
                variants: {
                    webp: {
                        format: string;
                        path: string;
                        sha256: string;
                        byteLength: number;
                    };
                };
            }>;
        };
        // Make the second asset's webp variant point at the first asset's
        // webp object (same sha256, same path) but declare a different
        // byteLength — a manifest the schema accepts but the reader rejects.
        manifestObj.assets[1].variants.webp = {
            format: 'webp',
            path: bg.webpPath,
            sha256: bg.webpSha,
            byteLength: bg.webpBody.length + 1,
        };
        resignRelease(
            release,
            manifestObj as unknown as Record<string, unknown>
        );
        _setFetchImpl(makeFetch(release));

        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        // The shared object is fetched once and passes its own integrity
        // checks (the bytes match the first reference).
        expect(byName[`webp ${bg.webpLabel} object byte length`]).toBe(true);
        expect(byName[`webp ${bg.webpLabel} object checksum`]).toBe(true);
        // The second reference's metadata disagrees with the first — the
        // consistency check fails where the old Set-based dedupe skipped it.
        expect(byName[`webp ${bg.webpLabel} object reference consistent`]).toBe(
            false
        );
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects two assets sharing a digest but declaring conflicting dimensions', async () => {
        // Companion to the byteLength case: width/height live on the asset, not
        // the variant, but identical bytes decode to identical dimensions, so
        // two assets sharing a digest must also agree on width/height. The
        // reader's assertCallerMetadata rejects a mismatch at decode time; the
        // verifier catches it as a manifest consistency check.
        const release = buildValidRelease();
        const [bg] = release.assets;
        const manifestObj = JSON.parse(release.manifestText) as {
            assets: Array<{
                width: number;
                height: number;
                variants: {
                    webp: {
                        format: string;
                        path: string;
                        sha256: string;
                        byteLength: number;
                    };
                };
            }>;
        };
        manifestObj.assets[1].variants.webp = {
            format: 'webp',
            path: bg.webpPath,
            sha256: bg.webpSha,
            byteLength: bg.webpBody.length,
        };
        manifestObj.assets[1].width = bg.width + 1;
        resignRelease(
            release,
            manifestObj as unknown as Record<string, unknown>
        );
        _setFetchImpl(makeFetch(release));

        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName[`webp ${bg.webpLabel} object reference consistent`]).toBe(
            false
        );
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('passes two assets sharing a digest with consistent metadata', async () => {
        // The positive counterpart: two assets referencing the same digest and
        // declaring identical metadata is a valid release (e.g. the same image
        // reused for two scenes). The consistency check passes and the object
        // is fetched once.
        const release = buildValidRelease();
        const [bg] = release.assets;
        const manifestObj = JSON.parse(release.manifestText) as {
            assets: Array<{
                width: number;
                height: number;
                variants: {
                    webp: {
                        format: string;
                        path: string;
                        sha256: string;
                        byteLength: number;
                    };
                };
            }>;
        };
        manifestObj.assets[1].variants.webp = {
            format: 'webp',
            path: bg.webpPath,
            sha256: bg.webpSha,
            byteLength: bg.webpBody.length,
        };
        // The second asset must also agree on dimensions, since identical
        // bytes decode to identical dimensions.
        manifestObj.assets[1].width = bg.width;
        manifestObj.assets[1].height = bg.height;
        resignRelease(
            release,
            manifestObj as unknown as Record<string, unknown>
        );
        _setFetchImpl(makeFetch(release));

        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName[`webp ${bg.webpLabel} object reference consistent`]).toBe(
            true
        );
        expect(results.filter(r => !r.ok && !r.warning)).toEqual([]);
    });

    it('rejects a pointer whose access-control-allow-origin is a foreign origin', async () => {
        // The reviewer's scenario: the CORS header is present but carries an
        // unrelated origin. The old check only verified the header existed, so
        // `https://wrong.example` passed the verifier while a browser running
        // from `https://aquila.cwchanap.dev` could not read the response. The
        // check must require the wildcard.
        const release = buildValidRelease();
        _setFetchImpl(makeFetchWithBadCors(release, 'https://wrong.example'));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer CORS']).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a pointer whose access-control-allow-origin is an exact origin', async () => {
        // The non-wildcard branch: an exact-origin response (no `*`) is
        // readable by a browser running from that origin, but it is not a
        // valid deployment configuration — R2 cannot express
        // `https://*.vercel.app`, so an allowlist breaks visual mode on every
        // preview deployment. The verifier must require the wildcard, not
        // bless a policy that passes while previews fail.
        const release = buildValidRelease();
        _setFetchImpl(makeFetchWithBadCors(release, ORIGIN));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer CORS']).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a pointer served from the edge cache on a MISS', async () => {
        // A MISS on current.json means the pointer is cache-eligible: the
        // bypass rule is missing or no longer matching, and a published
        // release can go unseen until the entry expires. The verifier's other
        // pointer checks (revalidation directives, CORS) all pass in this
        // state — they did when this deployment served current.json as a
        // cache HIT for two hours (runbook §5).
        const release = buildValidRelease();
        _setFetchImpl(makeFetchWithPointerCacheState(release, 'MISS'));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer edge bypass']).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a pointer served from the edge cache on a HIT with an age', async () => {
        // HIT with a climbing age is the exact state measured before the
        // redesign: the pointer cached for two hours while carrying correct
        // revalidation headers. A cached response always carries `age`.
        const release = buildValidRelease();
        _setFetchImpl(makeFetchWithPointerCacheState(release, 'HIT', '5874'));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer edge bypass']).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('accepts an uncached pointer (BYPASS with no age)', async () => {
        const release = buildValidRelease();
        _setFetchImpl(makeFetchWithPointerCacheState(release, 'BYPASS'));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer edge bypass']).toBe(true);
        expect(results.filter(r => !r.ok && !r.warning)).toEqual([]);
    });

    it('accepts an uncached pointer (DYNAMIC with no age)', async () => {
        // DYNAMIC is what this zone actually reports for the pointer (runbook
        // §5): the edge never stored the response, which is the behavior the
        // bypass rule exists to guarantee.
        const release = buildValidRelease();
        _setFetchImpl(makeFetchWithPointerCacheState(release, 'DYNAMIC'));
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['pointer edge bypass']).toBe(true);
        expect(results.filter(r => !r.ok && !r.warning)).toEqual([]);
    });
});
