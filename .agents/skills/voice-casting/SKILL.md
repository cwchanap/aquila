---
name: voice-casting
description: Use when adding or extending voice acting (spoken dialogue/narration audio) for a story, scene, chapter or language, casting ElevenLabs voices for characters, re-recording voice lines after a text edit, or touching `docs/voice-cast.json`, `packages/stories/src/voice/` or `apps/web/public/assets/vn/voice/`.
---

# Voice Casting

## Overview

Every spoken line gets one mp3, generated with ElevenLabs `eleven_v4` text to speech
(`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`, `language_code` set per locale).

- **Line id** = hash of `characterId` + line text (`voiceLineId()` in `packages/stories/src/voice/index.ts`).
  Same speaker and same text share one file. If a line's text changes, it gets a new id, so the reader goes silent on that line instead of playing a stale take.
- **Files**: `apps/web/public/assets/vn/voice/<storyId>/<locale>/<lineId>.mp3` plus an `index.json` listing the ids that have audio. All of these are committed.
- **Cast**: `packages/stories/raw/<rawDir>/docs/voice-cast.json`. This maps each compiled `characterId` to an ElevenLabs voice for each locale. Characters that aren't cast stay silent.
- **Reader**: plays the line on screen in visual mode, in the language the text is shown in (`textLocale`, not the second-language line). It has a Voice on/off toggle in reader settings. The reader only looks for stories and locales listed in `STORY_VOICE_LOCALES` (`packages/stories/src/voice/index.ts`).

Cost: 1 credit per character sent (tags included). For scale, The Seventh Mirror ch1 act1 used 46 lines and 1,517 credits, which is about $0.30 and 5.5 minutes of audio. After transcoding to mono 48 kbps it is about 2.1 MB (roughly 0.4 MB per minute).

## Workflow

Run commands from `packages/stories`. `<rawDir>` is the folder name under `raw/`, e.g. `theSeventhMirror`.

### 1. Scope

Pick the story, locale and scene ids, e.g. `ch1_act2`. Scene ids are the keys of the compiled dialogue map, as in `src/generated/<rawDir>/dialogue.zh.ts`.
- The story must have text in that locale (`STORY_TEXT_LOCALES` in `src/story-metadata.ts`). Voice is per locale. A translation needs its own cast block and its own takes.
- Voice one act per run. That keeps listening and re-rolling manageable.

### 2. Cast

```bash
bun src/voice/cli.ts generate --story <rawDir> --locale <code> --scene <sceneId> --dry-run
```

The JSON output lists `uncast` characterIds and every `pending` line with its exact prompt text. For each new speaker:
1. Read the character sheet (`raw/<rawDir>/docs/characters.md`) for age, temperament and speech style.
2. Find a voice:
   - Agents use the ElevenLabs connector's `creative_list_voices` with `languages` and `gender`/`age`/`use_cases`.
   - Humans use the ElevenLabs Voice Library.
   - Match the accent to the text. For Traditional Chinese, prefer `zh-taiwan-mandarin` voices.
3. Add a role under `locales.<code>.roles.<characterId>` with `voiceId`, `voiceName` and short `notes` explaining the choice.

Casting rules:
- One voice per character for the whole story. Never recast mid-story without re-recording that character's earlier lines.
- The narrator must sound clearly different from the protagonist. For example, the Seventh Mirror uses a male narrator against a female lead.
- `direction` is an audio tag put before every line, e.g. `[whispers]`. `innerDirection` is the tag for `（內心）` inner monologue, e.g. `[softly]`. Tags describe *how a line is spoken*, never stage actions. Keep them to one or two plain words.
- Role ids come from `compiler.config.ts` `rolePatterns`. `voice` catches every `…聲音` speaker. If a chapter has a different "voice" speaker that needs its own sound, add a dedicated role pattern first and recompile. Changing a line's characterId changes its line id.
- Leave `message` (texts on phone screens, notes) uncast unless the scene really reads them aloud.

### 3. Generate

**With an API key:**
```bash
ELEVENLABS_API_KEY=... bun src/voice/cli.ts generate --story <rawDir> --locale <code> --scene <sceneId>
```

**Without a key (agent with the ElevenLabs connector):**
1. Make one flow per act with `creative_create_flow`.
2. For every `pending` job from the dry run, call `creative_generate_speech` with:
   - `model_id: "eleven_v4"`
   - `voice_id` set to the job's `voiceId`
   - `prompt` set to the job's `text`, **exactly**
   - `generations_count: 1`
   - the flow id
3. Poll `creative_get_flow_run_status`. Large results land in a file, so read them with a script, not into context.
4. Download each `content_url` to `<tmpDir>/<lineId>.mp3`. Check that the generation's `prompt` equals the job's `text` before naming the file.
5. Import the downloaded takes:
   ```bash
   bun src/voice/cli.ts generate --story <rawDir> --locale <code> --scene <sceneId> --from-dir <tmpDir>
   ```

Both paths transcode with `ffmpeg` (mono 48 kbps mp3), write the files and rebuild `index.json` for the whole story and locale.

### 4. Register (first scene of a story or locale only)

Add the locale to `STORY_VOICE_LOCALES` in `src/voice/index.ts`. The CLI prints a reminder if you forget.

### 5. Listen and re-roll

- Listen in the reader: `bun dev:web`, then open `/<locale>/reader?story=<storyId>&scene=<sceneId>&dialogue=1` in Visual Novel mode and step with Enter.
- To re-roll one line, delete its mp3 and run step 3 again. Only missing lines are pending.
- `--force` regenerates every line in the given scenes. Use it after recasting a role, and mind the credits.
- `--prune` deletes takes no current line uses. Run it after text edits.

### 6. Ship

- Run `bun --filter @aquila/stories test` and `bun --filter web test`.
- Commit the cast file, the mp3s and `index.json` in the same PR as any text change they belong to.

## When text changes

Edited lines automatically go silent. Re-run step 3 for the affected scenes; only the changed lines are pending. Then add `--prune` to drop the old takes.

## Scaling note

Voice ships from `apps/web/public` (served by Vercel), which is fine for a few chapters. A whole saga runs to hundreds of MB. Before committed voice passes about 50 MB, move it to R2 in its own PR: upload the same folder layout and point `VOICE_BASE_URL` in `apps/web/src/lib/audio/voice-player.ts` at the asset host.
