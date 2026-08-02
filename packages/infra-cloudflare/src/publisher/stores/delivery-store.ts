export interface StoredObjectMetadata {
    key: string;
    etag: string;
    byteLength: number;
    contentType: string;
    cacheControl: string;
    customMetadata: Readonly<Record<string, string>>;
}

export interface StoredObject extends StoredObjectMetadata {
    bytes: Uint8Array;
}

export type PointerSnapshot =
    | { exists: false }
    | {
          exists: true;
          etag: string;
          bytes: Uint8Array;
          contentType: string;
          cacheControl: string;
      };

export interface ImmutableCreateRequest {
    key: string;
    bytes: Uint8Array;
    contentType: string;
    cacheControl: string;
    customMetadata?: Readonly<Record<string, string>>;
}

export interface PointerWriteRequest {
    key: string;
    expected: { exists: false } | { exists: true; etag: string };
    bytes: Uint8Array;
    contentType: string;
    cacheControl: string;
    customMetadata?: Readonly<Record<string, string>>;
}

export interface DeliveryStore {
    stat(key: string): Promise<StoredObjectMetadata | null>;
    read(key: string): Promise<StoredObject>;
    createImmutable(
        request: ImmutableCreateRequest
    ): Promise<{ status: 'created' | 'already-exists' }>;
    /** Observational pointer read: must not recover, lock, or mutate storage. */
    inspectPointer(key: string): Promise<PointerSnapshot>;
    /** Recovery-capable coherent read used by activation and pointer mutation. */
    readPointer(key: string): Promise<PointerSnapshot>;
    compareAndSwapPointer(
        request: PointerWriteRequest
    ): Promise<{ status: 'written' | 'precondition-failed'; etag?: string }>;
    /** Enumerates raw keys without reading or trusting object metadata. */
    listKeys(prefix: string): AsyncIterable<string>;
    list(prefix: string): AsyncIterable<StoredObjectMetadata>;
    close(): Promise<void>;
}
