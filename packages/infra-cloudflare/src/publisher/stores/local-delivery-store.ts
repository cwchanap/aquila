import { randomUUID } from 'node:crypto';
import {
    access,
    link,
    mkdir,
    open,
    readFile,
    readdir,
    rename,
    stat as fsStat,
    unlink,
} from 'node:fs/promises';
import {
    basename,
    dirname,
    isAbsolute,
    relative,
    resolve,
    sep,
} from 'node:path';
import { isPreviewId, isStoryId } from '@aquila/stories/runtime-assets';
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

interface PointerTransactionMarker {
    version: 1;
    key: string;
    bodyTemporaryName: string;
    metadataTemporaryName: string;
}

interface PointerLockRecord {
    version: 2;
    pid: number;
    token: string;
    state: 'choosing' | 'waiting';
    ticket: number | null;
}

interface PointerLock {
    claimPath: string;
    ownerPath: string;
    record: PointerLockRecord;
}

const METADATA_DIRECTORY = '.publisher-metadata';
const TRANSACTION_DIRECTORY = '.publisher-transactions';
const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface LocalDeliveryStoreOptions {
    afterDirectoryFlush?: (path: string) => Promise<void>;
}

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

function parseMetadata(
    value: unknown,
    context: Readonly<Record<string, string>>
): LocalMetadata {
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
            context,
        });
    }
    return value as LocalMetadata;
}

function parsePointerTransactionMarker(
    value: unknown,
    key: string
): PointerTransactionMarker {
    if (
        typeof value !== 'object' ||
        value === null ||
        (value as Partial<PointerTransactionMarker>).version !== 1 ||
        (value as Partial<PointerTransactionMarker>).key !== key ||
        typeof (value as Partial<PointerTransactionMarker>)
            .bodyTemporaryName !== 'string' ||
        typeof (value as Partial<PointerTransactionMarker>)
            .metadataTemporaryName !== 'string'
    ) {
        throw new PublisherError(
            'integrity',
            'Invalid local pointer transaction marker',
            { context: { key } }
        );
    }
    return value as PointerTransactionMarker;
}

