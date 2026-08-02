import sharp from 'sharp';
import {
    RUNTIME_ASSET_CACHE_POLICY,
    assertReleaseIdMatchesContentSha256,
    assertSha256,
    canonicalJson,
    canonicalReleaseContent,
    getObjectPath,
    getReleaseManifestPath,
    parseActiveReleasePointer,
    parseRuntimeAssetManifest,
    qualifyAssetIdentity,
    validatePointerManifestPair,
    type ActiveReleasePointerV1,
    type AssetFormat,
    type CoverageCounts,
    type ManifestByteSha256,
    type ObjectContentSha256,
    type PublicationTarget,
    type ReleaseContentSha256,
    type RuntimeAssetManifestV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import { sha256Bytes, sha256ManifestBytes, sha256ReleaseContent } from './hash';
import type { DeliveryStore, StoredObject } from './stores/delivery-store';
import type { PreparedRelease } from './types';

export type VerificationDepth = 'shallow' | 'deep';

const VERIFICATION_CONCURRENCY = 4;

export interface VerifyStoredReleaseOptions {
    readonly store: DeliveryStore;
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly depth?: VerificationDepth;
    readonly expectedManifestSha256?: ManifestByteSha256;
}

export interface VerifyPreparedReleaseOptions {
    readonly store: DeliveryStore;
    readonly preparedRelease: PreparedRelease;
    readonly depth?: VerificationDepth;
}

export interface VerifiedStoredRelease {
    readonly storyId: string;
    readonly target: PublicationTarget;
    readonly releaseId: string;
    readonly manifestPath: string;
    readonly manifest: RuntimeAssetManifestV1;
    readonly manifestBytes: Uint8Array;
    readonly manifestSha256: ManifestByteSha256;
    readonly releaseContentSha256: ReleaseContentSha256;
    /**
     * A deterministic, schema-valid template. Activation replaces publishedAt
     * with its monotonic timestamp immediately before validating and writing.
     */
    readonly pointerCandidate: ActiveReleasePointerV1;
    readonly validatePointer: (pointer: ActiveReleasePointerV1) => void;
}

interface ManifestObjectReference {
    readonly identity: string;
    readonly format: AssetFormat;
    readonly path: string;
    readonly sha256: string;
    readonly byteLength: number;
    readonly width: number;
    readonly height: number;
}

const JSON_CONTENT_TYPE = 'application/json';
const POINTER_TEMPLATE_TIMESTAMP = '1970-01-01T00:00:00.000Z';
const SANITIZED_DELIVERY_STORE_CAUSE = Object.freeze({
    classification: 'delivery-store-read-failure' as const,
});
const COVERAGE_COUNT_KEYS = [
    'total',
    'included',
    'omitted',
    'unclassified',
] as const;
const textDecoder = new TextDecoder('utf-8', { fatal: true });
const textEncoder = new TextEncoder();

function integrityError(
    message: string,
    context: Readonly<Record<string, unknown>>,
    cause?: unknown
): PublisherError {
    return new PublisherError('integrity', message, { context, cause });
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.byteLength !== right.byteLength) return false;
    return left.every((byte, index) => byte === right[index]);
}

async function readStoredObject(
    store: DeliveryStore,
    key: string
): Promise<StoredObject> {
    try {
        return await store.read(key);
    } catch {
        throw new PublisherError(
            'storage',
            'Unable to read stored candidate object',
            {
                context: { stage: 'verification', key },
                cause: SANITIZED_DELIVERY_STORE_CAUSE,
            }
        );
    }
}

function assertStoredMetadata(
    object: StoredObject,
    expected: {
        key: string;
        contentType: string;
        cacheControl: string;
    },
    objectClass: 'manifest' | 'asset'
): void {
    const context = { stage: 'verification', key: expected.key, objectClass };
    if (object.key !== expected.key) {
        throw integrityError(
            'Stored object key does not match its request',
            context
        );
    }
    if (object.byteLength !== object.bytes.byteLength) {
        throw integrityError(
            'Stored object byte length metadata does not match its body',
            context
        );
    }
    if (object.contentType !== expected.contentType) {
        throw integrityError('Stored object content type is invalid', context);
    }
    if (object.cacheControl !== expected.cacheControl) {
        throw integrityError('Stored object cache control is invalid', context);
    }
}

