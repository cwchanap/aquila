import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PublisherError } from '../errors';
import { deriveReleasePlan, loadReleasePlan } from '../release-plan';

const catalog = {
    storyId: 'example_story',
    assets: [
        {
            identity: { type: 'background' as const, key: 'act1/s0' },
            sourcePath: 'example_story/backgrounds/act1/s0.png',
        },
        {
            identity: { type: 'portrait' as const, key: 'hero/base' },
            sourcePath: 'example_story/characters/hero/base.png',
        },
    ],
};

async function sourceRootWith(paths: readonly string[]): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'aquila-derive-plan-'));
    for (const path of paths) {
        await mkdir(join(root, path, '..'), { recursive: true });
        await writeFile(join(root, path), 'png');
    }
    return root;
}

describe('deriveReleasePlan', () => {
    it('includes the art that exists and omits the rest', async () => {
        const root = await sourceRootWith([
            'example_story/backgrounds/act1/s0.png',
        ]);

        await expect(deriveReleasePlan(catalog, root)).resolves.toEqual({
            schemaVersion: 1,
            storyId: 'example_story',
            channel: 'production',
            entries: [
                {
                    identity: { type: 'background', key: 'act1/s0' },
                    disposition: 'included',
                    sourcePath: 'example_story/backgrounds/act1/s0.png',
                },
                {
                    identity: { type: 'portrait', key: 'hero/base' },
                    disposition: 'omitted',
                    reason: 'No artwork in the source root yet',
                },
            ],
        });
    });

    it('omits a catalog path that is a directory', async () => {
        const root = await sourceRootWith([
            'example_story/backgrounds/act1/s0.png',
        ]);
        await mkdir(join(root, 'example_story/characters/hero/base.png'), {
            recursive: true,
        });

        await expect(deriveReleasePlan(catalog, root)).resolves.toMatchObject({
            entries: [
                { disposition: 'included' },
                {
                    disposition: 'omitted',
                    reason: 'No artwork in the source root yet',
                },
            ],
        });
    });

    it('omits a catalog path that is a dangling symlink', async () => {
        const root = await sourceRootWith([
            'example_story/backgrounds/act1/s0.png',
        ]);
        await mkdir(join(root, 'example_story/characters/hero'), {
            recursive: true,
        });
        await symlink(
            'missing-target.png',
            join(root, 'example_story/characters/hero/base.png')
        );

        await expect(deriveReleasePlan(catalog, root)).resolves.toMatchObject({
            entries: [
                { disposition: 'included' },
                {
                    disposition: 'omitted',
                    reason: 'No artwork in the source root yet',
                },
            ],
        });
    });

    it('refuses to publish a story with no art at all', async () => {
        const root = await sourceRootWith([]);

        await expect(deriveReleasePlan(catalog, root)).rejects.toMatchObject({
            code: 'input',
            message: 'Story has no artwork to publish',
        });
    });
});

describe('loadReleasePlan', () => {
    it('reports an unreadable fixture plan as an input error', async () => {
        const root = await sourceRootWith([]);

        await expect(
            loadReleasePlan(join(root, 'missing.json'))
        ).rejects.toBeInstanceOf(PublisherError);
    });
});
