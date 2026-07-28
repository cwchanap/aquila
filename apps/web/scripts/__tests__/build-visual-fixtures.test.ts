/**
 * Tests for scripts/build-visual-fixtures.ts
 *
 * The script uses `sharp` to resize/encode source images and `node:fs/promises`
 * to write the resulting object files, manifest, pointer, and AVIF probe. We
 * mock both modules so the test exercises the full orchestration logic without
 * touching real image files or the filesystem.
 */
import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Stable mock refs (created before vi.mock hoisting) ────────────────────

const mockMkdir =
    vi.fn<(path: string, options?: { recursive?: boolean }) => Promise<void>>();
const mockWriteFile =
    vi.fn<(path: string, contents: Uint8Array | string) => Promise<void>>();

vi.mock('node:fs/promises', () => ({
    mkdir: mockMkdir,
    writeFile: mockWriteFile,
    default: { mkdir: mockMkdir, writeFile: mockWriteFile },
}));

// A chainable sharp mock. Each call to `sharp(...)` returns a fresh chain whose
// terminal methods (`toBuffer`, `metadata`, `toFile`) resolve to canned values.
const toBufferMock = vi.fn();
const metadataMock = vi.fn();
const toFileMock = vi.fn();

function createChain() {
    const chain = {
        resize: vi.fn().mockReturnThis(),
        webp: vi.fn().mockReturnThis(),
        avif: vi.fn().mockReturnThis(),
        toBuffer: toBufferMock,
        metadata: metadataMock,
        toFile: toFileMock,
    };
    return chain;
}

const sharpMock = vi.fn();

