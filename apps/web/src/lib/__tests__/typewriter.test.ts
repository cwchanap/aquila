import { describe, it, expect, vi } from 'vitest';
import { typeText } from '@/lib/typewriter';

describe('typeText', () => {
    it('emits incremental partials and resolves done', async () => {
        const ticks: string[] = [];
        const promise = typeText({
            text: 'abc',
            speed: 10,
            onTick: p => ticks.push(p),
            isSkipped: () => false,
            isCancelled: () => false,
        });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBe('done');
        expect(ticks).toEqual(['a', 'ab', 'abc']);
    });

    it('reveals full text immediately when skipped', async () => {
        const ticks: string[] = [];
        const promise = typeText({
            text: 'hello',
            speed: 10,
            onTick: p => ticks.push(p),
            isSkipped: () => true,
            isCancelled: () => false,
        });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBe('done');
        expect(ticks).toEqual(['hello']);
    });

    it('returns cancelled when isCancelled becomes true', async () => {
        const ticks: string[] = [];
        let cancelled = false;
        const promise = typeText({
            text: 'abcdef',
            speed: 10,
            onTick: p => {
                ticks.push(p);
                if (ticks.length === 2) cancelled = true;
            },
            isSkipped: () => false,
            isCancelled: () => cancelled,
        });
        await vi.runAllTimersAsync();
        await expect(promise).resolves.toBe('cancelled');
        expect(ticks.length).toBeLessThan(6);
    });
});
