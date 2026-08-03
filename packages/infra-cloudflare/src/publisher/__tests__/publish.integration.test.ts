import {
    mkdtemp,
    mkdir,
    readFile,
    readdir,
    rm,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    canonicalJson,
    getCurrentPointerPath,
    getReleaseManifestPath,
    type ActiveReleasePointerV1,
    type PublicationTarget,
} from '@aquila/stories/runtime-assets';
import { coordinateStaleConflict } from '../../../scripts/r2-stale-conflict-coordinator';
import { verifyStoredRelease } from '../candidate-verifier';
import { PublisherError } from '../errors';
import { publishRelease, type PublishReleaseOptions } from '../publish';
import { buildPublicationPlan } from '../publication-plan';
import type { PublisherReportV1 } from '../report';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';
import { LocalDeliveryStore } from '../stores/local-delivery-store';
import { chmodTree } from './fs-tree-helpers';

const STORY_ID = 'example_story';
const PREVIEW_TARGET: PublicationTarget = {
    kind: 'preview',
    previewId: 'hpa-230',
};
const PRODUCTION_TARGET: PublicationTarget = { kind: 'production' };
const POINTER_CACHE =
    RUNTIME_ASSET_CACHE_POLICY.currentPointer.responseCacheControl;
const roots: string[] = [];
const stores: DeliveryStore[] = [];
const textEncoder = new TextEncoder();

