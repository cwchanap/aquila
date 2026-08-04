import { createHash } from 'node:crypto';
import {
    constants,
    fstatSync,
    readFile as readFileFromDescriptor,
    realpathSync,
    statSync,
    type Stats,
} from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
// @ts-expect-error Bun provides this builtin at runtime; Vitest supplies its mock.
import { dlopen, FFIType, ptr } from 'bun:ffi';
import {
    canonicalJson,
    isSafeRelativePath,
    type JsonValue,
} from '@aquila/stories/runtime-assets';
import {
    parseGateEvidenceReferenceV1,
    type GateEvidenceReferenceV1,
} from './schemas';

const REFERENCE_DIGEST_PLACEHOLDER = '0'.repeat(64);

export const EVIDENCE_MEDIA_TYPES = [
    'application/json',
    'application/zip',
    'image/png',
] as const;

export type EvidenceMediaType = (typeof EVIDENCE_MEDIA_TYPES)[number];

export type GateEvidenceErrorCode =
    | 'evidence/path-outside-root'
    | 'evidence/path-absolute'
    | 'evidence/path-invalid'
    | 'evidence/root-unavailable'
    | 'evidence/path-missing'
    | 'evidence/path-not-regular-file'
    | 'evidence/media-type-unsupported'
    | 'evidence/json-invalid';

export class GateEvidenceError extends Error {
    constructor(
        readonly code: GateEvidenceErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'GateEvidenceError';
    }
}

export function gateInputError(
    code: GateEvidenceErrorCode,
    message: string
): GateEvidenceError {
    return new GateEvidenceError(code, message);
}

export type CreateEvidenceReferenceInputV1 = Omit<
    GateEvidenceReferenceV1,
    'sha256'
>;

export type ValidatedJsonEvidenceV1 = {
    reference: GateEvidenceReferenceV1;
    value: unknown;
};

interface EvidenceFileIdentity {
    device: number;
    inode: number;
}

interface NativeDescriptorSymbols {
    close(descriptor: number): number;
    openat(directoryDescriptor: number, path: number, flags: number): number;
}

interface NativeDescriptorLibrary {
    symbols: NativeDescriptorSymbols;
}

interface NativeDescriptorApi {
    close(descriptor: number): void;
    currentWorkingDirectoryDescriptor: number;
    openAt(directoryDescriptor: number, path: string, flags: number): number;
}

function createNativeDescriptorApi(): NativeDescriptorApi | undefined {
    const currentWorkingDirectoryDescriptor =
        process.platform === 'darwin'
            ? -2
            : process.platform === 'linux'
              ? -100
              : undefined;
    const libraryPath =
        process.platform === 'darwin'
            ? '/usr/lib/libSystem.B.dylib'
            : process.platform === 'linux'
              ? 'libc.so.6'
              : undefined;
    if (
        currentWorkingDirectoryDescriptor === undefined ||
        libraryPath === undefined
    ) {
        return undefined;
    }

    try {
        const library = dlopen(libraryPath, {
            close: { args: [FFIType.i32], returns: FFIType.i32 },
            openat: {
                args: [FFIType.i32, FFIType.ptr, FFIType.i32],
                returns: FFIType.i32,
            },
        }) as NativeDescriptorLibrary;
        return {
            close(descriptor: number): void {
                library.symbols.close(descriptor);
            },
            currentWorkingDirectoryDescriptor,
            openAt(
                directoryDescriptor: number,
                path: string,
                flags: number
            ): number {
                const encodedPath = Buffer.from(`${path}\0`);
                return library.symbols.openat(
                    directoryDescriptor,
                    ptr(encodedPath),
                    flags
                );
            },
        };
    } catch {
        return undefined;
    }
}

const nativeDescriptorApi = createNativeDescriptorApi();

function evidenceFileIdentity(
    stats: Pick<Stats, 'dev' | 'ino'>
): EvidenceFileIdentity {
    if (
        !Number.isSafeInteger(stats.dev) ||
        !Number.isSafeInteger(stats.ino) ||
        stats.dev <= 0 ||
        stats.ino <= 0
    ) {
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path cannot be read safely'
        );
    }
    return { device: stats.dev, inode: stats.ino };
}

function assertEvidenceFileIdentity(
    expected: EvidenceFileIdentity,
    actual: Pick<Stats, 'dev' | 'ino'>
): void {
    const actualIdentity = evidenceFileIdentity(actual);
    if (
        actualIdentity.device !== expected.device ||
        actualIdentity.inode !== expected.inode
    ) {
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path changed after validation'
        );
    }
}

