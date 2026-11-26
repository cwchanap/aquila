import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
    getAudioObjectPath,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { sha256Bytes } from '../hash';
import { publishAudioRelease } from '../audio-publish';
import { LocalDeliveryStore } from '../stores/local-delivery-store';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import type { AudioSourcePlan, PreparedAudioSource } from '../audio-source';
import type { AudioProcessRunner } from '../audio-encoder';

const STORY_ID = 'example_story';
const TARGET: PublicationTarget = { kind: 'production' };
const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

function sourcePlan(): AudioSourcePlan {
    const source: PreparedAudioSource = {
        type: 'sfx',
        key: 'door-open',
        plannedDurationMs: 1_000,
        loop: false,
        sourceBytes: Uint8Array.from([1, 2, 3, 4]),
        sourceFilename: 'door-open.mp3',
    };
    return {
        storyId: STORY_ID,
        sources: [source],
        coverage: [
            {
                type: 'sfx',
                key: 'door-open',
                usageCount: 1,
                disposition: 'included',
            },
        ],
        diagnostics: [],
    };
}

/** A story whose cues have no sound file yet: nothing to encode. */
function silentSourcePlan(): AudioSourcePlan {
    return {
        storyId: STORY_ID,
        sources: [],
        coverage: [
            {
                type: 'sfx',
                key: 'door-open',
                usageCount: 1,
                disposition: 'omitted',
                reason: 'no sound file committed yet',
            },
        ],
        diagnostics: [],
    };
}

function audioProcessRunner(
    normalizedBytes: Uint8Array,
    timeline: string[] = []
): AudioProcessRunner {
    return async (executable, args) => {
        if (args.includes('-version')) {
            timeline.push(`process:${executable}:availability`);
            return { exitCode: 0, stdout: new Uint8Array(), stderr: '' };
        }
        if (executable === 'ffmpeg') {
            const outputPath = args.at(-1);
            if (outputPath === undefined)
                throw new Error('missing output path');
            if (outputPath === '-') {
                timeline.push('process:ffmpeg:measure');
                return {
                    exitCode: 0,
                    stdout: new Uint8Array(),
                    stderr: `[Parsed_loudnorm_0 @ 0x1]\n${JSON.stringify({ input_i: '-24.0' })}`,
                };
            }
            timeline.push('process:ffmpeg:normalize');
            await writeFile(outputPath, normalizedBytes);
            return { exitCode: 0, stdout: new Uint8Array(), stderr: '' };
        }

        timeline.push(
            args.some(argument => argument.includes('codec_name'))
                ? 'process:ffprobe:runtime'
                : 'process:ffprobe:source'
        );

        const runtimeProbe = args.some(argument =>
            argument.includes('codec_name')
        );
        const stream = runtimeProbe
            ? {
                  codec_type: 'audio',
                  codec_name: 'mp3',
                  sample_rate: 44_100,
                  bit_rate: 128_000,
                  duration: 1,
              }
            : { codec_type: 'audio', duration: 1 };
        return {
            exitCode: 0,
            stdout: new TextEncoder().encode(
                JSON.stringify({ streams: [stream] })
            ),
            stderr: '',
        };
    };
}

class RecordingStore implements DeliveryStore {
    readonly events: string[] = [];
    readonly immutableRequests: ImmutableCreateRequest[] = [];
    readonly pointerRequests: PointerWriteRequest[] = [];

    constructor(
        private readonly base: DeliveryStore,
        private readonly timeline: string[] = []
    ) {}

    private record(event: string): void {
        this.events.push(event);
        this.timeline.push(event);
    }

    stat(key: string): Promise<StoredObjectMetadata | null> {
        this.record(`delivery:stat:${key}`);
        return this.base.stat(key);
    }

    async read(key: string): Promise<StoredObject> {
        this.record(`delivery:read:${key}`);
        return this.base.read(key);
    }

