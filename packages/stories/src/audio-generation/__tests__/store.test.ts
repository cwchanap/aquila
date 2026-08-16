import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    unlink,
    writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as rootExports from '@aquila/stories';
import * as audioGenerationExports from '@aquila/stories/audio-generation';
import {
    AudioCandidateReceiptV1Schema,
    LocalAudioGenerationStore,
} from '../store';
import { audioGenerationSpecSha256, buildAudioGenerationSpec } from '../spec';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { force: true, recursive: true }))
    );
});

function validHistoricalReceipt() {
    return {
        schemaVersion: 1,
        storyId: 'the_seventh_mirror',
        key: 'dawn-apartment',
        type: 'bgm',
        candidateId: 'candidate-001',
        spec: {
            schemaVersion: 1,
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'old prompt',
            durationMs: 90_000,
            provider: 'elevenlabs',
            modelId: 'music_v3',
            outputFormat: 'future_format',
            loopIntent: true,
            forceInstrumental: true,
        },
        specSha256: 'a'.repeat(64),
        provider: 'elevenlabs',
        modelId: 'music_v3',
        createdAt: '2026-08-16T00:00:00.000Z',
        intendedDurationMs: 90_000,
        actualDurationMs: null,
        output: {
            filename: 'candidate-001.ogg',
            mediaType: 'audio/ogg',
            format: 'audio/ogg',
            byteLength: 4,
            sha256: 'b'.repeat(64),
        },
        providerMetadata: {},
    };
}

function currentSpec() {
    return buildAudioGenerationSpec({
        key: 'door-open',
        type: 'sfx',
        prompt: 'Heavy apartment door opening',
        durationMs: 2_200,
    });
}

function bytes() {
    return Uint8Array.from([0, 255, 1, 128]);
}

async function makeStore() {
    const root = await mkdtemp(join(tmpdir(), 'audio-generation-store-'));
    roots.push(root);
    return {
        root,
        store: new LocalAudioGenerationStore({
            root,
            storyId: 'the_seventh_mirror',
        }),
    };
}

