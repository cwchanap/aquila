import { describe, expect, it, vi } from 'vitest';
import {
    BGM_ENABLED_KEY,
    readBgmEnabled,
    writeBgmEnabled,
} from '@/lib/audio/bgm-preference';

function storageWith(getItem: Storage['getItem']): Storage {
    return {
        getItem,
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
    } as unknown as Storage;
}

describe('BGM preference persistence', () => {
    it('defaults an absent value to enabled', () => {
        const emptyStorage = storageWith(vi.fn(() => null));

        expect(readBgmEnabled(emptyStorage)).toBe(true);
    });

    it('treats stored false as disabled', () => {
        const storage = storageWith(vi.fn(() => 'false'));

        expect(readBgmEnabled(storage)).toBe(false);
    });

    it('treats stored true as enabled', () => {
        const storage = storageWith(vi.fn(() => 'true'));

        expect(readBgmEnabled(storage)).toBe(true);
    });

    it('returns enabled when storage is unavailable', () => {
        expect(readBgmEnabled(null)).toBe(true);
    });

    it('writes true and false values', () => {
        const setItem = vi.fn();
        const storage = {
            getItem: vi.fn(),
            setItem,
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        } as unknown as Storage;

        writeBgmEnabled(true, storage);
        writeBgmEnabled(false, storage);

        expect(setItem).toHaveBeenNthCalledWith(1, BGM_ENABLED_KEY, 'true');
        expect(setItem).toHaveBeenNthCalledWith(2, BGM_ENABLED_KEY, 'false');
    });

    it('does not escape throwing storage reads or writes', () => {
        const storage = {
            getItem: () => {
                throw new Error('read denied');
            },
            setItem: () => {
                throw new Error('write denied');
            },
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        } as unknown as Storage;

        expect(readBgmEnabled(storage)).toBe(true);
        expect(() => writeBgmEnabled(false, storage)).not.toThrow();
    });
});
