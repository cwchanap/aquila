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
import { isRuntimePointerKey } from '@aquila/stories/runtime-assets';
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

type DestroyableR2ResponseBody = {
    destroy?: (error?: Error) => void;
};

const SANITIZED_R2_TRANSPORT_CAUSE = Object.freeze({
    classification: 'r2-transport-failure' as const,
});
const SANITIZED_R2_CONFIG_CAUSE = Object.freeze({
    classification: 'r2-config-load-failure' as const,
});
const R2_CONNECTION_TIMEOUT_MS = 10_000;
const R2_REQUEST_TIMEOUT_MS = 60_000;
const R2_MAX_COMMAND_ATTEMPTS = 2;

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

async function sendWithDeadline<T>(
    client: S3Client,
    send: (abortSignal: AbortSignal) => Promise<T>
): Promise<T> {
    const controller = new AbortController();
    let timeout!: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
            controller.abort();
            client.destroy();
            reject(
                Object.assign(new Error('R2 command timed out'), {
                    name: 'TimeoutError',
                    code: 'ETIMEDOUT',
                })
            );
        }, R2_REQUEST_TIMEOUT_MS);
    });
    try {
        return await Promise.race([send(controller.signal), deadline]);
    } finally {
        clearTimeout(timeout);
    }
}

function isTimeoutError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const candidate = error as { name?: unknown; code?: unknown };
    return candidate.name === 'TimeoutError' || candidate.code === 'ETIMEDOUT';
}

function canRetry(command: R2Command): boolean {
    return !(
        command instanceof PutObjectCommand &&
        command.input.IfMatch !== undefined
    );
}

async function readBodyWithDeadline(
    body: NonNullable<GetObjectCommandOutput['Body']>
): Promise<Uint8Array> {
    const timeoutError = Object.assign(
        new Error('R2 response body timed out'),
        {
            name: 'TimeoutError',
            code: 'ETIMEDOUT',
        }
    );
    let timeout!: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
            (body as unknown as DestroyableR2ResponseBody).destroy?.(
                timeoutError
            );
            reject(timeoutError);
        }, R2_REQUEST_TIMEOUT_MS);
    });
    try {
        return await Promise.race([body.transformToByteArray(), deadline]);
    } finally {
        clearTimeout(timeout);
    }
}

function createSdkClient(
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string
): R2DeliveryClient {
    const options = {
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        requestHandler: {
            connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
            requestTimeout: R2_REQUEST_TIMEOUT_MS,
            throwOnRequestTimeout: true,
            socketTimeout: R2_REQUEST_TIMEOUT_MS,
            httpsAgent: { keepAlive: false },
        },
    };
    return {
        async send(command) {
            for (let attempt = 0; ; attempt += 1) {
                const client = new S3Client(options);
                const keepClient = command instanceof GetObjectCommand;
                let completed = false;
                try {
                    let result: unknown;
                    if (command instanceof GetObjectCommand) {
                        result = await sendWithDeadline(client, abortSignal =>
                            client.send(command, { abortSignal })
                        );
                    } else if (command instanceof HeadObjectCommand) {
                        result = await sendWithDeadline(client, abortSignal =>
                            client.send(command, { abortSignal })
                        );
                    } else if (command instanceof ListObjectsV2Command) {
                        result = await sendWithDeadline(client, abortSignal =>
                            client.send(command, { abortSignal })
                        );
                    } else {
                        result = await sendWithDeadline(client, abortSignal =>
                            client.send(command, { abortSignal })
                        );
                    }
                    completed = true;
                    return result;
                } catch (error) {
                    if (
                        attempt + 1 >= R2_MAX_COMMAND_ATTEMPTS ||
                        !canRetry(command) ||
                        !isTimeoutError(error)
                    ) {
                        throw error;
                    }
                } finally {
                    if (!keepClient || !completed) client.destroy();
                }
            }
        },
        destroy() {},
    };
}

export class R2DeliveryStore implements DeliveryStore {
    private readonly bucket: string;
    private readonly client: R2DeliveryClient;

    constructor(options: R2DeliveryStoreOptions) {
        this.bucket = options.bucket;
        this.client = options.client;
    }

