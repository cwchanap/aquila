import { createHash } from 'node:crypto';
import {
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rm,
    writeFile,
} from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    canonicalJson,
    getCurrentPointerPath,
    getReleaseManifestPath,
    type ActiveReleasePointerV1,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';
import {
    buildPublicationPlan,
    type PublicationPlan,
} from '../publication-plan';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import { LocalDeliveryStore } from '../stores/local-delivery-store';
import { PublisherError } from '../errors';

const roots: string[] = [];
const target: PublicationTarget = { kind: 'preview', previewId: 'hpa-230' };
const storyId = 'example_story';
const immutableCache =
    RUNTIME_ASSET_CACHE_POLICY.immutableRelease.responseCacheControl;

function sha256(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
}

function sidecarPath(root: string, key: string): string {
    return join(root, '.publisher-metadata', `${sha256(key)}.json`);
}

async function snapshotFiles(
    root: string,
    relative = ''
): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const entries = await readdir(join(root, relative), {
        withFileTypes: true,
    });
    for (const entry of entries.sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    )) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) {
            Object.assign(result, await snapshotFiles(root, path));
        } else {
            result[path] = Buffer.from(
                await readFile(join(root, path))
            ).toString('base64');
        }
    }
    return result;
}

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true }))
    );
});

async function fixture(): Promise<{
    repositoryRoot: string;
    sourceRoot: string;
    backgroundPath: string;
    portraitPath: string;
}> {
    const repositoryRoot = await mkdtemp(join(tmpdir(), 'aquila-plan-test-'));
    roots.push(repositoryRoot);
    const generatedRoot = join(
        repositoryRoot,
        'packages/stories/src/generated/example'
    );
    const planRoot = join(repositoryRoot, 'packages/stories/release-plans');
    const sourceRoot = join(repositoryRoot, 'sources');
    const backgroundPath = join(sourceRoot, 'backgrounds/room.png');
    const portraitPath = join(sourceRoot, 'portraits/mio.png');
    await Promise.all([
        mkdir(generatedRoot, { recursive: true }),
        mkdir(planRoot, { recursive: true }),
        mkdir(join(sourceRoot, 'backgrounds'), { recursive: true }),
        mkdir(join(sourceRoot, 'portraits'), { recursive: true }),
    ]);
    await writeFile(
        join(generatedRoot, 'image-assets.json'),
        JSON.stringify({
            storyId,
            prompts: ['private prompt must be discarded'],
            backgrounds: [
                {
                    key: 'chapter_1/room',
                    path: 'backgrounds/room.png',
                    section: 'chapter_1',
                },
            ],
            portraits: [
                {
                    key: 'mio/base',
                    path: 'portraits/mio.png',
                    section: 'chapter_1',
                },
            ],
        })
    );
    await writeFile(
        join(planRoot, `${storyId}.preview.json`),
        JSON.stringify({
            schemaVersion: 1,
            storyId,
            channel: 'preview',
            entries: [
                {
                    identity: { type: 'portrait', key: 'mio/base' },
                    disposition: 'included',
                    sourcePath: 'portraits/mio.png',
                },
                {
                    identity: {
                        type: 'background',
                        key: 'chapter_1/room',
                    },
                    disposition: 'included',
                    sourcePath: 'backgrounds/room.png',
                },
            ],
        })
    );
    await Promise.all([
        writeImage(backgroundPath, { r: 190, g: 30, b: 40 }, 32, 18),
        writeImage(portraitPath, { r: 30, g: 80, b: 190 }, 18, 24),
    ]);
    return { repositoryRoot, sourceRoot, backgroundPath, portraitPath };
}

async function writeImage(
    path: string,
    color: { r: number; g: number; b: number },
    width: number,
    height: number
): Promise<void> {
    await sharp({
        create: { width, height, channels: 3, background: color },
    })
        .png()
        .toFile(path);
}

class NoWriteStore implements DeliveryStore {
    readonly stats: string[] = [];
    readonly pointerReads: string[] = [];
    readonly writeAttempts: string[] = [];

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        this.stats.push(key);
        return null;
    }

    async read(key: string): Promise<StoredObject> {
        throw new Error(`unexpected read: ${key}`);
    }

    async createImmutable(
        request: ImmutableCreateRequest
    ): Promise<{ status: 'created' | 'already-exists' }> {
        this.writeAttempts.push(request.key);
        throw new Error('planner attempted immutable write');
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        this.writeAttempts.push(key);
        throw new Error('planner attempted recovery-capable pointer read');
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        this.pointerReads.push(key);
        return { exists: false };
    }

    async compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }> {
        this.writeAttempts.push(request.key);
        throw new Error('planner attempted pointer write');
    }

    async *list(): AsyncIterable<StoredObjectMetadata> {}
    async close(): Promise<void> {}
}

