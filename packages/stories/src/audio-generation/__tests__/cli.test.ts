import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AudioGenerationProvider } from '../elevenlabs';
import { ElevenLabsProviderError } from '../elevenlabs';
import { audioGenerationSpecSha256, buildAudioGenerationSpec } from '../spec';
import { LocalAudioGenerationStore } from '../store';
import {
    AudioGenerationError,
    audioGenerationExitCode,
    runCli,
    type AudioGenerationCliIO,
} from '../cli';
import {
    loadAudioGenerationStoryContext,
    type AudioGenerationStoryContext,
} from '../run';
import { cannotEnforceFilePermissions } from './permission-guard';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { force: true, recursive: true }))
    );
});

function capture(
    overrides: Partial<AudioGenerationCliIO> = {}
): AudioGenerationCliIO & {
    readonly stdoutText: () => string;
    readonly stderrText: () => string;
    readonly exitCodes: number[];
} {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const exitCodes: number[] = [];
    return {
        stdout: { write: chunk => stdout.push(chunk) },
        stderr: { write: chunk => stderr.push(chunk) },
        exit: code => exitCodes.push(code),
        ...overrides,
        stdoutText: () => stdout.join(''),
        stderrText: () => stderr.join(''),
        exitCodes,
    };
}

async function invoke(
    argv: string[],
    overrides: Partial<AudioGenerationCliIO> = {}
) {
    const io = capture(overrides);
    const code = await runCli(argv, io);
    return {
        code,
        io,
        report: JSON.parse(io.stdoutText()) as Record<string, any>,
    };
}

async function tempStoreRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'audio-generation-cli-'));
    roots.push(root);
    return root;
}

async function tempStoryFolder(
    plan: string
): Promise<{ storyFolder: string; rawRoot: string }> {
    const rawRoot = await mkdtemp(join(tmpdir(), 'audio-generation-cli-raw-'));
    roots.push(rawRoot);
    const storyFolder = basename(await mkdtemp(join(rawRoot, 'story-')));
    const storyDir = join(rawRoot, storyFolder);
    await mkdir(join(storyDir, 'docs'), { recursive: true });
    await writeFile(
        join(storyDir, 'compiler.config.ts'),
        "export default { storyId: 'the_seventh_mirror' };\n"
    );
    await writeFile(join(storyDir, 'docs', 'audio-plan.json'), plan);
    return { storyFolder, rawRoot };
}

function generatedCandidate() {
    return {
        bytes: Uint8Array.from([0x49, 0x44, 0x33]),
        mediaType: 'audio/mpeg',
        actualDurationMs: null,
    };
}

