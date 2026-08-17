import {
    compareQualifiedAssetIds,
    isSafeLogicalKey,
    isSha256,
    isStoryId,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import {
    normalizeAudioAsset,
    type AudioDurationWarning,
    type AudioProcessRunner,
    type NormalizedAudioAsset,
} from './audio-encoder';
import {
    buildAudioPublicationPlan,
    type AudioPublicationPlan,
} from './audio-publication-plan';
import { buildPreparedAudioRelease } from './audio-runtime-release';
import { sourceArchiveCandidates, type AudioSourcePlan } from './audio-source';
import { verifyStoredAudioRelease } from './audio-candidate-verifier';
import { PublisherError } from './errors';
import {
    inspectImmutableCandidate,
    publishImmutableCandidate,
    type PlannedImmutableCandidate,
} from './immutable-candidate';
import { sha256Bytes } from './hash';
import { type ProgressSink, type PublisherReportV1 } from './report';
import type { DeliveryStore } from './stores/delivery-store';
import type { PublisherActionV1 } from './types';

export interface PublishAudioReleaseOptions {
    readonly store: DeliveryStore;
    readonly sourceStore: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly sourcePlan: AudioSourcePlan;
    readonly run?: AudioProcessRunner;
    readonly onWarning?: (warning: AudioDurationWarning) => void;
    readonly progress?: ProgressSink;
}

type ImmutableResult = 'created' | 'reused';

function progress(
    sink: ProgressSink | undefined,
    event: Parameters<ProgressSink>[0]
): void {
    sink?.(event);
}

function inputError(message: string): PublisherError {
    return new PublisherError('input', message, {
        context: { stage: 'input', input: 'audio-publish' },
    });
}

function validateSourcePlan(
    storyId: string,
    sourcePlan: AudioSourcePlan
): void {
    if (!isStoryId(storyId) || sourcePlan.storyId !== storyId) {
        throw inputError(
            'Audio source plan story id does not match the release'
        );
    }

    const identities = new Set<string>();
    for (const source of sourcePlan.sources) {
        const identity = `${source.type}:${source.key}`;
        if (identities.has(identity)) {
            throw inputError('Audio source plan contains duplicate cues');
        }
        identities.add(identity);
        if (!isSafeLogicalKey(source.key)) {
            throw inputError('Audio source plan contains an unsafe cue key');
        }
        if (!isSha256(source.sourceSha256)) {
            throw inputError(
                'Audio source plan contains an invalid source digest'
            );
        }
        if (sha256Bytes(source.sourceBytes) !== source.sourceSha256) {
            throw inputError('Audio source bytes do not match their digest');
        }
        if (source.receiptBytes.byteLength === 0) {
            throw inputError('Audio source plan contains an empty receipt');
        }
    }
}

async function normalizeSources(
    sourcePlan: AudioSourcePlan,
    options: PublishAudioReleaseOptions
): Promise<readonly NormalizedAudioAsset[]> {
    const sources = [...sourcePlan.sources].sort((left, right) =>
        compareQualifiedAssetIds(
            `${left.type}:${left.key}`,
            `${right.type}:${right.key}`
        )
    );
    const normalized: NormalizedAudioAsset[] = [];
    for (const source of sources) {
        normalized.push(
            await normalizeAudioAsset(source, {
                run: options.run,
                onWarning: options.onWarning,
            })
        );
    }
    return normalized;
}

async function inspectArchive(
    sourcePlan: AudioSourcePlan,
    sourceStore: DeliveryStore
): Promise<readonly PlannedImmutableCandidate[]> {
    const candidates = sourceArchiveCandidates(sourcePlan);
    const plans: PlannedImmutableCandidate[] = [];
    for (const candidate of candidates) {
        plans.push(await inspectImmutableCandidate(sourceStore, candidate));
    }
    return plans;
}

async function publishArchive(
    candidates: readonly PlannedImmutableCandidate[],
    sourceStore: DeliveryStore
): Promise<void> {
    for (const candidate of candidates) {
        await publishImmutableCandidate(sourceStore, candidate);
    }
}

async function publishObjects(
    plan: AudioPublicationPlan,
    store: DeliveryStore
): Promise<readonly ImmutableResult[]> {
    const results: ImmutableResult[] = [];
    for (const candidate of plan.objects) {
        results.push(await publishImmutableCandidate(store, candidate));
    }
    return results;
}

function publishReport(
    plan: AudioPublicationPlan,
    objectResults: readonly ImmutableResult[],
    manifestResult: ImmutableResult
): PublisherReportV1 {
    const objectsCreated = objectResults.filter(
        result => result === 'created'
    ).length;
    const manifestsCreated = manifestResult === 'created' ? 1 : 0;
    const actions: PublisherActionV1[] = [
        ...plan.report.actions.filter(action => action.stage === 'input'),
        ...plan.objects.map((candidate, index) => ({
            stage: 'object-upload',
            kind:
                objectResults[index] === 'created'
                    ? ('create-object' as const)
                    : ('reuse-object' as const),
            ...(candidate.identity === undefined
                ? {}
                : { identity: candidate.identity }),
            key: candidate.key,
        })),
        {
            stage: 'manifest-upload',
            kind:
                manifestResult === 'created'
                    ? ('create-manifest' as const)
                    : ('reuse-manifest' as const),
            key: plan.manifest.key,
        },
        { stage: 'activation', kind: 'no-op' },
    ];
    return {
        ...plan.report,
        command: 'publish',
        status:
            objectsCreated > 0 || manifestsCreated > 0 ? 'success' : 'no-op',
        counts: {
            ...plan.report.counts,
            objectsCreated,
            objectsReused: objectResults.length - objectsCreated,
            manifestsCreated,
            manifestsReused: 1 - manifestsCreated,
            pointersWritten: 0,
        },
        actions,
        pointer: {
            ...(plan.advisoryPointer.beforeReleaseId === undefined
                ? {}
                : { beforeReleaseId: plan.advisoryPointer.beforeReleaseId }),
            changed: false,
        },
    };
}

export async function publishAudioRelease(
    options: PublishAudioReleaseOptions
): Promise<PublisherReportV1> {
    validateSourcePlan(options.storyId, options.sourcePlan);
    progress(options.progress, {
        stage: 'input',
        completed: 1,
        total: 1,
        message: 'validated audio publish inputs',
    });

    const normalizedAssets = await normalizeSources(
        options.sourcePlan,
        options
    );
    progress(options.progress, {
        stage: 'encode',
        completed: normalizedAssets.length,
        total: normalizedAssets.length,
        message: 'normalized audio sources',
    });

    const preparedRelease = buildPreparedAudioRelease({
        storyId: options.storyId,
        target: options.target,
        assets: normalizedAssets,
        coverage: options.sourcePlan.coverage,
    });

    const archivePlans = await inspectArchive(
        options.sourcePlan,
        options.sourceStore
    );
    progress(options.progress, {
        stage: 'inspect',
        completed: archivePlans.length,
        total: archivePlans.length,
        message: 'inspected audio archive candidates',
    });
    await publishArchive(archivePlans, options.sourceStore);
    progress(options.progress, {
        stage: 'upload',
        completed: archivePlans.length,
        total: archivePlans.length,
        message: 'archived audio sources',
    });

    const plan = await buildAudioPublicationPlan({
        store: options.store,
        preparedRelease,
        progress: options.progress,
    });
    const objectResults = await publishObjects(plan, options.store);
    progress(options.progress, {
        stage: 'upload',
        completed: objectResults.length,
        total: objectResults.length + 1,
        message: 'published audio objects',
    });
    const manifestResult = await publishImmutableCandidate(
        options.store,
        plan.manifest
    );
    progress(options.progress, {
        stage: 'upload',
        completed: objectResults.length + 1,
        total: objectResults.length + 1,
        message: 'published audio manifest',
    });

    await verifyStoredAudioRelease({
        store: options.store,
        storyId: options.storyId,
        target: options.target,
        releaseId: preparedRelease.releaseId,
        expectedManifestSha256: preparedRelease.manifestSha256,
        depth: 'deep',
        run: options.run,
    });
    progress(options.progress, {
        stage: 'verify',
        completed: 1,
        total: 1,
        message: 'deep-verified audio release',
    });

    return publishReport(plan, objectResults, manifestResult);
}
