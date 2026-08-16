import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import type { AudioPlanV1 } from '../audio-plan';
import { isSha256, isStoryId } from '../runtime-assets';
import { audioGenerationSpecSha256, buildAudioGenerationSpec } from './spec';
import type { LocalAudioGenerationStore } from './store';

const SelectionSchema = z
    .object({
        candidateId: z.string().regex(/^candidate-\d{3}$/),
        specSha256: z.string().refine(isSha256),
        sourceSha256: z.string().refine(isSha256),
    })
    .strict();

export const AudioSelectionFileV1Schema = z
    .object({
        schemaVersion: z.literal(1),
        storyId: z.string().refine(isStoryId),
        selections: z.record(SelectionSchema),
    })
    .strict();

export type AudioSelectionFileV1 = z.infer<typeof AudioSelectionFileV1Schema>;

const CandidateIdSchema = z.string().regex(/^candidate-\d{3}$/);

function isNotFound(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
    );
}

function sourceSha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: AudioSelectionFileV1): string {
    return `${JSON.stringify(value, null, 2)}\n`;
}

async function readExistingSelection(
    selectionPath: string,
    storyId: string
): Promise<AudioSelectionFileV1> {
    let selectionText: string;
    try {
        selectionText = await readFile(selectionPath, 'utf8');
    } catch (error) {
        if (isNotFound(error)) {
            return AudioSelectionFileV1Schema.parse({
                schemaVersion: 1,
                storyId,
                selections: {},
            });
        }
        throw error;
    }

    let selection: AudioSelectionFileV1;
    try {
        selection = AudioSelectionFileV1Schema.parse(
            JSON.parse(selectionText) as unknown
        );
    } catch (cause) {
        throw new Error(`Invalid audio selection file: ${selectionPath}`, {
            cause,
        });
    }
    if (selection.storyId !== storyId) {
        throw new Error(
            `Audio selection story id does not match the verified candidate: ${selection.storyId}`
        );
    }
    return selection;
}

export async function selectAudioCandidate(
    store: LocalAudioGenerationStore,
    plan: AudioPlanV1,
    key: string,
    candidateId: string
): Promise<AudioSelectionFileV1> {
    CandidateIdSchema.parse(candidateId);

    const asset = plan.assets.find(item => item.key === key);
    if (asset === undefined) {
        throw new TypeError(`Unknown audio key: ${key}`);
    }

    const spec = buildAudioGenerationSpec(asset);
    const specSha256 = audioGenerationSpecSha256(spec);
    const candidate = await store.readVerifiedCandidate(key, candidateId);
    if (candidate === null) {
        throw new Error(
            `Audio candidate is missing or failed verification: ${key}/${candidateId}`
        );
    }
    if (candidate.receipt.specSha256 !== specSha256) {
        throw new Error(
            `Audio candidate has a stale spec hash: ${key}/${candidateId}`
        );
    }

    const selectionPath = join(
        dirname(dirname(candidate.path)),
        'selection.json'
    );
    const existing = await readExistingSelection(
        selectionPath,
        candidate.receipt.storyId
    );
    const selection = AudioSelectionFileV1Schema.parse({
        ...existing,
        selections: {
            ...existing.selections,
            [key]: {
                candidateId,
                specSha256,
                sourceSha256: sourceSha256(candidate.bytes),
            },
        },
    });

    const temporaryPath = `${selectionPath}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporaryPath, jsonBytes(selection), { flag: 'wx' });
        await rename(temporaryPath, selectionPath);
    } finally {
        await rm(temporaryPath, { force: true });
    }
    return selection;
}