    static async createFromEnvironment(
        options: {
            configPath?: string;
            environment?: Readonly<Record<string, string | undefined>>;
            bucket?: 'delivery' | 'source';
        } = {}
    ): Promise<R2DeliveryStore> {
        let config: Awaited<ReturnType<typeof loadR2DeliveryConfig>>;
        try {
            config = await loadR2DeliveryConfig(options.configPath);
        } catch {
            throw new PublisherError(
                'configuration',
                'Unable to load R2 delivery configuration',
                { cause: SANITIZED_R2_CONFIG_CAUSE }
            );
        }
        const environment = options.environment ?? process.env;
        const bucket = options.bucket ?? 'delivery';
        const accessKeyId = environment.R2_RELEASE_ACCESS_KEY_ID;
        const secretAccessKey = environment.R2_RELEASE_SECRET_ACCESS_KEY;
        if (!accessKeyId || !secretAccessKey) {
            throw new PublisherError(
                'configuration',
                'R2_RELEASE_ACCESS_KEY_ID and R2_RELEASE_SECRET_ACCESS_KEY must be set'
            );
        }

        return new R2DeliveryStore({
            bucket: config.buckets[bucket],
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
            throw this.storageError('Unable to inspect R2 object', key);
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
                request.key
            );
        }
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        this.assertPointerKey(key);
        const object = await this.readIfPresent(key);
        if (object === null) return { exists: false };
        return {
            exists: true,
            etag: object.etag,
            bytes: object.bytes,
            contentType: object.contentType,
            cacheControl: object.cacheControl,
            customMetadata: object.customMetadata,
        };
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        return this.inspectPointer(key);
    }

    async compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }> {
        this.assertPointerKey(request.key);
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
                request.key
            );
        }
    }

    async *listKeys(prefix: string): AsyncIterable<string> {
        let continuationToken: string | undefined;
        const seenContinuationTokens = new Set<string>();
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
            } catch {
                throw this.storageError('Unable to list R2 objects', prefix);
            }

            for (const listed of output.Contents ?? []) {
                if (listed.Key === undefined) {
                    throw new PublisherError(
                        'integrity',
                        'R2 list response contains an object without a key',
                        { context: { prefix } }
                    );
                }
                yield listed.Key;
            }

            if (output.IsTruncated !== true) return;
            const nextContinuationToken = output.NextContinuationToken;
            if (
                nextContinuationToken === undefined ||
                nextContinuationToken.length === 0 ||
                nextContinuationToken === continuationToken ||
                seenContinuationTokens.has(nextContinuationToken)
            ) {
                throw new PublisherError(
                    'integrity',
                    'Truncated R2 list response has no advancing continuation token',
                    { context: { prefix } }
                );
            }
            seenContinuationTokens.add(nextContinuationToken);
            continuationToken = nextContinuationToken;
        } while (true);
    }

    async *list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        for await (const key of this.listKeys(prefix)) {
            const metadata = await this.stat(key);
            if (metadata !== null) yield metadata;
        }
    }

    async close(): Promise<void> {
        this.client.destroy();
    }

    private assertPointerKey(key: string): void {
        if (!isRuntimePointerKey(key)) {
            throw new PublisherError(
                'input',
                'Pointer key must identify a runtime current.json',
                { context: { key } }
            );
        }
    }

    private async readIfPresent(key: string): Promise<StoredObject | null> {
        for (let attempt = 0; attempt < R2_MAX_COMMAND_ATTEMPTS; attempt += 1) {
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
                const bytes = await readBodyWithDeadline(output.Body);
                return {
                    ...this.normalizeMetadata(key, output),
                    bytes,
                };
            } catch (error) {
                if (
                    isTimeoutError(error) &&
                    attempt + 1 < R2_MAX_COMMAND_ATTEMPTS
                ) {
                    continue;
                }
                if (isNotFound(error)) return null;
                if (error instanceof PublisherError) throw error;
                throw this.storageError('Unable to read R2 object', key);
            }
        }
        throw this.storageError('Unable to read R2 object', key);
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

    private storageError(message: string, key: string): PublisherError {
        return new PublisherError('storage', message, {
            cause: SANITIZED_R2_TRANSPORT_CAUSE,
            context: { key },
        });
    }
}
