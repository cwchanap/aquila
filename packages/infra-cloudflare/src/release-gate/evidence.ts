import { createHash } from 'node:crypto';
import { constants, realpathSync, statSync } from 'node:fs';
import { open, type FileHandle } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
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

/**
 * Resolves an evidence artifact only after proving that both its lexical path
 * and its canonical filesystem path remain under the configured evidence
 * directory. The returned value is internal-only and must not be rendered.
 */
export function resolveEvidencePath(
    root: string,
    relativePath: string
): string {
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
    let fileStats;
    try {
        fileStats = statSync(realPath);
    } catch {
        throw gateInputError(
            'evidence/path-missing',
            'Evidence file does not exist'
        );
    }
    if (!fileStats.isFile()) {
        throw gateInputError(
            'evidence/path-not-regular-file',
            'Evidence path must resolve to a regular file'
        );
    }
    return realPath;
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
        if (!(await handle.stat()).isFile()) {
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

async function hashJsonEvidence(path: string): Promise<string> {
    let parsed: unknown;
    try {
        parsed = JSON.parse((await readEvidenceFile(path)).toString('utf8'));
    } catch (cause) {
        if (cause instanceof GateEvidenceError) throw cause;
        throw gateInputError(
            'evidence/json-invalid',
            'Evidence JSON is invalid'
        );
    }

    try {
        return hashCanonicalEvidence(parsed);
    } catch {
        throw gateInputError(
            'evidence/json-invalid',
            'Evidence JSON is invalid'
        );
    }
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
    const path = resolveEvidencePath(evidenceDirectory, parsedInput.path);
    const sha256 =
        parsedInput.mediaType === 'application/json'
            ? await hashJsonEvidence(path)
            : await hashEvidenceFile(path);

    return parseGateEvidenceReferenceV1({ ...parsedInput, sha256 });
}
