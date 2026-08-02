import {
    getObjectPath,
    isSafeRelativePath,
} from '@aquila/stories/runtime-assets';
import sharp from 'sharp';
import { ENCODER_POLICY_V1 } from './encoder-policy';
import { PublisherError } from './errors';
import { sha256Bytes } from './hash';
import type {
    EncodedAsset,
    EncodedVariant,
    EncoderFingerprintV1,
} from './types';

export interface EncodeAssetInput {
    identity: EncodedAsset['identity'];
    sourcePath: string;
    bytes: Uint8Array;
    authoringSection?: string;
    planSection?: string;
}

function maximumFor(identity: EncodedAsset['identity']) {
    return ENCODER_POLICY_V1[identity.type];
}

async function encodeVariant(
    base: sharp.Sharp,
    format: EncodedVariant['format']
): Promise<EncodedVariant> {
    const bytes =
        format === 'webp'
            ? await base.webp(ENCODER_POLICY_V1.webp).toBuffer()
            : await base.avif(ENCODER_POLICY_V1.avif).toBuffer();
    const sha256 = sha256Bytes(bytes);
    return {
        format,
        bytes,
        sha256,
        path: getObjectPath(sha256, format),
        byteLength: bytes.byteLength,
        contentType: format === 'webp' ? 'image/webp' : 'image/avif',
    };
}

export function getEncoderFingerprint(): EncoderFingerprintV1 {
    return {
        schemaVersion: 1,
        policyId: ENCODER_POLICY_V1.id,
        sharpVersion: sharp.versions.sharp,
        libvipsVersion: sharp.versions.vips,
        platform: process.platform,
        arch: process.arch,
    };
}

export async function encodeAsset(
    input: EncodeAssetInput
): Promise<EncodedAsset> {
    if (!isSafeRelativePath(input.sourcePath)) {
        throw new PublisherError('source', 'Source path is unsafe', {
            context: { input: 'sourcePath', stage: 'source' },
        });
    }
    try {
        const sourceMetadata = await sharp(input.bytes, {
            failOn: 'warning',
            animated: false,
        }).metadata();
        const maximum = maximumFor(input.identity);
        const base = sharp(input.bytes, {
            failOn: 'warning',
            animated: false,
        })
            .rotate()
            .toColourspace('srgb')
            .resize({
                width: maximum.width,
                height: maximum.height,
                fit: 'inside',
                withoutEnlargement: true,
                kernel: sharp.kernel.lanczos3,
            });
        const variants = await Promise.all(
            maximum.formats.map(format => encodeVariant(base.clone(), format))
        );
        const webp = variants.find(variant => variant.format === 'webp');
        if (webp === undefined) {
            throw new PublisherError(
                'configuration',
                'Encoder policy must include WebP'
            );
        }
        const outputMetadata = await sharp(webp.bytes, {
            failOn: 'warning',
            animated: false,
        }).metadata();
        if (
            outputMetadata.width === undefined ||
            outputMetadata.height === undefined
        ) {
            throw new PublisherError(
                'configuration',
                'Encoded WebP has no dimensions'
            );
        }
        for (const variant of variants) {
            const metadata = await sharp(variant.bytes, {
                failOn: 'warning',
                animated: false,
            }).metadata();
            if (
                metadata.width !== outputMetadata.width ||
                metadata.height !== outputMetadata.height
            ) {
                throw new PublisherError(
                    'configuration',
                    'Encoded variants have mismatched dimensions'
                );
            }
        }
        return {
            identity: input.identity,
            sourcePath: input.sourcePath,
            ...(input.authoringSection === undefined
                ? {}
                : { authoringSection: input.authoringSection }),
            ...(input.planSection === undefined
                ? {}
                : { planSection: input.planSection }),
            variants,
            width: outputMetadata.width,
            height: outputMetadata.height,
            sourceHasAlpha: sourceMetadata.hasAlpha ?? false,
            outputHasAlpha: outputMetadata.hasAlpha ?? false,
        };
    } catch (error) {
        // Explicit PublisherError instances (configuration diagnostics above,
        // or a rethrown source/encoding error from encodeVariant) describe a
        // deterministic publisher condition and must pass through unchanged.
        // Anything else is a libvips/encoder pipeline failure (metadata parse,
        // WebP/AVIF toBuffer) that would otherwise escape as a raw error and
        // be classified as a storage failure (exit 3). Wrap it as an encoding
        // failure so the CLI reports the deterministic input/encoding exit
        // code 2 and operators can locate the failed phase.
        if (error instanceof PublisherError) throw error;
        throw new PublisherError('encoding', 'Image encoding failed', {
            cause: error,
            context: { stage: 'encode' },
        });
    }
}
