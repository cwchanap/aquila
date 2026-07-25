import type { PortraitSlot } from '../types';

export interface ParsedCharacter {
    id: string;
    name: string;
    aliases: string[];
    portraits: Record<string, string>;
    portraitSlot?: PortraitSlot;
}

// Character IDs become object-literal keys in the generated `characterTable`
// and `slotsByCharacterId` (both `Record<string, ...>` keyed by raw ID). A
// lookup like `characterTable[id]` or `slotsByCharacterId[id]` on a normal
// object returns the inherited Object.prototype value for names like
// `constructor`, `toString`, or `__proto__` when no own property is emitted
// (e.g. a character with no `portraitSlot`). That breaks the `T | undefined`
// contract — the lookup returns a truthy non-T value (the `Object` function,
// `Object.prototype`, etc.) instead of `undefined`, so `?? defaultSlot` and
// `if (entry)` guards misbehave. The emitter uses computed keys for explicit
// assignments, but that only fixes the present-key case; absent-key lookups
// still hit the prototype. Rejecting these IDs at parse time catches the
// whole class at the source. Built dynamically so any inherited name on
// Object.prototype is covered regardless of engine.
//
// Exported because emit.ts re-checks at emit time as defense-in-depth (direct
// callers like tests can bypass parse-characters); both sites must agree on
// the same set, so it is defined once here and imported there.
export const RESERVED_OBJECT_PROPERTY_NAMES = new Set<string>(
    Object.getOwnPropertyNames(Object.prototype)
);

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
const PORTRAIT_SLOT_RE = /^-\s+\*\*Portrait Slot\*\*:\s*(.*)$/;
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

function parsePortraitSlot(line: string): PortraitSlot | null | undefined {
    const match = line.match(PORTRAIT_SLOT_RE);
    if (!match) return undefined;
    // Any content after the label counts as an attempted slot assignment, so an
    // empty or multi-token value is a hard error rather than a silently ignored
    // line that would fall back to the default slot.
    const value = match[1].trim().toLowerCase();
    if (value === 'left' || value === 'center' || value === 'right') {
        return value;
    }
    return null;
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
    let currentPortraitSlot: PortraitSlot | undefined;
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
            if (RESERVED_OBJECT_PROPERTY_NAMES.has(currentId)) {
                throw new Error(
                    `[story-compiler] character ID "${currentId}" is reserved (inherited from Object.prototype); using it as an object key breaks lookup contracts in the generated characterTable and slotsByCharacterId`
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
                portraitSlot: currentPortraitSlot,
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
        currentPortraitSlot = undefined;
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

        const portraitSlotMatch = parsePortraitSlot(line);
        if (portraitSlotMatch === null) {
            throw new Error(
                `[story-compiler] character "${currentName}" has invalid Portrait Slot; expected left, center, or right`
            );
        }
        if (portraitSlotMatch !== undefined) {
            currentPortraitSlot = portraitSlotMatch;
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
