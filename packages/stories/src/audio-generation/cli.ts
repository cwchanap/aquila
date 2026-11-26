import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { AudioPlanAsset } from '../audio-plan';
import { loadAudioPlan } from '../audio-plan-loader';
import { loadStoryCompilerConfig, STORIES_RAW_ROOT } from '../compiler/config';
import {
    createElevenLabsAudioProvider,
    ElevenLabsProviderError,
    type AudioGenerationProvider,
} from './elevenlabs';
import {
    buildAudioGenerationSpec,
    estimateScheduledAudioCostUsd,
    type CurrentAudioGenerationSpec,
} from './spec';

/**
 * Makes the sounds of a story's audio plan with ElevenLabs and writes each one
 * where the publisher reads it: `packages/assets/media/<storyId>/<sfx|bgm>/<key>.mp3`.
 * Git is the review store: listen to a take, keep it by committing it, redo it
 * by generating the key again. Sound effects can also be made with the
 * ElevenLabs connector and saved to the same folder; the music needs this CLI
 * (the connector has no music model) and an `ELEVENLABS_API_KEY`.
 */

export type AudioGenerationErrorCode = 'configuration' | 'input' | 'provider';

export class AudioGenerationError extends Error {
    constructor(
        readonly code: AudioGenerationErrorCode,
        message: string,
        cause?: unknown
    ) {
        super(message, cause === undefined ? undefined : { cause });
        this.name = 'AudioGenerationError';
    }
}

export function audioGenerationExitCode(error: unknown): number {
    if (!(error instanceof AudioGenerationError)) return 3;
    if (error.code === 'configuration') return 1;
    if (error.code === 'input') return 2;
    return 3;
}

export interface AudioGenerationCliIo {
    readonly stdout: { write(chunk: string): unknown };
    readonly stderr: { write(chunk: string): unknown };
    readonly env?: NodeJS.ProcessEnv;
    readonly provider?: AudioGenerationProvider;
    readonly rawRoot?: string;
    readonly mediaRoot?: string;
}

const REPO_ROOT = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../..'
);
const DEFAULT_MEDIA_ROOT = join(REPO_ROOT, 'packages', 'assets', 'media');

const USAGE = `Usage: bun --filter @aquila/stories audio:generate --story <raw folder> (--missing | --key <key> ...) [options]

  --missing           make every key of the plan that has no file yet
  --key <key>         make (or redo) exactly these keys; repeat for several
  --out <dir>         write <dir>/<sfx|bgm>/<key>.mp3 instead of the story's media folder
  --max-requests <n>  paid requests allowed in this run (required unless --dry-run)
  --dry-run           list what would be made and the estimated cost, call nothing

Needs ELEVENLABS_API_KEY.`;

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function configurationError(message: string, cause?: unknown) {
    return new AudioGenerationError('configuration', message, cause);
}

function inputError(message: string, cause?: unknown) {
    return new AudioGenerationError('input', message, cause);
}

interface GenerateArguments {
    readonly story: string;
    readonly keys: readonly string[] | undefined;
    readonly out: string | undefined;
    readonly maxRequests: number | undefined;
    readonly dryRun: boolean;
}

function parseArguments(argv: readonly string[]): GenerateArguments {
    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs({
            args: [...argv],
            allowPositionals: true,
            strict: true,
            options: {
                story: { type: 'string' },
                key: { type: 'string', multiple: true },
                missing: { type: 'boolean' },
                out: { type: 'string' },
                'max-requests': { type: 'string' },
                'dry-run': { type: 'boolean' },
            },
        });
    } catch (error) {
        throw configurationError(errorMessage(error), error);
    }
    if (
        parsed.positionals.length !== 1 ||
        parsed.positionals[0] !== 'generate'
    ) {
        throw configurationError(USAGE);
    }
    const values = parsed.values as Record<string, unknown>;
    const story = values.story;
    if (typeof story !== 'string' || story.length === 0) {
        throw configurationError('--story is required');
    }
    const keys = Array.isArray(values.key)
        ? (values.key as string[])
        : undefined;
    if ((values.missing === true) === (keys !== undefined)) {
        throw configurationError('Choose exactly one of --missing or --key');
    }
    const dryRun = values['dry-run'] === true;
    let maxRequests: number | undefined;
    const rawMax = values['max-requests'];
    if (rawMax !== undefined) {
        if (typeof rawMax !== 'string' || !/^\d+$/.test(rawMax)) {
            throw configurationError('--max-requests must be a whole number');
        }
        maxRequests = Number(rawMax);
    }
    if (!dryRun && maxRequests === undefined) {
        throw configurationError(
            '--max-requests is required for paid audio generation'
        );
    }
    return {
        story,
        keys,
        out: typeof values.out === 'string' ? values.out : undefined,
        maxRequests,
        dryRun,
    };
}

