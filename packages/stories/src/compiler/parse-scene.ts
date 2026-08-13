import type { DialogueEntryIR } from './ir';
import type { ResolvedCharacter } from './config';
import { isSfxCueKey } from '../audio-cues';

const HEADER_RE = /^\*\*(.+?)\*\*(?:\s*\[([^\]]+)\])?[：:]\s*([\s\S]*)$/;
const BG_BLOCK_RE = /^```bg\s*\n([\s\S]*?)\n```$/;
const SFX_BLOCK_RE =
    /^```sfx[ \t]*\n[ \t]*([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;

export interface ParseSceneResult {
    title?: string;
    entries: DialogueEntryIR[];
}

export function parseScene(
    markdown: string,
    resolveCharacter: (name: string) => ResolvedCharacter | undefined,
    sourcePath: string,
    defaultSpeaker?: ResolvedCharacter
): ParseSceneResult {
    const text = markdown.replace(/\r\n/g, '\n');
    const blocks = text
        .split(/\n\s*\n/)
        .map(b => b.trim())
        .filter(Boolean);

    let title: string | undefined;
    const entries: DialogueEntryIR[] = [];
    let pendingBg: string | undefined;
    let pendingSfx: string | undefined;

    for (const block of blocks) {
        if (block.startsWith('# ')) {
            title = block.slice(2).trim();
            continue;
        }
        // Horizontal-rule separators (scene breaks) are not dialogue.
        if (/^-{3,}$/.test(block)) continue;
        const bgMatch = BG_BLOCK_RE.exec(block);
        if (bgMatch) {
            pendingBg = bgMatch[1].trim();
            continue;
        }
        const sfxMatch = SFX_BLOCK_RE.exec(block);
        if (sfxMatch) {
            if (pendingSfx !== undefined) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: pending sfx "${pendingSfx}" was not consumed before another sfx block`
                );
            }
            const cueKey = sfxMatch[1];
            if (!isSfxCueKey(cueKey)) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: unknown sfx cue "${cueKey}"`
                );
            }
            pendingSfx = cueKey;
            continue;
        }
        if (block.startsWith('```sfx')) {
            throw new Error(
                `[story-compiler] ${sourcePath}: invalid sfx block; expected one lowercase hyphenated cue key`
            );
        }
        const oneLine = block.replace(/\n+/g, ' ').trim();
        const m = HEADER_RE.exec(oneLine);
        if (!m) {
            // Non-header paragraph (forum post, news article, bold marker like
            // **<完>**). With a defaultSpeaker, render it as narration; otherwise
            // it is a malformed scene and we fail loudly.
            if (defaultSpeaker) {
                const wrapped = /^\*\*([\s\S]+)\*\*$/.exec(oneLine);
                entries.push({
                    characterId: defaultSpeaker.id,
                    displayName: defaultSpeaker.displayName,
                    dialogue: (wrapped ? wrapped[1] : oneLine).trim(),
                    ...(pendingBg !== undefined
                        ? { backgroundPrompt: pendingBg }
                        : {}),
                    ...(pendingSfx !== undefined ? { sfx: pendingSfx } : {}),
                });
                pendingBg = undefined;
                pendingSfx = undefined;
                continue;
            }
            throw new Error(
                `[story-compiler] ${sourcePath}: unrecognized paragraph (no "**name**：" header):\n${block}`
            );
        }
        const name = m[1].trim();
        const expressionKey = m[2]?.trim().toLowerCase();
        const dialogue = m[3].trim();
        const resolved = resolveCharacter(name);
        if (!resolved) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unknown character "${name}"`
            );
        }
        const entry: DialogueEntryIR = {
            characterId: resolved.id,
            displayName: resolved.displayName,
            dialogue,
        };
        if (pendingBg !== undefined) {
            entry.backgroundPrompt = pendingBg;
            pendingBg = undefined;
        }
        if (pendingSfx !== undefined) {
            entry.sfx = pendingSfx;
            pendingSfx = undefined;
        }
        if (expressionKey) {
            entry.expressionKey = expressionKey;
        }
        entries.push(entry);
    }

    if (pendingSfx !== undefined) {
        throw new Error(
            `[story-compiler] ${sourcePath}: unconsumed sfx "${pendingSfx}" at end of scene`
        );
    }

    return { title, entries };
}
