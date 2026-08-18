import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadAudioPublishingContext } from '../../audio-publishing';

const fixtureRoots: string[] = [];

afterEach(() => {
    for (const root of fixtureRoots.splice(0)) {
        rmSync(root, { recursive: true, force: true });
    }
});

function makeFixture(): { rawRoot: string; storyFolder: string } {
    const rawRoot = mkdtempSync(join(tmpdir(), 'aquila-audio-publishing-'));
    fixtureRoots.push(rawRoot);
    const rawDir = join(rawRoot, 'fixture_story');
    mkdirSync(join(rawDir, 'docs'), { recursive: true });
    writeFileSync(
        join(rawDir, 'compiler.config.ts'),
        "export default { storyId: 'fixture_story', defaultSpeakerId: 'narrator' };\n"
    );
    writeFileSync(
        join(rawDir, 'docs', 'characters.md'),
        [
            '## 1. 旁白（Narrator）',
            '',
            '- **ID**: `narrator`',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: fixture narrator',
        ].join('\n')
    );
    writeFileSync(
        join(rawDir, 'docs', 'audio-plan.json'),
        JSON.stringify({
            schemaVersion: 1,
            assets: [
                {
                    key: 'door-open',
                    type: 'sfx',
                    prompt: 'Heavy apartment door opening',
                    durationMs: 2200,
                },
            ],
        })
    );
    writeFileSync(
        join(rawDir, 'act1.md'),
        [
            '# 第一幕：Fixture',
            '',
            '```sfx',
            'door-open',
            '```',
            '',
            '**旁白**：Door.',
        ].join('\n')
    );
    return { rawRoot, storyFolder: 'fixture_story' };
}

describe('loadAudioPublishingContext', () => {
    it('returns the runtime story id and compiler-derived audio usage', async () => {
        const { rawRoot, storyFolder } = makeFixture();

        const context = await loadAudioPublishingContext(storyFolder, rawRoot);

        expect(context.storyFolder).toBe(storyFolder);
        expect(context.storyId).toBe('fixture_story');
        expect(context.plan.assets).toHaveLength(1);
        expect(context.usage.assets).toEqual([
            expect.objectContaining({
                type: 'sfx',
                key: 'door-open',
                usageCount: 1,
            }),
        ]);
    });
});
