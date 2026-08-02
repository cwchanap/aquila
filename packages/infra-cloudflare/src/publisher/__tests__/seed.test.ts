import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { loadReleasePlan } from '../release-plan';

const seedPath = fileURLToPath(new URL('../../seed.ts', import.meta.url));
const fixturePath = fileURLToPath(
    new URL('../__fixtures__/smoke-release-plan.v1.json', import.meta.url)
);

describe('smoke release publisher fixture', () => {
    it('publishes and activates the fixed preview fixture through the callable CLI', async () => {
        const seedModule = await import('../../seed');
        const runPublisher = vi.fn(async () => 0);

        expect(seedModule).toHaveProperty('runSmokeSeed');
        await seedModule.runSmokeSeed(runPublisher);

        expect(runPublisher).toHaveBeenCalledOnce();
        expect(runPublisher).toHaveBeenCalledWith([
            'publish',
            '--story',
            'the_seventh_mirror',
            '--environment',
            'preview',
            '--preview-id',
            'smoke',
            '--plan',
            fixturePath,
            '--source-root',
            'packages/assets/media',
            '--destination',
            'r2',
        ]);
    });

    it('is a prompt-free reviewed preview plan with the exact smoke assets', async () => {
        const fixtureText = await readFile(fixturePath, 'utf8');
        const plan = await loadReleasePlan(fixturePath);

        expect(fixtureText).not.toMatch(/prompt|provider|credential/i);
        expect(plan).toEqual({
            schemaVersion: 1,
            storyId: 'the_seventh_mirror',
            channel: 'preview',
            entries: [
                {
                    identity: {
                        type: 'background',
                        key: 'chapter_1/ch1_act2_s0',
                    },
                    disposition: 'included',
                    sourcePath:
                        'the_seventh_mirror/backgrounds/chapter_1/ch1_act2_s0.png',
                    section: 'chapter_1',
                },
                {
                    identity: {
                        type: 'portrait',
                        key: 'asakura_mio/base',
                    },
                    disposition: 'included',
                    sourcePath:
                        'the_seventh_mirror/characters/asakura_mio/base.png',
                    section: 'chapter_1',
                },
            ],
        });
    });

    it('contains no duplicate publisher pipeline responsibilities', async () => {
        const source = await readFile(seedPath, 'utf8');

        expect(source).not.toMatch(
            /\b(?:sharp|S3Client|PutObjectCommand|createHash|sha256|canonicalReleaseContent|RuntimeAssetManifest|ActiveReleasePointer|parseRuntimeAssetManifest|parseActiveReleasePointer|getObjectPath|getReleaseManifestPath|getCurrentPointerPath|releaseIdFromContentSha256|mkdtemp|writeFile)\b/
        );
    });
});
