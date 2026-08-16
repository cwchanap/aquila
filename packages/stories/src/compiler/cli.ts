import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileStory } from './compile';
import { loadStoryCompilerConfig, STORIES_RAW_ROOT } from './config';
import type { StoryIR } from './ir';
import { loadAudioPlan } from '../audio-plan-loader';
import { buildAudioUsageReport, collectAudioUsage } from './audio-usage';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/compiler
const srcDir = resolve(here, '..'); // .../src

async function compileNamedStory(
    name: string,
    writeOutputs: boolean
): Promise<StoryIR> {
    const rawDir = join(STORIES_RAW_ROOT, name);
    if (!existsSync(join(rawDir, 'compiler.config.ts'))) {
        throw new Error(`[story-compiler] unknown story "${name}"`);
    }
    const config = await loadStoryCompilerConfig(rawDir);
    return compileStory({
        rawDir,
        name,
        outDir: join(srcDir, 'generated', name),
        choicesPath: join(srcDir, 'stories', name, 'choices.zh.ts'),
        config,
        writeOutputs,
    });
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args[0] === '--report') {
        if (args.length !== 2 || !args[1]) {
            throw new Error('[story-compiler] usage: --report <storyName>');
        }
        const name = args[1];
        const rawDir = join(STORIES_RAW_ROOT, name);
        const story = await compileNamedStory(name, false);
        const report = buildAudioUsageReport(
            name,
            collectAudioUsage(story),
            loadAudioPlan(rawDir)
        );
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
    }
    if (args.length > 0) {
        throw new Error(
            `[story-compiler] unknown arguments: ${args.join(' ')}`
        );
    }

    const names = readdirSync(STORIES_RAW_ROOT, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .filter(name =>
            existsSync(join(STORIES_RAW_ROOT, name, 'compiler.config.ts'))
        );

    if (names.length === 0) {
        console.warn('[story-compiler] no stories found under raw/');
        return;
    }

    for (const name of names) {
        const story = await compileNamedStory(name, true);
        console.log(
            `[story-compiler] ${name}: ${story.scenes.length} scenes, ${story.choices.length} choices`
        );
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
