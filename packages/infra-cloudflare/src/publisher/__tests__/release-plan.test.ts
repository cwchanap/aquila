import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadReleasePlan, resolveReleasePlanPath } from '../release-plan';

describe('publisher release-plan input', () => {
    it('prefers explicit, then preview companion, then production plan', async () => {
        const root = await mkdtemp(join(tmpdir(), 'plans-'));
        const plans = join(root, 'packages/stories/release-plans');
        const explicitPath = join(root, 'explicit.json');
        await mkdir(plans, { recursive: true });
        await writeFile(
            join(plans, 'example_story.json'),
            JSON.stringify({ schemaVersion: 1 })
        );
        await writeFile(
            join(plans, 'example_story.preview.json'),
            JSON.stringify({ schemaVersion: 1 })
        );
        await writeFile(explicitPath, JSON.stringify({ schemaVersion: 1 }));

        await expect(
            resolveReleasePlanPath({
                repositoryRoot: root,
                storyId: 'example_story',
                target: { kind: 'preview', previewId: 'test' },
                explicitPath,
            })
        ).resolves.toBe(explicitPath);

        await expect(
            resolveReleasePlanPath({
                repositoryRoot: root,
                storyId: 'example_story',
                target: { kind: 'preview', previewId: 'test' },
            })
        ).resolves.toBe(join(plans, 'example_story.preview.json'));
    });

    it('parses a release plan through the shared contract', async () => {
        const root = await mkdtemp(join(tmpdir(), 'plan-'));
        const path = join(root, 'example_story.json');
        await writeFile(
            path,
            JSON.stringify({
                schemaVersion: 1,
                storyId: 'example_story',
                channel: 'preview',
                entries: [],
            })
        );

        await expect(loadReleasePlan(path)).resolves.toMatchObject({
            storyId: 'example_story',
            channel: 'preview',
        });
    });
});
