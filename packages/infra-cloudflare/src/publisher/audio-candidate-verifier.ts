import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    assertReleaseIdMatchesContentSha256,
    canonicalAudioReleaseContent,
    canonicalJson,
    getAudioObjectPath,
    getAudioReleaseManifestPath,
    parseAudioActiveReleasePointer,
    parseRuntimeAudioManifest,
    validatePointerManifestPair,
    type ActiveReleasePointerV1,
    type JsonValue,
    type ManifestByteSha256,
    type PublicationTarget,
    type ReleaseContentSha256,
    type RuntimeAudioManifestV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import {
    probeRuntimeMp3File,
    type AudioProcessRunner,
    type RuntimeMp3Probe,
} from './audio-encoder';
import { sha256Bytes, sha256ManifestBytes, sha256ReleaseContent } from './hash';
import type { DeliveryStore, StoredObject } from './stores/delivery-store';

export type AudioVerificationDepth = 'shallow' | 'deep';

export interface VerifyStoredAudioReleaseOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly depth?: AudioVerificationDepth;
    readonly expectedManifestSha256?: ManifestByteSha256;
    readonly run?: AudioProcessRunner;
}

export interface VerifiedStoredAudioRelease {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly manifest: RuntimeAudioManifestV1;
    readonly manifestBytes: Uint8Array;
    readonly manifestSha256: ManifestByteSha256;
    readonly releaseContentSha256: ReleaseContentSha256;
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}

interface AudioObjectReference {
    readonly identity: string;
    readonly path: string;
    readonly sha256: RuntimeAudioManifestV1['assets'][number]['sha256'];
    readonly byteLength: number;
    readonly durationMs: number;
}

const JSON_CONTENT_TYPE = 'application/json';
const AUDIO_CONTENT_TYPE = 'audio/mpeg';
const IMMUTABLE_CACHE_CONTROL =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;
const POINTER_TEMPLATE_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const DURATION_TOLERANCE_MS = 25;
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const textEncoder = new TextEncoder();

function integrityError(
    message: string,
    context: Readonly<Record<string, unknown>>,
    cause?: unknown
): PublisherError {
    return new PublisherError('integrity', message, { context, cause });
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((byte, index) => byte === right[index]);
}

async function readStoredObject(
    store: DeliveryStore,
    key: string
): Promise<StoredObject> {
    try {
        return await store.read(key);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to read stored audio candidate object',
            {
                context: { stage: 'verification', key },
                cause: { classification: 'delivery-store-read-failure' },
            }
        );
    }
}

function assertStoredMetadata(
    object: StoredObject,
    expected: {
        readonly key: string;
        readonly contentType: string;
        readonly cacheControl: string;
    },
    objectClass: 'manifest' | 'audio'
): void {
    const context = {
        stage: 'verification',
        key: expected.key,
        objectClass,
    };
    if (object.key !== expected.key) {
        throw integrityError(
            'Stored audio object key does not match its request',
            context
        );
    }
    if (object.byteLength !== object.bytes.byteLength) {
        throw integrityError(
            'Stored audio object byte length metadata does not match its body',
            context
        );
    }
    if (object.contentType !== expected.contentType) {
        throw integrityError(
            'Stored audio object content type is invalid',
            context
        );
    }
    if (object.cacheControl !== expected.cacheControl) {
        throw integrityError(
            'Stored audio object cache control is invalid',
            context
        );
    }
    if (Object.keys(object.customMetadata).length > 0) {
        throw integrityError(
            'Stored audio object custom metadata is not empty',
            context
        );
    }
}

function parseManifestBytes(
    bytes: Uint8Array,
    manifestPath: string
): RuntimeAudioManifestV1 {
    let input: unknown;
    try {
        input = JSON.parse(textDecoder.decode(bytes));
    } catch (cause) {
        throw integrityError(
            'Stored audio release manifest is not valid UTF-8 JSON',
            { stage: 'verification', key: manifestPath },
            cause
        );
    }
    try {
        return parseRuntimeAudioManifest(input);
    } catch (cause) {
        throw integrityError(
            'Stored audio release manifest failed runtime validation',
            { stage: 'verification', key: manifestPath },
            cause
        );
    }
}

function audioReferences(
    manifest: RuntimeAudioManifestV1
): readonly AudioObjectReference[] {
    return manifest.assets.map(asset => ({
        identity: `${asset.identity.type}:${asset.identity.key}`,
        path: asset.path,
        sha256: asset.sha256,
        byteLength: asset.byteLength,
        durationMs: asset.durationMs,
    }));
}

function assertManifestBytesAreCanonical(
    bytes: Uint8Array,
    manifest: RuntimeAudioManifestV1,
    manifestPath: string
): void {
    const exactManifestBytes = textEncoder.encode(
        `${canonicalJson(manifest as unknown as JsonValue)}\n`
    );
    if (!bytesEqual(bytes, exactManifestBytes)) {
        throw integrityError(
            'Stored audio manifest body is not the exact canonical publisher encoding',
            { stage: 'verification', key: manifestPath }
        );
    }
}

async function probeStoredAudio(
    object: StoredObject,
    reference: AudioObjectReference,
    run: AudioProcessRunner | undefined
): Promise<RuntimeMp3Probe> {
    const temporaryRoot = await mkdtemp(
        join(tmpdir(), 'aquila-audio-candidate-')
    );
    const temporaryPath = join(temporaryRoot, 'runtime.mp3');
    try {
        await writeFile(temporaryPath, object.bytes);
        return await probeRuntimeMp3File(temporaryPath, run);
    } catch (cause) {
        if (cause instanceof PublisherError) throw cause;
        throw integrityError(
            'Stored audio object could not be probed',
            { stage: 'verification', key: reference.path },
            cause
        );
    } finally {
        // Cleanup is best-effort: a failed rm must not mask the original
        // probe or integrity error.
        await rm(temporaryRoot, { recursive: true, force: true }).catch(
            () => {}
        );
    }
}

