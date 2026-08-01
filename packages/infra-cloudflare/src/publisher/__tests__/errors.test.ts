import { describe, expect, it } from 'vitest';
import { PublisherError, publisherExitCode } from '../errors';

describe('publisherExitCode', () => {
    it.each([
        ['configuration', 1],
        ['coverage', 2],
        ['storage', 3],
        ['concurrency', 4],
        ['activation-target', 5],
        ['clock-skew', 5],
        ['non-monotonic-pointer-time', 5],
    ] as const)('%s maps to %d', (code, expected) => {
        expect(publisherExitCode(new PublisherError(code, 'failure'))).toBe(
            expected
        );
    });
});
