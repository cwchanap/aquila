import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    getCurrentPointerPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    qualifyAssetIdentity,
    validatePointerManifestPair,
    type PublicationTarget,
    type StoryAssetReleasePlanEntryV1,
} from '@aquila/stories/runtime-assets';
import { discoverAuthoringCatalog } from './authoring-catalog';
import { validatePublisherCoverage } from './coverage';
import { evaluateSourceDiagnostics } from './encoder-policy';
import { PublisherError } from './errors';
import { encodeAsset, getEncoderFingerprint } from './image-encoder';
import { loadReleasePlan, resolveReleasePlanPath } from './release-plan';
import {
    normalizeReportDiagnostics,
    type ProgressSink,
    type PublisherReportV1,
} from './report';
import { buildPreparedRelease } from './runtime-release';
import { resolveIncludedSources, resolveSourceRoot } from './source-files';
import type {
    DeliveryStore,
    PointerSnapshot,
    StoredObject,
    StoredObjectMetadata,
} from './stores/delivery-store';
import type {
    EncodedAsset,
    EncodedVariant,
    PreparedRelease,
    PublisherActionV1,
} from './types';

const JSON_CONTENT_TYPE = 'application/json';
const IMMUTABLE_CACHE_CONTROL =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
const POINTER_CACHE_CONTROL =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export interface BuildPublicationPlanOptions {
    readonly repositoryRoot: string;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly store: DeliveryStore;
    readonly releasePlanPath?: string;
    readonly sourceRoot?: string;
    readonly environment?: Readonly<Record<string, string | undefined>>;
    readonly progress?: ProgressSink;
}

export interface PlannedImmutableCandidate {
    readonly kind: 'object' | 'manifest';
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly cacheControl: string;
    readonly status: 'create' | 'reuse';
    readonly identity?: string;
}

export type AdvisoryPointerState =
    | {
          readonly exists: false;
          readonly etag?: never;
          readonly beforeReleaseId?: never;
          readonly activationNeeded: true;
      }
    | {
          readonly exists: true;
          /**
           * Opaque plan-time identity used only to detect pointer drift. It is
           * never reused as the final activation CAS expectation.
           */
          readonly etag: string;
          readonly beforeReleaseId: string;
          readonly activationNeeded: boolean;
      };

export interface PublicationPlan {
    readonly preparedRelease: PreparedRelease;
    readonly objects: readonly PlannedImmutableCandidate[];
    readonly manifest: PlannedImmutableCandidate;
    /**
     * A planning observation only. It retains the opaque ETag solely as drift
     * identity and excludes raw bytes; publication must obtain a separate fresh
     * snapshot and must never use this ETag as its final CAS expectation.
     */
    readonly advisoryPointer: AdvisoryPointerState;
    readonly report: PublisherReportV1;
}

interface CandidateInput {
    readonly kind: PlannedImmutableCandidate['kind'];
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly cacheControl: string;
    readonly identity?: string;
}

function compareText(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((byte, index) => byte === right[index]);
}

function requiredMetadataMatches(
    actual: StoredObjectMetadata,
    candidate: CandidateInput
): boolean {
    return (
        actual.key === candidate.key &&
        actual.byteLength === candidate.bytes.byteLength &&
        actual.contentType === candidate.contentType &&
        actual.cacheControl === candidate.cacheControl
    );
}

function immutableConflict(candidate: CandidateInput): PublisherError {
    return new PublisherError(
        'integrity',
        candidate.kind === 'manifest'
            ? 'Existing immutable manifest conflicts with candidate'
            : 'Existing content-addressed object conflicts with candidate',
        {
            context: {
                stage:
                    candidate.kind === 'manifest'
                        ? 'manifest'
                        : 'object-inspection',
                key: candidate.key,
            },
        }
    );
}

