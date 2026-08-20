import { join } from 'node:path';
import type { AudioPlanAsset, AudioPlanV1 } from '../audio-plan';
import { AudioPlanInputError, loadAudioPlan } from '../audio-plan-loader';
import { loadStoryCompilerConfig, STORIES_RAW_ROOT } from '../compiler/config';
import { isSafeLogicalKey, isStoryId } from '../runtime-assets';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpecSet,
    ELEVENLABS_PRICING_AS_OF,
    estimateScheduledAudioCostUsd,
    type AudioGenerationSpecIssue,
    type CurrentAudioGenerationSpec,
} from './spec';
import {
    ElevenLabsProviderError,
    type AudioGenerationProvider,
} from './elevenlabs';
import {
    LocalAudioGenerationStore,
    type AudioGenerationFailure,
    type GeneratedAudioCandidate,
} from './store';

export interface AudioGenerationStoryContext {
    readonly storyFolder: string;
    readonly storyId: string;
    readonly plan: AudioPlanV1;
}

export class AudioGenerationConfigurationError extends Error {
    readonly code = 'configuration' as const;
    readonly kind = 'configuration' as const;

    constructor(message: string) {
        super(message);
        this.name = 'AudioGenerationConfigurationError';
    }
}

export class AudioGenerationInputError extends Error {
    readonly code = 'input' as const;
    readonly kind = 'input' as const;

    constructor(message: string, cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'AudioGenerationInputError';
    }
}

export interface ScheduledAudioGenerationRequest {
    readonly key: string;
    readonly spec: CurrentAudioGenerationSpec;
    readonly specSha256: string;
}

export interface AudioGenerationSkippedKey {
    readonly key: string;
    readonly desiredCount: number;
    readonly verifiedSuccessCount: number;
}

export interface AudioGenerationRemainingKey {
    readonly key: string;
    readonly count: number;
}

export interface AudioGenerationEstimate {
    readonly currency: 'USD';
    readonly pricingAsOf: string;
    readonly costUsd: number;
    readonly scheduledRequestCount: number;
    readonly scheduledDurationMs: number;
}

export interface AudioGenerationPlanStore {
    matchingSuccessfulCandidates(
        key: string,
        specSha256: string
    ): Promise<readonly unknown[]>;
}

export interface PlanAudioGenerationOptions {
    readonly context: AudioGenerationStoryContext;
    readonly store: AudioGenerationPlanStore;
    readonly keys?: readonly string[];
    readonly missing?: boolean;
    readonly candidateCount?: number;
    readonly maxRequests?: number;
    readonly dryRun?: boolean;
}

export interface AudioGenerationPlan {
    readonly storyFolder: string;
    readonly storyId: string;
    readonly candidateCount: number;
    readonly requestedKeys: readonly string[];
    readonly providerIssues: readonly AudioGenerationSpecIssue[];
    readonly scheduledRequests: readonly ScheduledAudioGenerationRequest[];
    readonly skipped: readonly AudioGenerationSkippedKey[];
    readonly remaining: readonly AudioGenerationRemainingKey[];
    readonly desiredRequestCount: number;
    readonly scheduledRequestCount: number;
    readonly remainingRequestCount: number;
    readonly estimate: AudioGenerationEstimate;
    readonly dryRun: boolean;
}

export interface AudioGenerationRunResult {
    readonly success: true;
    readonly completedRequests: number;
    readonly scheduledRequestCount: number;
    readonly remaining: readonly AudioGenerationRemainingKey[];
    readonly generatedCandidates: readonly {
        readonly key: string;
        readonly candidateId: string;
    }[];
}

export interface RunDependencies {
    readonly provider: AudioGenerationProvider;
    readonly store: LocalAudioGenerationStore;
    readonly apiKey: string;
}

