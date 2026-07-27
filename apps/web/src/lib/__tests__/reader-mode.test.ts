// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
    READER_MODE_KEY,
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
});