function parseManifestBytes(
    bytes: Uint8Array,
    manifestPath: string
): RuntimeAssetManifestV1 {
    let input: unknown;
    try {
        input = JSON.parse(textDecoder.decode(bytes));
    } catch (cause) {
        throw integrityError(
            'Stored release manifest is not valid UTF-8 JSON',
            { stage: 'verification', key: manifestPath },
            cause
        );
    }
    try {
        return parseRuntimeAssetManifest(input);
    } catch (cause) {
        throw integrityError(
            'Stored release manifest failed runtime validation',
            { stage: 'verification', key: manifestPath },
            cause
        );
    }
}

function variantReferences(
    manifest: RuntimeAssetManifestV1
): ManifestObjectReference[] {
    const references: ManifestObjectReference[] = [];
    let backgroundCount = 0;

    for (const asset of manifest.assets) {
        const identity = qualifyAssetIdentity(asset.identity);
        if (asset.placeholder !== undefined) {
            throw integrityError(
                'Runtime asset placeholders are not allowed by publisher policy V1',
                { stage: 'verification', identity }
            );
        }
        if (asset.variants.webp === undefined) {
            throw integrityError(
                'Every runtime asset requires a WebP variant',
                {
                    stage: 'verification',
                    identity,
                }
            );
        }
        if (asset.identity.type === 'background') {
            backgroundCount += 1;
            if (asset.variants.avif === undefined) {
                throw integrityError(
                    'Every background requires an AVIF variant under publisher policy V1',
                    { stage: 'verification', identity }
                );
            }
        } else if (asset.variants.avif !== undefined) {
            throw integrityError(
                'Portrait assets must not contain AVIF under publisher policy V1',
                { stage: 'verification', identity }
            );
        }

        const variants = [asset.variants.webp, asset.variants.avif].filter(
            variant => variant !== undefined
        );
        for (const variant of variants) {
            const sha256 = assertSha256<'object-content'>(variant.sha256);
            const expectedPath = getObjectPath(sha256, variant.format);
            if (variant.path !== expectedPath) {
                throw integrityError(
                    'Runtime asset object path does not match its digest and format',
                    { stage: 'verification', identity, key: variant.path }
                );
            }
            references.push({
                identity,
                format: variant.format,
                path: variant.path,
                sha256,
                byteLength: variant.byteLength,
                width: asset.width,
                height: asset.height,
            });
        }
    }

    if (backgroundCount === 0) {
        throw integrityError(
            'A stored release must contain at least one background',
            { stage: 'verification' }
        );
    }
    return references;
}

function expectedImageContentType(format: AssetFormat): string {
    return format === 'webp' ? 'image/webp' : 'image/avif';
}

function assertDecodedFormat(
    format: AssetFormat,
    metadata: sharp.Metadata,
    key: string
): void {
    const matches =
        format === 'webp'
            ? metadata.format === 'webp'
            : metadata.format === 'heif' && metadata.compression === 'av1';
    if (!matches) {
        throw integrityError('Stored object encoded format is invalid', {
            stage: 'verification',
            key,
            expectedFormat: format,
        });
    }
}

async function decodeStoredObject(
    object: StoredObject,
    format: AssetFormat
): Promise<{ width: number; height: number }> {
    try {
        const metadata = await sharp(object.bytes, {
            failOn: 'warning',
            animated: false,
        }).metadata();
        assertDecodedFormat(format, metadata, object.key);
        const decoded = await sharp(object.bytes, {
            failOn: 'warning',
            animated: false,
        })
            .raw()
            .toBuffer({ resolveWithObject: true });
        return { width: decoded.info.width, height: decoded.info.height };
    } catch (cause) {
        if (cause instanceof PublisherError) throw cause;
        throw integrityError(
            'Stored image object could not be decoded',
            { stage: 'verification', key: object.key },
            cause
        );
    }
}