export async function loadAudioGenerationStoryContext(
    storyFolder: string,
    rawRoot?: string
): Promise<AudioGenerationStoryContext> {
    if (
        !isSafeLogicalKey(storyFolder) ||
        storyFolder.includes('/') ||
        storyFolder.includes('\\')
    ) {
        throw new AudioGenerationConfigurationError(
            'Story folder must be a single safe directory component'
        );
    }
    const rawDir = join(rawRoot ?? STORIES_RAW_ROOT, storyFolder);
    const config = await loadStoryCompilerConfig(rawDir);
    if (typeof config.storyId !== 'string' || !isStoryId(config.storyId)) {
        throw new AudioGenerationConfigurationError(
            `Invalid runtime story id: ${config.storyId}`
        );
    }

    let plan: AudioPlanV1 | undefined;
    try {
        plan = loadAudioPlan(rawDir);
    } catch (error) {
        if (error instanceof AudioPlanInputError) {
            throw new AudioGenerationInputError(error.message, error);
        }
        throw error;
    }
    if (plan === undefined) {
        throw new AudioGenerationConfigurationError(
            `Missing audio plan: ${join(rawDir, 'docs', 'audio-plan.json')}`
        );
    }

    return { storyFolder, storyId: config.storyId, plan };
}

export async function planAudioGeneration(
    options: PlanAudioGenerationOptions
): Promise<AudioGenerationPlan> {
    const candidateCount = options.candidateCount ?? 1;
    assertCandidateCount(candidateCount);

    const keys = options.keys;
    const missing = options.missing === true;
    if (missing === (keys !== undefined)) {
        throw new AudioGenerationConfigurationError(
            'Choose exactly one audio target mode: keys or missing'
        );
    }
    if (keys !== undefined && keys.length === 0) {
        throw new AudioGenerationConfigurationError(
            'At least one audio key is required'
        );
    }

    const maxRequests = options.maxRequests;
    if (!options.dryRun && maxRequests === undefined) {
        throw new AudioGenerationConfigurationError(
            'maxRequests is required for paid audio generation'
        );
    }
    if (maxRequests !== undefined) assertMaxRequests(maxRequests);

    const selectedKeys = selectKeys(options.context.plan.assets, keys, missing);
    // Validate provider compatibility only for the requested asset set, not
    // the whole story. An unrelated provider-invalid cue must not block a
    // `--key <valid-key>` run. `--missing` selects every plan row, so the
    // full committed story is still validated end-to-end in that mode.
    const selectedKeySet = new Set(selectedKeys);
    const selectedAssets = options.context.plan.assets.filter(asset =>
        selectedKeySet.has(asset.key)
    );
    const specSet = buildAudioGenerationSpecSet(selectedAssets);
    if (specSet.issues.length > 0) {
        return makePlan({
            context: options.context,
            candidateCount,
            requestedKeys: selectedKeys,
            providerIssues: specSet.issues,
            scheduledRequests: [],
            skipped: [],
            remaining: [],
            desiredRequestCount: 0,
            dryRun: options.dryRun === true,
        });
    }

    const specsByKey = new Map(specSet.specs.map(spec => [spec.key, spec]));
    const fullRequests: ScheduledAudioGenerationRequest[] = [];
    const skipped: AudioGenerationSkippedKey[] = [];
    const neededByKey = new Map<string, number>();

    for (const key of selectedKeys) {
        const spec = specsByKey.get(key);
        if (spec === undefined) {
            throw new AudioGenerationConfigurationError(
                `Unknown audio key: ${key}`
            );
        }
        const specSha256 = audioGenerationSpecSha256(spec);
        const verifiedSuccessCount = (
            await options.store.matchingSuccessfulCandidates(key, specSha256)
        ).length;
        const needed = Math.max(0, candidateCount - verifiedSuccessCount);
        if (needed === 0) {
            skipped.push({
                key,
                desiredCount: candidateCount,
                verifiedSuccessCount,
            });
            continue;
        }
        neededByKey.set(key, needed);
        for (let index = 0; index < needed; index += 1) {
            fullRequests.push({ key, spec, specSha256 });
        }
    }

    const scheduledRequests =
        maxRequests === undefined
            ? fullRequests
            : fullRequests.slice(0, maxRequests);
    const scheduledByKey = new Map<string, number>();
    for (const request of scheduledRequests) {
        scheduledByKey.set(
            request.key,
            (scheduledByKey.get(request.key) ?? 0) + 1
        );
    }

    const remaining: AudioGenerationRemainingKey[] = [];
    for (const key of selectedKeys) {
        const needed = neededByKey.get(key) ?? 0;
        const scheduled = scheduledByKey.get(key) ?? 0;
        if (needed > scheduled)
            remaining.push({ key, count: needed - scheduled });
    }

    return makePlan({
        context: options.context,
        candidateCount,
        requestedKeys: selectedKeys,
        providerIssues: [],
        scheduledRequests,
        skipped,
        remaining,
        desiredRequestCount: fullRequests.length,
        dryRun: options.dryRun === true,
    });
}

