import type { CharacterId } from '../characters';
import type { ResolvedCharacter } from './config';

export type PortraitPromptMap = Partial<
    Record<CharacterId, Record<string, string>>
>;

const HEADING_RE = /^##\s+\d+\.\s+(.+?)（.*?）\s*$/;
const PROMPT_SECTION_RE = /^###\s+Portrait Prompts\s*$/;
const PROMPT_ITEM_RE = /^-\s+\*\*(.+?)\*\*:\s*(.+)$/;

export function parsePortraits(
    markdown: string,
    resolveCharacter: (name: string) => ResolvedCharacter | undefined
): PortraitPromptMap {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const result: PortraitPromptMap = {};

    let currentCharId: CharacterId | undefined;
    let inPortraitSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const headingMatch = line.match(HEADING_RE);
        if (headingMatch) {
            const name = headingMatch[1].trim();
            const resolved = resolveCharacter(name);
            currentCharId = resolved?.id;
            inPortraitSection = false;
            continue;
        }

        if (PROMPT_SECTION_RE.test(line)) {
            inPortraitSection = true;
            continue;
        }

        if (/^###\s/.test(line)) {
            inPortraitSection = false;
            continue;
        }

        if (inPortraitSection && currentCharId) {
            const itemMatch = line.match(PROMPT_ITEM_RE);
            if (itemMatch) {
                const key = itemMatch[1].trim().toLowerCase();
                let prompt = itemMatch[2].trim();
                while (i + 1 < lines.length && lines[i + 1].startsWith('  ')) {
                    i++;
                    prompt += ' ' + lines[i].trim();
                }
                if (!result[currentCharId]) {
                    result[currentCharId] = {};
                }
                result[currentCharId]![key] = prompt;
            }
        }
    }

    return result;
}