function outputPath(
    root: string,
    asset: Pick<AudioPlanAsset, 'type' | 'key'>
): string {
    return join(root, asset.type, `${asset.key}.mp3`);
}

export async function runAudioGenerationCli(
    argv: readonly string[],
    io: AudioGenerationCliIo = {
        stdout: process.stdout,
        stderr: process.stderr,
    }
): Promise<number> {
    try {
        const args = parseArguments(argv);
        const rawDir = join(io.rawRoot ?? STORIES_RAW_ROOT, args.story);
        if (!existsSync(join(rawDir, 'compiler.config.ts'))) {
            throw inputError(`Unknown story folder "${args.story}"`);
        }
        const plan = loadAudioPlan(rawDir);
        if (plan === undefined) {
            throw inputError(`${args.story} has no docs/audio-plan.json`);
        }
        const { storyId } = await loadStoryCompilerConfig(rawDir);
        const outRoot = args.out
            ? resolve(args.out)
            : join(io.mediaRoot ?? DEFAULT_MEDIA_ROOT, storyId);

        let targets: readonly AudioPlanAsset[];
        if (args.keys !== undefined) {
            targets = args.keys.map(key => {
                const asset = plan.assets.find(item => item.key === key);
                if (asset === undefined) {
                    throw inputError(`"${key}" is not in the audio plan`);
                }
                return asset;
            });
        } else {
            targets = plan.assets.filter(
                asset => !existsSync(outputPath(outRoot, asset))
            );
        }
        if (targets.length === 0) {
            io.stdout.write('Nothing to make: every key already has a file\n');
            return 0;
        }

        let specs: readonly CurrentAudioGenerationSpec[];
        try {
            specs = targets.map(asset => buildAudioGenerationSpec(asset));
        } catch (error) {
            throw inputError(errorMessage(error), error);
        }
        const cost = estimateScheduledAudioCostUsd(specs).toFixed(2);
        io.stdout.write(
            `${specs.length} sound(s), about $${cost}:\n${specs
                .map(spec => `  ${spec.type} ${spec.key} ${spec.durationMs}ms`)
                .join('\n')}\n`
        );
        if (args.dryRun) return 0;

        if (specs.length > (args.maxRequests ?? 0)) {
            throw configurationError(
                `${specs.length} requests needed but --max-requests is ${args.maxRequests}`
            );
        }
        const apiKey = (io.env ?? process.env).ELEVENLABS_API_KEY;
        if (!apiKey) throw configurationError('ELEVENLABS_API_KEY is required');

        const provider = io.provider ?? createElevenLabsAudioProvider();
        for (const spec of specs) {
            let generated;
            try {
                generated = await provider.generate(spec, apiKey);
            } catch (error) {
                throw new AudioGenerationError(
                    'provider',
                    `${spec.key}: ${errorMessage(error)}`,
                    error
                );
            }
            if (generated.format !== 'mp3') {
                throw new AudioGenerationError(
                    'provider',
                    `${spec.key}: expected an mp3, got ${generated.mediaType}`
                );
            }
            const path = outputPath(outRoot, spec);
            await mkdir(dirname(path), { recursive: true });
            await writeFile(path, generated.bytes);
            const cost = generated.providerMetadata['character-cost'];
            io.stdout.write(
                `wrote ${path}${cost === undefined ? '' : ` (cost ${cost})`}\n`
            );
        }
        return 0;
    } catch (error) {
        io.stderr.write(
            `${error instanceof ElevenLabsProviderError ? 'provider: ' : ''}${errorMessage(error)}\n`
        );
        return audioGenerationExitCode(error);
    }
}

/* v8 ignore next 4 */
if ((import.meta as ImportMeta & { main?: boolean }).main === true) {
    process.exitCode = await runAudioGenerationCli(process.argv.slice(2));
}
