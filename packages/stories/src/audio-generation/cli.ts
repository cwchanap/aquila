import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
    createElevenLabsAudioProvider,
    ElevenLabsProviderError,
    type AudioGenerationProvider,
} from './elevenlabs';
import {
    AudioGenerationConfigurationError,
    AudioGenerationInputError,
    loadAudioGenerationStoryContext,
    planAudioGeneration,
    runAudioGeneration,
    type AudioGenerationPlan,
    type AudioGenerationRunResult,
    type AudioGenerationStoryContext,
} from './run';
import { selectAudioCandidate, type AudioSelectionFileV1 } from './select';
import { LocalAudioGenerationStore } from './store';

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

export interface AudioGenerationCliIO {
    readonly stdout: { write(chunk: string): void };
    readonly stderr: { write(chunk: string): void };
    readonly exit?: (code: number) => void;
    readonly cwd?: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly apiKey?: string;
    readonly providerFactory?: () => AudioGenerationProvider;
    readonly loadStoryContext?: (
        storyFolder: string
    ) => Promise<AudioGenerationStoryContext>;
}

interface GenerateArguments {
    readonly story: string;
    readonly keys?: readonly string[];
    readonly missing: boolean;
    readonly candidateCount: number;
    readonly maxRequests?: number;
    readonly dryRun: boolean;
}

interface SelectArguments {
    readonly story: string;
    readonly key: string;
    readonly candidateId: string;
}

interface GenerateOutcome {
    readonly report: Record<string, unknown>;
    readonly error?: AudioGenerationError;
}

const NOOP_PROVIDER: AudioGenerationProvider = {
    async generate() {
        throw new Error('The provider cannot be used during a dry run');
    },
};

function defaultIo(): AudioGenerationCliIO {
    return {
        stdout: process.stdout,
        stderr: process.stderr,
        cwd: process.cwd(),
        env: process.env,
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function configurationError(
    message: string,
    cause?: unknown
): AudioGenerationError {
    return new AudioGenerationError('configuration', message, cause);
}

function inputError(message: string, cause?: unknown): AudioGenerationError {
    return new AudioGenerationError('input', message, cause);
}

function providerError(message: string, cause?: unknown): AudioGenerationError {
    return new AudioGenerationError('provider', message, cause);
}

function parseInteger(
    value: unknown,
    option: string,
    minimum: number,
    maximum: number
): number | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw configurationError(
            `--${option} must be an integer from ${minimum} through ${maximum}`
        );
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw configurationError(
            `--${option} must be an integer from ${minimum} through ${maximum}`
        );
    }
    return parsed;
}

function requiredString(
    values: Record<string, unknown>,
    option: string
): string {
    const value = values[option];
    if (typeof value !== 'string' || value.length === 0) {
        throw configurationError(`--${option} is required`);
    }
    return value;
}

function parsePositionals(
    positionals: readonly string[],
    command: 'generate' | 'select'
): void {
    if (positionals.length !== 1 || positionals[0] !== command) {
        throw configurationError(
            `Usage: ${command} must be the first and only positional argument`
        );
    }
}

function parseGenerateArguments(argv: readonly string[]): GenerateArguments {
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
                'candidate-count': { type: 'string' },
                'max-requests': { type: 'string' },
                'dry-run': { type: 'boolean' },
            },
        });
    } catch (error) {
        throw configurationError(errorMessage(error), error);
    }

    parsePositionals(parsed.positionals, 'generate');
    const values = parsed.values as Record<string, unknown>;
    const story = requiredString(values, 'story');
    const rawKeys = values.key;
    const keys =
        rawKeys === undefined
            ? undefined
            : Array.isArray(rawKeys)
              ? rawKeys
              : [rawKeys];
    if (keys?.some(key => typeof key !== 'string' || key.length === 0)) {
        throw configurationError('--key must not be empty');
    }

    const missing = values.missing === true;
    if (missing === (keys !== undefined)) {
        throw configurationError(
            'Choose exactly one audio target mode: --key or --missing'
        );
    }

    const dryRun = values['dry-run'] === true;
    const candidateCount =
        parseInteger(values['candidate-count'], 'candidate-count', 1, 4) ?? 1;
    const maxRequests = parseInteger(
        values['max-requests'],
        'max-requests',
        1,
        100
    );
    if (!dryRun && maxRequests === undefined) {
        throw configurationError(
            '--max-requests is required for paid audio generation'
        );
    }

    return {
        story,
        keys: keys as string[] | undefined,
        missing,
        candidateCount,
        maxRequests,
        dryRun,
    };
}

