import {
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
    type GetObjectCommandOutput,
    type HeadObjectCommandOutput,
    type ListObjectsV2CommandOutput,
    type PutObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { loadR2DeliveryConfig } from '../../config';
import { PublisherError } from '../errors';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from './delivery-store';

type R2Command =
    | GetObjectCommand
    | HeadObjectCommand
    | ListObjectsV2Command
    | PutObjectCommand;

export interface R2DeliveryClient {
    send(command: R2Command): Promise<unknown>;
    destroy(): void;
}

export interface R2DeliveryStoreOptions {
    bucket: string;
    client: R2DeliveryClient;
}

type R2ObjectMetadata = Pick<
    HeadObjectCommandOutput | GetObjectCommandOutput,
    'ETag' | 'ContentLength' | 'ContentType' | 'CacheControl' | 'Metadata'
>;

function isServiceErrorWithStatus(error: unknown, status: number): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const metadata = (error as { $metadata?: unknown }).$metadata;
    return (
        typeof metadata === 'object' &&
        metadata !== null &&
        (metadata as { httpStatusCode?: unknown }).httpStatusCode === status
    );
}

function isNamedServiceError(error: unknown, name: string): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: unknown }).name === name
    );
}

function isPreconditionFailure(error: unknown): boolean {
    return (
        isServiceErrorWithStatus(error, 412) ||
        isNamedServiceError(error, 'PreconditionFailed')
    );
}

function isNotFound(error: unknown): boolean {
    return (
        isServiceErrorWithStatus(error, 404) ||
        isNamedServiceError(error, 'NoSuchKey') ||
        isNamedServiceError(error, 'NotFound')
    );
}

function createSdkClient(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string
): R2DeliveryClient {
    const client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
    return {
        send(command) {
            if (command instanceof GetObjectCommand) {
                return client.send(command);
            }
            if (command instanceof HeadObjectCommand) {
                return client.send(command);
            }
            if (command instanceof ListObjectsV2Command) {
                return client.send(command);
            }
            return client.send(command);
        },
        destroy() {
            client.destroy();
        },
    };
}

export class R2DeliveryStore implements DeliveryStore {
    private readonly bucket: string;
    private readonly client: R2DeliveryClient;

    constructor(options: R2DeliveryStoreOptions) {
        this.bucket = options.bucket;
        this.client = options.client;
    }