async function planWith(
    store: DeliveryStore,
    paths: Awaited<ReturnType<typeof fixture>>
): Promise<PublicationPlan> {
    return buildPublicationPlan({
        repositoryRoot: paths.repositoryRoot,
        storyId,
        target,
        store,
        sourceRoot: paths.sourceRoot,
        environment: {},
    });
}

async function materialize(
    store: DeliveryStore,
    plan: PublicationPlan,
    activate = false
): Promise<void> {
    for (const candidate of [...plan.objects, plan.manifest]) {
        await store.createImmutable({
            key: candidate.key,
            bytes: candidate.bytes,
            contentType: candidate.contentType,
            cacheControl: candidate.cacheControl,
        });
    }
    if (!activate) return;
    const pointer: ActiveReleasePointerV1 = {
        schemaVersion: 1,
        storyId,
        releaseId: plan.preparedRelease.releaseId,
        manifestPath: plan.manifest.key,
        manifestSha256: plan.preparedRelease.manifestSha256,
        publishedAt: '2026-08-01T20:00:00.000Z',
    };
    await store.compareAndSwapPointer({
        key: getCurrentPointerPath(storyId, target),
        expected: { exists: false },
        bytes: new TextEncoder().encode(`${canonicalJson(pointer)}\n`),
        contentType: 'application/json',
        cacheControl:
            RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl,
    });
}

