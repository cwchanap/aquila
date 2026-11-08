import type { DialogueEntryIR } from './ir';
import type { ResolvedCharacter } from './config';

const HEADER_RE = /^\*\*(.+?)\*\*(?:\s*\[([^\]]+)\])?[：:]\s*([\s\S]*)$/;
// ```bg [name]\n<prompt or "reuse <key>">\n```
const BG_BLOCK_RE = /^```bg(?:[ \t]+(\S+))?[ \t]*\n([\s\S]*?)\n```$/;
const BG_REUSE_RE = /^reuse[ \t]+(\S+)$/;
// Lowercase words joined by `_` (they become part of a TS enum member), and
// never `s<N>`, which is what unnamed blocks are numbered.
const BG_NAME_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

type PendingBackground = { prompt: string; name?: string } | { reuse: string };

function parseBgBlock(
    name: string | undefined,
    body: string,
    sourcePath: string
): PendingBackground {
    const trimmed = body.trim();
    const reuse = BG_REUSE_RE.exec(trimmed);
    if (!reuse && /^reuse(\s|$)/.test(trimmed)) {
        throw new Error(
            `[story-compiler] ${sourcePath}: malformed bg reuse block "${trimmed}"; write "reuse <key>" alone on one line`
        );
    }
    if (reuse) {
        if (name !== undefined) {
            throw new Error(
                `[story-compiler] ${sourcePath}: a bg reuse block cannot also name a background ("${name}")`
            );
        }
        return { reuse: reuse[1] };
    }
    if (name === undefined) return { prompt: body.trim() };
    if (!BG_NAME_RE.test(name) || /^s\d+$/.test(name)) {
        throw new Error(
            `[story-compiler] ${sourcePath}: invalid bg name "${name}"; use lowercase words joined by "_", not s<N>`
        );
    }
    return { prompt: body.trim(), name };
}

function applyBackground(
    entry: DialogueEntryIR,
    bg: PendingBackground | undefined
): void {
    if (bg === undefined) return;
    if ('reuse' in bg) {
        entry.backgroundReuse = bg.reuse;
        return;
    }
    entry.backgroundPrompt = bg.prompt;
    if (bg.name !== undefined) entry.backgroundName = bg.name;
}
const SFX_BLOCK_RE =
    /^```sfx[ \t]*\n[ \t]*([a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;
const BGM_BLOCK_RE =
    /^```bgm[ \t]*\n[ \t]*(stop|[a-z0-9]+(?:-[a-z0-9]+)*)[ \t]*\n```$/;

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
    let pendingBg: PendingBackground | undefined;
    let pendingSfx: string | undefined;
    let pendingBgm: string | null | undefined;

    for (const block of blocks) {
        if (block.startsWith('# ')) {
            title = block.slice(2).trim();
            continue;
        }
        // Horizontal-rule separators (scene breaks) are not dialogue.
        if (/^-{3,}$/.test(block)) continue;
        const bgMatch = BG_BLOCK_RE.exec(block);
        if (bgMatch) {
            if (pendingBg !== undefined) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: pending bg was not consumed before another bg block`
                );
            }
            pendingBg = parseBgBlock(bgMatch[1], bgMatch[2], sourcePath);
            continue;
        }
        if (block.startsWith('```bg') && !block.startsWith('```bgm')) {
            throw new Error(
                `[story-compiler] ${sourcePath}: invalid bg block; expected \`\`\`bg or \`\`\`bg <name> followed by a prompt or reuse line`
            );
        }
        const sfxMatch = SFX_BLOCK_RE.exec(block);
        if (sfxMatch) {
            if (pendingSfx !== undefined) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: pending sfx "${pendingSfx}" was not consumed before another sfx block`
                );
            }
            pendingSfx = sfxMatch[1];
            continue;
        }
        if (block.startsWith('```sfx')) {
            throw new Error(
                `[story-compiler] ${sourcePath}: invalid sfx block; expected one lowercase hyphenated cue key`
            );
        }
        const bgmMatch = BGM_BLOCK_RE.exec(block);
        if (bgmMatch) {
            if (pendingBgm !== undefined) {
                throw new Error(
                    `[story-compiler] ${sourcePath}: pending bgm was not consumed before another bgm block`
                );
            }
            const token = bgmMatch[1];
            if (token === 'stop') {
                pendingBgm = null;
            } else {
                pendingBgm = token;
            }
            continue;
        }
        if (block.startsWith('```bgm')) {
            throw new Error(
                `[story-compiler] ${sourcePath}: invalid bgm block; expected one lowercase hyphenated cue key or stop`
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
                const narration: DialogueEntryIR = {
                    characterId: defaultSpeaker.id,
                    displayName: defaultSpeaker.displayName,
                    dialogue: (wrapped ? wrapped[1] : oneLine).trim(),
                    ...(pendingSfx !== undefined ? { sfx: pendingSfx } : {}),
                    ...(pendingBgm !== undefined ? { bgm: pendingBgm } : {}),
                };
                applyBackground(narration, pendingBg);
                entries.push(narration);
                pendingBg = undefined;
                pendingSfx = undefined;
                pendingBgm = undefined;
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
        applyBackground(entry, pendingBg);
        pendingBg = undefined;
        if (pendingSfx !== undefined) {
            entry.sfx = pendingSfx;
            pendingSfx = undefined;
        }
        if (pendingBgm !== undefined) {
            entry.bgm = pendingBgm;
            pendingBgm = undefined;
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
    if (pendingBgm !== undefined) {
        throw new Error(
            `[story-compiler] ${sourcePath}: unconsumed bgm at end of scene`
        );
    }
    if (pendingBg !== undefined) {
        throw new Error(
            `[story-compiler] ${sourcePath}: unconsumed bg block at end of scene`
        );
    }

    return { title, entries };
}