function parsePointerLockRecord(
    value: unknown,
    key: string
): PointerLockRecord {
    if (
        typeof value !== 'object' ||
        value === null ||
        (value as Partial<PointerLockRecord>).version !== 2 ||
        !Number.isSafeInteger((value as Partial<PointerLockRecord>).pid) ||
        (value as Partial<PointerLockRecord>).pid! <= 0 ||
        typeof (value as Partial<PointerLockRecord>).token !== 'string' ||
        !UUID_RE.test((value as Partial<PointerLockRecord>).token!) ||
        ((value as Partial<PointerLockRecord>).state !== 'choosing' &&
            (value as Partial<PointerLockRecord>).state !== 'waiting') ||
        ((value as Partial<PointerLockRecord>).state === 'choosing' &&
            (value as Partial<PointerLockRecord>).ticket !== null) ||
        ((value as Partial<PointerLockRecord>).state === 'waiting' &&
            (!Number.isSafeInteger(
                (value as Partial<PointerLockRecord>).ticket
            ) ||
                (value as Partial<PointerLockRecord>).ticket! <= 0))
    ) {
        throw new PublisherError(
            'concurrency',
            'Invalid local pointer lock record',
            { context: { key } }
        );
    }
    return value as PointerLockRecord;
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
    private readonly transactionRoot: string;
    private readonly afterDirectoryFlush?: (path: string) => Promise<void>;

    constructor(root: string, options: LocalDeliveryStoreOptions = {}) {
        this.root = resolve(root);
        this.metadataRoot = resolve(this.root, METADATA_DIRECTORY);
        this.transactionRoot = resolve(this.root, TRANSACTION_DIRECTORY);
        this.afterDirectoryFlush = options.afterDirectoryFlush;
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
        const lock = await this.acquireLock(
            `${bodyPath}.create-lock`,
            request.key
        );
        try {
            // Recover any transaction left pending by a previous crash
            // before deciding whether the object already exists. Without
            // this, a body written to a temporary file (but not yet renamed
            // into place) would be invisible to readMetadataIfPresent and
            // the create would proceed, leaking the orphaned transaction.
            await this.recoverPendingPointerTransaction(request.key);
            const existing = await this.readMetadataIfPresent(request.key);
            if (existing !== null) return { status: 'already-exists' };

            const metadata = this.buildMetadata(request);
            const bodyTemporaryPath = this.temporaryPath(bodyPath);
            const metadataPath = this.metadataPath(request.key);
            const metadataTemporaryPath = this.temporaryPath(metadataPath);
            const transactionPath = this.transactionPath(request.key);
            const marker: PointerTransactionMarker = {
                version: 1,
                key: request.key,
                bodyTemporaryName: basename(bodyTemporaryPath),
                metadataTemporaryName: basename(metadataTemporaryPath),
            };
            try {
                await this.writeTemporaryFile(
                    bodyTemporaryPath,
                    request.bytes,
                    request.key
                );
                await this.writeTemporaryFile(
                    metadataTemporaryPath,
                    metadataJson(metadata),
                    request.key
                );
                await this.flushDirectory(
                    dirname(bodyTemporaryPath),
                    request.key
                );
                await this.flushDirectory(
                    dirname(metadataTemporaryPath),
                    request.key
                );
                await this.atomicWrite(
                    transactionPath,
                    new TextEncoder().encode(`${JSON.stringify(marker)}\n`),
                    request.key
                );
            } catch (error) {
                if (!(await this.fileExists(transactionPath))) {
                    await this.unlinkIfPresent(bodyTemporaryPath);
                    await this.unlinkIfPresent(metadataTemporaryPath);
                }
                throw this.storageError(
                    'Unable to prepare local immutable transaction',
                    request.key,
                    error
                );
            }
            await this.completePointerTransaction(marker);
            return { status: 'created' };
        } finally {
            await this.releaseLock(lock, request.key);
        }
    }

    async readPointer(key: string): Promise<PointerSnapshot> {
        this.assertPointerKey(key);
        const bodyPath = this.bodyPath(key);
        await this.ensureDirectories(bodyPath, key);
        const lock = await this.acquireLock(`${bodyPath}.lock`, key);
        try {
            await this.recoverPendingPointerTransaction(key);
            return await this.readPointerUnlocked(key);
        } finally {
            await this.releaseLock(lock, key);
        }
    }

    async inspectPointer(key: string): Promise<PointerSnapshot> {
        this.assertPointerKey(key);
        return this.readPointerUnlocked(key);
    }

    private async readPointerUnlocked(key: string): Promise<PointerSnapshot> {
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
        this.assertPointerKey(request.key);
        const bodyPath = this.bodyPath(request.key);
        await this.ensureDirectories(bodyPath, request.key);
        const lock = await this.acquireLock(`${bodyPath}.lock`, request.key);

        try {
            await this.recoverPendingPointerTransaction(request.key);
            const current = await this.readPointerUnlocked(request.key);
            if (!sameExpectation(current, request.expected)) {
                return { status: 'precondition-failed' };
            }

            const metadata = this.buildMetadata(request);
            const bodyTemporaryPath = this.temporaryPath(bodyPath);
            const metadataPath = this.metadataPath(request.key);
            const metadataTemporaryPath = this.temporaryPath(metadataPath);
            const transactionPath = this.transactionPath(request.key);
            const marker: PointerTransactionMarker = {
                version: 1,
                key: request.key,
                bodyTemporaryName: basename(bodyTemporaryPath),
                metadataTemporaryName: basename(metadataTemporaryPath),
            };
            try {
                await this.writeTemporaryFile(
                    bodyTemporaryPath,
                    request.bytes,
                    request.key
                );
                await this.writeTemporaryFile(
                    metadataTemporaryPath,
                    metadataJson(metadata),
                    request.key
                );
                await this.flushDirectory(
                    dirname(bodyTemporaryPath),
                    request.key
                );
                await this.flushDirectory(
                    dirname(metadataTemporaryPath),
                    request.key
                );
                await this.atomicWrite(
                    transactionPath,
                    new TextEncoder().encode(`${JSON.stringify(marker)}\n`),
                    request.key
                );
            } catch (error) {
                if (!(await this.fileExists(transactionPath))) {
                    await this.unlinkIfPresent(bodyTemporaryPath);
                    await this.unlinkIfPresent(metadataTemporaryPath);
                }
                throw this.storageError(
                    'Unable to prepare local pointer transaction',
                    request.key,
                    error
                );
            }
            await this.completePointerTransaction(marker);
            return { status: 'written', etag: metadata.etag };
        } finally {
            await this.releaseLock(lock, request.key);
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
                resolve(this.metadataRoot, entry),
                { metadataKey: `${METADATA_DIRECTORY}/${entry}` }
            );
            if (!metadata.key.startsWith(prefix)) continue;
            const current = await this.stat(metadata.key);
            if (current !== null) yield current;
        }
    }

    async *listKeys(prefix: string): AsyncIterable<string> {
        this.assertSafePrefix(prefix);
        const finalSeparator = prefix.lastIndexOf('/');
        const parentKey =
            finalSeparator < 0 ? '' : prefix.slice(0, finalSeparator);
        const startPath =
            parentKey === ''
                ? this.root
                : resolve(this.root, ...parentKey.split('/'));
        const pending = [startPath];

        while (pending.length > 0) {
            const directory = pending.pop()!;
            let entries;
            try {
                entries = await readdir(directory, { withFileTypes: true });
            } catch (error) {
                if (isNodeError(error, 'ENOENT')) continue;
                throw this.storageError(
                    'Unable to list local object keys',
                    prefix,
                    error
                );
            }
            entries.sort((left, right) =>
                left.name < right.name ? 1 : left.name > right.name ? -1 : 0
            );
            for (const entry of entries) {
                if (
                    directory === this.root &&
                    (entry.name === METADATA_DIRECTORY ||
                        entry.name === TRANSACTION_DIRECTORY)
                ) {
                    continue;
                }
                const path = resolve(directory, entry.name);
                if (entry.isDirectory()) {
                    pending.push(path);
                    continue;
                }
                if (!entry.isFile()) continue;
                const key = relative(this.root, path).split(sep).join('/');
                if (key.startsWith(prefix)) yield key;
            }
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
            segments[0] === METADATA_DIRECTORY ||
            segments[0] === TRANSACTION_DIRECTORY
        ) {
            throw this.unsafeKeyError(key);
        }
    }

    private assertPointerKey(key: string): void {
        this.assertSafeKey(key);
        const segments = key.split('/');
        const productionPointer =
            segments.length === 4 &&
            segments[0] === 'vn' &&
            segments[1] === 'stories' &&
            isStoryId(segments[2]) &&
            segments[3] === 'current.json';
        const previewPointer =
            segments.length === 6 &&
            segments[0] === 'vn' &&
            segments[1] === 'previews' &&
            isPreviewId(segments[2]) &&
            segments[3] === 'stories' &&
            isStoryId(segments[4]) &&
            segments[5] === 'current.json';
        if (!productionPointer && !previewPointer) {
            throw new PublisherError(
                'input',
                'Pointer key must identify a runtime current.json',
                { context: { key } }
            );
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
            prefix.split('/')[0] === METADATA_DIRECTORY ||
            prefix.split('/')[0] === TRANSACTION_DIRECTORY
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

    private transactionPath(key: string): string {
        const digest = sha256Bytes(new TextEncoder().encode(key));
        return resolve(this.transactionRoot, `${digest}.json`);
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
            await mkdir(this.transactionRoot, { recursive: true });
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
            const metadata = await this.readMetadataFile(metadataPath, { key });
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

    private async readMetadataFile(
        path: string,
        context: Readonly<Record<string, string>>
    ): Promise<LocalMetadata> {
        const text = await readFile(path, 'utf8');
        try {
            return parseMetadata(JSON.parse(text), context);
        } catch (error) {
            if (error instanceof PublisherError) throw error;
            throw new PublisherError(
                'integrity',
                'Invalid local store metadata',
                {
                    cause: error,
                    context,
                }
            );
        }
    }

    private async recoverPendingPointerTransaction(key: string): Promise<void> {
        const path = this.transactionPath(key);
        let text: string;
        try {
            text = await readFile(path, 'utf8');
        } catch (error) {
            if (isNodeError(error, 'ENOENT')) return;
            throw this.storageError(
                'Unable to read local pointer transaction',
                key,
                error
            );
        }

        let marker: PointerTransactionMarker;
        try {
            marker = parsePointerTransactionMarker(JSON.parse(text), key);
        } catch (error) {
            if (error instanceof PublisherError) throw error;
            throw new PublisherError(
                'integrity',
                'Invalid local pointer transaction marker',
                { cause: error, context: { key } }
            );
        }
        await this.completePointerTransaction(marker);
    }

    private async completePointerTransaction(
        marker: PointerTransactionMarker
    ): Promise<void> {
        const key = marker.key;
        const bodyPath = this.bodyPath(key);
        const metadataPath = this.metadataPath(key);
        const bodyTemporaryPath = this.resolveTransactionTemporaryPath(
            dirname(bodyPath),
            basename(bodyPath),
            marker.bodyTemporaryName,
            key
        );
        const metadataTemporaryPath = this.resolveTransactionTemporaryPath(
            dirname(metadataPath),
            basename(metadataPath),
            marker.metadataTemporaryName,
            key
        );

        let metadata: LocalMetadata;
        let metadataIsTemporary = true;
        try {
            metadata = await this.readMetadataFile(metadataTemporaryPath, {
                key,
            });
        } catch (error) {
            if (!isNodeError(error, 'ENOENT')) throw error;
            metadataIsTemporary = false;
            metadata = await this.readMetadataFile(metadataPath, { key });
        }
        if (metadata.key !== key) {
            throw this.integrityError(
                'Pointer transaction metadata key does not match marker',
                key
            );
        }

        let bodyIsTemporary = true;
        let bytes: Uint8Array;
        try {
            bytes = await readFile(bodyTemporaryPath);
        } catch (error) {
            if (!isNodeError(error, 'ENOENT')) {
                throw this.storageError(
                    'Unable to read local pointer transaction body',
                    key,
                    error
                );
            }
            bodyIsTemporary = false;
            try {
                bytes = await readFile(bodyPath);
            } catch (bodyError) {
                throw this.storageError(
                    'Unable to recover local pointer transaction body',
                    key,
                    bodyError
                );
            }
        }
        this.assertBodyMatchesMetadata(bytes, metadata, key);

        try {
            if (bodyIsTemporary) {
                await rename(bodyTemporaryPath, bodyPath);
            }
            if (metadataIsTemporary) {
                await rename(metadataTemporaryPath, metadataPath);
            }
            await this.flushDirectory(dirname(bodyPath), key);
            await this.flushDirectory(dirname(metadataPath), key);
        } catch (error) {
            throw this.storageError(
                'Unable to complete local pointer transaction',
                key,
                error
            );
        }

        const completed = await this.read(key);
        if (completed.etag !== metadata.etag) {
            throw this.integrityError(
                'Recovered pointer does not match transaction metadata',
                key
            );
        }
        await this.unlinkIfPresent(this.transactionPath(key));
        await this.flushDirectory(this.transactionRoot, key);
    }

    private resolveTransactionTemporaryPath(
        directory: string,
        targetName: string,
        temporaryName: string,
        key: string
    ): string {
        if (
            basename(temporaryName) !== temporaryName ||
            !temporaryName.startsWith(`${targetName}.`) ||
            !temporaryName.endsWith('.tmp')
        ) {
            throw new PublisherError(
                'integrity',
                'Unsafe local pointer transaction temporary name',
                { context: { key } }
            );
        }
        return resolve(directory, temporaryName);
    }

    private assertBodyMatchesMetadata(
        bytes: Uint8Array,
        metadata: LocalMetadata,
        key: string
    ): void {
        if (
            bytes.byteLength !== metadata.byteLength ||
            localEtag(bytes) !== metadata.etag
        ) {
            throw this.integrityError(
                'Local pointer transaction body does not match metadata',
                key
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
            await this.afterDirectoryFlush?.(path);
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

    private async acquireLock(path: string, key: string): Promise<PointerLock> {
        const startedAt = Date.now();
        const token = randomUUID();
        const choosing: PointerLockRecord = {
            version: 2,
            pid: process.pid,
            token,
            state: 'choosing',
            ticket: null,
        };
        const choosingPath = this.lockRecordPath(path, choosing);
        const choosingOwnerPath = await this.publishLockRecord(
            choosingPath,
            choosing,
            key
        );
        let claimPath: string | null = null;
        let claimOwnerPath: string | null = null;
        try {
            const initialRecords = await this.readActiveLockRecords(path, key);
            const maximumTicket = initialRecords.reduce(
                (maximum, entry) =>
                    entry.record.ticket === null
                        ? maximum
                        : Math.max(maximum, entry.record.ticket),
                0
            );
            const claim: PointerLockRecord = {
                version: 2,
                pid: process.pid,
                token,
                state: 'waiting',
                ticket: maximumTicket + 1,
            };
            claimPath = this.lockRecordPath(path, claim);
            claimOwnerPath = await this.publishLockRecord(
                claimPath,
                claim,
                key
            );
            await this.unlinkIfPresent(choosingPath);
            await this.unlinkIfPresent(choosingOwnerPath);
            await this.flushDirectory(dirname(path), key);

            while (true) {
                const records = await this.readActiveLockRecords(path, key);
                const ownClaimExists = records.some(
                    entry => entry.record.token === token
                );
                if (!ownClaimExists) {
                    throw new PublisherError(
                        'concurrency',
                        'Local pointer lock claim disappeared',
                        { context: { key } }
                    );
                }
                const anotherProcessIsChoosing = records.some(
                    entry =>
                        entry.record.state === 'choosing' &&
                        entry.record.token !== token
                );
                const predecessorExists = records.some(entry => {
                    const candidate = entry.record;
                    if (
                        candidate.state !== 'waiting' ||
                        candidate.token === token ||
                        candidate.ticket === null
                    ) {
                        return false;
                    }
                    return (
                        candidate.ticket < claim.ticket! ||
                        (candidate.ticket === claim.ticket &&
                            candidate.token < token)
                    );
                });
                if (!anotherProcessIsChoosing && !predecessorExists) {
                    return {
                        claimPath,
                        ownerPath: claimOwnerPath,
                        record: claim,
                    };
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
        } catch (error) {
            await this.unlinkIfPresent(choosingPath);
            await this.unlinkIfPresent(choosingOwnerPath);
            if (claimPath !== null) await this.unlinkIfPresent(claimPath);
            if (claimOwnerPath !== null) {
                await this.unlinkIfPresent(claimOwnerPath);
            }
            await this.flushDirectory(dirname(path), key);
            throw error;
        }
    }

    private lockRecordPath(path: string, record: PointerLockRecord): string {
        const role = record.state === 'choosing' ? 'choosing' : 'claim';
        return `${path}.${role}.${record.token}.json`;
    }

    private async publishLockRecord(
        path: string,
        record: PointerLockRecord,
        key: string
    ): Promise<string> {
        const ownerPath = `${path}.owner`;
        await this.writeTemporaryFile(
            ownerPath,
            new TextEncoder().encode(`${JSON.stringify(record)}\n`),
            key
        );
        let linked = false;
        try {
            await link(ownerPath, path);
            linked = true;
            await this.flushDirectory(dirname(path), key);
            return ownerPath;
        } catch (error) {
            let cleanupError: unknown;
            try {
                if (linked) await this.unlinkIfPresent(path);
                await this.unlinkIfPresent(ownerPath);
                await this.flushDirectory(dirname(path), key);
            } catch (candidate) {
                cleanupError = candidate;
            }
            if (cleanupError !== undefined) {
                throw this.storageError(
                    'Unable to clean failed local pointer lock publication',
                    key,
                    new AggregateError([error, cleanupError])
                );
            }
            throw this.storageError(
                'Unable to publish local pointer lock record',
                key,
                error
            );
        }
    }

    private async readActiveLockRecords(
        path: string,
        key: string
    ): Promise<
        Array<{
            path: string;
            ownerPath: string;
            record: PointerLockRecord;
        }>
    > {
        const directory = dirname(path);
        const prefix = `${basename(path)}.`;
        while (true) {
            let entries: string[];
            try {
                entries = await readdir(directory);
            } catch (error) {
                throw this.storageError(
                    'Unable to inspect local pointer lock records',
                    key,
                    error
                );
            }
            const active: Array<{
                path: string;
                ownerPath: string;
                record: PointerLockRecord;
            }> = [];
            let snapshotChanged = false;
            let removedStaleRecord = false;
            for (const entry of entries) {
                if (!entry.startsWith(prefix) || !entry.endsWith('.json')) {
                    continue;
                }
                const recordPath = resolve(directory, entry);
                let record: PointerLockRecord;
                try {
                    record = parsePointerLockRecord(
                        JSON.parse(await readFile(recordPath, 'utf8')),
                        key
                    );
                } catch (error) {
                    if (isNodeError(error, 'ENOENT')) {
                        snapshotChanged = true;
                        break;
                    }
                    if (error instanceof PublisherError) throw error;
                    throw new PublisherError(
                        'concurrency',
                        'Invalid local pointer lock record',
                        { cause: error, context: { key } }
                    );
                }
                if (basename(this.lockRecordPath(path, record)) !== entry) {
                    throw new PublisherError(
                        'concurrency',
                        'Local pointer lock filename does not match record',
                        { context: { key } }
                    );
                }
                const ownerPath = `${recordPath}.owner`;
                if (!this.isProcessAlive(record.pid)) {
                    await this.unlinkIfPresent(recordPath);
                    await this.unlinkIfPresent(ownerPath);
                    removedStaleRecord = true;
                    continue;
                }
                active.push({ path: recordPath, ownerPath, record });
            }
            if (removedStaleRecord) {
                await this.flushDirectory(directory, key);
            }
            if (snapshotChanged) {
                continue;
            }
            return active;
        }
    }

    private isProcessAlive(pid: number): boolean {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return !isNodeError(error, 'ESRCH');
        }
    }

    private async releaseLock(lock: PointerLock, key: string): Promise<void> {
        let record: PointerLockRecord;
        try {
            record = parsePointerLockRecord(
                JSON.parse(await readFile(lock.claimPath, 'utf8')),
                key
            );
        } catch (error) {
            if (error instanceof PublisherError) throw error;
            throw new PublisherError(
                'concurrency',
                'Unable to validate local pointer lock ownership',
                { cause: error, context: { key } }
            );
        }
        if (record.token !== lock.record.token || record.pid !== process.pid) {
            throw new PublisherError(
                'concurrency',
                'Local pointer lock ownership changed unexpectedly',
                { context: { key } }
            );
        }
        try {
            await unlink(lock.claimPath);
        } finally {
            await this.unlinkIfPresent(lock.ownerPath);
            await this.flushDirectory(dirname(lock.claimPath), key);
        }
    }

    private async unlinkIfPresent(path: string): Promise<void> {
        try {
            await unlink(path);
        } catch (error) {
            if (!isNodeError(error, 'ENOENT')) throw error;
        }
    }

    private async fileExists(path: string): Promise<boolean> {
        try {
            await access(path);
            return true;
        } catch (error) {
            if (isNodeError(error, 'ENOENT')) return false;
            throw error;
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
