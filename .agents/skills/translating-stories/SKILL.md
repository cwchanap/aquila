---
name: translating-stories
description: Use when translating story acts from the zh source into English or Japanese, i.e. writing or editing files under `packages/stories/raw/<story>/en/` or `raw/<story>/ja/` mirror trees, or the `choices.en.ts` / `choices.ja.ts` files of a story.
---

# Translating Stories

Stories are written in Traditional Chinese under `packages/stories/raw/<story>/`.
A translation is a **mirror tree** — `raw/<story>/en/` or `raw/<story>/ja/` —
holding the same act files at the same relative paths
(`raw/trainAdventure/branch_1a/act4.md` → `raw/trainAdventure/en/branch_1a/act4.md`).
The compiler (`src/compiler/localize.ts`) lines each translated entry up with
the zh entry at the same index and copies its background, portrait, sfx and bgm,
so the text is the only thing a translation holds. A scene with no translated
file falls back to the zh scene, so a tree can be filled in route by route.

## Before writing

1. Read the story's `docs/characters.md` and, if present,
   `docs/translation-glossary.md`. Use its names, labels and terms exactly.
2. Read the whole zh act before translating it, and the end of the previous act
   for continuity.

## Hard rules (the compiler rejects violations)

- **One block per zh block, in order.** Blocks are separated by a blank line;
  each `**Speaker**：…` block, and each speakerless narration paragraph, is one
  entry. Never merge, split, drop or add one, even for a one-word line or a
  repeated line. Count before you finish.
- **Same speaker.** Each speaker label must resolve to the same character as the
  zh label at that position. Labels resolve through `characters.md` (heading
  name + `Aliases`). If you need a label that does not resolve, add it to that
  character's `Aliases` (and to the glossary) — never reuse another character's
  label.
- **No fenced blocks** (` ```bg `, ` ```sfx `, ` ```bgm `) and **no
  `[expression]` tags** — they come from zh. Drop them; do not translate them.
- The `# ` act title line is translated (`# Act 4: The Choice on the
  Platform`, `# 第四幕：ホームでの選択`).
- Never edit the zh source to make the counts fit.

## English

- `**Speaker**: text` with an ASCII colon and space.
- Inner thoughts: zh `(內心)` → `(thinking)` at the start of the line.
- zh `⋯⋯` → `...`; zh `「」` → `"…"`; `『』` → `'…'`; `——` → an em dash `—`.
- Natural, idiomatic, past-tense literary English for narration; voice each
  character as the zh does (slang stays slangy, formal stays formal). Translate
  meaning, not word order; trim zh filler that reads as padding in English but
  keep every beat.

## Japanese

- `**Speaker**：text` with a full-width colon.
- Inner thoughts: `（心の声）` at the start of the line.
- `……` for ellipses, `「」` for speech inside narration, `――` for dashes.
- Natural Japanese light-novel prose: ナレーション in plain form (だ/である
  style); dialogue in each character's natural register.
- **Furigana on every kanji word, every time**, Aozora style:
  `｜漢字《かんじ》`. The full-width bar `｜` is required. Readings are
  hiragana only (no katakana, no spaces). Ruby only kanji (and 々); never wrap
  kana or punctuation: `｜食《た》べる`, not `｜食べる《たべる》`. Speaker labels
  and the `# ` title take no furigana.
- Names and terms use the glossary's kanji and readings.

## Verify

```bash
bun compile:stories                                        # alignment + speaker checks
bun --filter @aquila/stories test src/__tests__/locales.test.ts
# ja only: kana inside a ruby base (should print nothing)
grep -nP '｜[^《》｜]*[\p{Hiragana}\p{Katakana}][^《》｜]*《' <file>
```

A count or speaker error names the file and entry; fix the translation, not the
source. Spot-check a few entries side by side with zh before reporting back.

## Report back

Files written, any aliases or glossary rows added, and any zh line you found
ambiguous or likely mistaken (do not fix the zh yourself).
