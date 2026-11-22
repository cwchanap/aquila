import type { StoryNotesPayload } from '../notes-types';
import { isRegisteredStoryId, type RegisteredStoryId } from '../story-metadata';
import { StoryLoadError } from './errors';

export type StoryNotesImporter = () => Promise<StoryNotesPayload>;

export type StoryNotesLoader = {
    load: (storyId: string) => Promise<StoryNotesPayload>;
    reset: () => void;
};

/**
 * Cached lazy loader for compiled story notes. Notes are locale-independent
 * and small; importers must import generated notes.ts + flow.ts directly and
 * never the dialogue-heavy story index.
 */
export function createStoryNotesLoader(
    importers: Partial<Record<RegisteredStoryId, StoryNotesImporter>>
): StoryNotesLoader {
    let cacheGeneration = 0;
    const inFlightLoads = new Map<string, Promise<StoryNotesPayload>>();
    const loadedStories = new Map<string, StoryNotesPayload>();

    async function load(storyId: string): Promise<StoryNotesPayload> {
        if (!isRegisteredStoryId(storyId)) {
            throw new StoryLoadError(
                'unknown-story',
                `Unknown story: ${storyId}`
            );
        }

        const cached = loadedStories.get(storyId);
        if (cached) return cached;

        const inFlight = inFlightLoads.get(storyId);
        if (inFlight) return inFlight;

        const importer = importers[storyId];
        if (!importer) {
            throw new StoryLoadError(
                'unsupported-story',
                `No notes registered for story: ${storyId}`
            );
        }

        const generation = cacheGeneration;
        const loadPromise = Promise.resolve()
            .then(importer)
            .then(payload => {
                if (generation === cacheGeneration) {
                    loadedStories.set(storyId, payload);
                }
                return payload;
            })
            .catch((error: unknown) => {
                if (error instanceof StoryLoadError) throw error;
                throw new StoryLoadError(
                    'load-failed',
                    `Failed to load story notes: ${storyId}`,
                    { cause: error }
                );
            })
            .finally(() => {
                if (
                    generation === cacheGeneration &&
                    inFlightLoads.get(storyId) === loadPromise
                ) {
                    inFlightLoads.delete(storyId);
                }
            });

        inFlightLoads.set(storyId, loadPromise);
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
