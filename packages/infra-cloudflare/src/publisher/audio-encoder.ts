import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    assertSha256,
    getAudioObjectPath,
    type ObjectContentSha256,
} from '@aquila/stories/runtime-assets';
import { PublisherError, type PublisherErrorCode } from './errors';
import { sha256Bytes } from './hash';

export interface RuntimeMp3Probe {
    readonly codecName: 'mp3';
    readonly sampleRate: 44100;
    readonly bitRate: 128000;
    readonly durationMs: number;
}

export type AudioProcessRunner = (
    executable: 'ffmpeg' | 'ffprobe',
    args: readonly string[]
) => Promise<{
    exitCode: number;
    stdout: Uint8Array;
    stderr: string;
}>;

export interface AudioSourceForNormalization {
    readonly type: 'sfx' | 'bgm';
    readonly key: string;
    readonly plannedDurationMs: number;
    readonly loop: boolean;
    readonly sourceFilename: string;
    readonly sourceBytes: Uint8Array;
}

export interface NormalizedAudioAsset {
    readonly type: 'sfx' | 'bgm';
    readonly key: string;
    readonly bytes: Uint8Array;
    readonly sha256: ObjectContentSha256;
    readonly path: string;
    readonly byteLength: number;
    readonly durationMs: number;
    readonly loop: boolean;
    readonly contentType: 'audio/mpeg';
}

export interface AudioDurationWarning {
    readonly code: 'audio/duration-drift';
    readonly stage: 'encode';
    readonly identity: string;
    readonly message: string;
    readonly plannedDurationMs: number;
    readonly measuredDurationMs: number;
}

export interface NormalizeAudioAssetOptions {
    readonly run?: AudioProcessRunner;
    readonly onWarning?: (warning: AudioDurationWarning) => void;
}

const SOURCE_PROBE_ARGS = (path: string): readonly string[] => [
    '-hide_banner',
    '-loglevel',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_type,duration:format=duration',
    '-of',
    'json',
    '-protocol_whitelist',
    'file',
    path,
];

const RUNTIME_PROBE_ARGS = (path: string): readonly string[] => [
    '-hide_banner',
    '-loglevel',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_type,codec_name,sample_rate,bit_rate,duration',
    '-of',
    'json',
    path,
];

const SOURCE_DURATION_DRIFT_TOLERANCE_MS = 25;
const SFX_MAX_DURATION_MS = 30_000;
const BGM_MAX_DURATION_MS = 600_000;
const PROCESS_OUTPUT_LIMIT = 16 * 1024 * 1024;
const textDecoder = new TextDecoder('utf-8', { fatal: true });

type ProcessValue = Uint8Array | string | null | undefined;

function toBytes(value: ProcessValue): Uint8Array {
    if (value === undefined || value === null) return new Uint8Array();
    if (typeof value === 'string') return new TextEncoder().encode(value);
    return new Uint8Array(value);
}

function toText(value: ProcessValue): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    try {
        return textDecoder.decode(value);
    } catch {
        return new TextDecoder().decode(value);
    }
}

function systemAudioProcessRunner(
    executable: 'ffmpeg' | 'ffprobe',
    args: readonly string[]
): Promise<{
    exitCode: number;
    stdout: Uint8Array;
    stderr: string;
}> {
    return new Promise(resolve => {
        execFile(
            executable,
            [...args],
            {
                encoding: 'buffer',
                maxBuffer: PROCESS_OUTPUT_LIMIT,
                windowsHide: true,
            },
            (error, stdout, stderr) => {
                const errorCode =
                    typeof error?.code === 'number'
                        ? error.code
                        : error?.code === 'ENOENT'
                          ? 127
                          : error === null
                            ? 0
                            : 1;
                resolve({
                    exitCode: errorCode,
                    stdout: toBytes(stdout),
                    stderr:
                        toText(stderr) ||
                        (error instanceof Error ? error.message : ''),
                });
            }
        );
    });
}

function processError(
    code: PublisherErrorCode,
    message: string,
    executable: 'ffmpeg' | 'ffprobe',
    stage: string,
    cause?: unknown
): PublisherError {
    return new PublisherError(code, message, {
        cause,
        context: { executable, stage },
    });
}

async function runProcess(
    run: AudioProcessRunner,
    executable: 'ffmpeg' | 'ffprobe',
    args: readonly string[],
    failureCode: PublisherErrorCode,
    failureMessage: string,
    stage: string
): Promise<{
    exitCode: number;
    stdout: Uint8Array;
    stderr: string;
}> {
    let result;
    try {
        result = await run(executable, args);
    } catch (cause) {
        throw processError(
            'configuration',
            `Unable to start ${executable}`,
            executable,
            stage,
            cause
        );
    }
    if (result.exitCode !== 0) {
        throw processError(
            result.exitCode === 127 ? 'configuration' : failureCode,
            failureMessage,
            executable,
            stage
        );
    }
    return result;
}

