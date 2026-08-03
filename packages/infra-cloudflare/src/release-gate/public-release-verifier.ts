import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    qualifyAssetIdentity,
    validatePointerManifestPair,
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
} from '../assertions';
import type { GateDiagnosticV1, GateStageV1 } from './diagnostics';
import {
    parsePublicReleaseVerificationInputV1,
    parsePublicReleaseVerificationResultV1,
    type PublicReleaseVerificationInputV1,
    type PublicReleaseVerificationResultV1,
} from './schemas';

const JSON_MEDIA_TYPE = 'application/json';
const IMAGE_MEDIA_TYPES: Record<AssetFormat, string> = {
    webp: 'image/webp',
    avif: 'image/avif',
};
const REQUEST_TIMEOUT_MS = 30_000;

export type PublicVerifierDependencies = {
    fetch: typeof globalThis.fetch;
    decodeImage: (
        bytes: Uint8Array,
        mediaType: string
    ) => Promise<{ width: number; height: number }>;
    now: () => Date;
};

type JsonDocument = {
    response: Response;
    text: string;
    body: unknown;
};

type JsonDocumentFetch =
    | { ok: true; document: JsonDocument }
    | { ok: false; text?: string };

type ObjectReference = {
    identity: string;
    format: AssetFormat;
    path: string;
    sha256: string;
    byteLength: number;
    width: number;
    height: number;
};

type DiagnosticContext = {
    stage: GateStageV1;
    code: string;
    identity?: string;
    safePath?: string;
    publicUrl?: string;
};

/**
 * A fatal public-document failure that occurs before the verifier can observe
 * the required result identity. The V1 result deliberately has no invented
 * release id or checksum fields, so callers receive this safe, stable error
 * instead of a schema-invalid or fabricated result.
 */
export class PublicReleaseVerificationError extends Error {
    constructor(
        readonly code: string,
        readonly stage: GateStageV1
    ) {
        super(
            'Public release verification could not establish release identity'
        );
        this.name = 'PublicReleaseVerificationError';
    }
}

function sha256Hex(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
}

function baseUrlWithTrailingSlash(baseUrl: string): URL {
    const url = new URL(baseUrl);
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url;
}

function publicUrl(baseUrl: string, safePath: string): string {
    return new URL(safePath, baseUrlWithTrailingSlash(baseUrl)).toString();
}

function requestSignal(): AbortSignal {
    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(new Error('public release request timed out')),
        REQUEST_TIMEOUT_MS
    );
    timer.unref?.();
    return controller.signal;
}

async function defaultDecodeImage(
    bytes: Uint8Array,
    mediaType: string
): Promise<{ width: number; height: number }> {
    const metadata = await sharp(bytes, {
        failOn: 'warning',
        animated: false,
    }).metadata();
    const expectedFormat =
        mediaType === IMAGE_MEDIA_TYPES.webp
            ? metadata.format === 'webp'
            : mediaType === IMAGE_MEDIA_TYPES.avif &&
              metadata.format === 'heif' &&
              metadata.compression === 'av1';
    if (!expectedFormat) {
        throw new Error('decoded image format does not match media type');
    }
    const decoded = await sharp(bytes, {
        failOn: 'warning',
        animated: false,
    })
        .raw()
        .toBuffer({ resolveWithObject: true });
    return { width: decoded.info.width, height: decoded.info.height };
}

function resolveDependencies(
    dependencies: Partial<PublicVerifierDependencies> | undefined
): PublicVerifierDependencies {
    return {
        fetch: dependencies?.fetch ?? globalThis.fetch,
        decodeImage: dependencies?.decodeImage ?? defaultDecodeImage,
        now: dependencies?.now ?? (() => new Date()),
    };
}

class VerificationState {
    readonly checks = new Map<string, 'passed' | 'failed'>();
    readonly diagnostics: GateDiagnosticV1[] = [];
    releaseId: string | undefined;
    manifestSha256: string | undefined;

    constructor(readonly input: PublicReleaseVerificationInputV1) {}

