import type { MirrorLocale } from './localize';
import { RESERVED_OBJECT_PROPERTY_NAMES } from './parse-characters';

/** Locales notes can be authored in; zh defines structure, en/ja override text. */
export type NotesLocale = 'zh' | MirrorLocale;

export interface ParsedNoteFact {
    id: string;
    text: string;
    line: number;
}

export interface ParsedNoteCharacter {
    id: string;
    line: number;
    hidden: boolean;
    knownAs?: string;
    knownAsLine?: number;
    name?: string;
    nameLine?: number;
    facts: ParsedNoteFact[];
}

export interface ParsedNotes {
    characters: ParsedNoteCharacter[];
    getById(id: string): ParsedNoteCharacter | undefined;
}

// `met` and `name` are unlock-target kinds, so they cannot also be fact ids.
const RESERVED_NOTE_FACT_IDS = new Set(['met', 'name']);

const CHARACTER_ID_RE = /^[A-Za-z0-9_]+$/;
const FACT_ID_RE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const FACT_LINE_RE = /^-\s+([a-z0-9_]+)\s*:\s*(.+)$/;
const HIDDEN_RE = /^hidden\s*:\s*(.*)$/;
const KNOWN_AS_RE = /^known-as\s*:\s*(.+)$/;
const NAME_RE = /^name\s*:\s*(.+)$/;

function fail(sourcePath: string, line: number, message: string): never {
    throw new Error(`[story-compiler] ${sourcePath}:${line}: ${message}`);
}

/**
 * Parses the tiny per-story notes Markdown:
 *
 *     ## li_jie
 *     hidden: true            (optional, zh only)
 *     known-as: 文靜少女      (optional, requires a .met marker)
 *     name: Li Jie            (optional, en/ja only)
 *     - age: 十七歲
 */
export function parseNotesMarkdown(
    markdown: string,
    sourcePath: string,
    locale: NotesLocale
): ParsedNotes {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const characters: ParsedNoteCharacter[] = [];
    const byId = new Map<string, ParsedNoteCharacter>();
    let current: ParsedNoteCharacter | undefined;
    let currentFacts = new Set<string>();
    let metadata = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
        const lineNo = i + 1;
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('##')) {
            const id = line.slice(2).trim();
            if (!CHARACTER_ID_RE.test(id)) {
                fail(
                    sourcePath,
                    lineNo,
                    `invalid character id "${id}"; use snake_case ids from docs/characters.md`
                );
            }
            if (byId.has(id)) {
                fail(sourcePath, lineNo, `duplicate character section "${id}"`);
            }
            current = { id, line: lineNo, hidden: false, facts: [] };
            currentFacts = new Set();
            metadata = new Set();
            characters.push(current);
            byId.set(id, current);
            continue;
        }

        if (!current) {
            fail(
                sourcePath,
                lineNo,
                'content before the first "## character_id" section'
            );
        }

        const hidden = HIDDEN_RE.exec(line);
        if (hidden) {
            if (metadata.has('hidden')) {
                fail(sourcePath, lineNo, 'duplicate hidden field');
            }
            if (locale !== 'zh') {
                fail(
                    sourcePath,
                    lineNo,
                    'only zh notes can set "hidden"; move structure to notes/zh.md'
                );
            }
            if (hidden[1].trim() !== 'true') {
                fail(sourcePath, lineNo, 'hidden must be exactly "true"');
            }
            metadata.add('hidden');
            current.hidden = true;
            continue;
        }

        const knownAs = KNOWN_AS_RE.exec(line);
        if (knownAs) {
            if (metadata.has('known-as')) {
                fail(sourcePath, lineNo, 'duplicate known-as field');
            }
            metadata.add('known-as');
            current.knownAs = knownAs[1].trim();
            current.knownAsLine = lineNo;
            continue;
        }

        const name = NAME_RE.exec(line);
        if (name) {
            if (locale === 'zh') {
                fail(
                    sourcePath,
                    lineNo,
                    'zh notes take canonical names from docs/characters.md; remove "name:"'
                );
            }
            if (metadata.has('name')) {
                fail(sourcePath, lineNo, 'duplicate name field');
            }
            metadata.add('name');
            current.name = name[1].trim();
            current.nameLine = lineNo;
            continue;
        }

        if (line.startsWith('-')) {
            const fact = FACT_LINE_RE.exec(line);
            if (!fact) {
                fail(
                    sourcePath,
                    lineNo,
                    `malformed fact line "${line}"; expected "- <fact_id>: <text>"`
                );
            }
            const id = fact[1];
            if (!FACT_ID_RE.test(id)) {
                fail(
                    sourcePath,
                    lineNo,
                    `invalid fact id "${id}"; use lowercase snake_case`
                );
            }
            if (
                RESERVED_OBJECT_PROPERTY_NAMES.has(id) ||
                RESERVED_NOTE_FACT_IDS.has(id)
            ) {
                fail(
                    sourcePath,
                    lineNo,
                    `fact id "${id}" is reserved and cannot be used as a plain-record key`
                );
            }
            if (currentFacts.has(id)) {
                fail(
                    sourcePath,
                    lineNo,
                    `duplicate fact "${id}" for character "${current.id}"`
                );
            }
            const text = fact[2].trim();
            if (!text) {
                fail(sourcePath, lineNo, `fact "${id}" has no text`);
            }
            currentFacts.add(id);
            current.facts.push({ id, text, line: lineNo });
            continue;
        }

        fail(sourcePath, lineNo, `unrecognized notes line "${line}"`);
    }

    return { characters, getById: id => byId.get(id) };
}
