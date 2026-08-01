import { getObjectPath } from '@aquila/stories/runtime-assets';
import sharp from 'sharp';
import { ENCODER_POLICY_V1 } from './encoder-policy';
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
    if (webp === undefined) throw new Error('Encoder policy must include WebP');
    const outputMetadata = await sharp(webp.bytes, {
        failOn: 'warning',
        animated: false,
    }).metadata();
    if (
        outputMetadata.width === undefined ||
        outputMetadata.height === undefined
    ) {
        throw new Error('Encoded WebP has no dimensions');
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
            throw new Error('Encoded variants have mismatched dimensions');
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
}
