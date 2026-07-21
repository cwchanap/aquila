import { describe, expect, it, vi } from 'vitest';
import type { StoryFlowConfig, StoryLoaderResult } from '../../stories';
import { StoryLoadError } from '../errors';
import { createStoryContentLoader } from '../loader';
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
