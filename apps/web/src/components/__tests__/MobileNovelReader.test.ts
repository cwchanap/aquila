import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry, ChoiceDefinition } from '@aquila/stories';

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => ({ start: 'a1', nodes: [] })),
    getTranslations: vi.fn((locale: string) => ({
        reader: {
            unknown: 'Unknown',
            nextScene: 'Next Scene',
            complete: 'Complete',
            bookmark: 'Bookmark',
            actPanel: 'Acts',
            historyTitle: 'History',
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
            openHistory: 'Open history',
            closeHistory: 'Close history',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
            tapToContinue: 'Tap to continue',
            lineProgress: 'Line {current} of {total}',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
        },
        characterNames: { narrator: 'Narrator' },
        common: { backToHome: 'Back to Home' },
        locale,
    })),
}));

import MobileNovelReader from '../MobileNovelReader.svelte';

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First line.' },
    { characterId: 'narrator', dialogue: 'Second line.' },
    { characterId: 'narrator', dialogue: 'Third line.' },
];

const mockChoice: ChoiceDefinition = {
    prompt: 'Pick one?',
    options: [
        { id: 'o1', label: 'Option A', nextScene: 'sceneA' },
        { id: 'o2', label: 'Option B', nextScene: 'sceneB' },
    ],
};

describe('MobileNovelReader', () => {
    afterEach(() => vi.clearAllMocks());

    it('types the first line on mount', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('First line.')).toBeInTheDocument();
        expect(screen.getByText('Narrator')).toBeInTheDocument();
    });

    it('first tap completes typing, second tap advances', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        const tap = screen.getByLabelText('Tap to continue');
        // skip typing of line 1
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        expect(screen.getByText('First line.')).toBeInTheDocument();
        // advance to line 2
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
        // only the current line is shown (single panel)
        expect(screen.queryByText('First line.')).not.toBeInTheDocument();
    });

    it('advances with the Enter key', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
    });

    it('shows line progress', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Line 1 of 3')).toBeInTheDocument();
    });

    it('calls onNext on the last line when canGoNext', async () => {
        const onNext = vi.fn();
        render(MobileNovelReader, {
            props: {
                dialogue: [mockDialogue[0]],
                choice: null,
                canGoNext: true,
                onNext,
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();
        // line already complete; tap advances past the end → onNext
        await fireEvent.click(screen.getByLabelText('Tap to continue'));
        expect(onNext).toHaveBeenCalled();
    });

    it('renders choices on the last line and calls onChoice', async () => {
        const onChoice = vi.fn();
        render(MobileNovelReader, {
            props: {
                dialogue: [mockDialogue[0]],
                choice: mockChoice,
                onChoice,
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Pick one?')).toBeInTheDocument();
        await fireEvent.click(screen.getByText('Option A'));
        expect(onChoice).toHaveBeenCalledWith('sceneA');
    });

    it('bookmarks the current line number', async () => {
        const onBookmark = vi.fn();
        render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                showBookmarkButton: true,
                onBookmark,
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByText('Bookmark'));
        expect(onBookmark).toHaveBeenCalledWith(1);
    });

    it('jumps to initialDialogueIndex without re-applying on scene change', async () => {
        const { rerender } = render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                locale: 'en',
                initialDialogueIndex: 1,
            },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Line 2 of 3')).toBeInTheDocument();
        // close menu, change scene
        await fireEvent.click(screen.getByLabelText('Close menu'));
        const newDialogue: DialogueEntry[] = [
            { characterId: 'narrator', dialogue: 'New A.' },
            { characterId: 'narrator', dialogue: 'New B.' },
        ];
        await rerender({
            dialogue: newDialogue,
            choice: null,
            locale: 'en',
            initialDialogueIndex: 1,
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Line 1 of 2')).toBeInTheDocument();
    });

    it('toggles chrome with the menu button', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        expect(screen.queryByText('Back to Home')).not.toBeInTheDocument();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });
});
