import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AudioPlanAsset, AudioPlanV1 } from '../../audio-plan';
import { audioGenerationSpecSha256, buildAudioGenerationSpec } from '../spec';
import { LocalAudioGenerationStore } from '../store';
import { AudioSelectionFileV1Schema, selectAudioCandidate } from '../select';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { force: true, recursive: true }))
    );
});

function sfx(key: string, prompt = `${key} prompt`): AudioPlanAsset {
    return {
        key,
        type: 'sfx',
        prompt,
        durationMs: 2_200,
    };
}

function plan(...assets: AudioPlanAsset[]): AudioPlanV1 {
    return { schemaVersion: 1, assets };
}

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

async function makeStore() {
    const root = await mkdtemp(join(tmpdir(), 'audio-generation-select-'));
    roots.push(root);
    return {
        root,
        store: new LocalAudioGenerationStore({
            root,
            storyId: 'the_seventh_mirror',
        }),
    };
}

async function writeCandidate(
    store: LocalAudioGenerationStore,
    asset: AudioPlanAsset,
    candidateId: string,
    bytes: Uint8Array
) {
    const spec = buildAudioGenerationSpec(asset);
    const specSha256 = audioGenerationSpecSha256(spec);
    await store.writeSuccess({
        candidateId,
        spec,
        specSha256,
        generated: {
            bytes,
            mediaType: 'audio/mpeg',
            actualDurationMs: null,
        },
    });
    return { specSha256, sourceSha256: sha256(bytes) };
}