async function verifyObjectGroup(
    store: DeliveryStore,
    references: readonly ManifestObjectReference[]
): Promise<void> {
    const first = references[0];
    if (first === undefined) return;
    const digest: ObjectContentSha256 = assertSha256<'object-content'>(
        first.sha256
    );
    const expectedPath = getObjectPath(digest, first.format);
    const context = { stage: 'verification', key: expectedPath };

    for (const reference of references) {
        const referenceDigest = assertSha256<'object-content'>(
            reference.sha256
        );
        if (
            reference.format !== first.format ||
            referenceDigest !== digest ||
            reference.path !== expectedPath
        ) {
            throw integrityError(
                'Shared object references contain inconsistent path metadata',
                { ...context, identity: reference.identity }
            );
        }
    }

    const object = await readStoredObject(store, expectedPath);
    assertStoredMetadata(
        object,
        {
            key: expectedPath,
            contentType: expectedImageContentType(first.format),
            cacheControl:
                RUNTIME_ASSET_CACHE_POLICY.immutableRelease
                    .responseCacheControl,
        },
        'asset'
    );
    if (sha256Bytes(object.bytes) !== digest) {
        throw integrityError(
            'Stored object body does not match its SHA-256',
            context
        );
    }
    const decoded = await decodeStoredObject(object, first.format);

    for (const reference of references) {
        if (reference.byteLength !== object.byteLength) {
            throw integrityError(
                'Manifest object byte length does not match stored metadata',
                { ...context, identity: reference.identity }
            );
        }
        if (
            reference.width !== decoded.width ||
            reference.height !== decoded.height
        ) {
            throw integrityError(
                'Decoded object dimensions do not match the manifest reference',
                { ...context, identity: reference.identity }
            );
        }
    }
}

async function verifyObjects(
    store: DeliveryStore,
    references: readonly ManifestObjectReference[]
): Promise<void> {
    const groups = new Map<string, ManifestObjectReference[]>();
    for (const reference of references) {
        const key = `${reference.format}:${reference.sha256}`;
        const group = groups.get(key);
        if (group === undefined) groups.set(key, [reference]);
        else group.push(reference);
    }
    const groupList = [...groups.values()];
    let nextIndex = 0;
    const workers = Array.from(
        { length: Math.min(VERIFICATION_CONCURRENCY, groupList.length) },
        async () => {
            while (nextIndex < groupList.length) {
                const index = nextIndex;
                nextIndex += 1;
                await verifyObjectGroup(store, groupList[index]);
            }
        }
    );
    await Promise.all(workers);
}

export async function verifyStoredRelease(
    options: VerifyStoredReleaseOptions
): Promise<VerifiedStoredRelease> {
    const manifestPath = getReleaseManifestPath(
        options.storyId,
        options.releaseId,
        options.target
    );
    const storedManifest = await readStoredObject(options.store, manifestPath);
    assertStoredMetadata(
        storedManifest,
        {
            key: manifestPath,
            contentType: JSON_CONTENT_TYPE,
            cacheControl:
                RUNTIME_ASSET_CACHE_POLICY.immutableRelease
                    .responseCacheControl,
        },
        'manifest'
    );

    const manifestSha256 = sha256ManifestBytes(storedManifest.bytes);
    if (
        options.expectedManifestSha256 !== undefined &&
        manifestSha256 !== options.expectedManifestSha256
    ) {
        throw integrityError(
            'Stored manifest bytes do not match the expected checksum',
            { stage: 'verification', key: manifestPath }
        );
    }

    const manifest = parseManifestBytes(storedManifest.bytes, manifestPath);
    if (manifest.storyId !== options.storyId) {
        throw integrityError(
            'Stored manifest story id does not match its path',
            {
                stage: 'verification',
                key: manifestPath,
            }
        );
    }
    if (manifest.releaseId !== options.releaseId) {
        throw integrityError(
            'Stored manifest release id does not match its path',
            {
                stage: 'verification',
                key: manifestPath,
            }
        );
    }

    const releaseContent = canonicalReleaseContent(manifest);
    const releaseContentSha256 = sha256ReleaseContent(releaseContent);
    try {
        assertReleaseIdMatchesContentSha256(manifest, releaseContentSha256);
    } catch (cause) {
        throw integrityError(
            'Stored manifest release identity is invalid',
            { stage: 'verification', key: manifestPath },
            cause
        );
    }

    const exactManifestBytes = textEncoder.encode(
        `${canonicalJson(manifest)}\n`
    );
    if (!bytesEqual(storedManifest.bytes, exactManifestBytes)) {
        throw integrityError(
            'Stored manifest body is not the exact canonical publisher encoding',
            { stage: 'verification', key: manifestPath }
        );
    }

    const references = variantReferences(manifest);
    if ((options.depth ?? 'deep') === 'deep') {
        await verifyObjects(options.store, references);
    }

    const pointerCandidate: ActiveReleasePointerV1 = {
        schemaVersion: 1,
        storyId: options.storyId,
        releaseId: options.releaseId,
        manifestPath,
        manifestSha256,
        publishedAt: POINTER_TEMPLATE_TIMESTAMP,
    };
    const validatePointer = (pointer: ActiveReleasePointerV1): void => {
        const parsed = parseActiveReleasePointer(
            pointer,
            options.target,
            options.storyId
        );
        validatePointerManifestPair(parsed, manifest, manifestSha256);
    };
    validatePointer(pointerCandidate);

    return {
        storyId: options.storyId,
        target: options.target,
        releaseId: options.releaseId,
        manifestPath,
        manifest,
        manifestBytes: Uint8Array.from(storedManifest.bytes),
        manifestSha256,
        releaseContentSha256,
        pointerCandidate,
        validatePointer,
    };
}

