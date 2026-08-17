import {
    RUNTIME_ASSET_CACHE_POLICY,
    canonicalJson,
    getAudioCurrentPointerPath,
    getCurrentPointerPath,
    parseAudioActiveReleasePointer,
    parseActiveReleasePointer,
    type ActiveReleasePointerV1,
    type ManifestByteSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { verifyStoredRelease } from './candidate-verifier';
import { verifyStoredAudioRelease } from './audio-candidate-verifier';
import type { AudioProcessRunner } from './audio-encoder';
import { PublisherError } from './errors';
import type {
    DeliveryStore,
    PointerSnapshot,
    PointerWriteRequest,
} from './stores/delivery-store';
import type { PublisherMedia } from './types';

export const MAX_PUBLISHER_FUTURE_SKEW_MS = 300_000;

export type { PublisherMedia } from './types';

interface ActivatableStoredRelease {
    readonly releaseId: string;
    readonly manifestSha256: ManifestByteSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}

export type ParsedPointerSnapshot =
    | { readonly exists: false }
    | {
          readonly exists: true;
          readonly pointer: { readonly publishedAt: string };
      };

interface ActivationPointerSnapshot {
    readonly exists: boolean;
    readonly etag?: string;
    readonly pointer?: ActiveReleasePointerV1;
}

export interface ActivateStoredReleaseOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly media?: PublisherMedia;
    readonly expectedManifestSha256?: ManifestByteSha256;
    readonly run?: AudioProcessRunner;
    readonly reactivate?: boolean;
    readonly overrideConcurrentPointer?: boolean;
    readonly confirmProduction?: string;
    readonly now?: () => number;
    readonly intent?: 'activation' | 'rollback';
}

export interface ActivationResult {
    readonly status: 'success' | 'no-op' | 'conflict';
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly manifestSha256: ManifestByteSha256;
    readonly pointerBefore?: ActiveReleasePointerV1;
    readonly pointerAfter?: ActiveReleasePointerV1;
    readonly overrideAttempted: boolean;
    readonly etag?: string;
}

const JSON_CONTENT_TYPE = 'application/json';
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const textEncoder = new TextEncoder();
const SANITIZED_POINTER_READ_CAUSE = Object.freeze({
    classification: 'delivery-store-pointer-read-failure' as const,
});
const SANITIZED_POINTER_WRITE_CAUSE = Object.freeze({
    classification: 'delivery-store-pointer-write-failure' as const,
});

function isoTimestamp(milliseconds: number): string {
    try {
        return new Date(milliseconds).toISOString();
    } catch {
        throw new PublisherError(
            'non-monotonic-pointer-time',
            'Pointer timestamp could not be represented'
        );
    }
}

export function nextPublishedAt(
    snapshot: ParsedPointerSnapshot,
    nowMs: number
): string {
    const localNow = isoTimestamp(nowMs);
    const normalizedNowMs = Date.parse(localNow);
    if (!snapshot.exists) return localNow;

    const previousMs = Date.parse(snapshot.pointer.publishedAt);
    if (!Number.isFinite(previousMs)) {
        throw new PublisherError(
            'non-monotonic-pointer-time',
            'Current pointer timestamp is invalid'
        );
    }
    if (previousMs > normalizedNowMs + MAX_PUBLISHER_FUTURE_SKEW_MS) {
        throw new PublisherError(
            'clock-skew',
            'Pointer clock-skew is too far ahead',
            {
                context: {
                    previousPublishedAt: snapshot.pointer.publishedAt,
                    localNow,
                },
            }
        );
    }

    const result = Math.max(normalizedNowMs, previousMs + 1);
    if (!Number.isFinite(result) || result <= previousMs) {
        throw new PublisherError(
            'non-monotonic-pointer-time',
            'Pointer timestamp did not advance'
        );
    }
    return isoTimestamp(result);
}

