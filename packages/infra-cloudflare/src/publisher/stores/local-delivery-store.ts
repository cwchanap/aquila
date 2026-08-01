import { randomUUID } from 'node:crypto';
import {
    mkdir,
    open,
    readFile,
    readdir,
    rename,
    stat as fsStat,
    unlink,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { PublisherError } from '../errors';
import { sha256Bytes } from '../hash';
import type {
    DeliveryStore,
    ImmutableCreateRequest,
    PointerSnapshot,
    PointerWriteRequest,
    StoredObject,
    StoredObjectMetadata,
} from './delivery-store';

interface LocalMetadata extends StoredObjectMetadata {
    version: 1;
}

const METADATA_DIRECTORY = '.publisher-metadata';
const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;

function isNodeError(error: unknown, code: string): boolean {
    return (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === code
    );
}

function localEtag(bytes: Uint8Array): string {
    return `local-sha256-${sha256Bytes(bytes)}`;
}

function metadataJson(metadata: LocalMetadata): Uint8Array {
    return new TextEncoder().encode(`${JSON.stringify(metadata)}\n`);
}

function isStringRecord(value: unknown): value is Record<string, string> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value).every(entry => typeof entry === 'string')
    );
}

function parseMetadata(value: unknown, metadataPath: string): LocalMetadata {
    if (
        typeof value !== 'object' ||
        value === null ||
        (value as Partial<LocalMetadata>).version !== 1 ||
        typeof (value as Partial<LocalMetadata>).key !== 'string' ||
        typeof (value as Partial<LocalMetadata>).etag !== 'string' ||
        typeof (value as Partial<LocalMetadata>).byteLength !== 'number' ||
        !Number.isSafeInteger((value as Partial<LocalMetadata>).byteLength) ||
        (value as Partial<LocalMetadata>).byteLength! < 0 ||
        typeof (value as Partial<LocalMetadata>).contentType !== 'string' ||
        typeof (value as Partial<LocalMetadata>).cacheControl !== 'string' ||
        !isStringRecord((value as Partial<LocalMetadata>).customMetadata)
    ) {
        throw new PublisherError('integrity', 'Invalid local store metadata', {
            context: { metadataPath },
        });
    }
    return value as LocalMetadata;
}

function sameExpectation(
    current: PointerSnapshot,
    expected: PointerWriteRequest['expected']
): boolean {
    if (!current.exists || !expected.exists) {
        return current.exists === expected.exists;
    }
    return current.etag === expected.etag;
}

export class LocalDeliveryStore implements DeliveryStore {
    private readonly root: string;
    private readonly metadataRoot: string;

    constructor(root: string) {
        this.root = resolve(root);
        this.metadataRoot = resolve(this.root, METADATA_DIRECTORY);
    }

    async stat(key: string): Promise<StoredObjectMetadata | null> {
        const bodyPath = this.bodyPath(key);
        const metadata = await this.readMetadataIfPresent(key);
        if (metadata === null) {
            try {
                await fsStat(bodyPath);
            } catch (error) {
                if (isNodeError(error, 'ENOENT')) return null;
                throw this.storageError(
                    'Unable to inspect local object',
                    key,
                    error
                );
            }
            throw this.integrityError(
                'Local object body exists without valid metadata',
                key
            );
        }

        let bodyStats;
        try {
            bodyStats = await fsStat(bodyPath);
        } catch (error) {
            if (isNodeError(error, 'ENOENT')) {
                throw this.integrityError(
                    'Local object metadata exists without a body',
                    key
                );
            }
            throw this.storageError(
                'Unable to inspect local object',
                key,
                error
            );
        }
        if (!bodyStats.isFile() || bodyStats.size !== metadata.byteLength) {
            throw this.integrityError(
                'Local object metadata does not match body',
                key
            );
        }
        return metadata;
    }

    async read(key: string): Promise<StoredObject> {
        const metadata = await this.stat(key);
        if (metadata === null) {
            throw new PublisherError('storage', 'Local object does not exist', {
                context: { key },
            });
        }

        let bytes: Uint8Array;
        try {
            bytes = await readFile(this.bodyPath(key));
        } catch (error) {
            if (isNodeError(error, 'ENOENT')) {
                throw this.integrityError(
                    'Local object metadata exists without a body',
                    key
                );
            }
            throw this.storageError('Unable to read local object', key, error);
        }
        if (
            bytes.byteLength !== metadata.byteLength ||
            localEtag(bytes) !== metadata.etag
        ) {
            throw this.integrityError(
                'Local object metadata does not match body',
                key
            );
        }
        return { ...metadata, bytes };
    }

