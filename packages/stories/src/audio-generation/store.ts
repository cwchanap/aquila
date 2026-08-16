import { createHash, randomUUID } from 'node:crypto';
import {
    access,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    writeFile,
} from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { z } from 'zod';
import { isSha256, isStoryId } from '../runtime-assets';
import {
    audioGenerationSpecSha256,
    type CurrentAudioGenerationSpec,
} from './spec';

const StoredSfxGenerationSpecV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        key: z.string().min(1),
        type: z.literal('sfx'),
        prompt: z.string(),
        durationMs: z.number().int().positive(),
        provider: z.string().min(1),
        modelId: z.string().min(1),
        outputFormat: z.string().min(1),
        loop: z.boolean(),
        promptInfluence: z.number(),
    })
    .strict();

const StoredBgmGenerationSpecV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        key: z.string().min(1),
        type: z.literal('bgm'),
        prompt: z.string(),
        durationMs: z.number().int().positive(),
        provider: z.string().min(1),
        modelId: z.string().min(1),
        outputFormat: z.string().min(1),
        loopIntent: z.boolean(),
        forceInstrumental: z.boolean(),
    })
    .strict();

export const StoredAudioGenerationSpecV1Schema = z.discriminatedUnion('type', [
    StoredSfxGenerationSpecV1Schema,
    StoredBgmGenerationSpecV1Schema,
]);
export type StoredAudioGenerationSpecV1 = z.infer<
    typeof StoredAudioGenerationSpecV1Schema
>;

const StoryIdSchema = z.string().refine(isStoryId, 'Invalid runtime story id');
const Sha256Schema = z.string().refine(isSha256, 'Expected lowercase SHA-256');
const CandidateIdSchema = z
    .string()
    .regex(/^candidate-\d{3,}$/, 'Expected candidate-NNN id');
const AudioTypeSchema = z.enum(['sfx', 'bgm']);

const AudioCandidateOutputV1Schema = z
    .object({
        filename: z.string().min(1),
        mediaType: z.string().min(1),
        format: z.string().min(1),
        byteLength: z.number().int().positive(),
        sha256: Sha256Schema,
    })
    .strict();

export const AudioCandidateReceiptV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        storyId: StoryIdSchema,
        key: z.string().min(1),
        type: AudioTypeSchema,
        candidateId: CandidateIdSchema,
        spec: StoredAudioGenerationSpecV1Schema,
        specSha256: Sha256Schema,
        provider: z.string().min(1),
        modelId: z.string().min(1),
        createdAt: z.string().datetime({ offset: true }),
        intendedDurationMs: z.number().int().positive(),
        actualDurationMs: z.number().int().positive().nullable(),
        output: AudioCandidateOutputV1Schema,
        providerMetadata: z.record(z.unknown()),
    })
    .strict()
    .superRefine((receipt, context) => {
        if (receipt.key !== receipt.spec.key) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['key'],
                message: 'Receipt key must match the stored spec key',
            });
        }
        if (receipt.type !== receipt.spec.type) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['type'],
                message: 'Receipt type must match the stored spec type',
            });
        }
        if (receipt.provider !== receipt.spec.provider) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['provider'],
                message: 'Receipt provider must match the stored spec provider',
            });
        }
        if (receipt.modelId !== receipt.spec.modelId) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['modelId'],
                message: 'Receipt model must match the stored spec model',
            });
        }
    });
export type AudioCandidateReceiptV1 = z.infer<
    typeof AudioCandidateReceiptV1Schema
>;

/** The provider result held in memory before the store adds receipt metadata. */
export interface GeneratedAudioCandidate {
    readonly bytes: Uint8Array;
    readonly mediaType: string;
    readonly filename?: string;
    readonly format?: string;
    readonly providerMetadata?: Record<string, unknown>;
    readonly intendedDurationMs?: number;
    readonly actualDurationMs?: number | null;
}

export interface VerifiedStoredCandidate {
    readonly candidateId: string;
    readonly receipt: AudioCandidateReceiptV1;
    readonly bytes: Uint8Array;
    readonly path: string;
}

export interface AudioGenerationFailure {
    readonly kind: string;
    readonly status?: number | null;
    readonly message: string;
}

interface LocalAudioGenerationStoreConfig {
    readonly root: string;
    readonly storyId: string;
}

type StoreClock = () => Date | number | string;

const CANDIDATE_FILENAME_RE = /^candidate-(\d{3,})\./;
const CANDIDATE_RECEIPT_FILENAME_RE = /^candidate-(\d{3,})\.receipt\.json$/;

