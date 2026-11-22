import { describe, expect, it } from 'vitest';
import { mapConcurrent } from '../map-concurrent';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 1));

describe('mapConcurrent', () => {
    it('keeps input order and never exceeds the limit', async () => {
        let running = 0;
        let peak = 0;
        const result = await mapConcurrent(
            [5, 1, 4, 2, 3, 6, 7],
            3,
            async (value, index) => {
                running += 1;
                peak = Math.max(peak, running);
                // Later items finish first, so order must come from the index.
                for (let i = 0; i < 7 - value; i += 1) await tick();
                running -= 1;
                return `${index}:${value}`;
            }
        );
        expect(result).toEqual([
            '0:5',
            '1:1',
            '2:4',
            '3:2',
            '4:3',
            '5:6',
            '6:7',
        ]);
        expect(peak).toBe(3);
    });

    it('returns an empty list without calling the mapper', async () => {
        const result = await mapConcurrent([], 4, async () => {
            throw new Error('unexpected call');
        });
        expect(result).toEqual([]);
    });

    it('rethrows the first failure and starts no further items', async () => {
        const started: number[] = [];
        await expect(
            mapConcurrent([0, 1, 2, 3, 4, 5], 2, async value => {
                started.push(value);
                await tick();
                if (value === 1) throw new Error('boom');
                return value;
            })
        ).rejects.toThrow('boom');
        expect(started.length).toBeLessThan(6);
    });
});