    record(id: string, passed: boolean, context?: DiagnosticContext): boolean {
        const previous = this.checks.get(id);
        if (previous === undefined || !passed) {
            this.checks.set(id, passed ? 'passed' : 'failed');
        }
        if (!passed && context !== undefined) {
            this.diagnostics.push({
                code: context.code,
                stage: context.stage,
                message: 'Public release verification failed',
                storyId: this.input.storyId,
                target: this.input.target,
                ...(this.releaseId === undefined
                    ? {}
                    : { releaseId: this.releaseId }),
                ...(this.manifestSha256 === undefined
                    ? {}
                    : { manifestSha256: this.manifestSha256 }),
                ...(context.identity === undefined
                    ? {}
                    : { identity: context.identity }),
                ...(context.safePath === undefined
                    ? {}
                    : { safePath: context.safePath }),
                ...(context.publicUrl === undefined
                    ? {}
                    : { publicUrl: context.publicUrl }),
            });
        }
        return passed;
    }

    result(): PublicReleaseVerificationResultV1 {
        if (this.releaseId === undefined || this.manifestSha256 === undefined) {
            throw new PublicReleaseVerificationError(
                'manifest/identity',
                'manifest'
            );
        }
        return parsePublicReleaseVerificationResultV1({
            schemaVersion: 1,
            status: [...this.checks.values()].some(
                status => status === 'failed'
            )
                ? 'failed'
                : 'passed',
            mode: this.input.mode,
            storyId: this.input.storyId,
            target: this.input.target,
            releaseId: this.releaseId,
            manifestSha256: this.manifestSha256,
            checks: [...this.checks.entries()].map(([id, status]) => ({
                id,
                status,
            })),
            diagnostics: this.diagnostics,
        });
    }
}

function failureContext(
    state: VerificationState,
    stage: GateStageV1,
    code: string,
    safePath: string,
    extras: Omit<
        DiagnosticContext,
        'stage' | 'code' | 'safePath' | 'publicUrl'
    > = {}
): DiagnosticContext {
    return {
        stage,
        code,
        safePath,
        publicUrl: publicUrl(state.input.assetBaseUrl, safePath),
        ...extras,
    };
}

/**
 * The V1 result requires a release/checksum identity. Once either a candidate
 * expectation or a validated active pointer has established it, ordinary
 * transport/body/JSON failures remain structured. Before that point (for
 * example, a missing active pointer), a safe error is the only honest outcome.
 */
function documentFetchFailure(
    state: VerificationState,
    id: 'pointer.fetch' | 'manifest.fetch',
    stage: 'pointer' | 'manifest',
    code: 'pointer/fetch' | 'manifest/fetch',
    safePath: string,
    text?: string
): PublicReleaseVerificationResultV1 {
    if (stage === 'manifest' && text !== undefined) {
        state.manifestSha256 = assertSha256<'manifest-bytes'>(sha256Hex(text));
    }
    state.record(id, false, failureContext(state, stage, code, safePath));
    if (state.releaseId === undefined || state.manifestSha256 === undefined) {
        throw new PublicReleaseVerificationError(code, stage);
    }
    return state.result();
}

async function fetchResponse(
    dependencies: PublicVerifierDependencies,
    url: string,
    browserOrigin: string
): Promise<Response | undefined> {
    try {
        const response = await dependencies.fetch(url, {
            headers: { origin: browserOrigin },
            signal: requestSignal(),
        });
        return response.status === 200 ? response : undefined;
    } catch {
        return undefined;
    }
}

async function fetchJsonDocument(
    dependencies: PublicVerifierDependencies,
    url: string,
    browserOrigin: string
): Promise<JsonDocumentFetch> {
    const response = await fetchResponse(dependencies, url, browserOrigin);
    if (response === undefined) return { ok: false };
    let text: string;
    try {
        text = await response.text();
    } catch {
        return { ok: false };
    }
    try {
        return {
            ok: true,
            document: { response, text, body: JSON.parse(text) as unknown },
        };
    } catch {
        return { ok: false, text };
    }
}

function recordCors(
    state: VerificationState,
    id: string,
    stage: GateStageV1,
    code: string,
    safePath: string,
    headers: Headers,
    identity?: string
): void {
    state.record(
        id,
        headers.get('access-control-allow-origin') === '*',
        failureContext(state, stage, code, safePath, { identity })
    );
}

function recordContentType(
    state: VerificationState,
    id: string,
    stage: GateStageV1,
    code: string,
    safePath: string,
    headers: Headers,
    expected: string,
    identity?: string
): void {
    state.record(
        id,
        assertContentType(headers.get('content-type'), expected).ok,
        failureContext(state, stage, code, safePath, { identity })
    );
}