afterEach(async () => {
    await Promise.all(stores.splice(0).map(store => store.close()));
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

async function fixture(channel: 'preview' | 'production' = 'preview') {
    const repositoryRoot = await mkdtemp(
        join(tmpdir(), 'aquila-publish-test-')
    );
    const destinationRoot = await mkdtemp(
        join(tmpdir(), 'aquila-publish-destination-')
    );
    roots.push(repositoryRoot, destinationRoot);
    const generatedRoot = join(
        repositoryRoot,
        'packages/stories/src/generated/example'
    );
    const planRoot = join(repositoryRoot, 'packages/stories/release-plans');
    const sourceRoot = join(repositoryRoot, 'sources');
    await Promise.all([
        mkdir(generatedRoot, { recursive: true }),
        mkdir(planRoot, { recursive: true }),
        mkdir(join(sourceRoot, 'backgrounds'), { recursive: true }),
        mkdir(join(sourceRoot, 'portraits'), { recursive: true }),
    ]);
    await writeFile(
        join(generatedRoot, 'image-assets.json'),
        JSON.stringify({
            storyId: STORY_ID,
            prompts: ['private authoring prompt'],
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
    const planPath = join(
        planRoot,
        channel === 'preview' ? `${STORY_ID}.preview.json` : `${STORY_ID}.json`
    );
    await writeFile(
        planPath,
        JSON.stringify({
            schemaVersion: 1,
            storyId: STORY_ID,
            channel,
            entries: [
                {
                    identity: { type: 'background', key: 'chapter_1/room' },
                    disposition: 'included',
                    sourcePath: 'backgrounds/room.png',
                },
                {
                    identity: { type: 'portrait', key: 'mio/base' },
                    disposition: 'included',
                    sourcePath: 'portraits/mio.png',
                },
            ],
        })
    );
    await Promise.all([
        sharp({
            create: {
                width: 32,
                height: 18,
                channels: 3,
                background: { r: 190, g: 30, b: 40 },
            },
        })
            .png()
            .toFile(join(sourceRoot, 'backgrounds/room.png')),
        sharp({
            create: {
                width: 18,
                height: 24,
                channels: 4,
                background: { r: 30, g: 80, b: 190, alpha: 0.5 },
            },
        })
            .png()
            .toFile(join(sourceRoot, 'portraits/mio.png')),
    ]);
    const local = new LocalDeliveryStore(destinationRoot);
    stores.push(local);
    return {
        repositoryRoot,
        destinationRoot,
        sourceRoot,
        planPath,
        local,
    };
}

function options(
    paths: Awaited<ReturnType<typeof fixture>>,
    store: DeliveryStore = paths.local,
    overrides: Partial<PublishReleaseOptions> = {}
): PublishReleaseOptions {
    return {
        repositoryRoot: paths.repositoryRoot,
        storyId: STORY_ID,
        target: PREVIEW_TARGET,
        store,
        sourceRoot: paths.sourceRoot,
        environment: {},
        now: () => Date.parse('2026-08-01T20:00:00.000Z'),
        ...overrides,
    };
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
        left.name.localeCompare(right.name)
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

class RecordingStore implements DeliveryStore {
    readonly immutableRequests: ImmutableCreateRequest[] = [];
    readonly pointerRequests: PointerWriteRequest[] = [];
    readonly events: string[] = [];
    closeCount = 0;
    onCreate?: (
        request: ImmutableCreateRequest,
        attempt: number
    ) => Promise<{ status: 'created' | 'already-exists' }>;
    afterInspectPointer?: (snapshot: PointerSnapshot) => Promise<void> | void;
    afterReadPointer?: (
        snapshot: PointerSnapshot,
        attempt: number
    ) => Promise<void> | void;

    constructor(readonly base: DeliveryStore) {}

    stat(key: string): Promise<StoredObjectMetadata | null> {
        return this.base.stat(key);
    }

    async read(key: string): Promise<StoredObject> {
        this.events.push(`read:${key}`);
        return this.base.read(key);
    }

    async createImmutable(request: ImmutableCreateRequest) {
        this.immutableRequests.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
        });
        this.events.push(`create:${request.key}`);
        if (this.onCreate !== undefined) {
            return this.onCreate(request, this.immutableRequests.length);
        }
        return this.base.createImmutable(request);
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        const snapshot = await this.base.inspectPointer(key);
        this.events.push(`inspect-pointer:${key}`);
        await this.afterInspectPointer?.(snapshot);
        return cloneSnapshot(snapshot);
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        const snapshot = await this.base.readPointer(key);
        const attempt =
            this.events.filter(event => event.startsWith('read-pointer:'))
                .length + 1;
        this.events.push(`read-pointer:${key}`);
        await this.afterReadPointer?.(snapshot, attempt);
        return cloneSnapshot(snapshot);
    }

    async compareAndSwapPointer(request: PointerWriteRequest) {
        this.pointerRequests.push({
            ...request,
            bytes: Uint8Array.from(request.bytes),
        });
        this.events.push(`cas:${request.key}`);
        return this.base.compareAndSwapPointer(request);
    }

    list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        return this.base.list(prefix);
    }

    listKeys(prefix: string): AsyncIterable<string> {
        return this.base.listKeys(prefix);
    }

    async close(): Promise<void> {
        this.closeCount += 1;
    }
}

function cloneSnapshot(snapshot: PointerSnapshot): PointerSnapshot {
    return snapshot.exists
        ? { ...snapshot, bytes: Uint8Array.from(snapshot.bytes) }
        : { exists: false };
}

function pointer(
    releaseId: `sha256-${string}`,
    manifestSha256: string,
    target: PublicationTarget,
    publishedAt: string
): ActiveReleasePointerV1 {
    return {
        schemaVersion: 1,
        storyId: STORY_ID,
        releaseId,
        manifestPath: getReleaseManifestPath(STORY_ID, releaseId, target),
        manifestSha256:
            manifestSha256 as ActiveReleasePointerV1['manifestSha256'],
        publishedAt,
    };
}

async function writePointer(
    store: DeliveryStore,
    target: PublicationTarget,
    value: ActiveReleasePointerV1
): Promise<void> {
    const key = getCurrentPointerPath(STORY_ID, target);
    const current = await store.readPointer(key);
    const result = await store.compareAndSwapPointer({
        key,
        expected: current.exists
            ? { exists: true, etag: current.etag }
            : { exists: false },
        bytes: textEncoder.encode(`${canonicalJson(value)}\n`),
        contentType: 'application/json',
        cacheControl: POINTER_CACHE,
    });
    expect(result.status).toBe('written');
}

function fakePointer(index: number, target: PublicationTarget) {
    const digit = String(index).slice(-1);
    return pointer(
        `sha256-${digit.repeat(64)}`,
        String((index + 1) % 10).repeat(64),
        target,
        `2026-08-01T19:5${index}:00.000Z`
    );
}

function republishedPointer(
    value: ActiveReleasePointerV1,
    publishedAt: string
): ActiveReleasePointerV1 {
    return { ...value, publishedAt };
}

describe('publishRelease', () => {
    it('publishes immutable objects and manifest before a final pointer, then unchanged publication is a zero-write no-op', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        const before = await snapshotFiles(paths.destinationRoot);

        const first = await publishRelease(options(paths, store));
        const afterFirst = await snapshotFiles(paths.destinationRoot);
        const firstEvents = [...store.events];
        const firstWriteCounts = {
            immutable: store.immutableRequests.length,
            pointer: store.pointerRequests.length,
        };
        const second = await publishRelease(options(paths, store));
        const afterSecond = await snapshotFiles(paths.destinationRoot);

        expect(before).toEqual({});
        expect(Object.keys(afterFirst)).not.toHaveLength(0);
        expect(first).toMatchObject({
            command: 'publish',
            status: 'success',
            counts: {
                objectsCreated: 3,
                objectsReused: 0,
                manifestsCreated: 1,
                manifestsReused: 0,
                pointersWritten: 1,
            },
        });
        expect(
            store.immutableRequests.map(request => request.contentType).sort()
        ).toEqual([
            'application/json',
            'image/avif',
            'image/webp',
            'image/webp',
        ]);
        expect(
            store.immutableRequests.every(
                request =>
                    request.cacheControl ===
                    RUNTIME_ASSET_CACHE_POLICY.immutableRelease
                        .responseCacheControl
            )
        ).toBe(true);
        const manifestCreate = firstEvents.findIndex(event =>
            event.includes('runtime-manifest.json')
        );
        const objectReadbacksBeforeManifest = firstEvents.filter(
            (event, index) =>
                event.startsWith('read:vn/objects/') && index < manifestCreate
        );
        expect(objectReadbacksBeforeManifest).toHaveLength(3);
        expect(firstEvents.at(-1)).toContain('cas:');
        expect(second).toMatchObject({
            command: 'publish',
            status: 'no-op',
            counts: {
                objectsCreated: 0,
                objectsReused: 3,
                manifestsCreated: 0,
                manifestsReused: 1,
                pointersWritten: 0,
            },
        });
        expect(store.immutableRequests).toHaveLength(
            firstWriteCounts.immutable
        );
        expect(store.pointerRequests).toHaveLength(firstWriteCounts.pointer);
        expect(afterSecond).toEqual(afterFirst);
    });

    it('publishes and deeply verifies a no-activate candidate without creating a pointer', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);

        const report = await publishRelease(
            options(paths, store, { noActivate: true })
        );
        const files = await snapshotFiles(paths.destinationRoot);

        expect(report.status).toBe('success');
        expect(report.counts.pointersWritten).toBe(0);
        expect(store.pointerRequests).toEqual([]);
        expect(
            await paths.local.stat(
                getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)
            )
        ).toBeNull();
        expect(
            Object.keys(files).some(path => path.endsWith('current.json'))
        ).toBe(false);
    });

    it('verifies and reuses an identical immutable object won by another publisher', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        store.onCreate = async request => {
            await paths.local.createImmutable(request);
            return { status: 'already-exists' };
        };

        const report = await publishRelease(
            options(paths, store, { noActivate: true })
        );

        expect(report.counts).toMatchObject({
            objectsCreated: 0,
            objectsReused: 3,
            manifestsCreated: 0,
            manifestsReused: 1,
            pointersWritten: 0,
        });
        expect(report.status).toBe('no-op');
    });

    it('leaves raced immutable bytes in place and the pointer unchanged when verification finds a mismatch', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        let racedKey = '';
        store.onCreate = async request => {
            if (racedKey === '') {
                racedKey = request.key;
                await paths.local.createImmutable({
                    ...request,
                    bytes: textEncoder.encode('winner-bytes-do-not-match'),
                });
                return { status: 'already-exists' };
            }
            return paths.local.createImmutable(request);
        };

        await expect(
            publishRelease(options(paths, store))
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });

        expect(store.pointerRequests).toEqual([]);
        expect(
            new TextDecoder().decode((await paths.local.read(racedKey)).bytes)
        ).toBe('winner-bytes-do-not-match');
        expect((await paths.local.stat(racedKey))?.key).toBe(racedKey);
    });

    it('leaves a raced conflicting manifest and all published objects in place without pointer mutation', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        let racedManifest = '';
        store.onCreate = async request => {
            if (request.key.endsWith('/runtime-manifest.json')) {
                racedManifest = request.key;
                await paths.local.createImmutable({
                    ...request,
                    bytes: textEncoder.encode('{"winner":"different"}\n'),
                });
                return { status: 'already-exists' };
            }
            return paths.local.createImmutable(request);
        };

        await expect(
            publishRelease(options(paths, store))
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });

        expect(store.pointerRequests).toEqual([]);
        expect(
            new TextDecoder().decode(
                (await paths.local.read(racedManifest)).bytes
            )
        ).toBe('{"winner":"different"}\n');
        const storedObjects: StoredObjectMetadata[] = [];
        for await (const metadata of paths.local.list('vn/objects/')) {
            storedObjects.push(metadata);
        }
        expect(storedObjects).toHaveLength(3);
    });

    it('detects advisory pointer drift before CAS and returns a conflict', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        await writePointer(
            paths.local,
            PREVIEW_TARGET,
            fakePointer(1, PREVIEW_TARGET)
        );
        store.afterInspectPointer = async () => {
            store.afterInspectPointer = undefined;
            await writePointer(
                paths.local,
                PREVIEW_TARGET,
                fakePointer(2, PREVIEW_TARGET)
            );
        };

        const report = await publishRelease(options(paths, store));

        expect(report.status).toBe('conflict');
        expect(report.counts.pointersWritten).toBe(0);
        expect(store.pointerRequests).toEqual([]);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(1);
    });

    it('coordinates stale drift when every object is reused and only the preview manifest is created', async () => {
        const paths = await fixture();
        const active = await publishRelease(options(paths));
        if (
            active.releaseId === undefined ||
            active.manifestSha256 === undefined
        ) {
            throw new Error('initial publication did not produce a release');
        }

        await sharp({
            create: {
                width: 32,
                height: 18,
                channels: 3,
                background: { r: 20, g: 170, b: 90 },
            },
        })
            .png()
            .toFile(join(paths.sourceRoot, 'backgrounds/room.png'));
        const candidate = await buildPublicationPlan(options(paths));
        expect(candidate.preparedRelease.releaseId).not.toBe(active.releaseId);
        for (const object of candidate.objects) {
            await paths.local.createImmutable(object);
        }
        expect(await paths.local.stat(candidate.manifest.key)).toBeNull();

        const publishStore = new RecordingStore(paths.local);
        const activationStore = new RecordingStore(paths.local);
        const result = await coordinateStaleConflict({
            publishArgs: [
                'publish',
                '--story',
                STORY_ID,
                '--environment',
                'preview',
                '--preview-id',
                PREVIEW_TARGET.previewId,
                '--plan',
                paths.planPath,
                '--source-root',
                paths.sourceRoot,
                '--destination',
                'r2',
                '--json',
            ],
            activationArgs: [
                'activate',
                '--story',
                STORY_ID,
                '--environment',
                'preview',
                '--preview-id',
                PREVIEW_TARGET.previewId,
                '--release',
                active.releaseId,
                '--expect-manifest-sha256',
                active.manifestSha256,
                '--destination',
                'r2',
                '--reactivate',
                '--json',
            ],
            createPublishStore: () => publishStore,
            createActivationStore: () => activationStore,
            cliOverrides: {
                repositoryRoot: paths.repositoryRoot,
                environment: {
                    R2_PUBLISHER_ACCESS_KEY_ID: 'publisher-access',
                    R2_PUBLISHER_SECRET_ACCESS_KEY: 'publisher-secret',
                },
                createLocalStore: async () => {
                    throw new Error('local store must not be selected');
                },
            },
        });

        const report = JSON.parse(result.publishStdout) as PublisherReportV1;
        const activationReport = JSON.parse(
            result.activationStdout
        ) as PublisherReportV1;
        expect(result).toMatchObject({
            publishExit: 4,
            activationExit: 0,
        });
        expect(result.issue).toBeUndefined();
        expect(report).toMatchObject({
            status: 'conflict',
            counts: {
                objectsCreated: 0,
                objectsReused: 3,
                manifestsCreated: 1,
                manifestsReused: 0,
                pointersWritten: 0,
            },
        });
        expect(activationReport).toMatchObject({
            command: 'activate',
            status: 'success',
            counts: { pointersWritten: 1 },
        });
        expect(publishStore.immutableRequests).toHaveLength(1);
        expect(publishStore.immutableRequests[0]?.key).toBe(
            candidate.manifest.key
        );
        expect(
            publishStore.immutableRequests.filter(request =>
                request.key.startsWith('vn/objects/')
            )
        ).toHaveLength(0);
        expect(publishStore.pointerRequests).toHaveLength(0);
        expect(activationStore.pointerRequests).toHaveLength(1);
        expect(publishStore.closeCount).toBe(1);
        expect(activationStore.closeCount).toBe(1);
    });

    it('detects same-release new-ETag drift on the initial fresh read before real CAS', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        const active = fakePointer(1, PREVIEW_TARGET);
        await writePointer(paths.local, PREVIEW_TARGET, active);
        store.afterInspectPointer = async () => {
            store.afterInspectPointer = undefined;
            await writePointer(
                paths.local,
                PREVIEW_TARGET,
                republishedPointer(active, '2026-08-01T19:59:00.001Z')
            );
        };

        const report = await publishRelease(options(paths, store));

        expect(report.status).toBe('conflict');
        expect(report.counts.pointersWritten).toBe(0);
        expect(store.pointerRequests).toEqual([]);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(1);
    });

    it('overrides same-release new-ETag drift from the initial fresh read with one refreshed CAS', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        const active = fakePointer(1, PREVIEW_TARGET);
        await writePointer(paths.local, PREVIEW_TARGET, active);
        store.afterInspectPointer = async () => {
            store.afterInspectPointer = undefined;
            await writePointer(
                paths.local,
                PREVIEW_TARGET,
                republishedPointer(active, '2026-08-01T19:59:00.001Z')
            );
        };

        const report = await publishRelease(
            options(paths, store, { overrideConcurrentPointer: true })
        );

        expect(report.status).toBe('success');
        expect(report.counts.pointersWritten).toBe(1);
        expect(store.pointerRequests).toHaveLength(1);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(2);
    });

    it('reverifies after advisory drift, takes another fresh snapshot, and attempts one refreshed CAS with override', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        await writePointer(
            paths.local,
            PREVIEW_TARGET,
            fakePointer(1, PREVIEW_TARGET)
        );
        store.afterInspectPointer = async () => {
            store.afterInspectPointer = undefined;
            await writePointer(
                paths.local,
                PREVIEW_TARGET,
                fakePointer(2, PREVIEW_TARGET)
            );
        };

        const report = await publishRelease(
            options(paths, store, { overrideConcurrentPointer: true })
        );

        expect(report.status).toBe('success');
        expect(report.counts.pointersWritten).toBe(1);
        expect(store.pointerRequests).toHaveLength(1);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(2);
        const secondPointerRead = store.events.lastIndexOf(
            `read-pointer:${getCurrentPointerPath(STORY_ID, PREVIEW_TARGET)}`
        );
        expect(
            store.events
                .slice(0, secondPointerRead)
                .filter(event => event.startsWith('read:')).length
        ).toBeGreaterThan(4);
        expect(store.events.at(-1)).toContain('cas:');
    });

    it('reports a conflict when the pointer changes after the fresh read', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        await writePointer(
            paths.local,
            PREVIEW_TARGET,
            fakePointer(1, PREVIEW_TARGET)
        );
        store.afterReadPointer = async (_snapshot, attempt) => {
            if (attempt === 2) {
                await writePointer(
                    paths.local,
                    PREVIEW_TARGET,
                    fakePointer(2, PREVIEW_TARGET)
                );
            }
        };

        const report = await publishRelease(options(paths, store));

        expect(report.status).toBe('conflict');
        expect(report.counts.pointersWritten).toBe(0);
        expect(store.pointerRequests).toHaveLength(1);
    });

    it('detects advisory drift that appears on the activation service fresh read before store CAS', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        await writePointer(
            paths.local,
            PREVIEW_TARGET,
            fakePointer(1, PREVIEW_TARGET)
        );
        store.afterReadPointer = async (_snapshot, attempt) => {
            if (attempt === 1) {
                await writePointer(
                    paths.local,
                    PREVIEW_TARGET,
                    fakePointer(2, PREVIEW_TARGET)
                );
            }
        };

        const report = await publishRelease(options(paths, store));

        expect(report.status).toBe('conflict');
        expect(report.counts.pointersWritten).toBe(0);
        expect(store.pointerRequests).toEqual([]);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(2);
    });

    it('detects same-release new-ETag drift on the activation service fresh read before real CAS', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        const active = fakePointer(1, PREVIEW_TARGET);
        await writePointer(paths.local, PREVIEW_TARGET, active);
        store.afterReadPointer = async (_snapshot, attempt) => {
            if (attempt === 1) {
                await writePointer(
                    paths.local,
                    PREVIEW_TARGET,
                    republishedPointer(active, '2026-08-01T19:59:00.001Z')
                );
            }
        };

        const report = await publishRelease(options(paths, store));

        expect(report.status).toBe('conflict');
        expect(report.counts.pointersWritten).toBe(0);
        expect(store.pointerRequests).toEqual([]);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(2);
    });

    it('reverifies and takes one more snapshot before one CAS when late advisory drift is overridden', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        await writePointer(
            paths.local,
            PREVIEW_TARGET,
            fakePointer(1, PREVIEW_TARGET)
        );
        store.afterReadPointer = async (_snapshot, attempt) => {
            if (attempt === 1) {
                await writePointer(
                    paths.local,
                    PREVIEW_TARGET,
                    fakePointer(2, PREVIEW_TARGET)
                );
            }
        };

        const report = await publishRelease(
            options(paths, store, { overrideConcurrentPointer: true })
        );

        expect(report.status).toBe('success');
        expect(report.counts.pointersWritten).toBe(1);
        expect(store.pointerRequests).toHaveLength(1);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(3);
        expect(store.events.at(-1)).toContain('cas:');
    });

    it('reverifies and rereads before one CAS when late same-release new-ETag drift is overridden', async () => {
        const paths = await fixture();
        const store = new RecordingStore(paths.local);
        const active = fakePointer(1, PREVIEW_TARGET);
        await writePointer(paths.local, PREVIEW_TARGET, active);
        store.afterReadPointer = async (_snapshot, attempt) => {
            if (attempt === 1) {
                await writePointer(
                    paths.local,
                    PREVIEW_TARGET,
                    republishedPointer(active, '2026-08-01T19:59:00.001Z')
                );
            }
        };

        const report = await publishRelease(
            options(paths, store, { overrideConcurrentPointer: true })
        );

        expect(report.status).toBe('success');
        expect(report.counts.pointersWritten).toBe(1);
        expect(store.pointerRequests).toHaveLength(1);
        expect(
            store.events.filter(event => event.startsWith('read-pointer:'))
        ).toHaveLength(3);
        expect(store.events.at(-1)).toContain('cas:');
    });

    it('allows production no-activate without confirmation but requires exact confirmation for mutation', async () => {
        const noActivatePaths = await fixture('production');
        await expect(
            publishRelease(
                options(noActivatePaths, noActivatePaths.local, {
                    target: PRODUCTION_TARGET,
                    noActivate: true,
                })
            )
        ).resolves.toMatchObject({ status: 'success' });

        const missingPaths = await fixture('production');
        const missingStore = new RecordingStore(missingPaths.local);
        await expect(
            publishRelease(
                options(missingPaths, missingStore, {
                    target: PRODUCTION_TARGET,
                })
            )
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'activation-target',
        });
        expect(missingStore.pointerRequests).toEqual([]);

        const confirmedPaths = await fixture('production');
        await expect(
            publishRelease(
                options(confirmedPaths, confirmedPaths.local, {
                    target: PRODUCTION_TARGET,
                    confirmProduction: STORY_ID,
                })
            )
        ).resolves.toMatchObject({ status: 'success' });
    });

    it('rejects a preview-channel plan targeting production before immutable writes', async () => {
        const paths = await fixture('preview');
        const store = new RecordingStore(paths.local);

        await expect(
            publishRelease(
                options(paths, store, {
                    target: PRODUCTION_TARGET,
                    releasePlanPath: paths.planPath,
                    noActivate: true,
                })
            )
        ).rejects.toBeInstanceOf(PublisherError);
        expect(store.immutableRequests).toEqual([]);
        expect(store.pointerRequests).toEqual([]);
        expect(await snapshotFiles(paths.destinationRoot)).toEqual({});
    });
});

