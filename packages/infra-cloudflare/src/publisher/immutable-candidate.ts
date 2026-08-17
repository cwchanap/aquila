import { PublisherError } from './errors';
import type {
    DeliveryStore,
    StoredObject,
    StoredObjectMetadata,
} from './stores/delivery-store';

export interface PlannedImmutableCandidate {
    readonly kind: 'object' | 'manifest' | 'source';
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
    readonly cacheControl: string;
    readonly status: 'create' | 'reuse';
    readonly identity?: string;
}

type CandidateInput = Omit<PlannedImmutableCandidate, 'status'>;

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((byte, index) => byte === right[index]);
}

function requiredMetadataMatches(
    actual: StoredObjectMetadata,
    candidate: CandidateInput | PlannedImmutableCandidate
): boolean {
    return (
        actual.key === candidate.key &&
        actual.byteLength === candidate.bytes.byteLength &&
        actual.contentType === candidate.contentType &&
        actual.cacheControl === candidate.cacheControl
    );
}

function candidateKindLabel(
    kind: PlannedImmutableCandidate['kind']
): 'manifest' | 'source' | 'object' {
    return kind === 'manifest'
        ? 'manifest'
        : kind === 'source'
          ? 'source'
          : 'object';
}

function inspectionConflict(candidate: CandidateInput): PublisherError {
    const label = candidateKindLabel(candidate.kind);
    return new PublisherError(
        'integrity',
        label === 'manifest'
            ? 'Existing immutable manifest conflicts with candidate'
            : label === 'source'
              ? 'Existing immutable source conflicts with candidate'
              : 'Existing content-addressed object conflicts with candidate',
        {
            context: {
                stage: label === 'manifest' ? 'manifest' : 'object-inspection',
                key: candidate.key,
            },
        }
    );
}

function publicationConflict(
    candidate: PlannedImmutableCandidate
): PublisherError {
    const label = candidateKindLabel(candidate.kind);
    return new PublisherError(
        'integrity',
        label === 'manifest'
            ? 'Stored immutable manifest conflicts with publication candidate'
            : label === 'source'
              ? 'Stored immutable source conflicts with publication candidate'
              : 'Stored immutable object conflicts with publication candidate',
        {
            context: {
                stage: label === 'manifest' ? 'manifest' : 'upload',
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

function assertReadBackMatches(
    stored: StoredObject,
    candidate: PlannedImmutableCandidate
): void {
    if (
        stored.key !== candidate.key ||
        stored.byteLength !== candidate.bytes.byteLength ||
        stored.byteLength !== stored.bytes.byteLength ||
        stored.contentType !== candidate.contentType ||
        stored.cacheControl !== candidate.cacheControl ||
        !bytesEqual(stored.bytes, candidate.bytes)
    ) {
        throw publicationConflict(candidate);
    }
}

export async function inspectImmutableCandidate(
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
        throw inspectionConflict(candidate);
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
        throw inspectionConflict(candidate);
    }
    return { ...candidate, status: 'reuse' };
}

export async function publishImmutableCandidate(
    store: DeliveryStore,
    candidate: PlannedImmutableCandidate
): Promise<'created' | 'reused'> {
    let result:
        | Awaited<ReturnType<DeliveryStore['createImmutable']>>
        | undefined;
    if (candidate.status === 'create') {
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
    }

    const stored = await readCandidate(store, candidate);
    assertReadBackMatches(stored, candidate);
    return candidate.status === 'reuse' || result?.status === 'already-exists'
        ? 'reused'
        : 'created';
}
