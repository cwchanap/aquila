import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileStory } from './compile';
import type { StoryCompilerConfig } from './config';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/compiler
const srcDir = resolve(here, '..'); // .../src
const pkgDir = resolve(srcDir, '..'); // .../stories
const rawRoot = join(pkgDir, 'raw');

async function main(): Promise<void> {
    const names = readdirSync(rawRoot, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .filter(name => existsSync(join(rawRoot, name, 'compiler.config.ts')));

    if (names.length === 0) {
        console.warn('[story-compiler] no stories found under raw/');
        return;
    }

    for (const name of names) {
        const configMod = await import(
            join(rawRoot, name, 'compiler.config.ts')
        );
        const config: StoryCompilerConfig = configMod.default;
        const story = compileStory({
            rawDir: join(rawRoot, name),
            name,
            outDir: join(srcDir, 'stories', name, 'generated'),
            choicesPath: join(srcDir, 'stories', name, 'choices.zh.ts'),
            config,
        });
        console.log(
            `[story-compiler] ${name}: ${story.scenes.length} scenes, ${story.choices.length} choices`
        );
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
