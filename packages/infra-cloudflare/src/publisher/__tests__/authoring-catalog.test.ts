import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    discoverAuthoringCatalog,
    reduceAuthoringManifest,
} from '../authoring-catalog';
import { PublisherError } from '../errors';

describe('reduceAuthoringManifest', () => {
    it('normalizes generated logical keys before catalog construction', () => {
        const result = reduceAuthoringManifest({
            storyId: 'example_story',
            backgrounds: [
                {
                    key: 'chapter_1/cafe\u0301',
                    path: 'example/background.png',
                    prompt: 'private prompt',
                },
            ],
            portraits: [],
        });

        expect(result.assets[0].identity.key).toBe('chapter_1/café');
        expect(result.assets[0]).not.toHaveProperty('prompt');
    });

    it('rejects identities that collide after NFC normalization', () => {
        expect(() =>
            reduceAuthoringManifest({
                storyId: 'example_story',
                backgrounds: [
                    { key: 'chapter_1/café', path: 'a.png', prompt: 'a' },
                    {
                        key: 'chapter_1/cafe\u0301',
                        path: 'b.png',
                        prompt: 'b',
                    },
                ],
                portraits: [],
            })
        ).toThrow(/duplicate.*normalization/i);
    });

    it('preserves generated sourcePath byte-for-byte', () => {
        const result = reduceAuthoringManifest({
            storyId: 'example_story',
            backgrounds: [
                {
                    key: 'chapter_1/bg',
                    path: 'Example/Background.PNG',
                    prompt: 'private',
                },
            ],
            portraits: [],
        });

        expect(result.assets[0].sourcePath).toBe('Example/Background.PNG');
    });

    it('rejects unsafe generated source paths', () => {
        expect(() =>
            reduceAuthoringManifest({
                storyId: 'example_story',
                backgrounds: [
                    {
                        key: 'chapter_1/bg',
                        path: '/private/source.png',
                    },
                ],
                portraits: [],
            })
        ).toThrow(/source path is unsafe/i);
    });
});

describe('discoverAuthoringCatalog', () => {
    it('selects by embedded storyId rather than generated directory casing', async () => {
        const root = await mkdtemp(join(tmpdir(), 'catalog-'));
        const generated = join(
            root,
            'packages/stories/src/generated/theSeventhMirror'
        );
        await mkdir(generated, { recursive: true });
        await writeFile(
            join(generated, 'image-assets.json'),
            JSON.stringify({
                storyId: 'the_seventh_mirror',
                backgrounds: [],
                portraits: [],
            })
        );

        await expect(
            discoverAuthoringCatalog(root, 'the_seventh_mirror')
        ).resolves.toMatchObject({ storyId: 'the_seventh_mirror' });
    });

    it('does not expose an absolute candidate path in discovery errors', async () => {
        const root = await mkdtemp(join(tmpdir(), 'catalog-private-'));
        const generated = join(
            root,
            'packages/stories/src/generated/exampleStory'
        );
        await mkdir(generated, { recursive: true });
        await writeFile(
            join(generated, 'image-assets.json'),
            JSON.stringify({
                storyId: 'example_story',
                backgrounds: 'not-an-array',
                portraits: [],
            })
        );

        await expect(
            discoverAuthoringCatalog(root, 'example_story')
        ).rejects.toSatisfy((error: unknown) => {
            expect(error).toBeInstanceOf(PublisherError);
            expect(
                JSON.stringify((error as PublisherError).context)
            ).not.toContain(root);
            return true;
        });
    });

    it('ignores malformed manifests from unrelated story directories', async () => {
        const root = await mkdtemp(join(tmpdir(), 'catalog-tolerant-'));
        const unrelated = join(
            root,
            'packages/stories/src/generated/unrelatedStory'
        );
        const requested = join(
            root,
            'packages/stories/src/generated/theSeventhMirror'
        );
        await mkdir(unrelated, { recursive: true });
        await mkdir(requested, { recursive: true });
        await writeFile(join(unrelated, 'image-assets.json'), '{');
        await writeFile(
            join(requested, 'image-assets.json'),
            JSON.stringify({
                storyId: 'the_seventh_mirror',
                backgrounds: [],
                portraits: [],
            })
        );

        await expect(
            discoverAuthoringCatalog(root, 'the_seventh_mirror')
        ).resolves.toMatchObject({ storyId: 'the_seventh_mirror' });
    });

    it('rejects when no generated manifest matches the requested story', async () => {
        const root = await mkdtemp(join(tmpdir(), 'catalog-zero-'));
        const unrelated = join(
            root,
            'packages/stories/src/generated/unrelatedStory'
        );
        await mkdir(unrelated, { recursive: true });
        await writeFile(
            join(unrelated, 'image-assets.json'),
            JSON.stringify({
                storyId: 'unrelated_story',
                backgrounds: [],
                portraits: [],
            })
        );

        await expect(
            discoverAuthoringCatalog(root, 'the_seventh_mirror')
        ).rejects.toThrow(/exactly one/i);
    });

    it('rejects when multiple generated manifests match the requested story', async () => {
        const root = await mkdtemp(join(tmpdir(), 'catalog-multiple-'));
        for (const directory of ['firstStory', 'secondStory']) {
            const generated = join(
                root,
                'packages/stories/src/generated',
                directory
            );
            await mkdir(generated, { recursive: true });
            await writeFile(
                join(generated, 'image-assets.json'),
                JSON.stringify({
                    storyId: 'the_seventh_mirror',
                    backgrounds: [],
                    portraits: [],
                })
            );
        }

        await expect(
            discoverAuthoringCatalog(root, 'the_seventh_mirror')
        ).rejects.toThrow(/exactly one/i);
    });
});
