import { describe, it, expect } from 'vitest';
import type { DialogueEntry } from '../types';

describe('DialogueEntry', () => {
    it('accepts optional background and portrait asset keys', () => {
        const entry: DialogueEntry = {
            dialogue: 'hello',
            background: '_root/act1_s0',
            portrait: 'li_jie/angry',
        };
        expect(entry.background).toBe('_root/act1_s0');
        expect(entry.portrait).toBe('li_jie/angry');
    });

    it('works without background and portrait (backward compatible)', () => {
        const entry: DialogueEntry = { dialogue: 'hello' };
        expect(entry.background).toBeUndefined();
        expect(entry.portrait).toBeUndefined();
    });
});
