---
name: voice-casting
description: Use when adding or extending voice acting (spoken dialogue/narration audio) for a story, scene or chapter, casting ElevenLabs voices for characters, writing a Japanese voice script, re-recording voice lines after a text or translation edit, or touching `docs/voice-cast.json`, `docs/voice-script.*.json`, `packages/stories/src/voice/` or `packages/assets/voice/`.
---

# Voice Casting

## Overview

Voice is a **Japanese dub**: each story is spoken in one language (`ja`), and the same take plays whatever language the reader shows (zh, en or ja), like an anime with subtitles. Every spoken line gets one mp3, generated with ElevenLabs `eleven_v4` text to speech (`POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}`, `language_code: "ja"`).

- **Cast**: `packages/stories/raw/<rawDir>/docs/voice-cast.json` sets `language` and maps each compiled `characterId` to an ElevenLabs voice. Characters that aren't cast stay silent.
- **Spoken text**: if the story has Japanese reader text (`STORY_TEXT_LOCALES` in `src/story-metadata.ts`), the CLI speaks that. Otherwise it reads `docs/voice-script.ja.json`: for each voiced scene, one `{ "zh": …, "ja": … }` pair per zh line, in order. The `zh` half must equal the current zh line, so a zh edit fails `voice:check` until the script is updated.
- **Line id** = hash of voice id + exact prompt (`voiceLineId()` in `src/voice/cast.ts`). A recast, a retranslation or a new direction tag asks for a new take; nothing stale is ever reused.
- **Files**: `packages/assets/voice/<storyId>/<lineId>.mp3` plus `index.json`, which maps every voiced scene to one entry per dialogue line (a line id, or `null` for silence). Translations mirror the zh source line for line, so the same position works in every language. All of it is committed, but the app never bundles it: the `Media Sync` workflow uploads it to R2 (`vn/voice/<storyId>/`) when a PR touching it merges to `main`, and the reader fetches it from `PUBLIC_ASSET_BASE_URL`.
- **Reader**: in visual mode it plays the index entry for the current scene and line. There is a Voice on/off toggle in reader settings. The reader only fetches an index for stories in `STORY_VOICE_LANGUAGE` (`src/voice/index.ts`).

Cost: 1 credit per character sent (tags included). For scale, The Seventh Mirror ch1 act1 is 46 lines and about 2,450 credits (about $0.50), which comes to about 7 minutes of audio. After transcoding to mono 48 kbps that is about 2.6 MB (roughly 0.4 MB per minute).

## Workflow

Run commands from `packages/stories`. `<rawDir>` is the folder name under `raw/`, e.g. `theSeventhMirror`.

### 1. Scope

Pick the story and scene ids, e.g. `ch1_act2`. Scene ids are the keys of the compiled dialogue map, as in `src/generated/<rawDir>/dialogue.zh.ts`. Voice one act per run, which keeps listening and re-rolling manageable.

### 2. Japanese text (stories without Japanese reader text only)

Add the scene to `docs/voice-script.ja.json`:
- One entry per zh line, in order, with `zh` copied exactly from the compiled zh dialogue.
- Silent lines (`⋯⋯` and the like) still get an entry; an empty `ja` is fine.
- Write ambiguous names in kana so the voice reads them right, e.g. 澪 → `みお`, 悠真 → `ゆうま`. The script is only spoken, never shown.
- Don't carry over `（內心）` markers. Inner monologue is detected on the zh line.
- The translation is machine-written unless a native speaker has reviewed it, so say so in the PR.

### 3. Cast

```bash
bun src/voice/cli.ts generate --story <rawDir> --scene <sceneId> --dry-run
```

The JSON output lists `uncast` characterIds and every `pending` line with its exact prompt. For each new speaker:
1. Read the character sheet (`raw/<rawDir>/docs/characters.md`) for age, temperament and speech style.
2. Find a voice:
   - Agents use the ElevenLabs connector's `creative_list_voices` with `languages: ["ja"]` and `gender`/`age`/`use_cases`.
   - Humans use the ElevenLabs Voice Library.
3. Add a role under `roles.<characterId>` with `voiceId`, `voiceName` and short `notes` explaining the choice.

