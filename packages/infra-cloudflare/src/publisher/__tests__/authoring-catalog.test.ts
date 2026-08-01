import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    discoverAuthoringCatalog,
    reduceAuthoringManifest,
} from '../authoring-catalog';

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
});
