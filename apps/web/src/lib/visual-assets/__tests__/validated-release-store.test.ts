import { describe, expect, it } from 'vitest';
import {
    VALIDATED_RELEASES_KEY,
    ValidatedReleaseStore,
} from '../validated-release-store';

describe('ValidatedReleaseStore', () => {
    it('degrades to memory-only when localStorage throws', () => {
        const storage = {
            getItem: () => {
                throw new DOMException('blocked', 'SecurityError');
            },
            setItem: () => {
                throw new DOMException('full', 'QuotaExceededError');
            },
            removeItem: () => {
                throw new DOMException('blocked', 'SecurityError');
            },
        } as unknown as Storage;
        const store = new ValidatedReleaseStore(storage);

        expect(store.loadRaw()).toEqual([]);
        expect(store.replace([])).toBe(false);
        expect(() => store.clear()).not.toThrow();
    });

    it('loads arrays and replaces them under the validated releases key', () => {
        let stored: string | null = JSON.stringify([{ releaseId: 'r1' }]);
        const storage = {
            getItem: (key: string) =>
                key === VALIDATED_RELEASES_KEY ? stored : null,
            setItem: (key: string, value: string) => {
                if (key === VALIDATED_RELEASES_KEY) stored = value;
            },
            removeItem: (key: string) => {
                if (key === VALIDATED_RELEASES_KEY) stored = null;
            },
        } as unknown as Storage;
        const store = new ValidatedReleaseStore(storage);

        expect(store.loadRaw()).toEqual([{ releaseId: 'r1' }]);
        expect(store.replace([{ releaseId: 'r2' }])).toBe(true);
        expect(store.loadRaw()).toEqual([{ releaseId: 'r2' }]);
        store.clear();
        expect(store.loadRaw()).toEqual([]);
    });
});
