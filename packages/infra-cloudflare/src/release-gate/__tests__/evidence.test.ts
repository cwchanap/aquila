import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    createEvidenceReference,
    hashCanonicalEvidence,
    hashEvidenceFile,
    resolveEvidencePath,
} from '../evidence';

const evidenceReadRace = vi.hoisted(() => ({
    beforeOpenOrRead: undefined as undefined | (() => Promise<void>),
}));

vi.mock('node:fs/promises', async importOriginal => {
    const actual = await importOriginal<typeof import('node:fs/promises')>();
    const triggerRace = async (): Promise<void> => {
        const beforeOpenOrRead = evidenceReadRace.beforeOpenOrRead;
        if (beforeOpenOrRead === undefined) return;
        evidenceReadRace.beforeOpenOrRead = undefined;
        await beforeOpenOrRead();
    };
    return {
        ...actual,
        open: async (...args: Parameters<typeof actual.open>) => {
            await triggerRace();
            return actual.open(...args);
        },
        readFile: async (...args: Parameters<typeof actual.readFile>) => {
            await triggerRace();
            return actual.readFile(...args);
        },
    };
});

const temporaryDirectories: string[] = [];

async function createEvidenceDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'aquila-release-gate-'));
    temporaryDirectories.push(directory);
    return directory;
}

afterEach(async () => {
    evidenceReadRace.beforeOpenOrRead = undefined;
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

    it('rejects a symlink swapped between validation and the evidence read', async () => {
        const evidenceDirectory = await createEvidenceDirectory();
        const outsideDirectory = await createEvidenceDirectory();
        await mkdir(join(evidenceDirectory, 'ci'));
        const evidencePath = join(evidenceDirectory, 'ci', 'result.json');
        const outsidePath = join(outsideDirectory, 'outside.json');
        await writeFile(evidencePath, '{"inside":true}\n');
        await writeFile(outsidePath, '{"outside":true}\n');

        evidenceReadRace.beforeOpenOrRead = async () => {
            await rm(evidencePath);
            await symlink(outsidePath, evidencePath);
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
});
