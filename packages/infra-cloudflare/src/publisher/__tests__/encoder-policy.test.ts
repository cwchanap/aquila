import { describe, expect, it } from 'vitest';
import {
    aggregateDiagnostics,
    evaluateSourceDiagnostics,
    sourceAspectDiagnostic,
    sourceMinimumDiagnostic,
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

describe('source minimum-dimension diagnostics', () => {
    it('does not warn when both dimensions meet the background minimum', () => {
        expect(
            sourceMinimumDiagnostic('background', 1600, 900)
        ).toBeUndefined();
    });

    it('warns when the background width is below the minimum', () => {
        const warning = sourceMinimumDiagnostic('background', 1500, 900);
        expect(warning?.code).toBe('source/minimum-dimension');
        expect(warning?.assetType).toBe('background');
    });

    it('warns when the portrait height is below the minimum', () => {
        expect(sourceMinimumDiagnostic('portrait', 900, 1100)?.code).toBe(
            'source/minimum-dimension'
        );
    });

    it('emits both aspect and minimum diagnostics when both apply', () => {
        // 1500×1000 background: aspect 1.5 vs preferred 1.778 (mismatch) and
        // width 1500 < minimum 1600. Both diagnostics are independent and must
        // both surface.
        const diagnostics = evaluateSourceDiagnostics({
            identity: { type: 'background', key: 'chapter_1/bg' },
            sourcePath: 'example/backgrounds/chapter_1/bg.png',
            metadata: { width: 1500, height: 1000 },
        });
        expect(diagnostics.map(d => d.code).sort()).toEqual([
            'source/aspect-ratio',
            'source/minimum-dimension',
        ]);
    });

    it('emits only the minimum diagnostic for an undersized but correct-aspect background', () => {
        // 1500×844 is 16:9 (correct aspect) but below the 1600×900 minimum.
        const diagnostics = evaluateSourceDiagnostics({
            identity: { type: 'background', key: 'chapter_1/bg' },
            sourcePath: 'example/backgrounds/chapter_1/bg.png',
            metadata: { width: 1500, height: 844 },
        });
        expect(diagnostics.map(d => d.code)).toEqual([
            'source/minimum-dimension',
        ]);
    });
});
