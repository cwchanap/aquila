import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalDeliveryStore } from '../stores/local-delivery-store';

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