    async createImmutable(
        request: ImmutableCreateRequest
    ): Promise<{ status: 'created' | 'already-exists' }> {
        const bodyPath = this.bodyPath(request.key);
        await this.ensureDirectories(bodyPath, request.key);

        let bodyHandle;
        try {
            bodyHandle = await open(bodyPath, 'wx');
        } catch (error) {
            if (isNodeError(error, 'EEXIST')) {
                return { status: 'already-exists' };
            }
            throw this.storageError(
                'Unable to create immutable local object',
                request.key,
                error
            );
        }

        try {
            await bodyHandle.writeFile(request.bytes);
            await bodyHandle.sync();
        } catch (error) {
            throw this.storageError(
                'Unable to write immutable local object',
                request.key,
                error
            );
        } finally {
            await bodyHandle.close();
        }

        const metadata = this.buildMetadata(request);
        await this.atomicWrite(
            this.metadataPath(request.key),
            metadataJson(metadata),
            request.key
        );
        await this.flushDirectory(dirname(bodyPath), request.key);
        return { status: 'created' };
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        const metadata = await this.stat(key);
        if (metadata === null) return { exists: false };
        const object = await this.read(key);
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
        const bodyPath = this.bodyPath(request.key);
        await this.ensureDirectories(bodyPath, request.key);
        const lockPath = `${bodyPath}.lock`;
        const lockHandle = await this.acquireLock(lockPath, request.key);

        try {
            const current = await this.readPointer(request.key);
            if (!sameExpectation(current, request.expected)) {
                return { status: 'precondition-failed' };
            }

            const metadata = this.buildMetadata(request);
            const bodyTemporaryPath = this.temporaryPath(bodyPath);
            const metadataPath = this.metadataPath(request.key);
            const metadataTemporaryPath = this.temporaryPath(metadataPath);
            await this.writeTemporaryFile(
                bodyTemporaryPath,
                request.bytes,
                request.key
            );
            try {
                await this.writeTemporaryFile(
                    metadataTemporaryPath,
                    metadataJson(metadata),
                    request.key
                );
                await rename(bodyTemporaryPath, bodyPath);
                await rename(metadataTemporaryPath, metadataPath);
            } catch (error) {
                await this.unlinkIfPresent(bodyTemporaryPath);
                await this.unlinkIfPresent(metadataTemporaryPath);
                throw this.storageError(
                    'Unable to atomically replace local pointer',
                    request.key,
                    error
                );
            }
            await this.flushDirectory(dirname(bodyPath), request.key);
            await this.flushDirectory(dirname(metadataPath), request.key);
            return { status: 'written', etag: metadata.etag };
        } finally {
            try {
                await lockHandle.close();
            } finally {
                await this.unlinkIfPresent(lockPath);
            }
        }
    }

    async *list(prefix: string): AsyncIterable<StoredObjectMetadata> {
        this.assertSafePrefix(prefix);
        let entries: string[];
        try {
            entries = await readdir(this.metadataRoot);
        } catch (error) {
            if (isNodeError(error, 'ENOENT')) return;
            throw this.storageError(
                'Unable to list local objects',
                prefix,
                error
            );
        }
        for (const entry of entries) {
            if (!entry.endsWith('.json')) continue;
            const metadata = await this.readMetadataFile(
                resolve(this.metadataRoot, entry)
            );
            if (!metadata.key.startsWith(prefix)) continue;
            const current = await this.stat(metadata.key);
            if (current !== null) yield current;
        }
    }

    async close(): Promise<void> {}

    private bodyPath(key: string): string {
        this.assertSafeKey(key);
        const path = resolve(this.root, ...key.split('/'));
        const pathRelativeToRoot = relative(this.root, path);
        if (
            pathRelativeToRoot.startsWith(`..${sep}`) ||
            pathRelativeToRoot === '..' ||
            isAbsolute(pathRelativeToRoot)
        ) {
            throw this.unsafeKeyError(key);
        }
        return path;
    }

    private assertSafeKey(key: string): void {
        const segments = key.split('/');
        if (
            key.length === 0 ||
            key.includes('\\') ||
            key.includes('\0') ||
            key.startsWith('/') ||
            segments.some(
                segment => segment === '' || segment === '.' || segment === '..'
            ) ||
            segments[0] === METADATA_DIRECTORY
        ) {
            throw this.unsafeKeyError(key);
        }
    }

    private assertSafePrefix(prefix: string): void {
        if (prefix === '') return;
        if (
            prefix.includes('\\') ||
            prefix.includes('\0') ||
            prefix.startsWith('/') ||
            prefix
                .split('/')
                .some(segment => segment === '.' || segment === '..') ||
            prefix.split('/')[0] === METADATA_DIRECTORY
        ) {
            throw this.unsafeKeyError(prefix);
        }
    }

