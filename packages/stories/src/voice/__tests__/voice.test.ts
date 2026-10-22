import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    parseVoiceCast,
    planVoiceScene,
    spokenText,
    voiceLineId,
} from '../cast';
import { ffmpegTranscode, runVoiceCli } from '../cli';
import { hasStoryVoice } from '../index';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const role = { voiceId: 'v1', voiceName: 'Test' };
const cast = (roles = {}) => ({
    schemaVersion: 2 as const,
    modelId: 'eleven_v4',
    language: 'ja',
    roles,
});

describe('voiceLineId', () => {
    it('is stable for the same voice and prompt, and changes with either', () => {
        const id = voiceLineId('v1', 'スマホの画面が光った。');
        expect(id).toBe(voiceLineId('v1', 'スマホの画面が光った。'));
        expect(id).toMatch(/^[0-9a-f]{14}$/);
        expect(voiceLineId('v2', 'スマホの画面が光った。')).not.toBe(id);
        expect(voiceLineId('v1', 'スマホの画面が光った')).not.toBe(id);
    });

    it('lists the stories that have voice', () => {
        expect(hasStoryVoice('the_seventh_mirror')).toBe(true);
        expect(hasStoryVoice('train_adventure')).toBe(false);
    });
});

describe('spokenText', () => {
    it('takes inner monologue from the zh source line', () => {
        const inner = {
            ...role,
            direction: '[calm]',
            innerDirection: '[softly]',
        };
        expect(
            spokenText({ dialogue: '（內心）第七天了。' }, '七日目。', inner)
        ).toBe('[softly] 七日目。');
        expect(
            spokenText({ dialogue: '(内心) 起來吧。' }, '起きよう。', role)
        ).toBe('起きよう。');
        expect(spokenText({ dialogue: '手機。' }, 'スマホ。', inner)).toBe(
            '[calm] スマホ。'
        );
    });

    it('normalizes ellipses and skips lines with nothing to say', () => {
        expect(spokenText({ dialogue: '' }, 'だめ⋯⋯', role)).toBe('だめ……');
        expect(spokenText({ dialogue: '' }, '⋯⋯', role)).toBeNull();
        expect(spokenText({ dialogue: '' }, '', role)).toBeNull();
    });
});

describe('planVoiceScene', () => {
    it('keeps one slot per line and reports uncast speakers', () => {
        const plan = planVoiceScene(
            [
                { characterId: 'narrator', dialogue: '什麼都沒有。' },
                { characterId: 'message', dialogue: '簡訊' },
                { dialogue: 'no speaker' },
                { characterId: 'narrator', dialogue: '⋯⋯' },
            ],
            ['何もない。', 'メッセージ', 'x', '……'],
            cast({ narrator: role })
        );
        expect(plan.slots.map(slot => slot?.text ?? null)).toEqual([
            '何もない。',
            null,
            null,
            null,
        ]);
        expect(plan.slots[0]).toMatchObject({
            characterId: 'narrator',
            voiceId: 'v1',
            lineId: voiceLineId('v1', '何もない。'),
        });
        expect(plan.uncast).toEqual(['message']);
    });

    it('rejects a cast file with unknown fields', () => {
        expect(() => parseVoiceCast({ ...cast(), extra: 1 })).toThrow();
    });
});

