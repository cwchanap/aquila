import { describe, expect, it } from 'vitest';
import {
    aggregateDiagnostics,
    sourceAspectDiagnostic,
} from '../encoder-policy';

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
});
