import {
    RUNTIME_ASSET_CACHE_POLICY,
    assertReleaseIdMatchesContentSha256,
    canonicalAudioReleaseContent,
    canonicalReleaseContent,
    getAudioCurrentPointerPath,
    getAudioReleaseManifestPath,
    getCurrentPointerPath,
    getReleaseManifestPath,
    isReleaseId,
    parseAudioActiveReleasePointer,
    parseActiveReleasePointer,
    parseRuntimeAudioManifest,
    parseRuntimeAssetManifest,
    type ActiveReleasePointerV1,
    type ManifestByteSha256,
    type PublicationTarget,
    type RuntimeAudioManifestV1,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import {
    activateStoredRelease,
    type PublisherMedia,
    type ActivateStoredReleaseOptions,
    type ActivationResult,
} from './activation';
import { verifyStoredRelease } from './candidate-verifier';
import { verifyStoredAudioRelease } from './audio-candidate-verifier';
import type { AudioProcessRunner } from './audio-encoder';
import { PublisherError } from './errors';
import { sha256ReleaseContent } from './hash';
import type {
    ProgressSink,
    PublisherDiagnosticV1,
    PublisherReportV1,
} from './report';
import type {
    DeliveryStore,
    PointerSnapshot,
    StoredObject,
} from './stores/delivery-store';

export interface ListReleasesOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly media?: PublisherMedia;
    readonly deep?: boolean;
    readonly run?: AudioProcessRunner;
    readonly onProgress?: ProgressSink;
    readonly onWarning?: (warning: PublisherDiagnosticV1) => void;
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

type HistoryManifest = RuntimeAssetManifestV1 | RuntimeAudioManifestV1;

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

function manifestPathFor(
    media: PublisherMedia,
    storyId: string,
    releaseId: string,
    target: PublicationTarget
): string {
    return media === 'audio'
        ? getAudioReleaseManifestPath(storyId, releaseId, target)
        : getReleaseManifestPath(storyId, releaseId, target);
}

function currentPointerPathFor(
    media: PublisherMedia,
    storyId: string,
    target: PublicationTarget
): string {
    return media === 'audio'
        ? getAudioCurrentPointerPath(storyId, target)
        : getCurrentPointerPath(storyId, target);
}

function parsePointerFor(
    media: PublisherMedia,
    input: unknown,
    target: PublicationTarget,
    storyId: string
): ActiveReleasePointerV1 {
    return media === 'audio'
        ? parseAudioActiveReleasePointer(input, target, storyId)
        : parseActiveReleasePointer(input, target, storyId);
}

function parseManifestFor(
    media: PublisherMedia,
    bytes: Uint8Array
): HistoryManifest {
    const input = JSON.parse(textDecoder.decode(bytes));
    return media === 'audio'
        ? parseRuntimeAudioManifest(input)
        : parseRuntimeAssetManifest(input);
}

function canonicalReleaseContentFor(
    media: PublisherMedia,
    manifest: HistoryManifest
): string {
    return media === 'audio'
        ? canonicalAudioReleaseContent(manifest as RuntimeAudioManifestV1)
        : canonicalReleaseContent(manifest as RuntimeAssetManifestV1);
}

function releaseIdentityValidFor(
    media: PublisherMedia,
    manifest: HistoryManifest,
    releaseId: string
): boolean {
    if (manifest.releaseId !== releaseId) return false;
    try {
        assertReleaseIdMatchesContentSha256(
            manifest,
            sha256ReleaseContent(canonicalReleaseContentFor(media, manifest))
        );
        return true;
    } catch {
        return false;
    }
}

function releasePrefix(
    media: PublisherMedia,
    storyId: string,
    target: PublicationTarget
): string {
    const exampleReleaseId = `sha256-${'0'.repeat(64)}`;
    const manifestPath = manifestPathFor(
        media,
        storyId,
        exampleReleaseId,
        target
    );
    const releaseIdBoundary = manifestPath.indexOf(`/${exampleReleaseId}/`);
    if (releaseIdBoundary === -1) {
        throw new PublisherError(
            'configuration',
            'Unable to derive the release key prefix from the manifest path grammar'
        );
    }
    return manifestPath.slice(0, releaseIdBoundary + 1);
}

function releaseIdForKey(
    key: string,
    prefix: string,
    media: PublisherMedia,
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
        return manifestPathFor(media, storyId, releaseId, target) === key
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
    const media = options.media ?? 'visual';
    const releaseIds = new Set<string>();
    try {
        for await (const key of options.store.listKeys(prefix)) {
            const releaseId = releaseIdForKey(
                key,
                prefix,
                media,
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

function parseManifest(
    media: PublisherMedia,
    object: StoredObject
): HistoryManifest | null {
    try {
        return parseManifestFor(media, object.bytes);
    } catch {
        return null;
    }
}

async function classifyManifest(
    store: DeliveryStore,
    storyId: string,
    target: PublicationTarget,
    releaseId: string,
    media: PublisherMedia
): Promise<ManifestClassification> {
    const manifestPath = manifestPathFor(media, storyId, releaseId, target);
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
    const manifest = parseManifest(media, object);
    if (manifest === null) {
        return { manifestValid: false, releaseIdentityValid: false };
    }
    let releaseIdentityValid = false;
    if (manifest.storyId === storyId) {
        releaseIdentityValid = releaseIdentityValidFor(
            media,
            manifest,
            releaseId
        );
    }
    return { manifestValid: true, releaseIdentityValid };
}

interface HistoryVerificationOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly depth: 'shallow' | 'deep';
    readonly expectedManifestSha256?: ManifestByteSha256;
    readonly run?: AudioProcessRunner;
}

async function verifyStoredFor(
    media: PublisherMedia,
    options: HistoryVerificationOptions
) {
    if (media === 'audio') {
        return verifyStoredAudioRelease(options);
    }
    return verifyStoredRelease(options);
}

function invalidVerification(error: unknown): boolean {
    return error instanceof PublisherError && error.code === 'integrity';
}

async function inspectActiveReleaseId(
    options: ListReleasesOptions
): Promise<string | undefined> {
    const media = options.media ?? 'visual';
    const key = currentPointerPathFor(media, options.storyId, options.target);
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
        return parsePointerFor(
            media,
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
    const media = options.media ?? 'visual';
    const manifestPath = manifestPathFor(
        media,
        options.storyId,
        releaseId,
        options.target
    );
    let shallow;
    try {
        shallow = await verifyStoredFor(media, {
            store: options.store,
            storyId: options.storyId,
            target: options.target,
            releaseId,
            depth: 'shallow',
            run: options.run,
        });
    } catch (error) {
        if (!invalidVerification(error)) throw error;
        const classification = await classifyManifest(
            options.store,
            options.storyId,
            options.target,
            releaseId,
            media
        );
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
            await verifyStoredFor(media, {
                store: options.store,
                storyId: options.storyId,
                target: options.target,
                releaseId,
                depth: 'deep',
                expectedManifestSha256: shallow.manifestSha256,
                run: options.run,
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
        manifestValid: true,
        releaseIdentityValid: true,
        shallowVerified: true,
        deepVerified,
        active: releaseId === activeReleaseId,
    };
}

export async function listReleases(
    options: ListReleasesOptions
): Promise<ReleaseSummary[]> {
    const media = options.media ?? 'visual';
    const prefix = releasePrefix(media, options.storyId, options.target);
    const releaseIds = await listedReleaseIds(options, prefix);
    let activeReleaseId: string | undefined;
    try {
        activeReleaseId = await inspectActiveReleaseId(options);
    } catch (error) {
        if (
            !(error instanceof PublisherError) ||
            error.code !== 'activation-target'
        ) {
            throw error;
        }
        activeReleaseId = undefined;
        options.onWarning?.({
            code: 'pointer-invalid',
            stage: 'verification',
            message:
                'Current active-release pointer is invalid; every release is reported as inactive',
        });
    }
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
    const media = options.media ?? 'visual';
    return {
        schemaVersion: 1,
        command: 'rollback',
        status: activation.status,
        storyId: options.storyId,
        target: options.target,
        ...(media === 'audio' ? { media: 'audio' as const } : {}),
        releaseId: activation.releaseId,
        manifestSha256: activation.manifestSha256,
        counts: emptyCounts(pointerWritten),
        actions: [
            pointerWritten
                ? {
                      stage: 'rollback',
                      kind: 'write-pointer',
                      key: currentPointerPathFor(
                          media,
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
    options: RollbackReleaseOptions,
    key?: string
): PublisherError {
    return new PublisherError(
        'activation-target',
        'Rollback target is missing or invalid',
        {
            context: {
                stage: 'rollback',
                ...(key === undefined ? {} : { key }),
            },
        }
    );
}

async function assertRollbackTargetExists(
    options: RollbackReleaseOptions
): Promise<void> {
    const key = manifestPathFor(
        options.media ?? 'visual',
        options.storyId,
        options.releaseId,
        options.target
    );
    let stored;
    try {
        stored = await options.store.stat(key);
    } catch (error) {
        if (error instanceof PublisherError && error.code === 'integrity') {
            throw invalidRollbackTarget(options, key);
        }
        throw new PublisherError(
            'storage',
            'Unable to inspect rollback target',
            {
                context: { stage: 'rollback', key },
                cause: SANITIZED_CLASSIFICATION_READ_CAUSE,
            }
        );
    }
    if (stored === null) throw invalidRollbackTarget(options, key);
}

export async function rollbackRelease(
    options: RollbackReleaseOptions
): Promise<PublisherReportV1> {
    if (!isReleaseId(options.releaseId)) {
        throw invalidRollbackTarget(options);
    }
    await assertRollbackTargetExists(options);
    let activation: ActivationResult;
    try {
        activation = await activateStoredRelease({
            ...options,
            intent: 'rollback',
        });
    } catch (error) {
        if (error instanceof PublisherError && error.code === 'integrity') {
            throw invalidRollbackTarget(
                options,
                manifestPathFor(
                    options.media ?? 'visual',
                    options.storyId,
                    options.releaseId,
                    options.target
                )
            );
        }
        throw error;
    }
    return rollbackReport(options, activation);
}
