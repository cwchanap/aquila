/**
 * Tests for scripts/build-sfx-fixtures.ts
 *
 * The script synthesizes deterministic PCM-16 WAV fixtures and writes them
 * to public/assets/vn/audio/sfx. We mock `node:fs/promises` so the test
 * exercises the full orchestration logic (synthesis, WAV encoding,
 * verification) without touching the filesystem.
 */
import { execFileSync } from 'node:child_process';
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const scriptPath = resolve(process.cwd(), 'scripts/build-sfx-fixtures.ts');

// ─── Stable mock refs (created before vi.mock hoisting) ────────────────────

const mockMkdir =
    vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>();
const mockWriteFile =
    vi.fn<(path: string, contents: Uint8Array | string) => Promise<void>>();
const mockReadFile = vi.fn<(path: string) => Promise<Buffer>>();

vi.mock('node:fs/promises', () => ({
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    default: {
        mkdir: mockMkdir,
        writeFile: mockWriteFile,
        readFile: mockReadFile,
    },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

const FIXTURE_NAMES = [
    'notification-beep.wav',
    'impact.wav',
    'door-open.wav',
] as const;

const SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

/** Dynamically (re-)imports the script under test. */
async function importScript(): Promise<typeof import('../build-sfx-fixtures')> {
    return await import('../build-sfx-fixtures');
}

/**
 * Returns a deep copy of a Buffer so mutations in a test don't leak into
 * the cached fixture bytes held by the module under test.
 */
function cloneBuffer(buf: Buffer): Buffer {
    return Buffer.from(buf);
}

/** Returns the bytes written by buildSfxFixtures, keyed by file name. */
function writtenBuffers(): Map<string, Buffer> {
    const map = new Map<string, Buffer>();
    for (const [path, contents] of mockWriteFile.mock.calls) {
        const name = String(path).split('/').at(-1)!;
        map.set(name, contents as Buffer);
    }
    return map;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('build-sfx-fixtures', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    describe('buildSfxFixtures', () => {
        it('writes all three fixture WAVs to the sfx output directory', async () => {
            const { buildSfxFixtures } = await importScript();
            await buildSfxFixtures();

            expect(mockWriteFile).toHaveBeenCalledTimes(FIXTURE_NAMES.length);
            for (const name of FIXTURE_NAMES) {
                const call = mockWriteFile.mock.calls.find(([path]) =>
                    String(path).endsWith(name)
                );
                expect(call).toBeDefined();
                expect(String(call![0])).toContain(
                    'public/assets/vn/audio/sfx'
                );
            }
        });

        it('creates the output directory recursively before writing', async () => {
            const { buildSfxFixtures } = await importScript();
            await buildSfxFixtures();

            expect(mockMkdir).toHaveBeenCalledTimes(FIXTURE_NAMES.length);
            for (const args of mockMkdir.mock.calls) {
                expect(args[1]).toEqual({ recursive: true });
            }
        });

        it('produces valid PCM-16 mono WAV files at 8 kHz', async () => {
            const { buildSfxFixtures } = await importScript();
            await buildSfxFixtures();

            const buffers = writtenBuffers();
            for (const name of FIXTURE_NAMES) {
                const bytes = buffers.get(name)!;
                // RIFF header
                expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
                expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
                // fmt subchunk
                expect(bytes.toString('ascii', 12, 16)).toBe('fmt ');
                expect(bytes.readUInt32LE(16)).toBe(16); // PCM fmt chunk size
                expect(bytes.readUInt16LE(20)).toBe(1); // PCM format
                expect(bytes.readUInt16LE(22)).toBe(CHANNELS);
                expect(bytes.readUInt32LE(24)).toBe(SAMPLE_RATE);
                expect(bytes.readUInt32LE(28)).toBe(SAMPLE_RATE * CHANNELS * 2);
                expect(bytes.readUInt16LE(32)).toBe(CHANNELS * 2);
                expect(bytes.readUInt16LE(34)).toBe(BITS_PER_SAMPLE);
                // data subchunk
                expect(bytes.toString('ascii', 36, 40)).toBe('data');
                const dataBytes = bytes.readUInt32LE(40);
                expect(dataBytes).toBeGreaterThan(0);
                expect(bytes.length).toBe(44 + dataBytes);
            }
        });

        it('is deterministic — repeated runs produce identical bytes', async () => {
            const { buildSfxFixtures } = await importScript();
            await buildSfxFixtures();
            const first = writtenBuffers();

            vi.clearAllMocks();
            await buildSfxFixtures();
            const second = writtenBuffers();

            for (const name of FIXTURE_NAMES) {
                expect(second.get(name)!.equals(first.get(name)!)).toBe(true);
            }
        });

        it('produces distinct byte content per fixture', async () => {
            const { buildSfxFixtures } = await importScript();
            await buildSfxFixtures();
            const buffers = writtenBuffers();
            const hashes = new Set(
                [...buffers.values()].map(b => b.toString('hex'))
            );
            expect(hashes.size).toBe(FIXTURE_NAMES.length);
        });
    });

    describe('verifySfxFixtures', () => {
        it('passes silently when committed files match the generator', async () => {
            // First, build to capture the expected bytes.
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            // Wire readFile to return the exact bytes the generator produced.
            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = expected.get(name);
                if (!buf) throw new Error(`unexpected read: ${path}`);
                return cloneBuffer(buf);
            });

            await expect(verifySfxFixtures()).resolves.toBeUndefined();
        });

        it('throws when a committed file has a corrupted RIFF header', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.write('XXXX', 0, 'ascii');
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: RIFF`
            );
        });

        it('throws when a committed file has a corrupted WAVE header', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.write('XXXX', 8, 'ascii');
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: WAVE`
            );
        });

        it('throws when a committed file has a corrupted fmt subchunk id', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.write('XXXX', 12, 'ascii');
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: fmt`
            );
        });

        it('throws when the PCM format code is wrong', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.writeUInt16LE(3, 20); // non-PCM
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: not PCM`
            );
        });

        it('throws when the channel count is not mono', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.writeUInt16LE(2, 22); // stereo
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: not mono`
            );
        });

        it('throws when the bit depth is not 16', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.writeUInt16LE(8, 34); // 8-bit
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: not PCM-16`
            );
        });

        it('throws when the data subchunk id is wrong', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.write('XXXX', 36, 'ascii');
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: data`
            );
        });

        it('throws when the data length field does not match the file size', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.writeUInt32LE(0, 40); // zero data length
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: invalid data length`
            );
        });

        it('throws when committed bytes differ from the deterministic generator', async () => {
            const { buildSfxFixtures, verifySfxFixtures } =
                await importScript();
            await buildSfxFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    // Flip a sample byte in the data region (past the 44-byte
                    // header) so the WAV structure is still valid but the
                    // content differs from the generator output.
                    buf[50] = buf[50] ^ 0xff;
                }
                return buf;
            });

            await expect(verifySfxFixtures()).rejects.toThrow(
                /committed bytes differ from deterministic generator/
            );
        });
    });

    describe('CLI entry point (import.meta.main)', () => {
        // These tests run the script as a real subprocess so that
        // `import.meta.main` is true and the CLI branch executes. The script
        // writes to `public/assets/vn/audio/sfx` relative to CWD, so each test
        // runs in a throwaway temp directory.
        it('writes all three fixture WAVs when run without --verify', () => {
            const tempDir = mkdtempSync(join(tmpdir(), 'sfx-cli-build-'));
            try {
                execFileSync('bun', [scriptPath], { cwd: tempDir });
                const sfxDir = join(tempDir, 'public/assets/vn/audio/sfx');
                expect(existsSync(sfxDir)).toBe(true);
                const files = readdirSync(sfxDir).sort();
                expect(files).toEqual([...FIXTURE_NAMES].sort());
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        });

        it('preserves the committed SFX fixture bytes', () => {
            const committed = new Map(
                FIXTURE_NAMES.map(name => [
                    name,
                    readFileSync(
                        join(process.cwd(), 'public/assets/vn/audio/sfx', name)
                    ),
                ])
            );
            const tempDir = mkdtempSync(join(tmpdir(), 'sfx-byte-stability-'));
            const runner = `import { buildSfxFixtures } from ${JSON.stringify(scriptPath)}; await buildSfxFixtures();`;
            try {
                execFileSync('bun', ['-e', runner], { cwd: tempDir });
                const outputRoot = join(tempDir, 'public/assets/vn/audio/sfx');
                for (const name of FIXTURE_NAMES) {
                    expect(readFileSync(join(outputRoot, name))).toEqual(
                        committed.get(name)
                    );
                }
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        });

        it('verifies committed fixtures when run with --verify', () => {
            const tempDir = mkdtempSync(join(tmpdir(), 'sfx-cli-verify-'));
            try {
                // Build first, then verify — both in the same temp dir.
                execFileSync('bun', [scriptPath], { cwd: tempDir });
                // Should exit 0 when committed bytes match the generator.
                execFileSync('bun', [scriptPath, '--verify'], {
                    cwd: tempDir,
                });
            } finally {
                rmSync(tempDir, { recursive: true, force: true });
            }
        });
    });
});