function preparedEvidenceError(
    code: 'coverage' | 'integrity',
    message: string
): PublisherError {
    return new PublisherError(code, message, {
        context: { stage: 'verification' },
    });
}

function assertCoverageCounts(counts: CoverageCounts): void {
    if (
        COVERAGE_COUNT_KEYS.some(
            key => !Number.isSafeInteger(counts[key]) || counts[key] < 0
        ) ||
        counts.total !== counts.included + counts.omitted + counts.unclassified
    ) {
        throw preparedEvidenceError(
            'coverage',
            'Prepared coverage evidence contains invalid counts'
        );
    }
}

function summedCounts(counts: readonly CoverageCounts[]): CoverageCounts {
    return counts.reduce<CoverageCounts>(
        (sum, current) => ({
            total: sum.total + current.total,
            included: sum.included + current.included,
            omitted: sum.omitted + current.omitted,
            unclassified: sum.unclassified + current.unclassified,
        }),
        { total: 0, included: 0, omitted: 0, unclassified: 0 }
    );
}

function countsEqual(left: CoverageCounts, right: CoverageCounts): boolean {
    return COVERAGE_COUNT_KEYS.every(key => left[key] === right[key]);
}

function validatePreparedCoverage(
    prepared: PreparedRelease,
    manifest: RuntimeAssetManifestV1
): void {
    const report = prepared.coverage;
    const typeCounts = [report.byType.background, report.byType.portrait];
    const sectionCounts = Object.values(report.bySection);
    for (const counts of [report.totals, ...typeCounts, ...sectionCounts]) {
        assertCoverageCounts(counts);
    }
    if (
        report.storyId !== prepared.storyId ||
        !countsEqual(summedCounts(typeCounts), report.totals) ||
        !countsEqual(summedCounts(sectionCounts), report.totals)
    ) {
        throw preparedEvidenceError(
            'coverage',
            'Prepared coverage evidence is internally inconsistent'
        );
    }

    const includedByType = { background: 0, portrait: 0 };
    const includedBySection = new Map<string, number>();
    for (const asset of manifest.assets) {
        includedByType[asset.identity.type] += 1;
        const section = asset.section ?? '_unassigned';
        includedBySection.set(
            section,
            (includedBySection.get(section) ?? 0) + 1
        );
    }
    const sectionNames = new Set([
        ...Object.keys(report.bySection),
        ...includedBySection.keys(),
    ]);
    const includedMatchesManifest =
        report.totals.included === manifest.assets.length &&
        report.byType.background.included === includedByType.background &&
        report.byType.portrait.included === includedByType.portrait &&
        [...sectionNames].every(
            section =>
                (report.bySection[section]?.included ?? 0) ===
                (includedBySection.get(section) ?? 0)
        );
    if (!includedMatchesManifest) {
        throw preparedEvidenceError(
            'coverage',
            'Prepared coverage evidence does not match the release manifest'
        );
    }
    if (
        prepared.target.kind === 'production' &&
        report.totals.unclassified !== 0
    ) {
        throw preparedEvidenceError(
            'coverage',
            'Production coverage evidence contains unclassified assets'
        );
    }
}

