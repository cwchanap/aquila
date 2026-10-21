import { spawnSync } from 'node:child_process';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { getStoryContent } from '../stories';
import { hasStoryText } from '../story-metadata';
import {
    parseVoiceCast,
    planVoiceLines,
    type VoiceLineJob,
    type VoiceLocaleCast,
} from './cast';
import {
    VOICE_INDEX_SCHEMA_VERSION,
    hasStoryVoice,
    voiceIndexPath,
    voiceLinePath,
    type VoiceIndex,
} from './index';

const STORIES_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RAW_ROOT = join(STORIES_ROOT, 'raw');
export const DEFAULT_VOICE_ROOT = join(
    STORIES_ROOT,
    '../../apps/web/public/assets/vn/voice'
);
const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const RETRY_DELAYS_MS = [2_000, 5_000] as const;

const USAGE = `Usage: bun src/voice/cli.ts generate --story <rawDir> --locale <code> --scene <sceneId> [--scene ...]
  [--dry-run] [--force] [--prune] [--from-dir <dir>] [--out <voiceRoot>]

  --dry-run    print the lines that would be generated as JSON; no API calls
  --force      regenerate lines that already have audio
  --prune      delete audio no current line of the story uses
  --from-dir   take <lineId>.mp3 files from a folder instead of calling ElevenLabs
  --out        voice root (default apps/web/public/assets/vn/voice)

Needs ELEVENLABS_API_KEY unless --dry-run or --from-dir is given.`;

export type Transcode = (input: Uint8Array, outPath: string) => void;

export type VoiceCliIo = {
    fetch?: typeof fetch;
    transcode?: Transcode;
    env?: Record<string, string | undefined>;
    log?: (line: string) => void;
    sleep?: (ms: number) => Promise<void>;
    rawRoot?: string;
};

/** Mono 48 kbps mp3: clear for speech at about a third of the source size. */
export const ffmpegTranscode: Transcode = (input, outPath) => {
    const result = spawnSync(
        'ffmpeg',
        [
            '-hide_banner',
            '-loglevel',
            'error',
            '-y',
            '-i',
            'pipe:0',
            '-ac',
            '1',
            '-b:a',
            '48k',
            '-map_metadata',
            '-1',
            outPath,
        ],
        { input }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(`ffmpeg failed: ${result.stderr.toString().trim()}`);
    }
};

async function elevenLabsTts(
    job: VoiceLineJob,
    modelId: string,
    cast: VoiceLocaleCast,
    apiKey: string,
    io: Required<Pick<VoiceCliIo, 'fetch' | 'sleep'>>
): Promise<Uint8Array> {
    for (let attempt = 0; ; attempt += 1) {
        const response = await io.fetch(
            `${TTS_URL}/${job.voiceId}?output_format=mp3_44100_128`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey,
                },
                body: JSON.stringify({
                    text: job.text,
                    model_id: modelId,
                    language_code: cast.languageCode,
                }),
            }
        );
        if (response.ok) return new Uint8Array(await response.arrayBuffer());
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < RETRY_DELAYS_MS.length) {
            await io.sleep(RETRY_DELAYS_MS[attempt]);
            continue;
        }
        const detail = (await response.text()).slice(0, 300);
        throw new Error(
            `ElevenLabs HTTP ${response.status} for line ${job.lineId}: ${detail}`
        );
    }
}

async function loadStoryId(rawDir: string): Promise<string> {
    const config = (await import(join(rawDir, 'compiler.config.ts'))) as {
        default: { storyId: string };
    };
    return config.default.storyId;
}