export async function runAudioGeneration(
    plan: AudioGenerationPlan,
    dependencies: RunDependencies
): Promise<AudioGenerationRunResult> {
    if (plan.providerIssues.length > 0) {
        throw new AudioGenerationConfigurationError(
            'Cannot execute an audio plan with provider issues'
        );
    }
    if (plan.dryRun) {
        return {
            success: true,
            completedRequests: 0,
            scheduledRequestCount: plan.scheduledRequests.length,
            remaining: plan.remaining,
            generatedCandidates: [],
        };
    }

    const generatedCandidates: Array<{
        readonly key: string;
        readonly candidateId: string;
    }> = [];

    for (const request of plan.scheduledRequests) {
        const candidateId = await dependencies.store.nextCandidateId(
            request.key
        );
        let generated: GeneratedAudioCandidate;
        try {
            generated = await dependencies.provider.generate(
                request.spec,
                dependencies.apiKey
            );
        } catch (error) {
            if (error instanceof ElevenLabsProviderError) {
                const failure: AudioGenerationFailure = {
                    kind: error.kind,
                    status: error.status,
                    message: error.message,
                };
                await dependencies.store.writeFailureMarker({
                    candidateId,
                    spec: request.spec,
                    specSha256: request.specSha256,
                    failure,
                });
            }
            throw error;
        }

        await dependencies.store.writeSuccess({
            candidateId,
            spec: request.spec,
            specSha256: request.specSha256,
            generated,
        });
        generatedCandidates.push({ key: request.key, candidateId });
    }

    return {
        success: true,
        completedRequests: plan.scheduledRequests.length,
        scheduledRequestCount: plan.scheduledRequests.length,
        remaining: plan.remaining,
        generatedCandidates,
    };
}

function assertCandidateCount(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 4) {
        throw new AudioGenerationConfigurationError(
            'candidateCount must be an integer from 1 through 4'
        );
    }
}

function assertMaxRequests(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 100) {
        throw new AudioGenerationConfigurationError(
            'maxRequests must be an integer from 1 through 100'
        );
    }
}

function selectKeys(
    assets: readonly AudioPlanAsset[],
    keys: readonly string[] | undefined,
    missing: boolean
): string[] {
    if (missing) return assets.map(asset => asset.key);

    const requested = new Set(keys);
    const known = new Set(assets.map(asset => asset.key));
    for (const key of requested) {
        if (!known.has(key)) {
            throw new AudioGenerationConfigurationError(
                `Unknown audio key: ${key}`
            );
        }
    }
    return assets.map(asset => asset.key).filter(key => requested.has(key));
}

function makePlan(input: {
    readonly context: AudioGenerationStoryContext;
    readonly candidateCount: number;
    readonly requestedKeys: readonly string[];
    readonly providerIssues: readonly AudioGenerationSpecIssue[];
    readonly scheduledRequests: readonly ScheduledAudioGenerationRequest[];
    readonly skipped: readonly AudioGenerationSkippedKey[];
    readonly remaining: readonly AudioGenerationRemainingKey[];
    readonly desiredRequestCount: number;
    readonly dryRun: boolean;
}): AudioGenerationPlan {
    const scheduledDurationMs = input.scheduledRequests.reduce(
        (total, request) => total + request.spec.durationMs,
        0
    );
    const costUsd = estimateScheduledAudioCostUsd(
        input.scheduledRequests.map(request => request.spec)
    );
    return {
        storyFolder: input.context.storyFolder,
        storyId: input.context.storyId,
        candidateCount: input.candidateCount,
        requestedKeys: input.requestedKeys,
        providerIssues: input.providerIssues,
        scheduledRequests: input.scheduledRequests,
        skipped: input.skipped,
        remaining: input.remaining,
        desiredRequestCount: input.desiredRequestCount,
        scheduledRequestCount: input.scheduledRequests.length,
        remainingRequestCount: input.remaining.reduce(
            (total, item) => total + item.count,
            0
        ),
        estimate: {
            currency: 'USD',
            pricingAsOf: ELEVENLABS_PRICING_AS_OF,
            costUsd,
            scheduledRequestCount: input.scheduledRequests.length,
            scheduledDurationMs,
        },
        dryRun: input.dryRun,
    };
}