    static async createFromEnvironment(): Promise<R2DeliveryStore> {
        const config = await loadR2DeliveryConfig();
        const accessKeyId = process.env.R2_PUBLISHER_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_PUBLISHER_SECRET_ACCESS_KEY;
        if (!accessKeyId || !secretAccessKey) {
            throw new PublisherError(
                'configuration',
                'R2_PUBLISHER_ACCESS_KEY_ID and R2_PUBLISHER_SECRET_ACCESS_KEY must be set'
            );
        }

        return new R2DeliveryStore({
            bucket: config.buckets.delivery,
            client: createSdkClient(
                config.accountId,
                accessKeyId,
                secretAccessKey
            ),
        });
    }

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        try {
            const output = (await this.client.send(
                new HeadObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                })
            )) as HeadObjectCommandOutput;
            return this.normalizeMetadata(key, output);
        } catch (error) {
            if (isNotFound(error)) return null;
            if (error instanceof PublisherError) throw error;
            throw this.storageError('Unable to inspect R2 object', key, error);
        }
    }

    async read(key: string): Promise<StoredObject> {
        const object = await this.readIfPresent(key);
        if (object !== null) return object;
        throw new PublisherError('storage', 'R2 object does not exist', {
            context: { key },
        });
    }

    async createImmutable(
        request: ImmutableCreateRequest
    ): Promise<{ status: 'created' | 'already-exists' }> {
        try {
            await this.client.send(
                new PutObjectCommand({
                    Bucket: this.bucket,
                    Key: request.key,
                    Body: request.bytes,
                    ContentType: request.contentType,
                    CacheControl: request.cacheControl,
                    Metadata: request.customMetadata,
                    IfNoneMatch: '*',
                })
            );
            return { status: 'created' };
        } catch (error) {
            if (isPreconditionFailure(error)) {
                return { status: 'already-exists' };
            }
            throw this.storageError(
                'Unable to create immutable R2 object',
                request.key,
                error
            );
        }
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        const object = await this.readIfPresent(key);
        if (object === null) return { exists: false };
        return {
            exists: true,
            etag: object.etag,
            bytes: object.bytes,
            contentType: object.contentType,
            cacheControl: object.cacheControl,
        };
    }

    async compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }> {
        try {
            const output = (await this.client.send(
                new PutObjectCommand({
                    Bucket: this.bucket,
                    Key: request.key,
                    Body: request.bytes,
                    ContentType: request.contentType,
                    CacheControl: request.cacheControl,
                    Metadata: request.customMetadata,
                    ...(request.expected.exists
                        ? { IfMatch: request.expected.etag }
                        : { IfNoneMatch: '*' }),
                })
            )) as PutObjectCommandOutput;
            return {
                status: 'written',
                ...(output.ETag === undefined ? {} : { etag: output.ETag }),
            };
        } catch (error) {
            if (isPreconditionFailure(error)) {
                return { status: 'precondition-failed' };
            }
            throw this.storageError(
                'Unable to compare and swap R2 pointer',
                request.key,
                error
            );
        }
    }

    async *list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        let continuationToken: string | undefined;
        do {
            let output: ListObjectsV2CommandOutput;
            try {
                output = (await this.client.send(
                    new ListObjectsV2Command({
                        Bucket: this.bucket,
                        Prefix: prefix,
                        ContinuationToken: continuationToken,
                    })
                )) as ListObjectsV2CommandOutput;
            } catch (error) {
                throw this.storageError(
                    'Unable to list R2 objects',
                    prefix,
                    error
                );
            }

            for (const listed of output.Contents ?? []) {
                if (listed.Key === undefined) {
                    throw new PublisherError(
                        'integrity',
                        'R2 list response contains an object without a key',
                        { context: { prefix } }
                    );
                }
                const metadata = await this.stat(listed.Key);
                if (metadata !== null) yield metadata;
            }

            if (output.IsTruncated !== true) return;
            if (output.NextContinuationToken === undefined) {
                throw new PublisherError(
                    'integrity',
                    'Truncated R2 list response has no continuation token',
                    { context: { prefix } }
                );
            }
            continuationToken = output.NextContinuationToken;
        } while (true);
    }

    async close(): Promise<void> {
        this.client.destroy();
    }

    private async readIfPresent(key: string): Promise<StoredObject | null> {
        try {
            const output = (await this.client.send(
                new GetObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                })
            )) as GetObjectCommandOutput;
            if (output.Body === undefined) {
                throw new PublisherError(
                    'integrity',
                    'R2 object response has no body',
                    { context: { key } }
                );
            }
            const bytes = await output.Body.transformToByteArray();
            return {
                ...this.normalizeMetadata(key, output),
                bytes,
            };
        } catch (error) {
            if (isNotFound(error)) return null;
            if (error instanceof PublisherError) throw error;
            throw this.storageError('Unable to read R2 object', key, error);
        }
    }

    private normalizeMetadata(
        key: string,
        output: R2ObjectMetadata
    ): StoredObjectMetadata {
        if (
            output.ETag === undefined ||
            output.ContentLength === undefined ||
            !Number.isSafeInteger(output.ContentLength) ||
            output.ContentLength < 0 ||
            output.ContentType === undefined ||
            output.CacheControl === undefined
        ) {
            throw new PublisherError(
                'integrity',
                'R2 object response has incomplete metadata',
                { context: { key } }
            );
        }
        return {
            key,
            etag: output.ETag,
            byteLength: output.ContentLength,
            contentType: output.ContentType,
            cacheControl: output.CacheControl,
            customMetadata: { ...(output.Metadata ?? {}) },
        };
    }

    private storageError(
        message: string,
        key: string,
        cause: unknown
    ): PublisherError {
        return new PublisherError('storage', message, {
            cause,
            context: { key },
        });
    }
}