function parseSelectArguments(argv: readonly string[]): SelectArguments {
    let parsed: ReturnType<typeof parseArgs>;
    try {
        parsed = parseArgs({
            args: [...argv],
            allowPositionals: true,
            strict: true,
            options: {
                story: { type: 'string' },
                key: { type: 'string' },
                candidate: { type: 'string' },
            },
        });
    } catch (error) {
        throw configurationError(errorMessage(error), error);
    }

    parsePositionals(parsed.positionals, 'select');
    const values = parsed.values as Record<string, unknown>;
    return {
        story: requiredString(values, 'story'),
        key: requiredString(values, 'key'),
        candidateId: requiredString(values, 'candidate'),
    };
}

function parseCommand(argv: readonly string[]): 'generate' | 'select' {
    const command = argv[0];
    if (command === 'generate' || command === 'select') return command;
    throw configurationError('Expected command generate or select');
}

function isNodeIoError(error: unknown): boolean {
    if (
        error instanceof AudioGenerationConfigurationError ||
        error instanceof AudioGenerationInputError
    ) {
        return false;
    }
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string'
    );
}

function makeStore(
    context: AudioGenerationStoryContext,
    io: AudioGenerationCliIO
): LocalAudioGenerationStore {
    return new LocalAudioGenerationStore({
        root: join(
            io.cwd ?? process.cwd(),
            '.tmp',
            'audio-generation',
            context.storyFolder
        ),
        storyId: context.storyId,
    });
}

function assetSummary(context: AudioGenerationStoryContext) {
    const sfx = context.plan.assets.filter(asset => asset.type === 'sfx');
    const bgm = context.plan.assets.filter(asset => asset.type === 'bgm');
    return {
        assetCount: context.plan.assets.length,
        sfx: {
            count: sfx.length,
            intendedDurationMs: sfx.reduce(
                (total, asset) => total + asset.durationMs,
                0
            ),
        },
        bgm: {
            count: bgm.length,
            intendedDurationMs: bgm.reduce(
                (total, asset) => total + asset.durationMs,
                0
            ),
        },
    };
}

function generateReport(
    context: AudioGenerationStoryContext,
    plan: AudioGenerationPlan,
    result?: AudioGenerationRunResult
): Record<string, unknown> {
    return {
        ...assetSummary(context),
        ...plan,
        ...(result === undefined ? {} : result),
    };
}

function progressStore(
    store: LocalAudioGenerationStore,
    stderr: { write(chunk: string): void }
): LocalAudioGenerationStore {
    const progress = Object.create(store) as LocalAudioGenerationStore;
    progress.nextCandidateId = async (key: string) => {
        const candidateId = await store.nextCandidateId(key);
        stderr.write(`generating ${candidateId} for ${key}\n`);
        return candidateId;
    };
    return progress;
}

