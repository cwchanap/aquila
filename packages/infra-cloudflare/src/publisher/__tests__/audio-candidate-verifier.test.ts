import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
    canonicalJson,
    getAudioObjectPath,
    getAudioReleaseManifestPath,
    type JsonValue,
    type ManifestByteSha256,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { LocalDeliveryStore } from '../stores/local-delivery-store';
import { sha256Bytes } from '../hash';
import { buildPreparedAudioRelease } from '../audio-runtime-release';
import { verifyStoredAudioRelease } from '../audio-candidate-verifier';
import type { NormalizedAudioAsset } from '../audio-encoder';
import type { AudioCoverageEntryV1 } from '../audio-source';
import type { DeliveryStore, StoredObject } from '../stores/delivery-store';

const target: PublicationTarget = { kind: 'production' };
const storyId = 'example_story';
const roots: string[] = [];
const immutableCache = 'public, max-age=31536000, immutable';

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

function asset(): NormalizedAudioAsset {
    const bytes = Uint8Array.from([11, 22, 33]);
    const sha256 = sha256Bytes(bytes);
    return {
        type: 'sfx',
        key: 'door-open',
        bytes,
        sha256,
        path: getAudioObjectPath(sha256),
        byteLength: bytes.byteLength,
        durationMs: 2_200,
        loop: false,
        contentType: 'audio/mpeg',
    };
}

async function fixture(
    options: {
        storeAudio?: boolean;
        assets?: readonly NormalizedAudioAsset[];
    } = {}
) {
    const audioAssets = options.assets ?? [asset()];
    const prepared = buildPreparedAudioRelease({
        storyId,
        target,
        assets: audioAssets,
        coverage: audioAssets.map(
            audioAsset =>
                ({
                    type: audioAsset.type,
                    key: audioAsset.key,
                    usageCount: 1,
                    disposition: 'included',
                }) satisfies AudioCoverageEntryV1
        ),
    });
    const root = await mkdtemp(join(tmpdir(), 'aquila-audio-candidate-'));
    roots.push(root);
    const store = new LocalDeliveryStore(root);
    await store.createImmutable({
        key: getAudioReleaseManifestPath(
            prepared.storyId,
            prepared.releaseId,
            prepared.target
        ),
        bytes: prepared.manifestBytes,
        contentType: 'application/json',
        cacheControl: immutableCache,
    });
    if (options.storeAudio === true) {
        const storedPaths = new Set<string>();
        for (const audioAsset of audioAssets) {
            if (storedPaths.has(audioAsset.path)) continue;
            storedPaths.add(audioAsset.path);
            await store.createImmutable({
                key: audioAsset.path,
                bytes: audioAsset.bytes,
                contentType: audioAsset.contentType,
                cacheControl: immutableCache,
            });
        }
    }
    return { prepared, store };
}

function decorateStore(
    base: DeliveryStore,
    transform: (key: string, object: StoredObject) => StoredObject
): DeliveryStore {
    return {
        stat: key => base.stat(key),
        read: async key => transform(key, await base.read(key)),
        createImmutable: request => base.createImmutable(request),
        inspectPointer: key => base.inspectPointer(key),
        readPointer: key => base.readPointer(key),
        compareAndSwapPointer: request => base.compareAndSwapPointer(request),
        listKeys: prefix => base.listKeys(prefix),
        list: prefix => base.list(prefix),
        close: async () => {},
    };
}

function canonicalManifestBytes(
    manifest: Awaited<ReturnType<typeof buildPreparedAudioRelease>>['manifest']
): Uint8Array {
    return new TextEncoder().encode(
        `${canonicalJson(manifest as unknown as JsonValue)}\n`
    );
}

function probeRunner(options: {
    expectedBytes: Uint8Array;
    durationMs?: number;
    includeBitRate?: boolean;
    calls: string[];
}) {
    return async (
        executable: 'ffmpeg' | 'ffprobe',
        args: readonly string[]
    ) => {
        expect(executable).toBe('ffprobe');
        const path = args.at(-1);
        if (path === undefined) throw new Error('Missing ffprobe path');
        options.calls.push(path);
        expect(Uint8Array.from(await readFile(path))).toEqual(
            options.expectedBytes
        );
        const stream: Record<string, string | number> = {
            codec_type: 'audio',
            codec_name: 'mp3',
            sample_rate: 44_100,
            duration: (options.durationMs ?? 2_200) / 1_000,
        };
        if (options.includeBitRate !== false) stream.bit_rate = 128_000;
        return {
            exitCode: 0,
            stdout: new TextEncoder().encode(
                JSON.stringify({ streams: [stream] })
            ),
            stderr: '',
        };
    };
}

