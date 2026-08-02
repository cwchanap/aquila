import {
    RUNTIME_ASSET_CACHE_POLICY,
    assertReleaseIdMatchesContentSha256,
    canonicalReleaseContent,
    getCurrentPointerPath,
    getReleaseManifestPath,
    isReleaseId,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    type ManifestByteSha256,
    type PublicationTarget,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import {
    activateStoredRelease,
    type ActivateStoredReleaseOptions,
    type ActivationResult,
} from './activation';
import { verifyStoredRelease } from './candidate-verifier';
import { PublisherError } from './errors';
import { sha256ReleaseContent } from './hash';
import type { ProgressSink, PublisherReportV1 } from './report';
import type {
    DeliveryStore,
    PointerSnapshot,
    StoredObject,
} from './stores/delivery-store';

export interface ListReleasesOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly deep?: boolean;
    readonly onProgress?: ProgressSink;
}

export interface ReleaseSummary {
    readonly releaseId: string;
    readonly manifestPath: string;
    readonly manifestSha256?: ManifestByteSha256;
    readonly manifestValid: boolean;
    readonly releaseIdentityValid: boolean;
    readonly shallowVerified: boolean;
    readonly deepVerified: boolean;
    readonly active: boolean;
}

export type RollbackReleaseOptions = Omit<
    ActivateStoredReleaseOptions,
    'intent' | 'reactivate'
>;

interface ManifestClassification {
    readonly manifestValid: boolean;
    readonly releaseIdentityValid: boolean;
}

const JSON_CONTENT_TYPE = 'application/json';
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const SANITIZED_LIST_CAUSE = Object.freeze({
    classification: 'delivery-store-list-failure' as const,
});
const SANITIZED_POINTER_INSPECTION_CAUSE = Object.freeze({
    classification: 'delivery-store-pointer-inspection-failure' as const,
});
const SANITIZED_CLASSIFICATION_READ_CAUSE = Object.freeze({
    classification: 'delivery-store-read-failure' as const,
});

function compareText(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

function releasePrefix(storyId: string, target: PublicationTarget): string {
    getCurrentPointerPath(storyId, target);
    return target.kind === 'production'
        ? `vn/stories/${storyId}/releases/`
        : `vn/previews/${target.previewId}/stories/${storyId}/releases/`;
}

function releaseIdForKey(
    key: string,
    prefix: string,
    storyId: string,
    target: PublicationTarget
): string | undefined {
    if (!key.startsWith(prefix)) return undefined;
    const suffix = key.slice(prefix.length);
    const match = /^([^/]+)\/runtime-manifest\.json$/.exec(suffix);
    if (match === null) return undefined;
    const releaseId = match[1]!;
    if (!isReleaseId(releaseId)) return undefined;
    try {
        return getReleaseManifestPath(storyId, releaseId, target) === key
            ? releaseId
            : undefined;
    } catch {
        return undefined;
    }
}

async function listedReleaseIds(
    options: ListReleasesOptions,
    prefix: string
): Promise<string[]> {
    const releaseIds = new Set<string>();
    try {
        for await (const listed of options.store.list(prefix)) {
            const releaseId = releaseIdForKey(
                listed.key,
                prefix,
                options.storyId,
                options.target
            );
            if (releaseId !== undefined) releaseIds.add(releaseId);
        }
    } catch {
        throw new PublisherError('storage', 'Unable to list stored releases', {
            context: { stage: 'verification', prefix },
            cause: SANITIZED_LIST_CAUSE,
        });
    }
    return [...releaseIds].sort(compareText);
}

function parseManifest(object: StoredObject): RuntimeAssetManifestV1 | null {
    try {
        return parseRuntimeAssetManifest(
            JSON.parse(textDecoder.decode(object.bytes))
        );
    } catch {
        return null;
    }
}

async function classifyManifest(
    store: DeliveryStore,
    storyId: string,
    target: PublicationTarget,
    releaseId: string
): Promise<ManifestClassification> {
    const manifestPath = getReleaseManifestPath(storyId, releaseId, target);
    let object: StoredObject;
    try {
        object = await store.read(manifestPath);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to inspect stored release manifest',
            {
                context: { stage: 'verification', key: manifestPath },
                cause: SANITIZED_CLASSIFICATION_READ_CAUSE,
            }
        );
    }
    const manifest = parseManifest(object);
    if (manifest === null) {
        return { manifestValid: false, releaseIdentityValid: false };
    }
    let releaseIdentityValid = false;
    if (manifest.storyId === storyId && manifest.releaseId === releaseId) {
        try {
            assertReleaseIdMatchesContentSha256(
                manifest,
                sha256ReleaseContent(canonicalReleaseContent(manifest))
            );
            releaseIdentityValid = true;
        } catch {
            releaseIdentityValid = false;
        }
    }
    return { manifestValid: true, releaseIdentityValid };
}

function invalidVerification(error: unknown): boolean {
    return error instanceof PublisherError && error.code === 'integrity';
}

async function inspectActiveReleaseId(
    options: ListReleasesOptions
): Promise<string | undefined> {
    const key = getCurrentPointerPath(options.storyId, options.target);
    let snapshot: PointerSnapshot;
    try {
        snapshot = await options.store.inspectPointer(key);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to inspect current pointer',
            {
                context: { stage: 'verification', key },
                cause: SANITIZED_POINTER_INSPECTION_CAUSE,
            }
        );
    }
    if (!snapshot.exists) return undefined;
    if (
        snapshot.contentType !== JSON_CONTENT_TYPE ||
        snapshot.cacheControl !==
            RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl
    ) {
        throw new PublisherError(
            'activation-target',
            'Current active-release pointer is invalid',
            { context: { stage: 'verification', key } }
        );
    }
    try {
        return parseActiveReleasePointer(
            JSON.parse(textDecoder.decode(snapshot.bytes)),
            options.target,
            options.storyId
        ).releaseId;
    } catch {
        throw new PublisherError(
            'activation-target',
            'Current active-release pointer is invalid',
            { context: { stage: 'verification', key } }
        );
    }
}

