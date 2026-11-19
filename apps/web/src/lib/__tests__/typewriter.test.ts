import { describe, it, expect, vi } from 'vitest';
import { typeText } from '@/lib/typewriter';

describe('typeText', () => {
    it('emits incremental partials and resolves done', async () => {
        const ticks: string[] = [];
        const promise = typeText({
            text: 'abc',
            delay: () => 10,
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
            delay: () => 10,
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
            delay: () => 10,
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

    it('uses the current delay on each tick and reveals instantly after a change to zero', async () => {
        let delay = 30;
        const ticks: string[] = [];
        const promise = typeText({
            text: 'abcdef',
            delay: () => delay,
            onTick: p => ticks.push(p),
            isSkipped: () => false,
            isCancelled: () => false,
        });
        expect(ticks).toEqual(['a']);
        delay = 10;
        await vi.advanceTimersByTimeAsync(30);
        expect(ticks).toEqual(['a', 'ab']);
        await vi.advanceTimersByTimeAsync(9);
        expect(ticks).toEqual(['a', 'ab']);
        delay = 0;
        await vi.advanceTimersByTimeAsync(1);
        await expect(promise).resolves.toBe('done');
        expect(ticks).toEqual(['a', 'ab', 'abcdef']);
    });

    it('does not start a timer for instant text or reveal cancelled text', async () => {
        const onTick = vi.fn();
        await expect(
            typeText({
                text: 'abc',
                delay: () => 0,
                onTick,
                isSkipped: () => false,
                isCancelled: () => false,
            })
        ).resolves.toBe('done');
        expect(onTick).toHaveBeenCalledExactlyOnceWith('abc');
        expect(vi.getTimerCount()).toBe(0);
        onTick.mockClear();
        await expect(
            typeText({
                text: 'abc',
                delay: () => 0,
                onTick,
                isSkipped: () => true,
                isCancelled: () => true,
            })
        ).resolves.toBe('cancelled');
        expect(onTick).not.toHaveBeenCalled();
    });
});
