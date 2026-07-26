import {
    AssetResolverError,
    LogicalAssetIdentitySchema,
    RUNTIME_ASSET_CACHE_POLICY,
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    isSafeLogicalKey,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    qualifyAssetIdentity,
    resolveAssetUrl,
    validatePointerManifestPair,
    type ActiveReleasePointerV1,
    type AssetFallback,
    type AssetFallbackReason,
    type AssetResolutionResult,
    type AssetResolver,
    type AssetResolverErrorCode,
    type AssetResolverSource,
    type LogicalAssetIdentity,
    type PrefetchNextEdgeRequest,
    type PrefetchNextEdgeResult,
    type PublicationTarget,
    type ResolvedAsset,
    type RuntimeAssetManifestV1,
    type ValidatedAssetRelease,
} from '@aquila/stories/runtime-assets';
import { sha256Hex, utf8Bytes } from './hash';
import { ValidatedReleaseStore } from './validated-release-store';

const VALIDATED_RELEASE_TTL_MS =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.staleIfErrorMs;

export type ValidatedReleaseRecord = {
    storyId: string;
    target: PublicationTarget;
    releaseId: string;
    pointerText: string;
    manifestText: string;
    validatedAt: number;
    lastUsedAt: number;
};

type RevalidatedStoredRelease = {
    record: ValidatedReleaseRecord;
    pointer: ActiveReleasePointerV1;
    manifest: RuntimeAssetManifestV1;
};

export type WebAssetResolverOptions = {
    fetchImpl?: typeof fetch;
    store?: ValidatedReleaseStore;
    now?: () => number;
};

function getBrowserStorage(): Storage | null {
    try {
        return typeof globalThis.localStorage === 'undefined'
            ? null
            : globalThis.localStorage;
    } catch {
        return null;
    }
}

function targetsEqual(
    left: PublicationTarget,
    right: PublicationTarget
): boolean {
    if (left.kind !== right.kind) return false;
    return (
        left.kind === 'production' ||
        (right.kind === 'preview' && left.previewId === right.previewId)
    );
}