async function generate(
    args: GenerateArguments,
    io: AudioGenerationCliIO
): Promise<GenerateOutcome> {
    let context: AudioGenerationStoryContext;
    try {
        context = await (
            io.loadStoryContext ?? loadAudioGenerationStoryContext
        )(args.story);
    } catch (error) {
        if (error instanceof AudioGenerationError) throw error;
        if (error instanceof AudioGenerationConfigurationError) {
            throw configurationError(error.message, error);
        }
        if (error instanceof AudioGenerationInputError) {
            throw inputError(error.message, error);
        }
        if (isNodeIoError(error)) {
            throw providerError(errorMessage(error), error);
        }
        throw configurationError(errorMessage(error), error);
    }

    const store = makeStore(context, io);
    let plan: AudioGenerationPlan;
    try {
        plan = await planAudioGeneration({
            context,
            store,
            keys: args.keys,
            missing: args.missing,
            candidateCount: args.candidateCount,
            maxRequests: args.maxRequests,
            dryRun: args.dryRun,
        });
    } catch (error) {
        if (error instanceof AudioGenerationConfigurationError) {
            throw configurationError(error.message, error);
        }
        if (error instanceof AudioGenerationError) throw error;
        throw providerError(errorMessage(error), error);
    }

    const report = generateReport(context, plan);
    if (plan.providerIssues.length > 0) {
        return {
            report,
            error: inputError('Audio plan contains provider-illegal rows'),
        };
    }

    let apiKey = io.apiKey ?? (io.env ?? process.env).ELEVENLABS_API_KEY;
    if (!args.dryRun && !apiKey?.trim()) {
        throw configurationError('ELEVENLABS_API_KEY is required');
    }
    apiKey ??= '';

    const provider = args.dryRun
        ? NOOP_PROVIDER
        : (io.providerFactory ?? (() => createElevenLabsAudioProvider()))();
    let result: AudioGenerationRunResult;
    try {
        result = await runAudioGeneration(plan, {
            provider,
            store: progressStore(store, io.stderr),
            apiKey,
        });
    } catch (error) {
        if (error instanceof AudioGenerationConfigurationError) {
            throw configurationError(error.message, error);
        }
        if (error instanceof ElevenLabsProviderError) {
            throw providerError(error.message, error);
        }
        if (error instanceof AudioGenerationError) throw error;
        throw providerError(errorMessage(error), error);
    }

    return { report: generateReport(context, plan, result) };
}

async function select(
    args: SelectArguments,
    io: AudioGenerationCliIO
): Promise<AudioSelectionFileV1> {
    let context: AudioGenerationStoryContext;
    try {
        context = await (
            io.loadStoryContext ?? loadAudioGenerationStoryContext
        )(args.story);
    } catch (error) {
        if (error instanceof AudioGenerationError) throw error;
        if (error instanceof AudioGenerationConfigurationError) {
            throw configurationError(error.message, error);
        }
        if (error instanceof AudioGenerationInputError) {
            throw inputError(error.message, error);
        }
        if (isNodeIoError(error)) {
            throw providerError(errorMessage(error), error);
        }
        throw configurationError(errorMessage(error), error);
    }

    const store = makeStore(context, io);
    try {
        return await selectAudioCandidate(
            store,
            context.plan,
            args.key,
            args.candidateId
        );
    } catch (error) {
        if (error instanceof AudioGenerationError) throw error;
        if (isNodeIoError(error)) {
            throw providerError(errorMessage(error), error);
        }
        throw inputError(errorMessage(error), error);
    }
}

function errorDocument(error: AudioGenerationError) {
    return {
        error: {
            code: error.code,
            message: error.message,
        },
    };
}

function finish(
    io: AudioGenerationCliIO,
    code: number,
    document: unknown,
    error?: AudioGenerationError
): number {
    if (error !== undefined) io.stderr.write(`error: ${error.message}\n`);
    io.stdout.write(`${JSON.stringify(document)}\n`);
    io.exit?.(code);
    return code;
}

export async function runCli(
    argv: readonly string[],
    io: AudioGenerationCliIO = defaultIo()
): Promise<number> {
    try {
        const command = parseCommand(argv);
        if (command === 'generate') {
            const outcome = await generate(parseGenerateArguments(argv), io);
            if (outcome.error !== undefined) {
                return finish(
                    io,
                    audioGenerationExitCode(outcome.error),
                    { ...outcome.report, ...errorDocument(outcome.error) },
                    outcome.error
                );
            }
            return finish(io, 0, outcome.report);
        }

        const selection = await select(parseSelectArguments(argv), io);
        return finish(io, 0, selection);
    } catch (cause) {
        const error =
            cause instanceof AudioGenerationError
                ? cause
                : providerError(errorMessage(cause), cause);
        return finish(
            io,
            audioGenerationExitCode(error),
            errorDocument(error),
            error
        );
    }
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
    void runCli(process.argv.slice(2), {
        stdout: process.stdout,
        stderr: process.stderr,
        cwd: process.cwd(),
        env: process.env,
        exit: code => {
            process.exitCode = code;
        },
    });
}