describe('read-only plan and verify no-write contract', () => {
    it('buildPublicationPlan performs no destination writes against an absent destination', async () => {
        const paths = await fixture();
        // Remove the destination root so plan inspects a nonexistent store.
        await rm(paths.destinationRoot, { recursive: true, force: true });

        const plan = await buildPublicationPlan(options(paths));

        // Every candidate must be created (nothing reused) and no advisory
        // pointer exists, since the destination is absent.
        expect(plan.advisoryPointer.exists).toBe(false);
        expect(plan.objects.every(object => object.status === 'create')).toBe(
            true
        );

        // The read-only plan must not have recreated the destination root or
        // created any vn/, .publisher-metadata, .publisher-transactions, or
        // lock files.
        await expect(readdir(paths.destinationRoot)).rejects.toMatchObject({
            code: 'ENOENT',
        });
    });

    it('verifyStoredRelease performs no destination writes against a read-only existing destination', async () => {
        const paths = await fixture();
        const report = await publishRelease(options(paths));
        if (
            report.releaseId === undefined ||
            report.manifestSha256 === undefined
        ) {
            throw new Error('publication did not produce a release');
        }

        const before = await snapshotFiles(paths.destinationRoot);
        // Make the entire destination tree read-only. Any write attempt
        // (mkdir, lock file, transaction recovery) anywhere under the root
        // would now fail with EACCES; a side-effect-free verify must still
        // succeed.
        await chmodTree(paths.destinationRoot, 0o555, 0o444);
        try {
            const verified = await verifyStoredRelease({
                store: paths.local,
                storyId: STORY_ID,
                target: PREVIEW_TARGET,
                releaseId: report.releaseId,
                depth: 'deep',
            });
            expect(verified.releaseId).toBe(report.releaseId);

            const after = await snapshotFiles(paths.destinationRoot);
            // No lock files, transaction markers, or any other writes.
            expect(after).toEqual(before);
        } finally {
            await chmodTree(paths.destinationRoot, 0o755, 0o644);
        }
    });
});
