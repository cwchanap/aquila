import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
    LocalAudioGenerationStore,
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
} from '@aquila/stories/audio-generation';
import type { AudioPlanV1 } from '@aquila/stories';
import { prepareAudioSources, sourceArchiveCandidates } from '../audio-source';

const storiesRawRoot = fileURLToPath(
    new URL('../../../../stories/raw/', import.meta.url)
);
const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

async function makeFixture(): Promise<{
    storyFolder: string;
    generationRoot: string;
    omissionsPath: string;
    selectionPath: string;
    candidateBytes: Uint8Array;
    receiptPath: string;
}> {
    const rawDir = await mkdtemp(join(storiesRawRoot, 'audio-source-'));
    const generationRoot = await mkdtemp(join('/tmp', 'aquila-audio-source-'));
    roots.push(rawDir, generationRoot);
    const storyFolder = basename(rawDir);
    const storyId = 'fixture_story';
    const plan: AudioPlanV1 = {
        schemaVersion: 1,
        assets: [
            {
                key: 'door-open',
                type: 'sfx',
                prompt: 'Heavy apartment door opening',
                durationMs: 2200,
            },
            {
                key: 'selected-unused',
                type: 'sfx',
                prompt: 'A selected cue not used by the story',
                durationMs: 900,
            },
            {
                key: 'plan-unused',
                type: 'sfx',
                prompt: 'A plan row not used by the story',
                durationMs: 900,
            },
        ],
    };
    await mkdir(join(rawDir, 'docs'), { recursive: true });
    await writeFile(
        join(rawDir, 'compiler.config.ts'),
        `export default { storyId: '${storyId}', defaultSpeakerId: 'narrator' };\n`
    );
    await writeFile(
        join(rawDir, 'docs', 'characters.md'),
        [
            '## 1. 旁白（Narrator）',
            '',
            '- **ID**: `narrator`',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: fixture narrator',
        ].join('\n')
    );
    await writeFile(
        join(rawDir, 'docs', 'audio-plan.json'),
        JSON.stringify(plan)
    );
    await writeFile(
        join(rawDir, 'act1.md'),
        [
            '# 第一幕：Fixture',
            '',
            '```sfx',
            'door-open',
            '```',
            '',
            '**旁白**：Door.',
        ].join('\n')
    );

    const storyGenerationRoot = join(generationRoot, storyFolder);
    const store = new LocalAudioGenerationStore({
        root: storyGenerationRoot,
        storyId,
    });
    const candidateBytes = Uint8Array.from([1, 2, 3, 4]);
    const doorSpec = buildAudioGenerationSpec(plan.assets[0]);
    const doorReceipt = await store.writeSuccess({
        candidateId: 'candidate-001',
        spec: doorSpec,
        specSha256: audioGenerationSpecSha256(doorSpec),
        generated: {
            bytes: candidateBytes,
            mediaType: 'audio/mpeg',
            filename: 'candidate-001.mp3',
        },
    });
    const selectedUnusedSpec = buildAudioGenerationSpec(plan.assets[1]);
    await store.writeSuccess({
        candidateId: 'candidate-001',
        spec: selectedUnusedSpec,
        specSha256: audioGenerationSpecSha256(selectedUnusedSpec),
        generated: {
            bytes: Uint8Array.from([5, 6, 7]),
            mediaType: 'audio/ogg',
            filename: 'candidate-001.ogg',
        },
    });

    const selectionPath = join(storyGenerationRoot, 'selection.json');
    await writeFile(
        selectionPath,
        `${JSON.stringify({
            schemaVersion: 1,
            storyId,
            selections: {
                'door-open': {
                    candidateId: 'candidate-001',
                    specSha256: audioGenerationSpecSha256(doorSpec),
                    sourceSha256: sha256(candidateBytes),
                },
                'selected-unused': {
                    candidateId: 'candidate-001',
                    specSha256: audioGenerationSpecSha256(selectedUnusedSpec),
                    sourceSha256: sha256(Uint8Array.from([5, 6, 7])),
                },
            },
        })}\n`
    );
    const omissionsPath = join(rawDir, 'docs', 'audio-omissions.json');
    const receiptPath = join(
        storyGenerationRoot,
        'door-open',
        doorReceipt.candidateId + '.receipt.json'
    );
    return {
        storyFolder,
        generationRoot,
        omissionsPath,
        selectionPath,
        candidateBytes,
        receiptPath,
    };
}

function input(fixture: Awaited<ReturnType<typeof makeFixture>>) {
    return {
        storyFolder: fixture.storyFolder,
        expectedStoryId: 'fixture_story',
        generationRoot: fixture.generationRoot,
        omissionsPath: fixture.omissionsPath,
    } as const;
}

async function writeOmissions(
    fixture: Awaited<ReturnType<typeof makeFixture>>,
    omissions: Record<string, string>,
    storyId = 'fixture_story'
): Promise<void> {
    await writeFile(
        fixture.omissionsPath,
        `${JSON.stringify({ schemaVersion: 1, storyId, omissions })}\n`
    );
}

