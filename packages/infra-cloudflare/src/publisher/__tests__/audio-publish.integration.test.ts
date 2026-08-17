import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    const sourceBytes = Uint8Array.from([1, 2, 3, 4]);
    const source: PreparedAudioSource = {
        type: 'sfx',
        key: 'door-open',
        plannedDurationMs: 1_000,
        loop: false,
        candidateId: 'candidate-1',
        sourceSha256: sha256Bytes(sourceBytes),
        sourceBytes,
        sourceFilename: 'door.wav',
        sourceMediaType: 'audio/wav',
        receiptBytes: new TextEncoder().encode(
            '{"candidateId":"candidate-1"}\n'
        ),
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
        unusedPlanKeys: [],
        selectedUnusedKeys: [],
    };
}

function emptySourcePlan(): AudioSourcePlan {
    return {
        storyId: STORY_ID,
        sources: [],
        coverage: [],
        unusedPlanKeys: [],
        selectedUnusedKeys: [],
    };
}

function audioProcessRunner(normalizedBytes: Uint8Array): AudioProcessRunner {
    return async (executable, args) => {
        if (args.includes('-version')) {
            return { exitCode: 0, stdout: new Uint8Array(), stderr: '' };
        }
        if (executable === 'ffmpeg') {
            const outputPath = args.at(-1);
            if (outputPath === undefined)
                throw new Error('missing output path');
            await writeFile(outputPath, normalizedBytes);
            return { exitCode: 0, stdout: new Uint8Array(), stderr: '' };
        }

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
        private readonly label: 'source' | 'delivery',
        private readonly failFirstImmutable = false,
        private readonly timeline: string[] = []
    ) {}

    private record(event: string): void {
        this.events.push(event);
        this.timeline.push(event);
    }

    stat(key: string): Promise<StoredObjectMetadata | null> {
        this.record(`${this.label}:stat:${key}`);
        return this.base.stat(key);
    }

    async read(key: string): Promise<StoredObject> {
        this.record(`${this.label}:read:${key}`);
        return this.base.read(key);
    }

    async createImmutable(request: ImmutableCreateRequest) {
        this.record(`${this.label}:create:${request.key}`);
        this.immutableRequests.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
        });
        if (this.failFirstImmutable) {
            throw new Error('source archive unavailable');
        }
        return this.base.createImmutable(request);
    }

    inspectPointer(key: string): Promise<PointerSnapshot> {
        this.record(`${this.label}:inspect-pointer:${key}`);
        return this.base.inspectPointer(key);
    }

    readPointer(key: string): Promise<PointerSnapshot> {
        this.record(`${this.label}:read-pointer:${key}`);
        return this.base.readPointer(key);
    }

    async compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }> {
        this.record(`${this.label}:cas:${request.key}`);
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

async function stores(
    options: { failArchive?: boolean; timeline?: string[] } = {}
) {
    const sourceRoot = await mkdtemp(join(tmpdir(), 'aquila-audio-source-'));
    const deliveryRoot = await mkdtemp(
        join(tmpdir(), 'aquila-audio-delivery-')
    );
    roots.push(sourceRoot, deliveryRoot);
    return {
        source: new RecordingStore(
            new LocalDeliveryStore(sourceRoot),
            'source',
            options.failArchive ?? false,
            options.timeline
        ),
        delivery: new RecordingStore(
            new LocalDeliveryStore(deliveryRoot),
            'delivery',
            false,
            options.timeline
        ),
    };
}

describe('publishAudioRelease', () => {
    it.each(['ffmpeg', 'ffprobe'] as const)(
        'fails before writes when %s is unavailable',
        async missingExecutable => {
            const { source, delivery } = await stores();
            const unavailable: AudioProcessRunner = async executable => ({
                exitCode: executable === missingExecutable ? 127 : 0,
                stdout: new Uint8Array(),
                stderr:
                    executable === missingExecutable ? 'command not found' : '',
            });

            await expect(
                publishAudioRelease({
                    store: delivery,
                    sourceStore: source,
                    storyId: STORY_ID,
                    target: TARGET,
                    sourcePlan: emptySourcePlan(),
                    run: unavailable,
                })
            ).rejects.toMatchObject({ code: 'configuration' });

            expect(source.immutableRequests).toEqual([]);
            expect(delivery.immutableRequests).toEqual([]);
            expect(delivery.pointerRequests).toEqual([]);
        }
    );

    it('archives every source candidate before creating public delivery objects', async () => {
        const timeline: string[] = [];
        const { source, delivery } = await stores({ timeline });
        const normalizedBytes = Uint8Array.from([9, 8, 7]);
        const events: string[] = [];

        const report = await publishAudioRelease({
            store: delivery,
            sourceStore: source,
            storyId: STORY_ID,
            target: TARGET,
            sourcePlan: sourcePlan(),
            run: audioProcessRunner(normalizedBytes),
            progress: event => events.push(`${event.stage}:${event.message}`),
        });

        const archiveReadback = timeline.findIndex(
            event =>
                event ===
                'source:read:audio/approved/example_story/sfx/door-open/' +
                    `${sha256Bytes(Uint8Array.from([1, 2, 3, 4]))}/source.wav`
        );
        const publicCreate = timeline.findIndex(event =>
            event.startsWith('delivery:create:vn/objects/')
        );
        const manifestCreate = timeline.findIndex(
            event =>
                event.includes('/runtime-manifest.json') &&
                event.startsWith('delivery:create:')
        );
        const publicReadback = timeline.findIndex(
            (event, index) =>
                index > publicCreate &&
                event.startsWith('delivery:read:vn/objects/')
        );
        const validation = events.indexOf(
            'input:validated audio publish inputs'
        );
        const normalization = events.indexOf('encode:normalized audio sources');
        const archiveInspection = events.indexOf(
            'inspect:inspected audio archive candidates'
        );
        const archiveUpload = events.indexOf('upload:archived audio sources');
        const deepVerification = events.indexOf(
            'verify:deep-verified audio release'
        );

        expect(archiveReadback).toBeGreaterThanOrEqual(0);
        expect(publicCreate).toBeGreaterThan(archiveReadback);
        expect(publicReadback).toBeGreaterThan(publicCreate);
        expect(manifestCreate).toBeGreaterThan(publicReadback);
        expect(validation).toBeGreaterThanOrEqual(0);
        expect(normalization).toBeGreaterThan(validation);
        expect(archiveInspection).toBeGreaterThan(normalization);
        expect(archiveUpload).toBeGreaterThan(archiveInspection);
        expect(deepVerification).toBeGreaterThan(archiveUpload);
        expect(source.immutableRequests).toHaveLength(2);
        expect(delivery.immutableRequests).toHaveLength(2);
        expect(delivery.pointerRequests).toEqual([]);
        expect(events.at(-1)).toBe('verify:deep-verified audio release');
        expect(report).toMatchObject({
            command: 'publish',
            status: 'success',
            media: 'audio',
            pointer: { changed: false },
        });
        expect(report.pointer?.afterReleaseId).toBeUndefined();

        const archivedSource = await source.read(
            source.immutableRequests[0]!.key
        );
        const archivedReceipt = await source.read(
            source.immutableRequests[1]!.key
        );
        expect(Uint8Array.from(archivedSource.bytes)).toEqual(
            Uint8Array.from([1, 2, 3, 4])
        );
        expect(Uint8Array.from(archivedReceipt.bytes)).toEqual(
            new TextEncoder().encode('{"candidateId":"candidate-1"}\n')
        );
        expect(
            delivery.immutableRequests.map(request => request.key)
        ).not.toContain(source.immutableRequests[0]!.key);
        expect(
            delivery.immutableRequests.map(request => request.key)
        ).not.toContain(source.immutableRequests[1]!.key);
        expect(events.some(event => event.includes('activation'))).toBe(false);
    });

    it('fails archive-first without delivery writes or pointer calls', async () => {
        const { source, delivery } = await stores({ failArchive: true });

        await expect(
            publishAudioRelease({
                store: delivery,
                sourceStore: source,
                storyId: STORY_ID,
                target: TARGET,
                sourcePlan: sourcePlan(),
                run: audioProcessRunner(Uint8Array.from([9, 8, 7])),
            })
        ).rejects.toMatchObject({ code: 'storage' });

        expect(delivery.immutableRequests).toEqual([]);
        expect(delivery.pointerRequests).toEqual([]);
        expect(delivery.events).toEqual([]);
    });

    it('reads exact archived source and receipt bytes from the private store', async () => {
        const { source, delivery } = await stores();
        await publishAudioRelease({
            store: delivery,
            sourceStore: source,
            storyId: STORY_ID,
            target: TARGET,
            sourcePlan: sourcePlan(),
            run: audioProcessRunner(Uint8Array.from([9, 8, 7])),
        });

        for (const request of source.immutableRequests) {
            const stored = await source.read(request.key);
            expect(Uint8Array.from(stored.bytes)).toEqual(request.bytes);
            expect(stored.contentType).toBe(request.contentType);
            expect(stored.cacheControl).toBe('private, max-age=0, no-store');
        }
        expect(
            getAudioObjectPath(sha256Bytes(Uint8Array.from([9, 8, 7])))
        ).toBe(delivery.immutableRequests[0]!.key);
    });

    it('has no activation-module dependency', async () => {
        const moduleSource = await readFile(
            new URL('../audio-publish.ts', import.meta.url),
            'utf8'
        );
        expect(moduleSource).not.toMatch(/from ['"].*activation/);
        expect(moduleSource).not.toMatch(/compareAndSwapPointer/);
    });
});
