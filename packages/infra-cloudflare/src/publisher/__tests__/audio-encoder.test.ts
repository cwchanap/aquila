import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
    normalizeAudioAsset,
    probeRuntimeMp3File,
    type AudioProcessRunner,
} from '../audio-encoder';

function sha256(bytes: Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function runtimeProbe(duration = '1.250') {
    return JSON.stringify({
        streams: [
            {
                codec_type: 'audio',
                codec_name: 'mp3',
                sample_rate: '44100',
                bit_rate: '128000',
                duration,
            },
        ],
    });
}

function sourceProbe(duration = '1.250') {
    return JSON.stringify({
        streams: [{ codec_type: 'audio', duration }],
    });
}

function successfulRunner(options: { readonly duration?: string } = {}) {
    const calls: Array<{
        executable: 'ffmpeg' | 'ffprobe';
        args: readonly string[];
    }> = [];
    const outputBytes = Uint8Array.from([9, 8, 7, 6]);
    const run: AudioProcessRunner = async (executable, args) => {
        calls.push({ executable, args: [...args] });
        if (executable === 'ffmpeg') {
            const outputPath = args.at(-1);
            if (outputPath === undefined)
                throw new Error('missing output path');
            await writeFile(outputPath, outputBytes);
            return { exitCode: 0, stdout: new Uint8Array(), stderr: '' };
        }

        const probeIndex = calls.filter(
            call => call.executable === 'ffprobe'
        ).length;
        return {
            exitCode: 0,
            stdout: new TextEncoder().encode(
                probeIndex === 1
                    ? sourceProbe()
                    : runtimeProbe(options.duration ?? '1.250')
            ),
            stderr: '',
        };
    };
    return { calls, outputBytes, run };
}

const source = {
    type: 'sfx' as const,
    key: 'door-open',
    plannedDurationMs: 1_250,
    loop: false,
    sourceFilename: 'candidate-001.wav',
    sourceBytes: Uint8Array.from([1, 2, 3]),
};

describe('normalizeAudioAsset', () => {
    it('passes the exact direct ffmpeg argv and emits a hashed runtime MP3 asset', async () => {
        const fixture = successfulRunner();

        const result = await normalizeAudioAsset(source, fixture.run);

        const ffmpeg = fixture.calls.find(call => call.executable === 'ffmpeg');
        expect(ffmpeg).toBeDefined();
        expect(ffmpeg?.args).toHaveLength(22);
        expect(ffmpeg?.args.slice(0, 4)).toEqual([
            '-nostdin',
            '-hide_banner',
            '-loglevel',
            'error',
        ]);
        expect(ffmpeg?.args.slice(4, 8)).toEqual([
            '-i',
            expect.stringMatching(/source\.wav$/),
            '-map',
            '0:a:0',
        ]);
        expect(ffmpeg?.args.slice(8)).toEqual([
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
            expect.stringMatching(/runtime\.mp3$/),
        ]);
        expect(result).toEqual({
            type: 'sfx',
            key: 'door-open',
            bytes: fixture.outputBytes,
            sha256: sha256(fixture.outputBytes),
            path: `vn/objects/${sha256(fixture.outputBytes)}.mp3`,
            byteLength: fixture.outputBytes.byteLength,
            durationMs: 1_250,
            loop: false,
            contentType: 'audio/mpeg',
        });
    });

    it('probes source readability before normalization and strictly probes the normalized output', async () => {
        const fixture = successfulRunner();

        await normalizeAudioAsset(source, fixture.run);

        expect(fixture.calls.map(call => call.executable)).toEqual([
            'ffprobe',
            'ffmpeg',
            'ffprobe',
        ]);
        expect(fixture.calls[0]?.args).toContain('-select_streams');
        expect(fixture.calls[0]?.args).toContain('a:0');
        expect(fixture.calls[0]?.args).not.toContain('-nostdin');
        expect(fixture.calls[2]?.args).toContain(
            'stream=codec_type,codec_name,sample_rate,bit_rate,duration'
        );
        expect(fixture.calls[2]?.args).not.toContain('-nostdin');
    });

    it.each([
        ['process failure', { exitCode: 1, stdout: '', stderr: 'failed' }],
        [
            'no audio stream',
            { exitCode: 0, stdout: '{"streams":[]}', stderr: '' },
        ],
        ['empty output', { exitCode: 0, stdout: '', stderr: '' }],
        [
            'non-positive duration',
            { exitCode: 0, stdout: runtimeProbe('0'), stderr: '' },
        ],
        [
            'wrong codec',
            {
                exitCode: 0,
                stdout: runtimeProbe().replace('"mp3"', '"aac"'),
                stderr: '',
            },
        ],
        [
            'wrong sample rate',
            {
                exitCode: 0,
                stdout: runtimeProbe().replace('"44100"', '"48000"'),
                stderr: '',
            },
        ],
        [
            'missing bitrate',
            {
                exitCode: 0,
                stdout: runtimeProbe().replace('"bit_rate":"128000",', ''),
                stderr: '',
            },
        ],
        [
            'wrong bitrate',
            {
                exitCode: 0,
                stdout: runtimeProbe().replace('"128000"', '"192000"'),
                stderr: '',
            },
        ],
    ] as const)('rejects strict runtime probe %s', async (_label, result) => {
        const run: AudioProcessRunner = async () => ({
            exitCode: result.exitCode,
            stdout: new TextEncoder().encode(result.stdout),
            stderr: result.stderr,
        });

        await expect(
            probeRuntimeMp3File('/tmp/runtime.mp3', run)
        ).rejects.toMatchObject({
            name: 'PublisherError',
            code: 'integrity',
        });
    });

    it.each([
        ['sfx', 30_001],
        ['bgm', 600_001],
    ] as const)(
        'rejects a normalized %s longer than its runtime ceiling',
        async (type, durationMs) => {
            const fixture = successfulRunner({
                duration: `${durationMs / 1_000}`,
            });
            const input = {
                ...source,
                type,
                loop: type === 'bgm',
                plannedDurationMs: durationMs,
            } as const;

            await expect(
                normalizeAudioAsset(input, fixture.run)
            ).rejects.toMatchObject({
                name: 'PublisherError',
                code: 'integrity',
            });
        }
    );

    it('warns on material duration drift without exposing prompts or paths', async () => {
        const fixture = successfulRunner({ duration: '3.000' });
        const warnings: unknown[] = [];

        const result = await normalizeAudioAsset(source, {
            run: fixture.run,
            onWarning: warning => warnings.push(warning),
        });

        expect(result.durationMs).toBe(3_000);
        expect(warnings).toHaveLength(1);
        const warningText = JSON.stringify(warnings[0]);
        expect(warningText).not.toContain('candidate-001.wav');
        expect(warningText).not.toContain('/tmp');
        expect(warningText).not.toMatch(/prompt|path/i);
    });

    it('does not warn for a duration within the non-material tolerance', async () => {
        const fixture = successfulRunner({ duration: '1.260' });
        const warnings: unknown[] = [];

        await normalizeAudioAsset(source, {
            run: fixture.run,
            onWarning: warning => warnings.push(warning),
        });

        expect(warnings).toEqual([]);
    });
});