export async function assertAudioToolsAvailable(
    run: AudioProcessRunner = systemAudioProcessRunner
): Promise<void> {
    for (const executable of ['ffmpeg', 'ffprobe'] as const) {
        await runProcess(
            run,
            executable,
            ['-hide_banner', '-version'],
            'configuration',
            `${executable} is not runnable`,
            'input'
        );
    }
}

function parseJson(stdout: Uint8Array, stage: string): unknown {
    if (stdout.byteLength === 0) {
        throw new PublisherError(
            'integrity',
            'Audio probe returned no output',
            {
                context: { stage },
            }
        );
    }
    try {
        return JSON.parse(textDecoder.decode(stdout)) as unknown;
    } catch (cause) {
        throw new PublisherError(
            'integrity',
            'Audio probe returned invalid JSON',
            {
                context: { stage },
                cause,
            }
        );
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numericField(
    value: Record<string, unknown>,
    field: string
): number | undefined {
    const raw = value[field];
    if (typeof raw === 'number') return raw;
    if (typeof raw !== 'string' || raw.trim() === '') return undefined;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function probeStreams(
    document: unknown,
    stage: string
): Record<string, unknown>[] {
    if (!isRecord(document) || !Array.isArray(document.streams)) {
        throw new PublisherError(
            'integrity',
            'Audio probe found no audio stream',
            {
                context: { stage },
            }
        );
    }
    const stream = document.streams.find(
        (candidate): candidate is Record<string, unknown> =>
            isRecord(candidate) && candidate.codec_type !== 'video'
    );
    if (stream === undefined) {
        throw new PublisherError(
            'integrity',
            'Audio probe found no audio stream',
            {
                context: { stage },
            }
        );
    }
    if (stream.codec_type !== undefined && stream.codec_type !== 'audio') {
        throw new PublisherError(
            'integrity',
            'Audio probe found no audio stream',
            {
                context: { stage },
            }
        );
    }
    return [stream];
}

function durationMsFromProbe(
    document: Record<string, unknown>,
    stream: Record<string, unknown>,
    stage: string
): number {
    const seconds =
        numericField(stream, 'duration') ??
        (isRecord(document.format)
            ? numericField(document.format, 'duration')
            : undefined);
    if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
        throw new PublisherError(
            'integrity',
            'Audio probe duration must be finite and positive',
            { context: { stage } }
        );
    }
    const durationMs = seconds * 1_000;
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        throw new PublisherError(
            'integrity',
            'Audio probe duration must be finite and positive',
            { context: { stage } }
        );
    }
    return durationMs;
}

async function probeSourceAudioFile(
    path: string,
    run: AudioProcessRunner
): Promise<number> {
    const result = await runProcess(
        run,
        'ffprobe',
        SOURCE_PROBE_ARGS(path),
        'source',
        'Audio source probe failed',
        'source'
    );
    try {
        const document = parseJson(result.stdout, 'source');
        if (!isRecord(document)) {
            throw new PublisherError(
                'source',
                'Audio source probe returned invalid data',
                {
                    context: { stage: 'source' },
                }
            );
        }
        const [stream] = probeStreams(document, 'source');
        return durationMsFromProbe(document, stream, 'source');
    } catch (cause) {
        if (cause instanceof PublisherError && cause.code === 'integrity') {
            throw new PublisherError('source', cause.message, {
                context: { stage: 'source' },
                cause,
            });
        }
        throw cause;
    }
}

export async function probeRuntimeMp3File(
    path: string,
    run: AudioProcessRunner = systemAudioProcessRunner
): Promise<RuntimeMp3Probe> {
    const result = await runProcess(
        run,
        'ffprobe',
        RUNTIME_PROBE_ARGS(path),
        'integrity',
        'Runtime MP3 probe failed',
        'verification'
    );
    const document = parseJson(result.stdout, 'verification');
    if (!isRecord(document)) {
        throw new PublisherError(
            'integrity',
            'Runtime MP3 probe returned invalid data',
            {
                context: { stage: 'verification' },
            }
        );
    }
    const [stream] = probeStreams(document, 'verification');
    if (stream.codec_name !== 'mp3') {
        throw new PublisherError(
            'integrity',
            'Runtime audio codec must be MP3',
            {
                context: { stage: 'verification' },
            }
        );
    }
    if (numericField(stream, 'sample_rate') !== 44_100) {
        throw new PublisherError(
            'integrity',
            'Runtime MP3 sample rate must be 44100 Hz',
            { context: { stage: 'verification' } }
        );
    }
    const bitRate = numericField(stream, 'bit_rate');
    if (bitRate === undefined || bitRate !== 128_000) {
        throw new PublisherError(
            'integrity',
            'Runtime MP3 bitrate must be present and exactly 128000 bit/s',
            { context: { stage: 'verification' } }
        );
    }
    return {
        codecName: 'mp3',
        sampleRate: 44_100,
        bitRate: 128_000,
        durationMs: durationMsFromProbe(document, stream, 'verification'),
    };
}

const PLAYLIST_EXTENSIONS = new Set([
    '.m3u',
    '.m3u8',
    '.pls',
    '.asx',
    '.wpl',
    '.xspf',
    '.ram',
    '.smil',
]);

function sourceExtension(filename: string): string {
    const safeFilename = basename(filename);
    if (safeFilename !== filename || filename.includes('\\')) {
        throw new PublisherError('source', 'Audio source filename is unsafe', {
            context: { stage: 'source' },
        });
    }
    const extension = extname(safeFilename).toLowerCase();
    if (!/^\.[a-z0-9]+$/.test(extension)) {
        throw new PublisherError(
            'source',
            'Audio source filename must have a safe extension',
            { context: { stage: 'source' } }
        );
    }
    if (PLAYLIST_EXTENSIONS.has(extension)) {
        throw new PublisherError(
            'source',
            'Audio source filename must not be a playlist',
            { context: { stage: 'source' } }
        );
    }
    return extension;
}

function assertSourcePolicy(source: AudioSourceForNormalization): void {
    if (
        (source.type === 'sfx' && source.loop) ||
        (source.type === 'bgm' && !source.loop)
    ) {
        throw new PublisherError(
            'input',
            'Audio loop intent does not match its type',
            {
                context: { stage: 'input' },
            }
        );
    }
    if (
        !Number.isSafeInteger(source.plannedDurationMs) ||
        source.plannedDurationMs <= 0
    ) {
        throw new PublisherError(
            'input',
            'Audio planned duration must be positive',
            {
                context: { stage: 'input' },
            }
        );
    }
}

function normalizeOptions(
    options: AudioProcessRunner | NormalizeAudioAssetOptions | undefined
): NormalizeAudioAssetOptions {
    if (typeof options === 'function') return { run: options };
    return options ?? {};
}

export async function normalizeAudioAsset(
    source: AudioSourceForNormalization,
    options?: AudioProcessRunner | NormalizeAudioAssetOptions
): Promise<NormalizedAudioAsset> {
    assertSourcePolicy(source);
    const normalizedOptions = normalizeOptions(options);
    const run = normalizedOptions.run ?? systemAudioProcessRunner;
    const extension = sourceExtension(source.sourceFilename);
    const temporaryRoot = await mkdtemp(
        join(tmpdir(), 'aquila-audio-normalize-')
    );
    const inputPath = join(temporaryRoot, `source${extension}`);
    const outputPath = join(temporaryRoot, 'runtime.mp3');
    const maximumDurationMs =
        source.type === 'sfx' ? SFX_MAX_DURATION_MS : BGM_MAX_DURATION_MS;

    try {
        await writeFile(inputPath, source.sourceBytes);
        const sourceDurationMs = await probeSourceAudioFile(inputPath, run);
        if (sourceDurationMs > maximumDurationMs) {
            throw new PublisherError(
                'source',
                `Audio source exceeds the ${source.type.toUpperCase()} duration ceiling`,
                { context: { stage: 'source' } }
            );
        }

        await runProcess(
            run,
            'ffmpeg',
            [
                '-nostdin',
                '-hide_banner',
                '-loglevel',
                'error',
                '-protocol_whitelist',
                'file',
                '-i',
                inputPath,
                '-map',
                '0:a:0',
                '-vn',
                '-map_metadata',
                '-1',
                '-ar',
                '44100',
                '-c:a',
                'libmp3lame',
                '-b:a',
                '128k',
                '-id3v2_version',
                '0',
                '-write_id3v1',
                '0',
                outputPath,
            ],
            'encoding',
            'Audio normalization failed',
            'encode'
        );

        let bytes: Uint8Array;
        try {
            bytes = new Uint8Array(await readFile(outputPath));
        } catch (cause) {
            throw new PublisherError(
                'encoding',
                'Audio normalization produced no output',
                {
                    context: { stage: 'encode' },
                    cause,
                }
            );
        }
        if (bytes.byteLength === 0) {
            throw new PublisherError(
                'encoding',
                'Audio normalization produced an empty output',
                {
                    context: { stage: 'encode' },
                }
            );
        }

        const probe = await probeRuntimeMp3File(outputPath, run);
        if (probe.durationMs > maximumDurationMs) {
            throw new PublisherError(
                'integrity',
                `Normalized ${source.type.toUpperCase()} exceeds its duration ceiling`,
                { context: { stage: 'verification' } }
            );
        }

        if (
            Math.abs(probe.durationMs - source.plannedDurationMs) >
            SOURCE_DURATION_DRIFT_TOLERANCE_MS
        ) {
            normalizedOptions.onWarning?.({
                code: 'audio/duration-drift',
                stage: 'encode',
                identity: `${source.type}:${source.key}`,
                message:
                    'Normalized audio duration differs materially from the planned duration',
                plannedDurationMs: source.plannedDurationMs,
                measuredDurationMs: Math.round(probe.durationMs),
            });
        }

        const sha256 = assertSha256<'object-content'>(sha256Bytes(bytes));
        return {
            type: source.type,
            key: source.key,
            bytes,
            sha256,
            path: getAudioObjectPath(sha256),
            byteLength: bytes.byteLength,
            durationMs: Math.round(probe.durationMs),
            loop: source.loop,
            contentType: 'audio/mpeg',
        };
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true });
    }
}