function recordManifestHeaders(
    state: VerificationState,
    manifestPath: string,
    headers: Headers
): void {
    recordContentType(
        state,
        'manifest.media-type',
        'manifest',
        'manifest/media-type',
        manifestPath,
        headers,
        JSON_MEDIA_TYPE
    );
    recordCors(
        state,
        'manifest.cors',
        'manifest',
        'manifest/cors',
        manifestPath,
        headers
    );
    const cacheStatus = headers.get('cf-cache-status')?.toUpperCase();
    const edgeCacheEligible =
        cacheStatus === 'MISS' ||
        cacheStatus === 'HIT' ||
        cacheStatus === 'EXPIRED' ||
        cacheStatus === 'REVALIDATED';
    state.record(
        'manifest.cache',
        assertImmutable(headers.get('cache-control')).ok && edgeCacheEligible,
        failureContext(state, 'manifest', 'manifest/cache', manifestPath)
    );
}

function recordPointerHeaders(
    state: VerificationState,
    pointerPath: string,
    headers: Headers
): void {
    recordContentType(
        state,
        'pointer.media-type',
        'pointer',
        'pointer/media-type',
        pointerPath,
        headers,
        JSON_MEDIA_TYPE
    );
    recordCors(
        state,
        'pointer.cors',
        'pointer',
        'pointer/cors',
        pointerPath,
        headers
    );
    const cacheStatus = headers.get('cf-cache-status')?.toUpperCase();
    const edgeBypassed =
        (cacheStatus === 'DYNAMIC' || cacheStatus === 'BYPASS') &&
        headers.get('age') === null;
    state.record(
        'pointer.cache',
        assertPointerRevalidation(headers.get('cache-control')).ok &&
            edgeBypassed,
        failureContext(state, 'pointer', 'pointer/cache', pointerPath)
    );
}

function hasForbiddenFields(documents: readonly unknown[]): boolean {
    return documents.some(document => findForbiddenKeys(document).length > 0);
}

function collectObjectReferences(
    manifest: RuntimeAssetManifestV1
): ObjectReference[] {
    const references: ObjectReference[] = [];
    for (const asset of manifest.assets) {
        const identity = qualifyAssetIdentity(asset.identity);
        for (const format of ['webp', 'avif'] as const) {
            const variant = asset.variants[format];
            if (variant === undefined) continue;
            references.push({
                identity,
                format,
                path: variant.path,
                sha256: variant.sha256,
                byteLength: variant.byteLength,
                width: asset.width,
                height: asset.height,
            });
        }
    }
    return references;
}

function recordsMatch(first: ObjectReference, next: ObjectReference): boolean {
    return (
        first.path === next.path &&
        first.byteLength === next.byteLength &&
        first.width === next.width &&
        first.height === next.height
    );
}

async function verifyObjectGroup(
    state: VerificationState,
    dependencies: PublicVerifierDependencies,
    references: readonly ObjectReference[]
): Promise<void> {
    const first = references[0];
    if (first === undefined) return;
    const expectedPath = getObjectPath(
        assertSha256<'object-content'>(first.sha256),
        first.format
    );
    const objectUrl = publicUrl(state.input.assetBaseUrl, expectedPath);

    for (const reference of references) {
        state.record(
            'object.integrity',
            reference.path === expectedPath && recordsMatch(first, reference),
            failureContext(
                state,
                'public-object',
                'public-object/integrity',
                reference.path,
                { identity: reference.identity }
            )
        );
    }

    const response = await fetchResponse(
        dependencies,
        objectUrl,
        state.input.browserOrigin
    );
    if (response === undefined) {
        state.record(
            'object.fetch',
            false,
            failureContext(
                state,
                'public-object',
                'public-object/fetch',
                expectedPath,
                { identity: first.identity }
            )
        );
        return;
    }
    state.record('object.fetch', true);
    recordContentType(
        state,
        'object.media-type',
        'public-object',
        'public-object/media-type',
        expectedPath,
        response.headers,
        IMAGE_MEDIA_TYPES[first.format],
        first.identity
    );
    recordCors(
        state,
        'object.cors',
        'public-object',
        'public-object/cors',
        expectedPath,
        response.headers,
        first.identity
    );
    const cacheStatus = response.headers.get('cf-cache-status')?.toUpperCase();
    const edgeCacheEligible =
        cacheStatus === 'MISS' ||
        cacheStatus === 'HIT' ||
        cacheStatus === 'EXPIRED' ||
        cacheStatus === 'REVALIDATED';
    state.record(
        'object.cache',
        assertImmutable(response.headers.get('cache-control')).ok &&
            edgeCacheEligible,
        failureContext(
            state,
            'public-object',
            'public-object/cache',
            expectedPath,
            { identity: first.identity }
        )
    );

    let bytes: Uint8Array;
    try {
        bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
        state.record(
            'object.integrity',
            false,
            failureContext(
                state,
                'public-object',
                'public-object/integrity',
                expectedPath,
                { identity: first.identity }
            )
        );
        return;
    }
    for (const reference of references) {
        const matches =
            bytes.byteLength === reference.byteLength &&
            sha256Hex(bytes) === reference.sha256;
        state.record(
            'object.integrity',
            matches,
            failureContext(
                state,
                'public-object',
                'public-object/integrity',
                expectedPath,
                { identity: reference.identity }
            )
        );
    }
    if (
        references.some(
            reference =>
                bytes.byteLength !== reference.byteLength ||
                sha256Hex(bytes) !== reference.sha256
        )
    ) {
        return;
    }

    let decoded: { width: number; height: number };
    try {
        decoded = await dependencies.decodeImage(
            bytes,
            IMAGE_MEDIA_TYPES[first.format]
        );
    } catch {
        state.record(
            'object.decode',
            false,
            failureContext(
                state,
                'browser-decode',
                'browser-decode/fetch',
                expectedPath,
                { identity: first.identity }
            )
        );
        return;
    }
    for (const reference of references) {
        state.record(
            'object.decode',
            decoded.width === reference.width &&
                decoded.height === reference.height,
            failureContext(
                state,
                'browser-decode',
                'browser-decode/dimensions',
                expectedPath,
                { identity: reference.identity }
            )
        );
    }
}

