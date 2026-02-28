import { describe, it, expect, vi } from 'vitest';
import { isEscListenerHost } from '../types';
import { MockScene } from './phaserMock';

describe('isEscListenerHost', () => {
    const testCases: [
        string,
        (() => void) | undefined,
        (() => void) | undefined,
        boolean,
    ][] = [
        ['no esc methods', undefined, undefined, false],
        ['only pauseEscListener', vi.fn(), undefined, false],
        ['only resumeEscListener', undefined, vi.fn(), false],
        ['both esc methods as functions', vi.fn(), vi.fn(), true],
        [
            'methods exist but not functions',
            'not a function' as any,
            'not a function' as any,
            false,
        ],
    ];

    it.each(testCases)(
        'returns %s when pauseEscListener=%p and resumeEscListener=%p',
        (_description, pauseValue, resumeValue, expected) => {
            const scene = new MockScene('test');
            if (pauseValue !== undefined) {
                (scene as any).pauseEscListener = pauseValue;
            }
            if (resumeValue !== undefined) {
                (scene as any).resumeEscListener = resumeValue;
            }
            expect(isEscListenerHost(scene as any)).toBe(expected);
        }
    );
});