describe('audio candidate verifier', () => {
    it('shallow-verifies the canonical manifest and audio pointer candidate', async () => {
        const { prepared, store } = await fixture();

        const verified = await verifyStoredAudioRelease({
            store,
            storyId: prepared.storyId,
            target: prepared.target,
            releaseId: prepared.releaseId,
            depth: 'shallow',
        });

        expect(verified.manifestBytes).toEqual(prepared.manifestBytes);
        expect(verified.manifestSha256).toBe(prepared.manifestSha256);
        expect(verified.releaseContentSha256).toBe(
            prepared.releaseContentSha256
        );
        expect(verified.pointerCandidate).toMatchObject({
            storyId,
            releaseId: prepared.releaseId,
            manifestPath: getAudioReleaseManifestPath(
                storyId,
                prepared.releaseId,
                target
            ),
        });
        expect(() =>
            verified.validatePointer(verified.pointerCandidate)
        ).not.toThrow();
    });

    it('deep-verifies stored MP3 bytes through the strict runtime probe', async () => {
        const { prepared, store } = await fixture({ storeAudio: true });
        const calls: string[] = [];

        await verifyStoredAudioRelease({
            store,
            storyId: prepared.storyId,
            target: prepared.target,
            releaseId: prepared.releaseId,
            run: probeRunner({
                expectedBytes: prepared.assets[0]!.bytes,
                calls,
            }),
        });

        expect(calls).toHaveLength(1);
    });

    it('reads and probes a shared MP3 digest once while checking each reference', async () => {
        const first = asset();
        const second = { ...first, key: 'door-close' };
        const { prepared, store } = await fixture({
            assets: [first, second],
            storeAudio: true,
        });
        const calls: string[] = [];

        await verifyStoredAudioRelease({
            store,
            storyId: prepared.storyId,
            target: prepared.target,
            releaseId: prepared.releaseId,
            run: probeRunner({ expectedBytes: first.bytes, calls }),
        });

        expect(calls).toHaveLength(1);
    });

    it('checks duration for every reference sharing one MP3 digest', async () => {
        const first = asset();
        const second = { ...first, key: 'door-close', durationMs: 2_300 };
        const { prepared, store } = await fixture({
            assets: [first, second],
            storeAudio: true,
        });
        const calls: string[] = [];

        await expect(
            verifyStoredAudioRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                run: probeRunner({ expectedBytes: first.bytes, calls }),
            })
        ).rejects.toThrow(/duration/i);
        expect(calls).toHaveLength(1);
    });

    it('rejects a stored MP3 without the required bitrate', async () => {
        const { prepared, store } = await fixture({ storeAudio: true });

        await expect(
            verifyStoredAudioRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                run: probeRunner({
                    expectedBytes: prepared.assets[0]!.bytes,
                    includeBitRate: false,
                    calls: [],
                }),
            })
        ).rejects.toThrow(
            'Runtime MP3 bitrate must be present and exactly 128000 bit/s'
        );
    });

    it.each([
        [
            'manifest MIME',
            (object: StoredObject) => ({
                ...object,
                contentType: 'text/plain',
            }),
        ],
        [
            'manifest cache',
            (object: StoredObject) => ({ ...object, cacheControl: 'no-cache' }),
        ],
        [
            'manifest key',
            (object: StoredObject) => ({
                ...object,
                key: `${object.key}.wrong`,
            }),
        ],
    ])('rejects a corrupt %s', async (_label, corrupt) => {
        const { prepared, store } = await fixture();
        const manifestPath = getAudioReleaseManifestPath(
            prepared.storyId,
            prepared.releaseId,
            prepared.target
        );

        await expect(
            verifyStoredAudioRelease({
                store: decorateStore(store, (key, object) =>
                    key === manifestPath ? corrupt(object) : object
                ),
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                depth: 'shallow',
            })
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });
    });

    it('rejects a manifest whose bytes do not match the expected checksum', async () => {
        const { prepared, store } = await fixture();
        const wrongDigest = '0'.repeat(64) as ManifestByteSha256;

        await expect(
            verifyStoredAudioRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                depth: 'shallow',
                expectedManifestSha256: wrongDigest,
            })
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });
    });

    it('rejects a release id that does not match canonical audio content', async () => {
        const { prepared, store } = await fixture();
        const invalidReleaseId = `sha256-${'0'.repeat(64)}`;
        const invalidManifest = canonicalManifestBytes({
            ...prepared.manifest,
            releaseId: invalidReleaseId,
        });
        await store.createImmutable({
            key: getAudioReleaseManifestPath(
                prepared.storyId,
                invalidReleaseId,
                prepared.target
            ),
            bytes: invalidManifest,
            contentType: 'application/json',
            cacheControl: immutableCache,
        });

        await expect(
            verifyStoredAudioRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: invalidReleaseId,
                depth: 'shallow',
            })
        ).rejects.toThrow(/release identity/i);
    });

    it('rejects a non-canonical manifest body and a story mismatch', async () => {
        const { prepared, store } = await fixture();
        const manifestPath = getAudioReleaseManifestPath(
            prepared.storyId,
            prepared.releaseId,
            prepared.target
        );
        const nonCanonical = decorateStore(store, (key, object) =>
            key === manifestPath
                ? {
                      ...object,
                      bytes: new TextEncoder().encode(
                          ` ${new TextDecoder().decode(object.bytes)}`
                      ),
                      byteLength: object.byteLength + 1,
                  }
                : object
        );
        await expect(
            verifyStoredAudioRelease({
                store: nonCanonical,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                depth: 'shallow',
            })
        ).rejects.toThrow(/canonical/i);

        const mismatchedManifest = canonicalManifestBytes({
            ...prepared.manifest,
            storyId: 'other_story',
        });
        const mismatchedStore = decorateStore(store, (key, object) =>
            key === manifestPath
                ? {
                      ...object,
                      bytes: mismatchedManifest,
                      byteLength: mismatchedManifest.byteLength,
                  }
                : object
        );
        await expect(
            verifyStoredAudioRelease({
                store: mismatchedStore,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                depth: 'shallow',
            })
        ).rejects.toThrow(/story id/i);
    });

    it('rejects an MP3 with invalid stored metadata or bytes', async () => {
        const { prepared, store } = await fixture({ storeAudio: true });
        const audioPath = prepared.assets[0]!.path;
        const corruptions = [
            [
                'key',
                (object: StoredObject) => ({
                    ...object,
                    key: `${audioPath}.wrong`,
                }),
            ],
            [
                'MIME',
                (object: StoredObject) => ({
                    ...object,
                    contentType: 'application/octet-stream',
                }),
            ],
            [
                'cache',
                (object: StoredObject) => ({
                    ...object,
                    cacheControl: 'no-cache',
                }),
            ],
            [
                'length',
                (object: StoredObject) => ({
                    ...object,
                    byteLength: object.byteLength + 1,
                }),
            ],
            [
                'SHA',
                (object: StoredObject) => ({
                    ...object,
                    bytes: Uint8Array.from(object.bytes, (byte, index) =>
                        index === 0 ? byte ^ 0xff : byte
                    ),
                }),
            ],
        ] as const;

        for (const [, corrupt] of corruptions) {
            await expect(
                verifyStoredAudioRelease({
                    store: decorateStore(store, (key, object) =>
                        key === audioPath ? corrupt(object) : object
                    ),
                    storyId: prepared.storyId,
                    target: prepared.target,
                    releaseId: prepared.releaseId,
                    run: probeRunner({
                        expectedBytes: prepared.assets[0]!.bytes,
                        calls: [],
                    }),
                })
            ).rejects.toMatchObject({
                name: 'PublisherError',
                code: 'integrity',
            });
        }
    });

    it('checks each manifest byte length even when the object digest is valid', async () => {
        const mismatchedAsset = { ...asset(), byteLength: 4 };
        const { prepared, store } = await fixture({
            assets: [mismatchedAsset],
            storeAudio: true,
        });

        await expect(
            verifyStoredAudioRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                run: probeRunner({
                    expectedBytes: mismatchedAsset.bytes,
                    calls: [],
                }),
            })
        ).rejects.toThrow(/byte length/i);
    });

    it.each([
        [2_225, false],
        [2_226, true],
    ])(
        'enforces the 25 ms duration tolerance at %d ms',
        async (durationMs, rejects) => {
            const { prepared, store } = await fixture({ storeAudio: true });
            const result = verifyStoredAudioRelease({
                store,
                storyId: prepared.storyId,
                target: prepared.target,
                releaseId: prepared.releaseId,
                run: probeRunner({
                    expectedBytes: prepared.assets[0]!.bytes,
                    durationMs,
                    calls: [],
                }),
            });

            if (rejects) {
                await expect(result).rejects.toThrow(/duration/i);
            } else {
                await expect(result).resolves.toBeDefined();
            }
        }
    );
});
