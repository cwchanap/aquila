import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry } from '@aquila/stories';

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => ({ start: 'a1', nodes: [] })),
    getTranslations: vi.fn((locale: string) => ({
        reader: {
            unknown: 'Unknown',
            continue: 'Continue',
            nextScene: 'Next Scene',
            complete: 'Complete',
            bookmark: 'Bookmark',
            pageDisplay: '{current} / {total}',
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
            historyTitle: 'History',
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
            openHistory: 'Open history',
            closeHistory: 'Close history',
            tapToContinue: 'Tap to continue',
            lineProgress: 'Line {current} of {total}',
        },
        characterNames: { narrator: 'Narrator' },
        common: { backToHome: 'Back to Home' },
        locale,
    })),
}));

import ReaderShell from '../ReaderShell.svelte';

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First dialogue line.' },
    { characterId: 'narrator', dialogue: 'Second dialogue line.' },
    { characterId: 'narrator', dialogue: 'Third dialogue line.' },
];

function stubMatchMedia(initial: boolean) {
    let listeners: Array<(e: { matches: boolean }) => void> = [];
    const mql = {
        matches: initial,
        media: '(max-width: 1023px)',
        onchange: null,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
            listeners.push(cb),
        removeEventListener: (
            _: string,
            cb: (e: { matches: boolean }) => void
        ) => {
            listeners = listeners.filter(l => l !== cb);
        },
        addListener: (cb: (e: { matches: boolean }) => void) =>
            listeners.push(cb),
        removeListener: (cb: (e: { matches: boolean }) => void) => {
            listeners = listeners.filter(l => l !== cb);
        },
        dispatchEvent: () => true,
    };
    Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mql),
        writable: true,
        configurable: true,
    });
    return {
        setMatches(v: boolean) {
            mql.matches = v;
            listeners.forEach(l => l({ matches: v }));
        },
    };
}

describe('ReaderShell', () => {
    afterEach(() => vi.clearAllMocks());

    it('renders the desktop reader at >= lg', async () => {
        stubMatchMedia(false);
        render(ReaderShell, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
        expect(
            screen.queryByLabelText('Tap to continue')
        ).not.toBeInTheDocument();
    });

    it('renders the mobile reader below lg', async () => {
        stubMatchMedia(true);
        render(ReaderShell, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument();
    });

    it('switches readers when the media query changes', async () => {
        const mm = stubMatchMedia(false);
        render(ReaderShell, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
        mm.setMatches(true);
        await waitFor(() => {
            expect(
                screen.getByLabelText('Tap to continue')
            ).toBeInTheDocument();
        });
    });

    it('preserves the current dialogue index when switching layouts', async () => {
        const mm = stubMatchMedia(false);
        render(ReaderShell, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });

        // Let the desktop reader finish typing the first line.
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();

        // Advance to the second line on the desktop reader.
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        // Rotate/resize across the 1023px breakpoint -> mobile reader mounts.
        mm.setMatches(true);
        await waitFor(() => {
            expect(
                screen.getByLabelText('Tap to continue')
            ).toBeInTheDocument();
        });

        // The mobile reader should resume at the second line, not reset to 0.
        // The backlog sheet is closed by default, so only the current line's
        // text is in the DOM.
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
        expect(
            screen.queryByText('First dialogue line.')
        ).not.toBeInTheDocument();
    });

    it('does not re-apply a stale bookmark offset when switching layouts', async () => {
        const mm = stubMatchMedia(false);
        render(ReaderShell, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                locale: 'en',
                initialDialogueIndex: 1,
            },
        });

        // Desktop reader seeds at the bookmark (index 1 = second line).
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        // User advances forward past the bookmark to the third line.
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Third dialogue line.')).toBeInTheDocument();

        // Swap to mobile: must NOT jump back to the stale bookmark (index 1).
        mm.setMatches(true);
        await waitFor(() => {
            expect(
                screen.getByLabelText('Tap to continue')
            ).toBeInTheDocument();
        });
        // The mobile reader should resume at the third line (the user's
        // current position), not the stale bookmark at the second line.
        expect(screen.getByText('Third dialogue line.')).toBeInTheDocument();
        expect(
            screen.queryByText('Second dialogue line.')
        ).not.toBeInTheDocument();
    });
});
