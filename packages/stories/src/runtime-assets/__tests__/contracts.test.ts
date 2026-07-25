import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import currentFixture from '../__fixtures__/current.v1.json';
import manifestFixture from '../__fixtures__/runtime-manifest.v1.json';
import planFixture from '../__fixtures__/release-plan.v1.json';
import {
    AssetResolverError,
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    parseStoryAssetReleasePlan,
    qualifyAssetIdentity,
    releaseIdFromContentSha256,
    validatePointerManifestPair,
} from '..';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const manifestFixturePath = join(
    fixtureDir,
    '..',
    '__fixtures__',
    'runtime-manifest.v1.json'
);

// The pointer fixture's storyId. `parseActiveReleasePointer` now requires the
// caller to bind the pointer to the requested story, so every call site passes
// this explicitly.
const FIXTURE_STORY_ID = 'fixture_story';

// Independently derived digests from the fixture bytes — NOT the values
// declared inside the fixtures. The fixtures' declared `releaseId` and
// `manifestSha256` must reproduce these; if they drift, the tests below fail.
function sha256OfFile(path: string): string {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function sha256OfContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
}

function expectCode(
    callback: () => unknown,
    code: AssetResolverError['code']
): void {
    try {
        callback();
        throw new Error('Expected callback to throw');
    } catch (error) {
        expect(error).toBeInstanceOf(AssetResolverError);
        expect((error as AssetResolverError).code).toBe(code);
    }
}