function isPathWithin(root: string, candidate: string): boolean {
    return candidate.startsWith(`${root}${sep}`);
}

function resolveEvidenceRoot(root: string): string {
    try {
        const realRoot = realpathSync(resolve(root));
        if (!statSync(realRoot).isDirectory()) {
            throw gateInputError(
                'evidence/root-unavailable',
                'Evidence directory is unavailable'
            );
        }
        return realRoot;
    } catch (cause) {
        if (cause instanceof GateEvidenceError) throw cause;
        throw gateInputError(
            'evidence/root-unavailable',
            'Evidence directory is unavailable'
        );
    }
}

function assertSupportedEvidenceMediaType(
    mediaType: string
): asserts mediaType is EvidenceMediaType {
    if (!(EVIDENCE_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
        throw gateInputError(
            'evidence/media-type-unsupported',
            'Unsupported evidence media type'
        );
    }
}

interface ValidatedEvidencePath {
    absoluteRoot: string;
    realPath: string;
}

interface OpenedEvidenceFile {
    descriptor: number;
    identity: EvidenceFileIdentity;
    path: string;
}

function validateEvidencePath(
    root: string,
    relativePath: string
): ValidatedEvidencePath {
    if (isAbsolute(relativePath)) {
        throw gateInputError(
            'evidence/path-absolute',
            'Evidence path must be relative to the evidence directory'
        );
    }

    const absoluteRoot = resolveEvidenceRoot(root);
    const absolutePath = resolve(absoluteRoot, relativePath);
    if (!isPathWithin(absoluteRoot, absolutePath)) {
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path is outside evidence directory'
        );
    }
    if (!isSafeRelativePath(relativePath)) {
        throw gateInputError(
            'evidence/path-invalid',
            'Evidence path must be a safe relative path'
        );
    }

    let realPath: string;
    try {
        realPath = realpathSync(absolutePath);
    } catch {
        throw gateInputError(
            'evidence/path-missing',
            'Evidence file does not exist'
        );
    }
    if (!isPathWithin(absoluteRoot, realPath)) {
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path is outside evidence directory'
        );
    }
    return { absoluteRoot, realPath };
}

function evidenceOpenFlags(directory: boolean): number {
    const noFollow = constants.O_NOFOLLOW;
    const nonBlocking = constants.O_NONBLOCK;
    const directoryOnly = constants.O_DIRECTORY;
    if (
        !Number.isInteger(noFollow) ||
        noFollow === 0 ||
        !Number.isInteger(nonBlocking) ||
        !Number.isInteger(directoryOnly) ||
        directoryOnly === 0
    ) {
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path cannot be read safely'
        );
    }
    return (
        constants.O_RDONLY |
        noFollow |
        nonBlocking |
        (directory ? directoryOnly : 0)
    );
}

function closeEvidenceDescriptor(descriptor: number): void {
    try {
        nativeDescriptorApi?.close(descriptor);
    } catch {
        // Closing an already-bound descriptor cannot make a rejected path safe.
    }
}

