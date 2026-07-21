import { describe, expect, it, vi } from 'vitest';
import type { StoryFlowConfig, StoryLoaderResult } from '../../stories';
import { StoryLoadError } from '../errors';
import { createStoryContentLoader } from '../loader';

const flow = { start: 'act1', nodes: [] } as StoryFlowConfig;
const payload: StoryLoaderResult = {
    dialogue: { act1: [{ dialogue: 'line' }] },
    choices: {},
};
const importer = vi.fn(async () => ({ ...payload, flow }));

describe('createStoryContentLoader', () => {
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