describe('audio generation CLI exit codes and argument validation', () => {
    it('maps the stable error taxonomy and unknown errors exactly', () => {
        expect(
            audioGenerationExitCode(
                new AudioGenerationError('configuration', 'bad usage')
            )
        ).toBe(1);
        expect(
            audioGenerationExitCode(
                new AudioGenerationError('input', 'bad plan')
            )
        ).toBe(2);
        expect(
            audioGenerationExitCode(
                new AudioGenerationError('provider', 'provider failed')
            )
        ).toBe(3);
        expect(audioGenerationExitCode(new Error('unexpected'))).toBe(3);
    });

    it.each([
        ['missing command', []],
        ['unknown command', ['wat']],
        ['missing story', ['generate', '--missing', '--dry-run']],
        [
            'unknown story',
            ['generate', '--story', 'not-a-story', '--missing', '--dry-run'],
        ],
        [
            'story path traversal',
            [
                'generate',
                '--story',
                '../theSeventhMirror',
                '--missing',
                '--dry-run',
            ],
        ],
        [
            'both target modes',
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--missing',
                '--dry-run',
            ],
        ],
        [
            'no target mode',
            ['generate', '--story', 'theSeventhMirror', '--dry-run'],
        ],
        [
            'removed force flag',
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--missing',
                '--force',
                '--dry-run',
            ],
        ],
        [
            'candidate count below range',
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--missing',
                '--candidate-count',
                '0',
                '--dry-run',
            ],
        ],
        [
            'candidate count above range',
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--missing',
                '--candidate-count',
                '5',
                '--dry-run',
            ],
        ],
        [
            'paid generation without a request cap',
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
            ],
        ],
    ])('returns exit 1 for %s', async (_label, argv) => {
        const { code, io } = await invoke(argv);

        expect(code).toBe(1);
        expect(io.exitCodes).toEqual([1]);
        expect(io.stderrText()).toMatch(/./);
    });

    it('rejects story paths that are not single safe directory components', async () => {
        const { code, report } = await invoke([
            'generate',
            '--story',
            '../theSeventhMirror',
            '--missing',
            '--dry-run',
        ]);

        expect(code).toBe(1);
        expect(report.error.message).toMatch(/single safe directory component/);
    });

    it.each([
        ['malformed JSON', '{ not json'],
        [
            'schema-invalid JSON',
            JSON.stringify({ schemaVersion: 2, assets: [] }),
        ],
    ])('returns exit 2 for %s audio plans', async (_label, plan) => {
        const { storyFolder, rawRoot } = await tempStoryFolder(plan);
        const { code, io, report } = await invoke(
            ['generate', '--story', storyFolder, '--missing', '--dry-run'],
            {
                loadStoryContext: folder =>
                    loadAudioGenerationStoryContext(folder, rawRoot),
            }
        );

        expect(code).toBe(2);
        expect(io.exitCodes).toEqual([2]);
        expect(report.error.code).toBe('input');
    });

    it.skipIf(cannotEnforceFilePermissions)(
        'returns exit 3 when the audio plan cannot be read',
        async () => {
            const { storyFolder, rawRoot } = await tempStoryFolder(
                JSON.stringify({ schemaVersion: 1, assets: [] })
            );
            const planPath = join(
                rawRoot,
                storyFolder,
                'docs',
                'audio-plan.json'
            );
            await chmod(planPath, 0o000);
            try {
                const { code, io, report } = await invoke(
                    [
                        'generate',
                        '--story',
                        storyFolder,
                        '--missing',
                        '--dry-run',
                    ],
                    {
                        loadStoryContext: folder =>
                            loadAudioGenerationStoryContext(folder, rawRoot),
                    }
                );

                expect(code).toBe(3);
                expect(io.exitCodes).toEqual([3]);
                expect(report.error.code).toBe('provider');
            } finally {
                await chmod(planPath, 0o644);
            }
        }
    );

    it('accepts repeated explicit keys and keeps stdout to one JSON document', async () => {
        const cwd = await tempStoreRoot();
        const { code, io, report } = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--key',
                'door-open',
                '--dry-run',
            ],
            { storeRoot: cwd }
        );

        expect(code).toBe(0);
        expect(io.exitCodes).toEqual([0]);
        expect(io.stdoutText().trim().split('\n')).toHaveLength(1);
        expect(report.requestedKeys).toEqual(['door-open', 'camera-shutter']);
    });

    it('returns exit 2 for a provider-illegal plan before invoking the runner', async () => {
        const cwd = await tempStoreRoot();
        const context: AudioGenerationStoryContext = {
            storyFolder: 'fixture',
            storyId: 'the_seventh_mirror',
            plan: {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'too-short',
                        type: 'sfx',
                        prompt: 'invalid',
                        durationMs: 400,
                    },
                ],
            },
        };
        let providerCreated = false;

        const { code, io, report } = await invoke(
            ['generate', '--story', 'fixture', '--missing', '--dry-run'],
            {
                storeRoot: cwd,
                loadStoryContext: async () => context,
                providerFactory: () => {
                    providerCreated = true;
                    return {} as AudioGenerationProvider;
                },
            }
        );

        expect(code).toBe(2);
        expect(io.exitCodes).toEqual([2]);
        expect(providerCreated).toBe(false);
        expect(report.providerIssues).toHaveLength(1);
    });

    it('returns exit 2 for stale or invalid selection input', async () => {
        const cwd = await tempStoreRoot();
        const { code: missingCandidate } = await invoke(
            [
                'select',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--candidate',
                'candidate-001',
            ],
            { storeRoot: cwd }
        );
        const { code: invalidCandidate } = await invoke(
            [
                'select',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--candidate',
                'candidate-01',
            ],
            { storeRoot: cwd }
        );

        expect(missingCandidate).toBe(2);
        expect(invalidCandidate).toBe(2);
    });

    it('returns exit 3 for provider and local-store I/O failures', async () => {
        const providerStoreRoot = await tempStoreRoot();
        const providerFailure = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--max-requests',
                '1',
            ],
            {
                storeRoot: providerStoreRoot,
                env: { ELEVENLABS_API_KEY: 'test-key' },
                providerFactory: () => ({
                    generate: async () => {
                        throw new ElevenLabsProviderError(
                            'network',
                            'provider unavailable'
                        );
                    },
                }),
            }
        );

        const storeRoot = await tempStoreRoot();
        await writeFile(join(storeRoot, 'theSeventhMirror'), 'not a directory');
        const storeFailure = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--dry-run',
            ],
            { storeRoot }
        );

        expect(providerFailure.code).toBe(3);
        expect(storeFailure.code).toBe(3);
    });

    it('returns exit 0 for a capped successful run and reports the deferred remainder', async () => {
        const cwd = await tempStoreRoot();
        const { code, io, report } = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--key',
                'door-open',
                '--max-requests',
                '1',
            ],
            {
                storeRoot: cwd,
                env: { ELEVENLABS_API_KEY: 'test-key' },
                providerFactory: () => ({
                    generate: async () => generatedCandidate(),
                }),
            }
        );

        expect(code).toBe(0);
        expect(io.exitCodes).toEqual([0]);
        expect(report.generatedCandidates).toHaveLength(1);
        expect(report.remaining).toEqual([{ key: 'camera-shutter', count: 1 }]);
        expect(io.stderrText()).toContain(
            'generating candidate-001 for door-open'
        );
    });

    it('succeeds without an API key when the planner schedules zero requests', async () => {
        const cwd = await tempStoreRoot();
        // Pre-populate the store with a verified current-spec success for
        // camera-shutter so the planner schedules zero new requests.
        const store = new LocalAudioGenerationStore({
            root: join(cwd, 'theSeventhMirror'),
            storyId: 'the_seventh_mirror',
        });
        const spec = buildAudioGenerationSpec({
            key: 'camera-shutter',
            type: 'sfx',
            prompt: 'Camera shutter and flash, evidence capture, one-shot',
            durationMs: 500,
        });
        await store.writeSuccess({
            candidateId: 'candidate-001',
            spec,
            specSha256: audioGenerationSpecSha256(spec),
            generated: generatedCandidate(),
        });

        const { code, report } = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--max-requests',
                '1',
            ],
            // No ELEVENLABS_API_KEY and no providerFactory: a zero-work resume
            // run must not require provider configuration.
            { storeRoot: cwd, env: {} }
        );

        expect(code).toBe(0);
        expect(report.scheduledRequestCount).toBe(0);
        expect(report.skipped).toEqual([
            {
                key: 'camera-shutter',
                desiredCount: 1,
                verifiedSuccessCount: 1,
            },
        ]);
    });
});

describe('audio generation CLI dry-run JSON contract', () => {
    it('reports the Seventh Mirror scope, provider issues, and raw estimate fields', async () => {
        const cwd = await tempStoreRoot();
        const { code, io, report } = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--missing',
                '--dry-run',
            ],
            { storeRoot: cwd }
        );

        expect(code).toBe(0);
        expect(io.stdoutText().trim().split('\n')).toHaveLength(1);
        expect(report).toMatchObject({
            storyFolder: 'theSeventhMirror',
            storyId: 'the_seventh_mirror',
            assetCount: 41,
            sfx: { count: 28 },
            bgm: { count: 13 },
            providerIssues: [],
        });
        expect(report.estimate).toEqual(
            expect.objectContaining({
                currency: 'USD',
                pricingAsOf: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                scheduledRequestCount: expect.any(Number),
                scheduledDurationMs: expect.any(Number),
            })
        );
    });
});
