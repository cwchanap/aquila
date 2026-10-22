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
import type { DialogueEntry } from '../types';
import {
    VoiceScriptSchema,
    parseVoiceCast,
    planVoiceScene,
    type VoiceCast,
    type VoiceLineJob,
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

const USAGE = `Usage:
  bun src/voice/cli.ts generate --story <rawDir> --scene <sceneId> [--scene ...]
    [--dry-run] [--prune] [--from-dir <dir>] [--out <voiceRoot>]
  bun src/voice/cli.ts check [--out <voiceRoot>]

  generate     voice the scenes in the cast's language
  check        fail if a committed index.json no longer matches the story
  --dry-run    print the lines that would be generated as JSON; no API calls
  --prune      delete audio no current line of the story uses
  --from-dir   take <lineId>.mp3 files from a folder instead of calling ElevenLabs
  --out        voice root (default apps/web/public/assets/vn/voice)

generate needs ELEVENLABS_API_KEY unless --dry-run or --from-dir is given.`;

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
    cast: VoiceCast,
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
                    model_id: cast.modelId,
                    language_code: cast.language,
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

type VoiceStory = {
    storyId: string;
    cast: VoiceCast;
    /** zh source dialogue, which fixes every line's position. */
    dialogue: Record<string, DialogueEntry[]>;
    /** Spoken text per voiceable scene, aligned with `dialogue`. */
    spoken: Record<string, string[]>;
};

async function loadVoiceStory(rawDir: string): Promise<VoiceStory> {
    const castPath = join(rawDir, 'docs', 'voice-cast.json');
    if (!existsSync(castPath)) throw new Error(`No voice cast at ${castPath}`);
    const cast = parseVoiceCast(JSON.parse(readFileSync(castPath, 'utf8')));
    const config = (await import(join(rawDir, 'compiler.config.ts'))) as {
        default: { storyId: string };
    };
    const storyId = config.default.storyId;
    const dialogue = getStoryContent(storyId, 'zh').dialogue;
    const spoken: Record<string, string[]> = {};

    if (hasStoryText(storyId, cast.language)) {
        const translated = getStoryContent(storyId, cast.language).dialogue;
        for (const [scene, entries] of Object.entries(translated)) {
            spoken[scene] = entries.map(entry => entry.dialogue);
        }
        return { storyId, cast, dialogue, spoken };
    }

    const scriptPath = join(
        rawDir,
        'docs',
        `voice-script.${cast.language}.json`
    );
    if (!existsSync(scriptPath)) return { storyId, cast, dialogue, spoken };
    const script = VoiceScriptSchema.parse(
        JSON.parse(readFileSync(scriptPath, 'utf8'))
    );
    for (const [scene, lines] of Object.entries(script.scenes)) {
        const source = dialogue[scene];
        if (!source)
            throw new Error(`${scriptPath}: ${storyId} has no scene ${scene}`);
        const stale = source.findIndex(
            (entry, i) => lines[i]?.zh !== entry.dialogue
        );
        if (stale !== -1 || lines.length !== source.length) {
            throw new Error(
                `${scriptPath}: ${scene} no longer matches the zh text` +
                    (stale === -1 ? '' : ` at line ${stale}`)
            );
        }
        spoken[scene] = lines.map(line => line[cast.language] ?? '');
    }
    return { storyId, cast, dialogue, spoken };
}

function planScenes(
    story: VoiceStory,
    scenes: readonly string[]
): { slots: Record<string, (VoiceLineJob | null)[]>; uncast: string[] } {
    const slots: Record<string, (VoiceLineJob | null)[]> = {};
    const uncast = new Set<string>();
    for (const scene of scenes) {
        const plan = planVoiceScene(
            story.dialogue[scene],
            story.spoken[scene],
            story.cast
        );
        slots[scene] = plan.slots;
        plan.uncast.forEach(id => uncast.add(id));
    }
    return { slots, uncast: [...uncast].sort() };
}

/** The index for the files on disk: every voiceable scene with any audio. */
function buildIndex(
    story: VoiceStory,
    hasAudio: (lineId: string) => boolean
): { index: VoiceIndex; used: Set<string> } {
    const { slots } = planScenes(story, Object.keys(story.spoken).sort());
    const scenes: VoiceIndex['scenes'] = {};
    const used = new Set<string>();
    for (const [scene, jobs] of Object.entries(slots)) {
        jobs.forEach(job => job && used.add(job.lineId));
        const ids = jobs.map(job =>
            job && hasAudio(job.lineId) ? job.lineId : null
        );
        if (ids.some(id => id !== null)) scenes[scene] = ids;
    }
    return {
        index: {
            schemaVersion: VOICE_INDEX_SCHEMA_VERSION,
            language: story.cast.language,
            scenes,
        },
        used,
    };
}

function serializeIndex(index: VoiceIndex): string {
    return `${JSON.stringify(index, null, 2)}\n`;
}

async function generate(
    values: Record<string, string | boolean | string[] | undefined>,
    io: VoiceCliIo,
    log: (line: string) => void
): Promise<number> {
    const scenes = (values.scene as string[] | undefined) ?? [];
    if (typeof values.story !== 'string' || scenes.length === 0) {
        log(USAGE);
        return 2;
    }
    const story = await loadVoiceStory(
        join(io.rawRoot ?? RAW_ROOT, values.story)
    );
    const { storyId, cast } = story;
    for (const scene of scenes) {
        if (!story.dialogue[scene]) {
            throw new Error(`${storyId} has no scene ${scene}`);
        }
        if (!story.spoken[scene]) {
            throw new Error(
                `${storyId} has no ${cast.language} text for ${scene}; add it to docs/voice-script.${cast.language}.json`
            );
        }
    }

    const voiceRoot = (values.out as string | undefined) ?? DEFAULT_VOICE_ROOT;
    const audioPath = (lineId: string) =>
        join(voiceRoot, voiceLinePath(storyId, lineId));
    const planned = planScenes(story, scenes);
    const jobs = new Map<string, VoiceLineJob>();
    for (const job of Object.values(planned.slots).flat()) {
        if (job) jobs.set(job.lineId, job);
    }
    const pending = [...jobs.values()].filter(
        job => !existsSync(audioPath(job.lineId))
    );
    const characters = pending.reduce((sum, job) => sum + job.text.length, 0);

    if (values['dry-run']) {
        log(
            JSON.stringify(
                {
                    storyId,
                    language: cast.language,
                    modelId: cast.modelId,
                    lines: jobs.size,
                    pendingCharacters: characters,
                    uncast: planned.uncast,
                    pending,
                },
                null,
                2
            )
        );
        return 0;
    }

    const fromDir = values['from-dir'] as string | undefined;
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
            bytes = await elevenLabsTts(job, cast, apiKey as string, http);
        }
        const out = audioPath(job.lineId);
        mkdirSync(dirname(out), { recursive: true });
        transcode(bytes, out);
        written += 1;
        log(`wrote ${job.lineId} (${job.characterId}) ${job.text}`);
    }

    const storyDir = join(voiceRoot, storyId);
    const { index, used } = buildIndex(story, lineId =>
        existsSync(audioPath(lineId))
    );
    const present = existsSync(storyDir)
        ? readdirSync(storyDir)
              .filter(name => name.endsWith('.mp3'))
              .map(name => name.slice(0, -'.mp3'.length))
        : [];
    const orphans = present.filter(lineId => !used.has(lineId));
    if (values.prune) {
        for (const lineId of orphans) rmSync(audioPath(lineId));
    }
    mkdirSync(storyDir, { recursive: true });
    writeFileSync(
        join(voiceRoot, voiceIndexPath(storyId)),
        serializeIndex(index)
    );

    log(
        `${written} written, ${jobs.size - pending.length} already voiced, ` +
            `${orphans.length} orphaned${values.prune ? ' (pruned)' : ''}` +
            (planned.uncast.length
                ? `; uncast: ${planned.uncast.join(', ')}`
                : '')
    );
    if (!hasStoryVoice(storyId)) {
        log(
            `note: add ${storyId} to STORY_VOICE_LANGUAGE in src/voice/index.ts or the reader will not play it`
        );
    }
    return 0;
}

