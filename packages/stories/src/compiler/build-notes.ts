import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
    StoryNoteCharacter,
    StoryNoteEvent,
    StoryNotes,
    StoryNoteText,
} from '../notes-types';
import type { NoteUnlockTargetIR, SceneIR } from './ir';
import type { MirrorLocale } from './localize';
import type { ParsedCharacterDirectory } from './parse-characters';
import { parseNotesMarkdown, type ParsedNotes } from './parse-notes';
import { DEFAULT_SUFFIX_RE, stripSuffix } from './resolve-character';

const NARRATOR_ID = 'narrator';

export interface CompileStoryNotesOptions {
    rawDir: string;
    storyId: string;
    scenes: SceneIR[];
    mirrors?: Partial<Record<MirrorLocale, SceneIR[]>>;
    charDir: ParsedCharacterDirectory;
    suffixRegex?: RegExp;
}

function readNotesFile(
    rawDir: string,
    locale: 'zh' | MirrorLocale
): ParsedNotes | undefined {
    const sourcePath = `notes/${locale}.md`;
    const fullPath = join(rawDir, sourcePath);
    if (!existsSync(fullPath)) return undefined;
    return parseNotesMarkdown(
        readFileSync(fullPath, 'utf8'),
        sourcePath,
        locale
    );
}

function textWithFallback(
    zh: string,
    en: string | undefined,
    ja: string | undefined
): StoryNoteText {
    return { zh, en: en ?? zh, ja: ja ?? zh };
}

function labelOf(
    scene: SceneIR,
    entryIndex: number,
    mirror: Partial<Record<MirrorLocale, SceneIR[]>> | undefined,
    locale: MirrorLocale
): string {
    const translated = mirror?.[locale]?.find(s => s.id === scene.id);
    return translated?.entries[entryIndex]?.displayName ?? '';
}

function unlockLabel(target: NoteUnlockTargetIR): string {
    return target.kind === 'fact'
        ? `${target.characterId}.${target.factId}`
        : `${target.characterId}.${target.kind}`;
}

/**
 * Compiles `raw/<story>/notes/{zh,en,ja}.md` plus the Chinese dialogue unlock
 * fences into the compact runtime notes contract. zh defines every character,
 * fact and structural flag; en/ja only override text. Returns undefined when
 * the story has no notes source.
 */
