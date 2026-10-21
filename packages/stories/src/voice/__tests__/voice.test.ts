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
import { getStoryContent } from '../../stories';
import { parseVoiceCast, planVoiceLines, spokenText } from '../cast';
import { ffmpegTranscode, runVoiceCli } from '../cli';
import { hasStoryVoice, voiceLineId } from '../index';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const role = { voiceId: 'v1', voiceName: 'Test' };

describe('voiceLineId', () => {
    it('is stable for the same speaker and text, and changes with either', () => {
        const line = { characterId: 'narrator', dialogue: '手機螢幕亮了。' };
        expect(voiceLineId(line)).toBe(voiceLineId({ ...line }));
        expect(voiceLineId(line)).toMatch(/^[0-9a-f]{14}$/);
        expect(voiceLineId({ ...line, characterId: 'asakura_mio' })).not.toBe(
            voiceLineId(line)
        );
        expect(voiceLineId({ ...line, dialogue: '手機螢幕亮了' })).not.toBe(
            voiceLineId(line)
        );
    });

    it('lists the stories and languages that have voice', () => {
        expect(hasStoryVoice('the_seventh_mirror', 'zh')).toBe(true);
        expect(hasStoryVoice('the_seventh_mirror', 'en')).toBe(false);
        expect(hasStoryVoice('train_adventure', 'zh')).toBe(false);
    });
});

describe('spokenText', () => {
    it('strips the inner-monologue marker and uses the inner direction', () => {
        expect(
            spokenText(
                { dialogue: '（內心）第七天了。' },
                { ...role, direction: '[calm]', innerDirection: '[softly]' }
            )
        ).toBe('[softly] 第七天了。');
        expect(
            spokenText(
                { dialogue: '(内心) 起來吧。' },
                { ...role, direction: '[calm]' }
            )
        ).toBe('[calm] 起來吧。');
    });

    it('normalizes ellipses and skips lines with nothing to say', () => {
        expect(spokenText({ dialogue: '不要⋯⋯回頭。' }, role)).toBe(
            '不要……回頭。'
        );
        expect(spokenText({ dialogue: '⋯⋯' }, role)).toBeNull();
        expect(spokenText({ dialogue: '（內心）！？' }, role)).toBeNull();
    });
});