    private unsafeKeyError(key: string): PublisherError {
        return new PublisherError('storage', 'Local store key is unsafe', {
            context: { key },
        });
    }

    private metadataPath(key: string): string {
        const digest = sha256Bytes(new TextEncoder().encode(key));
        return resolve(this.metadataRoot, `${digest}.json`);
    }

    private temporaryPath(path: string): string {
        return `${path}.${process.pid}.${randomUUID()}.tmp`;
    }

    private buildMetadata(
        request: ImmutableCreateRequest | PointerWriteRequest
    ): LocalMetadata {
        return {
            version: 1,
            key: request.key,
            etag: localEtag(request.bytes),
            byteLength: request.bytes.byteLength,
            contentType: request.contentType,
            cacheControl: request.cacheControl,
            customMetadata: { ...(request.customMetadata ?? {}) },
        };
    }

    private async ensureDirectories(
        bodyPath: string,
        key: string
    ): Promise<void> {
        try {
            await mkdir(dirname(bodyPath), { recursive: true });
            await mkdir(this.metadataRoot, { recursive: true });
        } catch (error) {
            throw this.storageError(
                'Unable to create local store directories',
                key,
                error
            );
        }
    }

    private async readMetadataIfPresent(
        key: string
    ): Promise<LocalMetadata | null> {
        const metadataPath = this.metadataPath(key);
        try {
            const metadata = await this.readMetadataFile(metadataPath);
            if (metadata.key !== key) {
                throw this.integrityError(
                    'Local object metadata key does not match requested key',
                    key
                );
            }
            return metadata;
        } catch (error) {
            if (isNodeError(error, 'ENOENT')) return null;
            if (error instanceof PublisherError) throw error;
            throw this.storageError(
                'Unable to read local object metadata',
                key,
                error
            );
        }
    }

    private async readMetadataFile(path: string): Promise<LocalMetadata> {
        const text = await readFile(path, 'utf8');
        try {
            return parseMetadata(JSON.parse(text), path);
        } catch (error) {
            if (error instanceof PublisherError) throw error;
            throw new PublisherError(
                'integrity',
                'Invalid local store metadata',
                {
                    cause: error,
                    context: { metadataPath: path },
                }
            );
        }
    }

    private async atomicWrite(
        path: string,
        bytes: Uint8Array,
        key: string
    ): Promise<void> {
        const temporaryPath = this.temporaryPath(path);
        await this.writeTemporaryFile(temporaryPath, bytes, key);
        try {
            await rename(temporaryPath, path);
            await this.flushDirectory(dirname(path), key);
        } catch (error) {
            await this.unlinkIfPresent(temporaryPath);
            throw this.storageError(
                'Unable to atomically write local metadata',
                key,
                error
            );
        }
    }

    private async writeTemporaryFile(
        path: string,
        bytes: Uint8Array,
        key: string
    ): Promise<void> {
        let handle;
        try {
            handle = await open(path, 'wx');
            await handle.writeFile(bytes);
            await handle.sync();
        } catch (error) {
            await handle?.close();
            handle = undefined;
            await this.unlinkIfPresent(path);
            throw this.storageError(
                'Unable to write local temporary file',
                key,
                error
            );
        } finally {
            await handle?.close();
        }
    }

    private async flushDirectory(path: string, key: string): Promise<void> {
        let handle;
        try {
            handle = await open(path, 'r');
            await handle.sync();
        } catch (error) {
            throw this.storageError(
                'Unable to flush local store directory',
                key,
                error
            );
        } finally {
            await handle?.close();
        }
    }

    private async acquireLock(path: string, key: string) {
        const startedAt = Date.now();
        while (true) {
            try {
                return await open(path, 'wx');
            } catch (error) {
                if (!isNodeError(error, 'EEXIST')) {
                    throw this.storageError(
                        'Unable to acquire pointer lock',
                        key,
                        error
                    );
                }
                if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
                    throw new PublisherError(
                        'concurrency',
                        'Timed out acquiring local pointer lock',
                        { context: { key } }
                    );
                }
                await new Promise(resolve =>
                    setTimeout(resolve, LOCK_RETRY_MS)
                );
            }
        }
    }

    private async unlinkIfPresent(path: string): Promise<void> {
        try {
            await unlink(path);
        } catch (error) {
            if (!isNodeError(error, 'ENOENT')) throw error;
        }
    }

    private integrityError(message: string, key: string): PublisherError {
        return new PublisherError('integrity', message, { context: { key } });
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