// ponytail: fixed 4-way probe concurrency; a queue-based limiter is enough at
// audio-release scale (tens of MP3 objects).
const AUDIO_PROBE_CONCURRENCY = 4;

async function verifyAudioObjectGroup(
    store: DeliveryStore,
    group: readonly AudioObjectReference[],
    run: AudioProcessRunner | undefined
): Promise<void> {
    const first = group[0];
    if (first === undefined) return;
    const expectedPath = getAudioObjectPath(first.sha256);
    const object = await readStoredObject(store, expectedPath);
    assertStoredMetadata(
        object,
        {
            key: expectedPath,
            contentType: AUDIO_CONTENT_TYPE,
            cacheControl: IMMUTABLE_CACHE_CONTROL,
        },
        'audio'
    );
    if (sha256Bytes(object.bytes) !== first.sha256) {
        throw integrityError(
            'Stored audio object body does not match its SHA-256',
            { stage: 'verification', key: expectedPath }
        );
    }

    const probe = await probeStoredAudio(object, first, run);
    for (const reference of group) {
        if (reference.path !== expectedPath) {
            throw integrityError(
                'Audio manifest object path does not match its digest',
                {
                    stage: 'verification',
                    key: reference.path,
                    identity: reference.identity,
                }
            );
        }
        if (reference.byteLength !== object.byteLength) {
            throw integrityError(
                'Audio manifest object byte length does not match stored metadata',
                {
                    stage: 'verification',
                    key: expectedPath,
                    identity: reference.identity,
                }
            );
        }
        if (
            Math.abs(probe.durationMs - reference.durationMs) >
            DURATION_TOLERANCE_MS
        ) {
            throw integrityError(
                'Stored audio duration does not match the manifest',
                {
                    stage: 'verification',
                    key: expectedPath,
                    identity: reference.identity,
                }
            );
        }
    }
}

async function verifyAudioObjects(
    store: DeliveryStore,
    references: readonly AudioObjectReference[],
    run: AudioProcessRunner | undefined
): Promise<void> {
    const groups = new Map<string, AudioObjectReference[]>();
    for (const reference of references) {
        const group = groups.get(reference.sha256);
        if (group === undefined) groups.set(reference.sha256, [reference]);
        else group.push(reference);
    }

    const queue = [...groups.values()];
    const workers = Array.from(
        { length: Math.min(AUDIO_PROBE_CONCURRENCY, queue.length) },
        async () => {
            for (
                let group = queue.shift();
                group !== undefined;
                group = queue.shift()
            ) {
                await verifyAudioObjectGroup(store, group, run);
            }
        }
    );
    await Promise.all(workers);
}

export async function verifyStoredAudioRelease(
    options: VerifyStoredAudioReleaseOptions
): Promise<VerifiedStoredAudioRelease> {
    const manifestPath = getAudioReleaseManifestPath(
        options.storyId,
        options.releaseId,
        options.target
    );
    const storedManifest = await readStoredObject(options.store, manifestPath);
    assertStoredMetadata(
        storedManifest,
        {
            key: manifestPath,
            contentType: JSON_CONTENT_TYPE,
            cacheControl: IMMUTABLE_CACHE_CONTROL,
        },
        'manifest'
    );

    const manifestSha256 = sha256ManifestBytes(storedManifest.bytes);
    if (
        options.expectedManifestSha256 !== undefined &&
        manifestSha256 !== options.expectedManifestSha256
    ) {
        throw integrityError(
            'Stored audio manifest bytes do not match the expected checksum',
            { stage: 'verification', key: manifestPath }
        );
    }

    const manifest = parseManifestBytes(storedManifest.bytes, manifestPath);
    if (manifest.storyId !== options.storyId) {
        throw integrityError(
            'Stored audio manifest story id does not match its path',
            { stage: 'verification', key: manifestPath }
        );
    }
    if (manifest.releaseId !== options.releaseId) {
        throw integrityError(
            'Stored audio manifest release id does not match its path',
            { stage: 'verification', key: manifestPath }
        );
    }

    const releaseContentSha256 = sha256ReleaseContent(
        canonicalAudioReleaseContent(manifest)
    );
    try {
        assertReleaseIdMatchesContentSha256(manifest, releaseContentSha256);
    } catch (cause) {
        throw integrityError(
            'Stored audio manifest release identity is invalid',
            { stage: 'verification', key: manifestPath },
            cause
        );
    }

    assertManifestBytesAreCanonical(
        storedManifest.bytes,
        manifest,
        manifestPath
    );

    if ((options.depth ?? 'deep') === 'deep') {
        await verifyAudioObjects(
            options.store,
            audioReferences(manifest),
            options.run
        );
    }

    const pointerCandidate: ActiveReleasePointerV1 = {
        schemaVersion: 1,
        storyId: options.storyId,
        releaseId: options.releaseId,
        manifestPath,
        manifestSha256,
        publishedAt: POINTER_TEMPLATE_TIMESTAMP,
    };
    const validatePointer = (pointer: ActiveReleasePointerV1): void => {
        const parsed = parseAudioActiveReleasePointer(
            pointer,
            options.target,
            options.storyId
        );
        validatePointerManifestPair(parsed, manifest, manifestSha256);
    };
    validatePointer(pointerCandidate);

    return {
        storyId: options.storyId,
        target: options.target,
        releaseId: options.releaseId,
        manifest,
        manifestBytes: Uint8Array.from(storedManifest.bytes),
        manifestSha256,
        releaseContentSha256,
        pointerCandidate,
        validatePointer,
    };
}
