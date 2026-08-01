import { describe, expect, it } from 'vitest';
import {
    aggregateDiagnostics,
    evaluateSourceDiagnostics,
    sourceAspectDiagnostic,
} from '../encoder-policy';
import { PublisherError } from '../errors';

describe('source aspect diagnostics', () => {
    it('does not warn for 1672×941', () => {
        expect(sourceAspectDiagnostic('background', 1672, 941)).toBeUndefined();
    });

    it('warns above 0.5 percent and aggregates deterministically', () => {
        const warning = sourceAspectDiagnostic('background', 1400, 900);
        expect(warning?.code).toBe('source/aspect-ratio');
        expect(
            aggregateDiagnostics([
                { ...warning!, identity: 'background:b' },
                { ...warning!, identity: 'background:a' },
            ])[0]
        ).toMatchObject({
            count: 2,
            sampleIdentities: ['background:a', 'background:b'],
        });
    });

    it('aggregates equivalent warnings across distinct safe paths', () => {
        const warning = sourceAspectDiagnostic('background', 1400, 900)!;

        expect(
            aggregateDiagnostics([
                { ...warning, identity: 'background:b', safePath: 'b.png' },
                { ...warning, identity: 'background:a', safePath: 'a.png' },
            ])
        ).toEqual([
            expect.objectContaining({
                count: 2,
                sampleIdentities: ['background:a', 'background:b'],
                sampleSafePaths: ['a.png', 'b.png'],
            }),
        ]);
    });

    it('rejects an unsafe source path before creating diagnostics', () => {
        expect(() =>
            evaluateSourceDiagnostics({
                identity: { type: 'background', key: 'chapter_1/bg' },
                sourcePath: '../private.png',
                metadata: { width: 1400, height: 900 },
            })
        ).toThrow(PublisherError);
    });
});
