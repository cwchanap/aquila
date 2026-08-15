import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..'
);

// Vitest workers run under Node, but the compiler CLI imports TypeScript
// modules without extensions, so it must be launched with Bun (the repo's
// package manager, e.g. `bun src/compiler/cli.ts --report`).
const cliRuntime = process.env.npm_execpath ?? 'bun';

function runReport(args: string[]): string {
    return execFileSync(
        cliRuntime,
        ['src/compiler/cli.ts', '--report', ...args],
        { cwd: packageRoot, encoding: 'utf8' }
    );
}

describe('cli --report', () => {
    it('prints deterministic cue coverage for theSeventhMirror', () => {
        const report = JSON.parse(runReport(['theSeventhMirror']));

        expect(report.story).toBe('theSeventhMirror');
        expect(
            report.assets.map(
                (asset: { type: string; key: string }) =>
                    `${asset.type}:${asset.key}`
            )
        ).toEqual([
            'bgm:bay-waterfront',
            'bgm:carriage-drone',
            'bgm:dawn-apartment',
            'bgm:grey-city',
            'bgm:institutional-drone',
            'bgm:night-street',
            'bgm:passage-hum',
            'bgm:safe-harbor',
            'bgm:sleepless-vigil',
            'bgm:tension-pulse',
            'sfx:blood-drip',
            'sfx:camera-shutter',
            'sfx:card-access-beep',
            'sfx:code-blue-rush',
            'sfx:door-knock',
            'sfx:door-latch',
            'sfx:door-open',
            'sfx:door-seal',
            'sfx:evidence-bag-seal',
            'sfx:fluorescent-hum',
            'sfx:impact',
            'sfx:letter-confirm',
            'sfx:mirror-chime',
            'sfx:monitor-beep',
            'sfx:notification-beep',
            'sfx:pa-announcement',
            'sfx:phone-vibrate',
            'sfx:radio-feed',
            'sfx:receiver-static',
            'sfx:sleep-talk-recording',
            'sfx:sync-glitch',
            'sfx:toolbox-roll',
            'sfx:train-doors',
            'sfx:train-hum',
            'sfx:trolley-wheels',
            'sfx:vending-machine-hum',
            'sfx:ventilator-cycle',
        ]);
        expect(report.bgmStops).toHaveLength(44);
        expect(report.unused).toEqual([]);
    });

    it('fails with a usage error when no story name is given', () => {
        expect(() => runReport([])).toThrow(/usage: --report <storyName>/);
    });

    it('fails for an unknown story name', () => {
        expect(() => runReport(['no-such-story'])).toThrow(
            /\[story-compiler\] unknown story "no-such-story"/
        );
    });
});