vi.mock('sharp', () => ({
    default: sharpMock,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A deterministic fake webp buffer returned by `sharp().toBuffer()`. */
function fakeBuffer(seed: string): Buffer {
    return Buffer.from(`webp-bytes-${seed}`, 'utf8');
}

function sha256(value: Uint8Array | string): string {
    return createHash('sha256').update(value).digest('hex');
}

/** Dynamically (re-)imports the script under test. */
async function importBuild(): Promise<
    typeof import('../build-visual-fixtures')
> {
    return await import('../build-visual-fixtures');
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('build-visual-fixtures', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();

        // Default sharp behavior: each invocation returns a fresh chain.
        sharpMock.mockImplementation(() => createChain());
    });

    it('writes object files, manifest, pointer, and AVIF probe for all fixtures', async () => {
        // Provide distinct buffers per fixture so each object hash differs.
        const buffers = [
            fakeBuffer('bg0'),
            fakeBuffer('bg1'),
            fakeBuffer('portrait0'),
            fakeBuffer('portrait1'),
        ];
        const dimensions = [
            { width: 960, height: 540 },
            { width: 960, height: 540 },
            { width: 450, height: 600 },
            { width: 450, height: 600 },
        ];
        let bufferIndex = 0;
        let metadataIndex = 0;

        sharpMock.mockImplementation(() => {
            const chain = createChain();
            chain.toBuffer.mockImplementation(async () => {
                return buffers[bufferIndex++];
            });
            chain.metadata.mockImplementation(async () => {
                return dimensions[metadataIndex++];
            });
            chain.toFile.mockImplementation(async () => ({ size: 1 }));
            return chain;
        });

        const { buildVisualFixtures } = await importBuild();
        await buildVisualFixtures();

        // 4 object writes + 1 manifest + 1 pointer = 6 writeFile calls.
        // (The AVIF probe is written via sharp().toFile(), not writeFile.)
        expect(mockWriteFile).toHaveBeenCalledTimes(6);

        // The AVIF probe file is written via sharp().avif().toFile().
        expect(toFileMock).toHaveBeenCalledWith(
            expect.stringContaining('avif-probe.avif')
        );

        // mkdir is called for each object directory, the manifest directory, the
        // pointer directory, and the visual-assets directory.
        expect(mockMkdir).toHaveBeenCalledWith(
            expect.stringContaining('src/lib/visual-assets'),
            { recursive: true }
        );
    });

    it('computes object SHA-256 from canonical content and writes the manifest', async () => {
        const buffer = fakeBuffer('canonical');
        const expectedObjectSha = sha256(buffer);

        sharpMock.mockImplementation(() => {
            const chain = createChain();
            chain.toBuffer.mockImplementation(async () => buffer);
            chain.metadata.mockImplementation(async () => ({
                width: 960,
                height: 540,
            }));
            chain.toFile.mockImplementation(async () => ({ size: 1 }));
            return chain;
        });

        const { buildVisualFixtures } = await importBuild();
        await buildVisualFixtures();

        // Every fixture uses the same buffer, so all object paths share one hash.
        const objectPath = `vn/objects/${expectedObjectSha}.webp`;
        const objectWriteCalls = mockWriteFile.mock.calls.filter(call =>
            String(call[0]).includes(objectPath)
        );
        expect(objectWriteCalls.length).toBe(4);

        // The manifest write contains the computed release id and asset entries.
        const manifestWriteCall = mockWriteFile.mock.calls.find(call =>
            String(call[0]).endsWith('runtime-manifest.json')
        );
        expect(manifestWriteCall).toBeDefined();
        const manifestText = manifestWriteCall![1] as string;
        const manifest = JSON.parse(manifestText);
        expect(manifest.schemaVersion).toBe(1);
        expect(manifest.storyId).toBe('the_seventh_mirror');
        expect(manifest.releaseId).toMatch(/^sha256-[a-f0-9]{64}$/);
        expect(manifest.assets).toHaveLength(4);
        for (const asset of manifest.assets) {
            expect(asset.variants.webp.sha256).toBe(expectedObjectSha);
            expect(asset.variants.webp.path).toBe(objectPath);
            expect(asset.variants.webp.byteLength).toBe(buffer.byteLength);
        }
    });

    it('writes the pointer with the manifest path and manifest SHA-256', async () => {
        const buffer = fakeBuffer('pointer');
        sharpMock.mockImplementation(() => {
            const chain = createChain();
            chain.toBuffer.mockImplementation(async () => buffer);
            chain.metadata.mockImplementation(async () => ({
                width: 960,
                height: 540,
            }));
            chain.toFile.mockImplementation(async () => ({ size: 1 }));
            return chain;
        });

        const { buildVisualFixtures } = await importBuild();
        await buildVisualFixtures();

        const pointerCall = mockWriteFile.mock.calls.find(call =>
            String(call[0]).endsWith('current.json')
        );
        expect(pointerCall).toBeDefined();
        const pointer = JSON.parse(pointerCall![1] as string);
        expect(pointer.schemaVersion).toBe(1);
        expect(pointer.storyId).toBe('the_seventh_mirror');
        expect(pointer.releaseId).toMatch(/^sha256-[a-f0-9]{64}$/);
        expect(pointer.manifestPath).toMatch(
            /vn\/previews\/hpa-228-local\/stories\/the_seventh_mirror\/releases\/sha256-[a-f0-9]{64}\/runtime-manifest\.json/
        );
        expect(pointer.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
        expect(pointer.publishedAt).toBe('2026-07-26T00:00:00.000Z');
    });

    it('writes the AVIF probe file via sharp().avif().toFile()', async () => {
        sharpMock.mockImplementation(() => {
            const chain = createChain();
            chain.toBuffer.mockImplementation(async () => fakeBuffer('avif'));
            chain.metadata.mockImplementation(async () => ({
                width: 960,
                height: 540,
            }));
            chain.toFile.mockImplementation(async () => ({ size: 1 }));
            return chain;
        });

        const { buildVisualFixtures } = await importBuild();
        await buildVisualFixtures();

        // The final sharp call uses `.avif().toFile(...)` for the probe.
        expect(toFileMock).toHaveBeenCalledWith(
            expect.stringContaining('avif-probe.avif')
        );
    });

    it('throws when sharp metadata lacks dimensions', async () => {
        sharpMock.mockImplementation(() => {
            const chain = createChain();
            chain.toBuffer.mockImplementation(async () => fakeBuffer('nodims'));
            // Missing width/height.
            chain.metadata.mockImplementation(async () => ({}));
            chain.toFile.mockImplementation(async () => ({ size: 1 }));
            return chain;
        });

        const { buildVisualFixtures } = await importBuild();
        await expect(buildVisualFixtures()).rejects.toThrow(
            /Unable to read dimensions/
        );
    });
});
