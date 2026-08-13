/**
 * Tests for the deterministic BGM fixture generator and shared audio helpers.
 */
import { execFileSync } from 'node:child_process';
import {
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAudioFixtures } from '../audio-fixture';

const scriptPath = resolve(process.cwd(), 'scripts/build-bgm-fixtures.ts');
const FIXTURE_NAMES = ['dawn-apartment.wav', 'tension-pulse.wav'] as const;

describe('audio fixture helpers', () => {
    it('writes each generic fixture to the requested output directory', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'audio-fixture-helper-'));
        const fixtureBytes = {
            'a.wav': Buffer.from('a'),
            'b.wav': Buffer.from('b'),
        };

        try {
            await buildAudioFixtures(tempDir, fixtureBytes);
            expect(await readFile(resolve(tempDir, 'a.wav'))).toEqual(
                fixtureBytes['a.wav']
            );
            expect(await readFile(resolve(tempDir, 'b.wav'))).toEqual(
                fixtureBytes['b.wav']
            );
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});

describe('build-bgm-fixtures CLI', () => {
    it('writes exactly the two bootstrap BGM fixture WAVs', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'bgm-cli-build-'));
        try {
            execFileSync('bun', [scriptPath], { cwd: tempDir });
            const bgmDir = join(tempDir, 'public/assets/vn/audio/bgm');
            expect(readdirSync(bgmDir).sort()).toEqual(
                [...FIXTURE_NAMES].sort()
            );
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    it('rejects byte drift in verify mode', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'bgm-cli-verify-'));
        try {
            execFileSync('bun', [scriptPath], { cwd: tempDir });
            const fixturePath = join(
                tempDir,
                'public/assets/vn/audio/bgm',
                FIXTURE_NAMES[0]
            );
            const corrupted = readFileSync(fixturePath);
            corrupted[50] = corrupted[50] ^ 0xff;
            writeFileSync(fixturePath, corrupted);

            let error: unknown;
            try {
                execFileSync('bun', [scriptPath, '--verify'], {
                    cwd: tempDir,
                    stdio: ['ignore', 'pipe', 'pipe'],
                });
            } catch (caught) {
                error = caught;
            }

            expect(error).toBeDefined();
            const stderr =
                (error as { stderr?: Buffer }).stderr?.toString() ?? '';
            expect(stderr).toContain(
                'committed bytes differ from deterministic generator'
            );
        } finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