describe('audio selection file contract', () => {
    it('rejects unknown fields, versions, hashes, story ids, and candidate ids', () => {
        const valid = {
            schemaVersion: 1,
            storyId: 'the_seventh_mirror',
            selections: {
                'door-open': {
                    candidateId: 'candidate-001',
                    specSha256: 'a'.repeat(64),
                    sourceSha256: 'b'.repeat(64),
                },
            },
        };

        expect(() =>
            AudioSelectionFileV1Schema.parse({ ...valid, unexpected: true })
        ).toThrow();
        expect(() =>
            AudioSelectionFileV1Schema.parse({ ...valid, schemaVersion: 2 })
        ).toThrow();
        expect(() =>
            AudioSelectionFileV1Schema.parse({
                ...valid,
                selections: {
                    ...valid.selections,
                    'door-open': {
                        ...valid.selections['door-open'],
                        specSha256: 'not-a-sha256',
                    },
                },
            })
        ).toThrow();
        expect(() =>
            AudioSelectionFileV1Schema.parse({
                ...valid,
                selections: {
                    ...valid.selections,
                    'door-open': {
                        ...valid.selections['door-open'],
                        sourceSha256: 'C'.repeat(64),
                    },
                },
            })
        ).toThrow();
        expect(() =>
            AudioSelectionFileV1Schema.parse({
                ...valid,
                storyId: 'The-Seventh-Mirror',
            })
        ).toThrow();
        expect(() =>
            AudioSelectionFileV1Schema.parse({
                ...valid,
                selections: {
                    ...valid.selections,
                    'door-open': {
                        ...valid.selections['door-open'],
                        candidateId: 'candidate-0001',
                    },
                },
            })
        ).toThrow();
        expect(() =>
            AudioSelectionFileV1Schema.parse({
                ...valid,
                selections: {
                    '../escape': valid.selections['door-open'],
                },
            })
        ).toThrow(/key/i);
    });

    it('writes one verified current-spec selection entry', async () => {
        const { root, store } = await makeStore();
        const asset = sfx('door-open');
        const bytes = Uint8Array.from([0, 255, 1, 128]);
        const hashes = await writeCandidate(
            store,
            asset,
            'candidate-001',
            bytes
        );

        await expect(
            selectAudioCandidate(store, plan(asset), asset.key, 'candidate-001')
        ).resolves.toEqual({
            schemaVersion: 1,
            storyId: 'the_seventh_mirror',
            selections: {
                [asset.key]: {
                    candidateId: 'candidate-001',
                    specSha256: hashes.specSha256,
                    sourceSha256: hashes.sourceSha256,
                },
            },
        });

        await expect(
            readFile(join(root, 'selection.json'), 'utf8')
        ).resolves.toBe(
            JSON.stringify(
                {
                    schemaVersion: 1,
                    storyId: 'the_seventh_mirror',
                    selections: {
                        [asset.key]: {
                            candidateId: 'candidate-001',
                            specSha256: hashes.specSha256,
                            sourceSha256: hashes.sourceSha256,
                        },
                    },
                },
                null,
                2
            ) + '\n'
        );
    });

    it('rejects an unknown plan key before looking up a candidate', async () => {
        const { store } = await makeStore();

        await expect(
            selectAudioCandidate(
                store,
                plan(sfx('known')),
                'missing',
                'candidate-001'
            )
        ).rejects.toThrow(TypeError);
    });

    it('rejects a stale candidate spec before creating a selection', async () => {
        const { root, store } = await makeStore();
        const currentAsset = sfx('door-open');
        await writeCandidate(
            store,
            sfx('door-open', 'old prompt'),
            'candidate-001',
            Uint8Array.from([1, 2, 3])
        );

        await expect(
            selectAudioCandidate(
                store,
                plan(currentAsset),
                currentAsset.key,
                'candidate-001'
            )
        ).rejects.toThrow(/spec hash/i);
        await expect(
            readFile(join(root, 'selection.json'))
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('rejects tampered source bytes through candidate verification', async () => {
        const { root, store } = await makeStore();
        const asset = sfx('door-open');
        const receipt = await store.writeSuccess({
            candidateId: 'candidate-001',
            spec: buildAudioGenerationSpec(asset),
            specSha256: audioGenerationSpecSha256(
                buildAudioGenerationSpec(asset)
            ),
            generated: {
                bytes: Uint8Array.from([1, 2, 3]),
                mediaType: 'audio/mpeg',
                actualDurationMs: null,
            },
        });
        await writeFile(
            join(root, asset.key, receipt.output.filename),
            Uint8Array.from([1, 2, 4])
        );

        await expect(
            selectAudioCandidate(store, plan(asset), asset.key, 'candidate-001')
        ).rejects.toThrow(/failed verification/i);
        await expect(
            readFile(join(root, 'selection.json'))
        ).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('atomically replaces the selected candidate for the same key', async () => {
        const { root, store } = await makeStore();
        const asset = sfx('door-open');
        const firstBytes = Uint8Array.from([1, 2, 3]);
        const secondBytes = Uint8Array.from([4, 5, 6]);
        await writeCandidate(store, asset, 'candidate-001', firstBytes);
        const second = await writeCandidate(
            store,
            asset,
            'candidate-002',
            secondBytes
        );

        await selectAudioCandidate(
            store,
            plan(asset),
            asset.key,
            'candidate-001'
        );
        await selectAudioCandidate(
            store,
            plan(asset),
            asset.key,
            'candidate-002'
        );

        const selection = AudioSelectionFileV1Schema.parse(
            JSON.parse(await readFile(join(root, 'selection.json'), 'utf8'))
        );
        expect(selection.selections[asset.key]).toEqual({
            candidateId: 'candidate-002',
            specSha256: second.specSha256,
            sourceSha256: second.sourceSha256,
        });
        expect(
            (await readdir(root)).filter(entry => entry.endsWith('.tmp'))
        ).toEqual([]);
    });

    it('preserves selections for other keys while replacing one key', async () => {
        const { root, store } = await makeStore();
        const first = sfx('door-open');
        const second = sfx('window-open');
        const firstHashes = await writeCandidate(
            store,
            first,
            'candidate-001',
            Uint8Array.from([1, 2, 3])
        );
        const secondHashes = await writeCandidate(
            store,
            second,
            'candidate-001',
            Uint8Array.from([4, 5, 6])
        );

        await selectAudioCandidate(
            store,
            plan(first, second),
            first.key,
            'candidate-001'
        );
        await selectAudioCandidate(
            store,
            plan(first, second),
            second.key,
            'candidate-001'
        );

        await expect(
            readFile(join(root, 'selection.json'), 'utf8')
        ).resolves.toContain(firstHashes.sourceSha256);
        expect(
            AudioSelectionFileV1Schema.parse(
                JSON.parse(await readFile(join(root, 'selection.json'), 'utf8'))
            ).selections
        ).toEqual({
            [first.key]: {
                candidateId: 'candidate-001',
                specSha256: firstHashes.specSha256,
                sourceSha256: firstHashes.sourceSha256,
            },
            [second.key]: {
                candidateId: 'candidate-001',
                specSha256: secondHashes.specSha256,
                sourceSha256: secondHashes.sourceSha256,
            },
        });
    });

    it('does not replace a corrupt existing selection file', async () => {
        const { root, store } = await makeStore();
        const asset = sfx('door-open');
        await writeCandidate(
            store,
            asset,
            'candidate-001',
            Uint8Array.from([1, 2, 3])
        );
        await writeFile(join(root, 'selection.json'), '{"schemaVersion":2}\n');

        await expect(
            selectAudioCandidate(store, plan(asset), asset.key, 'candidate-001')
        ).rejects.toThrow(/selection/i);
        await expect(
            readFile(join(root, 'selection.json'), 'utf8')
        ).resolves.toBe('{"schemaVersion":2}\n');
    });

    it('preserves both updates when two keys are selected concurrently', async () => {
        const { root, store } = await makeStore();
        const first = sfx('door-open');
        const second = sfx('window-open');
        const firstHashes = await writeCandidate(
            store,
            first,
            'candidate-001',
            Uint8Array.from([1, 2, 3])
        );
        const secondHashes = await writeCandidate(
            store,
            second,
            'candidate-001',
            Uint8Array.from([4, 5, 6])
        );

        await Promise.all([
            selectAudioCandidate(
                store,
                plan(first, second),
                first.key,
                'candidate-001'
            ),
            selectAudioCandidate(
                store,
                plan(first, second),
                second.key,
                'candidate-001'
            ),
        ]);

        const selection = AudioSelectionFileV1Schema.parse(
            JSON.parse(await readFile(join(root, 'selection.json'), 'utf8'))
        );
        expect(selection.selections).toEqual({
            [first.key]: {
                candidateId: 'candidate-001',
                specSha256: firstHashes.specSha256,
                sourceSha256: firstHashes.sourceSha256,
            },
            [second.key]: {
                candidateId: 'candidate-001',
                specSha256: secondHashes.specSha256,
                sourceSha256: secondHashes.sourceSha256,
            },
        });
        expect(
            (await readdir(root)).filter(entry => entry.endsWith('.lock'))
        ).toEqual([]);
    });

    it('reclaims a stale lock left by a crashed process', async () => {
        const { root, store } = await makeStore();
        const asset = sfx('door-open');
        const hashes = await writeCandidate(
            store,
            asset,
            'candidate-001',
            Uint8Array.from([1, 2, 3])
        );
        // Plant a stale lock owned by a PID that is guaranteed not to exist.
        // 0x7FFFFFFF is the max signed 32-bit int; no real process has it.
        await writeFile(
            join(root, 'selection.json.lock'),
            JSON.stringify({ pid: 0x7fffffff, token: 'stale-owner' })
        );

        await expect(
            selectAudioCandidate(store, plan(asset), asset.key, 'candidate-001')
        ).resolves.toEqual({
            schemaVersion: 1,
            storyId: 'the_seventh_mirror',
            selections: {
                [asset.key]: {
                    candidateId: 'candidate-001',
                    specSha256: hashes.specSha256,
                    sourceSha256: hashes.sourceSha256,
                },
            },
        });
        expect(
            (await readdir(root)).filter(entry => entry.endsWith('.lock'))
        ).toEqual([]);
    });
});
