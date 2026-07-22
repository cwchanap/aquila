import type { Locale } from '../translations';
import {
    isRegisteredStoryId,
    normalizeStoryLocale,
    type RegisteredStoryId,
    type StoryLocaleInput,
} from '../story-metadata';
import type { StoryFlowConfig, StoryLoaderResult } from '../stories';
import { StoryLoadError } from './errors';

export type AsyncStoryLoaderResult = StoryLoaderResult & {
    flow: StoryFlowConfig;
    locale: Locale;
};

export type StoryPayload = StoryLoaderResult & {
    flow: StoryFlowConfig;
};

export type StoryPayloadImporter = (locale: Locale) => Promise<StoryPayload>;

export type StoryContentLoader = {
    load: (
        storyId: string,
        locale: StoryLocaleInput
    ) => Promise<AsyncStoryLoaderResult>;
    reset: () => void;
};

export function createStoryContentLoader(
    importers: Partial<Record<RegisteredStoryId, StoryPayloadImporter>>
): StoryContentLoader {
    let cacheGeneration = 0;
    const inFlightLoads = new Map<string, Promise<AsyncStoryLoaderResult>>();
    const loadedStories = new Map<string, AsyncStoryLoaderResult>();

    async function load(
        storyId: string,
        locale: StoryLocaleInput
    ): Promise<AsyncStoryLoaderResult> {
        if (!isRegisteredStoryId(storyId)) {
            throw new StoryLoadError(
                'unknown-story',
                `Unknown story: ${storyId}`
            );
        }

        const normalizedLocale = normalizeStoryLocale(locale);
        if (!normalizedLocale) {
            throw new StoryLoadError(
                'unsupported-locale',
                `Unsupported story locale: ${locale}`
            );
        }

        const cacheKey = `${storyId}:${normalizedLocale}`;
        const cachedStory = loadedStories.get(cacheKey);
        if (cachedStory) {
            return cachedStory;
        }

        const inFlightLoad = inFlightLoads.get(cacheKey);
        if (inFlightLoad) {
            return inFlightLoad;
        }

        const generation = cacheGeneration;
        const importer = importers[storyId];
        const loadPromise = Promise.resolve()
            .then(async () => {
                if (!importer) {
                    throw new Error(
                        `No importer registered for story: ${storyId}`
                    );
                }

                return importer(normalizedLocale);
            })
            .then(payload => {
                const result: AsyncStoryLoaderResult = {
                    ...payload,
                    locale: normalizedLocale,
                };

                if (generation === cacheGeneration) {
                    loadedStories.set(cacheKey, result);
                }
                return result;
            })
            .catch((error: unknown) => {
                throw new StoryLoadError(
                    'load-failed',
                    `Failed to load story: ${storyId}`,
                    { cause: error }
                );
            })
            .finally(() => {
                if (
                    generation === cacheGeneration &&
                    inFlightLoads.get(cacheKey) === loadPromise
                ) {
                    inFlightLoads.delete(cacheKey);
                }
            });

        inFlightLoads.set(cacheKey, loadPromise);
        return loadPromise;
    }

    return {
        load,
        reset() {
            cacheGeneration += 1;
            inFlightLoads.clear();
            loadedStories.clear();
        },
    };
}
