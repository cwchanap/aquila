import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAudioGenerationCli } from '../cli';
import type { AudioGenerationProvider } from '../elevenlabs';

// A real story with a plan: theSeventhMirror has door-open (sfx) and
// dawn-apartment (bgm). Output goes to a temp folder through --out.
const STORY = 'theSeventhMirror';

function fakeProvider(format = 'mp3'): {
    provider: AudioGenerationProvider;
    generate: ReturnType<typeof vi.fn>;
} {
    const generate = vi.fn(async () => ({
        bytes: new Uint8Array([1, 2, 3]),
        mediaType: format === 'mp3' ? 'audio/mpeg' : `audio/${format}`,
        format,
        providerMetadata: { 'character-cost': '40' },
    }));
    return { provider: { generate }, generate };
}

describe('audio:generate', () => {
    let out: string;
    let stdout: string;
    let stderr: string;
    const io = (provider?: AudioGenerationProvider) => ({
        stdout: { write: (chunk: string) => (stdout += chunk) },
        stderr: { write: (chunk: string) => (stderr += chunk) },
        env: { ELEVENLABS_API_KEY: 'test-key' },
        ...(provider === undefined ? {} : { provider }),
    });

    beforeEach(() => {
        out = mkdtempSync(join(tmpdir(), 'audio-generate-'));
        stdout = '';
        stderr = '';
    });

    afterEach(() => {
        rmSync(out, { recursive: true, force: true });
    });

    it('lists what it would make and costs nothing on a dry run', async () => {
        const { provider, generate } = fakeProvider();
        const code = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--key',
                'door-open',
                '--out',
                out,
                '--dry-run',
            ],
            io(provider)
        );

        expect(code).toBe(0);
        expect(stdout).toContain('sfx door-open 2200ms');
        expect(generate).not.toHaveBeenCalled();
        expect(existsSync(join(out, 'sfx', 'door-open.mp3'))).toBe(false);
    });

    it('writes a take to <out>/<type>/<key>.mp3 and reports its cost', async () => {
        const { provider, generate } = fakeProvider();
        const code = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--key',
                'door-open',
                '--key',
                'dawn-apartment',
                '--out',
                out,
                '--max-requests',
                '2',
            ],
            io(provider)
        );

        expect(code).toBe(0);
        expect(generate).toHaveBeenCalledTimes(2);
        expect([...readFileSync(join(out, 'sfx', 'door-open.mp3'))]).toEqual([
            1, 2, 3,
        ]);
        expect(existsSync(join(out, 'bgm', 'dawn-apartment.mp3'))).toBe(true);
        expect(stdout).toContain('(cost 40)');
    });

    it('--missing skips keys that already have a file', async () => {
        const { provider, generate } = fakeProvider();
        const first = [
            'generate',
            '--story',
            STORY,
            '--key',
            'door-open',
            '--out',
            out,
            '--max-requests',
            '1',
        ];
        await runAudioGenerationCli(first, io(provider));
        generate.mockClear();
        stdout = '';

        await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--missing',
                '--out',
                out,
                '--dry-run',
            ],
            io(provider)
        );

        expect(stdout).not.toContain('sfx door-open');
        expect(stdout).toContain('dawn-apartment');
        expect(generate).not.toHaveBeenCalled();
    });

    it('refuses paid runs without a request cap or beyond it', async () => {
        const { provider, generate } = fakeProvider();
        const noCap = await runAudioGenerationCli(
            ['generate', '--story', STORY, '--key', 'door-open', '--out', out],
            io(provider)
        );
        const tooLow = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--key',
                'door-open',
                '--key',
                'dawn-apartment',
                '--out',
                out,
                '--max-requests',
                '1',
            ],
            io(provider)
        );

        expect([noCap, tooLow]).toEqual([1, 1]);
        expect(generate).not.toHaveBeenCalled();
    });

    it('rejects unknown keys and unknown stories as input errors', async () => {
        const { provider } = fakeProvider();
        const key = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--key',
                'no-such-key',
                '--out',
                out,
                '--dry-run',
            ],
            io(provider)
        );
        const story = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                'noSuchStory',
                '--missing',
                '--out',
                out,
                '--dry-run',
            ],
            io(provider)
        );

        expect([key, story]).toEqual([2, 2]);
    });

    it('does not keep a take that is not an mp3', async () => {
        const { provider } = fakeProvider('ogg');
        const code = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--key',
                'door-open',
                '--out',
                out,
                '--max-requests',
                '1',
            ],
            io(provider)
        );

        expect(code).toBe(3);
        expect(stderr).toContain('expected an mp3');
        expect(existsSync(join(out, 'sfx', 'door-open.mp3'))).toBe(false);
    });

    it('needs an API key for paid runs', async () => {
        const { provider } = fakeProvider();
        const code = await runAudioGenerationCli(
            [
                'generate',
                '--story',
                STORY,
                '--key',
                'door-open',
                '--out',
                out,
                '--max-requests',
                '1',
            ],
            { ...io(provider), env: {} }
        );

        expect(code).toBe(1);
        expect(stderr).toContain('ELEVENLABS_API_KEY');
    });
});
