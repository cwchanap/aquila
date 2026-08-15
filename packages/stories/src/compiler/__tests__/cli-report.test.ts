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
            'bgm:dawn-apartment',
            'bgm:tension-pulse',
            'sfx:door-open',
            'sfx:impact',
            'sfx:notification-beep',
        ]);
        expect(report.bgmStops).toHaveLength(1);
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
