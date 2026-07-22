import { describe, expect, it, vi } from 'vitest';
import type { StoryFlowConfig, StoryLoaderResult } from '../../stories';
import { StoryLoadError } from '../errors';
import {
    createStoryContentLoader,
    type StoryPayload,
} from '../loader';
import {
    REGISTERED_STORY_IDS,
    isRegisteredStoryId,
    normalizeStoryLocale,
} from '..';

const flow = { start: 'act1', nodes: [] } as StoryFlowConfig;
const payload: StoryLoaderResult = {
    dialogue: { act1: [{ dialogue: 'line' }] },
    choices: {},
};
const importer = vi.fn(async () => ({ ...payload, flow }));

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });

    return { promise, resolve, reject };
}

describe('createStoryContentLoader', () => {
    it('re-exports story registry metadata for async consumers', () => {
        expect(REGISTERED_STORY_IDS).toContain('train_adventure');
        expect(isRegisteredStoryId('train_adventure')).toBe(true);
        expect(normalizeStoryLocale('EN-ca')).toBe('en');
    });

    it('deduplicates concurrent requests and caches success by normalized locale', async () => {
        const loader = createStoryContentLoader({ train_adventure: importer });
        const [a, b] = await Promise.all([
            loader.load('train_adventure', 'EN-us'),
            loader.load('train_adventure', 'en'),
        ]);

        expect(importer).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
        expect(a.locale).toBe('en');
    });

    it('isolates cached payloads for distinct stories', async () => {
        const trainImporter = vi.fn(async () => ({
            ...payload,
            dialogue: { act1: [{ dialogue: 'train' }] },
            flow,
        }));
        const midnightImporter = vi.fn(async () => ({
            ...payload,
            dialogue: { act1: [{ dialogue: 'midnight' }] },
            flow,
        }));
        const loader = createStoryContentLoader({
            train_adventure: trainImporter,
            dont_save_me_before_midnight: midnightImporter,
        });

        const train = await loader.load('train_adventure', 'en');
        const midnight = await loader.load(
            'dont_save_me_before_midnight',
            'en'
        );

        await expect(loader.load('train_adventure', 'en')).resolves.toBe(train);
        await expect(
            loader.load('dont_save_me_before_midnight', 'en')
        ).resolves.toBe(midnight);
        expect(train.dialogue.act1[0]?.dialogue).toBe('train');
        expect(midnight.dialogue.act1[0]?.dialogue).toBe('midnight');
        expect(trainImporter).toHaveBeenCalledOnce();
        expect(midnightImporter).toHaveBeenCalledOnce();
    });

    it('isolates cached payloads for English and Chinese locale keys', async () => {
        const localizedImporter = vi.fn(async locale => ({
            ...payload,
            dialogue: { act1: [{ dialogue: locale }] },
            flow,
        }));
        const loader = createStoryContentLoader({
            train_adventure: localizedImporter,
        });

        const english = await loader.load('train_adventure', 'en');
        const chinese = await loader.load('train_adventure', 'zh');

        await expect(loader.load('train_adventure', 'en')).resolves.toBe(
            english
        );
        await expect(loader.load('train_adventure', 'zh')).resolves.toBe(
            chinese
        );
        expect(english).not.toBe(chinese);
        expect(english.dialogue.act1[0]?.dialogue).toBe('en');
        expect(chinese.dialogue.act1[0]?.dialogue).toBe('zh');
        expect(localizedImporter.mock.calls).toEqual([['en'], ['zh']]);
    });

    it('removes rejected promises so application state is not poisoned', async () => {
        const retrying = vi
            .fn()
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce({ ...payload, flow });
        const loader = createStoryContentLoader({ train_adventure: retrying });

        await expect(
            loader.load('train_adventure', 'en')
        ).rejects.toMatchObject({
            code: 'load-failed',
        });
        await expect(
            loader.load('train_adventure', 'en')
        ).resolves.toMatchObject({
            locale: 'en',
        });

        expect(retrying).toHaveBeenCalledTimes(2);
    });

    it('short-circuits sequential loads on the success cache without re-invoking the importer', async () => {
        // Distinct from the concurrent-dedup test above: that test issues two
        // loads in Promise.all and asserts a single importer call. This test
        // issues two loads SEQUENTIALLY (the first fully resolves before the
        // second is issued), exercising the loadedStories.get(cacheKey)
        // short-circuit at loader.ts:56-59 rather than the inFlightLoads
        // dedup path. Both paths must return the same cached object reference.
        const importer = vi.fn(async () => ({ ...payload, flow }));
        const loader = createStoryContentLoader({ train_adventure: importer });

        const first = await loader.load('train_adventure', 'en');
        const second = await loader.load('train_adventure', 'en');

        expect(importer).toHaveBeenCalledOnce();
        expect(second).toBe(first);
    });

    it('keeps pre-reset loads from affecting the new cache generation', async () => {
        const pending: Deferred<StoryPayload>[] = [];
        const racingImporter = vi.fn(() => {
            const next = createDeferred<StoryPayload>();
            pending.push(next);
            return next.promise;
        });
        const loader = createStoryContentLoader({
            train_adventure: racingImporter,
        });
        const stalePayload: StoryPayload = {
            ...payload,
            dialogue: { act1: [{ dialogue: 'stale' }] },
            flow,
        };
        const freshPayload: StoryPayload = {
            ...payload,
            dialogue: { act1: [{ dialogue: 'fresh' }] },
            flow,
        };

        const staleLoad = loader.load('train_adventure', 'en');
        await vi.waitFor(() => expect(racingImporter).toHaveBeenCalledOnce());

        loader.reset();
        const freshLoad = loader.load('train_adventure', 'en');
        await vi.waitFor(() =>
            expect(racingImporter).toHaveBeenCalledTimes(2)
        );

        pending[0]!.resolve(stalePayload);
        await staleLoad;

        const joinedFreshLoad = loader.load('train_adventure', 'en');
        await Promise.resolve();
        expect(racingImporter).toHaveBeenCalledTimes(2);

        pending[1]!.resolve(freshPayload);
        const [freshResult, joinedFreshResult] = await Promise.all([
            freshLoad,
            joinedFreshLoad,
        ]);

        expect(joinedFreshResult).toBe(freshResult);
        expect(joinedFreshResult.dialogue.act1[0]?.dialogue).toBe('fresh');
        await expect(loader.load('train_adventure', 'en')).resolves.toBe(
            freshResult
        );
        expect(racingImporter).toHaveBeenCalledTimes(2);
    });

    it('rejects unknown stories and unsupported locales explicitly', async () => {
        const loader = createStoryContentLoader({ train_adventure: importer });

        await expect(loader.load('missing', 'en')).rejects.toEqual(
            expect.objectContaining({ code: 'unknown-story' })
        );
        await expect(loader.load('train_adventure', 'fr')).rejects.toEqual(
            expect.objectContaining({ code: 'unsupported-locale' })
        );
        expect(StoryLoadError).toBeDefined();
    });
});
