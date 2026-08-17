import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileStory } from './compile';
import { loadStoryCompilerConfig, STORIES_RAW_ROOT } from './config';
import type { StoryIR } from './ir';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/compiler
const srcDir = resolve(here, '..'); // .../src

export async function compileNamedStory(
    storyFolder: string,
    writeOutputs: boolean
): Promise<StoryIR> {
    const rawDir = join(STORIES_RAW_ROOT, storyFolder);
    if (!existsSync(join(rawDir, 'compiler.config.ts'))) {
        throw new Error(`[story-compiler] unknown story "${storyFolder}"`);
    }
    const config = await loadStoryCompilerConfig(rawDir);
    return compileStory({
        rawDir,
        name: storyFolder,
        outDir: join(srcDir, 'generated', storyFolder),
        choicesPath: join(srcDir, 'stories', storyFolder, 'choices.zh.ts'),
        config,
        writeOutputs,
    });
}
