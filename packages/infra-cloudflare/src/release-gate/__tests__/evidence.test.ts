import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { renameSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createEvidenceReference,
    hashCanonicalEvidence,
    hashEvidenceFile,
    resolveEvidencePath,
} from '../evidence';

const descriptorOpenRace = vi.hoisted(() => ({
    beforeOpenAt: undefined as undefined | ((path: string) => void),
}));

vi.mock('bun:ffi', async () => {
    const { closeSync, constants, lstatSync, openSync } = await import(
        'node:fs'
    );
    const { join } = await import('node:path');
    const descriptors = new Map<number, string>();
    return {
        FFIType: { i32: 5, ptr: 12 },
        dlopen: () => ({
            close: () => undefined,
            symbols: {
                close: (descriptor: number): number => {
                    descriptors.delete(descriptor);
                    try {
                        closeSync(descriptor);
                        return 0;
                    } catch {
                        return -1;
                    }
                },
                openat: (
                    directoryDescriptor: number,
                    encodedPath: Uint8Array,
                    flags: number
                ): number => {
                    const path = Buffer.from(encodedPath)
                        .toString('utf8')
                        .split('\0', 1)[0];
                    const beforeOpenAt = descriptorOpenRace.beforeOpenAt;
                    if (beforeOpenAt !== undefined) {
                        beforeOpenAt(path);
                    }
                    if (
                        (flags & constants.O_NOFOLLOW) !==
                        constants.O_NOFOLLOW
                    ) {
                        throw new Error(
                            'descriptor open must not follow links'
                        );
                    }
                    const parentPath = descriptors.get(directoryDescriptor);
                    if (directoryDescriptor >= 0 && parentPath === undefined) {
                        return -1;
                    }
                    const candidate =
                        parentPath === undefined
                            ? path
                            : join(parentPath, path);
                    try {
                        const stats = lstatSync(candidate);
                        if (
                            stats.isSymbolicLink() ||
                            ((flags & constants.O_DIRECTORY) !== 0 &&
                                !stats.isDirectory())
                        ) {
                            return -1;
                        }
                        const descriptor = openSync(candidate, flags);
                        descriptors.set(descriptor, candidate);
                        return descriptor;
                    } catch {
                        return -1;
                    }
                },
            },
        }),
        ptr: (value: Uint8Array): Uint8Array => value,
    };
});

const temporaryDirectories: string[] = [];

async function createEvidenceDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'aquila-release-gate-'));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(async () => {
    descriptorOpenRace.beforeOpenAt = undefined;
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map(directory => rm(directory, { recursive: true, force: true }))
    );
});

