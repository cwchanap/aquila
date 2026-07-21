// @vitest-environment node
/**
 * Tests the SSR guard in ReaderManager.purgeLegacyState (lines 50-52).
 * The `typeof window === 'undefined'` branch only fires when running
 * without a browser environment (e.g., SSR / Node.js).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@aquila/stories', () => ({
    getStoryContent: vi.fn().mockReturnValue({ dialogue: {}, choices: {} }),
    getStoryFlow: vi.fn().mockReturnValue({ start: 'act1', nodes: [] }),
    getTranslations: vi.fn(() => ({
        reader: {
            bookmarkPrompt: 'Save as:',
            defaultBookmarkName: 'Bookmark',
            bookmarkSaved: 'Saved',
            bookmarkFailed: 'Failed',
            bookmarkError: 'Error',
            endOfStory: 'End',
            loadError: 'Load error',
            retry: 'Retry',
        },
        locale: 'en',
    })),
}));

vi.mock('@aquila/stories/translations', () => ({
    getTranslations: vi.fn(() => ({
        reader: {
            bookmarkPrompt: 'Save as:',
            defaultBookmarkName: 'Bookmark',
            bookmarkSaved: 'Saved',
            bookmarkFailed: 'Failed',
            bookmarkError: 'Error',
            endOfStory: 'End',
            loadError: 'Load error',
            retry: 'Retry',
        },
        locale: 'en',
    })),
}));

vi.mock('svelte', () => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock('../ui-dialogs', () => ({
    showAlert: vi.fn(),
    showPrompt: vi.fn(),
}));

describe('ReaderManager — SSR guard (lines 50-52)', () => {
    it('does not throw when constructed in a window-less environment', async () => {
        const { ReaderManager } = await import('../reader-manager');
        const loadStoryContent = vi.fn();
        expect(
            () =>
                new ReaderManager('en', undefined, {
                    loadStoryContent,
                })
        ).not.toThrow();
        expect(loadStoryContent).not.toHaveBeenCalled();
    });
});
