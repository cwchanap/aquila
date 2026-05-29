import type { DialogueEntryIR } from './ir';
import type { ResolvedCharacter } from './config';

const HEADER_RE = /^\*\*(.+?)\*\*[：:]\s*([\s\S]*)$/;

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

    for (const block of blocks) {
        if (block.startsWith('# ')) {
            title = block.slice(2).trim();
            continue;
        }
        // Horizontal-rule separators (scene breaks) are not dialogue.
        if (/^-{3,}$/.test(block)) continue;
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
                });
                continue;
            }
            throw new Error(
                `[story-compiler] ${sourcePath}: unrecognized paragraph (no "**name**：" header):\n${block}`
            );
        }
        const name = m[1].trim();
        const dialogue = m[2].trim();
        const resolved = resolveCharacter(name);
        if (!resolved) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unknown character "${name}"`
            );
        }
        entries.push({
            characterId: resolved.id,
            displayName: resolved.displayName,
            dialogue,
        });
    }

    return { title, entries };
}