describe('runVoiceCli', () => {
    const dirs: string[] = [];
    const tempDir = () => {
        const dir = mkdtempSync(join(tmpdir(), 'voice-cli-'));
        dirs.push(dir);
        return dir;
    };
    afterEach(() => {
        for (const dir of dirs.splice(0))
            rmSync(dir, { recursive: true, force: true });
    });
    const base = [
        'generate',
        '--story',
        'theSeventhMirror',
        '--scene',
        'ch1_act1',
    ];
    const copyTranscode = (input: Uint8Array, out: string) =>
        writeFileSync(out, input);
    const readIndex = (out: string) =>
        JSON.parse(
            readFileSync(join(out, 'the_seventh_mirror/index.json'), 'utf8')
        );
    /** A raw story folder with its own config, cast and optional script. */
    const rawStory = (
        rawRoot: string,
        dir: string,
        storyId: string,
        script?: object
    ) => {
        mkdirSync(join(rawRoot, dir, 'docs'), { recursive: true });
        writeFileSync(
            join(rawRoot, dir, 'compiler.config.ts'),
            `export default { storyId: '${storyId}' };\n`
        );
        writeFileSync(
            join(rawRoot, dir, 'docs', 'voice-cast.json'),
            JSON.stringify(cast())
        );
        if (script) {
            writeFileSync(
                join(rawRoot, dir, 'docs', 'voice-script.ja.json'),
                JSON.stringify(script)
            );
        }
    };

    it('prints usage for a missing command or arguments', async () => {
        const log = vi.fn();
        expect(await runVoiceCli([], { log })).toBe(2);
        expect(await runVoiceCli(['generate'], { log })).toBe(2);
        expect(log.mock.calls.every(([line]) => line.includes('Usage'))).toBe(
            true
        );
    });

    it('logs to the console by default', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        expect(await runVoiceCli([])).toBe(2);
        expect(spy.mock.calls[0][0]).toContain('Usage');
        spy.mockRestore();
    });

    it('dry-runs the Japanese cast against chapter 1 act 1', async () => {
        const log = vi.fn();
        const out = tempDir();
        expect(
            await runVoiceCli([...base, '--dry-run', '--out', out], { log })
        ).toBe(0);
        const plan = JSON.parse(log.mock.calls[0][0]);
        expect(plan).toMatchObject({
            storyId: 'the_seventh_mirror',
            language: 'ja',
            modelId: 'eleven_v4',
            lines: 46,
            uncast: [],
        });
        expect(plan.pending[0].text).toBe('スマホの画面が光った。');
        expect(readdirSync(out)).toEqual([]);
    });

    it('calls ElevenLabs per pending line, retries busy responses, and writes the index', async () => {
        const out = tempDir();
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(new Response('busy', { status: 429 }))
            .mockImplementation(
                async () => new Response(new Uint8Array([1, 2, 3]))
            );

        await runVoiceCli([...base, '--out', out], {
            fetch: fetchImpl as unknown as typeof fetch,
            transcode: copyTranscode,
            env: { ELEVENLABS_API_KEY: 'key' },
            sleep: async () => {},
            log: () => {},
        });

        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toMatch(
            /^https:\/\/api\.elevenlabs\.io\/v1\/text-to-speech\/.+\?output_format=mp3_44100_128$/
        );
        expect(JSON.parse(init.body)).toMatchObject({
            model_id: 'eleven_v4',
            language_code: 'ja',
        });
        const index = readIndex(out);
        expect(index.language).toBe('ja');
        expect(index.scenes.ch1_act1).toHaveLength(46);
        expect(index.scenes.ch1_act1.every(Boolean)).toBe(true);
        expect(fetchImpl).toHaveBeenCalledTimes(47);
        expect(
            await runVoiceCli(['check', '--out', out], { log: () => {} })
        ).toBe(0);
    });

    it('imports takes from a folder, keeps positions, and prunes orphans', async () => {
        const out = tempDir();
        const takes = tempDir();
        const log = vi.fn();
        await runVoiceCli([...base, '--dry-run', '--out', out], { log });
        const first = JSON.parse(log.mock.calls[0][0]).pending[0].lineId;
        writeFileSync(join(takes, `${first}.mp3`), 'take');
        const storyDir = join(out, 'the_seventh_mirror');
        await runVoiceCli([...base, '--out', out, '--from-dir', takes], {
            transcode: copyTranscode,
            log: () => {},
        });
        writeFileSync(join(storyDir, '00000000000000.mp3'), 'stale');

        log.mockClear();
        await runVoiceCli(
            [...base, '--out', out, '--from-dir', takes, '--prune'],
            { transcode: copyTranscode, log }
        );

        expect(readdirSync(storyDir).sort()).toEqual([
            `${first}.mp3`,
            'index.json',
        ]);
        const slots = readIndex(out).scenes.ch1_act1;
        expect(slots[0]).toBe(first);
        expect(slots.slice(1).every((id: string | null) => id === null)).toBe(
            true
        );
        expect(log.mock.calls.at(-1)?.[0]).toContain('1 orphaned (pruned)');
    });

    it('requires an API key when generating without a take folder', async () => {
        await expect(
            runVoiceCli([...base, '--out', tempDir()], {
                env: {},
                log: () => {},
            })
        ).rejects.toThrow('ELEVENLABS_API_KEY');
    });

    it('reports a failed ElevenLabs request without retrying it', async () => {
        const fetchImpl = vi.fn(
            async () => new Response('bad key', { status: 401 })
        );
        await expect(
            runVoiceCli([...base, '--out', tempDir()], {
                fetch: fetchImpl as unknown as typeof fetch,
                env: { ELEVENLABS_API_KEY: 'key' },
                log: () => {},
            })
        ).rejects.toThrow(/ElevenLabs HTTP 401 .*bad key/);
        expect(fetchImpl).toHaveBeenCalledOnce();
    });

    it('rejects a missing cast, an unknown scene, or a scene with no script', async () => {
        const run = (args: string[]) =>
            runVoiceCli(['generate', ...args, '--dry-run'], { log: () => {} });
        await expect(
            runVoiceCli(['generate', '--story', 'nope', '--scene', 'x'], {
                rawRoot: tempDir(),
            })
        ).rejects.toThrow('No voice cast');
        await expect(
            run(['--story', 'theSeventhMirror', '--scene', 'nope'])
        ).rejects.toThrow('has no scene nope');
        await expect(
            run(['--story', 'theSeventhMirror', '--scene', 'ch1_act2'])
        ).rejects.toThrow('no ja text for ch1_act2');
    });

    it('rejects a voice script that no longer matches the zh text', async () => {
        const rawRoot = tempDir();
        const run = () =>
            runVoiceCli(
                [
                    'generate',
                    '--story',
                    'mirror',
                    '--scene',
                    'ch1_act1',
                    '--dry-run',
                ],
                { rawRoot, log: () => {} }
            );
        rawStory(rawRoot, 'mirror', 'the_seventh_mirror', {
            schemaVersion: 1,
            scenes: { ch1_act1: [{ zh: '不是這句。', ja: '違う。' }] },
        });
        await expect(run()).rejects.toThrow(
            'no longer matches the zh text at line 0'
        );

        rawStory(rawRoot, 'mirror', 'the_seventh_mirror', {
            schemaVersion: 1,
            scenes: { nope: [] },
        });
        await expect(run()).rejects.toThrow('has no scene nope');
    });

    it('voices from the reader text when the story has that language, and reminds you to register it', async () => {
        const rawRoot = tempDir();
        rawStory(rawRoot, 'elevator', 'elevator_game');
        const log = vi.fn();

        await runVoiceCli(
            [
                'generate',
                '--story',
                'elevator',
                '--scene',
                'act1',
                '--out',
                tempDir(),
            ],
            { rawRoot, log }
        );

        const lines = log.mock.calls.map(([line]) => line as string);
        expect(lines.at(-2)).toMatch(
            /0 written, 0 already voiced, 0 orphaned; uncast: /
        );
        expect(lines.at(-1)).toContain('STORY_VOICE_LANGUAGE');
    });

    it('checks committed indexes against the story', async () => {
        expect(await runVoiceCli(['check'], { log: () => {} })).toBe(0);

        const out = tempDir();
        mkdirSync(join(out, 'the_seventh_mirror'));
        writeFileSync(join(out, 'the_seventh_mirror/index.json'), '{}\n');
        const log = vi.fn();
        expect(await runVoiceCli(['check', '--out', out], { log })).toBe(1);
        expect(log.mock.calls[0][0]).toContain('out of date');
    });
});

