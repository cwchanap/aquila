import type { CharacterId } from '../characters';
import type { DialogueEntryIR } from './ir';

const HEADER_RE = /^\*\*(.+?)\*\*[：:]\s*([\s\S]*)$/;

export interface ParseSceneResult {
    title?: string;
    entries: DialogueEntryIR[];
}

export function parseScene(
    markdown: string,
    resolveCharacter: (name: string) => CharacterId | undefined,
    sourcePath: string
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
        const oneLine = block.replace(/\n+/g, ' ').trim();
        const m = HEADER_RE.exec(oneLine);
        if (!m) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unrecognized paragraph (no "**name**：" header):\n${block}`
            );
        }
        const name = m[1].trim();
        const dialogue = m[2].trim();
        const characterId = resolveCharacter(name);
        if (!characterId) {
            throw new Error(
                `[story-compiler] ${sourcePath}: unknown character "${name}"`
            );
        }
        entries.push({ characterId, dialogue });
    }

    return { title, entries };
}