function validatePreparedEncodedAssets(
    prepared: PreparedRelease,
    manifest: RuntimeAssetManifestV1
): void {
    const manifestByIdentity = new Map(
        manifest.assets.map(asset => [
            qualifyAssetIdentity(asset.identity),
            asset,
        ])
    );
    const encodedByIdentity = new Map(
        prepared.encodedAssets.map(asset => [
            qualifyAssetIdentity(asset.identity),
            asset,
        ])
    );
    if (
        encodedByIdentity.size !== prepared.encodedAssets.length ||
        encodedByIdentity.size !== manifestByIdentity.size
    ) {
        throw preparedEvidenceError(
            'integrity',
            'Prepared encoded-asset evidence does not match the release manifest'
        );
    }

    for (const [identity, encoded] of encodedByIdentity) {
        const manifestAsset = manifestByIdentity.get(identity);
        if (
            manifestAsset === undefined ||
            manifestAsset.width !== encoded.width ||
            manifestAsset.height !== encoded.height
        ) {
            throw preparedEvidenceError(
                'integrity',
                'Prepared encoded-asset evidence does not match the release manifest'
            );
        }
        const manifestVariants = [
            manifestAsset.variants.webp,
            manifestAsset.variants.avif,
        ].filter(variant => variant !== undefined);
        const encodedVariants = new Map(
            encoded.variants.map(variant => [variant.format, variant])
        );
        if (
            encodedVariants.size !== encoded.variants.length ||
            encodedVariants.size !== manifestVariants.length
        ) {
            throw preparedEvidenceError(
                'integrity',
                'Prepared encoded-asset evidence does not match the release manifest'
            );
        }
        for (const variant of manifestVariants) {
            const encodedVariant = encodedVariants.get(variant.format);
            const expectedContentType = expectedImageContentType(
                variant.format
            );
            if (
                encodedVariant === undefined ||
                encodedVariant.path !== variant.path ||
                encodedVariant.sha256 !== variant.sha256 ||
                encodedVariant.byteLength !== variant.byteLength ||
                encodedVariant.byteLength !== encodedVariant.bytes.byteLength ||
                encodedVariant.contentType !== expectedContentType ||
                sha256Bytes(encodedVariant.bytes) !== variant.sha256
            ) {
                throw preparedEvidenceError(
                    'integrity',
                    'Prepared encoded-asset evidence does not match the release manifest'
                );
            }
        }
        if (
            encoded.identity.type === 'portrait' &&
            encoded.sourceHasAlpha &&
            !encoded.outputHasAlpha
        ) {
            throw preparedEvidenceError(
                'integrity',
                'Source-alpha portrait output failed alpha preservation'
            );
        }
    }
}

export async function verifyPreparedRelease(
    options: VerifyPreparedReleaseOptions
): Promise<VerifiedStoredRelease> {
    const prepared = options.preparedRelease;
    const verified = await verifyStoredRelease({
        store: options.store,
        storyId: prepared.storyId,
        target: prepared.target,
        releaseId: prepared.releaseId,
        depth: options.depth,
        expectedManifestSha256: prepared.manifestSha256,
    });
    if (!bytesEqual(verified.manifestBytes, prepared.manifestBytes)) {
        throw integrityError(
            'Stored manifest bytes do not match the prepared release',
            { stage: 'verification', key: verified.manifestPath }
        );
    }
    if (verified.releaseContentSha256 !== prepared.releaseContentSha256) {
        throw integrityError(
            'Stored release identity does not match the prepared release',
            { stage: 'verification', key: verified.manifestPath }
        );
    }
    validatePreparedEncodedAssets(prepared, verified.manifest);
    validatePreparedCoverage(prepared, verified.manifest);
    return verified;
}
