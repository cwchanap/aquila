import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    collectCoverObjects,
    collectVoiceObjects,
    syncMediaObjects,
    type MediaObject,
    type MediaSyncClient,
} from '../media-sync';

interface Stored {
    sha256: string;
    contentType: string;
    cacheControl: string;
}

/** In-memory bucket that answers Head and Put like R2. */
function fakeBucket(initial: Record<string, Stored> = {}) {
    const stored = new Map(Object.entries(initial));
    const puts: string[] = [];
    const client: MediaSyncClient = {
        async send(command) {
            if (command instanceof HeadObjectCommand) {
                const object = stored.get(command.input.Key!);
                if (!object) {
                    throw Object.assign(new Error('missing'), {
                        name: 'NotFound',
                        $metadata: { httpStatusCode: 404 },
                    });
                }
                return {
                    Metadata: { sha256: object.sha256 },
                    ContentType: object.contentType,
                    CacheControl: object.cacheControl,
                };
            }
            const put = command as PutObjectCommand;
            puts.push(put.input.Key!);
            stored.set(put.input.Key!, {
                sha256: put.input.Metadata!.sha256,
                contentType: put.input.ContentType!,
                cacheControl: put.input.CacheControl!,
            });
            return {};
        },
    };
    return { client, puts, stored };
}

function object(overrides: Partial<MediaObject> = {}): MediaObject {
    return {
        key: 'vn/voice/story/aaaaaaaaaaaaaa.mp3',
        body: new TextEncoder().encode('take'),
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000, immutable',
        immutable: true,
        ...overrides,
    };
}

function stored(body: MediaObject): Stored {
    return {
        sha256: createHash('sha256').update(body.body).digest('hex'),
        contentType: body.contentType,
        cacheControl: body.cacheControl,
    };
}

describe('syncMediaObjects', () => {
    it('creates missing objects and skips identical ones', async () => {
        const existing = object({ key: 'vn/voice/story/bbbbbbbbbbbbbb.mp3' });
        const { client, puts } = fakeBucket({
            [existing.key]: stored(existing),
        });

        const report = await syncMediaObjects(client, 'bucket', [
            object(),
            existing,
        ]);

        expect(report).toEqual({
            created: ['vn/voice/story/aaaaaaaaaaaaaa.mp3'],
            updated: [],
            unchanged: 1,
            conflicts: [],
        });
        expect(puts).toEqual(['vn/voice/story/aaaaaaaaaaaaaa.mp3']);
    });

    it('replaces a changed mutable object', async () => {
        const index = object({
            key: 'vn/voice/story/index.json',
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
            immutable: false,
        });
        const { client, puts } = fakeBucket({
            [index.key]: { ...stored(index), sha256: 'stale' },
        });

        const report = await syncMediaObjects(client, 'bucket', [index]);

        expect(report.updated).toEqual([index.key]);
        expect(puts).toEqual([index.key]);
    });

    it('never overwrites an immutable object with different bytes', async () => {
        const take = object();
        const { client, puts } = fakeBucket({
            [take.key]: { ...stored(take), sha256: 'different' },
        });

        const report = await syncMediaObjects(client, 'bucket', [take]);

        expect(report.conflicts).toEqual([take.key]);
        expect(puts).toEqual([]);
    });

    it('writes nothing on a dry run but still reports what would change', async () => {
        const { client, puts } = fakeBucket();

        const report = await syncMediaObjects(client, 'bucket', [object()], {
            dryRun: true,
        });

        expect(report.created).toEqual(['vn/voice/story/aaaaaaaaaaaaaa.mp3']);
        expect(puts).toEqual([]);
    });

    it('stores takes before the index that points at them', async () => {
        const index = object({
            key: 'vn/voice/story/index.json',
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
            immutable: false,
        });
        const take = object();
        const puts: string[] = [];
        const client: MediaSyncClient = {
            async send(command) {
                if (command instanceof HeadObjectCommand) {
                    throw Object.assign(new Error('missing'), {
                        name: 'NotFound',
                        $metadata: { httpStatusCode: 404 },
                    });
                }
                const key = (command as PutObjectCommand).input.Key!;
                // The take is slow, so a concurrent index would finish first.
                await new Promise(resolve =>
                    setTimeout(resolve, key.endsWith('.mp3') ? 20 : 0)
                );
                puts.push(key);
                return {};
            },
        };

        await syncMediaObjects(client, 'bucket', [index, take]);

        expect(puts).toEqual([take.key, index.key]);
    });

    it('does not publish the index when a take fails to upload', async () => {
        const index = object({
            key: 'vn/voice/story/index.json',
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
            immutable: false,
        });
        const take = object();
        const puts: string[] = [];
        const client: MediaSyncClient = {
            async send(command) {
                if (command instanceof HeadObjectCommand) {
                    throw Object.assign(new Error('missing'), {
                        name: 'NotFound',
                        $metadata: { httpStatusCode: 404 },
                    });
                }
                const key = (command as PutObjectCommand).input.Key!;
                if (key.endsWith('.mp3')) throw new Error('upload failed');
                puts.push(key);
                return {};
            },
        };

        await expect(
            syncMediaObjects(client, 'bucket', [index, take])
        ).rejects.toThrow('upload failed');
        expect(puts).toEqual([]);
    });

    it('surfaces storage errors other than a missing object', async () => {
        const client: MediaSyncClient = {
            async send() {
                throw Object.assign(new Error('boom'), {
                    $metadata: { httpStatusCode: 500 },
                });
            },
        };

        await expect(
            syncMediaObjects(client, 'bucket', [object()])
        ).rejects.toThrow('boom');
    });
});

describe('collecting media from disk', () => {
    let root: string;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), 'media-sync-'));
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    it('maps voice files to immutable takes and a revalidated index', async () => {
        await mkdir(join(root, 'story_a'));
        await writeFile(join(root, 'story_a', 'index.json'), '{}');
        await writeFile(join(root, 'story_a', '0123456789abcd.mp3'), 'mp3');
        await writeFile(join(root, 'story_a', 'notes.txt'), 'ignored');

        const objects = await collectVoiceObjects(root);

        expect(objects.map(item => item.key)).toEqual([
            'vn/voice/story_a/0123456789abcd.mp3',
            'vn/voice/story_a/index.json',
        ]);
        const [take, index] = objects;
        expect(take).toMatchObject({
            contentType: 'audio/mpeg',
            cacheControl: 'public, max-age=31536000, immutable',
            immutable: true,
        });
        expect(index).toMatchObject({
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
            immutable: false,
        });
    });

    it('crops each story cover to a 480x720 webp', async () => {
        await mkdir(join(root, 'story_a', 'covers'), { recursive: true });
        await mkdir(join(root, 'story_b', 'characters'), { recursive: true });
        await sharp({
            create: {
                width: 900,
                height: 900,
                channels: 3,
                background: '#336699',
            },
        })
            .png()
            .toFile(join(root, 'story_a', 'covers', 'cover.png'));

        const objects = await collectCoverObjects(root);

        expect(objects).toHaveLength(1);
        expect(objects[0]).toMatchObject({
            key: 'vn/covers/story_a.webp',
            contentType: 'image/webp',
            immutable: false,
        });
        const metadata = await sharp(objects[0].body).metadata();
        expect(metadata).toMatchObject({
            format: 'webp',
            width: 480,
            height: 720,
        });
    });
});
