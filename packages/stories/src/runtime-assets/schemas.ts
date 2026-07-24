import { z } from 'zod';
import {
    compareQualifiedAssetIds,
    isReleaseId,
    isSafeLogicalKey,
    isSafeRelativePath,
    isSha256,
    isStoryId,
    qualifyAssetIdentity,
} from './paths';

export const RUNTIME_ASSET_SCHEMA_VERSION = 1 as const;
export const ACTIVE_RELEASE_SCHEMA_VERSION = 1 as const;
export const RELEASE_PLAN_SCHEMA_VERSION = 1 as const;

export const AssetTypeSchema = z.enum(['background', 'portrait']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetFormatSchema = z.enum(['webp', 'avif']);
export type AssetFormat = z.infer<typeof AssetFormatSchema>;

const StoryIdSchema = z
    .string()
    .refine(isStoryId, 'Story id must be a lowercase underscore slug');
const ReleaseIdSchema = z.string().refine(isReleaseId, {
    message: 'Release id must be sha256-<64 lowercase hex>',
    params: { assetErrorCode: 'integrity' },
});
// A validated SHA-256 digest is branded so an arbitrary, unvalidated string
// cannot be passed to the integrity-critical helpers that consume one. On the
// read path the brand flows automatically from parsing; other callers mint it
// with `assertSha256`. (storyId/releaseId/previewId are deliberately left
// unbranded — they are compared field-to-field within already-typed contract
// objects rather than passed as bare, transposable positional arguments.)
const Sha256Schema = z
    .string()
    .refine(isSha256, {
        message: 'SHA-256 must contain 64 lowercase hex characters',
        params: { assetErrorCode: 'integrity' },
    })
    .brand<'Sha256'>();
export type Sha256 = z.infer<typeof Sha256Schema>;
const RelativePathSchema = z.string().refine(isSafeRelativePath, {
    message: 'Expected a safe relative path',
    params: { assetErrorCode: 'unsafe-path' },
});
const LogicalKeySchema = z.string().refine(isSafeLogicalKey, {
    message: 'Logical keys must be NFC, relative, and traversal-free',
    params: { assetErrorCode: 'unsafe-path' },
});

export const LogicalAssetIdentitySchema = z.object({
    type: AssetTypeSchema,
    key: LogicalKeySchema,
});
export type LogicalAssetIdentity = z.infer<typeof LogicalAssetIdentitySchema>;

function addObjectPathIssue(
    context: z.RefinementCtx,
    format: AssetFormat,
    value: { path: string; sha256: string },
    message: string
): void {
    if (
        isSha256(value.sha256) &&
        value.path !== `vn/objects/${value.sha256}.${format}`
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            message,
            path: ['path'],
            params: { assetErrorCode: 'integrity' },
        });
    }
}

function variantSchema<T extends AssetFormat>(format: T) {
    return z
        .object({
            format: z.literal(format),
            path: RelativePathSchema,
            sha256: Sha256Schema,
            byteLength: z.number().int().positive().optional(),
        })
        .superRefine((variant, context) =>
            addObjectPathIssue(
                context,
                format,
                variant,
                'Object path must match its SHA-256 digest and format'
            )
        );
}

export const WebpAssetVariantV1Schema = variantSchema('webp');
export const AvifAssetVariantV1Schema = variantSchema('avif');

export const LowResolutionPlaceholderV1Schema = z
    .object({
        format: z.literal('webp'),
        path: RelativePathSchema,
        sha256: Sha256Schema,
        width: z.number().int().positive(),
        height: z.number().int().positive(),
    })
    .superRefine((placeholder, context) =>
        addObjectPathIssue(
            context,
            'webp',
            placeholder,
            'Placeholder path must match its SHA-256 digest'
        )
    );

export const RuntimeAssetEntryV1Schema = z
    .object({
        identity: LogicalAssetIdentitySchema,
        variants: z.object({
            webp: WebpAssetVariantV1Schema,
            avif: AvifAssetVariantV1Schema.optional(),
        }),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        placeholder: LowResolutionPlaceholderV1Schema.optional(),
        section: z.string().trim().min(1).max(200).optional(),
    })
    .superRefine((asset, context) => {
        if (
            asset.placeholder &&
            (asset.placeholder.width >= asset.width ||
                asset.placeholder.height >= asset.height)
        ) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message:
                    'Placeholder dimensions must be smaller than the full asset',
                path: ['placeholder'],
            });
        }
    });

export const RuntimeAssetManifestV1Schema = z
    .object({
        schemaVersion: z.literal(RUNTIME_ASSET_SCHEMA_VERSION),
        storyId: StoryIdSchema,
        releaseId: ReleaseIdSchema,
        assets: z.array(RuntimeAssetEntryV1Schema),
    })
    .superRefine((manifest, context) => {
        const qualifiedIds = manifest.assets.map(asset =>
            qualifyAssetIdentity(asset.identity)
        );
        const duplicates = qualifiedIds.filter(
            (id, index) => qualifiedIds.indexOf(id) !== index
        );
        if (duplicates.length > 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate type-qualified asset identities: ${[
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
                    'Runtime assets must be sorted by type-qualified identity',
                path: ['assets'],
            });
        }
    });
export type RuntimeAssetManifestV1 = z.infer<
    typeof RuntimeAssetManifestV1Schema
>;
export type RuntimeAssetEntryV1 = z.infer<typeof RuntimeAssetEntryV1Schema>;

export const ActiveReleasePointerV1Schema = z.object({
    schemaVersion: z.literal(ACTIVE_RELEASE_SCHEMA_VERSION),
    storyId: StoryIdSchema,
    releaseId: ReleaseIdSchema,
    manifestPath: RelativePathSchema,
    manifestSha256: Sha256Schema,
    publishedAt: z.string().datetime({ offset: true }),
});
export type ActiveReleasePointerV1 = z.infer<
    typeof ActiveReleasePointerV1Schema
>;

const ReleasePlanIncludedEntryV1Schema = z.object({
    identity: LogicalAssetIdentitySchema,
    disposition: z.literal('included'),
    sourcePath: RelativePathSchema,
    section: z.string().trim().min(1).max(200).optional(),
});

const ReleasePlanOmittedEntryV1Schema = z.object({
    identity: LogicalAssetIdentitySchema,
    disposition: z.literal('omitted'),
    reason: z.string().trim().min(1).max(500),
    section: z.string().trim().min(1).max(200).optional(),
});

export const StoryAssetReleasePlanEntryV1Schema = z.discriminatedUnion(
    'disposition',
    [ReleasePlanIncludedEntryV1Schema, ReleasePlanOmittedEntryV1Schema]
);
export type StoryAssetReleasePlanEntryV1 = z.infer<
    typeof StoryAssetReleasePlanEntryV1Schema
>;

export const StoryAssetReleasePlanV1Schema = z
    .object({
        schemaVersion: z.literal(RELEASE_PLAN_SCHEMA_VERSION),
        storyId: StoryIdSchema,
        channel: z.enum(['production', 'preview']),
        entries: z.array(StoryAssetReleasePlanEntryV1Schema),
    })
    .superRefine((plan, context) => {
        const ids = plan.entries.map(entry =>
            qualifyAssetIdentity(entry.identity)
        );
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
        if (duplicates.length > 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate release-plan identities: ${[
                    ...new Set(duplicates),
                ].join(', ')}`,
                path: ['entries'],
            });
        }
    });
export type StoryAssetReleasePlanV1 = z.infer<
    typeof StoryAssetReleasePlanV1Schema
>;

export type PublicationTarget =
    | { kind: 'production' }
    | { kind: 'preview'; previewId: string };