export function compileStoryNotes(
    opts: CompileStoryNotesOptions
): StoryNotes | undefined {
    const zh = readNotesFile(opts.rawDir, 'zh');
    const en = readNotesFile(opts.rawDir, 'en');
    const ja = readNotesFile(opts.rawDir, 'ja');

    if (!zh) {
        if (en || ja) {
            throw new Error(
                `[story-compiler] notes/${en ? 'en' : 'ja'}.md exists without notes/zh.md`
            );
        }
        for (const scene of opts.scenes) {
            for (const [entryIndex, entry] of scene.entries.entries()) {
                const firstUnlock = entry.unlocks?.[0];
                if (firstUnlock) {
                    throw new Error(
                        `[story-compiler] unlock marker "${unlockLabel(firstUnlock)}" in ${scene.sourcePath} at entry ${entryIndex + 1} but the story has no notes/zh.md`
                    );
                }
            }
        }
        return undefined;
    }

    const sections = (parsed: ParsedNotes | undefined) =>
        (parsed?.characters ?? []).filter(s => s.id !== NARRATOR_ID);
    const enById = new Map(sections(en).map(s => [s.id, s]));
    const jaById = new Map(sections(ja).map(s => [s.id, s]));

    const characters: StoryNoteCharacter[] = [];
    const zhById = new Map(sections(zh).map(s => [s.id, s]));

    for (const section of sections(zh)) {
        const info = opts.charDir.getById(section.id);
        if (!info) {
            throw new Error(
                `[story-compiler] notes/zh.md:${section.line}: unknown character "${section.id}"; add it to docs/characters.md or remove the section`
            );
        }
        const enSection = enById.get(section.id);
        const jaSection = jaById.get(section.id);

        for (const [locale, mirrorSection] of [
            ['en', enSection],
            ['ja', jaSection],
        ] as const) {
            if (
                mirrorSection?.knownAs !== undefined &&
                section.knownAs === undefined
            ) {
                throw new Error(
                    `[story-compiler] notes/${locale}.md:${mirrorSection.knownAsLine}: known-as can only be declared in zh.md`
                );
            }
        }

        const facts = section.facts.map(fact => {
            const enText = enSection?.facts.find(f => f.id === fact.id)?.text;
            const jaText = jaSection?.facts.find(f => f.id === fact.id)?.text;
            return {
                id: fact.id,
                text: textWithFallback(fact.text, enText, jaText),
            };
        });

        characters.push({
            id: section.id,
            hidden: section.hidden,
            name: textWithFallback(info.name, enSection?.name, jaSection?.name),
            ...(section.knownAs !== undefined
                ? {
                      knownAs: textWithFallback(
                          section.knownAs,
                          enSection?.knownAs,
                          jaSection?.knownAs
                      ),
                  }
                : {}),
            facts,
        });
    }

    for (const [locale, parsed] of [
        ['en', en],
        ['ja', ja],
    ] as const) {
        for (const section of sections(parsed)) {
            const zhSection = zhById.get(section.id);
            if (!zhSection) {
                throw new Error(
                    `[story-compiler] notes/${locale}.md:${section.line}: orphan character "${section.id}"; add it to notes/zh.md first`
                );
            }
            for (const fact of section.facts) {
                if (!zhSection.facts.some(f => f.id === fact.id)) {
                    throw new Error(
                        `[story-compiler] notes/${locale}.md:${fact.line}: orphan fact "${fact.id}" for character "${section.id}"`
                    );
                }
            }
        }
    }

    const noteById = new Map(characters.map(c => [c.id, c]));
    const suffixRegex = opts.suffixRegex ?? DEFAULT_SUFFIX_RE;
    const strip = (label: string) =>
        stripSuffix(label, suffixRegex) || label.trim();
    const events: StoryNoteEvent[] = [];
    const seenSpeech = new Set<string>();
    const seenName = new Set<string>();
    const explicitMet = new Set<string>();

    for (const scene of opts.scenes) {
        for (const [entryIndex, entry] of scene.entries.entries()) {
            const noteCharacter = noteById.get(entry.characterId);
            if (noteCharacter) {
                const sceneKey = `${entry.characterId}:${scene.id}`;
                if (!seenSpeech.has(sceneKey)) {
                    seenSpeech.add(sceneKey);
                    const zhLabel = strip(entry.displayName);
                    events.push({
                        sceneId: scene.id,
                        entryIndex,
                        characterId: entry.characterId,
                        kind: 'speech',
                        labels: {
                            zh: zhLabel,
                            en: strip(
                                labelOf(
                                    scene,
                                    entryIndex,
                                    opts.mirrors,
                                    'en'
                                ) || entry.displayName
                            ),
                            ja: strip(
                                labelOf(
                                    scene,
                                    entryIndex,
                                    opts.mirrors,
                                    'ja'
                                ) || entry.displayName
                            ),
                        },
                    });
                }
                if (
                    !seenName.has(sceneKey) &&
                    strip(entry.displayName) === noteCharacter.name.zh
                ) {
                    seenName.add(sceneKey);
                    events.push({
                        sceneId: scene.id,
                        entryIndex,
                        characterId: entry.characterId,
                        kind: 'name',
                    });
                }
            }

            const emittedAtEntry = new Set<string>();
            for (const target of entry.unlocks ?? []) {
                const targetCharacter = noteById.get(target.characterId);
                if (!targetCharacter) {
                    throw new Error(
                        opts.charDir.getById(target.characterId)
                            ? `[story-compiler] ${scene.sourcePath}: unlock target "${unlockLabel(target)}" at entry ${entryIndex + 1} references character "${target.characterId}" with no notes section`
                            : `[story-compiler] ${scene.sourcePath}: unlock target "${unlockLabel(target)}" at entry ${entryIndex + 1} references unknown character "${target.characterId}"`
                    );
                }
                if (
                    target.kind === 'fact' &&
                    !targetCharacter.facts.some(f => f.id === target.factId)
                ) {
                    throw new Error(
                        `[story-compiler] ${scene.sourcePath}: unlock target "${unlockLabel(target)}" at entry ${entryIndex + 1} references fact "${target.factId}" which is not defined for character "${target.characterId}"`
                    );
                }
                const key = `${target.characterId}:${target.kind}:${target.factId ?? ''}`;
                if (emittedAtEntry.has(key)) continue;
                emittedAtEntry.add(key);
                if (target.kind === 'met') {
                    explicitMet.add(target.characterId);
                }
                events.push({
                    sceneId: scene.id,
                    entryIndex,
                    characterId: target.characterId,
                    kind: target.kind,
                    ...(target.kind === 'fact'
                        ? { factId: target.factId }
                        : {}),
                });
            }
        }
    }

    for (const character of characters) {
        const section = zhById.get(character.id)!;
        if (!events.some(e => e.characterId === character.id)) {
            throw new Error(
                `[story-compiler] notes/zh.md:${section.line}: character "${character.id}" can never be met by any speech, .met, .name or fact marker`
            );
        }
        for (const fact of character.facts) {
            const unlocked = events.some(
                e =>
                    e.kind === 'fact' &&
                    e.characterId === character.id &&
                    e.factId === fact.id
            );
            if (!unlocked) {
                const factLine = section.facts.find(
                    f => f.id === fact.id
                )!.line;
                throw new Error(
                    `[story-compiler] notes/zh.md:${factLine}: fact "${fact.id}" is never unlocked by an unlock fence for character "${character.id}"`
                );
            }
        }
        if (character.knownAs !== undefined && !explicitMet.has(character.id)) {
            throw new Error(
                `[story-compiler] notes/zh.md:${section.knownAsLine}: known-as requires at least one explicit .met marker for character "${character.id}"`
            );
        }
    }

    return { storyId: opts.storyId, characters, events };
}
