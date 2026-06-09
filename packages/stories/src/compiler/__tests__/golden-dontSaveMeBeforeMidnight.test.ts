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

    it('starts at ch1_act1 and produces all scenes across chapters 1 and 2', () => {
        expect(graph.start).toBe('ch1_act1');
        expect(graph.scenes.length).toBe(23);
        expect(graph.scenes.map(s => s.id)).toEqual([
            'ch1_act1',
            'ch1_act2',
            'ch1_act3',
            'ch1_act4',
            'ch1_act5',
            'ch1_act6',
            'ch1_act7',
            'ch1_act8',
            'ch1_act9',
            'ch1_act10',
            'ch1_act11',
            'ch2_act1',
            'ch2_act2',
            'ch2_act3',
            'ch2_act4',
            'ch2_act5',
            'ch2_act6',
            'ch2_act7',
            'ch2_act8',
            'ch2_act9',
            'ch2_act10',
            'ch2_act11',
            'ch2_act12',
        ]);
    });

    it('has no choices (linear story)', () => {
        expect(graph.choices).toHaveLength(0);
    });

    it('chains all scenes linearly ending at ch2_act12 with null next', () => {
        const last = graph.scenes[graph.scenes.length - 1];
        expect(last.id).toBe('ch2_act12');
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
        expect(() =>
            validateStory({
                storyId: config.storyId,
                name: 'dontSaveMeBeforeMidnight',
                start: graph.start,
                scenes,
                choices: graph.choices,
            })
        ).not.toThrow();
    });
});
