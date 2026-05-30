import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { scanStory } from '../scan-story';
import { buildStoryGraph } from '../build-graph';
import { validateStory } from '../validate';
import { parseScene } from '../parse-scene';
import config from '../../../raw/trainAdventure/compiler.config';

const rawDir = resolve(__dirname, '../../../raw/trainAdventure');

// Compiles the REAL trainAdventure markdown in-memory (no file emit) using the
// story's own resolver/defaultSpeaker, so a regression in scanning, graph
// building, character resolution, or validation fails fast here.
describe('trainAdventure golden compile', () => {
    const graph = buildStoryGraph(scanStory(rawDir));

    it('starts at act1 and produces the full scene set', () => {
        expect(graph.start).toBe('act1');
        expect(graph.scenes.length).toBeGreaterThan(400);
    });

    it('has the first choice after act3 leading to branch 1a/1b', () => {
        const act3 = graph.scenes.find(s => s.id === 'act3')!;
        expect(act3.next).toBe('choice:choice_act3');
        const c = graph.choices.find(x => x.choiceId === 'choice_act3')!;
        expect(c.options.map(o => o.optionId).sort()).toEqual(['b1a', 'b1b']);
        expect(c.options.map(o => o.nextScene).sort()).toEqual([
            'b1a_act4',
            'b1b_act4',
        ]);
    });

    it('parses and validates the entire story (all characters resolve)', () => {
        const scenes = graph.scenes.map(s => {
            const md = readFileSync(join(rawDir, s.sourcePath), 'utf8');
            const { title, entries } = parseScene(
                md,
                config.resolveCharacter,
                s.sourcePath,
                config.defaultSpeaker
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
                name: 'trainAdventure',
                start: graph.start,
                scenes,
                choices: graph.choices,
            })
        ).not.toThrow();
    });
});