function isNotFound(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
    );
}

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function extensionFromMediaType(mediaType: string): string {
    const normalized = mediaType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
    const [category, subtype] = normalized.split('/', 2);
    if (
        category !== 'audio' ||
        !subtype ||
        !/^[a-z0-9][a-z0-9+.-]*$/.test(subtype)
    ) {
        throw new Error(`Unsupported audio media type: ${mediaType}`);
    }
    return subtype === 'mpeg' ? 'mp3' : subtype.replace(/^x-/, '');
}

function isCandidateFilename(candidateId: string, filename: string): boolean {
    return (
        basename(filename) === filename &&
        !filename.includes('\\') &&
        filename.startsWith(`${candidateId}.`)
    );
}

function jsonBytes(value: unknown): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function assertCandidateId(candidateId: string): void {
    CandidateIdSchema.parse(candidateId);
}

function assertSha256(value: string): void {
    if (!isSha256(value)) throw new Error('Expected lowercase SHA-256');
}

async function assertMissing(path: string): Promise<void> {
    try {
        await access(path);
    } catch (error) {
        if (isNotFound(error)) return;
        throw error;
    }
    throw new Error(`Candidate ordinal is already occupied: ${path}`);
}

export class LocalAudioGenerationStore {
    private readonly root: string;
    private readonly storyId: string;
    private readonly now: StoreClock;

    constructor(
        config: LocalAudioGenerationStoreConfig,
        now: StoreClock = () => new Date()
    ) {
        if (!isStoryId(config.storyId)) {
            throw new Error('Invalid runtime story id');
        }
        this.root = resolve(config.root);
        this.storyId = config.storyId;
        this.now = now;
    }

    async matchingSuccessfulCandidates(
        key: string,
        specSha256: string
    ): Promise<VerifiedStoredCandidate[]> {
        let entries;
        try {
            entries = await readdir(this.keyRoot(key));
        } catch (error) {
            if (isNotFound(error)) return [];
            throw error;
        }

        const candidateIds = entries
            .map(entry => CANDIDATE_RECEIPT_FILENAME_RE.exec(entry)?.[1])
            .filter((value): value is string => value !== undefined)
            .sort((left, right) => Number(left) - Number(right))
            .map(value => `candidate-${value}`);
        const matches: VerifiedStoredCandidate[] = [];
        for (const candidateId of candidateIds) {
            try {
                const candidate = await this.readVerifiedCandidate(
                    key,
                    candidateId
                );
                if (candidate?.receipt.specSha256 === specSha256) {
                    matches.push(candidate);
                }
            } catch {
                // A malformed receipt is not a successful candidate.
            }
        }
        return matches;
    }

    async nextCandidateId(key: string): Promise<string> {
        let entries;
        try {
            entries = await readdir(this.keyRoot(key));
        } catch (error) {
            if (isNotFound(error)) return 'candidate-001';
            throw error;
        }

        let highest = 0;
        for (const entry of entries) {
            const candidateNumber = CANDIDATE_FILENAME_RE.exec(entry)?.[1];
            if (candidateNumber !== undefined) {
                highest = Math.max(highest, Number(candidateNumber));
            }
        }
        return `candidate-${String(highest + 1).padStart(3, '0')}`;
    }

