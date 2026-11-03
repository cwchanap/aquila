import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { compileNamedStory } from './compile-named-story';
import { STORIES_RAW_ROOT } from './config';
import { loadAudioPlan } from '../audio-plan-loader';
import { buildAudioUsageReport, collectAudioUsage } from './audio-usage';

async function main(): Promise<void> {
    // --quiet (used by `bun install`, web dev/build and the voice/publisher
    // scripts) hides per-story logs and warnings and keeps stdout clean; errors
    // still print.
    const quiet = process.argv.includes('--quiet');
    const args = process.argv.slice(2).filter(arg => arg !== '--quiet');
    if (quiet) {
        console.log = () => {};
        console.warn = () => {};
    }
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

    let sceneCount = 0;
    for (const name of names) {
        const story = await compileNamedStory(name, true);
        sceneCount += story.scenes.length;
        console.log(
            `[story-compiler] ${name}: ${story.scenes.length} scenes, ${story.choices.length} choices`
        );
    }
    if (quiet) {
        process.stderr.write(
            `[story-compiler] compiled ${names.length} stories (${sceneCount} scenes)\n`
        );
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