describe('planVoiceLines', () => {
    it('dedupes repeated lines and reports uncast speakers', () => {
        const plan = planVoiceLines(
            [
                { characterId: 'narrator', dialogue: '什麼都沒有。' },
                { characterId: 'narrator', dialogue: '什麼都沒有。' },
                { characterId: 'message', dialogue: '簡訊' },
                { dialogue: 'no speaker' },
            ],
            { languageCode: 'zh', roles: { narrator: role } }
        );
        expect(plan.jobs).toHaveLength(1);
        expect(plan.jobs[0]).toMatchObject({
            characterId: 'narrator',
            voiceId: 'v1',
        });
        expect(plan.uncast).toEqual(['message']);
    });

    it('rejects a cast file with unknown fields', () => {
        expect(() =>
            parseVoiceCast({
                schemaVersion: 1,
                modelId: 'm',
                locales: {},
                extra: 1,
            })
        ).toThrow();
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
        '--locale',
        'zh',
        '--scene',
        'ch1_act1',
    ];
    const copyTranscode = (input: Uint8Array, out: string) =>
        writeFileSync(out, input);

    it('prints usage for missing arguments', async () => {
        const log = vi.fn();
        expect(await runVoiceCli(['generate'], { log })).toBe(2);
        expect(log.mock.calls[0][0]).toContain('Usage');
    });

    it('dry-runs the Seventh Mirror cast against chapter 1 act 1', async () => {
        const log = vi.fn();
        const out = tempDir();
        expect(
            await runVoiceCli([...base, '--dry-run', '--out', out], { log })
        ).toBe(0);
        const plan = JSON.parse(log.mock.calls[0][0]);
        expect(plan).toMatchObject({
            storyId: 'the_seventh_mirror',
            modelId: 'eleven_v4',
            uncast: [],
        });
        expect(plan.pending.length).toBeGreaterThan(0);
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
        const scene = getStoryContent('the_seventh_mirror', 'zh').dialogue
            .ch1_act1;
        const lines = new Set(scene.map(entry => voiceLineId(entry)));

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
            language_code: 'zh',
        });
        const index = JSON.parse(
            readFileSync(join(out, 'the_seventh_mirror/zh/index.json'), 'utf8')
        );
        expect(index.lines.length).toBe(lines.size);
        expect(fetchImpl).toHaveBeenCalledTimes(lines.size + 1);
    });

    it('imports takes from a folder, keeps existing audio, and prunes orphans', async () => {
        const out = tempDir();
        const takes = tempDir();
        const scene = getStoryContent('the_seventh_mirror', 'zh').dialogue
            .ch1_act1;
        const first = voiceLineId(scene[0]);
        writeFileSync(join(takes, `${first}.mp3`), 'take');
        const localeDir = join(out, 'the_seventh_mirror/zh');
        await runVoiceCli([...base, '--out', out, '--from-dir', takes], {
            transcode: copyTranscode,
            log: () => {},
        });
        writeFileSync(join(localeDir, '00000000000000.mp3'), 'stale');

        const log = vi.fn();
        await runVoiceCli(
            [...base, '--out', out, '--from-dir', takes, '--prune'],
            {
                transcode: copyTranscode,
                log,
            }
        );

        expect(readdirSync(localeDir).sort()).toEqual([
            `${first}.mp3`,
            'index.json',
        ]);
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

    it('rejects a missing cast, locale, text, or scene', async () => {
        const rawRoot = tempDir();
        const story = (storyId: string, locales: object) => {
            const dir = join(rawRoot, storyId);
            mkdirSync(join(dir, 'docs'), { recursive: true });
            writeFileSync(
                join(dir, 'compiler.config.ts'),
                `export default { storyId: '${storyId}' };\n`
            );
            writeFileSync(
                join(dir, 'docs', 'voice-cast.json'),
                JSON.stringify({ schemaVersion: 1, modelId: 'm', locales })
            );
        };
        story('the_seventh_mirror', {
            en: { languageCode: 'en', roles: {} },
        });
        const run = (args: string[]) =>
            runVoiceCli(args, { rawRoot, log: () => {} });

        await expect(
            run([
                'generate',
                '--story',
                'nope',
                '--locale',
                'zh',
                '--scene',
                'x',
            ])
        ).rejects.toThrow('No voice cast');
        const seventh = ['generate', '--story', 'the_seventh_mirror'];
        await expect(
            run([...seventh, '--locale', 'ja', '--scene', 'x'])
        ).rejects.toThrow('has no "ja" cast');
        await expect(
            run([...seventh, '--locale', 'en', '--scene', 'x'])
        ).rejects.toThrow('has no en text');
        await expect(
            runVoiceCli([...base, '--scene', 'nope', '--dry-run'], {
                log: () => {},
            })
        ).rejects.toThrow('has no scene nope');
    });

    it('reminds you to register a story the reader does not voice yet', async () => {
        const rawRoot = tempDir();
        const dir = join(rawRoot, 'train');
        mkdirSync(join(dir, 'docs'), { recursive: true });
        writeFileSync(
            join(dir, 'compiler.config.ts'),
            "export default { storyId: 'train_adventure' };\n"
        );
        writeFileSync(
            join(dir, 'docs', 'voice-cast.json'),
            JSON.stringify({
                schemaVersion: 1,
                modelId: 'm',
                locales: { zh: { languageCode: 'zh', roles: {} } },
            })
        );
        const log = vi.fn();

        await runVoiceCli(
            [
                'generate',
                '--story',
                'train',
                '--locale',
                'zh',
                '--scene',
                'act1',
                '--out',
                tempDir(),
            ],
            { rawRoot, log }
        );

        expect(log.mock.calls.at(-1)?.[0]).toContain('STORY_VOICE_LOCALES');
    });

    it('logs to the console by default', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
        expect(await runVoiceCli([])).toBe(2);
        expect(spy.mock.calls[0][0]).toContain('Usage');
        spy.mockRestore();
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