describe('release-gate evidence', () => {
    it('rejects evidence paths outside the configured directory', async () => {
        const evidenceDirectory = await createEvidenceDirectory();

        expect(() =>
            resolveEvidencePath(evidenceDirectory, '../secret.json')
        ).toThrow(/outside evidence directory/);
    });

    it('rejects symlink escapes after resolving real paths', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        const outsidePath = join(tmpdir(), 'aquila-release-gate-secret.json');
        await writeFile(outsidePath, '{"secret":true}\n');
        await symlink(outsidePath, join(evidenceDirectory, 'escaped.json'));

        try {
            expect(() =>
                resolveEvidencePath(evidenceDirectory, 'escaped.json')
            ).toThrow(/outside evidence directory/);
        } finally {
            await rm(outsidePath, { force: true });
        }
    });

    it('rejects in-root symlink components instead of following aliases', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        const actualDirectory = join(evidenceDirectory, 'ci-actual');
        await mkdir(actualDirectory);
        await writeFile(
            join(actualDirectory, 'result.json'),
            '{"inside":true}'
        );
        await symlink('ci-actual', join(evidenceDirectory, 'ci'));

        await expect(
            createEvidenceReference(evidenceDirectory, {
                id: 'ci',
                kind: 'ci-result',
                path: 'ci/result.json',
                mediaType: 'application/json',
            })
        ).rejects.toMatchObject({ code: 'evidence/path-outside-root' });
    });

    it('rejects missing and non-regular evidence files', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        await mkdir(join(evidenceDirectory, 'directory.json'));

        expect(() =>
            resolveEvidencePath(evidenceDirectory, 'missing.json')
        ).toThrow(/does not exist/);
        expect(() =>
            resolveEvidencePath(evidenceDirectory, 'directory.json')
        ).toThrow(/regular file/);
    });

    it('hashes semantically identical JSON identically', () => {
        expect(hashCanonicalEvidence({ b: 2, a: 1 })).toBe(
            hashCanonicalEvidence({ a: 1, b: 2 })
        );
        expect(hashCanonicalEvidence({ b: 2, a: 1 })).toBe(
            '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777'
        );
    });

    it('hashes opaque evidence by its exact bytes', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        const evidencePath = join(evidenceDirectory, 'trace.zip');
        await writeFile(evidencePath, 'opaque evidence');

        await expect(hashEvidenceFile(evidencePath)).resolves.toBe(
            'b530febf37d8cf82e2fcdce6c46f9f0ec4af485a5b1cb0770ccbc75cbf1c3752'
        );
    });

    it('creates canonical JSON references and rejects unsupported media types', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        await mkdir(join(evidenceDirectory, 'ci'));
        await writeFile(
            join(evidenceDirectory, 'ci', 'result.json'),
            '{\n  "b": 2,\n  "a": 1\n}\n'
        );

        await expect(
            createEvidenceReference(evidenceDirectory, {
                id: 'ci',
                kind: 'ci-result',
                path: 'ci/result.json',
                mediaType: 'application/json',
            })
        ).resolves.toEqual({
            id: 'ci',
            kind: 'ci-result',
            path: 'ci/result.json',
            sha256: '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777',
            mediaType: 'application/json',
        });

        await expect(
            createEvidenceReference(evidenceDirectory, {
                id: 'ci-text',
                kind: 'ci-result',
                path: 'ci/result.json',
                mediaType: 'text/plain',
            })
        ).rejects.toThrow(/unsupported evidence media type/i);
    });

    it('rejects a final-component symlink swapped before descriptor open', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        const outsideDirectory = await createEvidenceDirectory();
        await mkdir(join(evidenceDirectory, 'ci'));
        const evidencePath = join(evidenceDirectory, 'ci', 'result.json');
        const outsidePath = join(outsideDirectory, 'outside.json');
        await writeFile(evidencePath, '{"inside":true}\n');
        await writeFile(outsidePath, '{"outside":true}\n');

        descriptorOpenRace.beforeOpenAt = path => {
            if (path !== 'result.json') return;
            descriptorOpenRace.beforeOpenAt = undefined;
            rmSync(evidencePath);
            symlinkSync(outsidePath, evidencePath);
        };

        await expect(
            createEvidenceReference(evidenceDirectory, {
                id: 'ci',
                kind: 'ci-result',
                path: 'ci/result.json',
                mediaType: 'application/json',
            })
        ).rejects.toThrow(/evidence/i);
    });

    it('rejects an intermediate symlink swapped immediately before protected descent', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        const outsideDirectory = await createEvidenceDirectory();
        const evidenceSubdirectory = join(evidenceDirectory, 'ci');
        const movedSubdirectory = join(evidenceDirectory, 'ci-before-swap');
        await mkdir(evidenceSubdirectory);
        const evidencePath = join(evidenceSubdirectory, 'result.json');
        const outsidePath = join(outsideDirectory, 'result.json');
        await writeFile(evidencePath, '{"inside":true}\n');
        await writeFile(outsidePath, '{"outside":true}\n');

        descriptorOpenRace.beforeOpenAt = path => {
            if (path !== 'ci') return;
            descriptorOpenRace.beforeOpenAt = undefined;
            renameSync(evidenceSubdirectory, movedSubdirectory);
            symlinkSync(outsideDirectory, evidenceSubdirectory);
        };

        await expect(
            createEvidenceReference(evidenceDirectory, {
                id: 'ci',
                kind: 'ci-result',
                path: 'ci/result.json',
                mediaType: 'application/json',
            })
        ).rejects.toMatchObject({ code: 'evidence/path-outside-root' });
    });
});