describe('runtime asset wire contracts', () => {
    it('parses the V1 fixtures and ignores additive fields', () => {
        const manifest = parseRuntimeAssetManifest({
            ...manifestFixture,
            futureReaderHint: true,
        });
        const pointer = parseActiveReleasePointer(
            currentFixture,
            { kind: 'production' },
            FIXTURE_STORY_ID
        );

        expect(manifest.assets).toHaveLength(2);
        expect('futureReaderHint' in manifest).toBe(false);
        expect(pointer.releaseId).toBe(manifest.releaseId);
    });

    it('keeps identical background and portrait keys distinct', () => {
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        const ids = manifest.assets.map(asset =>
            qualifyAssetIdentity(asset.identity)
        );

        expect(ids).toEqual([
            'background:第一章/鏡 房/夜',
            'portrait:第一章/鏡 房/夜',
        ]);
    });

    it('rejects unknown schema versions explicitly', () => {
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    schemaVersion: 2,
                }),
            'unknown-schema-version'
        );
        expectCode(
            () =>
                parseActiveReleasePointer(
                    {
                        ...currentFixture,
                        schemaVersion: 2,
                    },
                    { kind: 'production' },
                    FIXTURE_STORY_ID
                ),
            'unknown-schema-version'
        );
        expectCode(
            () =>
                parseStoryAssetReleasePlan({
                    ...planFixture,
                    schemaVersion: 2,
                }),
            'unknown-schema-version'
        );
    });

    it('reports a stringified unknown version as a version error, not validation', () => {
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    schemaVersion: '2',
                }),
            'unknown-schema-version'
        );
    });

    it('reports a stringified *known* version as a validation error, not a version error', () => {
        // Intentional asymmetry with the test above: assertKnownVersion is a
        // fast-path that surfaces a clear `unknown-schema-version` code for
        // *future* versions before Zod rejects them generically. A stringified
        // *current* version ("1") is not unknown — it is a malformed document
        // whose `schemaVersion` has the wrong type, so Zod's `z.literal(1)`
        // correctly rejects it as a plain validation error. Promoting it to a
        // version-specific code would add noise without improving correctness.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    schemaVersion: '1',
                }),
            'validation'
        );
        // The numeric known version still parses cleanly.
        expect(() => parseRuntimeAssetManifest(manifestFixture)).not.toThrow();
    });

    it('rejects authoring prompts and local source paths in runtime data', () => {
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    prompt: 'private generation prompt',
                }),
            'validation'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourcePath: '/Users/example/source.png',
                }),
            'validation'
        );
    });

    it('matches forbidden parts at word boundaries, not as substrings', () => {
        // `secret` must catch `secret`, `secretPath`, and `secret_path` ...
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secret: 'leak',
                }),
            'validation'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secretPath: '/etc/secret',
                }),
            'validation'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secret_path: '/etc/secret',
                }),
            'validation'
        );
        // ... but must NOT catch `secretary` (substring over-match).
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                secretary: 'narrator',
            })
        ).not.toThrow();
        // `token` must not catch `tokenize`; `apikey` still catches `apiKey`.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                tokenize: true,
            })
        ).not.toThrow();
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    apiKey: 'leak',
                }),
            'validation'
        );
    });

    it('rejects plural forbidden metadata keys', () => {
        // Plural forms (`credentials`, `secrets`, `tokens`, `prompts`,
        // `providers`, `apiKeys`) must be rejected just like their singular
        // stems. The boundary-aware matcher accepts the plural as a whole
        // token but still does not over-match substrings like `secretary`.
        for (const key of [
            'credentials',
            'secrets',
            'tokens',
            'prompts',
            'providers',
            'apiKeys',
            'sourcePaths',
            'localPaths',
        ]) {
            expectCode(
                () =>
                    parseRuntimeAssetManifest({
                        ...manifestFixture,
                        [key]: 'leak',
                    }),
                'validation'
            );
        }
        // Plural-with-suffix must still be caught via the plural stem at a
        // word boundary (e.g. `secretsPath` → `secrets` + `Path`).
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    secretsPath: '/etc/secrets',
                }),
            'validation'
        );
        // Over-matching guard: `secretsauce` is NOT `secrets` at a boundary.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                secretsauce: 'condiment',
            })
        ).not.toThrow();
    });

    it('rejects absolute URL values in unknown manifest fields', () => {
        // The forbidden-key heuristic only inspects property names; an unknown
        // field whose VALUE is an absolute URL would otherwise pass the key
        // check and be silently stripped by the non-strict manifest schema,
        // even though the raw document already exposed the environment-specific
        // URL. The value-based check must catch it regardless of field name.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourceUrl: 'https://internal-assets.example.com/source.png',
                }),
            'unsafe-path'
        );
        // A nested unknown field carrying an absolute URL is also rejected.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    metadata: {
                        origin: 'http://127.0.0.1/private-assets/',
                    },
                }),
            'unsafe-path'
        );
        // Credential-bearing URLs and other schemes are rejected too.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    cdnEndpoint: 'https://user:pass@cdn.example.com/',
                }),
            'unsafe-path'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    fileRef: 'file:///etc/passwd',
                }),
            'unsafe-path'
        );
    });

    it('treats additive fields with prototype-inherited names as unknown (not shape keys)', () => {
        // `constructor`, `toString`, and `__proto__` exist on Object.prototype.
        // The schema-aware URL walker must NOT treat them as known object/array
        // fields via the `in` operator — doing so recurses with the inherited
        // value (e.g. the `Object` function) as the "shape", and `shape.scalars`
        // is undefined on that value, throwing a raw TypeError. With
        // `Object.hasOwn`, these names fall through to the unknown-field scan:
        // a benign additive value is ignored, and an absolute URL inside it is
        // rejected as `unsafe-path`.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                constructor: {
                    note: 'future metadata',
                },
            })
        ).not.toThrow();

        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    constructor: {
                        endpoint: 'https://internal.example/assets',
                    },
                }),
            'unsafe-path'
        );

        // `toString` is a normal own key in an object literal (only `__proto__:`
        // triggers the prototype-setter syntax), so the walker visits it.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                toString: { harmless: true },
            })
        ).not.toThrow();

        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    toString: 'https://internal.example/leak',
                }),
            'unsafe-path'
        );

        // `__proto__` as an OWN data property — the shape it arrives in from
        // `JSON.parse`, which (unlike object-literal syntax) creates a real own
        // `__proto__` key rather than invoking the prototype-setter. An object
        // literal cannot express this case, so define the own property
        // explicitly to mimic the JSON wire path.
        const withOwnProto = { ...manifestFixture };
        Object.defineProperty(withOwnProto, '__proto__', {
            value: { note: 'future metadata' },
            enumerable: true,
            configurable: true,
            writable: true,
        });
        expect(() => parseRuntimeAssetManifest(withOwnProto)).not.toThrow();

        const withOwnProtoUrl = { ...manifestFixture };
        Object.defineProperty(withOwnProtoUrl, '__proto__', {
            value: { endpoint: 'https://internal.example/assets' },
            enumerable: true,
            configurable: true,
            writable: true,
        });
        expectCode(
            () => parseRuntimeAssetManifest(withOwnProtoUrl),
            'unsafe-path'
        );
    });

    it('rejects absolute URL values in unknown pointer fields', () => {
        expectCode(
            () =>
                parseActiveReleasePointer(
                    {
                        ...currentFixture,
                        sourceUrl:
                            'https://internal-assets.example.com/source.png',
                    },
                    { kind: 'production' },
                    FIXTURE_STORY_ID
                ),
            'unsafe-path'
        );
        expectCode(
            () =>
                parseActiveReleasePointer(
                    {
                        ...currentFixture,
                        metadata: {
                            origin: 'http://127.0.0.1/private-assets/',
                        },
                    },
                    { kind: 'production' },
                    FIXTURE_STORY_ID
                ),
            'unsafe-path'
        );
    });

    it('accepts colon-bearing values in known schema fields (logical keys and sections)', () => {
        // The URL scan only inspects UNKNOWN additive fields. Known fields like
        // `identity.key` and `section` intentionally permit colons (logical
        // keys are not URL schemes; sections are free-form labels). A naive
        // scheme-prefix regex would falsely reject `chapter:night` as an
        // absolute URL; the shape-aware scan skips known fields and lets Zod
        // validate them.
        const manifestWithColons = structuredClone(manifestFixture);
        manifestWithColons.assets[0].identity.key = 'chapter:night';
        manifestWithColons.assets[0].section = 'prologue:intro';
        expect(() =>
            parseRuntimeAssetManifest(manifestWithColons)
        ).not.toThrow();
    });

    it('rejects concrete URL values in the known section field', () => {
        // `section` is a known scalar whose Zod schema only checks it is a
        // non-empty string of at most 200 characters — it does NOT reject
        // absolute URLs. Because the shape-aware URL walker skips known
        // scalars, an environment-specific absolute URL placed in `section`
        // would otherwise pass validation and enter the parsed manifest,
        // contradicting the V1 requirement that public manifests never carry
        // environment-specific absolute URLs. The scan must reject concrete
        // URL forms (scheme://..., file://..., //host/...) in `section` while
        // still permitting label-style values like `chapter:night`.
        const httpsManifest = structuredClone(manifestFixture);
        httpsManifest.assets[0].section =
            'https://internal-assets.example.com/private/source.png';
        expectCode(
            () => parseRuntimeAssetManifest(httpsManifest),
            'unsafe-path'
        );

        const fileManifest = structuredClone(manifestFixture);
        fileManifest.assets[0].section = 'file:///etc/passwd';
        expectCode(
            () => parseRuntimeAssetManifest(fileManifest),
            'unsafe-path'
        );

        const protocolRelativeManifest = structuredClone(manifestFixture);
        protocolRelativeManifest.assets[0].section =
            '//internal-assets.example.com/source.png';
        expectCode(
            () => parseRuntimeAssetManifest(protocolRelativeManifest),
            'unsafe-path'
        );

        // Label-style values with a colon but no `://` remain acceptable.
        const labelManifest = structuredClone(manifestFixture);
        labelManifest.assets[0].section = 'chapter:night';
        expect(() => parseRuntimeAssetManifest(labelManifest)).not.toThrow();
    });

    it('rejects environment-bearing scheme URLs in section regardless of slash count', () => {
        // `isConcreteUrlValue` historically required `://` immediately after
        // the scheme, so valid absolute URLs that use a single slash or no
        // slashes (`https:host/path`, `file:/path`, `blob:https://...`) passed
        // the section check and entered the parsed manifest. These carry
        // environment-specific data and must be rejected, while label-style
        // values like `chapter:night` remain acceptable because `chapter` is
        // not a known environment-bearing scheme.
        const httpsOpaque = structuredClone(manifestFixture);
        httpsOpaque.assets[0].section =
            'https:internal-assets.example.com/private.png';
        expectCode(() => parseRuntimeAssetManifest(httpsOpaque), 'unsafe-path');

        const fileSingleSlash = structuredClone(manifestFixture);
        fileSingleSlash.assets[0].section = 'file:/Users/alice/private.png';
        expectCode(
            () => parseRuntimeAssetManifest(fileSingleSlash),
            'unsafe-path'
        );

        const blobUrl = structuredClone(manifestFixture);
        blobUrl.assets[0].section =
            'blob:https://internal-assets.example.com/private-id';
        expectCode(() => parseRuntimeAssetManifest(blobUrl), 'unsafe-path');

        const ftpOpaque = structuredClone(manifestFixture);
        ftpOpaque.assets[0].section = 'ftp:internal.example.com/private.png';
        expectCode(() => parseRuntimeAssetManifest(ftpOpaque), 'unsafe-path');

        // Scheme names are matched case-insensitively.
        const upperCase = structuredClone(manifestFixture);
        upperCase.assets[0].section =
            'HTTPS:internal-assets.example.com/private.png';
        expectCode(() => parseRuntimeAssetManifest(upperCase), 'unsafe-path');

        // Label-style values whose first token is NOT an environment-bearing
        // scheme remain acceptable even when they contain a colon.
        const labelManifest = structuredClone(manifestFixture);
        labelManifest.assets[0].section = 'chapter:night';
        expect(() => parseRuntimeAssetManifest(labelManifest)).not.toThrow();
    });

    it('rejects alternative source-path field names as forbidden metadata', () => {
        // The forbidden-key list historically covered `sourcePath`/`localPath`
        // but not equivalent alternative spellings (`sourceFile`, `localFile`,
        // and their plurals). An unknown field carrying an authoring filesystem
        // path under one of these names would bypass the forbidden-key check,
        // and a bare filesystem path is not URL-prefixed so the URL scan would
        // miss it too — the non-strict schema would then silently strip the
        // field, leaving the parsed manifest clean while the wire document
        // exposed the local authoring path. The contract forbids source paths
        // in public runtime data regardless of field name.
        for (const key of [
            'sourceFile',
            'sourceFiles',
            'localFile',
            'localFiles',
        ]) {
            expectCode(
                () =>
                    parseRuntimeAssetManifest({
                        ...manifestFixture,
                        [key]: '/Users/alice/aquila/private/background.png',
                    }),
                'validation'
            );
        }
        // Boundary-aware matching: `sourceFiler` must NOT be caught (over-match
        // guard), while `sourceFilePath` must be caught via the `sourcefile`
        // stem at a word boundary.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                sourceFiler: 'narrator',
            })
        ).not.toThrow();
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourceFilePath: '/Users/alice/private.png',
                }),
            'validation'
        );
    });

    it('rejects absolute filesystem paths in unknown manifest fields', () => {
        // The URL scan catches scheme-bearing and protocol-relative URLs in
        // unknown additive fields, but a bare absolute filesystem path
        // (`/Users/alice/...`, `C:\Users\...`) is not URL-prefixed, so an
        // unknown field carrying one would bypass the URL scan and be silently
        // stripped by the non-strict schema — leaving the wire document
        // exposed. The contract forbids environment-specific absolute paths in
        // public runtime data, so the unknown-field scan must also reject
        // obvious absolute filesystem paths regardless of field name.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    originPath: '/Users/alice/aquila/private/background.png',
                }),
            'unsafe-path'
        );
        // Windows drive-letter paths (both slash directions) are rejected too.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    originPath: 'C:\\Users\\alice\\private\\background.png',
                }),
            'unsafe-path'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    originPath: 'C:/Users/alice/private/background.png',
                }),
            'unsafe-path'
        );
        // A nested unknown field carrying an absolute filesystem path is also
        // rejected.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    metadata: {
                        origin: '/home/alice/private-assets/background.png',
                    },
                }),
            'unsafe-path'
        );
        // Whitespace-prefixed absolute paths are rejected (trim before test).
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    originPath: ' /Users/alice/private.png',
                }),
            'unsafe-path'
        );
        // Relative paths in unknown fields remain acceptable — they are not
        // environment-specific.
        expect(() =>
            parseRuntimeAssetManifest({
                ...manifestFixture,
                futureHint: 'relative/path/hint.json',
            })
        ).not.toThrow();
    });

    it('rejects whitespace-prefixed absolute URL values in unknown fields', () => {
        // URL detection runs against the raw wire value before Zod's `.trim()`
        // transformation strips leading whitespace. Without trimming on the
        // detection side, a value like ` https://...` bypasses the anchored
        // regex, then Zod trims it and silently accepts the absolute URL. The
        // scan must trim leading whitespace before testing URL patterns.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourceUrl:
                        ' https://internal-assets.example.com/source.png',
                }),
            'unsafe-path'
        );
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourceUrl: ' //internal-assets.example.com/source.png',
                }),
            'unsafe-path'
        );
        // A whitespace-prefixed concrete URL in `section` is also rejected.
        const sectionManifest = structuredClone(manifestFixture);
        sectionManifest.assets[0].section =
            ' https://internal-assets.example.com/source.png';
        expectCode(
            () => parseRuntimeAssetManifest(sectionManifest),
            'unsafe-path'
        );
    });

    it('rejects protocol-relative URLs in unknown fields', () => {
        // A protocol-relative URL (`//host/path`) carries no scheme, so the
        // scheme-only regex missed it; the non-strict schema would then
        // silently strip the unknown field. The scan must catch `//`-prefixed
        // values in unknown fields just like scheme-bearing ones.
        expectCode(
            () =>
                parseRuntimeAssetManifest({
                    ...manifestFixture,
                    sourceUrl: '//internal-assets.example.com/source.png',
                }),
            'unsafe-path'
        );
        expectCode(
            () =>
                parseActiveReleasePointer(
                    {
                        ...currentFixture,
                        sourceUrl: '//internal.example/a.png',
                    },
                    { kind: 'production' },
                    FIXTURE_STORY_ID
                ),
            'unsafe-path'
        );
    });

    it('does not flag prose that merely mentions a URL', () => {
        // A release-plan `reason` is free-form prose; a URL mentioned inside a
        // sentence is not itself an absolute URL value (no leading scheme on the
        // string), so it must remain acceptable. The release-plan parser does
        // not run the absolute-URL value check, but this guards against an
        // over-broad future extension of that check onto release-plan prose.
        const omitted = planFixture.entries.find(
            entry => entry.disposition === 'omitted'
        )!;
        expect(() =>
            parseStoryAssetReleasePlan({
                ...planFixture,
                entries: [
                    ...planFixture.entries.filter(entry => entry !== omitted),
                    {
                        ...omitted,
                        reason: 'see https://internal.example.com for details',
                    },
                ],
            })
        ).not.toThrow();
    });

    it('rejects absolute, traversal, and digest-mismatched object paths', () => {
        const unsafeManifest = structuredClone(manifestFixture);
        unsafeManifest.assets[0].variants.webp.path =
            'https://assets.example/object.webp';
        expectCode(
            () => parseRuntimeAssetManifest(unsafeManifest),
            'unsafe-path'
        );

        const traversalManifest = structuredClone(manifestFixture);
        traversalManifest.assets[0].variants.webp.path =
            'vn/objects/../secret.webp';
        expectCode(
            () => parseRuntimeAssetManifest(traversalManifest),
            'unsafe-path'
        );

        const mismatchedManifest = structuredClone(manifestFixture);
        mismatchedManifest.assets[0].variants.webp.path =
            'vn/objects/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.webp';
        expectCode(
            () => parseRuntimeAssetManifest(mismatchedManifest),
            'integrity'
        );
    });

    it('rejects duplicate type-qualified identities', () => {
        const duplicateManifest = structuredClone(manifestFixture);
        duplicateManifest.assets.push(
            structuredClone(duplicateManifest.assets[0])
        );
        expectCode(
            () => parseRuntimeAssetManifest(duplicateManifest),
            'validation'
        );
    });

    it('accepts a zero-asset manifest', () => {
        // A story may legitimately ship a release before any images are
        // authored; the schema intentionally does not require assets.min(1).
        // This test pins that behavior so a future tightening is a deliberate
        // change, not an accident.
        const empty = parseRuntimeAssetManifest({
            schemaVersion: 1,
            storyId: 'fixture_story',
            releaseId: `sha256-${'0'.repeat(64)}`,
            assets: [],
        });
        expect(empty.assets).toEqual([]);
    });

    it('rejects a release-plan omitted entry that carries a source path', () => {
        // Spec: an omitted entry "has no source path". A publisher that supplies
        // one must be told, not silently stripped — release plans are publisher
        // input, so the entry schemas are strict.
        const omittedWithSourcePath = structuredClone(planFixture);
        (
            omittedWithSourcePath.entries[2] as Record<string, unknown>
        ).sourcePath = 'fixture_story/backgrounds/chapter_1/mirror_room.png';
        expectCode(
            () => parseStoryAssetReleasePlan(omittedWithSourcePath),
            'validation'
        );
    });

    it('rejects unknown keys on release-plan entries', () => {
        const includedWithReason = structuredClone(planFixture);
        (includedWithReason.entries[0] as Record<string, unknown>).reason =
            'should not appear on an included entry';
        expectCode(
            () => parseStoryAssetReleasePlan(includedWithReason),
            'validation'
        );
    });

    it('requires byteLength on every asset variant', () => {
        // byteLength is part of canonical release content; making it required
        // keeps the releaseId deterministic across manifests for identical
        // content.
        const missingByteLength = structuredClone(manifestFixture);
        delete (
            missingByteLength.assets[0].variants.webp as Record<string, unknown>
        ).byteLength;
        expectCode(
            () => parseRuntimeAssetManifest(missingByteLength),
            'validation'
        );
    });

    it('validates pointer path and pointer-manifest integrity', () => {
        const pointer = parseActiveReleasePointer(
            currentFixture,
            { kind: 'production' },
            FIXTURE_STORY_ID
        );
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        // Use the independently computed manifest file bytes digest, not the
        // value declared on the pointer, so the test actually verifies the
        // pointer's `manifestSha256` against the real bytes.
        const actualManifestSha256 = sha256OfFile(manifestFixturePath);
        expect(pointer.manifestSha256).toBe(actualManifestSha256);
        expect(() =>
            validatePointerManifestPair(
                pointer,
                manifest,
                assertSha256<'manifest-bytes'>(actualManifestSha256)
            )
        ).not.toThrow();

        expectCode(
            () =>
                validatePointerManifestPair(
                    pointer,
                    manifest,
                    assertSha256<'manifest-bytes'>('a'.repeat(64))
                ),
            'integrity'
        );

        expectCode(
            () =>
                parseActiveReleasePointer(
                    {
                        ...currentFixture,
                        manifestPath: 'vn/stories/fixture_story/current.json',
                    },
                    { kind: 'production' },
                    FIXTURE_STORY_ID
                ),
            'unsafe-path'
        );

        expectCode(
            () =>
                parseActiveReleasePointer(
                    currentFixture,
                    { kind: 'production' },
                    'another_story'
                ),
            'story-mismatch'
        );
    });

    it('distinguishes pointer/manifest story and release mismatches', () => {
        const pointer = parseActiveReleasePointer(
            currentFixture,
            { kind: 'production' },
            FIXTURE_STORY_ID
        );
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        expectCode(
            () =>
                validatePointerManifestPair(
                    { ...pointer, storyId: 'other_story' },
                    manifest,
                    pointer.manifestSha256
                ),
            'story-mismatch'
        );
        expectCode(
            () =>
                validatePointerManifestPair(
                    {
                        ...pointer,
                        releaseId: `sha256-${'c'.repeat(64)}`,
                    },
                    manifest,
                    pointer.manifestSha256
                ),
            'release-mismatch'
        );
    });

    it('classifies a malformed digest as an integrity failure and locates it', () => {
        const badDigest = structuredClone(manifestFixture);
        badDigest.assets[0].variants.webp.sha256 = 'not-a-valid-digest';
        try {
            parseRuntimeAssetManifest(badDigest);
            throw new Error('Expected parse to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(AssetResolverError);
            expect((error as AssetResolverError).code).toBe('integrity');
            const details =
                (error as AssetResolverError).details?.join(' ') ?? '';
            expect(details).toContain('assets.0.variants.webp.sha256');
        }
    });

    it('defines deterministic release content without a circular release id', () => {
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        const canonical = canonicalReleaseContent(manifest);
        expect(canonical).not.toContain('"releaseId"');
        expect(canonical.indexOf('"background"')).toBeLessThan(
            canonical.indexOf('"portrait"')
        );
        // The fixture's declared `releaseId` must equal sha256(canonical
        // release content); verify against an independently computed digest.
        const realContentSha = sha256OfContent(canonical);
        expect(manifest.releaseId).toBe(`sha256-${realContentSha}`);
        expect(() =>
            assertReleaseIdMatchesContentSha256(
                manifest,
                assertSha256<'release-content'>(realContentSha)
            )
        ).not.toThrow();
        expectCode(
            () =>
                assertReleaseIdMatchesContentSha256(
                    manifest,
                    assertSha256<'release-content'>('a'.repeat(64))
                ),
            'integrity'
        );
    });

    it('reports unsafe-path ahead of integrity when both co-occur', () => {
        // Precedence is unsafe-path > integrity > validation (validation.ts).
        // A document with both an unsafe path and an integrity failure must
        // surface unsafe-path, regardless of Zod's traversal order.
        const both = structuredClone(manifestFixture);
        // unsafe-path: traversal segment in the first asset's webp path
        both.assets[0].variants.webp.path = 'vn/objects/../secret.webp';
        // integrity: second asset's webp path does not match its sha256
        both.assets[1].variants.webp.path =
            'vn/objects/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.webp';
        expectCode(() => parseRuntimeAssetManifest(both), 'unsafe-path');
    });

    it('reports integrity ahead of validation when both co-occur', () => {
        // No unsafe-path issue here, so integrity must win over validation.
        const both = structuredClone(manifestFixture);
        // integrity: first asset's webp path does not match its sha256
        both.assets[0].variants.webp.path =
            'vn/objects/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff.webp';
        // validation: duplicate type-qualified identity (custom issue with no
        // assetErrorCode, so it falls through to the default 'validation')
        const duplicate = structuredClone(both.assets[0]);
        duplicate.variants.webp.path =
            'vn/objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';
        both.assets.push(duplicate);
        expectCode(() => parseRuntimeAssetManifest(both), 'integrity');
    });

    it('prevents transposing a manifest-bytes digest into the release-content verifier', () => {
        // Compile-time guarantee: a ManifestByteSha256 (e.g. pointer.manifestSha256)
        // is not assignable to the ReleaseContentSha256 parameter of
        // assertReleaseIdMatchesContentSha256, and vice versa. The @ts-expect-error
        // directives below are verified by `tsc --noEmit`; if either brand boundary
        // regresses they become unused and the typecheck fails. The offending calls
        // live in a never-invoked function body so they are checked by the
        // compiler but never executed at runtime.
        const pointer = parseActiveReleasePointer(
            currentFixture,
            { kind: 'production' },
            FIXTURE_STORY_ID
        );
        const manifest = parseRuntimeAssetManifest(manifestFixture);
        // Independently computed digests — the runtime sanity checks below
        // exercise the real bytes, not values fed back from the fixtures.
        const manifestBytesDigest = assertSha256<'manifest-bytes'>(
            sha256OfFile(manifestFixturePath)
        );
        const releaseContentDigest = assertSha256<'release-content'>(
            sha256OfContent(canonicalReleaseContent(manifest))
        );

        function compileTimeOnly() {
            // @ts-expect-error - ManifestByteSha256 is not a ReleaseContentSha256
            assertReleaseIdMatchesContentSha256(manifest, manifestBytesDigest);
            // Call kept single-line so the directive covers the erroring arg.
            // @ts-expect-error - ReleaseContentSha256 is not a ManifestByteSha256.
            // prettier-ignore
            validatePointerManifestPair(pointer, manifest, releaseContentDigest);
            // @ts-expect-error - ManifestByteSha256 is not a ReleaseContentSha256.
            // prettier-ignore
            releaseIdFromContentSha256(manifestBytesDigest);
        }
        // Reference the function so it is not dropped before tsc checks it.
        expect(typeof compileTimeOnly).toBe('function');

        // Runtime sanity: the correctly-branded calls typecheck and run cleanly.
        expect(() =>
            validatePointerManifestPair(pointer, manifest, manifestBytesDigest)
        ).not.toThrow();
        expect(() =>
            assertReleaseIdMatchesContentSha256(manifest, releaseContentDigest)
        ).not.toThrow();
        expect(releaseIdFromContentSha256(releaseContentDigest)).toBe(
            `sha256-${releaseContentDigest}`
        );
    });
});