async function verifyObjects(
    state: VerificationState,
    dependencies: PublicVerifierDependencies,
    manifest: RuntimeAssetManifestV1
): Promise<void> {
    const references = collectObjectReferences(manifest);
    if (references.length === 0) {
        state.record('object.fetch', false, {
            stage: 'public-object',
            code: 'public-object/missing',
        });
        return;
    }
    // HPA-229's public smoke proves delivery of both browser formats. AVIF is
    // optional for an individual runtime entry, but a release offering none
    // would remove the only live `image/avif` proof while still passing WebP
    // object checks, so retain the release-level requirement.
    if (!references.some(reference => reference.format === 'avif')) {
        state.record('object.media-type', false, {
            stage: 'public-object',
            code: 'public-object/avif-missing',
        });
    }
    const groups = new Map<string, ObjectReference[]>();
    for (const reference of references) {
        const key = `${reference.format}:${reference.sha256}`;
        const group = groups.get(key);
        if (group === undefined) groups.set(key, [reference]);
        else group.push(reference);
    }
    for (const group of groups.values()) {
        await verifyObjectGroup(state, dependencies, group);
    }
}

function verifyOmittedIdentities(
    state: VerificationState,
    manifest: RuntimeAssetManifestV1
): void {
    const included = new Set(
        manifest.assets.map(asset => qualifyAssetIdentity(asset.identity))
    );
    for (const identity of state.input.omittedIdentities) {
        state.record('coverage.omitted-absent', !included.has(identity), {
            stage: 'coverage',
            code: 'coverage/omitted-present',
            identity,
        });
    }
    if (state.input.omittedIdentities.length === 0) {
        state.record('coverage.omitted-absent', true);
    }
}

/**
 * Verifies the exact public documents and immutable object bytes a browser can
 * read for either a supplied candidate or the currently active pointer.
 */
