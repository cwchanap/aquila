import { afterEach, describe, it, expect, vi } from 'vitest';
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from '@testing-library/svelte';
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
            previousLine: 'Previous line',
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

import MobileNovelReader from '@/components/MobileNovelReader.svelte';

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
        await fireEvent.click(screen.getByLabelText('Bookmark'));
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
        expect(screen.queryByLabelText('Back to Home')).not.toBeInTheDocument();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        expect(screen.getByLabelText('Back to Home')).toBeInTheDocument();
    });

    it('opens the acts drawer from chrome and navigates', async () => {
        const onNavigate = vi.fn();
        render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        // Drawer is mounted but closed: its close button lives in an
        // aria-hidden/inert <aside>, so role queries (which honor aria-hidden)
        // exclude it, and the scrim is not rendered.
        expect(
            screen.queryAllByRole('button', { name: 'Close acts panel' })
        ).toHaveLength(0);
        await fireEvent.click(screen.getByLabelText('Open acts panel'));
        // Clicking "Open acts panel" sets drawerOpen → the drawer's open prop:
        // the panel is no longer aria-hidden, so its scrim + close button
        // become reachable, proving the open wired through.
        expect(
            screen.queryAllByRole('button', { name: 'Close acts panel' }).length
        ).toBeGreaterThan(0);
        // The drawer reads the story flow when it builds its act list.
        const { getStoryFlow } = await import('@aquila/stories');
        expect(getStoryFlow).toHaveBeenCalled();
    });

    it('renders the chrome as labeled icon buttons with a progress bar', async () => {
        render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                showBookmarkButton: true,
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        // Icon buttons expose their action via aria-label (no visible text label).
        expect(screen.getByLabelText('Back to Home')).toBeInTheDocument();
        expect(screen.getByLabelText('Open acts panel')).toBeInTheDocument();
        expect(screen.getByLabelText('Open history')).toBeInTheDocument();
        expect(screen.getByLabelText('Bookmark')).toBeInTheDocument();
        // The numeric progress caption is retained.
        expect(screen.getByText('Line 1 of 3')).toBeInTheDocument();
    });

    it('shows a disabled previous-line button on the first line without opening the menu', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        // The back control is persistent: visible with the hamburger chrome closed…
        expect(screen.queryByLabelText('Back to Home')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Previous line')).toBeInTheDocument();
        // …and disabled on the first line.
        expect(screen.getByLabelText('Previous line')).toBeDisabled();
    });

    it('advances when tapping the dialogue text and keeps the box scrollable', async () => {
        // Regression guard: the bottom reading panel is pointer-events-none
        // so taps fall through to the full-screen advance button, but the
        // scrollable text box must re-enable pointer events (so overflowed
        // lines can be scrolled) while still advancing on tap.
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        // Let line 1 finish typing, then tap the text itself (not the
        // full-screen advance button) to advance to line 2.
        await vi.runAllTimersAsync();
        const line1 = screen.getByText('First line.');
        // The scrollable text box carries pointer-events-auto so touch/wheel
        // events reach it instead of falling through to the advance layer.
        expect(line1.closest('p')?.className).toContain('pointer-events-auto');
        await fireEvent.click(line1);
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
    });

    it('steps back one line within the scene without leaving it', async () => {
        const onNext = vi.fn();
        render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                onNext,
                locale: 'en',
            },
        });
        const tap = screen.getByLabelText('Tap to continue');
        await fireEvent.click(tap); // complete typing of line 1
        await vi.runAllTimersAsync();
        await fireEvent.click(tap); // advance to line 2 (index 1)
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second line.')).toBeInTheDocument();

        // The persistent back button works without opening the hamburger menu.
        await fireEvent.click(screen.getByLabelText('Previous line'));
        expect(screen.getByText('First line.')).toBeInTheDocument();
        expect(screen.queryByText('Second line.')).not.toBeInTheDocument();
        expect(onNext).not.toHaveBeenCalled();
    });

    it('reveals an icon label on long-press and hides it on release', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        const acts = screen.getByLabelText('Open acts panel');
        await fireEvent.pointerDown(acts);
        await vi.advanceTimersByTimeAsync(450);
        // The icon button has no visible text (only its aria-label), so this
        // visible text can only be the tooltip bubble.
        expect(screen.getByText('Open acts panel')).toBeInTheDocument();
        await fireEvent.pointerUp(acts);
        expect(screen.queryByText('Open acts panel')).not.toBeInTheDocument();
    });

    it('anchors the tooltip next to the pressed control, not at a fixed screen position', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        const acts = screen.getByLabelText('Open acts panel');
        // happy-dom has no layout, so getBoundingClientRect returns zeros.
        // Force a deterministic rect so the anchoring math is testable.
        acts.getBoundingClientRect = vi.fn(() => ({
            left: 120,
            right: 160,
            top: 48,
            bottom: 92,
            width: 40,
            height: 44,
            x: 120,
            y: 48,
            toJSON() {},
        })) as typeof acts.getBoundingClientRect;

        await fireEvent.pointerDown(acts);
        await vi.advanceTimersByTimeAsync(450);

        const bubble = screen.getByText('Open acts panel');
        const style = bubble.getAttribute('style') ?? '';
        // Horizontal center = (120 + 160) / 2 = 140; top sits just below bottom.
        expect(style).toContain('left: 140px');
        expect(style).toContain('top: calc(92px');
        // Regression guard: the old fixed top-center offset must be gone.
        expect(style).not.toContain('3.5rem');
        expect(bubble.className).not.toContain('left-1/2');
        // Anchor coords are viewport-space, so the bubble must be position:fixed
        // (absolute only worked because the reader happened to be full-bleed).
        expect(bubble.className).toContain('fixed');

        await fireEvent.pointerUp(acts);
        expect(screen.queryByText('Open acts panel')).not.toBeInTheDocument();
    });

    it('clears the tooltip anchor on release so stale coords cannot leak into a later long-press', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        const acts = screen.getByLabelText('Open acts panel');

        // First long-press with one rect.
        acts.getBoundingClientRect = vi.fn(() => ({
            left: 120,
            right: 160,
            top: 48,
            bottom: 92,
            width: 40,
            height: 44,
            x: 120,
            y: 48,
            toJSON() {},
        })) as typeof acts.getBoundingClientRect;
        await fireEvent.pointerDown(acts);
        await vi.advanceTimersByTimeAsync(450);
        let bubble = screen.getByText('Open acts panel');
        expect(bubble.getAttribute('style') ?? '').toContain('left: 140px');

        await fireEvent.pointerUp(acts);
        expect(screen.queryByText('Open acts panel')).not.toBeInTheDocument();

        // Move the control (e.g. layout shift) and long-press again. If the
        // anchor were not cleared on release, the bubble could re-render with
        // the previous rect for a frame before the next pointerdown updated it.
        acts.getBoundingClientRect = vi.fn(() => ({
            left: 200,
            right: 240,
            top: 80,
            bottom: 124,
            width: 40,
            height: 44,
            x: 200,
            y: 80,
            toJSON() {},
        })) as typeof acts.getBoundingClientRect;
        await fireEvent.pointerDown(acts);
        await vi.advanceTimersByTimeAsync(450);
        bubble = screen.getByText('Open acts panel');
        // New center = (200 + 240) / 2 = 220 — the stale 140 must be gone.
        expect(bubble.getAttribute('style') ?? '').toContain('left: 220px');
        expect(bubble.getAttribute('style') ?? '').not.toContain('left: 140px');

        await fireEvent.pointerUp(acts);
    });

    it('opens the backlog with the current scene lines', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        // advance to line 2 so backlog has two entries
        const tap = screen.getByLabelText('Tap to continue');
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        await fireEvent.click(tap);
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open history'));
        // Opening an overlay dismisses the chrome bar (chromeVisible = false).
        expect(screen.queryByLabelText('Back to Home')).not.toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByText('History')).toBeInTheDocument();
        });
        // Both revealed lines are listed in the backlog.
        expect(screen.getByText('First line.')).toBeInTheDocument();
        expect(screen.getByText('Second line.')).toBeInTheDocument();
    });

    it('cancels in-flight typing without errors when unmounted mid-typewriter', async () => {
        const { unmount } = render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        // Unmount before flushing the typewriter timers. The onDestroy hook
        // bumps sceneVersion so pending onTick callbacks become no-ops.
        unmount();
        // Flushing timers after unmount must not throw or mutate destroyed state.
        await vi.runAllTimersAsync();
        expect(
            screen.queryByLabelText('Tap to continue')
        ).not.toBeInTheDocument();
    });

    it('inerts the reader background while an overlay is open and restores it on close', async () => {
        render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();

        const tap = screen.getByLabelText('Tap to continue');
        // Closed overlay: the reader background is interactive (not inert).
        expect(tap.closest('[inert]')).toBeNull();

        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open acts panel'));

        // While the drawer is open, the reader background (tap layer) is inert
        // so keyboard / AT users can't reach controls hidden behind the scrim.
        // The overlay itself must NOT be inert (it remains interactive).
        expect(tap.closest('[inert]')).not.toBeNull();
        const closeBtn = screen.getAllByRole('button', {
            name: 'Close acts panel',
        })[0];
        expect(closeBtn.closest('[inert]')).toBeNull();

        // Closing the overlay re-enables the background.
        await fireEvent.click(closeBtn);
        expect(tap.closest('[inert]')).toBeNull();
    });

    it('inerts the reader background while the backlog sheet is open', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open history'));

        const tap = screen.getByLabelText('Tap to continue');
        expect(tap.closest('[inert]')).not.toBeNull();
    });

    it('hides the line-progress count when the dialogue is empty', async () => {
        render(MobileNovelReader, {
            props: { dialogue: [], choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        // Spec: when dialogue.length === 0 the count is hidden (not "Line 1 of 0").
        expect(screen.queryByText('Line 1 of 0')).not.toBeInTheDocument();
    });

    it('restores focus to the persistent menu toggle after closing the acts drawer', async () => {
        render(MobileNovelReader, {
            props: {
                dialogue: mockDialogue,
                choice: null,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                locale: 'en',
            },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open acts panel'));

        // The opener (acts panel icon) unmounts with the chrome bar in the
        // same batch the drawer opens, so the trap can't restore focus to it.
        // Closing the drawer must land focus on the always-mounted ☰ toggle
        // instead of stranding it on <body>.
        const closeBtn = screen.getAllByRole('button', {
            name: 'Close acts panel',
        })[0];
        await fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(document.activeElement).toBe(
                screen.getByLabelText('Open menu')
            );
        });
    });

    it('restores focus to the persistent menu toggle after closing the backlog sheet', async () => {
        render(MobileNovelReader, {
            props: { dialogue: mockDialogue, choice: null, locale: 'en' },
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByLabelText('Open menu'));
        await fireEvent.click(screen.getByLabelText('Open history'));

        // Both the scrim and the in-dialog ✕ carry the "Close history" label;
        // pick the in-dialog close button (the one inside the [role="dialog"]).
        const dialog = screen.getByRole('dialog');
        const closeBtn = within(dialog).getByRole('button', {
            name: 'Close history',
        });
        await fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(document.activeElement).toBe(
                screen.getByLabelText('Open menu')
            );
        });
    });
});
