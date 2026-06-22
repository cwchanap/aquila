import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { scanStory } from '../scan-story';
import { buildStoryGraph } from '../build-graph';
import { validateStory } from '../validate';
import { parseScene } from '../parse-scene';
import { parseCharacters } from '../parse-characters';
import { buildResolveCharacter } from '../resolve-character';
import config from '../../../raw/dontSaveMeBeforeMidnight/compiler.config';

const rawDir = resolve(__dirname, '../../../raw/dontSaveMeBeforeMidnight');

const charDir = parseCharacters(
    readFileSync(join(rawDir, 'docs/characters.md'), 'utf8')
);
const resolveCharacter = buildResolveCharacter(charDir, config);
const defaultSpeaker = (() => {
    if (!config.defaultSpeakerId) return undefined;
    const info = charDir.getById(config.defaultSpeakerId);
    if (!info) {
        throw new Error(
            `[story-compiler] config.defaultSpeakerId "${config.defaultSpeakerId}" is not present in the parsed character directory`
        );
    }
    return { id: config.defaultSpeakerId, displayName: info.name };
})();

// Compiles the REAL dontSaveMeBeforeMidnight markdown in-memory (no file emit)
// so regressions in scanning, graph building, character resolution, or
// validation fail fast.
describe('dontSaveMeBeforeMidnight golden compile', () => {
    const graph = buildStoryGraph(scanStory(rawDir));

    it('starts at ch1_act1 and produces all scenes across chapters 1-8', () => {
        expect(graph.start).toBe('ch1_act1');
        expect(graph.scenes.length).toBe(129);
        const expectedScenes = [
            ...Array.from({ length: 11 }, (_, i) => `ch1_act${i + 1}`),
            ...Array.from({ length: 12 }, (_, i) => `ch2_act${i + 1}`),
            ...Array.from({ length: 17 }, (_, i) => `ch3_act${i + 1}`),
            ...Array.from({ length: 19 }, (_, i) => `ch4_act${i + 1}`),
            ...Array.from({ length: 15 }, (_, i) => `ch5_act${i + 1}`),
            ...Array.from({ length: 16 }, (_, i) => `ch6_act${i + 1}`),
            ...Array.from({ length: 19 }, (_, i) => `ch7_act${i + 1}`),
            ...Array.from({ length: 19 }, (_, i) => `ch8_act${i + 1}`),
            'ch8_actEpilogue',
        ];
        expect(graph.scenes.map(s => s.id)).toEqual(expectedScenes);
    });

    it('has no choices (linear story)', () => {
        expect(graph.choices).toHaveLength(0);
    });

    it('chains all scenes linearly ending at ch8_actEpilogue with null next', () => {
        const last = graph.scenes[graph.scenes.length - 1];
        expect(last.id).toBe('ch8_actEpilogue');
        expect(last.next).toBeNull();
        for (let i = 0; i < graph.scenes.length - 1; i++) {
            expect(graph.scenes[i].next).toBe(graph.scenes[i + 1].id);
        }
    });

    it('parses and validates the entire story (all characters resolve)', () => {
        const scenes = graph.scenes.map(s => {
            const md = readFileSync(join(rawDir, s.sourcePath), 'utf8');
            const { title, entries } = parseScene(
                md,
                resolveCharacter,
                s.sourcePath,
                defaultSpeaker
            );
            return {
                id: s.id,
                title,
                entries,
                next: s.next,
                sourcePath: s.sourcePath,
            };
        });
        const portraitMap = Object.fromEntries(
            charDir.characters.map(c => [c.id, c.portraits])
        );
        const warnings = validateStory(
            {
                storyId: config.storyId,
                name: 'dontSaveMeBeforeMidnight',
                start: graph.start,
                scenes,
                choices: graph.choices,
            },
            portraitMap
        );
        // Every [expression] used in the raw markdown must resolve to a
        // prompt defined in that character's Portrait Prompts section. When
        // a key is missing the compiler silently falls back to base and
        // renders the wrong portrait (e.g. a warm smile during a shock
        // reveal). Catch that regression class here.
        // ("no portrait prompts" / "missing required base" are intentionally
        // excluded — they legitimately fire for background speaker IDs like
        // narrator/message/crowd that have no portrait entry by design.)
        const expressionWarnings = warnings.filter(w =>
            /unknown expression/.test(w)
        );
        expect(expressionWarnings).toEqual([]);
    });
});
