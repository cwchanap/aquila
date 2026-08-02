import { createHash } from 'node:crypto';
import {
    access,
    mkdir,
    mkdtemp,
    readFile,
    unlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalDeliveryStore } from '../stores/local-delivery-store';

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

    it('treats an immutable body without metadata as an integrity failure', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-partial-'));
        const bodyPath = join(root, 'vn/objects/partial.webp');
        await mkdir(join(root, 'vn/objects'), { recursive: true });
        await writeFile(bodyPath, 'partial');
        const store = new LocalDeliveryStore(root);

        await expect(
            store.read('vn/objects/partial.webp')
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'integrity' });
        await expect(
            store.createImmutable({
                key: 'vn/objects/partial.webp',
                bytes: new TextEncoder().encode('replacement'),
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
            })
        ).resolves.toEqual({ status: 'already-exists' });
        await expect(readFile(bodyPath, 'utf8')).resolves.toBe('partial');
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
        const lockPath = join(root, `${POINTER_KEY}.lock`);
        await mkdir(join(root, 'vn/stories/example'), { recursive: true });
        await writeFile(
            lockPath,
            `${JSON.stringify({
                version: 1,
                pid: 2_147_483_647,
                token: '00000000-0000-4000-8000-000000000000',
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

    it('waits for a live lock instead of stealing it', async () => {
        const root = await mkdtemp(join(tmpdir(), 'local-live-lock-'));
        const lockPath = join(root, `${POINTER_KEY}.lock`);
        await mkdir(join(root, 'vn/stories/example'), { recursive: true });
        await writeFile(
            lockPath,
            `${JSON.stringify({
                version: 1,
                pid: process.pid,
                token: '00000000-0000-4000-8000-000000000001',
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
});