describe('buildPublicationPlan', () => {
    it('fully encodes and inspects a deterministic release without destination writes', async () => {
        const paths = await fixture();
        const store = new NoWriteStore();

        const first = await planWith(store, paths);
        const second = await planWith(new NoWriteStore(), paths);

        expect(first.preparedRelease.releaseId).toMatch(
            /^sha256-[a-f0-9]{64}$/
        );
        expect(first.preparedRelease.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(first.preparedRelease.encodedAssets).toHaveLength(2);
        expect(first.objects).toHaveLength(3);
        expect(first.report.actions).toEqual(second.report.actions);
        expect(first.report.warnings).toEqual(second.report.warnings);
        expect(first.report.actions.map(action => action.kind)).toEqual([
            'include',
            'include',
            'create-object',
            'create-object',
            'create-object',
            'create-manifest',
            'write-pointer',
        ]);
        expect(store.stats).toHaveLength(4);
        expect(store.pointerReads).toEqual([
            getCurrentPointerPath(storyId, target),
        ]);
        expect(store.writeAttempts).toEqual([]);
    });

    it('reuses unchanged immutable items and plans exact background and portrait deltas', async () => {
        const paths = await fixture();
        const destinationRoot = await mkdtemp(
            join(tmpdir(), 'aquila-plan-destination-')
        );
        roots.push(destinationRoot);
        const store = new LocalDeliveryStore(destinationRoot);
        const initial = await planWith(store, paths);
        await materialize(store, initial, true);
        const activeSnapshot = await store.inspectPointer(
            getCurrentPointerPath(storyId, target)
        );
        expect(activeSnapshot.exists).toBe(true);

        const unchanged = await planWith(store, paths);
        expect(unchanged.report.status).toBe('no-op');
        expect(unchanged.report.counts).toMatchObject({
            objectsCreated: 0,
            objectsReused: 3,
            manifestsCreated: 0,
            manifestsReused: 1,
        });
        expect(unchanged.advisoryPointer).toEqual({
            exists: true,
            etag: activeSnapshot.exists ? activeSnapshot.etag : undefined,
            beforeReleaseId: initial.preparedRelease.releaseId,
            activationNeeded: false,
        });

        await writeImage(
            paths.backgroundPath,
            { r: 20, g: 180, b: 60 },
            32,
            18
        );
        const backgroundChanged = await planWith(store, paths);
        expect(backgroundChanged.report.counts).toMatchObject({
            objectsCreated: 2,
            objectsReused: 1,
            manifestsCreated: 1,
        });

        await writeImage(
            paths.backgroundPath,
            { r: 190, g: 30, b: 40 },
            32,
            18
        );
        await writeImage(paths.portraitPath, { r: 150, g: 40, b: 170 }, 18, 24);
        const portraitChanged = await planWith(store, paths);
        expect(portraitChanged.report.counts).toMatchObject({
            objectsCreated: 1,
            objectsReused: 2,
            manifestsCreated: 1,
        });
    });

    it('leaves a pending local pointer transaction and lock state byte-for-byte unchanged', async () => {
        const paths = await fixture();
        const destinationRoot = await mkdtemp(
            join(tmpdir(), 'aquila-plan-pending-pointer-')
        );
        roots.push(destinationRoot);
        let directoryFlushes = 0;
        const store = new LocalDeliveryStore(destinationRoot, {
            afterDirectoryFlush: async () => {
                directoryFlushes += 1;
            },
        });
        const initial = await planWith(store, paths);
        await materialize(store, initial, true);

        const bodyPath = join(
            destinationRoot,
            getCurrentPointerPath(storyId, target)
        );
        const metadataPath = sidecarPath(
            destinationRoot,
            getCurrentPointerPath(storyId, target)
        );
        const bodyTemporaryPath = `${bodyPath}.interrupted.tmp`;
        const metadataTemporaryPath = `${metadataPath}.interrupted.tmp`;
        const transactionDirectory = join(
            destinationRoot,
            '.publisher-transactions'
        );
        const transactionPath = join(
            transactionDirectory,
            `${sha256(getCurrentPointerPath(storyId, target))}.json`
        );
        const pointerAfter: ActiveReleasePointerV1 = {
            schemaVersion: 1,
            storyId,
            releaseId: initial.preparedRelease.releaseId,
            manifestPath: initial.manifest.key,
            manifestSha256: initial.preparedRelease.manifestSha256,
            publishedAt: '2026-08-01T20:00:00.001Z',
        };
        const pointerAfterBytes = new TextEncoder().encode(
            `${canonicalJson(pointerAfter)}\n`
        );
        await writeFile(bodyTemporaryPath, pointerAfterBytes);
        await writeFile(
            metadataTemporaryPath,
            `${JSON.stringify({
                version: 1,
                key: getCurrentPointerPath(storyId, target),
                etag: `local-sha256-${sha256(pointerAfterBytes)}`,
                byteLength: pointerAfterBytes.byteLength,
                contentType: 'application/json',
                cacheControl:
                    RUNTIME_ASSET_CACHE_POLICY.currentPointer
                        .responseCacheControl,
                customMetadata: {},
            })}\n`
        );
        await writeFile(
            transactionPath,
            `${JSON.stringify({
                version: 1,
                key: getCurrentPointerPath(storyId, target),
                bodyTemporaryName: basename(bodyTemporaryPath),
                metadataTemporaryName: basename(metadataTemporaryPath),
            })}\n`
        );
        const before = await snapshotFiles(destinationRoot);
        const flushesBefore = directoryFlushes;

        const planned = await planWith(store, paths);

        expect(planned.report.status).toBe('no-op');
        expect(await snapshotFiles(destinationRoot)).toEqual(before);
        expect(directoryFlushes).toBe(flushesBefore);
        expect(Object.keys(before)).toContain(
            join(
                '.publisher-transactions',
                `${sha256(getCurrentPointerPath(storyId, target))}.json`
            )
        );
        expect(Object.keys(before).some(path => path.includes('.lock.'))).toBe(
            false
        );
    });

    it('rejects an existing immutable object whose exact bytes conflict', async () => {
        const paths = await fixture();
        const destinationRoot = await mkdtemp(
            join(tmpdir(), 'aquila-plan-conflict-')
        );
        roots.push(destinationRoot);
        const store = new LocalDeliveryStore(destinationRoot);
        const initial = await planWith(store, paths);
        const candidate = initial.objects[0]!;
        await store.createImmutable({
            key: candidate.key,
            bytes: new TextEncoder().encode('conflicting bytes'),
            contentType: candidate.contentType,
            cacheControl: immutableCache,
        });

        await expect(planWith(store, paths)).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        } satisfies Partial<PublisherError>);
        expect(
            await readFile(join(destinationRoot, candidate.key), 'utf8')
        ).toBe('conflicting bytes');
    });

    it('rejects an existing manifest with conflicting required metadata', async () => {
        const paths = await fixture();
        const destinationRoot = await mkdtemp(
            join(tmpdir(), 'aquila-plan-manifest-conflict-')
        );
        roots.push(destinationRoot);
        const store = new LocalDeliveryStore(destinationRoot);
        const initial = await planWith(store, paths);
        await store.createImmutable({
            key: getReleaseManifestPath(
                storyId,
                initial.preparedRelease.releaseId,
                target
            ),
            bytes: initial.preparedRelease.manifestBytes,
            contentType: 'text/plain',
            cacheControl: immutableCache,
        });

        await expect(planWith(store, paths)).rejects.toMatchObject({
            code: 'integrity',
        });
    });
});
