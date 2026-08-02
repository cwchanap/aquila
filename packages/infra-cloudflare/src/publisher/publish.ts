import {
    RUNTIME_ASSET_CACHE_POLICY,
    getCurrentPointerPath,
    parseActiveReleasePointer,
    type ActiveReleasePointerV1,
} from '@aquila/stories/runtime-assets';
import { activateStoredRelease, type ActivationResult } from './activation';
import { verifyPreparedRelease } from './candidate-verifier';
import { PublisherError } from './errors';
import {
    buildPublicationPlan,
    type BuildPublicationPlanOptions,
    type PlannedImmutableCandidate,
    type PublicationPlan,
} from './publication-plan';
import type { PublisherReportV1 } from './report';
import type {
    DeliveryStore,
    PointerSnapshot,
    StoredObject,
} from './stores/delivery-store';
import type { PublisherActionV1 } from './types';

export interface PublishReleaseOptions extends BuildPublicationPlanOptions {
    readonly noActivate?: boolean;
    readonly overrideConcurrentPointer?: boolean;
    readonly confirmProduction?: string;
    readonly now?: () => number;
}

type ImmutableResult = 'created' | 'reused';

interface FreshPointerState {
    readonly snapshot: PointerSnapshot;
    readonly releaseId?: string;
}

const JSON_CONTENT_TYPE = 'application/json';
const textDecoder = new TextDecoder('utf-8', { fatal: true });

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((byte, index) => byte === right[index]);
}

function immutableConflict(
    candidate: PlannedImmutableCandidate
): PublisherError {
    return new PublisherError(
        'integrity',
        candidate.kind === 'manifest'
            ? 'Stored immutable manifest conflicts with publication candidate'
            : 'Stored immutable object conflicts with publication candidate',
        {
            context: {
                stage: candidate.kind === 'manifest' ? 'manifest' : 'upload',
                key: candidate.key,
            },
        }
    );
}

async function readCandidate(
    store: DeliveryStore,
    candidate: PlannedImmutableCandidate
): Promise<StoredObject> {
    try {
        return await store.read(candidate.key);
    } catch (cause) {
        if (cause instanceof PublisherError) throw cause;
        throw new PublisherError(
            'storage',
            'Unable to read back immutable publication candidate',
            {
                cause: { classification: 'delivery-store-read-failure' },
                context: { stage: 'upload', key: candidate.key },
            }
        );
    }
}

async function verifyCandidate(
    store: DeliveryStore,
    candidate: PlannedImmutableCandidate
): Promise<void> {
    const stored = await readCandidate(store, candidate);
    if (
        stored.key !== candidate.key ||
        stored.byteLength !== candidate.bytes.byteLength ||
        stored.byteLength !== stored.bytes.byteLength ||
        stored.contentType !== candidate.contentType ||
        stored.cacheControl !== candidate.cacheControl ||
        !bytesEqual(stored.bytes, candidate.bytes)
    ) {
        throw immutableConflict(candidate);
    }
}

async function createCandidate(
    store: DeliveryStore,
    candidate: PlannedImmutableCandidate
): Promise<ImmutableResult> {
    if (candidate.status === 'reuse') return 'reused';
    let result: Awaited<ReturnType<DeliveryStore['createImmutable']>>;
    try {
        result = await store.createImmutable({
            key: candidate.key,
            bytes: candidate.bytes,
            contentType: candidate.contentType,
            cacheControl: candidate.cacheControl,
        });
    } catch (cause) {
        if (cause instanceof PublisherError) throw cause;
        throw new PublisherError(
            'storage',
            'Unable to create immutable publication candidate',
            {
                cause: { classification: 'delivery-store-create-failure' },
                context: { stage: 'upload', key: candidate.key },
            }
        );
    }
    return result.status === 'created' ? 'created' : 'reused';
}

async function publishObjects(
    plan: PublicationPlan,
    store: DeliveryStore
): Promise<ImmutableResult[]> {
    const results: ImmutableResult[] = [];
    for (const candidate of plan.objects) {
        results.push(await createCandidate(store, candidate));
    }
    // Upload completion is not trusted. Every object is read back and checked
    // before the manifest phase begins, including create races and planned reuse.
    for (const candidate of plan.objects) {
        await verifyCandidate(store, candidate);
    }
    return results;
}