async function inspectImmutableCandidate(
    store: DeliveryStore,
    candidate: CandidateInput
): Promise<PlannedImmutableCandidate> {
    let metadata: StoredObjectMetadata | null;
    try {
        metadata = await store.stat(candidate.key);
    } catch (cause) {
        if (cause instanceof PublisherError) throw cause;
        throw new PublisherError('storage', 'Unable to inspect destination', {
            cause: { classification: 'delivery-store-inspection-failure' },
            context: { key: candidate.key },
        });
    }
    if (metadata === null) return { ...candidate, status: 'create' };
    if (!requiredMetadataMatches(metadata, candidate)) {
        throw immutableConflict(candidate);
    }

    let stored: StoredObject;
    try {
        stored = await store.read(candidate.key);
    } catch (cause) {
        if (cause instanceof PublisherError) throw cause;
        throw new PublisherError(
            'storage',
            'Unable to verify existing immutable destination object',
            {
                cause: { classification: 'delivery-store-read-failure' },
                context: { key: candidate.key },
            }
        );
    }
    if (
        !requiredMetadataMatches(stored, candidate) ||
        !bytesEqual(stored.bytes, candidate.bytes)
    ) {
        throw immutableConflict(candidate);
    }
    return { ...candidate, status: 'reuse' };
}

function includedEntries(
    entries: readonly StoryAssetReleasePlanEntryV1[]
): Extract<StoryAssetReleasePlanEntryV1, { disposition: 'included' }>[] {
    return entries.filter(
        (
            entry
        ): entry is Extract<
            StoryAssetReleasePlanEntryV1,
            { disposition: 'included' }
        > => entry.disposition === 'included'
    );
}

function inputActions(
    entries: readonly StoryAssetReleasePlanEntryV1[]
): PublisherActionV1[] {
    return [...entries]
        .sort((left, right) =>
            compareText(
                qualifyAssetIdentity(left.identity),
                qualifyAssetIdentity(right.identity)
            )
        )
        .map(entry => ({
            stage: 'input',
            kind: entry.disposition === 'included' ? 'include' : 'omit',
            identity: qualifyAssetIdentity(entry.identity),
        }));
}

function uniqueVariants(encodedAssets: readonly EncodedAsset[]): Array<{
    variant: EncodedVariant;
    identity: string;
}> {
    const byKey = new Map<
        string,
        { variant: EncodedVariant; identity: string }
    >();
    for (const asset of encodedAssets) {
        const identity = qualifyAssetIdentity(asset.identity);
        for (const variant of asset.variants) {
            const current = byKey.get(variant.path);
            if (
                current === undefined ||
                compareText(identity, current.identity) < 0
            ) {
                byKey.set(variant.path, { variant, identity });
            }
        }
    }
    return [...byKey.values()].sort((left, right) =>
        compareText(left.variant.path, right.variant.path)
    );
}

async function advisoryPointerState(
    store: DeliveryStore,
    storyId: string,
    target: PublicationTarget,
    preparedRelease: PreparedRelease
): Promise<AdvisoryPointerState> {
    const key = getCurrentPointerPath(storyId, target);
    let snapshot: PointerSnapshot;
    try {
        snapshot = await store.inspectPointer(key);
    } catch {
        throw new PublisherError('storage', 'Unable to read advisory pointer', {
            cause: { classification: 'delivery-store-pointer-read-failure' },
            context: { key },
        });
    }
    if (!snapshot.exists) {
        return { exists: false, activationNeeded: true };
    }
    if (
        snapshot.contentType !== JSON_CONTENT_TYPE ||
        snapshot.cacheControl !== POINTER_CACHE_CONTROL
    ) {
        throw new PublisherError(
            'integrity',
            'Advisory pointer has conflicting required metadata',
            { context: { key } }
        );
    }
    let pointer;
    try {
        pointer = parseActiveReleasePointer(
            JSON.parse(textDecoder.decode(snapshot.bytes)),
            target,
            storyId
        );
    } catch (cause) {
        throw new PublisherError('integrity', 'Advisory pointer is invalid', {
            cause,
            context: { key },
        });
    }
    if (pointer.releaseId === preparedRelease.releaseId) {
        try {
            validatePointerManifestPair(
                pointer,
                preparedRelease.manifest,
                preparedRelease.manifestSha256
            );
        } catch (cause) {
            throw new PublisherError(
                'integrity',
                'Advisory pointer conflicts with candidate manifest',
                { cause, context: { key } }
            );
        }
    }
    return {
        exists: true,
        etag: snapshot.etag,
        beforeReleaseId: pointer.releaseId,
        activationNeeded: pointer.releaseId !== preparedRelease.releaseId,
    };
}

