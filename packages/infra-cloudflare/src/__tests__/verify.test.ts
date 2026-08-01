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
import { runChecks, _setFetchImpl } from '../verify';
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
 */
function buildValidRelease(): {
    pointerText: string;
    manifestText: string;
    manifestObj: RuntimeAssetManifestV1;
    webpPath: string;
    avifPath: string;
    webpBody: string;
    avifBody: string;
} {
    const webpBody = 'webp-bytes';
    const avifBody = 'avif-bytes';
    const webpSha = sha256Hex(webpBody);
    const avifSha = sha256Hex(avifBody);
    const webpPath = getObjectPath(
        // brand the digest the way the schema expects
        webpSha as unknown as Parameters<typeof getObjectPath>[0],
        'webp'
    );
    const avifPath = getObjectPath(
        avifSha as unknown as Parameters<typeof getObjectPath>[0],
        'avif'
    );
    const manifestObj = {
        schemaVersion: 1 as const,
        storyId: STORY_ID,
        // placeholder; recomputed from canonical content below
        releaseId: `sha256-${'0'.repeat(64)}`,
        assets: [
            {
                identity: { type: 'background', key: 'chapter_1/ch1_act2_s0' },
                variants: {
                    webp: {
                        format: 'webp',
                        path: webpPath,
                        sha256: webpSha,
                        byteLength: webpBody.length,
                    },
                    avif: {
                        format: 'avif',
                        path: avifPath,
                        sha256: avifSha,
                        byteLength: avifBody.length,
                    },
                },
                width: 640,
                height: 360,
            },
        ],
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
        webpPath,
        avifPath,
        webpBody,
        avifBody,
    };
}

/**
 * A fetch that serves the release's documents and objects. Object URLs return
 * immutable image bytes whose length and SHA-256 match the manifest variant;
 * the source-probe key returns 404 (the verifier requires source objects to be
 * unreachable). `corrupt` swaps a format's body for different bytes while
 * keeping its headers valid — the scenario where a content-addressed object is
 * overwritten or corrupted but still served with the right content-type.
 */
function makeFetch(
    release: ReturnType<typeof buildValidRelease>,
    corrupt?: { format: 'webp' | 'avif'; body: string }
): typeof fetch {
    const pointerPath = getCurrentPointerPath(STORY_ID, TARGET);
    const pointerUrl = `${BASE}/${pointerPath}`;
    const manifestUrl = `${BASE}/${getReleaseManifestPath(
        STORY_ID,
        JSON.parse(release.pointerText).releaseId,
        TARGET
    )}`;
    const webpBody =
        corrupt?.format === 'webp' ? corrupt.body : release.webpBody;
    const avifBody =
        corrupt?.format === 'avif' ? corrupt.body : release.avifBody;
    return (async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url === pointerUrl) {
            return jsonResponse(release.pointerText, {
                'cache-control': POINTER_CACHE,
                'access-control-allow-origin': '*',
            });
        }
        if (url === manifestUrl) {
            return jsonResponse(release.manifestText, {
                'cache-control': IMMUTABLE_CACHE,
            });
        }
        if (url.endsWith(release.webpPath)) {
            return new Response(webpBody, {
                status: 200,
                headers: {
                    'content-type': 'image/webp',
                    'cache-control': IMMUTABLE_CACHE,
                    'cf-cache-status': 'HIT',
                },
            });
        }
        if (url.endsWith(release.avifPath)) {
            return new Response(avifBody, {
                status: 200,
                headers: {
                    'content-type': 'image/avif',
                    'cache-control': IMMUTABLE_CACHE,
                    'cf-cache-status': 'HIT',
                },
            });
        }
        // Source probe key and anything else: unreachable.
        return new Response('not found', { status: 404 });
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
        // Object body integrity: the fetched bytes must match the manifest
        // variant's declared byte length and SHA-256, the same two checks the
        // reader performs before decoding.
        expect(byName['webp object byte length']).toBe(true);
        expect(byName['webp object checksum']).toBe(true);
        expect(byName['avif object byte length']).toBe(true);
        expect(byName['avif object checksum']).toBe(true);
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
        _setFetchImpl(
            makeFetch(release, { format: 'webp', body: 'corrupted-webp-bytes' })
        );
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        // Headers still pass.
        expect(byName['webp content-type']).toBe(true);
        expect(byName['webp immutable']).toBe(true);
        // Body integrity fails: the byte length no longer matches the manifest.
        expect(byName['webp object byte length']).toBe(false);
        // The checksum check is skipped once the byte length mismatches, so the
        // run reports one clear failure rather than two redundant ones.
        expect(byName['webp object checksum']).toBeUndefined();
        // The avif object is untouched and still passes.
        expect(byName['avif object byte length']).toBe(true);
        expect(byName['avif object checksum']).toBe(true);
        // The run reports at least one hard failure.
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects an object whose body matches in length but not in checksum', async () => {
        // Same byte length, different bytes: the byte-length check passes but
        // the SHA-256 check catches the corruption, exactly as the reader does.
        const release = buildValidRelease();
        const sameLengthCorrupt = 'xxbp-bytes'; // 10 bytes, same length as 'webp-bytes'
        _setFetchImpl(
            makeFetch(release, { format: 'webp', body: sameLengthCorrupt })
        );
        const results: CheckResult[] = [];
        await runChecks(BASE, results);
        const byName = names(results);
        expect(byName['webp object byte length']).toBe(true);
        expect(byName['webp object checksum']).toBe(false);
        expect(results.filter(r => !r.ok && !r.warning).length).toBeGreaterThan(
            0
        );
    });

    it('rejects a manifest edited after publication (checksum mismatch)', async () => {
        // The reviewer's scenario: a manifest is modified but the pointer still
        // advertises the original manifestSha256. The reader rejects this with
        // "Manifest checksum mismatch"; the verifier must too.
        const release = buildValidRelease();
        const tampered = JSON.parse(release.manifestText) as {
            assets: Array<{
                variants: { webp: { byteLength: number } };
            }>;
        };
        tampered.assets[0].variants.webp.byteLength = 9999;
        release.manifestText = JSON.stringify(tampered);
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
        const tampered = JSON.parse(release.manifestText) as {
            assets: Array<{
                variants: { webp: { byteLength: number } };
            }>;
        };
        tampered.assets[0].variants.webp.byteLength = 9999;
        const tamperedManifestText = JSON.stringify(tampered);
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
});
