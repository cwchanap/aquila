// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    READER_MODE_KEY,
    getBrowserStorage,
    readReaderMode,
    writeReaderMode,
} from '../reader-mode';

describe('reader mode persistence', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults malformed or unavailable storage to text', () => {
        localStorage.setItem(READER_MODE_KEY, 'cinema');
        expect(readReaderMode()).toBe('text');
        expect(readReaderMode(null)).toBe('text');
    });

    it('writes only explicit valid mode toggles', () => {
        writeReaderMode('visual');
        expect(localStorage.getItem(READER_MODE_KEY)).toBe('visual');
    });

    it('returns null when localStorage access throws', () => {
        const original = Object.getOwnPropertyDescriptor(
            window,
            'localStorage'
        );
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            get() {
                throw new Error('storage disabled');
            },
        });
        try {
            expect(getBrowserStorage()).toBeNull();
        } finally {
            if (original) {
                Object.defineProperty(window, 'localStorage', original);
            }
        }
    });

    it('returns text when storage.getItem throws', () => {
        const throwingStorage = {
            getItem: () => {
                throw new Error('read denied');
            },
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        } as unknown as Storage;
        expect(readReaderMode(throwingStorage)).toBe('text');
    });

    it('does not throw when storage.setItem throws', () => {
        const throwingStorage = {
            getItem: vi.fn(),
            setItem: () => {
                throw new Error('quota exceeded');
            },
            removeItem: vi.fn(),
            clear: vi.fn(),
            key: vi.fn(),
            length: 0,
        } as unknown as Storage;
        expect(() => writeReaderMode('visual', throwingStorage)).not.toThrow();
    });
});
