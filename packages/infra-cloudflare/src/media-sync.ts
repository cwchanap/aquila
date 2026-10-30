import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { loadR2DeliveryConfig } from './config';

/**
 * One-way sync of committed media that is not a versioned visual release
 * (story covers and line voice) to the R2 delivery bucket. Visual releases
 * go through the `assets` publisher instead.
 *
 * Voice line ids are content-derived, so `.mp3` objects are cache-immutable
 * and create-only: a changed body under an existing key is a conflict, never
 * an overwrite. Everything else is revalidated or short-lived, so a changed
 * body just replaces the old one.
 */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const REVALIDATE_CACHE = 'no-cache, max-age=0, must-revalidate';
const COVER_CACHE = 'public, max-age=3600';
const CONCURRENCY = 8;

export interface MediaObject {
    key: string;
    body: Uint8Array;
    contentType: string;
    cacheControl: string;
    /** Create-only: a different body under an existing key is a conflict. */
    immutable: boolean;
}

export interface MediaSyncClient {
    send(command: HeadObjectCommand | PutObjectCommand): Promise<unknown>;
}

export interface MediaSyncReport {
    created: string[];
    updated: string[];
    unchanged: number;
    conflicts: string[];
}

function sha256(body: Uint8Array): string {
    return createHash('sha256').update(body).digest('hex');
}

async function listDirectories(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();
}

/** `<root>/<story>/<lineId>.mp3` and `<root>/<story>/index.json`. */
export async function collectVoiceObjects(
    voiceRoot: string
): Promise<MediaObject[]> {
    const objects: MediaObject[] = [];
    for (const story of await listDirectories(voiceRoot)) {
        const files = await readdir(join(voiceRoot, story));
        for (const file of files.sort()) {
            const isIndex = file === 'index.json';
            if (!isIndex && !file.endsWith('.mp3')) continue;
            objects.push({
                key: `vn/voice/${story}/${file}`,
                body: await readFile(join(voiceRoot, story, file)),
                contentType: isIndex ? 'application/json' : 'audio/mpeg',
                cacheControl: isIndex ? REVALIDATE_CACHE : IMMUTABLE_CACHE,
                immutable: !isIndex,
            });
        }
    }
    return objects;
}

/** `<mediaRoot>/<story>/covers/cover.png` becomes `vn/covers/<story>.webp`. */
export async function collectCoverObjects(
    mediaRoot: string
): Promise<MediaObject[]> {
    const objects: MediaObject[] = [];
    for (const story of await listDirectories(mediaRoot)) {
        let source: Buffer;
        try {
            source = await readFile(join(mediaRoot, story, 'covers/cover.png'));
        } catch {
            continue;
        }
        objects.push({
            key: `vn/covers/${story}.webp`,
            // Crop to the card's 2:3 box centred on the salient region.
            body: await sharp(source)
                .resize({
                    width: 480,
                    height: 720,
                    fit: 'cover',
                    position: 'attention',
                })
                .webp({ quality: 85, effort: 6 })
                .toBuffer(),
            contentType: 'image/webp',
            cacheControl: COVER_CACHE,
            immutable: false,
        });
    }
    return objects;
}

function isMissing(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const { name, $metadata } = error as {
        name?: unknown;
        $metadata?: { httpStatusCode?: number };
    };
    return name === 'NotFound' || $metadata?.httpStatusCode === 404;
}

async function syncOne(
    client: MediaSyncClient,
    bucket: string,
    object: MediaObject,
    dryRun: boolean,
    report: MediaSyncReport
): Promise<void> {
    const digest = sha256(object.body);
    let existing:
        | {
              Metadata?: Record<string, string>;
              ContentType?: string;
              CacheControl?: string;
          }
        | undefined;
    try {
        existing = (await client.send(
            new HeadObjectCommand({ Bucket: bucket, Key: object.key })
        )) as typeof existing;
    } catch (error) {
        if (!isMissing(error)) throw error;
    }
    if (
        existing?.Metadata?.sha256 === digest &&
        existing.ContentType === object.contentType &&
        existing.CacheControl === object.cacheControl
    ) {
        report.unchanged += 1;
        return;
    }
    if (existing && object.immutable) {
        report.conflicts.push(object.key);
        return;
    }
    if (!dryRun) {
        await client.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: object.key,
                Body: object.body,
                ContentType: object.contentType,
                CacheControl: object.cacheControl,
                Metadata: { sha256: digest },
            })
        );
    }
    (existing ? report.updated : report.created).push(object.key);
}

export async function syncMediaObjects(
    client: MediaSyncClient,
    bucket: string,
    objects: readonly MediaObject[],
    options: { dryRun?: boolean } = {}
): Promise<MediaSyncReport> {
    const report: MediaSyncReport = {
        created: [],
        updated: [],
        unchanged: 0,
        conflicts: [],
    };
    const queue = [...objects];
    const workers = Array.from(
        { length: Math.min(CONCURRENCY, queue.length) },
        async () => {
            for (let next = queue.shift(); next; next = queue.shift()) {
                await syncOne(
                    client,
                    bucket,
                    next,
                    options.dryRun ?? false,
                    report
                );
            }
        }
    );
    await Promise.all(workers);
    report.created.sort();
    report.updated.sort();
    report.conflicts.sort();
    return report;
}

function repoPath(relative: string): string {
    return resolve(
        fileURLToPath(new URL('../../..', import.meta.url)),
        relative
    );
}

export async function runMediaSync(argv: string[]): Promise<number> {
    const { values } = parseArgs({
        args: argv,
        options: {
            'dry-run': { type: 'boolean' },
            'voice-root': { type: 'string' },
            'media-root': { type: 'string' },
        },
    });
    const accessKeyId = process.env.R2_RELEASE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_RELEASE_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
        console.error(
            'R2_RELEASE_ACCESS_KEY_ID and R2_RELEASE_SECRET_ACCESS_KEY must be set'
        );
        return 1;
    }
    const config = await loadR2DeliveryConfig();
    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
    });
    try {
        const objects = [
            ...(await collectVoiceObjects(
                values['voice-root'] ?? repoPath('packages/assets/voice')
            )),
            ...(await collectCoverObjects(
                values['media-root'] ?? repoPath('packages/assets/media')
            )),
        ];
        const dryRun = values['dry-run'] === true;
        const report = await syncMediaObjects(
            client,
            config.buckets.delivery,
            objects,
            { dryRun }
        );
        console.log(
            `${dryRun ? 'Dry run: ' : ''}${report.created.length} created, ` +
                `${report.updated.length} updated, ${report.unchanged} unchanged, ` +
                `${report.conflicts.length} conflicts`
        );
        for (const key of report.conflicts) {
            console.error(`conflict: ${key} exists with different bytes`);
        }
        return report.conflicts.length === 0 ? 0 : 1;
    } finally {
        client.destroy();
    }
}

/* v8 ignore next 4 */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    process.exitCode = await runMediaSync(process.argv.slice(2));
}