function activationTargetError(
    key: string,
    intent: ActivateStoredReleaseOptions['intent']
): PublisherError {
    return new PublisherError(
        'activation-target',
        'Current active-release pointer is invalid',
        {
            context: {
                stage: intent === 'rollback' ? 'rollback' : 'activation',
                key,
            },
        }
    );
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

async function readPointer(
    store: DeliveryStore,
    key: string,
    media: PublisherMedia,
    target: PublicationTarget,
    storyId: string,
    intent: ActivateStoredReleaseOptions['intent']
): Promise<ActivationPointerSnapshot> {
    let snapshot: PointerSnapshot;
    try {
        snapshot = await store.readPointer(key);
    } catch {
        throw new PublisherError('storage', 'Unable to read current pointer', {
            context: {
                stage: intent === 'rollback' ? 'rollback' : 'activation',
                key,
            },
            cause: SANITIZED_POINTER_READ_CAUSE,
        });
    }
    if (!snapshot.exists) return { exists: false };
    if (
        snapshot.contentType !== JSON_CONTENT_TYPE ||
        snapshot.cacheControl !==
            RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl ||
        (media === 'audio' && Object.keys(snapshot.customMetadata).length > 0)
    ) {
        throw activationTargetError(key, intent);
    }

    let value: unknown;
    try {
        value = JSON.parse(textDecoder.decode(snapshot.bytes));
    } catch {
        throw activationTargetError(key, intent);
    }

    let pointer: ActiveReleasePointerV1;
    try {
        pointer = parsePointerFor(media, value, target, storyId);
    } catch {
        throw activationTargetError(key, intent);
    }
    return { exists: true, etag: snapshot.etag, pointer };
}

function expectationFor(
    snapshot: ActivationPointerSnapshot
): PointerWriteRequest['expected'] {
    if (!snapshot.exists) return { exists: false };
    return { exists: true, etag: snapshot.etag! };
}

function assertProductionConfirmation(
    options: ActivateStoredReleaseOptions
): void {
    if (
        options.target.kind === 'production' &&
        options.confirmProduction !== options.storyId
    ) {
        throw new PublisherError(
            'activation-target',
            options.intent === 'rollback'
                ? 'Production rollback requires exact story confirmation'
                : 'Production activation requires exact story confirmation',
            {
                context: {
                    stage:
                        options.intent === 'rollback'
                            ? 'rollback'
                            : 'activation',
                    storyId: options.storyId,
                },
            }
        );
    }
}

function isAlreadyActive(
    verified: ActivatableStoredRelease,
    snapshot: ActivationPointerSnapshot,
    key: string,
    intent: ActivateStoredReleaseOptions['intent']
): boolean {
    if (snapshot.pointer?.releaseId !== verified.releaseId) return false;
    try {
        verified.validatePointer(snapshot.pointer);
    } catch {
        throw activationTargetError(key, intent);
    }
    return true;
}

async function verifyTarget(
    options: ActivateStoredReleaseOptions
): Promise<ActivatableStoredRelease> {
    const media = options.media ?? 'visual';
    return verifyStoredFor(media, options);
}

async function verifyStoredFor(
    media: PublisherMedia,
    options: ActivateStoredReleaseOptions
): Promise<ActivatableStoredRelease> {
    if (media === 'audio') {
        return verifyStoredAudioRelease({
            store: options.store,
            storyId: options.storyId,
            target: options.target,
            releaseId: options.releaseId,
            expectedManifestSha256: options.expectedManifestSha256,
            depth: 'deep',
            run: options.run,
        });
    }
    return verifyStoredRelease({
        store: options.store,
        storyId: options.storyId,
        target: options.target,
        releaseId: options.releaseId,
        expectedManifestSha256: options.expectedManifestSha256,
        depth: 'deep',
    });
}

function createPointer(
    verified: ActivatableStoredRelease,
    snapshot: ActivationPointerSnapshot,
    nowMs: number
): ActiveReleasePointerV1 {
    const pointer: ActiveReleasePointerV1 = {
        ...verified.pointerCandidate,
        publishedAt: nextPublishedAt(
            snapshot.exists
                ? { exists: true, pointer: snapshot.pointer! }
                : { exists: false },
            nowMs
        ),
    };
    verified.validatePointer(pointer);
    return pointer;
}

async function writePointer(
    options: ActivateStoredReleaseOptions,
    key: string,
    snapshot: ActivationPointerSnapshot,
    pointer: ActiveReleasePointerV1
): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }> {
    const bytes = textEncoder.encode(`${canonicalJson(pointer)}\n`);
    try {
        return await options.store.compareAndSwapPointer({
            key,
            expected: expectationFor(snapshot),
            bytes,
            contentType: JSON_CONTENT_TYPE,
            cacheControl:
                RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl,
        });
    } catch {
        throw new PublisherError('storage', 'Unable to write current pointer', {
            context: { stage: 'activation', key },
            cause: SANITIZED_POINTER_WRITE_CAUSE,
        });
    }
}

function result(
    options: ActivateStoredReleaseOptions,
    verified: ActivatableStoredRelease,
    status: ActivationResult['status'],
    snapshot: ActivationPointerSnapshot,
    overrideAttempted: boolean,
    pointerAfter?: ActiveReleasePointerV1,
    etag?: string
): ActivationResult {
    return {
        status,
        storyId: options.storyId,
        target: options.target,
        releaseId: options.releaseId,
        manifestSha256: verified.manifestSha256,
        ...(snapshot.pointer === undefined
            ? {}
            : { pointerBefore: snapshot.pointer }),
        ...(pointerAfter === undefined ? {} : { pointerAfter }),
        overrideAttempted,
        ...(etag === undefined ? {} : { etag }),
    };
}

export async function activateStoredRelease(
    options: ActivateStoredReleaseOptions
): Promise<ActivationResult> {
    const media = options.media ?? 'visual';
    const key = currentPointerPathFor(media, options.storyId, options.target);
    let verified = await verifyTarget(options);
    let snapshot = await readPointer(
        options.store,
        key,
        media,
        options.target,
        options.storyId,
        options.intent
    );

    if (
        isAlreadyActive(verified, snapshot, key, options.intent) &&
        options.reactivate !== true
    ) {
        return result(options, verified, 'no-op', snapshot, false);
    }
    assertProductionConfirmation(options);

    let pointer = createPointer(
        verified,
        snapshot,
        (options.now ?? Date.now)()
    );
    let written = await writePointer(options, key, snapshot, pointer);
    if (written.status === 'written') {
        return result(
            options,
            verified,
            'success',
            snapshot,
            false,
            pointer,
            written.etag
        );
    }
    if (options.overrideConcurrentPointer !== true) {
        return result(options, verified, 'conflict', snapshot, false);
    }

    verified = await verifyTarget(options);
    snapshot = await readPointer(
        options.store,
        key,
        media,
        options.target,
        options.storyId,
        options.intent
    );
    if (
        isAlreadyActive(verified, snapshot, key, options.intent) &&
        options.reactivate !== true
    ) {
        return result(options, verified, 'no-op', snapshot, true);
    }
    pointer = createPointer(verified, snapshot, (options.now ?? Date.now)());
    written = await writePointer(options, key, snapshot, pointer);
    if (written.status === 'precondition-failed') {
        return result(options, verified, 'conflict', snapshot, true);
    }
    return result(
        options,
        verified,
        'success',
        snapshot,
        true,
        pointer,
        written.etag
    );
}