function progress(
    sink: ProgressSink | undefined,
    event: Parameters<ProgressSink>[0]
): void {
    sink?.(event);
}

export async function buildPublicationPlan(
    options: BuildPublicationPlanOptions
): Promise<PublicationPlan> {
    const temporaryWorkspace = await mkdtemp(
        join(tmpdir(), 'aquila-publication-plan-')
    );
    try {
        progress(options.progress, {
            stage: 'input',
            completed: 0,
            total: 2,
            message: 'loading publication inputs',
        });
        const catalog = await discoverAuthoringCatalog(
            options.repositoryRoot,
            options.storyId
        );
        progress(options.progress, {
            stage: 'input',
            completed: 1,
            total: 2,
            message: 'loaded authoring catalog',
        });
        const planPath = await resolveReleasePlanPath({
            repositoryRoot: options.repositoryRoot,
            storyId: options.storyId,
            target: options.target,
            ...(options.releasePlanPath === undefined
                ? {}
                : { explicitPath: options.releasePlanPath }),
        });
        const releasePlan = await loadReleasePlan(planPath);
        progress(options.progress, {
            stage: 'input',
            completed: 2,
            total: 2,
            message: 'loaded release plan',
        });

        const selectedSourceRoot = await resolveSourceRoot({
            repositoryRoot: options.repositoryRoot,
            ...(options.sourceRoot === undefined
                ? {}
                : { explicitPath: options.sourceRoot }),
            environment: options.environment ?? process.env,
        });
        const included = includedEntries(releasePlan.entries);
        const resolved = await resolveIncludedSources({
            sourceRoot: selectedSourceRoot,
            includedEntries: included,
        });
        progress(options.progress, {
            stage: 'source',
            completed: resolved.sources.length,
            total: included.length,
            message: 'resolved included sources',
        });

        const coverage = validatePublisherCoverage({
            catalog,
            plan: releasePlan,
            target: options.target,
            availableSourcePaths: resolved.availableSourcePaths,
        });
        const catalogByIdentity = new Map(
            catalog.assets.map(asset => [
                qualifyAssetIdentity(asset.identity),
                asset,
            ])
        );
        const planByIdentity = new Map(
            included.map(entry => [qualifyAssetIdentity(entry.identity), entry])
        );
        const encodedAssets: EncodedAsset[] = [];
        const sourceWarnings = [];
        for (const [index, source] of resolved.sources.entries()) {
            sourceWarnings.push(...evaluateSourceDiagnostics(source));
            const identity = qualifyAssetIdentity(source.identity);
            const authoring = catalogByIdentity.get(identity);
            const planned = planByIdentity.get(identity);
            encodedAssets.push(
                await encodeAsset({
                    identity: source.identity,
                    sourcePath: source.sourcePath,
                    bytes: source.bytes,
                    ...(authoring?.section === undefined
                        ? {}
                        : { authoringSection: authoring.section }),
                    ...(planned?.section === undefined
                        ? {}
                        : { planSection: planned.section }),
                })
            );
            progress(options.progress, {
                stage: 'encode',
                completed: index + 1,
                total: resolved.sources.length,
                message: `encoded ${identity}`,
            });
        }

        const preparedRelease = buildPreparedRelease({
            storyId: options.storyId,
            target: options.target,
            releasePlan,
            encodedAssets,
            coverage,
        });
        const variants = uniqueVariants(encodedAssets);
        const objects: PlannedImmutableCandidate[] = [];
        for (const [index, { variant, identity }] of variants.entries()) {
            objects.push(
                await inspectImmutableCandidate(options.store, {
                    kind: 'object',
                    key: variant.path,
                    bytes: variant.bytes,
                    contentType: variant.contentType,
                    cacheControl: IMMUTABLE_CACHE_CONTROL,
                    identity,
                })
            );
            progress(options.progress, {
                stage: 'inspect',
                completed: index + 1,
                total: variants.length + 1,
                message: `inspected ${identity}`,
            });
        }

        const manifest = await inspectImmutableCandidate(options.store, {
            kind: 'manifest',
            key: getReleaseManifestPath(
                options.storyId,
                preparedRelease.releaseId,
                options.target
            ),
            bytes: preparedRelease.manifestBytes,
            contentType: JSON_CONTENT_TYPE,
            cacheControl: IMMUTABLE_CACHE_CONTROL,
        });
        progress(options.progress, {
            stage: 'inspect',
            completed: variants.length + 1,
            total: variants.length + 1,
            message: 'inspected release manifest',
        });
        const advisoryPointer = await advisoryPointerState(
            options.store,
            options.storyId,
            options.target,
            preparedRelease
        );

        const actions: PublisherActionV1[] = [
            ...inputActions(releasePlan.entries),
            ...objects.map(candidate => ({
                stage: 'object-inspection',
                kind:
                    candidate.status === 'create'
                        ? ('create-object' as const)
                        : ('reuse-object' as const),
                ...(candidate.identity === undefined
                    ? {}
                    : { identity: candidate.identity }),
                key: candidate.key,
            })),
            {
                stage: 'manifest',
                kind:
                    manifest.status === 'create'
                        ? 'create-manifest'
                        : 'reuse-manifest',
                key: manifest.key,
            },
            advisoryPointer.activationNeeded
                ? {
                      stage: 'activation',
                      kind: 'write-pointer',
                      key: getCurrentPointerPath(
                          options.storyId,
                          options.target
                      ),
                  }
                : { stage: 'activation', kind: 'no-op' },
        ];
        const immutableChange =
            objects.some(candidate => candidate.status === 'create') ||
            manifest.status === 'create';
        const warnings = normalizeReportDiagnostics(sourceWarnings);
        const report: PublisherReportV1 = {
            schemaVersion: 1,
            command: 'plan',
            status:
                immutableChange || advisoryPointer.activationNeeded
                    ? 'success'
                    : 'no-op',
            storyId: options.storyId,
            target: options.target,
            releaseId: preparedRelease.releaseId,
            manifestSha256: preparedRelease.manifestSha256,
            encoderFingerprint: getEncoderFingerprint(),
            coverage,
            counts: {
                included: coverage.totals.included,
                omitted: coverage.totals.omitted,
                objectsCreated: objects.filter(
                    candidate => candidate.status === 'create'
                ).length,
                objectsReused: objects.filter(
                    candidate => candidate.status === 'reuse'
                ).length,
                manifestsCreated: manifest.status === 'create' ? 1 : 0,
                manifestsReused: manifest.status === 'reuse' ? 1 : 0,
                pointersWritten: 0,
            },
            actions,
            warnings,
            errors: [],
            pointer: {
                ...(advisoryPointer.beforeReleaseId === undefined
                    ? {}
                    : {
                          beforeReleaseId: advisoryPointer.beforeReleaseId,
                      }),
                afterReleaseId: preparedRelease.releaseId,
                changed: advisoryPointer.activationNeeded,
            },
        };
        return { preparedRelease, objects, manifest, advisoryPointer, report };
    } finally {
        await rm(temporaryWorkspace, { recursive: true, force: true });
    }
}