export async function verifyPublicRelease(
    input: PublicReleaseVerificationInputV1,
    suppliedDependencies: Partial<PublicVerifierDependencies> = {}
): Promise<PublicReleaseVerificationResultV1> {
    const parsedInput = parsePublicReleaseVerificationInputV1(input);
    const dependencies = resolveDependencies(suppliedDependencies);
    const state = new VerificationState(parsedInput);

    let pointerBody: unknown | undefined;
    let manifestPath: string;
    if (parsedInput.mode === 'active') {
        const pointerPath = getCurrentPointerPath(
            parsedInput.storyId,
            parsedInput.target
        );
        const pointerFetch = await fetchJsonDocument(
            dependencies,
            publicUrl(parsedInput.assetBaseUrl, pointerPath),
            parsedInput.browserOrigin
        );
        if (!pointerFetch.ok) {
            return documentFetchFailure(
                state,
                'pointer.fetch',
                'pointer',
                'pointer/fetch',
                pointerPath,
                pointerFetch.text
            );
        }
        const pointer = pointerFetch.document;
        state.record('pointer.fetch', true);
        pointerBody = pointer.body;

        let parsedPointer;
        try {
            parsedPointer = parseActiveReleasePointer(
                pointer.body,
                parsedInput.target,
                parsedInput.storyId
            );
        } catch {
            state.record(
                'pointer.integrity',
                false,
                failureContext(
                    state,
                    'pointer',
                    'pointer/integrity',
                    pointerPath
                )
            );
            throw new PublicReleaseVerificationError(
                'pointer/integrity',
                'pointer'
            );
        }
        state.record('pointer.integrity', true);
        state.releaseId = parsedPointer.releaseId;
        // Header/privacy failures still need to identify the public release
        // the pointer advertises. This is safe only after the runtime parser
        // has validated both fields; the observed manifest digest replaces the
        // advertised checksum once its immutable bytes are fetched below.
        state.manifestSha256 = parsedPointer.manifestSha256;
        recordPointerHeaders(state, pointerPath, pointer.response.headers);
        state.record(
            'pointer.privacy',
            !hasForbiddenFields([pointer.body]),
            failureContext(state, 'pointer', 'pointer/privacy', pointerPath)
        );
        manifestPath = getReleaseManifestPath(
            parsedInput.storyId,
            parsedPointer.releaseId,
            parsedInput.target
        );
    } else {
        if (parsedInput.releaseId === undefined) {
            throw new PublicReleaseVerificationError(
                'input/release-id',
                'input'
            );
        }
        state.releaseId = parsedInput.releaseId;
        state.manifestSha256 = parsedInput.expectedManifestSha256;
        manifestPath = getReleaseManifestPath(
            parsedInput.storyId,
            parsedInput.releaseId,
            parsedInput.target
        );
    }

    const manifestFetch = await fetchJsonDocument(
        dependencies,
        publicUrl(parsedInput.assetBaseUrl, manifestPath),
        parsedInput.browserOrigin
    );
    if (!manifestFetch.ok) {
        return documentFetchFailure(
            state,
            'manifest.fetch',
            'manifest',
            'manifest/fetch',
            manifestPath,
            manifestFetch.text
        );
    }
    const manifest = manifestFetch.document;
    state.manifestSha256 = assertSha256<'manifest-bytes'>(
        sha256Hex(manifest.text)
    );
    state.record('manifest.fetch', true);
    recordManifestHeaders(state, manifestPath, manifest.response.headers);
    state.record(
        'manifest.privacy',
        !hasForbiddenFields([
            manifest.body,
            ...(pointerBody === undefined ? [] : [pointerBody]),
        ]),
        failureContext(state, 'manifest', 'manifest/privacy', manifestPath)
    );

    let parsedManifest: RuntimeAssetManifestV1 | undefined;
    try {
        parsedManifest = parseRuntimeAssetManifest(manifest.body);
    } catch {
        state.record(
            'manifest.integrity',
            false,
            failureContext(
                state,
                'manifest',
                'manifest/integrity',
                manifestPath
            )
        );
    }

    if (parsedManifest !== undefined) {
        let integrityOk = true;
        if (parsedManifest.storyId !== parsedInput.storyId) integrityOk = false;
        if (parsedManifest.releaseId !== state.releaseId) integrityOk = false;
        try {
            const contentSha256 = assertSha256<'release-content'>(
                sha256Hex(canonicalReleaseContent(parsedManifest))
            ) as ReleaseContentSha256;
            assertReleaseIdMatchesContentSha256(parsedManifest, contentSha256);
        } catch {
            integrityOk = false;
        }
        if (parsedInput.mode === 'active') {
            try {
                const pointer = parseActiveReleasePointer(
                    pointerBody,
                    parsedInput.target,
                    parsedInput.storyId
                );
                validatePointerManifestPair(
                    pointer,
                    parsedManifest,
                    state.manifestSha256 as ManifestByteSha256
                );
            } catch {
                integrityOk = false;
            }
        }
        if (
            parsedInput.expectedManifestSha256 !== undefined &&
            state.manifestSha256 !== parsedInput.expectedManifestSha256
        ) {
            integrityOk = false;
            state.record(
                'manifest.integrity',
                false,
                failureContext(
                    state,
                    'manifest',
                    'manifest/expected-checksum',
                    manifestPath
                )
            );
        }
        state.record(
            'manifest.integrity',
            integrityOk,
            failureContext(
                state,
                'manifest',
                'manifest/integrity',
                manifestPath
            )
        );

        verifyOmittedIdentities(state, parsedManifest);
        await verifyObjects(state, dependencies, parsedManifest);
    }

    return state.result();
}
