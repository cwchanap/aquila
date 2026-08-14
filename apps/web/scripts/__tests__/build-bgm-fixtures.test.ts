/**
 * Tests for the deterministic BGM fixture generator and shared audio helpers.
 *
 * The in-process suite mocks `node:fs/promises` so importing the script
 * exercises the full orchestration (synthesis, WAV encoding, verification)
 * without touching the filesystem and accrues line coverage for the module.
 * The CLI suite runs the script as a real subprocess so the
 * `import.meta.main` entry point is exercised end-to-end.
 */
import { execFileSync } from 'node:child_process';
import {
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

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

const scriptPath = resolve(process.cwd(), 'scripts/build-bgm-fixtures.ts');
const FIXTURE_NAMES = ['dawn-apartment.wav', 'tension-pulse.wav'] as const;
const SAMPLE_RATE = 8_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

/** Dynamically (re-)imports the script under test. */
async function importScript(): Promise<typeof import('../build-bgm-fixtures')> {
    return await import('../build-bgm-fixtures');
}

/** Returns a deep copy of a Buffer so mutations don't leak into the cached fixture. */
function cloneBuffer(buf: Buffer): Buffer {
    return Buffer.from(buf);
}

/** Returns the bytes written by buildBgmFixtures, keyed by file name. */
function writtenBuffers(): Map<string, Buffer> {
    const map = new Map<string, Buffer>();
    for (const [path, contents] of mockWriteFile.mock.calls) {
        const name = String(path).split('/').at(-1)!;
        map.set(name, contents as Buffer);
    }
    return map;
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('build-bgm-fixtures', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
    });

    describe('buildBgmFixtures', () => {
        it('writes both bootstrap BGM fixture WAVs to the bgm output directory', async () => {
            const { buildBgmFixtures } = await importScript();
            await buildBgmFixtures();

            expect(mockWriteFile).toHaveBeenCalledTimes(FIXTURE_NAMES.length);
            for (const name of FIXTURE_NAMES) {
                const call = mockWriteFile.mock.calls.find(([path]) =>
                    String(path).endsWith(name)
                );
                expect(call).toBeDefined();
                expect(String(call![0])).toContain(
                    'public/assets/vn/audio/bgm'
                );
            }
        });

        it('creates the output directory recursively before writing', async () => {
            const { buildBgmFixtures } = await importScript();
            await buildBgmFixtures();

            expect(mockMkdir).toHaveBeenCalledTimes(FIXTURE_NAMES.length);
            for (const args of mockMkdir.mock.calls) {
                expect(args[1]).toEqual({ recursive: true });
            }
        });

        it('produces valid PCM-16 mono WAV files at 8 kHz', async () => {
            const { buildBgmFixtures } = await importScript();
            await buildBgmFixtures();

            const buffers = writtenBuffers();
            for (const name of FIXTURE_NAMES) {
                const bytes = buffers.get(name)!;
                expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
                expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
                expect(bytes.toString('ascii', 12, 16)).toBe('fmt ');
                expect(bytes.readUInt32LE(16)).toBe(16);
                expect(bytes.readUInt16LE(20)).toBe(1);
                expect(bytes.readUInt16LE(22)).toBe(CHANNELS);
                expect(bytes.readUInt32LE(24)).toBe(SAMPLE_RATE);
                expect(bytes.readUInt32LE(28)).toBe(SAMPLE_RATE * CHANNELS * 2);
                expect(bytes.readUInt16LE(32)).toBe(CHANNELS * 2);
                expect(bytes.readUInt16LE(34)).toBe(BITS_PER_SAMPLE);
                expect(bytes.toString('ascii', 36, 40)).toBe('data');
                const dataBytes = bytes.readUInt32LE(40);
                expect(dataBytes).toBeGreaterThan(0);
                expect(bytes.length).toBe(44 + dataBytes);
            }
        });

        it('is deterministic — repeated runs produce identical bytes', async () => {
            const { buildBgmFixtures } = await importScript();
            await buildBgmFixtures();
            const first = writtenBuffers();

            vi.clearAllMocks();
            await buildBgmFixtures();
            const second = writtenBuffers();

            for (const name of FIXTURE_NAMES) {
                expect(second.get(name)!.equals(first.get(name)!)).toBe(true);
            }
        });

        it('produces distinct byte content per fixture', async () => {
            const { buildBgmFixtures } = await importScript();
            await buildBgmFixtures();
            const buffers = writtenBuffers();
            const hashes = new Set(
                [...buffers.values()].map(b => b.toString('hex'))
            );
            expect(hashes.size).toBe(FIXTURE_NAMES.length);
        });
    });

    describe('verifyBgmFixtures', () => {
        it('passes silently when committed files match the generator', async () => {
            const { buildBgmFixtures, verifyBgmFixtures } =
                await importScript();
            await buildBgmFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = expected.get(name);
                if (!buf) throw new Error(`unexpected read: ${path}`);
                return cloneBuffer(buf);
            });

            await expect(verifyBgmFixtures()).resolves.toBeUndefined();
        });

        it('throws when a committed file has a corrupted RIFF header', async () => {
            const { buildBgmFixtures, verifyBgmFixtures } =
                await importScript();
            await buildBgmFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf.write('XXXX', 0, 'ascii');
                }
                return buf;
            });

            await expect(verifyBgmFixtures()).rejects.toThrow(
                `${FIXTURE_NAMES[0]}: RIFF`
            );
        });

        it('throws when committed bytes differ from the deterministic generator', async () => {
            const { buildBgmFixtures, verifyBgmFixtures } =
                await importScript();
            await buildBgmFixtures();
            const expected = writtenBuffers();

            mockReadFile.mockImplementation(async (path: string) => {
                const name = String(path).split('/').at(-1)!;
                const buf = cloneBuffer(expected.get(name)!);
                if (name === FIXTURE_NAMES[0]) {
                    buf[50] = buf[50] ^ 0xff;
                }
                return buf;
            });

            await expect(verifyBgmFixtures()).rejects.toThrow(
                /committed bytes differ from deterministic generator/
            );
        });
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
