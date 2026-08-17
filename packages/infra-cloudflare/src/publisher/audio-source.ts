import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import type { AudioPlanAsset } from '@aquila/stories';
import {
    AudioSelectionFileV1Schema,
    LocalAudioGenerationStore,
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
} from '@aquila/stories/audio-generation';
import {
    loadAudioPublishingContext,
    type AudioPublishingContext,
} from '@aquila/stories/audio-publishing';
import {
    compareQualifiedAssetIds,
    isSafeLogicalKey,
    isSafeRelativePath,
    isSha256,
    isStoryId,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import type { PlannedImmutableCandidate } from './immutable-candidate';

export interface AudioOmissionsV1 {
    readonly schemaVersion: 1;
    readonly storyId: string;
    readonly omissions: Readonly<Record<string, string>>;
}

export type AudioCoverageEntryV1 =
    | {
          readonly type: 'sfx' | 'bgm';
          readonly key: string;
          readonly usageCount: number;
          readonly disposition: 'included';
      }
    | {
          readonly type: 'sfx' | 'bgm';
          readonly key: string;
          readonly usageCount: number;
          readonly disposition: 'omitted';
          readonly reason: string;
      };

export interface PreparedAudioSource {
    readonly type: 'sfx' | 'bgm';
    readonly key: string;
    readonly plannedDurationMs: number;
    readonly loop: boolean;
    readonly candidateId: string;
    readonly sourceSha256: string;
    readonly sourceBytes: Uint8Array;
    readonly sourceFilename: string;
    readonly sourceMediaType: string;
    readonly receiptBytes: Uint8Array;
}

export interface AudioSourcePlan {
    readonly storyId: string;
    readonly sources: readonly PreparedAudioSource[];
    readonly coverage: readonly AudioCoverageEntryV1[];
    readonly unusedPlanKeys: readonly string[];
    readonly selectedUnusedKeys: readonly string[];
}

const AUDIO_ARCHIVE_CACHE_CONTROL = 'private, max-age=0, no-store';
const AUDIO_OMISSIONS_SCHEMA_VERSION = 1 as const;

function error(
    code: 'input' | 'coverage' | 'source',
    message: string,
    stage: 'input' | 'coverage' | 'source' = code
): PublisherError {
    return new PublisherError(code, message, {
        context: { stage, input: 'audio-source' },
    });
}

function qualified(type: 'sfx' | 'bgm', key: string): string {
    return `${type}:${key.normalize('NFC')}`;
}

function compareAudioAssets(
    left: Pick<AudioPlanAsset, 'type' | 'key'>,
    right: Pick<AudioPlanAsset, 'type' | 'key'>
): number {
    return compareQualifiedAssetIds(
        qualified(left.type, left.key),
        qualified(right.type, right.key)
    );
}

function sha256Bytes(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function isNotFound(cause: unknown): boolean {
    return (
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === 'ENOENT'
    );
}

function parseJson(text: string, label: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    } catch {
        throw error('input', `Invalid ${label} JSON`);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOmissions(
    value: unknown,
    expectedStoryId: string
): AudioOmissionsV1 {
    if (!isRecord(value))
        throw error('input', 'Audio omissions must be an object');
    if (
        Object.keys(value).some(
            key =>
                key !== 'schemaVersion' &&
                key !== 'storyId' &&
                key !== 'omissions'
        )
    ) {
        throw error('input', 'Audio omissions contain unknown fields');
    }
    if (
        value.schemaVersion !== AUDIO_OMISSIONS_SCHEMA_VERSION ||
        value.storyId !== expectedStoryId ||
        !isRecord(value.omissions)
    ) {
        throw error('input', 'Audio omissions have an invalid schema');
    }

    const omissions = Object.create(null) as Record<string, string>;
    for (const [key, reason] of Object.entries(value.omissions)) {
        if (!isSafeLogicalKey(key)) {
            throw error('input', 'Audio omissions contain an invalid cue key');
        }
        if (typeof reason !== 'string') {
            throw error('input', 'Audio omission reason must be text');
        }
        const trimmed = reason.trim();
        if (trimmed.length === 0 || trimmed.length > 500) {
            throw error(
                'input',
                'Audio omission reason must be 1 to 500 characters'
            );
        }
        omissions[key] = trimmed;
    }

    return {
        schemaVersion: AUDIO_OMISSIONS_SCHEMA_VERSION,
        storyId: expectedStoryId,
        omissions,
    };
}

async function readOmissions(
    omissionsPath: string | undefined,
    expectedStoryId: string
): Promise<AudioOmissionsV1> {
    if (omissionsPath === undefined) {
        return {
            schemaVersion: AUDIO_OMISSIONS_SCHEMA_VERSION,
            storyId: expectedStoryId,
            omissions: {},
        };
    }

    let text: string;
    try {
        text = await readFile(omissionsPath, 'utf8');
    } catch (cause) {
        if (isNotFound(cause)) {
            return {
                schemaVersion: AUDIO_OMISSIONS_SCHEMA_VERSION,
                storyId: expectedStoryId,
                omissions: {},
            };
        }
        throw error('input', 'Unable to read audio omissions');
    }
    return parseOmissions(parseJson(text, 'audio omissions'), expectedStoryId);
}

async function readSelection(
    selectionPath: string,
    expectedStoryId: string
): Promise<
    Readonly<
        Record<
            string,
            { candidateId: string; specSha256: string; sourceSha256: string }
        >
    >
> {
    let text: string;
    try {
        text = await readFile(selectionPath, 'utf8');
    } catch (cause) {
        if (isNotFound(cause)) return {};
        throw error('source', 'Unable to read audio selection');
    }

    let selection: ReturnType<typeof AudioSelectionFileV1Schema.parse>;
    try {
        selection = AudioSelectionFileV1Schema.parse(
            parseJson(text, 'audio selection')
        );
    } catch {
        throw error('source', 'Audio selection failed validation');
    }
    if (selection.storyId !== expectedStoryId) {
        throw error(
            'source',
            'Audio selection story id does not match the story'
        );
    }
    return selection.selections;
}

function sourceExtension(filename: string): string {
    const extension = extname(filename).slice(1).toLowerCase();
    if (!/^[a-z0-9]+$/.test(extension)) {
        throw error(
            'source',
            'Selected audio candidate has an unsafe filename extension'
        );
    }
    return extension;
}

async function prepareSelectedSource(input: {
    readonly store: LocalAudioGenerationStore;
    readonly storyId: string;
    readonly asset: AudioPlanAsset;
    readonly selection: {
        readonly candidateId: string;
        readonly specSha256: string;
        readonly sourceSha256: string;
    };
}): Promise<PreparedAudioSource> {
    const { asset, selection } = input;
    let currentSpec;
    try {
        currentSpec = buildAudioGenerationSpec(asset);
    } catch {
        throw error(
            'source',
            'Audio plan row cannot produce a current generation spec'
        );
    }
    const currentSpecSha256 = audioGenerationSpecSha256(currentSpec);
    if (selection.specSha256 !== currentSpecSha256) {
        throw error(
            'source',
            'Selected audio candidate has a stale generation spec'
        );
    }

    let candidate;
    try {
        candidate = await input.store.readVerifiedCandidate(
            asset.key,
            selection.candidateId
        );
    } catch {
        throw error('source', 'Selected audio candidate failed verification');
    }
    if (candidate === null) {
        throw error('source', 'Selected audio candidate is missing or invalid');
    }

    if (
        candidate.receipt.storyId !== input.storyId ||
        candidate.receipt.key !== asset.key ||
        candidate.receipt.type !== asset.type ||
        candidate.receipt.candidateId !== selection.candidateId ||
        candidate.receipt.specSha256 !== currentSpecSha256
    ) {
        throw error(
            'source',
            'Selected audio receipt does not match the current plan'
        );
    }

    const sourceSha256 = sha256Bytes(candidate.bytes);
    if (
        !isSha256(selection.sourceSha256) ||
        sourceSha256 !== selection.sourceSha256
    ) {
        throw error(
            'source',
            'Selected audio source digest does not match its bytes'
        );
    }
    sourceExtension(candidate.receipt.output.filename);

    let receiptBytes: Uint8Array;
    try {
        receiptBytes = new Uint8Array(
            await readFile(
                join(
                    dirname(candidate.path),
                    `${selection.candidateId}.receipt.json`
                )
            )
        );
    } catch {
        throw error('source', 'Selected audio receipt bytes are unavailable');
    }

    return {
        type: asset.type,
        key: asset.key,
        plannedDurationMs: asset.durationMs,
        loop: asset.type === 'bgm',
        candidateId: selection.candidateId,
        sourceSha256,
        sourceBytes: candidate.bytes,
        sourceFilename: candidate.receipt.output.filename,
        sourceMediaType: candidate.receipt.output.mediaType,
        receiptBytes,
    };
}

function assertStoryInput(storyFolder: string, expectedStoryId: string): void {
    if (!isSafeRelativePath(storyFolder)) {
        throw error(
            'input',
            'Audio story folder is not a supported relative path'
        );
    }
    if (!isStoryId(expectedStoryId)) {
        throw error('input', 'Audio story id is invalid');
    }
}

function assertPlanIdentity(asset: AudioPlanAsset): void {
    if (!isSafeLogicalKey(asset.key)) {
        throw error('input', 'Audio plan contains an unsafe cue key');
    }
}

export async function prepareAudioSources(input: {
    readonly storyFolder: string;
    readonly expectedStoryId: string;
    readonly generationRoot: string;
    readonly omissionsPath?: string;
}): Promise<AudioSourcePlan> {
    assertStoryInput(input.storyFolder, input.expectedStoryId);

    let context: AudioPublishingContext;
    try {
        context = await loadAudioPublishingContext(input.storyFolder);
    } catch {
        throw error(
            'input',
            'Unable to load compiler-owned audio publishing inputs'
        );
    }
    if (
        context.storyId !== input.expectedStoryId ||
        !isStoryId(context.storyId)
    ) {
        throw error(
            'input',
            'Compiler story id does not match the requested story'
        );
    }

    const planAssets = [...context.plan.assets];
    planAssets.forEach(assertPlanIdentity);
    const planByKey = new Map(planAssets.map(asset => [asset.key, asset]));
    const usageAssets = [...context.usage.assets].sort(compareAudioAssets);
    const usageByKey = new Map(usageAssets.map(asset => [asset.key, asset]));
    for (const usage of usageAssets) {
        const planAsset = planByKey.get(usage.key);
        if (planAsset === undefined || planAsset.type !== usage.type) {
            throw error(
                'coverage',
                'Compiler audio usage does not match the audio plan'
            );
        }
    }

    const omissions = await readOmissions(input.omissionsPath, context.storyId);
    const selectionPath = join(
        input.generationRoot,
        input.storyFolder,
        'selection.json'
    );
    const selections = await readSelection(selectionPath, context.storyId);
    const selectedKeys = Object.keys(selections);

    for (const key of selectedKeys) {
        if (!planByKey.has(key)) {
            throw error(
                'coverage',
                'Audio selection contains a key absent from the plan'
            );
        }
    }
    for (const key of Object.keys(omissions.omissions)) {
        if (!planByKey.has(key) || !usageByKey.has(key)) {
            throw error(
                'coverage',
                'Audio omission must name a compiler-used plan cue'
            );
        }
        if (selections[key] !== undefined) {
            throw error('coverage', 'Audio cue cannot be selected and omitted');
        }
    }

    const selectedUnusedKeys = planAssets
        .filter(
            asset =>
                !usageByKey.has(asset.key) &&
                selections[asset.key] !== undefined
        )
        .sort(compareAudioAssets)
        .map(asset => asset.key);
    const unusedPlanKeys = planAssets
        .filter(asset => !usageByKey.has(asset.key))
        .sort(compareAudioAssets)
        .map(asset => asset.key);

    const missingUsedKeys = usageAssets.filter(
        usage =>
            selections[usage.key] === undefined &&
            omissions.omissions[usage.key] === undefined
    );
    if (missingUsedKeys.length > 0) {
        throw error(
            'coverage',
            'Every compiler-used audio cue must be selected or omitted'
        );
    }

    const store = new LocalAudioGenerationStore({
        root: join(input.generationRoot, input.storyFolder),
        storyId: context.storyId,
    });
    const sources: PreparedAudioSource[] = [];
    const coverage: AudioCoverageEntryV1[] = [];
    for (const usage of usageAssets) {
        const asset = planByKey.get(usage.key);
        if (asset === undefined) {
            throw error(
                'coverage',
                'Compiler audio usage does not match the audio plan'
            );
        }
        const omissionReason = omissions.omissions[usage.key];
        if (omissionReason !== undefined) {
            coverage.push({
                type: usage.type,
                key: usage.key,
                usageCount: usage.usageCount,
                disposition: 'omitted',
                reason: omissionReason,
            });
            continue;
        }

        const selection = selections[usage.key];
        if (selection === undefined) {
            throw error(
                'coverage',
                'Every compiler-used audio cue must be selected or omitted'
            );
        }
        sources.push(
            await prepareSelectedSource({
                store,
                storyId: context.storyId,
                asset,
                selection,
            })
        );
        coverage.push({
            type: usage.type,
            key: usage.key,
            usageCount: usage.usageCount,
            disposition: 'included',
        });
    }

    return {
        storyId: context.storyId,
        sources,
        coverage,
        unusedPlanKeys,
        selectedUnusedKeys,
    };
}

function archiveExtension(source: PreparedAudioSource): string {
    return sourceExtension(source.sourceFilename);
}

function assertArchiveSource(
    source: PreparedAudioSource,
    storyId: string
): void {
    if (
        !isStoryId(storyId) ||
        !isSafeLogicalKey(source.key) ||
        !isSha256(source.sourceSha256)
    ) {
        throw error('source', 'Audio source cannot produce a safe archive key');
    }
}

export function sourceArchiveCandidates(
    plan: AudioSourcePlan
): readonly Omit<PlannedImmutableCandidate, 'status'>[] {
    const sources = [...plan.sources].sort((left, right) =>
        compareAudioAssets(left, right)
    );
    const candidates: Array<Omit<PlannedImmutableCandidate, 'status'>> = [];
    for (const source of sources) {
        assertArchiveSource(source, plan.storyId);
        const prefix = `audio/approved/${plan.storyId}/${source.type}/${source.key}/${source.sourceSha256}`;
        candidates.push({
            kind: 'source',
            key: `${prefix}/source.${archiveExtension(source)}`,
            bytes: source.sourceBytes,
            contentType: source.sourceMediaType,
            cacheControl: AUDIO_ARCHIVE_CACHE_CONTROL,
            customMetadata: {},
        });
        candidates.push({
            kind: 'source',
            key: `${prefix}/receipt.json`,
            bytes: source.receiptBytes,
            contentType: 'application/json',
            cacheControl: AUDIO_ARCHIVE_CACHE_CONTROL,
            customMetadata: {},
        });
    }
    return candidates;
}
