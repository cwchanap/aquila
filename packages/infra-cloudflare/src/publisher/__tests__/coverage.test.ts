import { describe, expect, it } from 'vitest';
import {
    validatePublisherCoverage,
    type ValidatePublisherCoverageOptions,
} from '../coverage';
import { PublisherError } from '../errors';

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

    it('classifies a catalog/plan story mismatch as a coverage failure', () => {
        // validateReleaseCoverage throws AssetResolverError('story-mismatch')
        // when the authoring catalog and release plan disagree on storyId.
        // Without reclassification this escapes as a raw error and the CLI
        // reports exit code 3 (storage) instead of the deterministic
        // input/coverage exit code 2.
        const mismatched: ValidatePublisherCoverageOptions = {
            catalog: { storyId: 'example_story', assets: [] },
            plan: {
                schemaVersion: 1,
                storyId: 'dont_save_me_before_midnight',
                channel: 'production',
                entries: [],
            },
            target: { kind: 'production' },
            availableSourcePaths: new Set<string>(),
        };

        expect(() => validatePublisherCoverage(mismatched)).toThrow(
            PublisherError
        );
        try {
            validatePublisherCoverage(mismatched);
            throw new Error('expected validatePublisherCoverage to throw');
        } catch (error) {
            expect(error).toBeInstanceOf(PublisherError);
            const publisherError = error as PublisherError;
            expect(publisherError.code).toBe('coverage');
            expect(publisherError.message).toBe('coverage/story-mismatch');
            expect(publisherError.context.diagnostic).toBe(
                'coverage/story-mismatch'
            );
        }
    });
});
