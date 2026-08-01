import { describe, expect, it } from 'vitest';
import { validatePublisherCoverage } from '../coverage';

describe('validatePublisherCoverage', () => {
    it('reports a byte-for-byte source-path mismatch separately', () => {
        expect(() =>
            validatePublisherCoverage({
                catalog: {
                    storyId: 'example_story',
                    assets: [
                        {
                            identity: {
                                type: 'background',
                                key: 'chapter_1/bg',
                            },
                            sourcePath: 'A/bg.png',
                        },
                    ],
                },
                plan: {
                    schemaVersion: 1,
                    storyId: 'example_story',
                    channel: 'production',
                    entries: [
                        {
                            identity: {
                                type: 'background',
                                key: 'chapter_1/bg',
                            },
                            disposition: 'included',
                            sourcePath: 'a/bg.png',
                        },
                    ],
                },
                target: { kind: 'production' },
                availableSourcePaths: new Set(['a/bg.png']),
            })
        ).toThrow(/source-path-mismatch/i);
    });

    it('rejects a preview-channel plan for a production target', () => {
        expect(() =>
            validatePublisherCoverage({
                catalog: { storyId: 'example_story', assets: [] },
                plan: {
                    schemaVersion: 1,
                    storyId: 'example_story',
                    channel: 'preview',
                    entries: [],
                },
                target: { kind: 'production' },
                availableSourcePaths: new Set(),
            })
        ).toThrow();
    });
});
