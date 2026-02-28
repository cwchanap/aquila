import { describe, it, expect, vi } from 'vitest';
import { isEscListenerHost } from '../types';
import { MockScene } from './phaserMock';

describe('isEscListenerHost', () => {
    it('returns false for a plain MockScene (no esc methods)', () => {
        const scene = new MockScene('test');
        expect(isEscListenerHost(scene as any)).toBe(false);
    });

    it('returns false when only pauseEscListener is present', () => {
        const scene = new MockScene('test');
        (scene as any).pauseEscListener = vi.fn();
        expect(isEscListenerHost(scene as any)).toBe(false);
    });

    it('returns false when only resumeEscListener is present', () => {
        const scene = new MockScene('test');
        (scene as any).resumeEscListener = vi.fn();
        expect(isEscListenerHost(scene as any)).toBe(false);
    });

    it('returns true when both esc methods are functions', () => {
        const scene = new MockScene('test');
        (scene as any).pauseEscListener = vi.fn();
        (scene as any).resumeEscListener = vi.fn();
        expect(isEscListenerHost(scene as any)).toBe(true);
    });

    it('returns false when methods exist but are not functions', () => {
        const scene = new MockScene('test');
        (scene as any).pauseEscListener = 'not a function';
        (scene as any).resumeEscListener = 'not a function';
        expect(isEscListenerHost(scene as any)).toBe(false);
    });
});