    async writeSuccess(input: {
        readonly candidateId: string;
        readonly spec: CurrentAudioGenerationSpec;
        readonly specSha256: string;
        readonly generated: GeneratedAudioCandidate;
    }): Promise<AudioCandidateReceiptV1> {
        const { candidateId, spec, specSha256, generated } = input;
        assertCandidateId(candidateId);
        assertSha256(specSha256);
        const expectedSpecSha256 = audioGenerationSpecSha256(spec);
        if (specSha256 !== expectedSpecSha256) {
            throw new Error('specSha256 does not match the current spec');
        }
        if (generated.bytes.byteLength === 0) {
            throw new Error('Generated audio bytes must not be empty');
        }

        const mediaType = generated.mediaType.split(';', 1)[0]?.trim() ?? '';
        const filename =
            generated.filename ??
            `${candidateId}.${extensionFromMediaType(generated.mediaType)}`;
        if (!isCandidateFilename(candidateId, filename)) {
            throw new Error(`Invalid candidate filename: ${filename}`);
        }

        const keyRoot = this.keyRoot(spec.key);
        const audioPath = join(keyRoot, filename);
        const receiptPath = join(keyRoot, `${candidateId}.receipt.json`);
        await this.assertCandidateOrdinalUnused(keyRoot, candidateId);
        await mkdir(keyRoot, { recursive: true });
        await writeFile(audioPath, Buffer.from(generated.bytes), {
            flag: 'wx',
        });

        const receipt = AudioCandidateReceiptV1Schema.parse({
            schemaVersion: 1,
            storyId: this.storyId,
            key: spec.key,
            type: spec.type,
            candidateId,
            spec,
            specSha256,
            provider: spec.provider,
            modelId: spec.modelId,
            createdAt: new Date(this.now()).toISOString(),
            intendedDurationMs: generated.intendedDurationMs ?? spec.durationMs,
            actualDurationMs: generated.actualDurationMs ?? null,
            output: {
                filename,
                mediaType,
                format: generated.format ?? mediaType,
                byteLength: generated.bytes.byteLength,
                sha256: sha256(generated.bytes),
            },
            providerMetadata: generated.providerMetadata ?? {},
        });

        const temporaryReceiptPath = `${receiptPath}.${randomUUID()}.tmp`;
        try {
            await assertMissing(receiptPath);
            await writeFile(temporaryReceiptPath, jsonBytes(receipt), {
                flag: 'wx',
            });
            await rename(temporaryReceiptPath, receiptPath);
        } finally {
            await rm(temporaryReceiptPath, { force: true });
        }
        return receipt;
    }

    async writeFailureMarker(input: {
        readonly candidateId: string;
        readonly spec: CurrentAudioGenerationSpec;
        readonly specSha256: string;
        readonly failure: AudioGenerationFailure;
    }): Promise<string> {
        const { candidateId, spec, specSha256, failure } = input;
        assertCandidateId(candidateId);
        assertSha256(specSha256);
        const keyRoot = this.keyRoot(spec.key);
        await this.assertCandidateOrdinalUnused(keyRoot, candidateId);
        await mkdir(keyRoot, { recursive: true });
        const markerPath = join(keyRoot, `${candidateId}.failure.json`);
        await writeFile(
            markerPath,
            jsonBytes({
                candidateId,
                storyId: this.storyId,
                key: spec.key,
                type: spec.type,
                spec,
                specSha256,
                createdAt: new Date(this.now()).toISOString(),
                failure: {
                    kind: failure.kind,
                    status: failure.status ?? null,
                    message: failure.message,
                },
            }),
            { flag: 'wx' }
        );
        return markerPath;
    }

    async readVerifiedCandidate(
        key: string,
        candidateId: string
    ): Promise<VerifiedStoredCandidate | null> {
        assertCandidateId(candidateId);
        const keyRoot = this.keyRoot(key);
        let receipt: AudioCandidateReceiptV1;
        try {
            const receiptText = await readFile(
                join(keyRoot, `${candidateId}.receipt.json`),
                'utf8'
            );
            receipt = AudioCandidateReceiptV1Schema.parse(
                JSON.parse(receiptText)
            );
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }

        if (
            receipt.storyId !== this.storyId ||
            receipt.key !== key ||
            receipt.candidateId !== candidateId ||
            !isCandidateFilename(candidateId, receipt.output.filename)
        ) {
            return null;
        }

        const audioPath = join(keyRoot, receipt.output.filename);
        let bytes: Buffer;
        try {
            bytes = await readFile(audioPath);
        } catch (error) {
            if (isNotFound(error)) return null;
            throw error;
        }
        if (
            bytes.byteLength !== receipt.output.byteLength ||
            sha256(bytes) !== receipt.output.sha256
        ) {
            return null;
        }

        return {
            candidateId,
            receipt,
            bytes: new Uint8Array(bytes),
            path: audioPath,
        };
    }

    async hasMusicTermsNote(): Promise<boolean> {
        try {
            return (
                (
                    await readFile(
                        join(this.root, 'music-terms-note.md'),
                        'utf8'
                    )
                ).trim().length > 0
            );
        } catch {
            return false;
        }
    }

    private keyRoot(key: string): string {
        return join(this.root, key);
    }

    private async assertCandidateOrdinalUnused(
        keyRoot: string,
        candidateId: string
    ): Promise<void> {
        let entries;
        try {
            entries = await readdir(keyRoot);
        } catch (error) {
            if (isNotFound(error)) return;
            throw error;
        }
        if (entries.some(entry => entry.startsWith(`${candidateId}.`))) {
            throw new Error(
                `Candidate ordinal is already occupied: ${candidateId}`
            );
        }
    }
}
