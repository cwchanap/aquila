import { z } from 'zod';
import { AudioPlanKeySchema } from '../audio-plan';
import {
    assertKnownVersion,
    assertRuntimeInputSafe,
    parseActiveReleasePointerWithManifestPath,
    parseRuntimeSchema,
    type RuntimeInputShape,
} from './validation';
import {
    compareQualifiedAssetIds,
    getAudioObjectPath,
    getAudioReleaseManifestPath,
    isReleaseId,
    isSafeLogicalKey,
    isSafeRelativePath,
    isSha256,
    isStoryId,
} from './paths';
import { canonicalJson, type JsonValue } from './canonical';
import type {
    ActiveReleasePointerV1,
    ObjectContentSha256,
    PublicationTarget,
} from './schemas';

export type AudioAssetType = 'sfx' | 'bgm';

export interface RuntimeAudioAssetV1 {
    readonly identity: {
        readonly type: AudioAssetType;
        readonly key: string;
    };
    readonly format: 'mp3';
    readonly path: string;
    readonly sha256: ObjectContentSha256;
    readonly byteLength: number;
    readonly durationMs: number;
    readonly loop: boolean;
}

export interface RuntimeAudioManifestV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly releaseId: string;
    readonly assets: readonly RuntimeAudioAssetV1[];
}

const AudioAssetTypeSchema = z.enum(['sfx', 'bgm']);
const StoryIdSchema = z
    .string()
    .refine(isStoryId, 'Story id must be a lowercase underscore slug');
const ReleaseIdSchema = z.string().refine(isReleaseId, {
    message: 'Release id must be sha256-<64 lowercase hex>',
    params: { assetErrorCode: 'integrity' },
});
const AudioLogicalKeySchema = z
    .string()
    .refine(
        value => AudioPlanKeySchema.safeParse(value).success,
        'Audio cue key must be a lowercase hyphenated slug'
    )
    .refine(isSafeLogicalKey, {
        message: 'Audio keys must be NFC, relative, and traversal-free',
        params: { assetErrorCode: 'unsafe-path' },
    });
const AudioObjectSha256Schema = z
    .string()
    .refine(isSha256, {
        message: 'SHA-256 must contain 64 lowercase hex characters',
        params: { assetErrorCode: 'integrity' },
    })
    .brand<'object-content'>();
const RelativePathSchema = z.string().refine(isSafeRelativePath, {
    message: 'Expected a safe relative path',
    params: { assetErrorCode: 'unsafe-path' },
});

const RuntimeAudioAssetV1Schema = z
    .object({
        identity: z.object({
            type: AudioAssetTypeSchema,
            key: AudioLogicalKeySchema,
        }),
        format: z.literal('mp3'),
        path: RelativePathSchema,
        sha256: AudioObjectSha256Schema,
        byteLength: z.number().int().positive(),
        durationMs: z.number().int().positive(),
        loop: z.boolean(),
    })
    .superRefine((asset, context) => {
        if (
            isSha256(asset.sha256) &&
            asset.path !== getAudioObjectPath(asset.sha256)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Audio object path must match its SHA-256 digest',
                path: ['path'],
                params: { assetErrorCode: 'integrity' },
            });
        }
        if (
            (asset.identity.type === 'sfx' && asset.loop) ||
            (asset.identity.type === 'bgm' && !asset.loop)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${asset.identity.type} loop flag is invalid`,
                path: ['loop'],
            });
        }
    });

const RuntimeAudioManifestV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        storyId: StoryIdSchema,
        releaseId: ReleaseIdSchema,
        assets: z.array(RuntimeAudioAssetV1Schema),
    })
    .superRefine((manifest, context) => {
        const qualifiedIds = manifest.assets.map(
            asset => `${asset.identity.type}:${asset.identity.key}`
        );
        const duplicates = qualifiedIds.filter(
            (id, index) => qualifiedIds.indexOf(id) !== index
        );
        if (duplicates.length > 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate type-qualified audio identities: ${[
                    ...new Set(duplicates),
                ].join(', ')}`,
                path: ['assets'],
            });
        }
        const sorted = [...qualifiedIds].sort(compareQualifiedAssetIds);
        if (qualifiedIds.some((id, index) => id !== sorted[index])) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Runtime audio assets must be sorted by type-qualified identity',
                path: ['assets'],
            });
        }
    });

const AUDIO_MANIFEST_SHAPE: RuntimeInputShape = {
    scalars: new Set(['schemaVersion', 'storyId', 'releaseId']),
    objects: {},
    arrays: {
        assets: {
            scalars: new Set([
                'format',
                'path',
                'sha256',
                'byteLength',
                'durationMs',
                'loop',
            ]),
            objects: {
                identity: {
                    scalars: new Set(['type', 'key']),
                    objects: {},
                    arrays: {},
                },
            },
            arrays: {},
        },
    },
};

const AUDIO_FORBIDDEN_RUNTIME_KEY_PARTS = [
    'candidateid',
    'candidateids',
    'receipt',
    'receipts',
    'modelid',
    'requestid',
    'selectionnote',
    'generationspec',
] as const;

export function parseRuntimeAudioManifest(
    input: unknown
): RuntimeAudioManifestV1 {
    assertKnownVersion(input, 1, 'runtime audio manifest');
    assertRuntimeInputSafe(
        input,
        AUDIO_MANIFEST_SHAPE,
        'Runtime audio manifests',
        AUDIO_FORBIDDEN_RUNTIME_KEY_PARTS
    );
    return parseRuntimeSchema(
        RuntimeAudioManifestV1Schema,
        input,
        'runtime audio manifest'
    ) as RuntimeAudioManifestV1;
}

export function canonicalAudioReleaseContent(
    manifest: RuntimeAudioManifestV1
): string {
    const assets = [...manifest.assets].sort((left, right) =>
        compareQualifiedAssetIds(
            `${left.identity.type}:${left.identity.key}`,
            `${right.identity.type}:${right.identity.key}`
        )
    );
    return canonicalJson({
        schemaVersion: manifest.schemaVersion,
        storyId: manifest.storyId,
        assets,
    } as unknown as JsonValue);
}

export function parseAudioActiveReleasePointer(
    input: unknown,
    target: PublicationTarget,
    expectedStoryId: string
): ActiveReleasePointerV1 {
    return parseActiveReleasePointerWithManifestPath(
        input,
        target,
        expectedStoryId,
        getAudioReleaseManifestPath,
        AUDIO_FORBIDDEN_RUNTIME_KEY_PARTS
    );
}
