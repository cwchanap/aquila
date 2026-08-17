import {
    RUNTIME_ASSET_CACHE_POLICY,
    getAudioCurrentPointerPath,
    getAudioObjectPath,
    getAudioReleaseManifestPath,
    parseAudioActiveReleasePointer,
    validatePointerManifestPair,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import {
    inspectImmutableCandidate,
    type PlannedImmutableCandidate,
} from './immutable-candidate';
import {
    normalizeReportDiagnostics,
    type ProgressSink,
    type PublisherReportV1,
} from './report';
import type { DeliveryStore, PointerSnapshot } from './stores/delivery-store';
import type { PreparedAudioRelease, PublisherActionV1 } from './types';
import { buildPreparedAudioRelease } from './audio-runtime-release';
import type { NormalizedAudioAsset } from './audio-encoder';
import type { AudioCoverageEntryV1 } from './audio-source';

const JSON_CONTENT_TYPE = 'application/json';
const IMMUTABLE_CACHE_CONTROL =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
const POINTER_CACHE_CONTROL =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export interface BuildAudioPublicationPlanFromAssets {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly assets?: readonly NormalizedAudioAsset[];
    readonly normalizedAssets?: readonly NormalizedAudioAsset[];
    readonly coverage: readonly AudioCoverageEntryV1[];
    readonly progress?: ProgressSink;
}

export interface BuildAudioPublicationPlanFromRelease {
    readonly store: DeliveryStore;
    readonly preparedRelease: PreparedAudioRelease;
    readonly progress?: ProgressSink;
}

export type BuildAudioPublicationPlanOptions =
    | BuildAudioPublicationPlanFromAssets
    | BuildAudioPublicationPlanFromRelease;

export type AudioAdvisoryPointerState =
    | {
          readonly exists: false;
          readonly etag?: never;
          readonly beforeReleaseId?: never;
          readonly activationNeeded: true;
      }
    | {
          readonly exists: true;
          readonly etag: string;
          readonly beforeReleaseId: string;
          readonly activationNeeded: boolean;
      };

export interface AudioPublicationPlan {
    readonly preparedRelease: PreparedAudioRelease;
    readonly objects: readonly PlannedImmutableCandidate[];
    readonly manifest: PlannedImmutableCandidate;
    readonly advisoryPointer: AudioAdvisoryPointerState;
    readonly report: PublisherReportV1;
}

function progress(
    sink: ProgressSink | undefined,
    event: Parameters<ProgressSink>[0]
): void {
    sink?.(event);
}

function isReleaseInput(
    options: BuildAudioPublicationPlanOptions
): options is BuildAudioPublicationPlanFromRelease {
    return 'preparedRelease' in options;
}

function preparedReleaseFrom(
    options: BuildAudioPublicationPlanOptions
): PreparedAudioRelease {
    if (isReleaseInput(options)) return options.preparedRelease;
    return buildPreparedAudioRelease({
        storyId: options.storyId,
        target: options.target,
        ...(options.assets === undefined ? {} : { assets: options.assets }),
        ...(options.normalizedAssets === undefined
            ? {}
            : { normalizedAssets: options.normalizedAssets }),
        coverage: options.coverage,
    });
}

async function advisoryPointerState(
    store: DeliveryStore,
    preparedRelease: PreparedAudioRelease
): Promise<AudioAdvisoryPointerState> {
    const key = getAudioCurrentPointerPath(
        preparedRelease.storyId,
        preparedRelease.target
    );
    let snapshot: PointerSnapshot;
    try {
        snapshot = await store.inspectPointer(key);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to read advisory audio pointer',
            {
                cause: {
                    classification: 'delivery-store-pointer-read-failure',
                },
                context: { key },
            }
        );
    }
    if (!snapshot.exists) return { exists: false, activationNeeded: true };
    if (
        snapshot.contentType !== JSON_CONTENT_TYPE ||
        snapshot.cacheControl !== POINTER_CACHE_CONTROL
    ) {
        throw new PublisherError(
            'integrity',
            'Advisory audio pointer has conflicting required metadata',
            { context: { key } }
        );
    }

    let pointer;
    try {
        pointer = parseAudioActiveReleasePointer(
            JSON.parse(textDecoder.decode(snapshot.bytes)),
            preparedRelease.target,
            preparedRelease.storyId
        );
    } catch (cause) {
        throw new PublisherError(
            'integrity',
            'Advisory audio pointer is invalid',
            {
                cause,
                context: { key },
            }
        );
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
                'Advisory audio pointer conflicts with candidate manifest',
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

function uniqueAudioAssets(
    preparedRelease: PreparedAudioRelease
): readonly NormalizedAudioAsset[] {
    const byPath = new Map<string, NormalizedAudioAsset>();
    for (const asset of preparedRelease.assets) {
        if (!byPath.has(asset.path)) byPath.set(asset.path, asset);
    }
    return [...byPath.values()].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    );
}

function inputActions(
    coverage: readonly AudioCoverageEntryV1[]
): PublisherActionV1[] {
    return coverage.map(entry => ({
        stage: 'input',
        kind: entry.disposition === 'included' ? 'include' : 'omit',
        identity: `${entry.type}:${entry.key}`,
    }));
}

export async function buildAudioPublicationPlan(
    options: BuildAudioPublicationPlanOptions
): Promise<AudioPublicationPlan> {
    const preparedRelease = preparedReleaseFrom(options);
    progress(options.progress, {
        stage: 'input',
        completed: 1,
        total: 1,
        message: 'prepared audio release inputs',
    });

    const objects: PlannedImmutableCandidate[] = [];
    const assets = uniqueAudioAssets(preparedRelease);
    for (const [index, asset] of assets.entries()) {
        const path = getAudioObjectPath(asset.sha256);
        objects.push(
            await inspectImmutableCandidate(options.store, {
                kind: 'object',
                key: path,
                bytes: asset.bytes,
                contentType: 'audio/mpeg',
                cacheControl: IMMUTABLE_CACHE_CONTROL,
                identity: `${asset.type}:${asset.key}`,
            })
        );
        progress(options.progress, {
            stage: 'inspect',
            completed: index + 1,
            total: assets.length + 1,
            message: `inspected ${asset.type}:${asset.key}`,
        });
    }

    const manifest = await inspectImmutableCandidate(options.store, {
        kind: 'manifest',
        key: getAudioReleaseManifestPath(
            preparedRelease.storyId,
            preparedRelease.releaseId,
            preparedRelease.target
        ),
        bytes: preparedRelease.manifestBytes,
        contentType: JSON_CONTENT_TYPE,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
    });
    progress(options.progress, {
        stage: 'inspect',
        completed: assets.length + 1,
        total: assets.length + 1,
        message: 'inspected audio release manifest',
    });

    const advisoryPointer = await advisoryPointerState(
        options.store,
        preparedRelease
    );
    const actions: PublisherActionV1[] = [
        ...inputActions(preparedRelease.coverage),
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
                    ? ('create-manifest' as const)
                    : ('reuse-manifest' as const),
            key: manifest.key,
        },
        advisoryPointer.activationNeeded
            ? {
                  stage: 'activation',
                  kind: 'write-pointer' as const,
                  key: getAudioCurrentPointerPath(
                      preparedRelease.storyId,
                      preparedRelease.target
                  ),
              }
            : { stage: 'activation', kind: 'no-op' as const },
    ];
    const objectsCreated = objects.filter(
        candidate => candidate.status === 'create'
    ).length;
    const objectsReused = objects.filter(
        candidate => candidate.status === 'reuse'
    ).length;
    const manifestCreated = manifest.status === 'create' ? 1 : 0;
    const manifestReused = manifest.status === 'reuse' ? 1 : 0;
    const included = preparedRelease.coverage.filter(
        entry => entry.disposition === 'included'
    ).length;
    const omitted = preparedRelease.coverage.length - included;
    const report: PublisherReportV1 = {
        schemaVersion: 1,
        command: 'plan',
        status:
            objectsCreated > 0 ||
            manifestCreated > 0 ||
            advisoryPointer.activationNeeded
                ? 'success'
                : 'no-op',
        storyId: preparedRelease.storyId,
        target: preparedRelease.target,
        media: 'audio',
        releaseId: preparedRelease.releaseId,
        manifestSha256: preparedRelease.manifestSha256,
        audioCoverage: preparedRelease.coverage,
        counts: {
            included,
            omitted,
            objectsCreated,
            objectsReused,
            manifestsCreated: manifestCreated,
            manifestsReused: manifestReused,
            pointersWritten: 0,
        },
        actions,
        warnings: [],
        errors: [],
        pointer: {
            ...(advisoryPointer.beforeReleaseId === undefined
                ? {}
                : { beforeReleaseId: advisoryPointer.beforeReleaseId }),
            afterReleaseId: preparedRelease.releaseId,
            changed: advisoryPointer.activationNeeded,
        },
    };
    report.warnings = normalizeReportDiagnostics(report.warnings);
    report.errors = normalizeReportDiagnostics(report.errors);
    return { preparedRelease, objects, manifest, advisoryPointer, report };
}
