import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { AudioPlanV1 } from '@aquila/stories';
import { prepareAudioSources } from '../audio-source';

const storiesRawRoot = fileURLToPath(
    new URL('../../../../stories/raw/', import.meta.url)
);
const STORY_ID = 'fixture_story';
const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { recursive: true, force: true }))
    );
});

type Fixture = { storyFolder: string; mediaRoot: string };

/** A raw story that cues door-open (sfx), constructor (sfx, a name that
 *  collides with an inherited property) and night-loop (bgm), plus two plan
 *  rows the story never uses. The media root is a temp folder. */
async function makeFixture(): Promise<Fixture> {
    const rawDir = await mkdtemp(join(storiesRawRoot, 'audio-source-'));
    const mediaRoot = await mkdtemp(join(tmpdir(), 'aquila-audio-media-'));
    roots.push(rawDir, mediaRoot);
    const plan: AudioPlanV1 = {
        schemaVersion: 1,
        assets: [
            {
                key: 'door-open',
                type: 'sfx',
                prompt: 'Heavy apartment door opening',
                durationMs: 2200,
            },
            {
                key: 'constructor',
                type: 'sfx',
                prompt: 'A used cue whose name collides with an inherited property',
                durationMs: 900,
            },
            {
                key: 'night-loop',
                type: 'bgm',
                prompt: 'Quiet night underscore',
                durationMs: 90_000,
                loop: true,
            },
            {
                key: 'plan-unused',
                type: 'sfx',
                prompt: 'A plan row not used by the story',
                durationMs: 900,
            },
            {
                key: 'also-unused',
                type: 'sfx',
                prompt: 'Another plan row not used by the story',
                durationMs: 900,
            },
        ],
    };
    await mkdir(join(rawDir, 'docs'), { recursive: true });
    await writeFile(
        join(rawDir, 'compiler.config.ts'),
        `export default { storyId: '${STORY_ID}', defaultSpeakerId: 'narrator' };\n`
    );
    await writeFile(
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
    await writeFile(
        join(rawDir, 'docs', 'audio-plan.json'),
        JSON.stringify(plan)
    );
    await writeFile(
        join(rawDir, 'act1.md'),
        [
            '# 第一幕：Fixture',
            '',
            '```bgm',
            'night-loop',
            '```',
            '',
            '**旁白**：Night.',
            '',
            '```sfx',
            'door-open',
            '```',
            '',
            '**旁白**：Door.',
            '',
            '```sfx',
            'constructor',
            '```',
            '',
            '**旁白**：More.',
        ].join('\n')
    );
    return { storyFolder: basename(rawDir), mediaRoot };
}

async function commit(
    fixture: Fixture,
    type: 'sfx' | 'bgm',
    key: string,
    bytes: Uint8Array
): Promise<void> {
    const dir = join(fixture.mediaRoot, STORY_ID, type);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${key}.mp3`), bytes);
}

function input(fixture: Fixture) {
    return {
        storyFolder: fixture.storyFolder,
        expectedStoryId: STORY_ID,
        mediaRoot: fixture.mediaRoot,
    } as const;
}

describe('prepareAudioSources', () => {
    it('reads each used cue (bgm before sfx, by qualified id) from its committed file', async () => {
        const fixture = await makeFixture();
        await commit(fixture, 'sfx', 'door-open', Uint8Array.from([1, 2, 3]));
        await commit(fixture, 'bgm', 'night-loop', Uint8Array.from([4, 5]));

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.storyId).toBe(STORY_ID);
        expect(plan.sources).toEqual([
            {
                type: 'bgm',
                key: 'night-loop',
                plannedDurationMs: 90_000,
                loop: true,
                sourceBytes: Uint8Array.from([4, 5]),
                sourceFilename: 'night-loop.mp3',
            },
            {
                type: 'sfx',
                key: 'door-open',
                plannedDurationMs: 2200,
                loop: false,
                sourceBytes: Uint8Array.from([1, 2, 3]),
                sourceFilename: 'door-open.mp3',
            },
        ]);
        expect(plan.coverage).toContainEqual({
            type: 'sfx',
            key: 'door-open',
            usageCount: 1,
            disposition: 'included',
        });
    });

    it('leaves a cue without a file out of the release with a warning, not an error', async () => {
        const fixture = await makeFixture();
        await commit(fixture, 'sfx', 'door-open', Uint8Array.from([1, 2, 3]));

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.sources.map(source => source.key)).toEqual(['door-open']);
        expect(plan.coverage).toContainEqual({
            type: 'bgm',
            key: 'night-loop',
            usageCount: 1,
            disposition: 'omitted',
            reason: 'no sound file committed yet',
        });
        expect(plan.diagnostics).toContainEqual({
            code: 'audio/missing-sound',
            stage: 'coverage',
            message: 'Audio cues used by the story have no sound file yet',
            count: 2,
            sampleIdentities: ['bgm:night-loop', 'sfx:constructor'],
        });
    });

    it('publishes an empty release when no sound is committed at all', async () => {
        const fixture = await makeFixture();

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.sources).toEqual([]);
        expect(
            plan.coverage.every(entry => entry.disposition === 'omitted')
        ).toBe(true);
    });

    it('reports plan rows the story does not use', async () => {
        const fixture = await makeFixture();

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.diagnostics).toContainEqual({
            code: 'audio/plan-unused',
            stage: 'coverage',
            message: 'Audio plan contains cues not used by the story',
            count: 2,
            sampleIdentities: ['sfx:also-unused', 'sfx:plan-unused'],
        });
    });

    it('does not read a file for a key only the plan has', async () => {
        const fixture = await makeFixture();
        await commit(fixture, 'sfx', 'plan-unused', Uint8Array.from([9]));

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.sources).toEqual([]);
    });

    it('finds a file named after an inherited property key', async () => {
        const fixture = await makeFixture();
        await commit(fixture, 'sfx', 'constructor', Uint8Array.from([7]));

        const plan = await prepareAudioSources(input(fixture));

        expect(plan.sources.map(source => source.key)).toEqual(['constructor']);
    });

    it('fails when a sound path cannot be read as a file', async () => {
        const fixture = await makeFixture();
        await mkdir(join(fixture.mediaRoot, STORY_ID, 'sfx', 'door-open.mp3'), {
            recursive: true,
        });

        await expect(prepareAudioSources(input(fixture))).rejects.toMatchObject(
            { name: 'PublisherError', code: 'source' }
        );
    });

    it('rejects an unsafe story folder and a story id mismatch', async () => {
        const fixture = await makeFixture();

        await expect(
            prepareAudioSources({ ...input(fixture), storyFolder: '../escape' })
        ).rejects.toMatchObject({ code: 'input' });
        await expect(
            prepareAudioSources({
                ...input(fixture),
                expectedStoryId: 'other_story',
            })
        ).rejects.toMatchObject({ code: 'input' });
    });
});
