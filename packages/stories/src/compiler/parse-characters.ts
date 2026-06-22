export interface ParsedCharacter {
    id: string;
    name: string;
    aliases: string[];
    portraits: Record<string, string>;
}

export interface ParsedCharacterDirectory {
    characters: ParsedCharacter[];
    getIdByName(name: string): string | undefined;
    getById(id: string): ParsedCharacter | undefined;
}

interface HeadingMatch {
    name: string;
}

const HEADING_RE = /^##\s+\d+(?:\.\d+)?\.\s+(.+?)（.*?）\s*$/;
const ID_RE = /^-\s+\*\*ID\*\*:\s*`([^`]+)`\s*$/;
const ALIASES_RE = /^-\s+\*\*Aliases\*\*:\s*(.+)$/;
const PROMPT_SECTION_RE = /^###\s+Portrait Prompts\s*$/;
const PROMPT_ITEM_RE = /^-\s+\*\*(.+?)\*\*:\s*(.+)$/;

function parseHeading(line: string): HeadingMatch | null {
    const m = line.match(HEADING_RE);
    if (!m) return null;
    return { name: m[1].trim() };
}

function parseId(line: string): string | null {
    const m = line.match(ID_RE);
    return m ? m[1].trim() : null;
}

function parseAliases(line: string): string[] | null {
    const m = line.match(ALIASES_RE);
    if (!m) return null;
    return m[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

export function parseCharacters(markdown: string): ParsedCharacterDirectory {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    const characters: ParsedCharacter[] = [];
    const byId = new Map<string, ParsedCharacter>();
    const nameToId = new Map<string, string>();

    let currentName: string | null = null;
    let currentId: string | null = null;
    let currentAliases: string[] = [];
    let currentPortraits: Record<string, string> = {};
    let inPortraitSection = false;

    function flushCharacter(): void {
        if (currentName !== null) {
            if (currentId === null) {
                throw new Error(
                    `[story-compiler] character "${currentName}" is missing **ID** metadata`
                );
            }
            if (byId.has(currentId)) {
                throw new Error(
                    `[story-compiler] duplicate character ID "${currentId}"`
                );
            }
            if (nameToId.has(currentName)) {
                throw new Error(
                    `[story-compiler] duplicate character name "${currentName}"`
                );
            }
            const char: ParsedCharacter = {
                id: currentId,
                name: currentName,
                aliases: currentAliases,
                portraits: currentPortraits,
            };
            characters.push(char);
            byId.set(char.id, char);
            nameToId.set(char.name, char.id);
            for (const a of char.aliases) {
                if (nameToId.has(a)) {
                    throw new Error(
                        `[story-compiler] duplicate alias "${a}" (conflicts with another character)`
                    );
                }
                nameToId.set(a, char.id);
            }
        }
    }

    function resetState(): void {
        currentName = null;
        currentId = null;
        currentAliases = [];
        currentPortraits = {};
        inPortraitSection = false;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/^##\s/.test(line)) {
            const heading = parseHeading(line);
            if (heading) {
                flushCharacter();
                resetState();
                currentName = heading.name;
            } else {
                flushCharacter();
                resetState();
            }
            continue;
        }

        if (currentName === null) continue;

        const idMatch = parseId(line);
        if (idMatch) {
            currentId = idMatch;
            continue;
        }

        const aliasesMatch = parseAliases(line);
        if (aliasesMatch) {
            currentAliases = aliasesMatch;
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

        if (inPortraitSection) {
            const itemMatch = line.match(PROMPT_ITEM_RE);
            if (itemMatch) {
                const key = itemMatch[1].trim().toLowerCase();
                let prompt = itemMatch[2].trim();
                while (i + 1 < lines.length && lines[i + 1].startsWith('  ')) {
                    i++;
                    prompt += ' ' + lines[i].trim();
                }
                currentPortraits[key] = prompt;
            }
        }
    }

    flushCharacter();

    return {
        characters,
        getById: (id: string) => byId.get(id),
        getIdByName: (name: string) => nameToId.get(name),
    };
}