async function summarizeRelease(
    options: ListReleasesOptions,
    releaseId: string,
    activeReleaseId: string | undefined
): Promise<ReleaseSummary> {
    const manifestPath = getReleaseManifestPath(
        options.storyId,
        releaseId,
        options.target
    );
    const classification = await classifyManifest(
        options.store,
        options.storyId,
        options.target,
        releaseId
    );
    let shallow;
    try {
        shallow = await verifyStoredRelease({
            store: options.store,
            storyId: options.storyId,
            target: options.target,
            releaseId,
            depth: 'shallow',
        });
    } catch (error) {
        if (!invalidVerification(error)) throw error;
        return {
            releaseId,
            manifestPath,
            ...classification,
            shallowVerified: false,
            deepVerified: false,
            active: releaseId === activeReleaseId,
        };
    }

    let deepVerified = false;
    if (options.deep === true) {
        try {
            await verifyStoredRelease({
                store: options.store,
                storyId: options.storyId,
                target: options.target,
                releaseId,
                depth: 'deep',
                expectedManifestSha256: shallow.manifestSha256,
            });
            deepVerified = true;
        } catch (error) {
            if (!invalidVerification(error)) throw error;
        }
    }
    return {
        releaseId,
        manifestPath,
        manifestSha256: shallow.manifestSha256,
        ...classification,
        shallowVerified: true,
        deepVerified,
        active: releaseId === activeReleaseId,
    };
}

export async function listReleases(
    options: ListReleasesOptions
): Promise<ReleaseSummary[]> {
    const prefix = releasePrefix(options.storyId, options.target);
    const releaseIds = await listedReleaseIds(options, prefix);
    const activeReleaseId = await inspectActiveReleaseId(options);
    const summaries: ReleaseSummary[] = [];
    for (const [index, releaseId] of releaseIds.entries()) {
        summaries.push(
            await summarizeRelease(options, releaseId, activeReleaseId)
        );
        options.onProgress?.({
            stage: 'verify',
            completed: index + 1,
            total: releaseIds.length,
            message: 'Verifying stored release history',
        });
    }
    return summaries;
}

function emptyCounts(pointerWritten: boolean): PublisherReportV1['counts'] {
    return {
        included: 0,
        omitted: 0,
        objectsCreated: 0,
        objectsReused: 0,
        manifestsCreated: 0,
        manifestsReused: 0,
        pointersWritten: pointerWritten ? 1 : 0,
    };
}

function rollbackReport(
    options: RollbackReleaseOptions,
    activation: ActivationResult
): PublisherReportV1 {
    const pointerWritten = activation.status === 'success';
    return {
        schemaVersion: 1,
        command: 'rollback',
        status: activation.status,
        storyId: options.storyId,
        target: options.target,
        releaseId: activation.releaseId,
        manifestSha256: activation.manifestSha256,
        counts: emptyCounts(pointerWritten),
        actions: [
            pointerWritten
                ? {
                      stage: 'rollback',
                      kind: 'write-pointer',
                      key: getCurrentPointerPath(
                          options.storyId,
                          options.target
                      ),
                  }
                : { stage: 'rollback', kind: 'no-op' },
        ],
        warnings: [],
        errors: [],
        pointer: {
            ...(activation.pointerBefore === undefined
                ? {}
                : {
                      beforeReleaseId: activation.pointerBefore.releaseId,
                  }),
            ...(activation.pointerAfter === undefined
                ? activation.status === 'no-op'
                    ? { afterReleaseId: activation.releaseId }
                    : {}
                : { afterReleaseId: activation.pointerAfter.releaseId }),
            changed: pointerWritten,
        },
    };
}

function invalidRollbackTarget(
    options: RollbackReleaseOptions
): PublisherError {
    return new PublisherError(
        'activation-target',
        'Rollback target is missing or invalid',
        {
            context: {
                stage: 'rollback',
                key: getReleaseManifestPath(
                    options.storyId,
                    options.releaseId,
                    options.target
                ),
            },
        }
    );
}

async function assertRollbackTargetExists(
    options: RollbackReleaseOptions
): Promise<void> {
    const key = getReleaseManifestPath(
        options.storyId,
        options.releaseId,
        options.target
    );
    let stored;
    try {
        stored = await options.store.stat(key);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to inspect rollback target',
            {
                context: { stage: 'rollback', key },
                cause: SANITIZED_CLASSIFICATION_READ_CAUSE,
            }
        );
    }
    if (stored === null) throw invalidRollbackTarget(options);
}

export async function rollbackRelease(
    options: RollbackReleaseOptions
): Promise<PublisherReportV1> {
    await assertRollbackTargetExists(options);
    let activation: ActivationResult;
    try {
        activation = await activateStoredRelease({
            ...options,
            intent: 'rollback',
        });
    } catch (error) {
        if (error instanceof PublisherError && error.code === 'integrity') {
            throw invalidRollbackTarget(options);
        }
        throw error;
    }
    return rollbackReport(options, activation);
}