Casting rules:
- One voice per character for the whole story. Recasting gives every one of that character's lines a new id, so they all need new takes.
- Narration stays silent: don't cast a `narrator` role. Voice is for characters and inner monologue only (Hapadona's call, 2026-10-28).
- `direction` is an audio tag put before every line, e.g. `[whispers]`. `innerDirection` is the tag for `（內心）` inner monologue, e.g. `[softly]`. Tags describe *how a line is spoken*, never stage actions. Keep them to one or two plain words.
- Role ids come from `compiler.config.ts` `rolePatterns`. `voice` catches every `…聲音` speaker. If a chapter has a different "voice" speaker that needs its own sound, add a dedicated role pattern first and recompile.
- Leave `message` (texts on phone screens, notes) uncast unless the scene really reads them aloud.

### 4. Generate

**With an API key:**
```bash
ELEVENLABS_API_KEY=... bun src/voice/cli.ts generate --story <rawDir> --scene <sceneId>
```

**Without a key (agent with the ElevenLabs connector):**
1. Make one flow per act with `creative_create_flow`.
2. For every `pending` job from the dry run, call `creative_generate_speech` with:
   - `model_id: "eleven_v4"`
   - `voice_id` set to the job's `voiceId`
   - `prompt` set to the job's `text`, **exactly**
   - `generations_count: 1`
   - the flow id
3. Poll `creative_get_flow_run_status`, at most 20 session ids per call. Large results land in a file, so read them with a script, not into context.
4. Download each `content_url` to `<tmpDir>/<lineId>.mp3`. Check that the generation's `prompt` equals the job's `text` before naming the file.
5. Import the downloaded takes:
   ```bash
   bun src/voice/cli.ts generate --story <rawDir> --scene <sceneId> --from-dir <tmpDir>
   ```

Both paths transcode with `ffmpeg` (mono 48 kbps mp3), write the files and rebuild `index.json` for the whole story.

### 5. Register (first scene of a story only)

Add the story to `STORY_VOICE_LANGUAGE` in `src/voice/index.ts`. The CLI prints a reminder if you forget.

### 6. Listen and re-roll

- Listen in the reader: `bun dev:web`, then open `/<locale>/reader?story=<storyId>&scene=<sceneId>&dialogue=1` in Visual Novel mode and step with Enter. Try more than one locale.
- To re-roll one line, delete its mp3 and run step 4 again. Only missing lines are pending.
- `--prune` deletes takes no current line uses. Run it after a recast or a text edit.

### 7. Ship

- Run `bun run voice:check`, `bun --filter @aquila/stories test` and `bun --filter web test`. The stories tests run `check` too, so CI fails when a committed index no longer matches the story.
- Commit the cast, the script, the mp3s and `index.json` in the same PR as any text change they belong to.

## When text changes

- **zh edit in a voiced scene**: `voice:check` fails. Update the matching `zh`/`ja` pair in the voice script, then re-run step 4 for that scene (only changed lines are pending) with `--prune`.
- **Japanese reader text edit**: the prompt changes, so the line id changes. Re-run step 4 with `--prune`.

## Delivery

Voice is generated media, so it is served from the R2 CDN and never from `apps/web/public` (see "Generated Asset Delivery" in `CLAUDE.md`). Commit new takes under `packages/assets/voice/`; after the PR merges, `.github/workflows/media-sync.yml` runs `bun --filter @aquila/infra-cloudflare media:sync`, which uploads new `.mp3`s (create-only, one-year immutable cache) and replaces each story's `index.json` (revalidated on every load). To publish by hand, run the same command with `R2_RELEASE_ACCESS_KEY_ID` and `R2_RELEASE_SECRET_ACCESS_KEY` set (`--dry-run` lists what would change). Locally the dub is silent unless `PUBLIC_ASSET_BASE_URL` points at the asset host.

Re-roll takes (step 6) **before the PR merges**. A take already on R2 is create-only with a one-year immutable cache, and a re-rolled take keeps its line id, so `media:sync` reports a conflict (and the workflow fails) instead of replacing it. Redoing a published take is a manual job: delete the object from the bucket, purge it from the CDN cache, then re-run `media:sync`.
