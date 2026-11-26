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

function loudnormReport(inputLufs: string) {
    return [
        '[Parsed_loudnorm_0 @ 0x1] ',
        JSON.stringify({
            input_i: inputLufs,
            input_tp: '-1.00',
            input_lra: '2.00',
            input_thresh: '-40.00',
        }),
    ].join('\n');
}

function volumedetectReport(peakDb: string | undefined) {
    return peakDb === undefined
        ? '[Parsed_volumedetect_0 @ 0x1] n_samples: 0'
        : `[Parsed_volumedetect_0 @ 0x1] max_volume: ${peakDb} dB`;
}

function successfulRunner(
    options: {
        readonly duration?: string;
        readonly sourceDuration?: string;
        /** What loudnorm reports as the source's integrated loudness. */
        readonly lufs?: string;
        /** What volumedetect reports as the source's peak (short clips). */
        readonly peakDb?: string | undefined;
        readonly rawLoudnessReport?: string;
    } = {}
) {
    const calls: Array<{
        executable: 'ffmpeg' | 'ffprobe';
        args: readonly string[];
    }> = [];
    const outputBytes = Uint8Array.from([9, 8, 7, 6]);
    const peakDb = 'peakDb' in options ? options.peakDb : '-20.0';
    const run: AudioProcessRunner = async (executable, args) => {
        calls.push({ executable, args: [...args] });
        if (executable === 'ffmpeg') {
            const outputPath = args.at(-1);
            if (outputPath === undefined)
                throw new Error('missing output path');
            if (outputPath === '-') {
                // A loudness measurement: nothing is written, the report is
                // on stderr.
                const stderr =
                    options.rawLoudnessReport ??
                    (args.includes('volumedetect')
                        ? volumedetectReport(peakDb)
                        : loudnormReport(options.lufs ?? '-24.0'));
                return { exitCode: 0, stdout: new Uint8Array(), stderr };
            }
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
                    ? sourceProbe(options.sourceDuration ?? '1.250')
                    : runtimeProbe(options.duration ?? '1.250')
            ),
            stderr: '',
        };
    };
    const encodeCall = () =>
        calls.find(
            call => call.executable === 'ffmpeg' && call.args.at(-1) !== '-'
        );
    const measureCall = () =>
        calls.find(
            call => call.executable === 'ffmpeg' && call.args.at(-1) === '-'
        );
    return { calls, outputBytes, run, encodeCall, measureCall };
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

        const ffmpeg = fixture.encodeCall();
        expect(ffmpeg).toBeDefined();
        expect(ffmpeg?.args).toHaveLength(26);
        expect(ffmpeg?.args.slice(0, 8)).toEqual([
            '-nostdin',
            '-hide_banner',
            '-loglevel',
            'error',
            '-protocol_whitelist',
            'file',
            '-i',
            expect.stringMatching(/source\.wav$/),
        ]);
        expect(ffmpeg?.args.slice(8, 10)).toEqual(['-map', '0:a:0']);
        expect(ffmpeg?.args.slice(10, 12)).toEqual([
            '-af',
            'volume=0.00dB,alimiter=limit=-3dB:level=disabled',
        ]);
        expect(ffmpeg?.args.slice(12)).toEqual([
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
            'ffmpeg',
            'ffprobe',
        ]);
        expect(fixture.calls[0]?.args).toContain('-select_streams');
        expect(fixture.calls[0]?.args).toContain('a:0');
        expect(fixture.calls[0]?.args).not.toContain('-nostdin');
        expect(fixture.calls[0]?.args.slice(-3)).toEqual([
            '-protocol_whitelist',
            'file',
            expect.stringMatching(/source\.wav$/),
        ]);
        expect(fixture.calls[3]?.args).toContain(
            'stream=codec_type,codec_name,sample_rate,bit_rate,duration'
        );
        expect(fixture.calls[3]?.args).not.toContain('-nostdin');
    });

    it.each(['.wav', '.mp3', '.ogg', '.m4a', '.flac'] as const)(
        'normalizes a local %s source with file-only protocol access',
        async extension => {
            const fixture = successfulRunner();

            const result = await normalizeAudioAsset(
                {
                    ...source,
                    sourceFilename: `candidate-001${extension}`,
                },
                fixture.run
            );

            expect(result.contentType).toBe('audio/mpeg');
            const sourceProbeCall = fixture.calls[0];
            expect(sourceProbeCall?.args.slice(-3)).toEqual([
                '-protocol_whitelist',
                'file',
                expect.stringMatching(
                    new RegExp(`source\\.${extension.slice(1)}$`)
                ),
            ]);
            for (const ffmpeg of fixture.calls.filter(
                call => call.executable === 'ffmpeg'
            )) {
                const inputIndex = ffmpeg.args.indexOf('-i');
                expect(ffmpeg.args[inputIndex - 2]).toBe('-protocol_whitelist');
                expect(ffmpeg.args[inputIndex - 1]).toBe('file');
            }
        }
    );

    it.each(['.m3u8', '.m3u', '.pls', '.xspf'] as const)(
        'rejects a %s playlist source before invoking ffprobe or ffmpeg',
        async extension => {
            const fixture = successfulRunner();

            await expect(
                normalizeAudioAsset(
                    {
                        ...source,
                        sourceFilename: `candidate-001${extension}`,
                    },
                    fixture.run
                )
            ).rejects.toMatchObject({
                name: 'PublisherError',
                code: 'source',
                message: 'Audio source filename must not be a playlist',
            });
            expect(fixture.calls).toEqual([]);
        }
    );

    it.each([
        ['sfx', 30_001],
        ['bgm', 600_001],
    ] as const)(
        'rejects a %s source longer than its ceiling before invoking ffmpeg',
        async (type, durationMs) => {
            const fixture = successfulRunner({
                sourceDuration: `${durationMs / 1_000}`,
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
                code: 'source',
            });
            expect(
                fixture.calls.some(call => call.executable === 'ffmpeg')
            ).toBe(false);
        }
    );

    it('accepts a readable source whose duration is reported at container level', async () => {
        const fixture = successfulRunner();
        const run: AudioProcessRunner = async (executable, args) => {
            if (executable !== 'ffprobe') return fixture.run(executable, args);
            const probeCalls = fixture.calls.filter(
                call => call.executable === 'ffprobe'
            ).length;
            fixture.calls.push({ executable, args: [...args] });
            if (probeCalls === 0) {
                const hasFormatDuration = args.includes(
                    'stream=codec_type,duration:format=duration'
                );
                return {
                    exitCode: 0,
                    stdout: new TextEncoder().encode(
                        hasFormatDuration
                            ? JSON.stringify({
                                  streams: [{ codec_type: 'audio' }],
                                  format: { duration: '1.250' },
                              })
                            : JSON.stringify({
                                  streams: [{ codec_type: 'audio' }],
                              })
                    ),
                    stderr: '',
                };
            }
            return {
                exitCode: 0,
                stdout: new TextEncoder().encode(runtimeProbe()),
                stderr: '',
            };
        };

        const result = await normalizeAudioAsset(source, run);

        expect(result.durationMs).toBe(1_250);
        expect(fixture.calls[0]?.args).toContain(
            'stream=codec_type,duration:format=duration'
        );
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

describe('normalizeAudioAsset leveling', () => {
    const limiter = 'alimiter=limit=-3dB:level=disabled';

    function levelFilter(fixture: ReturnType<typeof successfulRunner>) {
        const args = fixture.encodeCall()?.args ?? [];
        return args[args.indexOf('-af') + 1];
    }

    it('brings an sfx to -24 LUFS with one gain and a -3 dBTP ceiling', async () => {
        const fixture = successfulRunner({ lufs: '-30.0' });

        await normalizeAudioAsset(source, fixture.run);

        expect(fixture.measureCall()?.args).toContain(
            'loudnorm=print_format=json'
        );
        expect(levelFilter(fixture)).toBe(`volume=6.00dB,${limiter}`);
    });

    it('brings a bgm to -30 LUFS, quieter than the sfx', async () => {
        const fixture = successfulRunner({
            lufs: '-20.0',
            sourceDuration: '60.000',
            duration: '60.000',
        });

        await normalizeAudioAsset(
            {
                ...source,
                type: 'bgm',
                key: 'night-loop',
                loop: true,
                plannedDurationMs: 60_000,
            },
            fixture.run
        );

        expect(levelFilter(fixture)).toBe(`volume=-10.00dB,${limiter}`);
    });

    it('levels a clip under 0.4 s by its peak instead of its loudness', async () => {
        const fixture = successfulRunner({
            sourceDuration: '0.300',
            duration: '0.300',
            peakDb: '-20.0',
        });

        await normalizeAudioAsset(
            { ...source, plannedDurationMs: 300 },
            fixture.run
        );

        expect(fixture.measureCall()?.args).toContain('volumedetect');
        expect(levelFilter(fixture)).toBe(`volume=8.00dB,${limiter}`);
    });

    it('falls back to the peak when a clip just over 0.4 s decodes too short to measure', async () => {
        // A 380 ms tone encoded as MP3 probes at 418 ms, but loudnorm only
        // sees the decoded 380 ms and reports -inf. The sound is not silent.
        const fixture = successfulRunner({
            sourceDuration: '0.418',
            duration: '0.418',
            lufs: '-inf',
            peakDb: '-18.5',
        });

        await normalizeAudioAsset(
            { ...source, plannedDurationMs: 418 },
            fixture.run
        );

        const measured = fixture.calls.filter(
            call => call.executable === 'ffmpeg' && call.args.at(-1) === '-'
        );
        expect(
            measured.map(call => call.args[call.args.indexOf('-af') + 1])
        ).toEqual(['loudnorm=print_format=json', 'volumedetect']);
        expect(levelFilter(fixture)).toBe(`volume=6.50dB,${limiter}`);
    });

    it('rejects a silent source', async () => {
        // ffmpeg reports digital silence as -inf LUFS and -91 dB peak.
        const silentLong = successfulRunner({ lufs: '-inf', peakDb: '-91.0' });
        const silentShort = successfulRunner({
            sourceDuration: '0.300',
            peakDb: '-91.0',
        });
        const noReport = successfulRunner({
            sourceDuration: '0.300',
            peakDb: undefined,
        });

        for (const fixture of [silentLong, silentShort, noReport]) {
            await expect(
                normalizeAudioAsset(
                    { ...source, plannedDurationMs: 300 },
                    fixture.run
                )
            ).rejects.toMatchObject({ name: 'PublisherError', code: 'source' });
            expect(fixture.encodeCall()).toBeUndefined();
        }
    });

    it('fails clearly when the loudness report cannot be read', async () => {
        const fixture = successfulRunner({ rawLoudnessReport: 'no report' });

        await expect(
            normalizeAudioAsset(source, fixture.run)
        ).rejects.toMatchObject({ name: 'PublisherError', code: 'encoding' });
        expect(fixture.encodeCall()).toBeUndefined();
    });
});