function openEvidenceDescriptor(root: string, relativePath: string): number {
    const native = nativeDescriptorApi;
    if (native === undefined) {
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path cannot be read safely'
        );
    }

    const directoryDescriptors: number[] = [];
    try {
        const directoryFlags = evidenceOpenFlags(true);
        const fileFlags = evidenceOpenFlags(false);
        let currentDirectoryDescriptor = native.openAt(
            native.currentWorkingDirectoryDescriptor,
            sep,
            directoryFlags
        );
        if (currentDirectoryDescriptor < 0) {
            throw gateInputError(
                'evidence/path-outside-root',
                'Evidence path cannot be read safely'
            );
        }
        directoryDescriptors.push(currentDirectoryDescriptor);

        for (const segment of root.split(sep).filter(Boolean)) {
            const directoryDescriptor = native.openAt(
                currentDirectoryDescriptor,
                segment,
                directoryFlags
            );
            if (directoryDescriptor < 0) {
                throw gateInputError(
                    'evidence/path-outside-root',
                    'Evidence path cannot be read safely'
                );
            }
            directoryDescriptors.push(directoryDescriptor);
            currentDirectoryDescriptor = directoryDescriptor;
        }

        const pathSegments = relativePath.split('/');
        for (const segment of pathSegments.slice(0, -1)) {
            const directoryDescriptor = native.openAt(
                currentDirectoryDescriptor,
                segment,
                directoryFlags
            );
            if (directoryDescriptor < 0) {
                throw gateInputError(
                    'evidence/path-outside-root',
                    'Evidence path cannot be read safely'
                );
            }
            directoryDescriptors.push(directoryDescriptor);
            currentDirectoryDescriptor = directoryDescriptor;
        }

        const finalSegment = pathSegments.at(-1);
        if (finalSegment === undefined) {
            throw gateInputError(
                'evidence/path-invalid',
                'Evidence path must be a safe relative path'
            );
        }
        const fileDescriptor = native.openAt(
            currentDirectoryDescriptor,
            finalSegment,
            fileFlags
        );
        if (fileDescriptor < 0) {
            throw gateInputError(
                'evidence/path-outside-root',
                'Evidence path cannot be read safely'
            );
        }
        return fileDescriptor;
    } catch (cause) {
        if (cause instanceof GateEvidenceError) throw cause;
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path cannot be read safely'
        );
    } finally {
        for (const descriptor of directoryDescriptors) {
            closeEvidenceDescriptor(descriptor);
        }
    }
}

function openValidatedEvidenceFile(
    root: string,
    relativePath: string
): OpenedEvidenceFile {
    const { absoluteRoot, realPath } = validateEvidencePath(root, relativePath);
    let descriptor: number | undefined;
    try {
        descriptor = openEvidenceDescriptor(absoluteRoot, relativePath);
        const stats = fstatSync(descriptor);
        if (!stats.isFile()) {
            throw gateInputError(
                'evidence/path-not-regular-file',
                'Evidence path must resolve to a regular file'
            );
        }
        return {
            descriptor,
            identity: evidenceFileIdentity(stats),
            path: realPath,
        };
    } catch (cause) {
        if (descriptor !== undefined) closeEvidenceDescriptor(descriptor);
        if (cause instanceof GateEvidenceError) throw cause;
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path cannot be read safely'
        );
    }
}

/**
 * Resolves an evidence artifact only after proving that both its lexical path
 * and its canonical filesystem path remain under the configured evidence
 * directory, then opening each component through a no-follow descriptor.
 * Nested regular paths are supported; symlink components, including in-root
 * aliases, are intentionally rejected. The returned value is internal-only
 * and must not be rendered.
 */
export function resolveEvidencePath(
    root: string,
    relativePath: string
): string {
    const evidenceFile = openValidatedEvidenceFile(root, relativePath);
    try {
        return evidenceFile.path;
    } finally {
        closeEvidenceDescriptor(evidenceFile.descriptor);
    }
}

export function hashCanonicalEvidence(value: unknown): string {
    return createHash('sha256')
        .update(canonicalJson(value as JsonValue))
        .digest('hex');
}

async function readEvidenceFile(path: string): Promise<Buffer> {
    let handle: FileHandle | undefined;
    try {
        const noFollow = constants.O_NOFOLLOW;
        if (!Number.isInteger(noFollow) || noFollow === 0) {
            throw gateInputError(
                'evidence/path-outside-root',
                'Evidence path cannot be read safely'
            );
        }
        handle = await open(
            path,
            constants.O_RDONLY | noFollow | constants.O_NONBLOCK
        );
        const stats = await handle.stat();
        if (!stats.isFile()) {
            throw gateInputError(
                'evidence/path-not-regular-file',
                'Evidence path must resolve to a regular file'
            );
        }
        return await handle.readFile();
    } catch (cause) {
        if (cause instanceof GateEvidenceError) throw cause;
        const code = (cause as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            throw gateInputError(
                'evidence/path-missing',
                'Evidence file does not exist'
            );
        }
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path is outside evidence directory'
        );
    } finally {
        await handle?.close();
    }
}

export async function hashEvidenceFile(path: string): Promise<string> {
    const bytes = await readEvidenceFile(path);
    return createHash('sha256').update(bytes).digest('hex');
}

function readDescriptorFile(descriptor: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        readFileFromDescriptor(descriptor, (error, data) => {
            if (error !== null) {
                reject(error);
                return;
            }
            resolve(data);
        });
    });
}