    async createImmutable(request: ImmutableCreateRequest) {
        this.record(`delivery:create:${request.key}`);
        this.immutableRequests.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
        });
        return this.base.createImmutable(request);
    }

    inspectPointer(key: string): Promise<PointerSnapshot> {
        this.record(`delivery:inspect-pointer:${key}`);
        return this.base.inspectPointer(key);
    }

    readPointer(key: string): Promise<PointerSnapshot> {
        this.record(`delivery:read-pointer:${key}`);
        return this.base.readPointer(key);
    }

    async compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }> {
        this.record(`delivery:cas:${request.key}`);
        this.pointerRequests.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
        });
        throw new Error('audio publish must not activate');
    }

    listKeys(prefix: string): AsyncIterable<string> {
        return this.base.listKeys(prefix);
    }

    list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        return this.base.list(prefix);
    }

    close(): Promise<void> {
        return this.base.close();
    }
}

async function deliveryStore(timeline: string[] = []) {
    const root = await mkdtemp(join(tmpdir(), 'aquila-audio-delivery-'));
    roots.push(root);
    return new RecordingStore(new LocalDeliveryStore(root), timeline);
}

describe('publishAudioRelease', () => {
    it.each(['ffmpeg', 'ffprobe'] as const)(
        'fails before writes when %s is unavailable',
        async missingExecutable => {
            const delivery = await deliveryStore();
            const unavailable: AudioProcessRunner = async executable => ({
                exitCode: executable === missingExecutable ? 127 : 0,
                stdout: new Uint8Array(),
                stderr:
                    executable === missingExecutable ? 'command not found' : '',
            });

            await expect(
                publishAudioRelease({
                    store: delivery,
                    storyId: STORY_ID,
                    target: TARGET,
                    sourcePlan: silentSourcePlan(),
                    run: unavailable,
                })
            ).rejects.toMatchObject({ code: 'configuration' });

            expect(delivery.immutableRequests).toEqual([]);
            expect(delivery.pointerRequests).toEqual([]);
        }
    );

    it('levels, uploads the objects, then the manifest, verifies, and never activates', async () => {
        const timeline: string[] = [];
        const delivery = await deliveryStore(timeline);
        const normalizedBytes = Uint8Array.from([9, 8, 7]);
        const events: string[] = [];

        const report = await publishAudioRelease({
            store: delivery,
            storyId: STORY_ID,
            target: TARGET,
            sourcePlan: sourcePlan(),
            run: audioProcessRunner(normalizedBytes, timeline),
            progress: event => {
                const marker = `${event.stage}:${event.message}`;
                events.push(marker);
                timeline.push(`progress:${marker}`);
            },
        });

        const objectKey = getAudioObjectPath(sha256Bytes(normalizedBytes));
        const manifestKey = delivery.immutableRequests.find(request =>
            request.key.endsWith('/runtime-manifest.json')
        )!.key;
        const expectedSubsequence = [
            'process:ffmpeg:availability',
            'process:ffprobe:availability',
            'progress:input:validated audio publish inputs',
            'process:ffprobe:source',
            'process:ffmpeg:measure',
            'process:ffmpeg:normalize',
            'process:ffprobe:runtime',
            'progress:encode:normalized audio sources',
            `delivery:stat:${objectKey}`,
            `delivery:stat:${manifestKey}`,
            `delivery:inspect-pointer:vn/audio/stories/${STORY_ID}/current.json`,
            `delivery:create:${objectKey}`,
            `delivery:read:${objectKey}`,
            'progress:upload:published audio objects',
            `delivery:create:${manifestKey}`,
            `delivery:read:${manifestKey}`,
            'progress:upload:published audio manifest',
            `delivery:read:${manifestKey}`,
            `delivery:read:${objectKey}`,
            'process:ffprobe:runtime',
            'progress:verify:deep-verified audio release',
        ];
        let cursor = 0;
        for (const event of expectedSubsequence) {
            const index = timeline.indexOf(event, cursor);
            expect(
                index,
                `missing ${event} in total timeline: ${timeline.join(' | ')}`
            ).toBeGreaterThanOrEqual(0);
            cursor = index + 1;
        }
        expect(delivery.immutableRequests).toHaveLength(2);
        expect(delivery.pointerRequests).toEqual([]);
        expect(events.at(-1)).toBe('verify:deep-verified audio release');
        expect(events.some(event => event.includes('activation'))).toBe(false);
        expect(report).toMatchObject({
            command: 'publish',
            status: 'success',
            media: 'audio',
            pointer: { changed: false },
        });
        expect(report.pointer?.afterReleaseId).toBeUndefined();
    });

    it('publishes a release for a story whose cues have no sound files yet', async () => {
        const delivery = await deliveryStore();

        const report = await publishAudioRelease({
            store: delivery,
            storyId: STORY_ID,
            target: TARGET,
            sourcePlan: silentSourcePlan(),
            run: audioProcessRunner(Uint8Array.from([9, 8, 7])),
        });

        // Only the manifest: no sound object exists to upload.
        expect(delivery.immutableRequests.map(request => request.key)).toEqual([
            expect.stringMatching(/\/runtime-manifest\.json$/),
        ]);
        expect(report).toMatchObject({ command: 'publish', media: 'audio' });
    });

    it('reuses the objects and manifest of an identical second publish', async () => {
        const delivery = await deliveryStore();
        const run = audioProcessRunner(Uint8Array.from([9, 8, 7]));
        const publish = () =>
            publishAudioRelease({
                store: delivery,
                storyId: STORY_ID,
                target: TARGET,
                sourcePlan: sourcePlan(),
                run,
            });

        await publish();
        const second = await publish();

        expect(second.status).toBe('no-op');
        expect(second.counts).toMatchObject({
            objectsCreated: 0,
            manifestsCreated: 0,
        });
    });

    it('rejects an empty sound file and duplicate cues before touching the store', async () => {
        const delivery = await deliveryStore();
        const plan = sourcePlan();
        const [source] = plan.sources;

        await expect(
            publishAudioRelease({
                store: delivery,
                storyId: STORY_ID,
                target: TARGET,
                sourcePlan: {
                    ...plan,
                    sources: [{ ...source!, sourceBytes: new Uint8Array() }],
                },
                run: audioProcessRunner(Uint8Array.from([9, 8, 7])),
            })
        ).rejects.toMatchObject({ code: 'input' });
        await expect(
            publishAudioRelease({
                store: delivery,
                storyId: STORY_ID,
                target: TARGET,
                sourcePlan: { ...plan, sources: [source!, source!] },
                run: audioProcessRunner(Uint8Array.from([9, 8, 7])),
            })
        ).rejects.toMatchObject({ code: 'input' });

        expect(delivery.events).toEqual([]);
    });

    it('discovers a malformed advisory pointer before writing anything', async () => {
        const delivery = await deliveryStore();
        // Poison the advisory pointer: it exists but carries a conflicting
        // content type, so the preflight must reject it before any write.
        const conflictingPointerDelivery: DeliveryStore = {
            stat: (key: string) => delivery.stat(key),
            read: (key: string) => delivery.read(key),
            createImmutable: (req: ImmutableCreateRequest) =>
                delivery.createImmutable(req),
            inspectPointer: async (key: string) => {
                await delivery.inspectPointer(key);
                return {
                    exists: true,
                    etag: 'stale-etag',
                    bytes: new TextEncoder().encode('{}'),
                    contentType: 'text/plain',
                    cacheControl: 'no-cache',
                    customMetadata: {},
                };
            },
            readPointer: (key: string) => delivery.readPointer(key),
            compareAndSwapPointer: (req: PointerWriteRequest) =>
                delivery.compareAndSwapPointer(req),
            listKeys: (prefix: string) => delivery.listKeys(prefix),
            list: (prefix: string) => delivery.list(prefix),
            close: () => delivery.close(),
        };

        await expect(
            publishAudioRelease({
                store: conflictingPointerDelivery,
                storyId: STORY_ID,
                target: TARGET,
                sourcePlan: sourcePlan(),
                run: audioProcessRunner(Uint8Array.from([9, 8, 7])),
            })
        ).rejects.toMatchObject({ code: 'integrity' });

        expect(delivery.immutableRequests).toEqual([]);
    });
});
