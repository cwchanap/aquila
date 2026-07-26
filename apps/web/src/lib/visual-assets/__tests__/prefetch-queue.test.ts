import { describe, expect, it } from 'vitest';
import { PrefetchQueue } from '../prefetch-queue';

describe('PrefetchQueue', () => {
    it('runs at most two queued requests concurrently', async () => {
        const queue = new PrefetchQueue(2);
        let active = 0;
        let peak = 0;
        const releases: Array<() => void> = [];
        const work = async () => {
            active += 1;
            peak = Math.max(peak, active);
            await new Promise<void>(resolve => releases.push(resolve));
            active -= 1;
        };

        const requests = [queue.run(work), queue.run(work), queue.run(work)];
        await Promise.resolve();

        expect(active).toBe(2);
        releases.shift()?.();
        for (let index = 0; index < 5; index += 1) {
            await Promise.resolve();
        }
        expect(active).toBe(2);
        releases.splice(0).forEach(release => release());
        await Promise.all(requests);
        expect(peak).toBe(2);
    });

    it('starts the next request after a failed request releases its slot', async () => {
        const queue = new PrefetchQueue(1);
        let releaseFirst!: () => void;
        let secondStarted = false;
        const first = queue.run(async () => {
            await new Promise<void>(resolve => {
                releaseFirst = resolve;
            });
            throw new Error('prefetch failed');
        });
        const second = queue.run(async () => {
            secondStarted = true;
        });

        await Promise.resolve();
        expect(secondStarted).toBe(false);
        releaseFirst();
        await expect(first).rejects.toThrow('prefetch failed');
        await second;
        expect(secondStarted).toBe(true);
    });

    it('hands a released permit to its waiter before a newly arriving request', async () => {
        const queue = new PrefetchQueue(2);
        const gates = Array.from({ length: 4 }, () => {
            let resolve!: () => void;
            const promise = new Promise<void>(resolvePromise => {
                resolve = resolvePromise;
            });
            return { promise, resolve };
        });
        let active = 0;
        let peak = 0;
        const work = (index: number) => () => {
            active += 1;
            peak = Math.max(peak, active);
            return gates[index].promise;
        };
        const release = (index: number) => {
            active -= 1;
            gates[index].resolve();
        };

        const first = queue.run(work(0));
        const second = queue.run(work(1));
        const waiting = queue.run(work(2));
        await Promise.resolve();
        expect(active).toBe(2);

        release(0);
        let arriving!: Promise<void>;
        queueMicrotask(() => {
            arriving = queue.run(work(3));
        });
        for (let index = 0; index < 5; index += 1) {
            await Promise.resolve();
        }

        expect(peak).toBe(2);
        [1, 2].forEach(release);
        for (let index = 0; index < 5; index += 1) {
            await Promise.resolve();
        }
        release(3);
        await Promise.all([first, second, waiting, arriving]);
        expect(active).toBe(0);
    });
});
