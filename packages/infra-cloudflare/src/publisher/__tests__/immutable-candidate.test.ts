import { afterEach, describe, expect, it } from 'vitest';
import { PublisherError } from '../errors';
import {
    inspectImmutableCandidate,
    publishImmutableCandidate,
    type PlannedImmutableCandidate,
} from '../immutable-candidate';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    StoredObject,
    StoredObjectMetadata,
} from '../stores/delivery-store';

const cacheControl = 'private, max-age=31536000, immutable';

function candidate(
    overrides: Partial<Omit<PlannedImmutableCandidate, 'status'>> = {}
): Omit<PlannedImmutableCandidate, 'status'> {
    return {
        kind: 'source',
        key: 'audio/approved/example_story/sfx/ui-click/source/abc/source.wav',
        bytes: new Uint8Array([1, 2, 3]),
        contentType: 'audio/wav',
        cacheControl,
        ...overrides,
    };
}

function stored(
    input: Omit<PlannedImmutableCandidate, 'status'>
): StoredObject {
    return {
        key: input.key,
        etag: 'etag',
        byteLength: input.bytes.byteLength,
        contentType: input.contentType,
        cacheControl: input.cacheControl,
        customMetadata: {},
        bytes: input.bytes,
    };
}

class MemoryStore implements DeliveryStore {
    readonly objects = new Map<string, StoredObject>();
    readonly creates: ImmutableCreateRequest[] = [];
    readonly reads: string[] = [];
    raceCreate = false;
    readBack: StoredObject | undefined;

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        const object = this.objects.get(key);
        if (object === undefined) return null;
        return {
            key: object.key,
            etag: object.etag,
            byteLength: object.byteLength,
            contentType: object.contentType,
            cacheControl: object.cacheControl,
            customMetadata: object.customMetadata,
        };
    }

    async read(key: string): Promise<StoredObject> {
        this.reads.push(key);
        const object = this.readBack ?? this.objects.get(key);
        if (object === undefined) throw new Error(`missing ${key}`);
        return object;
    }

    async createImmutable(
        request: ImmutableCreateRequest
    ): Promise<{ status: 'created' | 'already-exists' }> {
        this.creates.push(request);
        if (this.raceCreate) {
            this.objects.set(request.key, {
                key: request.key,
                etag: 'race-etag',
                byteLength: request.bytes.byteLength,
                contentType: request.contentType,
                cacheControl: request.cacheControl,
                customMetadata: { ...(request.customMetadata ?? {}) },
                bytes: request.bytes,
            });
            return { status: 'already-exists' };
        }
        this.objects.set(request.key, {
            key: request.key,
            etag: 'created-etag',
            byteLength: request.bytes.byteLength,
            contentType: request.contentType,
            cacheControl: request.cacheControl,
            customMetadata: { ...(request.customMetadata ?? {}) },
            bytes: request.bytes,
        });
        return { status: 'created' };
    }

    async inspectPointer(): Promise<PointerSnapshot> {
        return { exists: false };
    }

    async readPointer(): Promise<PointerSnapshot> {
        return { exists: false };
    }

    async compareAndSwapPointer(): Promise<{
        status: 'written' | 'precondition-failed';
        etag?: string;
    }> {
        return { status: 'precondition-failed' };
    }

    async *listKeys(): AsyncIterable<string> {}

    async *list(): AsyncIterable<StoredObjectMetadata> {}

    async close(): Promise<void> {}
}

describe('immutable candidate operations', () => {
    let stores: MemoryStore[] = [];

    afterEach(() => {
        stores = [];
    });

    it('plans an absent source candidate for creation', async () => {
        const store = new MemoryStore();
        stores.push(store);

        await expect(
            inspectImmutableCandidate(store, candidate())
        ).resolves.toMatchObject({
            kind: 'source',
            status: 'create',
        });
    });

    it('reuses a candidate whose metadata and bytes match exactly', async () => {
        const store = new MemoryStore();
        const input = candidate();
        store.objects.set(input.key, stored(input));
        stores.push(store);

        await expect(inspectImmutableCandidate(store, input)).resolves.toEqual({
            ...input,
            status: 'reuse',
        });
        expect(store.reads).toEqual([input.key]);
    });

    it('rejects a candidate when existing metadata conflicts', async () => {
        const store = new MemoryStore();
        const input = candidate();
        store.objects.set(
            input.key,
            stored({ ...input, contentType: 'audio/mpeg' })
        );
        stores.push(store);

        await expect(
            inspectImmutableCandidate(store, input)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
        expect(store.reads).toEqual([]);
    });

    it('rejects a candidate when existing bytes conflict', async () => {
        const store = new MemoryStore();
        const input = candidate();
        store.objects.set(
            input.key,
            stored({ ...input, bytes: new Uint8Array([4, 5, 6]) })
        );
        stores.push(store);

        await expect(
            inspectImmutableCandidate(store, input)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
    });

    it('rejects a reused audio candidate with contaminated custom metadata', async () => {
        const store = new MemoryStore();
        const input = {
            ...candidate({ kind: 'object', key: 'vn/objects/audio.mp3' }),
            customMetadata: {},
        };
        store.objects.set(input.key, {
            ...stored(input),
            customMetadata: { candidateId: 'private-candidate' },
        });
        stores.push(store);

        await expect(
            inspectImmutableCandidate(store, input)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
    });

    it('does not reuse a candidate without customMetadata when the stored object has metadata', async () => {
        const store = new MemoryStore();
        const input = candidate();
        store.objects.set(input.key, {
            ...stored(input),
            customMetadata: { provenance: 'stray' },
        });
        stores.push(store);

        await expect(
            inspectImmutableCandidate(store, input)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
        expect(store.reads).toEqual([]);
    });

    it('creates or reuses after a create race and verifies exact read-back', async () => {
        const store = new MemoryStore();
        store.raceCreate = true;
        stores.push(store);
        const input = candidate();

        const planned = await inspectImmutableCandidate(store, input);
        await expect(publishImmutableCandidate(store, planned)).resolves.toBe(
            'reused'
        );
        expect(store.creates).toHaveLength(1);
        expect(store.reads).toEqual([input.key]);
    });

    it('rejects a create when exact read-back does not match', async () => {
        const store = new MemoryStore();
        store.readBack = stored({
            ...candidate(),
            bytes: new Uint8Array([7, 8, 9]),
        });
        stores.push(store);
        const input = candidate();

        await expect(
            publishImmutableCandidate(store, {
                ...input,
                status: 'create',
            })
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        } satisfies Partial<PublisherError>);
    });
});