async function publishManifest(
    plan: PublicationPlan,
    store: DeliveryStore
): Promise<ImmutableResult> {
    const result = await createCandidate(store, plan.manifest);
    await verifyCandidate(store, plan.manifest);
    return result;
}

function pointerTargetError(key: string): PublisherError {
    return new PublisherError(
        'activation-target',
        'Current active-release pointer is invalid',
        { context: { stage: 'activation', key } }
    );
}

async function readFreshPointer(
    options: PublishReleaseOptions
): Promise<FreshPointerState> {
    const key = getCurrentPointerPath(options.storyId, options.target);
    let snapshot: PointerSnapshot;
    try {
        snapshot = await options.store.readPointer(key);
    } catch {
        throw new PublisherError('storage', 'Unable to read current pointer', {
            cause: { classification: 'delivery-store-pointer-read-failure' },
            context: { stage: 'activation', key },
        });
    }
    return parseFreshPointer(options, key, snapshot);
}

function parseFreshPointer(
    options: PublishReleaseOptions,
    key: string,
    snapshot: PointerSnapshot
): FreshPointerState {
    if (!snapshot.exists) return { snapshot };
    if (
        snapshot.contentType !== JSON_CONTENT_TYPE ||
        snapshot.cacheControl !==
            RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl
    ) {
        throw pointerTargetError(key);
    }
    let pointer: ActiveReleasePointerV1;
    try {
        pointer = parseActiveReleasePointer(
            JSON.parse(textDecoder.decode(snapshot.bytes)),
            options.target,
            options.storyId
        );
    } catch {
        throw pointerTargetError(key);
    }
    return { snapshot, releaseId: pointer.releaseId };
}

function advisoryMatches(
    plan: PublicationPlan,
    fresh: FreshPointerState
): boolean {
    if (plan.advisoryPointer.exists !== fresh.snapshot.exists) return false;
    if (!plan.advisoryPointer.exists || !fresh.snapshot.exists) return true;
    return (
        plan.advisoryPointer.etag === fresh.snapshot.etag &&
        plan.advisoryPointer.beforeReleaseId === fresh.releaseId
    );
}

function activationStoreWithAdvisoryGuard(
    options: PublishReleaseOptions,
    plan: PublicationPlan
): {
    readonly store: DeliveryStore;
    readonly observedDrift: () => boolean;
    readonly observedReleaseId: () => string | undefined;
} {
    let drift = false;
    let releaseId: string | undefined;
    const store: DeliveryStore = {
        stat: key => options.store.stat(key),
        read: key => options.store.read(key),
        createImmutable: request => options.store.createImmutable(request),
        inspectPointer: key => options.store.inspectPointer(key),
        readPointer: async key => {
            const snapshot = await options.store.readPointer(key);
            try {
                const fresh = parseFreshPointer(options, key, snapshot);
                releaseId = fresh.releaseId;
                drift = !advisoryMatches(plan, fresh);
            } catch {
                // Return the snapshot so the activation service reports its
                // normal safe activation-target error. It must never be allowed
                // to reach the store CAS after differing from the advisory read.
                drift = true;
            }
            return snapshot;
        },
        compareAndSwapPointer: request =>
            drift
                ? Promise.resolve({
                      status: 'precondition-failed' as const,
                  })
                : options.store.compareAndSwapPointer(request),
        listKeys: prefix => options.store.listKeys(prefix),
        list: prefix => options.store.list(prefix),
        close: async () => {},
    };
    return {
        store,
        observedDrift: () => drift,
        observedReleaseId: () => releaseId,
    };
}

function immutableActions(
    plan: PublicationPlan,
    objectResults: readonly ImmutableResult[],
    manifestResult: ImmutableResult
): PublisherActionV1[] {
    return [
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
    ];
}

