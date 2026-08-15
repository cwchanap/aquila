import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAudioPlan, parseAudioPlan } from '../audio-plan';

const validPlan = {
    schemaVersion: 1,
    assets: [
        {
            key: 'door-open',
            type: 'sfx',
            prompt: 'Heavy apartment door opening, dry hinge, one-shot',
            durationMs: 2200,
        },
        {
            key: 'dawn-apartment',
            type: 'bgm',
            prompt: 'Restrained cold-dawn mystery underscore, seamless loop',
            durationMs: 90000,
            loop: true,
        },
    ],
};

describe('parseAudioPlan', () => {
    it('parses strict SFX and BGM entries', () => {
        expect(parseAudioPlan(validPlan)).toEqual(validPlan);
    });

    it('accepts non-empty editorial notes', () => {
        expect(
            parseAudioPlan({
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: 'Door',
                        durationMs: 1000,
                        notes: 'Reuse for the same apartment door.',
                    },
                ],
            }).assets[0]
        ).toMatchObject({ notes: 'Reuse for the same apartment door.' });
    });

    it.each([
        ['wrong version', { ...validPlan, schemaVersion: 2 }],
        [
            'reserved key',
            {
                schemaVersion: 1,
                assets: [
                    { key: 'stop', type: 'sfx', prompt: 'x', durationMs: 1 },
                ],
            },
        ],
        [
            'unsafe key',
            {
                schemaVersion: 1,
                assets: [
                    { key: '../door', type: 'sfx', prompt: 'x', durationMs: 1 },
                ],
            },
        ],
        [
            'capitalized key',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'Door-Open',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 1,
                    },
                ],
            },
        ],
        [
            'zero duration',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 0,
                    },
                ],
            },
        ],
        [
            'fractional duration',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 1.5,
                    },
                ],
            },
        ],
        [
            'empty prompt',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: ' ',
                        durationMs: 1000,
                    },
                ],
            },
        ],
        [
            'empty notes',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 1000,
                        notes: ' ',
                    },
                ],
            },
        ],
        [
            'sfx loop field',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 1000,
                        loop: true,
                    },
                ],
            },
        ],
        [
            'bgm missing loop',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'dawn-apartment',
                        type: 'bgm',
                        prompt: 'x',
                        durationMs: 90000,
                    },
                ],
            },
        ],
        [
            'provider field',
            {
                schemaVersion: 1,
                assets: [
                    {
                        key: 'door-open',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 1000,
                        provider: 'elevenlabs',
                    },
                ],
            },
        ],
    ])('rejects %s', (_name, input) => {
        expect(() => parseAudioPlan(input)).toThrow();
    });

    it('rejects a duplicate logical key even across types', () => {
        expect(() =>
            parseAudioPlan({
                schemaVersion: 1,
                assets: [
                    {
                        key: 'shared-cue',
                        type: 'sfx',
                        prompt: 'x',
                        durationMs: 1000,
                    },
                    {
                        key: 'shared-cue',
                        type: 'bgm',
                        prompt: 'y',
                        durationMs: 90000,
                        loop: true,
                    },
                ],
            })
        ).toThrow(/duplicate/i);
    });
});

describe('loadAudioPlan', () => {
    function withTempDir(run: (rawDir: string) => void): void {
        const rawDir = mkdtempSync(join(tmpdir(), 'aquila-audio-plan-'));
        try {
            run(rawDir);
        } finally {
            rmSync(rawDir, { recursive: true, force: true });
        }
    }

    function writePlan(rawDir: string, contents: string): string {
        const docsDir = join(rawDir, 'docs');
        mkdirSync(docsDir, { recursive: true });
        const planPath = join(docsDir, 'audio-plan.json');
        writeFileSync(planPath, contents, 'utf8');
        return planPath;
    }

    it('returns undefined when the plan file is absent', () => {
        withTempDir(rawDir => {
            expect(loadAudioPlan(rawDir)).toBeUndefined();
        });
    });

    it('loads a valid docs/audio-plan.json', () => {
        withTempDir(rawDir => {
            writePlan(rawDir, JSON.stringify(validPlan));
            expect(loadAudioPlan(rawDir)).toEqual(validPlan);
        });
    });

    it('throws with the plan path on malformed JSON', () => {
        withTempDir(rawDir => {
            writePlan(rawDir, '{ not json');
            expect(() => loadAudioPlan(rawDir)).toThrow(/audio-plan\.json/);
        });
    });

    it('throws with the plan path on schema-invalid JSON', () => {
        withTempDir(rawDir => {
            writePlan(rawDir, JSON.stringify({ schemaVersion: 2, assets: [] }));
            expect(() => loadAudioPlan(rawDir)).toThrow(/audio-plan\.json/);
        });
    });
});
