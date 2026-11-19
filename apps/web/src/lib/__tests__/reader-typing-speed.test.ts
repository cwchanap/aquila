import { describe, expect, it, vi } from 'vitest';
import {
    readTypingSpeed,
    writeTypingSpeed,
    resolveTypingDelay,
} from '@/lib/reader-typing-speed';

describe('reader typing speed', () => {
    it('resolves unset and explicit choices independently of reduced motion', () => {
        expect(resolveTypingDelay(null, false)).toBe(10);
        expect(resolveTypingDelay(null, true)).toBe(0);
        expect(resolveTypingDelay('instant', false)).toBe(0);
        expect(resolveTypingDelay('fast', true)).toBe(10);
        expect(resolveTypingDelay('normal', true)).toBe(30);
    });

    it('persists valid choices locally and treats bad or unavailable storage as unset', () => {
        const store = new Map<string, string>();
        const storage = {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => store.set(key, value),
        } as Storage;
        expect(readTypingSpeed(storage)).toBeNull();
        writeTypingSpeed('normal', storage);
        expect(readTypingSpeed(storage)).toBe('normal');
        writeTypingSpeed('fast', storage);
        expect(readTypingSpeed(storage)).toBe('fast');
        store.set('aquila:reader-typing-speed:v1', 'invalid');
        expect(readTypingSpeed(storage)).toBeNull();
        const broken = {
            getItem: vi.fn(() => {
                throw Error();
            }),
            setItem: vi.fn(() => {
                throw Error();
            }),
        } as unknown as Storage;
        expect(readTypingSpeed(broken)).toBeNull();
        expect(() => writeTypingSpeed('instant', broken)).not.toThrow();
    });
});
