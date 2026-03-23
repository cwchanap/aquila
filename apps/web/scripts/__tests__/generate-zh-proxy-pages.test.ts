/**
 * Tests for generate-zh-proxy-pages.ts script.
 * Uses vi.mock('fs') + dynamic import to exercise module-level code and helper functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dirent } from 'fs';

// ---- fs mock ----------------------------------------------------------------
// We intercept fs BEFORE the module is imported so module-level code uses mocks.

const mockExistsSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockRmSync = vi.fn();

vi.mock('fs', async importOriginal => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        existsSync: mockExistsSync,
        mkdirSync: mockMkdirSync,
        readdirSync: mockReaddirSync,
        writeFileSync: mockWriteFileSync,
        unlinkSync: mockUnlinkSync,
        rmSync: mockRmSync,
        default: {
            ...actual,
            existsSync: mockExistsSync,
            mkdirSync: mockMkdirSync,
            readdirSync: mockReaddirSync,
            writeFileSync: mockWriteFileSync,
            unlinkSync: mockUnlinkSync,
            rmSync: mockRmSync,
        },
    };
});

/**
 * Cross-platform check: true when the path contains 'zh' as a distinct path segment.
 * Normalising the separator avoids false negatives on Windows where path.join uses '\'.
 */
function hasPathSegment(p: unknown, segment: string): boolean {
    return new RegExp(`(^|[\\\\/])${segment}($|[\\\\/])`).test(String(p));
}

// Helper to create a mock Dirent for an .astro file
function makeFileDirent(name: string): Partial<Dirent> {
    return {
        name,
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
    };
}

describe('generate-zh-proxy-pages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('creates zhPagesDir when it does not exist, then generates proxy pages', async () => {
        // zhPagesDir does not exist → mkdirSync called
        // localePagesDir exists → no throw
        // readdirSync for localePagesDir returns one .astro file
        // readdirSync for zhPagesDir (cleanup) returns [] (no stale files)
        mockExistsSync.mockImplementation((p: unknown) => {
            if (hasPathSegment(p, 'zh')) return false; // zhPagesDir absent
            return true; // all others exist
        });
        mockReaddirSync.mockImplementation((dir: string) => {
            if (String(dir).includes('[locale]')) {
                return [makeFileDirent('index.astro')];
            }
            // zh dir (cleanup)
            return [];
        });

        await import('../../scripts/generate-zh-proxy-pages');

        // zh directory was created
        expect(mockMkdirSync).toHaveBeenCalledWith(
            expect.stringContaining('zh'),
            { recursive: true }
        );
        // Proxy file was written for index.astro
        expect(mockWriteFileSync).toHaveBeenCalledWith(
            expect.stringContaining('index.astro'),
            expect.stringContaining('locale="zh"')
        );
    });

    it('skips mkdirSync when zhPagesDir already exists', async () => {
        // Both directories exist
        mockExistsSync.mockReturnValue(true);
        mockReaddirSync.mockImplementation((dir: string) => {
            if (String(dir).includes('[locale]')) {
                return [makeFileDirent('setup.astro')];
            }
            return [];
        });

        await import('../../scripts/generate-zh-proxy-pages');

        expect(mockMkdirSync).not.toHaveBeenCalledWith(
            expect.stringContaining('zh'),
            { recursive: true }
        );
        expect(mockWriteFileSync).toHaveBeenCalledWith(
            expect.stringContaining('setup.astro'),
            expect.stringContaining('locale="zh"')
        );
    });

    it('removes stale zh proxy files that have no corresponding locale file', async () => {
        mockExistsSync.mockReturnValue(true);
        mockReaddirSync.mockImplementation((dir: string) => {
            if (String(dir).includes('[locale]')) {
                // localePagesDir has one file
                return [makeFileDirent('index.astro')];
            }
            if (hasPathSegment(dir, 'zh')) {
                // zh dir has one stale file not in locale pages
                return [makeFileDirent('stale-old.astro')];
            }
            return [];
        });

        await import('../../scripts/generate-zh-proxy-pages');

        // The stale file should be removed
        expect(mockUnlinkSync).toHaveBeenCalledWith(
            expect.stringContaining('stale-old.astro')
        );
    });

    it('throws when localePagesDir does not exist (covers lines 84-87)', async () => {
        mockExistsSync.mockImplementation((p: string) => {
            // zhPagesDir exists, but localePagesDir does NOT
            if (String(p).includes('[locale]')) return false;
            return true;
        });
        mockReaddirSync.mockReturnValue([]);

        await expect(
            import('../../scripts/generate-zh-proxy-pages')
        ).rejects.toThrow('Missing src/pages/[locale] directory');
    });

    it('recursively scans subdirectories in findAstroFiles (covers line 25) and removes empty zh subdirs (covers lines 51-65)', async () => {
        mockExistsSync.mockReturnValue(true);

        // Helper to create a mock Dirent for a directory
        const makeDirDirent = (name: string): Partial<Dirent> => ({
            name,
            isDirectory: () => true,
            isFile: () => false,
            isSymbolicLink: () => false,
            isBlockDevice: () => false,
            isCharacterDevice: () => false,
            isFIFO: () => false,
            isSocket: () => false,
        });

        mockReaddirSync.mockImplementation((dir: string) => {
            const d = String(dir);
            // First call: localePagesDir root → returns a subdirectory
            if (d.includes('[locale]') && !d.includes('subdir')) {
                return [makeDirDirent('subdir')];
            }
            // Recursive call: localePagesDir/subdir → returns page.astro
            if (d.includes('[locale]') && d.includes('subdir')) {
                return [makeFileDirent('page.astro')];
            }
            // zh dir cleanup root: returns a subdirectory (for recursive cleanup)
            if (hasPathSegment(d, 'zh') && !d.includes('subdir')) {
                return [makeDirDirent('subdir')];
            }
            // Recursive cleanup into zh/subdir: returns empty (triggers rmSync)
            return [];
        });

        // After recursive cleanup, the zh/subdir is empty → existsSync(fullPath) returns true → rmSync called
        await import('../../scripts/generate-zh-proxy-pages');

        // rmSync called to remove the empty directory
        expect(mockRmSync).toHaveBeenCalledWith(
            expect.stringContaining('subdir'),
            { recursive: true }
        );
    });
});