function report(
    plan: PublicationPlan,
    objectResults: readonly ImmutableResult[],
    manifestResult: ImmutableResult,
    activation: ActivationResult['status'] | 'skipped',
    pointerBefore?: string,
    pointerAfter?: string
): PublisherReportV1 {
    const objectsCreated = objectResults.filter(
        result => result === 'created'
    ).length;
    const manifestsCreated = manifestResult === 'created' ? 1 : 0;
    const pointerWritten = activation === 'success';
    const status: PublisherReportV1['status'] =
        activation === 'conflict'
            ? 'conflict'
            : objectsCreated > 0 || manifestsCreated > 0 || pointerWritten
              ? 'success'
              : 'no-op';
    const actions: PublisherActionV1[] = [
        ...immutableActions(plan, objectResults, manifestResult),
        pointerWritten
            ? {
                  stage: 'activation',
                  kind: 'write-pointer',
                  key: getCurrentPointerPath(
                      plan.preparedRelease.storyId,
                      plan.preparedRelease.target
                  ),
              }
            : { stage: 'activation', kind: 'no-op' },
    ];
    return {
        ...plan.report,
        command: 'publish',
        status,
        counts: {
            ...plan.report.counts,
            objectsCreated,
            objectsReused: objectResults.length - objectsCreated,
            manifestsCreated,
            manifestsReused: 1 - manifestsCreated,
            pointersWritten: pointerWritten ? 1 : 0,
        },
        actions,
        pointer: {
            ...(pointerBefore === undefined
                ? {}
                : { beforeReleaseId: pointerBefore }),
            ...(pointerAfter === undefined
                ? {}
                : { afterReleaseId: pointerAfter }),
            changed: pointerWritten,
        },
    };
}

export async function publishRelease(
    options: PublishReleaseOptions
): Promise<PublisherReportV1> {
    const plan = await buildPublicationPlan(options);
    const objectResults = await publishObjects(plan, options.store);
    const manifestResult = await publishManifest(plan, options.store);
    await verifyPreparedRelease({
        store: options.store,
        preparedRelease: plan.preparedRelease,
        depth: 'deep',
    });

    if (options.noActivate === true) {
        return report(
            plan,
            objectResults,
            manifestResult,
            'skipped',
            plan.advisoryPointer.beforeReleaseId
        );
    }

    const fresh = await readFreshPointer(options);
    const initialDrift = !advisoryMatches(plan, fresh);
    if (initialDrift && options.overrideConcurrentPointer !== true) {
        return report(
            plan,
            objectResults,
            manifestResult,
            'conflict',
            plan.advisoryPointer.beforeReleaseId,
            fresh.releaseId
        );
    }

    // The shared activation service performs the command-specific deep
    // verification immediately before its own fresh snapshot, monotonic pointer
    // construction, validation, and one conditional write. Publish deliberately
    // does not pass its override flag through: advisory drift consumes the one
    // exceptional refresh, while a later CAS precondition failure remains final.
    const guarded = activationStoreWithAdvisoryGuard(options, plan);
    let activation = await activateStoredRelease({
        store: initialDrift ? options.store : guarded.store,
        storyId: options.storyId,
        target: options.target,
        releaseId: plan.preparedRelease.releaseId,
        expectedManifestSha256: plan.preparedRelease.manifestSha256,
        overrideConcurrentPointer: false,
        confirmProduction: options.confirmProduction,
        now: options.now,
    });
    if (!initialDrift && guarded.observedDrift()) {
        if (options.overrideConcurrentPointer !== true) {
            return report(
                plan,
                objectResults,
                manifestResult,
                'conflict',
                plan.advisoryPointer.beforeReleaseId,
                activation.pointerBefore?.releaseId ??
                    guarded.observedReleaseId()
            );
        }
        activation = await activateStoredRelease({
            store: options.store,
            storyId: options.storyId,
            target: options.target,
            releaseId: plan.preparedRelease.releaseId,
            expectedManifestSha256: plan.preparedRelease.manifestSha256,
            overrideConcurrentPointer: false,
            confirmProduction: options.confirmProduction,
            now: options.now,
        });
    }
    return report(
        plan,
        objectResults,
        manifestResult,
        activation.status,
        activation.pointerBefore?.releaseId ?? fresh.releaseId,
        activation.status === 'success' || activation.status === 'no-op'
            ? plan.preparedRelease.releaseId
            : undefined
    );
}
