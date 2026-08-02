import {
    RUNTIME_ASSET_CACHE_POLICY,
    getReleaseManifestPath,
    type ManifestByteSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { verifyStoredRelease } from './candidate-verifier';
import { PublisherError } from './errors';
import type { PublisherReportV1 } from './report';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    StoredObject,
} from './stores/delivery-store';

export interface MirrorProductionReleaseToPreviewOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly sourceTarget: PublicationTarget;
    readonly releaseId: string;
    readonly previewId: string;
    readonly expectedManifestSha256?: ManifestByteSha256;
}

const JSON_CONTENT_TYPE = 'application/json';
const IMMUTABLE_CACHE_CONTROL =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
const SANITIZED_MANIFEST_READ_CAUSE = Object.freeze({
    classification: 'delivery-store-read-failure' as const,
});
const SANITIZED_MANIFEST_CREATE_CAUSE = Object.freeze({
    classification: 'delivery-store-create-failure' as const,
});

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((byte, index) => byte === right[index]);
}

function recordsEqual(
    left: Readonly<Record<string, string>>,
    right: Readonly<Record<string, string>>
): boolean {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
        leftKeys.length === rightKeys.length &&
        leftKeys.every(
            (key, index) => key === rightKeys[index] && left[key] === right[key]
        )
    );
}

async function readManifest(
    store: DeliveryStore,
    key: string
): Promise<StoredObject> {
    try {
        return await store.read(key);
    } catch {
        throw new PublisherError('storage', 'Unable to read release manifest', {
            context: { stage: 'manifest', key },
            cause: SANITIZED_MANIFEST_READ_CAUSE,
        });
    }
}

function assertManifestMatches(
    stored: StoredObject,
    expected: ImmutableCreateRequest,
    message: string
): void {
    if (
        stored.key !== expected.key ||
        stored.byteLength !== stored.bytes.byteLength ||
        stored.byteLength !== expected.bytes.byteLength ||
        stored.contentType !== expected.contentType ||
        stored.cacheControl !== expected.cacheControl ||
        !recordsEqual(stored.customMetadata, expected.customMetadata ?? {}) ||
        !bytesEqual(stored.bytes, expected.bytes)
    ) {
        throw new PublisherError('integrity', message, {
            context: { stage: 'manifest', key: expected.key },
        });
    }
}

async function createPreviewManifest(
    store: DeliveryStore,
    request: ImmutableCreateRequest
): Promise<'created' | 'reused'> {
    let result: Awaited<ReturnType<DeliveryStore['createImmutable']>>;
    try {
        result = await store.createImmutable(request);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to create preview release manifest',
            {
                context: { stage: 'manifest-upload', key: request.key },
                cause: SANITIZED_MANIFEST_CREATE_CAUSE,
            }
        );
    }

    const stored = await readManifest(store, request.key);
    assertManifestMatches(
        stored,
        request,
        'Existing preview manifest conflicts with production candidate'
    );
    return result.status === 'created' ? 'created' : 'reused';
}

function mirrorReport(
    options: MirrorProductionReleaseToPreviewOptions,
    target: PublicationTarget,
    manifestPath: string,
    manifestSha256: ManifestByteSha256,
    included: number,
    result: 'created' | 'reused'
): PublisherReportV1 {
    const created = result === 'created';
    return {
        schemaVersion: 1,
        command: 'mirror-preview',
        status: created ? 'success' : 'no-op',
        storyId: options.storyId,
        target,
        releaseId: options.releaseId,
        manifestSha256,
        counts: {
            included,
            omitted: 0,
            objectsCreated: 0,
            objectsReused: 0,
            manifestsCreated: created ? 1 : 0,
            manifestsReused: created ? 0 : 1,
            pointersWritten: 0,
        },
        actions: [
            {
                stage: 'manifest-upload',
                kind: created ? 'create-manifest' : 'reuse-manifest',
                key: manifestPath,
            },
            { stage: 'activation', kind: 'no-op' },
        ],
        warnings: [],
        errors: [],
        pointer: { changed: false },
    };
}

export async function mirrorProductionReleaseToPreview(
    options: MirrorProductionReleaseToPreviewOptions
): Promise<PublisherReportV1> {
    if (options.sourceTarget.kind !== 'production') {
        throw new PublisherError(
            'input',
            'Preview mirroring requires a production source target',
            { context: { stage: 'input', storyId: options.storyId } }
        );
    }

    const previewTarget: PublicationTarget = {
        kind: 'preview',
        previewId: options.previewId,
    };
    const previewManifestPath = getReleaseManifestPath(
        options.storyId,
        options.releaseId,
        previewTarget
    );
    const production = await verifyStoredRelease({
        store: options.store,
        storyId: options.storyId,
        target: options.sourceTarget,
        releaseId: options.releaseId,
        depth: 'deep',
    });
    if (
        options.expectedManifestSha256 !== undefined &&
        production.manifestSha256 !== options.expectedManifestSha256
    ) {
        throw new PublisherError(
            'integrity',
            'Production manifest checksum does not match expectation',
            {
                context: {
                    stage: 'verification',
                    key: production.manifestPath,
                },
            }
        );
    }

    const storedProduction = await readManifest(
        options.store,
        production.manifestPath
    );
    const productionRequest: ImmutableCreateRequest = {
        key: production.manifestPath,
        bytes: production.manifestBytes,
        contentType: JSON_CONTENT_TYPE,
        cacheControl: IMMUTABLE_CACHE_CONTROL,
        customMetadata: storedProduction.customMetadata,
    };
    assertManifestMatches(
        storedProduction,
        productionRequest,
        'Production manifest changed after verification'
    );

    const previewRequest: ImmutableCreateRequest = {
        ...productionRequest,
        key: previewManifestPath,
    };
    const result = await createPreviewManifest(options.store, previewRequest);
    const preview = await verifyStoredRelease({
        store: options.store,
        storyId: options.storyId,
        target: previewTarget,
        releaseId: options.releaseId,
        expectedManifestSha256: production.manifestSha256,
        depth: 'deep',
    });

    return mirrorReport(
        options,
        previewTarget,
        previewManifestPath,
        preview.manifestSha256,
        preview.manifest.assets.length,
        result
    );
}
