import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AudioGenerationProvider } from '../elevenlabs';
import { ElevenLabsProviderError } from '../elevenlabs';
import {
    AudioGenerationError,
    audioGenerationExitCode,
    runCli,
    type AudioGenerationCliIO,
} from '../cli';
import type { AudioGenerationStoryContext } from '../run';

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

async function tempCwd(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'audio-generation-cli-'));
    roots.push(root);
    return root;
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

    it('accepts repeated explicit keys and keeps stdout to one JSON document', async () => {
        const cwd = await tempCwd();
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
            { cwd }
        );

        expect(code).toBe(0);
        expect(io.exitCodes).toEqual([0]);
        expect(io.stdoutText().trim().split('\n')).toHaveLength(1);
        expect(report.requestedKeys).toEqual(['door-open', 'camera-shutter']);
    });

    it('returns exit 2 for a provider-illegal plan before invoking the runner', async () => {
        const cwd = await tempCwd();
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
                cwd,
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
        const cwd = await tempCwd();
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
            { cwd }
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
            { cwd }
        );

        expect(missingCandidate).toBe(2);
        expect(invalidCandidate).toBe(2);
    });

    it('returns exit 3 for provider and local-store I/O failures', async () => {
        const providerCwd = await tempCwd();
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
                cwd: providerCwd,
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

        const storeCwd = await tempCwd();
        await mkdir(join(storeCwd, '.tmp', 'audio-generation'), {
            recursive: true,
        });
        await writeFile(
            join(storeCwd, '.tmp', 'audio-generation', 'theSeventhMirror'),
            'not a directory'
        );
        const storeFailure = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--key',
                'camera-shutter',
                '--dry-run',
            ],
            { cwd: storeCwd }
        );

        expect(providerFailure.code).toBe(3);
        expect(storeFailure.code).toBe(3);
    });

    it('returns exit 0 for a capped successful run and reports the deferred remainder', async () => {
        const cwd = await tempCwd();
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
                cwd,
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
});

describe('audio generation CLI dry-run JSON contract', () => {
    it('reports the Seventh Mirror scope, provider issues, and raw estimate fields', async () => {
        const cwd = await tempCwd();
        const { code, io, report } = await invoke(
            [
                'generate',
                '--story',
                'theSeventhMirror',
                '--missing',
                '--dry-run',
            ],
            { cwd }
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
