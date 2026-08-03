import { createHash } from 'node:crypto';
import {
    access,
    chmod,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    unlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalDeliveryStore } from '../stores/local-delivery-store';

async function snapshotTree(
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
            Object.assign(result, await snapshotTree(root, path));
        } else {
            result[path] = Buffer.from(
                await readFile(join(root, path))
            ).toString('base64');
        }
    }
    return result;
}

async function chmodTree(
    root: string,
    dirMode: number,
    fileMode: number,
    relative = ''
): Promise<void> {
    const entries = await readdir(join(root, relative), {
        withFileTypes: true,
    });
    for (const entry of entries) {
        const path = join(relative, entry.name);
        if (entry.isDirectory()) {
            await chmodTree(root, dirMode, fileMode, path);
        } else {
            await chmod(join(root, path), fileMode);
        }
    }
    await chmod(join(root, relative), dirMode);
}

const POINTER_KEY = 'vn/stories/example/current.json';

function sha256(value: string | Uint8Array): string {
    return createHash('sha256').update(value).digest('hex');
}

function sidecarPath(root: string, key: string): string {
    return join(root, '.publisher-metadata', `${sha256(key)}.json`);
}

function pointerRequest(key: string, text: string) {
    return {
        key,
        bytes: new TextEncoder().encode(text),
        contentType: 'application/json',
        cacheControl: 'no-cache, max-age=0, must-revalidate',
    };
}

