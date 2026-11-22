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

    it('rethrows the first failure', async () => {
        await expect(
            mapConcurrent([0, 1, 2], 1, async value => {
                if (value === 1) throw new Error('boom');
                return value;
            })
        ).rejects.toThrow('boom');
    });

    it('lets running calls settle, starts nothing new and keeps the first error', async () => {
        const started: number[] = [];
        let releaseSlow: () => void = () => {};
        const slowDone = new Promise<void>(resolve => {
            releaseSlow = resolve;
        });
        let settled = false;
        const run = mapConcurrent([0, 1, 2, 3], 2, async value => {
            started.push(value);
            if (value === 0) {
                await slowDone;
                throw new Error('late');
            }
            throw new Error('boom');
        }).catch((error: unknown) => {
            settled = true;
            return error;
        });
        await tick();
        await tick();
        // Item 1 failed while item 0 is still running: still pending.
        expect(settled).toBe(false);
        releaseSlow();
        expect(await run).toEqual(new Error('boom'));
        expect(started).toEqual([0, 1]);
    });
});