async function readOpenedEvidenceFile(
    descriptor: number,
    expectedIdentity: EvidenceFileIdentity
): Promise<Buffer> {
    try {
        const stats = fstatSync(descriptor);
        if (!stats.isFile()) {
            throw gateInputError(
                'evidence/path-not-regular-file',
                'Evidence path must resolve to a regular file'
            );
        }
        assertEvidenceFileIdentity(expectedIdentity, stats);
        return await readDescriptorFile(descriptor);
    } catch (cause) {
        if (cause instanceof GateEvidenceError) throw cause;
        throw gateInputError(
            'evidence/path-outside-root',
            'Evidence path cannot be read safely'
        );
    }
}

async function hashValidatedEvidenceFile(
    descriptor: number,
    expectedIdentity: EvidenceFileIdentity
): Promise<string> {
    const bytes = await readOpenedEvidenceFile(descriptor, expectedIdentity);
    return createHash('sha256').update(bytes).digest('hex');
}

async function readValidatedJsonValue(
    descriptor: number,
    expectedIdentity: EvidenceFileIdentity
): Promise<{ value: unknown; sha256: string }> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(
            (
                await readOpenedEvidenceFile(descriptor, expectedIdentity)
            ).toString('utf8')
        );
    } catch (cause) {
        if (cause instanceof GateEvidenceError) throw cause;
        throw gateInputError(
            'evidence/json-invalid',
            'Evidence JSON is invalid'
        );
    }

    try {
        return { value: parsed, sha256: hashCanonicalEvidence(parsed) };
    } catch {
        throw gateInputError(
            'evidence/json-invalid',
            'Evidence JSON is invalid'
        );
    }
}

async function readValidatedJsonEvidenceFromParsedInput(
    evidenceDirectory: string,
    parsedInput: GateEvidenceReferenceV1
): Promise<ValidatedJsonEvidenceV1> {
    if (parsedInput.mediaType !== 'application/json') {
        throw gateInputError(
            'evidence/media-type-unsupported',
            'JSON evidence reader requires application/json'
        );
    }
    const evidenceFile = openValidatedEvidenceFile(
        evidenceDirectory,
        parsedInput.path
    );
    try {
        const { value, sha256 } = await readValidatedJsonValue(
            evidenceFile.descriptor,
            evidenceFile.identity
        );
        return {
            reference: parseGateEvidenceReferenceV1({
                ...parsedInput,
                sha256,
            }),
            value,
        };
    } finally {
        closeEvidenceDescriptor(evidenceFile.descriptor);
    }
}

/**
 * Reads a JSON evidence artifact through its validated no-follow descriptor,
 * then returns both the parsed value and the digest reference derived from
 * those exact bytes. Consumers that need semantics must retain this value
 * rather than reopening the filesystem path after digest validation.
 */
export async function readValidatedJsonEvidence(
    evidenceDirectory: string,
    input: CreateEvidenceReferenceInputV1
): Promise<ValidatedJsonEvidenceV1> {
    const parsedInput = parseGateEvidenceReferenceV1({
        ...input,
        sha256: REFERENCE_DIGEST_PLACEHOLDER,
    });
    assertSupportedEvidenceMediaType(parsedInput.mediaType);
    return readValidatedJsonEvidenceFromParsedInput(
        evidenceDirectory,
        parsedInput
    );
}

/**
 * Creates a validated retained-evidence reference. JSON documents are hashed
 * from their parsed canonical representation; opaque trace and screenshot
 * artifacts retain a byte-for-byte digest.
 */
export async function createEvidenceReference(
    evidenceDirectory: string,
    input: CreateEvidenceReferenceInputV1
): Promise<GateEvidenceReferenceV1> {
    const parsedInput = parseGateEvidenceReferenceV1({
        ...input,
        sha256: REFERENCE_DIGEST_PLACEHOLDER,
    });
    assertSupportedEvidenceMediaType(parsedInput.mediaType);
    if (parsedInput.mediaType === 'application/json') {
        return (
            await readValidatedJsonEvidenceFromParsedInput(
                evidenceDirectory,
                parsedInput
            )
        ).reference;
    }
    const evidenceFile = openValidatedEvidenceFile(
        evidenceDirectory,
        parsedInput.path
    );
    try {
        const sha256 = await hashValidatedEvidenceFile(
            evidenceFile.descriptor,
            evidenceFile.identity
        );

        return parseGateEvidenceReferenceV1({ ...parsedInput, sha256 });
    } finally {
        closeEvidenceDescriptor(evidenceFile.descriptor);
    }
}
