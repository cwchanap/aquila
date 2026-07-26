import { describe, expect, it } from 'vitest';
import { verifyVisualFixtures } from '../../../../scripts/verify-visual-fixtures';

describe('checked-in visual fixtures', () => {
    it('match source coverage and every content address', async () => {
        await expect(verifyVisualFixtures()).resolves.toBeUndefined();
    });
});
