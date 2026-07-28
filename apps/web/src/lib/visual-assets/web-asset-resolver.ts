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
import { getBrowserStorage } from '@/lib/reader-mode';
import { sha256Hex, utf8Bytes } from './hash';
import { ValidatedReleaseStore } from './validated-release-store';

const VALIDATED_RELEASE_TTL_MS =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.staleIfErrorMs;

export type ValidatedReleaseRecord = {
    source: AssetResolverSource;
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

type LoadContext = {
    validStoredReleases?: Promise<RevalidatedStoredRelease[]>;
};

export type WebAssetResolverOptions = {
    fetchImpl?: typeof fetch;
    store?: ValidatedReleaseStore;
    now?: () => number;
};

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

function hasExactKeys(
    value: Record<string, unknown>,
    expected: readonly string[]
): boolean {
    const keys = Object.keys(value).sort();
    return (
        keys.length === expected.length &&
        keys.every((key, index) => key === expected[index])
    );
}

function normalizeBaseUrl(baseUrl: string): string {
    const marker = resolveAssetUrl(baseUrl, 'source-boundary');
    return new URL('.', marker).href;
}

function normalizeSource(source: AssetResolverSource): AssetResolverSource {
    return {
        ...source,
        baseUrl: normalizeBaseUrl(source.baseUrl),
    };
}

function parseStoredSource(value: unknown): AssetResolverSource | null {
    if (
        !isRecord(value) ||
        !hasExactKeys(value, ['baseUrl', 'environment', 'storyId', 'target']) ||
        typeof value.storyId !== 'string' ||
        typeof value.baseUrl !== 'string'
    ) {
        return null;
    }
    const target = parseTarget(value.target);
    if (target === null) return null;

    let source: AssetResolverSource;
    if (value.environment === 'local') {
        source = {
            environment: 'local',
            storyId: value.storyId,
            baseUrl: value.baseUrl,
            target,
        };
    } else if (value.environment === 'preview' && target.kind === 'preview') {
        source = {
            environment: 'preview',
            storyId: value.storyId,
            baseUrl: value.baseUrl,
            target,
        };
    } else if (
        value.environment === 'production' &&
        target.kind === 'production'
    ) {
        source = {
            environment: 'production',
            storyId: value.storyId,
            baseUrl: value.baseUrl,
            target,
        };
    } else {
        return null;
    }

    const normalized = normalizeSource(source);
    return normalized.baseUrl === source.baseUrl ? normalized : null;
}

function sourcesEqual(
    left: AssetResolverSource,
    right: AssetResolverSource
): boolean {
    return (
        left.environment === right.environment &&
        left.storyId === right.storyId &&
        left.baseUrl === right.baseUrl &&
        targetsEqual(left.target, right.target)
    );
}

function sourceKey(source: AssetResolverSource): string {
    return JSON.stringify([
        source.environment,
        source.storyId,
        source.baseUrl,
        source.target,
    ]);
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
                !sourcesEqual(record.source, accepted.source)
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

async function fetchWithTimeout<T>(
    fetchImpl: typeof fetch,
    url: URL,
    timeoutMs: number,
    init: RequestInit,
    parentSignal: AbortSignal | undefined,
    callback: (response: Response) => Promise<T>
): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    const abort = () => controller.abort();
    parentSignal?.addEventListener('abort', abort, { once: true });
    try {
        const response = await fetchImpl(url, {
            ...init,
            signal: controller.signal,
        });
        return await callback(response);
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
    try {
        return await fetchWithTimeout(
            fetchImpl,
            url,
            timeoutMs,
            { cache },
            signal,
            async response => {
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
        );
    } catch (error) {
        throw asResolverError(error);
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
    private lifecycleGeneration = 0;

    constructor(
        source: AssetResolverSource,
        options: WebAssetResolverOptions = {}
    ) {
        this.source = normalizeSource(source);
        this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
        this.store =
            options.store ?? new ValidatedReleaseStore(getBrowserStorage());
        this.now = options.now ?? Date.now;
    }

    async loadActiveRelease(options?: {
        signal?: AbortSignal;
    }): Promise<ValidatedAssetRelease> {
        const loadController = new AbortController();
        const generation = this.lifecycleGeneration;
        const abort = () => loadController.abort();
        options?.signal?.addEventListener('abort', abort, { once: true });
        this.inFlightLoads.add(loadController);
        try {
            const loadContext: LoadContext = {};
            await this.seedNewestStoredPublishedAt(
                this.now(),
                generation,
                loadController.signal,
                loadContext
            );
            return await this.loadFromNetwork(
                loadController.signal,
                generation,
                loadContext
            );
        } catch (error) {
            const resolverError = asResolverError(error);
            if (!this.isLoadCurrent(generation, loadController.signal)) {
                throw resolverError;
            }
            this.lastLoadError = resolverError;
            const fallback = await this.loadStoredFallback(
                this.now(),
                generation,
                loadController.signal
            );
            if (fallback) return fallback;
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
        this.lifecycleGeneration += 1;
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
        signal: AbortSignal,
        generation: number,
        loadContext: LoadContext
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
            source: this.source,
            releaseId: pointer.releaseId,
            pointerText,
            manifestText,
            validatedAt: now,
            lastUsedAt: now,
        };
        this.assertLoadCanActivate(pointer, generation, signal);
        this.acceptRelease(record, pointer, manifest);
        await this.persistAcceptedRecord(record, now, loadContext);
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

    private isLoadCurrent(generation: number, signal: AbortSignal): boolean {
        return generation === this.lifecycleGeneration && !signal.aborted;
    }

    private assertLoadCanActivate(
        pointer: ActiveReleasePointerV1,
        generation: number,
        signal: AbortSignal
    ): void {
        if (!this.isLoadCurrent(generation, signal)) {
            throw new AssetResolverError(
                'network',
                'Runtime asset load was cancelled'
            );
        }
        this.assertNotOlder(pointer);
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
        now: number,
        generation: number,
        signal: AbortSignal
    ): Promise<ValidatedAssetRelease | null> {
        const valid = await this.loadValidStoredReleases(now);
        const candidate = valid
            .filter(release => sourcesEqual(release.record.source, this.source))
            .sort(
                (left, right) =>
                    Date.parse(right.pointer.publishedAt) -
                        Date.parse(left.pointer.publishedAt) ||
                    right.record.validatedAt - left.record.validatedAt
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
        this.assertLoadCanActivate(candidate.pointer, generation, signal);
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
        now: number,
        loadContext: LoadContext
    ): Promise<void> {
        const validRecords = (
            await this.loadValidStoredReleases(now, loadContext)
        ).map(release => release.record);
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
        now: number,
        loadContext?: LoadContext
    ): Promise<RevalidatedStoredRelease[]> {
        if (loadContext?.validStoredReleases) {
            return loadContext.validStoredReleases;
        }
        const promise = this.computeValidStoredReleases(now);
        if (loadContext) {
            loadContext.validStoredReleases = promise;
        }
        return promise;
    }

    private async computeValidStoredReleases(
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
            const key = `${sourceKey(release.record.source)}:${
                release.record.releaseId
            }`;
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
            if (
                !isRecord(value) ||
                !hasExactKeys(value, [
                    'lastUsedAt',
                    'manifestText',
                    'pointerText',
                    'releaseId',
                    'source',
                    'validatedAt',
                ])
            ) {
                return null;
            }
            const source = parseStoredSource(value.source);
            if (
                typeof value.releaseId !== 'string' ||
                typeof value.pointerText !== 'string' ||
                typeof value.manifestText !== 'string' ||
                typeof value.validatedAt !== 'number' ||
                !Number.isFinite(value.validatedAt) ||
                typeof value.lastUsedAt !== 'number' ||
                !Number.isFinite(value.lastUsedAt) ||
                source === null
            ) {
                return null;
            }
            const age = now - value.validatedAt;
            if (age < 0 || age > VALIDATED_RELEASE_TTL_MS) return null;
            const pointer = parseActiveReleasePointer(
                parseJson(value.pointerText, 'stored active-release pointer'),
                source.target,
                source.storyId
            );
            if (
                pointer.releaseId !== value.releaseId ||
                pointer.storyId !== source.storyId
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
                    source,
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

    private async seedNewestStoredPublishedAt(
        now: number,
        generation: number,
        signal: AbortSignal,
        loadContext: LoadContext
    ): Promise<void> {
        const valid = await this.loadValidStoredReleases(now, loadContext);
        if (!this.isLoadCurrent(generation, signal)) {
            throw new AssetResolverError(
                'network',
                'Runtime asset load was cancelled'
            );
        }
        for (const release of valid) {
            if (!sourcesEqual(release.record.source, this.source)) continue;
            this.newestPublishedAt = Math.max(
                this.newestPublishedAt,
                Date.parse(release.pointer.publishedAt)
            );
        }
    }
}
