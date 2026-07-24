import { AssetResolverError } from './errors';
import type {
    AssetFormat,
    LogicalAssetIdentity,
    PublicationTarget,
} from './schemas';

const STORY_ID_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const RELEASE_ID_RE = /^sha256-[a-f0-9]{64}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const PREVIEW_ID_RE = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
const RELATIVE_PATH_RE = /^[A-Za-z0-9._/-]+$/;

function hasUnsafeSegments(value: string): boolean {
    const segments = value.split('/');
    return (
        segments.some(
            segment => segment === '' || segment === '.' || segment === '..'
        ) ||
        value.startsWith('/') ||
        value.endsWith('/')
    );
}

function hasControlCharacters(value: string): boolean {
    return [...value].some(character => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 0x1f || codePoint === 0x7f;
    });
}

export function isStoryId(value: string): boolean {
    return STORY_ID_RE.test(value);
}

export function isReleaseId(value: string): boolean {
    return RELEASE_ID_RE.test(value);
}

export function isSha256(value: string): boolean {
    return SHA256_RE.test(value);
}

export function isPreviewId(value: string): boolean {
    return PREVIEW_ID_RE.test(value);
}

export function isSafeLogicalKey(value: string): boolean {
    return (
        value.length > 0 &&
        value.length <= 512 &&
        value === value.normalize('NFC') &&
        !hasUnsafeSegments(value) &&
        !value.includes('\\') &&
        !hasControlCharacters(value)
    );
}

export function isSafeRelativePath(value: string): boolean {
    return (
        value.length > 0 &&
        value.length <= 1024 &&
        RELATIVE_PATH_RE.test(value) &&
        !hasUnsafeSegments(value) &&
        !value.includes('\\')
    );
}

export function qualifyAssetIdentity(identity: LogicalAssetIdentity): string {
    return `${identity.type}:${identity.key.normalize('NFC')}`;
}

export function compareQualifiedAssetIds(left: string, right: string): number {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

export function encodeLogicalAssetIdentity(
    identity: LogicalAssetIdentity
): string {
    if (!isSafeLogicalKey(identity.key)) {
        throw new AssetResolverError(
            'unsafe-path',
            `Unsafe logical asset key: ${identity.key}`
        );
    }
    const encodedKey = identity.key
        .normalize('NFC')
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');
    return `${identity.type}/${encodedKey}`;
}

export function getObjectPath(sha256: string, format: AssetFormat): string {
    if (!isSha256(sha256)) {
        throw new AssetResolverError('integrity', 'Invalid SHA-256 digest');
    }
    if (format !== 'webp' && format !== 'avif') {
        throw new AssetResolverError(
            'unsafe-path',
            `Unsupported asset format: ${format}`
        );
    }
    return `vn/objects/${sha256}.${format}`;
}

export function getReleaseManifestPath(
    storyId: string,
    releaseId: string,
    target: PublicationTarget
): string {
    assertPublicationIdentifiers(storyId, releaseId, target);
    const prefix =
        target.kind === 'production' ? 'vn' : `vn/previews/${target.previewId}`;
    return `${prefix}/stories/${storyId}/releases/${releaseId}/runtime-manifest.json`;
}

export function getCurrentPointerPath(
    storyId: string,
    target: PublicationTarget
): string {
    if (!isStoryId(storyId)) {
        throw new AssetResolverError(
            'unsafe-path',
            `Invalid story id: ${storyId}`
        );
    }
    if (target.kind === 'preview' && !isPreviewId(target.previewId)) {
        throw new AssetResolverError(
            'unsafe-path',
            `Invalid preview id: ${target.previewId}`
        );
    }
    const prefix =
        target.kind === 'production' ? 'vn' : `vn/previews/${target.previewId}`;
    return `${prefix}/stories/${storyId}/current.json`;
}

function assertPublicationIdentifiers(
    storyId: string,
    releaseId: string,
    target: PublicationTarget
): void {
    if (!isStoryId(storyId) || !isReleaseId(releaseId)) {
        throw new AssetResolverError(
            'unsafe-path',
            'Invalid story or release identifier'
        );
    }
    if (target.kind === 'preview' && !isPreviewId(target.previewId)) {
        throw new AssetResolverError(
            'unsafe-path',
            `Invalid preview id: ${target.previewId}`
        );
    }
}

export function resolveAssetUrl(baseUrl: string, relativePath: string): URL {
    if (!isSafeRelativePath(relativePath)) {
        throw new AssetResolverError(
            'unsafe-path',
            `Unsafe manifest path: ${relativePath}`
        );
    }

    let base: URL;
    try {
        base = new URL(baseUrl);
    } catch (cause) {
        throw new AssetResolverError('unsafe-path', 'Invalid asset base URL', {
            cause,
        });
    }
    if (
        !['http:', 'https:'].includes(base.protocol) ||
        base.username !== '' ||
        base.password !== '' ||
        base.search !== '' ||
        base.hash !== ''
    ) {
        throw new AssetResolverError(
            'unsafe-path',
            'Asset base URL must be credential-free HTTP(S) without query or fragment'
        );
    }
    if (!base.pathname.endsWith('/')) base.pathname += '/';
    return new URL(relativePath, base);
}
