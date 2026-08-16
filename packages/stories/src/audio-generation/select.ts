import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { AudioPlanKeySchema, type AudioPlanV1 } from '../audio-plan';
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
        selections: z
            .record(SelectionSchema)
            .refine(
                selections =>
                    Object.keys(selections).every(
                        key => AudioPlanKeySchema.safeParse(key).success
                    ),
                'Selection keys must be valid audio cue keys'
            ),
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

function isEexist(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EEXIST'
    );
}

const LOCK_RETRY_DELAYS_MS = [10, 20, 40, 80, 160, 320, 640] as const;
const LOCK_RETRY_COUNT = 100;
const LOCK_STALE_AGE_MS = 5 * 60 * 1000;

function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // ESRCH: no such process. EINVAL: PID out of range for the OS.
        // Both mean the lock owner is not a live process we can identify.
        // EPERM: process exists but we lack permission — treat as alive.
        return code !== 'ESRCH' && code !== 'EINVAL';
    }
}

async function isLockStale(lockPath: string): Promise<boolean> {
    let content: string;
    try {
        content = await readFile(lockPath, 'utf8');
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
    const pid = Number.parseInt(content.trim(), 10);
    if (Number.isSafeInteger(pid) && pid > 0) {
        return !isProcessAlive(pid);
    }
    let info;
    try {
        info = await stat(lockPath);
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
    return Date.now() - info.mtimeMs > LOCK_STALE_AGE_MS;
}

/**
 * Acquires a story-local, cross-process lock guarding the selection.json
 * read-modify-write. Returns a release function that removes the lock file.
 * Bounded retries ensure a held lock eventually surfaces as an error rather
 * than hanging forever. A lock left behind by a crashed process is reclaimed
 * when its owner PID is no longer alive (or, if the PID is unparseable, after
 * the lock file exceeds LOCK_STALE_AGE_MS in age).
 */
async function acquireSelectionLock(
    lockPath: string
): Promise<() => Promise<void>> {
    for (let attempt = 0; attempt <= LOCK_RETRY_COUNT; attempt += 1) {
        try {
            await writeFile(lockPath, String(process.pid), { flag: 'wx' });
            return async () => {
                await rm(lockPath, { force: true });
            };
        } catch (error) {
            if (!isEexist(error)) {
                throw error;
            }
        }
        if (await isLockStale(lockPath)) {
            await rm(lockPath, { force: true });
            continue;
        }
        if (attempt === LOCK_RETRY_COUNT) {
            throw new Error(
                `Unable to acquire audio selection lock: ${lockPath}`
            );
        }
        const delay =
            LOCK_RETRY_DELAYS_MS[
                Math.min(attempt, LOCK_RETRY_DELAYS_MS.length - 1)
            ];
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    throw new Error('Unreachable selection lock state');
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

    const selectionDir = dirname(dirname(candidate.path));
    const selectionPath = join(selectionDir, 'selection.json');
    const releaseLock = await acquireSelectionLock(
        join(selectionDir, 'selection.json.lock')
    );
    try {
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
            await writeFile(temporaryPath, jsonBytes(selection), {
                flag: 'wx',
            });
            await rename(temporaryPath, selectionPath);
        } finally {
            await rm(temporaryPath, { force: true });
        }
        return selection;
    } finally {
        await releaseLock();
    }
}
