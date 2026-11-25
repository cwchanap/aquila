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
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    parseVoiceCast,
    planVoiceScene,
    spokenText,
    voiceLineId,
} from '../cast';
import { ffmpegTranscode, runVoiceCli, translatedScenesIn } from '../cli';
import { getStoryContent } from '../../stories';
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
        expect(hasStoryVoice('train_adventure')).toBe(true);
        expect(hasStoryVoice('dont_save_me_before_midnight')).toBe(false);
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

    it('takes inner monologue from the speaker label or a mixed direction', () => {
        const inner = { ...role, innerDirection: '[softly]' };
        expect(
            spokenText(
                { character: '李杰（內心）', dialogue: '嗯？那個人⋯⋯' },
                'ん？あの人……',
                inner
            )
        ).toBe('[softly] ん？あの人……');
        expect(
            spokenText(
                { dialogue: '(猛然轉頭，內心)這是...車門的聲音！' },
                'これは……ドアの音だ！',
                inner
            )
        ).toBe('[softly] これは……ドアの音だ！');
        expect(
            spokenText(
                { character: '李杰', dialogue: '走吧。' },
                '行こう。',
                inner
            )
        ).toBe('行こう。');
    });

    it('never speaks leading stage directions', () => {
        const inner = { ...role, direction: '[smug]' };
        expect(
            spokenText(
                { dialogue: '(推了推眼鏡,語帶嘲諷)哼。' },
                '（眼鏡を押し上げ、皮肉っぽく）ふん。',
                inner
            )
        ).toBe('[smug] ふん。');
        expect(
            spokenText(
                { dialogue: '(小聲)欸欸。' },
                '(小声で) ねえねえ。',
                role
            )
        ).toBe('ねえねえ。');
        expect(
            spokenText({ dialogue: '（沉默）' }, '（黙り込む）', role)
        ).toBeNull();
    });

    it('never speaks the ja inner monologue marker', () => {
        const inner = { ...role, innerDirection: '[softly]' };
        expect(
            spokenText(
                { dialogue: '（內心）蕪菁。' },
                '（心の声）かぶ。',
                inner
            )
        ).toBe('[softly] かぶ。');
    });

    it('lets a line direction replace the role tags, inner monologue included', () => {
        const shy = { ...role, direction: '[shy]', innerDirection: '[softly]' };
        expect(
            spokenText(
                { dialogue: '(大喊)有人嗎——？' },
                '（叫ぶ）誰か、いませんか――？',
                shy,
                '[shouting] [trembling voice]'
            )
        ).toBe('[shouting] [trembling voice] 誰か、いませんか――？');
        expect(
            spokenText(
                { dialogue: '（內心）好。' },
                '（心の声）はい。',
                shy,
                '[shouting]'
            )
        ).toBe('[shouting] はい。');
        expect(spokenText({ dialogue: '好。' }, 'はい。', shy)).toBe(
            '[shy] はい。'
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

    describe('line directions', () => {
        const source = [
            { characterId: 'narrator', dialogue: '旁白。' },
            { characterId: 'narrator', dialogue: '(大喊)有人嗎？' },
            { characterId: 'narrator', dialogue: '(小聲)嗯。' },
        ];
        const spoken = ['ナレーション。', '誰かいますか？', 'うん。'];
        const shout = { zh: '(大喊)有人嗎？', direction: '[shouting]' };
        const withDirections = (lineDirections: object) =>
            parseVoiceCast({
                ...cast({ narrator: { ...role, direction: '[calm]' } }),
                lineDirections,
            });

        it('replaces the role tags on the numbered line of that scene only', () => {
            const cast = withDirections({ act8: { '2': shout } });
            const texts = (sceneId?: string) =>
                planVoiceScene(source, spoken, cast, sceneId).slots.map(
                    slot => slot?.text
                );
            expect(texts('act8')).toEqual([
                '[calm] ナレーション。',
                '[shouting] 誰かいますか？',
                '[calm] うん。',
            ]);
            expect(texts('act9')).toEqual([
                '[calm] ナレーション。',
                '[calm] 誰かいますか？',
                '[calm] うん。',
            ]);
            // A new tag is a new take: the line id follows the prompt.
            expect(
                planVoiceScene(source, spoken, cast, 'act8').slots[1]?.lineId
            ).toBe(voiceLineId('v1', '[shouting] 誰かいますか？'));
        });

        it('fails when a line inserted above moves the number onto another voiced line', () => {
            const cast = withDirections({ act8: { '2': shout } });
            const inserted = [
                source[0],
                { characterId: 'narrator', dialogue: '(新)插入的一行。' },
                source[1],
                source[2],
            ];
            // Both old positions still hold voiced lines, so only the zh pin
            // can tell that the shout would land on the inserted line.
            expect(() =>
                planVoiceScene(
                    inserted,
                    ['ナレーション。', '挿入。', '誰かいますか？', 'うん。'],
                    cast,
                    'act8'
                )
            ).toThrow('act8 line 2 no longer matches its zh text');
        });

        it('fails on a line that is gone or has nothing to say', () => {
            const plan = (lines: typeof source, line: string, zh: string) =>
                planVoiceScene(
                    lines,
                    ['ナレーション。', '誰かいますか？', '……'],
                    withDirections({ act8: { [line]: { ...shout, zh } } }),
                    'act8'
                );
            expect(() => plan(source, '4', '(小聲)嗯。')).toThrow(
                'act8 line 4 no longer matches its zh text'
            );
            // The line is there and pinned, but its spoken text is silent.
            expect(() => plan(source, '3', '(小聲)嗯。')).toThrow(
                'act8 line 3 is not a voiced line'
            );
        });

        it('speaks a line that is only a stage direction when the direction gives its text', () => {
            const silentSource = [
                ...source,
                { characterId: 'narrator', dialogue: '(睜大眼睛,無法出聲)' },
            ];
            const silentSpoken = [...spoken, '（目を見開くが、声が出ない）'];
            const gasp = {
                zh: '(睜大眼睛,無法出聲)',
                direction: '[gasps]',
                text: 'かはっ……',
            };
            const plan = (lineDirections: object) =>
                planVoiceScene(
                    silentSource,
                    silentSpoken,
                    withDirections(lineDirections),
                    'act8'
                );
            expect(plan({}).slots[3]).toBeNull();
            expect(plan({ act8: { '4': gasp } }).slots[3]).toMatchObject({
                text: '[gasps] かはっ……',
                lineId: voiceLineId('v1', '[gasps] かはっ……'),
            });
            // The text is still pinned to its line, and cannot be blank.
            expect(() =>
                plan({ act8: { '3': { ...gasp, zh: '(睜大眼睛,無法出聲)' } } })
            ).toThrow('act8 line 3 no longer matches its zh text');
            expect(() =>
                withDirections({ act8: { '4': { ...gasp, text: ' ' } } })
            ).toThrow();
        });

        it('wants 1-based line numbers and a zh pin with every direction', () => {
            expect(() => withDirections({ act8: { '0': shout } })).toThrow();
            expect(() => withDirections({ act8: { two: shout } })).toThrow();
            expect(() =>
                withDirections({ act8: { '2': '[shouting]' } })
            ).toThrow();
            expect(() =>
                withDirections({ act8: { '2': { direction: '[shouting]' } } })
            ).toThrow();
        });
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
            lines: 8,
            uncast: ['narrator'],
        });
        expect(plan.pending[0].text).toBe('[whispers] だめ……振り返らないで。');
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
        expect(index.scenes.ch1_act1.filter(Boolean)).toHaveLength(8);
        expect(fetchImpl).toHaveBeenCalledTimes(9);
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
        expect(slots.filter(Boolean)).toEqual([first]);
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
            run(['--story', 'theSeventhMirror', '--scene', 'ch28_act8'])
        ).rejects.toThrow('no ja text for ch28_act8');
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

    it('takes translated scenes from compiler provenance, not text equality', async () => {
        // train_adventure's ja tree covers act1, the b1b route and the first acts
        // of b1a; the deep b1a routes are still zh.
        const translated = await translatedScenesIn('train_adventure', 'ja');
        expect(translated.has('act1')).toBe(true);
        expect(translated.has('b1a_b2b_b3b_b4b_b5a_b6d_act72')).toBe(false);
        // A story with no mirror tree has no translated scenes.
        expect(await translatedScenesIn('the_seventh_mirror', 'ja')).toEqual(
            new Set()
        );
    });

    it('throws on a locale index built before translated-scene provenance', async () => {
        const probeDir = fileURLToPath(
            new URL('../../generated/staleProbe', import.meta.url)
        );
        mkdirSync(probeDir, { recursive: true });
        try {
            writeFileSync(
                join(probeDir, 'dialogue.ja.ts'),
                'export const staleProbeJaDialogue = {};\n'
            );
            await expect(
                translatedScenesIn('stale_probe', 'ja')
            ).rejects.toThrow('re-run bun compile:stories');
        } finally {
            rmSync(probeDir, { recursive: true, force: true });
        }
    });

    it('voices from the voice script for scenes a partial ja tree has not translated', async () => {
        const rawRoot = tempDir();
        const run = () =>
            runVoiceCli(
                [
                    'generate',
                    '--story',
                    'train',
                    '--scene',
                    'b1a_b2b_b3b_b4b_b5a_b6d_act72',
                    '--dry-run',
                ],
                { rawRoot, log: () => {} }
            );
        rawStory(rawRoot, 'train', 'train_adventure');
        // train_adventure's ja tree is partial: the ja read of this late b1a
        // scene is the zh source, which is not voice input — the scene needs
        // the script.
        await expect(run()).rejects.toThrow(
            'no ja text for b1a_b2b_b3b_b4b_b5a_b6d_act72'
        );

        const act = getStoryContent('train_adventure', 'zh').dialogue
            .b1a_b2b_b3b_b4b_b5a_b6d_act72;
        rawStory(rawRoot, 'train', 'train_adventure', {
            schemaVersion: 1,
            scenes: {
                b1a_b2b_b3b_b4b_b5a_b6d_act72: act.map(entry => ({
                    zh: entry.dialogue,
                    ja: 'あ',
                })),
            },
        });
        await expect(run()).resolves.toBe(0);
    });

    it('voices from the reader text when the story has that language', async () => {
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
        expect(lines.at(-1)).toMatch(
            /0 written, 0 already voiced, 0 orphaned; uncast: /
        );
    });

    it('rejects line directions for a scene with no spoken text', async () => {
        const rawRoot = tempDir();
        const run = (scene: string) => {
            rawStory(rawRoot, 'train', 'train_adventure');
            writeFileSync(
                join(rawRoot, 'train', 'docs', 'voice-cast.json'),
                JSON.stringify({
                    ...cast(),
                    lineDirections: {
                        [scene]: { '1': { zh: 'x', direction: '[shouting]' } },
                    },
                })
            );
            return runVoiceCli(
                [
                    'generate',
                    '--story',
                    'train',
                    '--scene',
                    'b1a_b2a_act8',
                    '--dry-run',
                ],
                { rawRoot, log: () => {} }
            );
        };
        // No such scene at all, and a real scene the ja tree has not
        // translated (no voice script either): neither can take a direction.
        await expect(run('nope')).rejects.toThrow(
            'lineDirections names nope, which has no ja text'
        );
        await expect(run('b1a_b2b_b3b_b4b_b5a_b6d_act72')).rejects.toThrow(
            'lineDirections names b1a_b2b_b3b_b4b_b5a_b6d_act72, which has no ja text'
        );
    });

    it('reminds you to register a story the reader does not voice yet', async () => {
        const rawRoot = tempDir();
        const act1 = getStoryContent('dont_save_me_before_midnight', 'zh')
            .dialogue.ch1_act1;
        rawStory(rawRoot, 'midnight', 'dont_save_me_before_midnight', {
            schemaVersion: 1,
            scenes: {
                ch1_act1: act1.map(entry => ({ zh: entry.dialogue, ja: 'あ' })),
            },
        });
        const log = vi.fn();

        await runVoiceCli(
            [
                'generate',
                '--story',
                'midnight',
                '--scene',
                'ch1_act1',
                '--out',
                tempDir(),
            ],
            { rawRoot, log }
        );

        const lines = log.mock.calls.map(([line]) => line as string);
        expect(lines.at(-2)).toMatch(/0 written, 0 already voiced/);
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

    it('levels the take to -20 LUFS and encodes it as mono 48 kbps', () => {
        run.mockReturnValueOnce({
            status: 0,
            stderr: Buffer.from(
                '[Parsed_loudnorm_0]\n{\n\t"input_i" : "-31.50"\n}\n'
            ),
        } as unknown as ReturnType<typeof spawnSync>);
        run.mockReturnValueOnce({ status: 0 } as ReturnType<typeof spawnSync>);
        const input = new Uint8Array([1]);
        ffmpegTranscode(input, '/out.mp3');

        const [measure, measureArgs, measureOptions] = run.mock.calls[0];
        expect(measure).toBe('ffmpeg');
        expect(measureArgs).toEqual(
            expect.arrayContaining(['loudnorm=print_format=json', '-f', 'null'])
        );
        expect(measureOptions).toEqual({ input });

        const [encode, encodeArgs, encodeOptions] = run.mock.calls[1];
        expect(encode).toBe('ffmpeg');
        expect(encodeArgs).toEqual(
            expect.arrayContaining([
                'volume=11.50dB,alimiter=limit=-3dB:level=disabled',
                '-ac',
                '1',
                '-b:a',
                '48k',
                '/out.mp3',
            ])
        );
        expect(encodeOptions).toEqual({ input });
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
