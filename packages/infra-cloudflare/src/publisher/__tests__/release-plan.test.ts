import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PublisherError } from '../errors';
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

    it('rejects unsafe story ids before resolving fallback paths', async () => {
        await expect(
            resolveReleasePlanPath({
                repositoryRoot: '/repository',
                storyId: '../private',
                target: { kind: 'production' },
            })
        ).rejects.toThrow(/story id is unsafe/i);
    });

    it('does not expose an absolute release-plan path in errors', async () => {
        const privatePath = join(tmpdir(), 'private-release-plan.json');

        await expect(loadReleasePlan(privatePath)).rejects.toSatisfy(
            (error: unknown) => {
                expect(error).toBeInstanceOf(PublisherError);
                expect(
                    JSON.stringify((error as PublisherError).context)
                ).not.toContain(privatePath);
                return true;
            }
        );
    });

    it('falls back to the production plan only when the preview companion is absent (ENOENT)', async () => {
        const root = await mkdtemp(join(tmpdir(), 'plans-'));
        const plans = join(root, 'packages/stories/release-plans');
        await mkdir(plans, { recursive: true });
        await writeFile(
            join(plans, 'example_story.json'),
            JSON.stringify({ schemaVersion: 1 })
        );
        // No .preview.json present -> ENOENT -> production fallback.

        await expect(
            resolveReleasePlanPath({
                repositoryRoot: root,
                storyId: 'example_story',
                target: { kind: 'preview', previewId: 'test' },
            })
        ).resolves.toBe(join(plans, 'example_story.json'));
    });

    it('surfaces a broken preview-plan symlink as a load error instead of silently falling back', async () => {
        // A self-referential symlink makes readFile fail with ELOOP. lstat
        // succeeds (the directory entry exists), so resolveReleasePlanPath
        // returns the preview path; loadReleasePlan then reports the
        // unreadable target. The resolver must NOT silently switch to the
        // production plan, which would publish under a different
        // classification than the operator intended.
        const root = await mkdtemp(join(tmpdir(), 'plans-'));
        const plans = join(root, 'packages/stories/release-plans');
        await mkdir(plans, { recursive: true });
        await writeFile(
            join(plans, 'example_story.json'),
            JSON.stringify({ schemaVersion: 1 })
        );
        const previewPath = join(plans, 'example_story.preview.json');
        await symlink('example_story.preview.json', previewPath);

        const resolved = await resolveReleasePlanPath({
            repositoryRoot: root,
            storyId: 'example_story',
            target: { kind: 'preview', previewId: 'test' },
        });
        expect(resolved).toBe(previewPath);
        await expect(loadReleasePlan(resolved)).rejects.toSatisfy(
            (error: unknown) => {
                expect(error).toBeInstanceOf(PublisherError);
                expect((error as PublisherError).code).toBe('input');
                // The failing path must not leak into the sanitized context.
                expect(
                    JSON.stringify((error as PublisherError).context)
                ).not.toContain(previewPath);
                return true;
            }
        );
    });

    it('surfaces a dangling preview-plan symlink as a load error instead of falling back', async () => {
        // A symlink to a missing target: lstat succeeds (entry exists), but
        // readFile follows the symlink and gets ENOENT. The resolver returns
        // the preview path; loadReleasePlan reports the unreadable target.
        const root = await mkdtemp(join(tmpdir(), 'plans-dangling-'));
        const plans = join(root, 'packages/stories/release-plans');
        await mkdir(plans, { recursive: true });
        await writeFile(
            join(plans, 'example_story.json'),
            JSON.stringify({ schemaVersion: 1 })
        );
        const previewPath = join(plans, 'example_story.preview.json');
        await symlink('does-not-exist.json', previewPath);

        const resolved = await resolveReleasePlanPath({
            repositoryRoot: root,
            storyId: 'example_story',
            target: { kind: 'preview', previewId: 'test' },
        });
        expect(resolved).toBe(previewPath);
        await expect(loadReleasePlan(resolved)).rejects.toSatisfy(
            (error: unknown) => {
                expect(error).toBeInstanceOf(PublisherError);
                expect((error as PublisherError).code).toBe('input');
                expect(
                    JSON.stringify((error as PublisherError).context)
                ).not.toContain(previewPath);
                return true;
            }
        );
    });
});