describe('prepareAudioSources', () => {
    it('loads compiler usage, verifies selected handoff data, and redacts coverage metadata', async () => {
        const fixture = await makeFixture();

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.storyId).toBe('fixture_story');
        expect(plan.sources).toHaveLength(1);
        expect(plan.sources[0]).toMatchObject({
            type: 'sfx',
            key: 'door-open',
            plannedDurationMs: 2200,
            loop: false,
            candidateId: 'candidate-001',
            sourceSha256: sha256(fixture.candidateBytes),
            sourceFilename: 'candidate-001.mp3',
            sourceMediaType: 'audio/mpeg',
        });
        expect(plan.sources[0]?.sourceBytes).toEqual(fixture.candidateBytes);
        expect(plan.coverage).toContainEqual({
            type: 'sfx',
            key: 'door-open',
            usageCount: 1,
            disposition: 'included',
        });
        expect(plan.coverage[0]).not.toHaveProperty('candidateId');
        expect(plan.coverage[0]).not.toHaveProperty('sourceSha256');
        expect(plan.coverage[0]).not.toHaveProperty('receiptBytes');
        expect(plan.selectedUnusedKeys).toEqual(['selected-unused']);
        expect(plan.unusedPlanKeys).toEqual(['plan-unused', 'selected-unused']);
    });

    it('uses explicit omissions and emits only the public omission fields', async () => {
        const fixture = await makeFixture();
        const selection = JSON.parse(
            await readFile(fixture.selectionPath, 'utf8')
        ) as { selections: Record<string, unknown> };
        delete selection.selections['door-open'];
        await writeFile(fixture.selectionPath, JSON.stringify(selection));
        await writeOmissions(fixture, {
            'door-open': ' Defer until the next audio pass ',
        });

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.sources).toEqual([]);
        expect(plan.coverage).toContainEqual({
            type: 'sfx',
            key: 'door-open',
            usageCount: 1,
            disposition: 'omitted',
            reason: 'Defer until the next audio pass',
        });
    });

    it.each([
        [
            'selection story mismatch',
            async (fixture: Awaited<ReturnType<typeof makeFixture>>) => {
                const text = await readFile(fixture.selectionPath, 'utf8');
                await writeFile(
                    fixture.selectionPath,
                    text.replace('fixture_story', 'other_story')
                );
            },
        ],
        [
            'stale selection spec hash',
            async (fixture: Awaited<ReturnType<typeof makeFixture>>) => {
                const text = await readFile(fixture.selectionPath, 'utf8');
                await writeFile(
                    fixture.selectionPath,
                    text.replace(
                        /"specSha256":"[a-f0-9]{64}"/,
                        `"specSha256":"${'a'.repeat(64)}"`
                    )
                );
            },
        ],
        [
            'bad source digest',
            async (fixture: Awaited<ReturnType<typeof makeFixture>>) => {
                const text = await readFile(fixture.selectionPath, 'utf8');
                await writeFile(
                    fixture.selectionPath,
                    text.replace(
                        /"sourceSha256":"[a-f0-9]{64}"/,
                        `"sourceSha256":"${'b'.repeat(64)}"`
                    )
                );
            },
        ],
        [
            'missing candidate bytes',
            async (fixture: Awaited<ReturnType<typeof makeFixture>>) => {
                await rm(
                    join(
                        fixture.generationRoot,
                        fixture.storyFolder,
                        'door-open',
                        'candidate-001.mp3'
                    )
                );
            },
        ],
        [
            'tampered receipt',
            async (fixture: Awaited<ReturnType<typeof makeFixture>>) => {
                const text = await readFile(fixture.receiptPath, 'utf8');
                await writeFile(
                    fixture.receiptPath,
                    text.replace('door-open', 'other-key')
                );
            },
        ],
    ])('rejects %s before producing a source plan', async (_label, mutate) => {
        const fixture = await makeFixture();
        await mutate(fixture);

        await expect(prepareAudioSources(input(fixture))).rejects.toMatchObject(
            {
                name: 'PublisherError',
                code: 'source',
            }
        );
    });

    it('rejects a used cue that is neither selected nor omitted', async () => {
        const fixture = await makeFixture();
        const text = await readFile(fixture.selectionPath, 'utf8');
        const selection = JSON.parse(text) as {
            selections: Record<string, unknown>;
        };
        delete selection.selections['door-open'];
        await writeFile(fixture.selectionPath, JSON.stringify(selection));

        await expect(prepareAudioSources(input(fixture))).rejects.toMatchObject(
            {
                name: 'PublisherError',
                code: 'coverage',
            }
        );
    });

    it('rejects selected and omitted keys, unknown omissions, and empty reasons', async () => {
        const fixture = await makeFixture();

        await writeOmissions(fixture, { 'door-open': 'keep' });
        await expect(prepareAudioSources(input(fixture))).rejects.toMatchObject(
            {
                name: 'PublisherError',
                code: 'coverage',
            }
        );

        await writeOmissions(fixture, { unknown: 'keep' });
        await expect(prepareAudioSources(input(fixture))).rejects.toMatchObject(
            {
                name: 'PublisherError',
                code: 'coverage',
            }
        );

        await writeOmissions(fixture, { 'door-open': '   ' });
        await expect(prepareAudioSources(input(fixture))).rejects.toMatchObject(
            {
                name: 'PublisherError',
                code: 'input',
            }
        );
    });
});

describe('sourceArchiveCandidates', () => {
    it('archives exact source and receipt bytes privately with safe immutable keys', async () => {
        const fixture = await makeFixture();
        const plan = await prepareAudioSources(input(fixture));
        const candidates = sourceArchiveCandidates(plan);

        expect(candidates).toHaveLength(2);
        expect(candidates.map(candidate => candidate.key)).toEqual([
            `audio/approved/fixture_story/sfx/door-open/${sha256(fixture.candidateBytes)}/source.mp3`,
            `audio/approved/fixture_story/sfx/door-open/${sha256(fixture.candidateBytes)}/receipt.json`,
        ]);
        expect(candidates).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'source',
                    contentType: 'audio/mpeg',
                    cacheControl: 'private, max-age=0, no-store',
                    bytes: fixture.candidateBytes,
                }),
                expect.objectContaining({
                    kind: 'source',
                    contentType: 'application/json',
                    cacheControl: 'private, max-age=0, no-store',
                    bytes: new Uint8Array(await readFile(fixture.receiptPath)),
                }),
            ])
        );
    });
});
