import { z } from 'zod';
import { isSafeLogicalKey } from './runtime-assets/paths';

export const AUDIO_PLAN_SCHEMA_VERSION = 1 as const;

export const AudioAssetTypeSchema = z.enum(['sfx', 'bgm']);
export type AudioAssetType = z.infer<typeof AudioAssetTypeSchema>;

export const AudioPlanKeySchema = z
    .string()
    .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Audio cue key must be a lowercase hyphenated slug'
    )
    .refine(isSafeLogicalKey, 'Audio cue key must be repository-safe')
    .refine(key => key !== 'stop', 'Audio cue key "stop" is reserved');

const commonAssetShape = {
    key: AudioPlanKeySchema,
    prompt: z.string().trim().min(1),
    durationMs: z.number().int().positive(),
    notes: z.string().trim().min(1).optional(),
};

const SfxPlanAssetSchema = z
    .object({
        ...commonAssetShape,
        type: z.literal('sfx'),
    })
    .strict();

const BgmPlanAssetSchema = z
    .object({
        ...commonAssetShape,
        type: z.literal('bgm'),
        loop: z.literal(true),
    })
    .strict();

export const AudioPlanAssetSchema = z.discriminatedUnion('type', [
    SfxPlanAssetSchema,
    BgmPlanAssetSchema,
]);
export type AudioPlanAsset = z.infer<typeof AudioPlanAssetSchema>;

export const AudioPlanV1Schema = z
    .object({
        schemaVersion: z.literal(AUDIO_PLAN_SCHEMA_VERSION),
        assets: z.array(AudioPlanAssetSchema),
    })
    .strict()
    .superRefine((plan, context) => {
        const seen = new Set<string>();
        plan.assets.forEach((asset, index) => {
            if (seen.has(asset.key)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['assets', index, 'key'],
                    message: `Duplicate audio cue key: ${asset.key}`,
                });
            }
            seen.add(asset.key);
        });
    });

export type AudioPlanV1 = z.infer<typeof AudioPlanV1Schema>;

export function parseAudioPlan(value: unknown): AudioPlanV1 {
    return AudioPlanV1Schema.parse(value);
}