describe('LocalDeliveryStore', () => {
    it('creates immutable bytes once and rejects a conflicting second body', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-store-'))
        );
        const first = await store.createImmutable({
            key: 'vn/objects/abc.webp',
            bytes: new TextEncoder().encode('first'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });
        const second = await store.createImmutable({
            key: 'vn/objects/abc.webp',
            bytes: new TextEncoder().encode('second'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });

        expect(first.status).toBe('created');
        expect(second.status).toBe('already-exists');
        await expect(store.read('vn/objects/abc.webp')).resolves.toMatchObject({
            contentType: 'image/webp',
        });
    });

    it('recovers an orphan immutable body without metadata by overwriting it', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-partial-'));
        const bodyPath = join(root, 'vn/objects/partial.webp');
        await mkdir(join(root, 'vn/objects'), { recursive: true });
        await writeFile(bodyPath, 'partial');
        const store = new LocalDeliveryStore(root);

        // A direct read still sees an orphan body without metadata as an
        // integrity failure — read() runs transaction recovery, but an
        // orphan body with no transaction marker has nothing to recover.
        await expect(
            store.read('vn/objects/partial.webp')
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });

        // createImmutable acquires the per-key lock, runs transaction
        // recovery, and overwrites the orphan body via the temp-file +
        // rename path. The previously unrecoverable object is now replaced
        // with valid content and metadata.
        const result = await store.createImmutable({
            key: 'vn/objects/partial.webp',
            bytes: new TextEncoder().encode('replacement'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });
        expect(result).toEqual({ status: 'created' });
        await expect(readFile(bodyPath, 'utf8')).resolves.toBe('replacement');
        await expect(
            store.read('vn/objects/partial.webp')
        ).resolves.toMatchObject({ contentType: 'image/webp' });
    });

    it('recovers an immutable transaction interrupted between marker write and completion', async () => {
        // Simulate a crash: a previous createImmutable wrote the body and
        // metadata temp files plus the transaction marker, but never ran
        // completePointerTransaction. A retry must recover the pending
        // transaction under the per-key lock and expose the object as
        // already-exists (with valid, readable content).
        const root = await mkdtemp(join(tmpdir(), 'local-immutable-recovery-'));
        const store = new LocalDeliveryStore(root);
        const key = 'vn/objects/recovered.webp';
        const bodyPath = join(root, key);
        const metadataPath = sidecarPath(root, key);
        const bodyTemporaryPath = `${bodyPath}.crashed.tmp`;
        const metadataTemporaryPath = `${metadataPath}.crashed.tmp`;
        const transactionDirectory = join(root, '.publisher-transactions');
        const transactionPath = join(
            transactionDirectory,
            `${sha256(key)}.json`
        );
        const bytes = new TextEncoder().encode('crashed-body');
        await mkdir(join(root, 'vn/objects'), { recursive: true });
        await mkdir(join(root, '.publisher-metadata'), { recursive: true });
        await mkdir(transactionDirectory, { recursive: true });
        await writeFile(bodyTemporaryPath, bytes);
        await writeFile(
            metadataTemporaryPath,
            `${JSON.stringify({
                version: 1,
                key,
                etag: `local-sha256-${sha256(bytes)}`,
                byteLength: bytes.byteLength,
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
                customMetadata: {},
            })}\n`
        );
        await writeFile(
            transactionPath,
            `${JSON.stringify({
                version: 1,
                key,
                bodyTemporaryName: basename(bodyTemporaryPath),
                metadataTemporaryName: basename(metadataTemporaryPath),
            })}\n`
        );

        const result = await store.createImmutable({
            key,
            bytes: new TextEncoder().encode('different-content'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });
        expect(result).toEqual({ status: 'already-exists' });
        await expect(store.read(key)).resolves.toMatchObject({
            contentType: 'image/webp',
        });
        await expect(readFile(bodyPath, 'utf8')).resolves.toBe('crashed-body');
    });

    it('does not expose a torn immutable object to concurrent stat() between body and metadata renames', async () => {
        // Writer A pauses after renaming the body into place but before
        // renaming the metadata. A second store instance B calling stat()
        // or read() during that window must wait for the pending
        // transaction marker to clear (the writer completes) and observe
        // the completed object — not throw "body exists without valid
        // metadata" and not acquire the create lock or write anything.
        const root = await mkdtemp(join(tmpdir(), 'local-immutable-torn-'));
        let resumeWriter: () => void = () => {};
        const writerGate = new Promise<void>(resolve => {
            resumeWriter = resolve;
        });
        let hookReachedResolve!: () => void;
        const hookReached = new Promise<void>(resolve => {
            hookReachedResolve = resolve;
        });

        const writer = new LocalDeliveryStore(root, {
            afterTransactionBodyRename: async () => {
                hookReachedResolve();
                await writerGate;
            },
        });
        const key = 'vn/objects/raced.webp';
        const bytes = new TextEncoder().encode('raced-body');
        const createPromise = writer.createImmutable({
            key,
            bytes,
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });

        // Wait for the writer to rename the body and reach the hook.
        await hookReached;

        // A second store inspects the object while the writer is paused
        // between the body and metadata renames. stat() and read() must
        // wait for the transaction marker to clear and not observe the
        // torn state, without writing to the destination.
        const reader = new LocalDeliveryStore(root);
        const statPromise = reader.stat(key);
        const readPromise = reader.read(key);

        // Let the writer complete the metadata rename.
        resumeWriter();
        const [createResult, statResult, readResult] = await Promise.all([
            createPromise,
            statPromise,
            readPromise,
        ]);

        expect(createResult).toEqual({ status: 'created' });
        expect(statResult).toMatchObject({
            key,
            contentType: 'image/webp',
            byteLength: bytes.byteLength,
        });
        expect(readResult).toMatchObject({
            key,
            contentType: 'image/webp',
            byteLength: bytes.byteLength,
        });
        expect(new TextDecoder().decode(readResult.bytes)).toBe('raced-body');

        // The read-only stat()/read() path must not have left any create-lock
        // artifacts behind in the destination.
        const objectDir = join(root, 'vn/objects');
        const dirEntries = await readdir(objectDir);
        expect(dirEntries).toEqual(['raced.webp']);
    });

    it('stat() and read() against an absent destination create no directories or lock files', async () => {
        const parent = await mkdtemp(join(tmpdir(), 'local-absent-'));
        const root = join(parent, 'destination');
        const store = new LocalDeliveryStore(root);

        // stat() returns null without creating any destination structure.
        await expect(store.stat('vn/objects/absent.webp')).resolves.toBeNull();
        // read() surfaces a not-found storage error without writing.
        await expect(
            store.read('vn/objects/absent.webp')
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'storage',
        });

        // No destination structure was created: no vn/, no .publisher-*
        // directories, and no lock files. The destination root itself must
        // not even exist.
        await expect(access(root)).rejects.toMatchObject({ code: 'ENOENT' });
        await expect(readdir(parent)).resolves.toEqual([]);
    });

    it('stat() and read() against a read-only existing destination do not write', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-readonly-'));
        const store = new LocalDeliveryStore(root);
        const key = 'vn/objects/locked.webp';
        await store.createImmutable({
            key,
            bytes: new TextEncoder().encode('locked-body'),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        });
        // Snapshot the destination tree, then make it read-only. Any write
        // attempt (mkdir, lock file, recovery) would now fail with EACCES.
        const before = await snapshotTree(root);
        await chmodTree(root, 0o555, 0o444);
        try {
            const readonlyStore = new LocalDeliveryStore(root);
            await expect(readonlyStore.stat(key)).resolves.toMatchObject({
                key,
                contentType: 'image/webp',
            });
            await expect(readonlyStore.read(key)).resolves.toMatchObject({
                key,
                contentType: 'image/webp',
            });
            // A read-only stat() for a missing key still returns null without
            // writing.
            await expect(
                readonlyStore.stat('vn/objects/missing.webp')
            ).resolves.toBeNull();

            const after = await snapshotTree(root);
            expect(after).toEqual(before);
        } finally {
            await chmodTree(root, 0o755, 0o644);
        }
    });

    it('performs pointer CAS under a lock', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-pointer-'))
        );
        const first = await store.compareAndSwapPointer({
            key: 'vn/stories/example/current.json',
            expected: { exists: false },
            bytes: new TextEncoder().encode('A'),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        });
        const stale = await store.compareAndSwapPointer({
            key: 'vn/stories/example/current.json',
            expected: { exists: false },
            bytes: new TextEncoder().encode('B'),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        });

        expect(first.status).toBe('written');
        expect(stale.status).toBe('precondition-failed');
    });

    it('never exposes a torn pointer snapshot to concurrent readers', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-pointer-race-'))
        );
        const first = await store.compareAndSwapPointer({
            ...pointerRequest(POINTER_KEY, JSON.stringify({ generation: 0 })),
            expected: { exists: false },
        });
        let expected = { exists: true as const, etag: first.etag! };
        let writerFinished = false;
        const readerErrors: unknown[] = [];

        const writer = (async () => {
            try {
                for (let generation = 1; generation <= 40; generation += 1) {
                    const result = await store.compareAndSwapPointer({
                        ...pointerRequest(
                            POINTER_KEY,
                            JSON.stringify({
                                generation,
                                padding: 'x'.repeat(256 * 1024),
                            })
                        ),
                        expected,
                    });
                    expect(result.status).toBe('written');
                    expected = { exists: true, etag: result.etag! };
                }
            } finally {
                writerFinished = true;
            }
        })();
        const reader = (async () => {
            while (!writerFinished) {
                try {
                    const snapshot = await store.readPointer(POINTER_KEY);
                    expect(snapshot.exists).toBe(true);
                    if (snapshot.exists) {
                        expect(() =>
                            JSON.parse(new TextDecoder().decode(snapshot.bytes))
                        ).not.toThrow();
                    }
                } catch (error) {
                    readerErrors.push(error);
                }
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        })();

        await Promise.all([writer, reader]);
        expect(readerErrors).toEqual([]);
    }, 20_000);

    it('recovers a pointer transaction interrupted between body and metadata renames', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-pointer-recovery-'));
        const store = new LocalDeliveryStore(root);
        await store.compareAndSwapPointer({
            ...pointerRequest(POINTER_KEY, 'A'),
            expected: { exists: false },
        });

        const newBytes = new TextEncoder().encode('B');
        const bodyPath = join(root, POINTER_KEY);
        const metadataPath = sidecarPath(root, POINTER_KEY);
        const bodyTemporaryPath = `${bodyPath}.interrupted.tmp`;
        const metadataTemporaryPath = `${metadataPath}.interrupted.tmp`;
        const transactionDirectory = join(root, '.publisher-transactions');
        const transactionPath = join(
            transactionDirectory,
            `${sha256(POINTER_KEY)}.json`
        );
        await mkdir(transactionDirectory, { recursive: true });
        await writeFile(bodyPath, newBytes);
        await writeFile(
            metadataTemporaryPath,
            `${JSON.stringify({
                version: 1,
                key: POINTER_KEY,
                etag: `local-sha256-${sha256(newBytes)}`,
                byteLength: newBytes.byteLength,
                contentType: 'application/json',
                cacheControl: 'no-cache, max-age=0, must-revalidate',
                customMetadata: {},
            })}\n`
        );
        await writeFile(
            transactionPath,
            `${JSON.stringify({
                version: 1,
                key: POINTER_KEY,
                bodyTemporaryName: basename(bodyTemporaryPath),
                metadataTemporaryName: basename(metadataTemporaryPath),
            })}\n`
        );

        const recovered = await store.readPointer(POINTER_KEY);
        expect(recovered.exists).toBe(true);
        if (recovered.exists) {
            expect(new TextDecoder().decode(recovered.bytes)).toBe('B');
        }
        await expect(access(transactionPath)).rejects.toMatchObject({
            code: 'ENOENT',
        });
    });

    it('rejects pointer CAS for immutable object keys', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-pointer-role-'))
        );

        await expect(
            store.compareAndSwapPointer({
                ...pointerRequest('vn/objects/abc.webp', 'replacement'),
                expected: { exists: false },
            })
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'input',
        });
    });

    it('recovers a lock owned by a terminated process', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-stale-lock-'));
        const token = '00000000-0000-4000-8000-000000000000';
        const lockPath = join(root, `${POINTER_KEY}.lock.claim.${token}.json`);
        await mkdir(join(root, 'vn/stories/example'), { recursive: true });
        await writeFile(
            lockPath,
            `${JSON.stringify({
                version: 2,
                pid: 2_147_483_647,
                token,
                state: 'waiting',
                ticket: 1,
            })}\n`
        );
        const store = new LocalDeliveryStore(root);

        await expect(
            store.compareAndSwapPointer({
                ...pointerRequest(POINTER_KEY, 'A'),
                expected: { exists: false },
            })
        ).resolves.toMatchObject({ status: 'written' });
        await expect(access(lockPath)).rejects.toMatchObject({
            code: 'ENOENT',
        });
    }, 7_000);

    it('cleans a choosing record when its post-link directory flush fails', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-lock-flush-failure-'));
        let failNextDirectoryFlush = true;
        const store = new LocalDeliveryStore(root, {
            afterDirectoryFlush: async () => {
                if (!failNextDirectoryFlush) return;
                failNextDirectoryFlush = false;
                throw new Error('injected post-link directory flush failure');
            },
        });

        await expect(
            store.compareAndSwapPointer({
                ...pointerRequest(POINTER_KEY, 'A'),
                expected: { exists: false },
            })
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'storage' });
        await expect(
            readdir(join(root, 'vn/stories/example'))
        ).resolves.not.toEqual(
            expect.arrayContaining([
                expect.stringContaining('current.json.lock.choosing.'),
            ])
        );
        await expect(
            store.compareAndSwapPointer({
                ...pointerRequest(POINTER_KEY, 'B'),
                expected: { exists: false },
            })
        ).resolves.toMatchObject({ status: 'written' });
    });

    it('does not let competing stale-lock reclaimers displace a new lock generation', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-lock-generation-'));
        const staleToken = '00000000-0000-4000-8000-000000000002';
        const liveToken = '00000000-0000-4000-8000-000000000003';
        const staleLockPath = join(
            root,
            `${POINTER_KEY}.lock.claim.${staleToken}.json`
        );
        const liveLockPath = join(
            root,
            `${POINTER_KEY}.lock.claim.${liveToken}.json`
        );
        const liveRecord = {
            version: 2,
            pid: process.pid,
            token: liveToken,
            state: 'waiting',
            ticket: 2,
        };
        await mkdir(join(root, 'vn/stories/example'), { recursive: true });
        await writeFile(
            staleLockPath,
            `${JSON.stringify({
                version: 2,
                pid: 2_147_483_647,
                token: staleToken,
                state: 'waiting',
                ticket: 1,
            })}\n`
        );
        await writeFile(liveLockPath, `${JSON.stringify(liveRecord)}\n`, {
            flag: 'wx',
        });
        const first = new LocalDeliveryStore(root);
        const second = new LocalDeliveryStore(root);
        let completed = 0;
        const writes = [
            first
                .compareAndSwapPointer({
                    ...pointerRequest(POINTER_KEY, 'A'),
                    expected: { exists: false },
                })
                .finally(() => {
                    completed += 1;
                }),
            second
                .compareAndSwapPointer({
                    ...pointerRequest(POINTER_KEY, 'B'),
                    expected: { exists: false },
                })
                .finally(() => {
                    completed += 1;
                }),
        ];

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(completed).toBe(0);
        await expect(readFile(liveLockPath, 'utf8')).resolves.toBe(
            `${JSON.stringify(liveRecord)}\n`
        );
        await expect(access(staleLockPath)).rejects.toMatchObject({
            code: 'ENOENT',
        });
        await unlink(liveLockPath);
        const outcomes = await Promise.all(writes);

        expect(outcomes.map(outcome => outcome.status).sort()).toEqual([
            'precondition-failed',
            'written',
        ]);
    });

    it('waits for a live lock instead of stealing it', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-live-lock-'));
        const token = '00000000-0000-4000-8000-000000000001';
        const lockPath = join(root, `${POINTER_KEY}.lock.claim.${token}.json`);
        await mkdir(join(root, 'vn/stories/example'), { recursive: true });
        await writeFile(
            lockPath,
            `${JSON.stringify({
                version: 2,
                pid: process.pid,
                token,
                state: 'waiting',
                ticket: 1,
            })}\n`
        );
        const store = new LocalDeliveryStore(root);
        let settled = false;
        const write = store
            .compareAndSwapPointer({
                ...pointerRequest(POINTER_KEY, 'A'),
                expected: { exists: false },
            })
            .finally(() => {
                settled = true;
            });

        await new Promise(resolve => setTimeout(resolve, 50));
        expect(settled).toBe(false);
        await unlink(lockPath);
        await expect(write).resolves.toMatchObject({ status: 'written' });
    });

    it.each([
        ['malformed JSON', '{'],
        ['invalid metadata shape', '{}'],
    ])(
        'does not expose absolute paths through %s context',
        async (_label, invalidMetadata) => {
            const root = await mkdtemp(
                join(tmpdir(), 'local-private-context-')
            );
            const store = new LocalDeliveryStore(root);
            await store.createImmutable({
                key: 'vn/objects/private.webp',
                bytes: new TextEncoder().encode('private'),
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
            });
            await writeFile(
                sidecarPath(root, 'vn/objects/private.webp'),
                invalidMetadata
            );

            try {
                await store.read('vn/objects/private.webp');
                expect.unreachable('invalid metadata should fail');
            } catch (error) {
                expect(error).toMatchObject({
                    name: 'PublisherError',
                    code: 'integrity',
                });
                expect(
                    JSON.stringify((error as { context: unknown }).context)
                ).not.toContain(root);
            }
        }
    );

    it('lists only objects under the exact requested prefix', async () => {
        const store = new LocalDeliveryStore(
            await mkdtemp(join(tmpdir(), 'local-list-'))
        );
        const immutableRequest = {
            bytes: new TextEncoder().encode('{}'),
            contentType: 'application/json',
            cacheControl: 'public, max-age=31536000, immutable',
        };
        await store.createImmutable({
            ...immutableRequest,
            key: 'vn/stories/example/releases/sha256-a/runtime-manifest.json',
        });
        await store.createImmutable({
            ...immutableRequest,
            key: 'vn/stories/example/releases/sha256-b/runtime-manifest.json',
        });
        await store.createImmutable({
            ...immutableRequest,
            key: 'vn/stories/example/current.json',
        });
        await store.createImmutable({
            ...immutableRequest,
            key: 'vn/stories/example-extended/releases/sha256-c/runtime-manifest.json',
        });

        const listed = [];
        for await (const object of store.list('vn/stories/example/releases/')) {
            listed.push(object.key);
        }

        expect(listed.sort()).toEqual([
            'vn/stories/example/releases/sha256-a/runtime-manifest.json',
            'vn/stories/example/releases/sha256-b/runtime-manifest.json',
        ]);
    });

    it('lists raw body keys without parsing a rejected lookalike sidecar', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-list-keys-'));
        const store = new LocalDeliveryStore(root);
        const prefix = 'vn/stories/example/releases/';
        const validKey = `${prefix}sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/runtime-manifest.json`;
        const lookalikeKey = `${validKey}.metadata`;
        const immutableRequest = {
            bytes: new TextEncoder().encode('{}'),
            contentType: 'application/json',
            cacheControl: 'public, max-age=31536000, immutable',
        };
        await store.createImmutable({ ...immutableRequest, key: validKey });
        await store.createImmutable({ ...immutableRequest, key: lookalikeKey });
        await writeFile(sidecarPath(root, lookalikeKey), '{}\n');

        const keys = [];
        for await (const key of store.listKeys(prefix)) keys.push(key);

        expect(keys.sort()).toEqual([lookalikeKey, validKey].sort());
    });
});
