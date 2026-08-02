import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { R2DeliveryStore } from '../stores/r2-delivery-store';

type R2Command =
    | GetObjectCommand
    | HeadObjectCommand
    | ListObjectsV2Command
    | PutObjectCommand;

function fakeStore(
    send: (command: R2Command) => Promise<unknown>,
    destroy: () => void = () => undefined
): R2DeliveryStore {
    return new R2DeliveryStore({
        bucket: 'delivery',
        client: { send, destroy },
    });
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('R2DeliveryStore', () => {
    it('lists raw keys without hydrating metadata for rejected lookalikes', async () => {
        const validKey =
            'vn/stories/example/releases/sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/runtime-manifest.json';
        const lookalikeKey = `${validKey}.metadata`;
        const sent: R2Command[] = [];
        const store = fakeStore(async command => {
            sent.push(command);
            if (command instanceof ListObjectsV2Command) {
                return {
                    IsTruncated: false,
                    Contents: [{ Key: validKey }, { Key: lookalikeKey }],
                };
            }
            throw new Error('raw key enumeration must not hydrate metadata');
        });

        const keys = [];
        for await (const key of store.listKeys(
            'vn/stories/example/releases/'
        )) {
            keys.push(key);
        }

        expect(keys).toEqual([validKey, lookalikeKey]);
        expect(sent).toHaveLength(1);
        expect(sent[0]).toBeInstanceOf(ListObjectsV2Command);
    });

    it('uses typed IfNoneMatch for immutable creation', async () => {
        const sent: R2Command[] = [];
        const store = fakeStore(async command => {
            sent.push(command);
            return { ETag: '"opaque-etag"' };
        });

        await expect(
            store.createImmutable({
                key: 'vn/objects/hash.webp',
                bytes: new Uint8Array([1]),
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000, immutable',
                customMetadata: { sha256: 'hash' },
            })
        ).resolves.toEqual({ status: 'created' });

        expect(sent[0]).toBeInstanceOf(PutObjectCommand);
        const input = (sent[0] as PutObjectCommand).input;
        expect(input).toMatchObject({
            Bucket: 'delivery',
            Key: 'vn/objects/hash.webp',
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
            Metadata: { sha256: 'hash' },
            IfNoneMatch: '*',
        });
        expect(input.IfMatch).toBeUndefined();
    });

    it('round-trips the exact opaque ETag through IfMatch', async () => {
        const sent: PutObjectCommand[] = [];
        const store = fakeStore(async command => {
            if (!(command instanceof PutObjectCommand)) {
                throw new Error('unexpected command');
            }
            sent.push(command);
            return { ETag: 'W/"next-opaque-value"' };
        });

        await expect(
            store.compareAndSwapPointer({
                key: 'vn/stories/example/current.json',
                expected: { exists: true, etag: 'W/"opaque-value"' },
                bytes: new Uint8Array([1]),
                contentType: 'application/json',
                cacheControl: 'no-cache, max-age=0, must-revalidate',
                customMetadata: { generation: '2' },
            })
        ).resolves.toEqual({
            status: 'written',
            etag: 'W/"next-opaque-value"',
        });

        expect(sent[0].input.IfMatch).toBe('W/"opaque-value"');
        expect(sent[0].input.IfNoneMatch).toBeUndefined();
        expect(sent[0].input.Metadata).toEqual({ generation: '2' });
    });

    it('uses IfNoneMatch when the pointer was absent', async () => {
        const sent: PutObjectCommand[] = [];
        const store = fakeStore(async command => {
            if (!(command instanceof PutObjectCommand)) {
                throw new Error('unexpected command');
            }
            sent.push(command);
            return { ETag: '"created-pointer"' };
        });

        await store.compareAndSwapPointer({
            key: 'vn/stories/example/current.json',
            expected: { exists: false },
            bytes: new Uint8Array([1]),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        });

        expect(sent[0].input.IfNoneMatch).toBe('*');
        expect(sent[0].input.IfMatch).toBeUndefined();
    });

    it.each([
        'vn/objects/hash.webp',
        'vn/stories/example/releases/sha256-release/runtime-manifest.json',
    ])('rejects non-pointer CAS key %s before sending a put', async key => {
        const send = vi.fn(async () => ({ ETag: '"overwritten"' }));
        const store = fakeStore(send);

        await expect(
            store.compareAndSwapPointer({
                key,
                expected: { exists: true, etag: '"existing"' },
                bytes: new Uint8Array([1]),
                contentType: 'application/json',
                cacheControl: 'no-cache, max-age=0, must-revalidate',
            })
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'input',
        });
        expect(send).not.toHaveBeenCalled();
    });

    it('maps only immutable and pointer precondition failures to result statuses', async () => {
        const httpPreconditionStore = fakeStore(async () => {
            throw Object.assign(new Error('conditional request failed'), {
                name: 'UnknownR2Error',
                $metadata: { httpStatusCode: 412 },
            });
        });
        const namedPreconditionStore = fakeStore(async () => {
            throw Object.assign(new Error('conditional request failed'), {
                name: 'PreconditionFailed',
                $metadata: { httpStatusCode: 400 },
            });
        });
        const immutableRequest = {
            key: 'vn/objects/hash.webp',
            bytes: new Uint8Array([1]),
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
        };
        const pointerRequest = {
            key: 'vn/stories/example/current.json',
            expected: { exists: false as const },
            bytes: new Uint8Array([1]),
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
        };

        await expect(
            httpPreconditionStore.createImmutable(immutableRequest)
        ).resolves.toEqual({ status: 'already-exists' });
        await expect(
            namedPreconditionStore.compareAndSwapPointer(pointerRequest)
        ).resolves.toEqual({ status: 'precondition-failed' });

        const deniedStore = fakeStore(async () => {
            throw Object.assign(new Error('denied'), {
                name: 'AccessDenied',
                $metadata: { httpStatusCode: 403 },
            });
        });
        await expect(
            deniedStore.compareAndSwapPointer(pointerRequest)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'storage',
        });
    });

    it('replaces raw transport failures with a safe classification', async () => {
        const rawError = Object.assign(new Error('secret transport message'), {
            name: 'CredentialBearingNetworkError',
            request: {
                headers: { authorization: 'Bearer private-token' },
            },
            credentials: {
                accessKeyId: 'private-access-key',
                secretAccessKey: 'private-secret-key',
            },
            endpoint: 'https://private-account.r2.example.invalid',
            absolutePath: '/Users/private/source/image.webp',
            $metadata: { httpStatusCode: 500 },
        });
        const store = fakeStore(async () => {
            throw rawError;
        });

        let caught: unknown;
        try {
            await store.stat('vn/objects/hash.webp');
        } catch (error) {
            caught = error;
        }

        expect(caught).toMatchObject({
            name: 'PublisherError',
            code: 'storage',
            message: 'Unable to inspect R2 object',
            context: { key: 'vn/objects/hash.webp' },
            cause: { classification: 'r2-transport-failure' },
        });
        expect((caught as Error & { cause?: unknown }).cause).toEqual({
            classification: 'r2-transport-failure',
        });
        const exposed = JSON.stringify({
            message: (caught as Error).message,
            context: (caught as { context: unknown }).context,
            cause: (caught as Error & { cause?: unknown }).cause,
        });
        for (const secret of [
            'secret transport message',
            'CredentialBearingNetworkError',
            'private-token',
            'private-access-key',
            'private-secret-key',
            'private-account',
            '/Users/private/source/image.webp',
        ]) {
            expect(exposed).not.toContain(secret);
        }
    });

    it.each([
        ['', 'publisher-secret'],
        ['publisher-access', ''],
    ])(
        'rejects missing scoped credentials without a local fallback',
        async (accessKeyId, secretAccessKey) => {
            vi.stubEnv('R2_PUBLISHER_ACCESS_KEY_ID', accessKeyId);
            vi.stubEnv('R2_PUBLISHER_SECRET_ACCESS_KEY', secretAccessKey);

            await expect(
                R2DeliveryStore.createFromEnvironment()
            ).rejects.toMatchObject({
                name: 'PublisherError',
                code: 'configuration',
            });
        }
    );

    it('normalizes only exact metadata and fully consumes read bodies', async () => {
        const bytes = new Uint8Array([4, 5, 6]);
        const transformToByteArray = vi.fn(async () => bytes);
        const store = fakeStore(async command => {
            if (command instanceof HeadObjectCommand) {
                return {
                    ETag: 'W/"head-etag"',
                    ContentLength: 3,
                    ContentType: 'image/webp',
                    CacheControl: 'public, max-age=31536000, immutable',
                    Metadata: { sha256: 'abc', encoder: 'sharp' },
                    LastModified: new Date('2026-08-01T00:00:00Z'),
                };
            }
            if (command instanceof GetObjectCommand) {
                return {
                    ETag: '"read-etag"',
                    ContentLength: 3,
                    ContentType: 'application/json',
                    CacheControl: 'no-cache, max-age=0, must-revalidate',
                    Metadata: { generation: '2' },
                    Body: { transformToByteArray },
                };
            }
            throw new Error('unexpected command');
        });

        await expect(store.stat('vn/objects/hash.webp')).resolves.toEqual({
            key: 'vn/objects/hash.webp',
            etag: 'W/"head-etag"',
            byteLength: 3,
            contentType: 'image/webp',
            cacheControl: 'public, max-age=31536000, immutable',
            customMetadata: { sha256: 'abc', encoder: 'sharp' },
        });
        await expect(store.read('vn/pointer.json')).resolves.toEqual({
            key: 'vn/pointer.json',
            etag: '"read-etag"',
            byteLength: 3,
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0, must-revalidate',
            customMetadata: { generation: '2' },
            bytes,
        });
        expect(transformToByteArray).toHaveBeenCalledOnce();
    });

    it('returns an absent pointer for a missing R2 object', async () => {
        const store = fakeStore(async command => {
            expect(command).toBeInstanceOf(GetObjectCommand);
            throw Object.assign(new Error('missing'), {
                name: 'NoSuchKey',
                $metadata: { httpStatusCode: 404 },
            });
        });

        await expect(
            store.readPointer('vn/stories/example/current.json')
        ).resolves.toEqual({ exists: false });
    });

    it('consumes every list page and heads each returned object', async () => {
        const continuationTokens: Array<string | undefined> = [];
        const store = fakeStore(async command => {
            if (command instanceof ListObjectsV2Command) {
                continuationTokens.push(command.input.ContinuationToken);
                if (command.input.ContinuationToken === undefined) {
                    return {
                        IsTruncated: true,
                        NextContinuationToken: 'next-page',
                        Contents: [
                            {
                                Key: 'vn/releases/a.json',
                                ETag: '"list-a"',
                                Size: 100,
                            },
                        ],
                    };
                }
                return {
                    IsTruncated: false,
                    Contents: [
                        {
                            Key: 'vn/releases/b.json',
                            ETag: '"list-b"',
                            Size: 200,
                        },
                    ],
                };
            }
            if (command instanceof HeadObjectCommand) {
                const suffix = command.input.Key?.endsWith('a.json')
                    ? 'a'
                    : 'b';
                return {
                    ETag: `W/"head-${suffix}"`,
                    ContentLength: suffix === 'a' ? 11 : 22,
                    ContentType: 'application/json',
                    CacheControl: 'public, max-age=31536000, immutable',
                    Metadata: { page: suffix },
                };
            }
            throw new Error('unexpected command');
        });

        const listed = [];
        for await (const metadata of store.list('vn/releases/')) {
            listed.push(metadata);
        }

        expect(continuationTokens).toEqual([undefined, 'next-page']);
        expect(listed).toEqual([
            {
                key: 'vn/releases/a.json',
                etag: 'W/"head-a"',
                byteLength: 11,
                contentType: 'application/json',
                cacheControl: 'public, max-age=31536000, immutable',
                customMetadata: { page: 'a' },
            },
            {
                key: 'vn/releases/b.json',
                etag: 'W/"head-b"',
                byteLength: 22,
                contentType: 'application/json',
                cacheControl: 'public, max-age=31536000, immutable',
                customMetadata: { page: 'b' },
            },
        ]);
    });

    it('rejects an empty truncated-page continuation token without another send', async () => {
        const send = vi.fn(async command => {
            expect(command).toBeInstanceOf(ListObjectsV2Command);
            if (send.mock.calls.length > 1) {
                throw new Error('pagination did not stop at the empty token');
            }
            return {
                IsTruncated: true,
                NextContinuationToken: '',
                Contents: [],
            };
        });
        const store = fakeStore(send);
        const iterator = store.list('vn/releases/')[Symbol.asyncIterator]();

        await expect(iterator.next()).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('rejects a repeated continuation token without a third send', async () => {
        const send = vi.fn(async command => {
            expect(command).toBeInstanceOf(ListObjectsV2Command);
            if (send.mock.calls.length > 2) {
                throw new Error('pagination repeated indefinitely');
            }
            return {
                IsTruncated: true,
                NextContinuationToken: 'same-page',
                Contents: [],
            };
        });
        const store = fakeStore(send);
        const iterator = store.list('vn/releases/')[Symbol.asyncIterator]();

        await expect(iterator.next()).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('destroys the R2 client when closed', async () => {
        const destroy = vi.fn();
        const store = fakeStore(async () => ({}), destroy);

        await store.close();

        expect(destroy).toHaveBeenCalledOnce();
    });
});