describe('ffmpegTranscode', () => {
    const run = vi.mocked(spawnSync);

    it('pipes the take through ffmpeg as mono 48 kbps', () => {
        run.mockReturnValueOnce({ status: 0 } as ReturnType<typeof spawnSync>);
        const input = new Uint8Array([1]);
        ffmpegTranscode(input, '/out.mp3');
        const [command, args, options] = run.mock.calls[0];
        expect(command).toBe('ffmpeg');
        expect(args).toEqual(
            expect.arrayContaining(['-ac', '1', '-b:a', '48k', '/out.mp3'])
        );
        expect(options).toEqual({ input });
    });

    it('throws when ffmpeg is missing or fails', () => {
        run.mockReturnValueOnce({
            error: new Error('spawn ffmpeg ENOENT'),
        } as ReturnType<typeof spawnSync>);
        expect(() => ffmpegTranscode(new Uint8Array(), '/a.mp3')).toThrow(
            'ENOENT'
        );
        run.mockReturnValueOnce({
            status: 1,
            stderr: Buffer.from('bad input\n'),
        } as unknown as ReturnType<typeof spawnSync>);
        expect(() => ffmpegTranscode(new Uint8Array(), '/a.mp3')).toThrow(
            'ffmpeg failed: bad input'
        );
    });
});