function parseTarget(value: unknown): PublicationTarget | null {
    if (typeof value !== 'object' || value === null) return null;
    const target = value as Record<string, unknown>;
    if (target.kind === 'production') {
        return Object.keys(target).length === 1 ? { kind: 'production' } : null;
    }
    if (
        target.kind === 'preview' &&
        typeof target.previewId === 'string' &&
        Object.keys(target).length === 2
    ) {
        return { kind: 'preview', previewId: target.previewId };
    }
    return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function upsertByReleaseId(
    records: readonly ValidatedReleaseRecord[],
    accepted: ValidatedReleaseRecord
): ValidatedReleaseRecord[] {
    return [
        accepted,
        ...records.filter(
            record =>
                record.releaseId !== accepted.releaseId ||
                record.storyId !== accepted.storyId ||
                !targetsEqual(record.target, accepted.target)
        ),
    ];
}

function fallbackReasonForCode(
    code: AssetResolverErrorCode
): AssetFallbackReason {
    switch (code) {
        case 'not-found':
            return 'not-found';
        case 'timeout':
        case 'network':
        case 'unavailable':
        case 'stale-pointer':
            return 'release-unavailable';
        case 'integrity':
            return 'integrity-failure';
        default:
            return 'invalid-release';
    }
}

function asResolverError(error: unknown): AssetResolverError {
    return error instanceof AssetResolverError
        ? error
        : new AssetResolverError('network', 'Runtime asset request failed', {
              cause: error,
          });
}

async function fetchWithTimeout(
    fetchImpl: typeof fetch,
    url: URL,
    timeoutMs: number,
    init: RequestInit,
    parentSignal?: AbortSignal
): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    const abort = () => controller.abort();
    parentSignal?.addEventListener('abort', abort, { once: true });
    try {
        return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (cause) {
        if (timedOut) {
            throw new AssetResolverError(
                'timeout',
                `Runtime asset request timed out after ${timeoutMs}ms`,
                { cause }
            );
        }
        throw cause;
    } finally {
        globalThis.clearTimeout(timeout);
        parentSignal?.removeEventListener('abort', abort);
    }
}

async function readResponseText(
    fetchImpl: typeof fetch,
    url: URL,
    timeoutMs: number,
    cache: RequestCache,
    signal?: AbortSignal
): Promise<string> {
    let response: Response;
    try {
        response = await fetchWithTimeout(
            fetchImpl,
            url,
            timeoutMs,
            { cache },
            signal
        );
    } catch (error) {
        throw asResolverError(error);
    }
    if (!response.ok) {
        throw new AssetResolverError(
            'unavailable',
            `Runtime asset request returned HTTP ${response.status}`
        );
    }
    try {
        return await response.text();
    } catch (cause) {
        throw new AssetResolverError(
            'network',
            'Runtime asset response could not be read',
            { cause }
        );
    }
}

function parseJson(text: string, contractName: string): unknown {
    try {
        return JSON.parse(text);
    } catch (cause) {
        throw new AssetResolverError(
            'validation',
            `Invalid ${contractName} JSON`,
            { cause }
        );
    }
}

async function sha256Utf8Text(text: string): Promise<string> {
    return sha256Hex(Uint8Array.from(utf8Bytes(text)));
}

export class WebAssetResolver implements AssetResolver {
    readonly source: AssetResolverSource;

    private readonly fetchImpl: typeof fetch;
    private readonly store: ValidatedReleaseStore;
    private readonly now: () => number;
    private readonly assetIndex = new Map<
        string,
        RuntimeAssetManifestV1['assets'][number]
    >();
    private readonly resolutionCache = new Map<string, AssetResolutionResult>();
    private readonly inFlightLoads = new Set<AbortController>();

    private activeRecord: ValidatedReleaseRecord | null = null;
    private newestPublishedAt = Number.NEGATIVE_INFINITY;
    private lastLoadError: AssetResolverError | null = null;

    constructor(
        source: AssetResolverSource,
        options: WebAssetResolverOptions = {}
    ) {
        this.source = source;
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
        this.store =
            options.store ?? new ValidatedReleaseStore(getBrowserStorage());
        this.now = options.now ?? Date.now;
    }

    async loadActiveRelease(options?: {
        signal?: AbortSignal;
    }): Promise<ValidatedAssetRelease> {
        const loadController = new AbortController();
        const abort = () => loadController.abort();
        options?.signal?.addEventListener('abort', abort, { once: true });
        this.inFlightLoads.add(loadController);
        try {
            return await this.loadFromNetwork(loadController.signal);
        } catch (error) {
            const resolverError = asResolverError(error);
            this.lastLoadError = resolverError;
            if (
                !loadController.signal.aborted &&
                resolverError.code !== 'stale-pointer'
            ) {
                const fallback = await this.loadStoredFallback(this.now());
                if (fallback) return fallback;
            }
            throw resolverError;
        } finally {
            options?.signal?.removeEventListener('abort', abort);
            this.inFlightLoads.delete(loadController);
        }
    }

    resolve(identity: LogicalAssetIdentity): AssetResolutionResult {
        if (
            !LogicalAssetIdentitySchema.safeParse(identity).success ||
            !isSafeLogicalKey(identity.key)
        ) {
            return this.memoFallback(
                identity,
                new AssetResolverError(
                    'unsafe-path',
                    'Logical asset identity is unsafe'
                )
            );
        }
        const key = qualifyAssetIdentity(identity);
        const memoized = this.resolutionCache.get(key);
        if (memoized) return memoized;
        const entry = this.assetIndex.get(key);
        if (!entry) {
            if (this.activeRecord === null) {
                return this.memoFallback(
                    identity,
                    this.lastLoadError ??
                        new AssetResolverError(
                            'unavailable',
                            'No validated runtime asset release is active'
                        )
                );
            }
            return this.memoFallback(
                identity,
                new AssetResolverError(
                    'not-found',
                    'Asset is absent from the active runtime release'
                )
            );
        }
        try {
            const result: ResolvedAsset = {
                status: 'resolved',
                asset: entry,
                webpUrl: resolveAssetUrl(
                    this.source.baseUrl,
                    entry.variants.webp.path
                ),
                avifUrl: entry.variants.avif
                    ? resolveAssetUrl(
                          this.source.baseUrl,
                          entry.variants.avif.path
                      )
                    : undefined,
                placeholderUrl: entry.placeholder
                    ? resolveAssetUrl(
                          this.source.baseUrl,
                          entry.placeholder.path
                      )
                    : undefined,
            };
            this.resolutionCache.set(key, result);
            return result;
        } catch (error) {
            return this.memoFallback(identity, asResolverError(error));
        }
    }

    async prefetchNextEdge(
        request: PrefetchNextEdgeRequest
    ): Promise<PrefetchNextEdgeResult> {
        const failed: AssetFallback[] = [];
        let cached = 0;
        for (const identity of request.assets) {
            const result = this.resolve(identity);
            if (result.status === 'resolved') cached += 1;
            else failed.push(result);
        }
        return {
            requested: request.assets.length,
            cached,
            failed,
        };
    }

    clear(): void {
        for (const controller of this.inFlightLoads) controller.abort();
        this.inFlightLoads.clear();
        this.activeRecord = null;
        this.newestPublishedAt = Number.NEGATIVE_INFINITY;
        this.lastLoadError = new AssetResolverError(
            'unavailable',
            'Runtime asset resolver was cleared'
        );
        this.assetIndex.clear();
        this.resolutionCache.clear();
    }

    private async loadFromNetwork(
        signal: AbortSignal
    ): Promise<ValidatedAssetRelease> {
        const pointerUrl = resolveAssetUrl(
            this.source.baseUrl,
            getCurrentPointerPath(this.source.storyId, this.source.target)
        );
        const pointerText = await readResponseText(
            this.fetchImpl,
            pointerUrl,
            RUNTIME_ASSET_CACHE_POLICY.timeoutMs.pointer,
            'no-cache',
            signal
        );
        const pointer = parseActiveReleasePointer(
            parseJson(pointerText, 'active-release pointer'),
            this.source.target,
            this.source.storyId
        );
        this.assertNotOlder(pointer);
        const manifestUrl = resolveAssetUrl(
            this.source.baseUrl,
            pointer.manifestPath
        );
        const manifestText = await readResponseText(
            this.fetchImpl,
            manifestUrl,
            RUNTIME_ASSET_CACHE_POLICY.timeoutMs.manifest,
            'force-cache',
            signal
        );
        const manifestDigest = assertSha256<'manifest-bytes'>(
            await sha256Utf8Text(manifestText)
        );
        if (manifestDigest !== pointer.manifestSha256) {
            throw new AssetResolverError(
                'integrity',
                'Manifest checksum mismatch'
            );
        }
        const manifest = parseRuntimeAssetManifest(
            parseJson(manifestText, 'runtime asset manifest')
        );
        validatePointerManifestPair(pointer, manifest, manifestDigest);
        const canonicalDigest = assertSha256<'release-content'>(
            await sha256Utf8Text(canonicalReleaseContent(manifest))
        );
        assertReleaseIdMatchesContentSha256(manifest, canonicalDigest);

        const now = this.now();
        const record: ValidatedReleaseRecord = {
            storyId: this.source.storyId,
            target: this.source.target,
            releaseId: pointer.releaseId,
            pointerText,
            manifestText,
            validatedAt: now,
            lastUsedAt: now,
        };
        this.acceptRelease(record, pointer, manifest);
        await this.persistAcceptedRecord(record, now);
        return {
            pointer,
            manifest,
            validatedAt: new Date(record.validatedAt).toISOString(),
            source: 'network',
        };
    }

    private assertNotOlder(pointer: ActiveReleasePointerV1): void {
        const publishedAt = Date.parse(pointer.publishedAt);
        if (publishedAt < this.newestPublishedAt) {
            throw new AssetResolverError(
                'stale-pointer',
                'Active-release pointer is older than the accepted release'
            );
        }
    }

    private acceptRelease(
        record: ValidatedReleaseRecord,
        pointer: ActiveReleasePointerV1,
        manifest: RuntimeAssetManifestV1
    ): void {
        this.activeRecord = record;
        this.newestPublishedAt = Math.max(
            this.newestPublishedAt,
            Date.parse(pointer.publishedAt)
        );
        this.lastLoadError = null;
        this.assetIndex.clear();
        this.resolutionCache.clear();
        for (const entry of manifest.assets) {
            this.assetIndex.set(qualifyAssetIdentity(entry.identity), entry);
        }
    }

    private memoFallback(
        identity: LogicalAssetIdentity,
        error: AssetResolverError
    ): AssetFallback {
        const fallback: AssetFallback = {
            status: 'fallback',
            identity,
            reason: fallbackReasonForCode(error.code),
            error,
        };
        if (LogicalAssetIdentitySchema.safeParse(identity).success) {
            this.resolutionCache.set(qualifyAssetIdentity(identity), fallback);
        }
        return fallback;
    }

    private async loadStoredFallback(
        now: number
    ): Promise<ValidatedAssetRelease | null> {
        const valid = await this.loadValidStoredReleases(now);
        const candidate = valid
            .filter(
                release =>
                    release.record.storyId === this.source.storyId &&
                    targetsEqual(release.record.target, this.source.target)
            )
            .sort(
                (left, right) =>
                    right.record.lastUsedAt - left.record.lastUsedAt
            )[0];
        if (!candidate) {
            this.persistRecords(
                valid
                    .map(release => release.record)
                    .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
                    .slice(
                        0,
                        RUNTIME_ASSET_CACHE_POLICY.clientBounds
                            .maxValidatedReleases
                    )
            );
            return null;
        }
        const acceptedRecord = { ...candidate.record, lastUsedAt: now };
        this.acceptRelease(
            acceptedRecord,
            candidate.pointer,
            candidate.manifest
        );
        const nextRecords = upsertByReleaseId(
            valid.map(release => release.record),
            acceptedRecord
        )
            .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
            .slice(
                0,
                RUNTIME_ASSET_CACHE_POLICY.clientBounds.maxValidatedReleases
            );
        this.persistRecords(nextRecords);
        return {
            pointer: candidate.pointer,
            manifest: candidate.manifest,
            validatedAt: new Date(acceptedRecord.validatedAt).toISOString(),
            source: 'last-validated-release',
        };
    }

    private async persistAcceptedRecord(
        acceptedRecord: ValidatedReleaseRecord,
        now: number
    ): Promise<void> {
        const validRecords = (await this.loadValidStoredReleases(now)).map(
            release => release.record
        );
        const nextRecords = upsertByReleaseId(validRecords, acceptedRecord)
            .sort((left, right) => right.lastUsedAt - left.lastUsedAt)
            .slice(
                0,
                RUNTIME_ASSET_CACHE_POLICY.clientBounds.maxValidatedReleases
            );
        this.persistRecords(nextRecords);
    }

    private persistRecords(records: readonly ValidatedReleaseRecord[]): void {
        this.store.replace(records);
    }

    private async loadValidStoredReleases(
        now: number
    ): Promise<RevalidatedStoredRelease[]> {
        const rawRecords = [
            ...this.store.loadRaw(),
            ...(this.activeRecord ? [this.activeRecord] : []),
        ];
        const releases = await Promise.all(
            rawRecords.map(record => this.revalidateStoredRecord(record, now))
        );
        const unique = new Map<string, RevalidatedStoredRelease>();
        for (const release of releases) {
            if (!release) continue;
            const key = `${release.record.storyId}:${JSON.stringify(
                release.record.target
            )}:${release.record.releaseId}`;
            const previous = unique.get(key);
            if (
                !previous ||
                release.record.lastUsedAt > previous.record.lastUsedAt
            ) {
                unique.set(key, release);
            }
        }
        return [...unique.values()];
    }

    private async revalidateStoredRecord(
        value: unknown,
        now: number
    ): Promise<RevalidatedStoredRelease | null> {
        try {
            if (!isRecord(value)) return null;
            const target = parseTarget(value.target);
            if (
                typeof value.storyId !== 'string' ||
                typeof value.releaseId !== 'string' ||
                typeof value.pointerText !== 'string' ||
                typeof value.manifestText !== 'string' ||
                typeof value.validatedAt !== 'number' ||
                !Number.isFinite(value.validatedAt) ||
                typeof value.lastUsedAt !== 'number' ||
                !Number.isFinite(value.lastUsedAt) ||
                target === null
            ) {
                return null;
            }
            const age = now - value.validatedAt;
            if (age < 0 || age > VALIDATED_RELEASE_TTL_MS) return null;
            const pointer = parseActiveReleasePointer(
                parseJson(value.pointerText, 'stored active-release pointer'),
                target,
                value.storyId
            );
            if (
                pointer.releaseId !== value.releaseId ||
                pointer.storyId !== value.storyId
            ) {
                return null;
            }
            const manifestDigest = assertSha256<'manifest-bytes'>(
                await sha256Utf8Text(value.manifestText)
            );
            const manifest = parseRuntimeAssetManifest(
                parseJson(value.manifestText, 'stored runtime asset manifest')
            );
            validatePointerManifestPair(pointer, manifest, manifestDigest);
            const canonicalDigest = assertSha256<'release-content'>(
                await sha256Utf8Text(canonicalReleaseContent(manifest))
            );
            assertReleaseIdMatchesContentSha256(manifest, canonicalDigest);
            return {
                record: {
                    storyId: value.storyId,
                    target,
                    releaseId: value.releaseId,
                    pointerText: value.pointerText,
                    manifestText: value.manifestText,
                    validatedAt: value.validatedAt,
                    lastUsedAt: value.lastUsedAt,
                },
                pointer,
                manifest,
            };
        } catch {
            return null;
        }
    }
}