function writeIndex(path: string, lines: string[]): void {
    const index: VoiceIndex = {
        schemaVersion: VOICE_INDEX_SCHEMA_VERSION,
        lines: [...lines].sort(),
    };
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`);
}

export async function runVoiceCli(
    argv: string[],
    io: VoiceCliIo = {}
): Promise<number> {
    const log = io.log ?? (line => console.log(line));
    const { positionals, values } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            story: { type: 'string' },
            locale: { type: 'string' },
            scene: { type: 'string', multiple: true },
            'dry-run': { type: 'boolean', default: false },
            force: { type: 'boolean', default: false },
            prune: { type: 'boolean', default: false },
            'from-dir': { type: 'string' },
            out: { type: 'string' },
        },
    });
    const scenes = values.scene ?? [];
    if (
        positionals[0] !== 'generate' ||
        !values.story ||
        !values.locale ||
        scenes.length === 0
    ) {
        log(USAGE);
        return 2;
    }

    const rawDir = join(io.rawRoot ?? RAW_ROOT, values.story);
    const castPath = join(rawDir, 'docs', 'voice-cast.json');
    if (!existsSync(castPath)) throw new Error(`No voice cast at ${castPath}`);
    const cast = parseVoiceCast(JSON.parse(readFileSync(castPath, 'utf8')));
    const locale = values.locale;
    const localeCast = cast.locales[locale];
    if (!localeCast) throw new Error(`${castPath} has no "${locale}" cast`);

    const storyId = await loadStoryId(rawDir);
    if (!hasStoryText(storyId, locale)) {
        throw new Error(`${storyId} has no ${locale} text to voice`);
    }
    const dialogue = getStoryContent(storyId, locale).dialogue;
    for (const scene of scenes) {
        if (!dialogue[scene])
            throw new Error(`${storyId} has no scene ${scene}`);
    }

    const voiceRoot = values.out ?? DEFAULT_VOICE_ROOT;
    const audioPath = (lineId: string) =>
        join(voiceRoot, voiceLinePath(storyId, locale, lineId));
    const plan = planVoiceLines(
        scenes.flatMap(scene => dialogue[scene]),
        localeCast
    );
    const pending = plan.jobs.filter(
        job => values.force || !existsSync(audioPath(job.lineId))
    );
    const characters = pending.reduce((sum, job) => sum + job.text.length, 0);

    if (values['dry-run']) {
        log(
            JSON.stringify(
                {
                    storyId,
                    locale,
                    modelId: cast.modelId,
                    languageCode: localeCast.languageCode,
                    lines: plan.jobs.length,
                    pendingCharacters: characters,
                    uncast: plan.uncast,
                    pending,
                },
                null,
                2
            )
        );
        return 0;
    }

    const fromDir = values['from-dir'];
    const apiKey = (io.env ?? process.env).ELEVENLABS_API_KEY;
    if (!fromDir && pending.length > 0 && !apiKey) {
        throw new Error('ELEVENLABS_API_KEY is required (or pass --from-dir)');
    }
    const transcode = io.transcode ?? ffmpegTranscode;
    const http = {
        fetch: io.fetch ?? fetch,
        sleep:
            io.sleep ??
            ((ms: number) => new Promise<void>(done => setTimeout(done, ms))),
    };

    let written = 0;
    for (const job of pending) {
        let bytes: Uint8Array;
        if (fromDir) {
            const source = join(fromDir, `${job.lineId}.mp3`);
            if (!existsSync(source)) {
                log(`skip ${job.lineId}: ${source} not found`);
                continue;
            }
            bytes = readFileSync(source);
        } else {
            bytes = await elevenLabsTts(
                job,
                cast.modelId,
                localeCast,
                apiKey as string,
                http
            );
        }
        const out = audioPath(job.lineId);
        mkdirSync(dirname(out), { recursive: true });
        transcode(bytes, out);
        written += 1;
        log(`wrote ${job.lineId} (${job.characterId}) ${job.text}`);
    }

    // The index lists every line of the story (not only these scenes) that
    // has audio, so generating one scene never drops another from it.
    const used = new Set(
        planVoiceLines(Object.values(dialogue).flat(), localeCast).jobs.map(
            job => job.lineId
        )
    );
    const localeDir = dirname(join(voiceRoot, voiceIndexPath(storyId, locale)));
    const present = existsSync(localeDir)
        ? readdirSync(localeDir)
              .filter(name => name.endsWith('.mp3'))
              .map(name => name.slice(0, -'.mp3'.length))
        : [];
    const orphans = present.filter(lineId => !used.has(lineId));
    if (values.prune) {
        for (const lineId of orphans) rmSync(audioPath(lineId));
    }
    writeIndex(
        join(voiceRoot, voiceIndexPath(storyId, locale)),
        present.filter(lineId => used.has(lineId))
    );

    log(
        `${written} written, ${plan.jobs.length - pending.length} already voiced, ` +
            `${orphans.length} orphaned${values.prune ? ' (pruned)' : ''}` +
            (plan.uncast.length ? `; uncast: ${plan.uncast.join(', ')}` : '')
    );
    if (!hasStoryVoice(storyId, locale)) {
        log(
            `note: add ${locale} for ${storyId} to STORY_VOICE_LOCALES in src/voice/index.ts or the reader will not play it`
        );
    }
    return 0;
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
    runVoiceCli(process.argv.slice(2)).then(
        code => process.exit(code),
        error => {
            console.error(error instanceof Error ? error.message : error);
            process.exit(1);
        }
    );
}
