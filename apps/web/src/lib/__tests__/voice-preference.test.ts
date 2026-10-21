import { describe, expect, it, vi } from 'vitest';
import {
    VOICE_ENABLED_KEY,
    readVoiceEnabled,
    writeVoiceEnabled,
} from '@/lib/audio/voice-preference';

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

describe('Voice preference persistence', () => {
    it('defaults an absent value to enabled', () => {
        const storage = storageWith(vi.fn(() => null));

        expect(readVoiceEnabled(storage)).toBe(true);
    });

    it('treats stored false as disabled', () => {
        const storage = storageWith(vi.fn(() => 'false'));

        expect(readVoiceEnabled(storage)).toBe(false);
    });

    it('treats stored true as enabled', () => {
        const storage = storageWith(vi.fn(() => 'true'));

        expect(readVoiceEnabled(storage)).toBe(true);
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

        writeVoiceEnabled(true, storage);
        writeVoiceEnabled(false, storage);

        expect(setItem).toHaveBeenNthCalledWith(1, VOICE_ENABLED_KEY, 'true');
        expect(setItem).toHaveBeenNthCalledWith(2, VOICE_ENABLED_KEY, 'false');
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

        expect(readVoiceEnabled(storage)).toBe(true);
        expect(() => writeVoiceEnabled(false, storage)).not.toThrow();
    });
});