/** Every committed index must match the story as it reads today. */
async function check(
    values: Record<string, string | boolean | string[] | undefined>,
    io: VoiceCliIo,
    log: (line: string) => void
): Promise<number> {
    const rawRoot = io.rawRoot ?? RAW_ROOT;
    const voiceRoot = (values.out as string | undefined) ?? DEFAULT_VOICE_ROOT;
    let stale = 0;
    for (const dir of readdirSync(rawRoot).sort()) {
        if (!existsSync(join(rawRoot, dir, 'docs', 'voice-cast.json')))
            continue;
        const story = await loadVoiceStory(join(rawRoot, dir));
        const indexPath = join(voiceRoot, voiceIndexPath(story.storyId));
        if (!existsSync(indexPath)) continue;
        const { index } = buildIndex(story, lineId =>
            existsSync(join(voiceRoot, voiceLinePath(story.storyId, lineId)))
        );
        if (readFileSync(indexPath, 'utf8') !== serializeIndex(index)) {
            stale += 1;
            log(
                `${indexPath} is out of date: re-run voice:generate for ${dir}`
            );
        }
    }
    return stale === 0 ? 0 : 1;
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
            scene: { type: 'string', multiple: true },
            'dry-run': { type: 'boolean', default: false },
            prune: { type: 'boolean', default: false },
            'from-dir': { type: 'string' },
            out: { type: 'string' },
        },
    });
    if (positionals[0] === 'generate') return generate(values, io, log);
    if (positionals[0] === 'check') return check(values, io, log);
    log(USAGE);
    return 2;
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