describe('audio generation store contracts', () => {
    it('validates the runtime story id in the constructor', () => {
        expect(
            () =>
                new LocalAudioGenerationStore({
                    root: '/tmp/audio-generation-test',
                    storyId: 'The-Seventh-Mirror',
                })
        ).toThrow('Invalid runtime story id');
    });

    it('rejects invalid story ids and non-SHA-256 receipt digests', () => {
        const receipt = validHistoricalReceipt();

        expect(() =>
            AudioCandidateReceiptV1Schema.parse({
                ...receipt,
                storyId: 'The-Seventh-Mirror',
            })
        ).toThrow();
        expect(() =>
            AudioCandidateReceiptV1Schema.parse({
                ...receipt,
                specSha256: 'A'.repeat(64),
            })
        ).toThrow();
        expect(() =>
            AudioCandidateReceiptV1Schema.parse({
                ...receipt,
                output: { ...receipt.output, sha256: 'not-a-sha256' },
            })
        ).toThrow();
    });

    it('parses historical receipts with changed provider settings', () => {
        expect(() =>
            AudioCandidateReceiptV1Schema.parse(validHistoricalReceipt())
        ).not.toThrow();
    });

    it('rejects unknown receipt fields and schema versions', () => {
        const receipt = validHistoricalReceipt();

        expect(() =>
            AudioCandidateReceiptV1Schema.parse({
                ...receipt,
                unexpected: true,
            })
        ).toThrow();
        expect(() =>
            AudioCandidateReceiptV1Schema.parse({
                ...receipt,
                schemaVersion: 2,
            })
        ).toThrow();
    });

    it('does not treat tampered or missing bytes as successful', async () => {
        const { root, store } = await makeStore();
        const spec = currentSpec();
        const specSha256 = audioGenerationSpecSha256(spec);
        const receipt = await store.writeSuccess({
            candidateId: 'candidate-001',
            spec,
            specSha256,
            generated: {
                bytes: bytes(),
                mediaType: 'audio/mpeg',
                actualDurationMs: null,
            },
        });
        const audioPath = join(spec.key, receipt.output.filename);

        expect(await readFile(join(root, audioPath))).toEqual(
            Buffer.from(bytes())
        );
        expect(
            await store.readVerifiedCandidate(spec.key, 'candidate-001')
        ).not.toBeNull();

        await writeFile(
            join(root, audioPath),
            Uint8Array.from([0, 255, 1, 129])
        );
        expect(
            await store.readVerifiedCandidate(spec.key, 'candidate-001')
        ).toBeNull();
        expect(
            await store.matchingSuccessfulCandidates(spec.key, specSha256)
        ).toEqual([]);

        await unlink(join(root, audioPath));
        expect(
            await store.readVerifiedCandidate(spec.key, 'candidate-001')
        ).toBeNull();
    });

    it('re-hashes actual bytes while finding matching successful candidates', async () => {
        const { root, store } = await makeStore();
        const spec = currentSpec();
        const specSha256 = audioGenerationSpecSha256(spec);
        const receipt = await store.writeSuccess({
            candidateId: 'candidate-001',
            spec,
            specSha256,
            generated: {
                bytes: bytes(),
                mediaType: 'audio/mpeg',
                actualDurationMs: null,
            },
        });

        expect(
            await store.matchingSuccessfulCandidates(spec.key, specSha256)
        ).toHaveLength(1);

        await writeFile(
            join(root, spec.key, receipt.output.filename),
            Uint8Array.from([0, 255, 1, 127])
        );
        expect(
            await store.matchingSuccessfulCandidates(spec.key, specSha256)
        ).toHaveLength(0);
    });

    it('lets success, failure, and orphan filenames consume ordinals', async () => {
        const { root, store } = await makeStore();
        const spec = currentSpec();
        const specSha256 = audioGenerationSpecSha256(spec);

        await store.writeSuccess({
            candidateId: 'candidate-001',
            spec,
            specSha256,
            generated: {
                bytes: bytes(),
                mediaType: 'audio/mpeg',
                actualDurationMs: null,
            },
        });
        await store.writeFailureMarker({
            candidateId: 'candidate-002',
            spec,
            specSha256,
            failure: {
                kind: 'provider',
                status: 500,
                message: 'provider failed',
            },
        });
        await writeFile(join(root, spec.key, 'candidate-003.wav'), bytes());

        await expect(store.nextCandidateId(spec.key)).resolves.toBe(
            'candidate-004'
        );
    });

    it('does not parse failure markers as receipt contracts', async () => {
        const { root, store } = await makeStore();
        const keyRoot = join(root, 'door-open');
        await mkdir(keyRoot, { recursive: true });
        await writeFile(
            join(keyRoot, 'candidate-001.failure.json'),
            'this is an intentionally unparsed audit marker'
        );

        await expect(store.nextCandidateId('door-open')).resolves.toBe(
            'candidate-002'
        );
    });

    it('resolves the Node subpath without adding generation APIs to the root', () => {
        expect(Object.keys(audioGenerationExports).sort()).toEqual([
            'AudioCandidateReceiptV1Schema',
            'LocalAudioGenerationStore',
            'StoredAudioGenerationSpecV1Schema',
        ]);
        expect(rootExports).not.toHaveProperty('LocalAudioGenerationStore');
        expect(rootExports).not.toHaveProperty('AudioCandidateReceiptV1Schema');
    });

    it('reports only non-empty music terms notes', async () => {
        const { root, store } = await makeStore();

        await expect(store.hasMusicTermsNote()).resolves.toBe(false);
        await writeFile(join(root, 'music-terms-note.md'), '   \n');
        await expect(store.hasMusicTermsNote()).resolves.toBe(false);
        await writeFile(
            join(root, 'music-terms-note.md'),
            'Account checked.\n'
        );
        await expect(store.hasMusicTermsNote()).resolves.toBe(true);
    });
});
