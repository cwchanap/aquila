import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryNotesPayload } from '../../notes-types';
import { StoryLoadError } from '../errors';
import { createStoryNotesLoader } from '../notes-loader';
import { hasStoryNotes, loadStoryNotes } from '..';
import { resetStoryNotesCacheForTests } from '../registry';

// The notes path must never reach the eager story index (which statically
// imports every dialogue locale). Importing it here would throw, so a passing
// notes load proves the boundary.
vi.mock('../../stories/trainAdventure', () => {
    throw new Error('story dialogue bundle must not be imported by notes');
});

const notes = (storyId: string) => ({
    storyId,
    characters: [],
    events: [],
});

const payload = (storyId: string): StoryNotesPayload => ({
    notes: notes(storyId),
    flow: { start: 'act1', nodes: [] },
});

describe('async story notes boundary', () => {
    beforeEach(() => {
        resetStoryNotesCacheForTests();
    });

    it('exposes availability synchronously without loading notes', () => {
        expect(hasStoryNotes('train_adventure')).toBe(true);
        expect(hasStoryNotes('elevator_game')).toBe(false);
        expect(hasStoryNotes('not_a_story')).toBe(false);
    });

    it('loads generated notes and flow directly, never the dialogue-heavy story index', async () => {
        const [a, b] = await Promise.all([
            loadStoryNotes('train_adventure'),
            loadStoryNotes('train_adventure'),
        ]);

        expect(a).toBe(b);
        expect(a.notes.storyId).toBe('train_adventure');
        expect(a.flow.start).toBe('act1');
        expect(a.flow.nodes.length).toBeGreaterThan(0);
    });

    it('keeps the notes cache independent from the content cache', async () => {
        const first = await loadStoryNotes('train_adventure');
        resetStoryNotesCacheForTests();
        const second = await loadStoryNotes('train_adventure');

        expect(second.notes.storyId).toBe(first.notes.storyId);
        expect(second).not.toBe(first);
    });

    it('rejects unknown and unsupported stories explicitly', async () => {
        await expect(loadStoryNotes('nope')).rejects.toMatchObject({
            code: 'unknown-story',
        });
        await expect(loadStoryNotes('elevator_game')).rejects.toMatchObject({
            code: 'unsupported-story',
        });
        expect(new StoryLoadError('load-failed', 'x')).toBeInstanceOf(Error);
    });
});

describe('createStoryNotesLoader', () => {
    it('deduplicates concurrent loads and caches success by story id', async () => {
        const importer = vi.fn(async () => payload('a'));
        const loader = createStoryNotesLoader({ train_adventure: importer });

        const [a, b] = await Promise.all([
            loader.load('train_adventure'),
            loader.load('train_adventure'),
        ]);
        const c = await loader.load('train_adventure');

        expect(importer).toHaveBeenCalledOnce();
        expect(a).toBe(b);
        expect(c).toBe(a);
    });

    it('isolates cached payloads for distinct stories', async () => {
        const loader = createStoryNotesLoader({
            train_adventure: async () => payload('a'),
            elevator_game: async () => payload('b'),
        });

        const a = await loader.load('train_adventure');
        const b = await loader.load('elevator_game');

        expect(a.notes.storyId).toBe('a');
        expect(b.notes.storyId).toBe('b');
    });

    it('removes rejected promises so a retry can succeed', async () => {
        const importer = vi
            .fn<() => Promise<StoryNotesPayload>>()
            .mockRejectedValueOnce(new Error('network'))
            .mockResolvedValueOnce(payload('a'));
        const loader = createStoryNotesLoader({ train_adventure: importer });

        await expect(loader.load('train_adventure')).rejects.toMatchObject({
            code: 'load-failed',
        });
        await expect(loader.load('train_adventure')).resolves.toMatchObject({
            notes: { storyId: 'a' },
        });
        expect(importer).toHaveBeenCalledTimes(2);
    });

    it('does not let pre-reset loads poison the new cache generation', async () => {
        let resolveFirst!: (value: StoryNotesPayload) => void;
        const importer = vi
            .fn<() => Promise<StoryNotesPayload>>()
            .mockImplementationOnce(
                () =>
                    new Promise(resolve => {
                        resolveFirst = resolve;
                    })
            )
            .mockResolvedValueOnce(payload('fresh'));
        const loader = createStoryNotesLoader({ train_adventure: importer });

        const stale = loader.load('train_adventure');
        await vi.waitFor(() => expect(importer).toHaveBeenCalledOnce());
        loader.reset();
        const fresh = await loader.load('train_adventure');
        resolveFirst(payload('stale'));
        await stale;

        await expect(loader.load('train_adventure')).resolves.toBe(fresh);
        expect(fresh.notes.storyId).toBe('fresh');
    });
});
