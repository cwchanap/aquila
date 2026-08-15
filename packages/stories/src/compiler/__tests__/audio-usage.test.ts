import { describe, expect, it } from 'vitest';
import type { AudioPlanV1 } from '../../audio-plan';
import type { StoryIR } from '../ir';
import { collectAudioUsage, validateAudioUsage } from '../audio-usage';

const story: StoryIR = {
    storyId: 'fixture_story',
    name: 'fixtureStory',
    start: 'act1',
    choices: [],
    assetManifest: { storyId: 'fixture_story', backgrounds: [], portraits: [] },
    scenes: [
        {
            id: 'act1',
            title: 'Act 1',
            sourcePath: 'act1.md',
            next: 'act2',
            entries: [
                {
                    characterId: 'narrator',
                    displayName: '旁白',
                    dialogue: 'Door',
                    sfx: 'door-open',
                },
                {
                    characterId: 'narrator',
                    displayName: '旁白',
                    dialogue: 'Dawn',
                    bgm: 'dawn-apartment',
                },
            ],
        },
        {
            id: 'act2',
            title: 'Act 2',
            sourcePath: 'act2.md',
            next: null,
            entries: [
                {
                    characterId: 'narrator',
                    displayName: '旁白',
                    dialogue: 'Door again',
                    sfx: 'door-open',
                },
                {
                    characterId: 'narrator',
                    displayName: '旁白',
                    dialogue: 'Quiet',
                    bgm: null,
                },
            ],
        },
    ],
};

const plan: AudioPlanV1 = {
    schemaVersion: 1,
    assets: [
        { key: 'door-open', type: 'sfx', prompt: 'Door', durationMs: 2200 },
        {
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Dawn',
            durationMs: 90000,
            loop: true,
        },
    ],
};

describe('collectAudioUsage', () => {
    it('collects keyed cues in story order plus BGM stops', () => {
        const usage = collectAudioUsage(story);
        expect(usage.cues).toEqual([
            {
                sceneId: 'act1',
                sourcePath: 'act1.md',
                entryIndex: 0,
                type: 'sfx',
                key: 'door-open',
            },
            {
                sceneId: 'act1',
                sourcePath: 'act1.md',
                entryIndex: 1,
                type: 'bgm',
                key: 'dawn-apartment',
            },
            {
                sceneId: 'act2',
                sourcePath: 'act2.md',
                entryIndex: 0,
                type: 'sfx',
                key: 'door-open',
            },
        ]);
        expect(usage.bgmStops).toEqual([
            { sceneId: 'act2', sourcePath: 'act2.md', entryIndex: 1 },
        ]);
    });
});

describe('validateAudioUsage', () => {
    it('returns no warnings with no plan and no audio', () => {
        expect(
            validateAudioUsage(
                collectAudioUsage({ ...story, scenes: [] }),
                undefined,
                'docs/audio-plan.json'
            )
        ).toEqual([]);
    });

    it('throws on keyed audio when no plan exists', () => {
        expect(() =>
            validateAudioUsage(
                collectAudioUsage(story),
                undefined,
                'docs/audio-plan.json'
            )
        ).toThrow(
            '[story-compiler] act1.md#0: audio cue "door-open" requires docs/audio-plan.json'
        );
    });

    it('throws on an unknown audio cue key', () => {
        const bad = {
            ...story,
            scenes: [
                {
                    ...story.scenes[0],
                    entries: [
                        { ...story.scenes[0].entries[0], sfx: 'unknown-door' },
                        story.scenes[0].entries[1],
                    ],
                },
                story.scenes[1],
            ],
        };
        expect(() =>
            validateAudioUsage(
                collectAudioUsage(bad),
                plan,
                'docs/audio-plan.json'
            )
        ).toThrow(
            '[story-compiler] act1.md#0: unknown audio cue "unknown-door"'
        );
    });

    it('throws when a cue authored as SFX is planned as BGM', () => {
        const bad = {
            ...story,
            scenes: [
                {
                    ...story.scenes[0],
                    entries: [
                        {
                            ...story.scenes[0].entries[0],
                            sfx: 'dawn-apartment',
                        },
                        story.scenes[0].entries[1],
                    ],
                },
                story.scenes[1],
            ],
        };
        expect(() =>
            validateAudioUsage(
                collectAudioUsage(bad),
                plan,
                'docs/audio-plan.json'
            )
        ).toThrow(
            '[story-compiler] act1.md#0: audio cue "dawn-apartment" type mismatch; authored as sfx, planned as bgm'
        );
    });

    it('throws when a cue authored as BGM is planned as SFX', () => {
        const bad = {
            ...story,
            scenes: [
                {
                    ...story.scenes[0],
                    entries: [
                        story.scenes[0].entries[0],
                        { ...story.scenes[0].entries[1], bgm: 'door-open' },
                    ],
                },
                story.scenes[1],
            ],
        };
        expect(() =>
            validateAudioUsage(
                collectAudioUsage(bad),
                plan,
                'docs/audio-plan.json'
            )
        ).toThrow(
            '[story-compiler] act1.md#1: audio cue "door-open" type mismatch; authored as bgm, planned as sfx'
        );
    });

    it('treats an explicit BGM stop as a stop, not a cue', () => {
        const usage = collectAudioUsage({
            ...story,
            scenes: [
                {
                    id: 'act2',
                    title: 'Act 2',
                    sourcePath: 'act2.md',
                    next: null,
                    entries: [
                        {
                            characterId: 'narrator',
                            displayName: '旁白',
                            dialogue: 'Quiet',
                            bgm: null,
                        },
                    ],
                },
            ],
        });
        expect(usage.cues).toEqual([]);
        expect(usage.bgmStops).toHaveLength(1);
        expect(
            validateAudioUsage(usage, undefined, 'docs/audio-plan.json')
        ).toEqual([]);
    });

    it('reports unused plan entries deterministically sorted by qualified id', () => {
        const extras: AudioPlanV1 = {
            schemaVersion: 1,
            assets: [
                ...plan.assets,
                {
                    key: 'impact',
                    type: 'sfx',
                    prompt: 'Impact',
                    durationMs: 900,
                },
                {
                    key: 'tension-pulse',
                    type: 'bgm',
                    prompt: 'Tension',
                    durationMs: 90000,
                    loop: true,
                },
            ],
        };
        expect(
            validateAudioUsage(
                collectAudioUsage(story),
                extras,
                'docs/audio-plan.json'
            )
        ).toEqual([
            '[story-compiler] unused audio-plan entry bgm:tension-pulse',
            '[story-compiler] unused audio-plan entry sfx:impact',
        ]);
    });

    it('returns no warnings when every planned key is used', () => {
        expect(
            validateAudioUsage(
                collectAudioUsage(story),
                plan,
                'docs/audio-plan.json'
            )
        ).toEqual([]);
    });
});
