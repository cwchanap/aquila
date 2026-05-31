import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { StoryCompilerConfig } from './config';
import type { StoryIR } from './ir';
import { scanStory } from './scan-story';
import { buildStoryGraph } from './build-graph';
import { parseScene } from './parse-scene';
import { validateStory } from './validate';
import { emitStory } from './emit';

export interface CompileOptions {
    rawDir: string; // packages/stories/raw/<name>
    name: string; // 'trainAdventure'
    outDir: string; // packages/stories/src/generated/<name>
    choicesPath: string; // packages/stories/src/stories/<name>/choices.zh.ts
    config: StoryCompilerConfig;
}

export function compileStory(opts: CompileOptions): StoryIR {
    const graph = buildStoryGraph(scanStory(opts.rawDir));
    const scenes = graph.scenes.map(s => {
        const md = readFileSync(join(opts.rawDir, s.sourcePath), 'utf8');
        const parsed = parseScene(
            md,
            opts.config.resolveCharacter,
            s.sourcePath,
            opts.config.defaultSpeaker
        );
        return {
            id: s.id,
            title: parsed.title,
            entries: parsed.entries,
            next: s.next,
            sourcePath: s.sourcePath,
        };
    });
    const story: StoryIR = {
        storyId: opts.config.storyId,
        name: opts.name,
        start: graph.start,
        scenes,
        choices: graph.choices,
    };
    validateStory(story);
    emitStory(story, opts.outDir);
    scaffoldChoices(story, opts.choicesPath);
    return story;
}

/** Create choices.zh.ts on first run; otherwise warn about drift, never overwrite. */
function scaffoldChoices(story: StoryIR, choicesPath: string): void {
    if (!existsSync(choicesPath)) {
        const entries = story.choices
            .map(c => {
                const labels = c.options
                    .map(o => `      ${JSON.stringify(o.optionId)}: '',`)
                    .join('\n');
                return `  ${JSON.stringify(c.choiceId)}: {\n    prompt: '',\n    labels: {\n${labels}\n    },\n  },`;
            })
            .join('\n');
        mkdirSync(dirname(choicesPath), { recursive: true });
        writeFileSync(
            choicesPath,
            `import type { ChoiceText } from '../choice-utils';\n\n` +
                `// Hand-maintained choice text (prompt + labels). Fill in the blanks.\n` +
                `export const ${story.name}ChoiceText: ChoiceText = {\n${entries}\n};\n`
        );
        console.log(
            `[story-compiler] scaffolded ${choicesPath} (fill in prompts/labels)`
        );
        return;
    }
    console.log(
        `[story-compiler] ${choicesPath} exists; left untouched. ` +
            `Required choiceIds: ${story.choices.map(c => c.choiceId).join(', ') || '(none)'}`
    );
}
