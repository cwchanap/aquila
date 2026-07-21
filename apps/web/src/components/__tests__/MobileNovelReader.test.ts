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

const readerFlow = {
    start: 'b1a_act1',
    nodes: [
        {
            kind: 'scene',
            id: 'b1a_act1',
            sceneId: 'b1a_act1',
            next: 'b1a_act2',
        },
        {
            kind: 'scene',
            id: 'b1a_act2',
            sceneId: 'b1a_act2',
            next: null,
        },
    ],
};

const { mockGetTranslations } = vi.hoisted(() => ({
    mockGetTranslations: vi.fn((locale: string) => ({
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

vi.mock('@aquila/stories', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories')>()),
    getTranslations: mockGetTranslations,
}));
vi.mock('@aquila/stories/translations', () => ({
    getTranslations: mockGetTranslations,
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

// Controlled-component helper: tracks the index the parent would own and
// re-renders with the full prop bag when asked, simulating the store->props
// bridge (ReaderShell) lifting onIndexChange into a new dialogueIndex prop.
function renderReader(overrides: Record<string, unknown> = {}) {
    const onIndexChange = vi.fn();
    let current: Record<string, unknown> = {
        flow: readerFlow,
        dialogue: mockDialogue,
        choice: null,
        locale: 'en',
        dialogueIndex: 0,
        ...overrides,
        onIndexChange: overrides.onIndexChange ?? onIndexChange,
    };
    const result = render(MobileNovelReader, { props: current });
    const rerenderRaw = async (next: Record<string, unknown> = {}) => {
        current = { ...current, ...next };
        await result.rerender(current);
    };
    const rerenderAt = async (next: Record<string, unknown> = {}) => {
        await rerenderRaw(next);
        await vi.runAllTimersAsync();
    };
    return {
        ...result,
        onIndexChange,
        rerenderAt,
        rerenderRaw,
        props: () => current,
    };
}

describe('MobileNovelReader', () => {
    afterEach(() => vi.clearAllMocks());

    describe('controlled contract', () => {
        it('renders the active line at the dialogueIndex prop', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            expect(screen.getByText('First line.')).toBeInTheDocument();
            expect(screen.getByText('Narrator')).toBeInTheDocument();
        });

        it('emits onIndexChange on tap advance (and not while typing)', async () => {
            const { onIndexChange } = renderReader({ dialogueIndex: 0 });
            const tap = screen.getByLabelText('Tap to continue');
            // First tap: typing still in flight → skip only, no advance emit.
            await fireEvent.click(tap);
            expect(onIndexChange).not.toHaveBeenCalled();
            await vi.runAllTimersAsync();
            expect(screen.getByText('First line.')).toBeInTheDocument();
            // Second tap: emit onIndexChange(1).
            await fireEvent.click(tap);
            expect(onIndexChange).toHaveBeenCalledWith(1);
        });

        it('does NOT emit onIndexChange when a tap during typing only skips', async () => {
            const { onIndexChange } = renderReader({ dialogueIndex: 0 });
            await vi.advanceTimersByTimeAsync(60);
            await fireEvent.click(screen.getByLabelText('Tap to continue'));
            await vi.advanceTimersByTimeAsync(50);
            expect(onIndexChange).not.toHaveBeenCalled();
        });

        it('emits onIndexChange when goBack is invoked', async () => {
            const { onIndexChange, rerenderAt } = renderReader({
                dialogueIndex: 0,
            });
            await vi.runAllTimersAsync();
            const tap = screen.getByLabelText('Tap to continue');
            // Advance to index 1 via parent lifting the emit.
            await fireEvent.click(tap); // complete typing of line 1
            await fireEvent.click(tap); // emit onIndexChange(1)
            expect(onIndexChange).toHaveBeenCalledWith(1);
            await rerenderAt({ dialogueIndex: 1 });
            expect(screen.getByText('Second line.')).toBeInTheDocument();
            // Back button emits onIndexChange(0); parent lifts.
            await fireEvent.click(screen.getByLabelText('Previous line'));
            expect(onIndexChange).toHaveBeenCalledWith(0);
            await rerenderAt({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            expect(screen.getByText('First line.')).toBeInTheDocument();
            expect(screen.queryByText('Second line.')).not.toBeInTheDocument();
        });

        it('derives backlog lines from the dialogueIndex prop', async () => {
            const { rerenderAt } = renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            // Parent lifts to index 2: backlog should contain lines 0..2.
            await rerenderAt({ dialogueIndex: 2 });
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open history'));
            await waitFor(() => {
                expect(screen.getByText('History')).toBeInTheDocument();
            });
            expect(screen.getByText('First line.')).toBeInTheDocument();
            expect(screen.getByText('Second line.')).toBeInTheDocument();
            // The third line is the current line, so it appears in BOTH the
            // active reading box and the backlog — assert at least one match.
            expect(screen.getAllByText('Third line.').length).toBeGreaterThan(
                0
            );
        });

        it('animates the first line when a new scene loads at dialogueIndex 0', async () => {
            const { rerenderRaw } = renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            const newDialogue: DialogueEntry[] = [
                { characterId: 'narrator', dialogue: 'New scene first line.' },
            ];
            // Swap the scene (new dialogue ref) at index 0, without settling
            // timers so we can observe the typewriter mid-animation.
            await rerenderRaw({ dialogue: newDialogue, dialogueIndex: 0 });
            // Mobile cursor uses `motion-safe:animate-pulse`, so substring-match
            // the class rather than querying the bare `.animate-pulse` selector.
            expect(
                document.querySelectorAll('[class*="animate-pulse"]').length
            ).toBeGreaterThan(0);
            await vi.runAllTimersAsync();
            expect(
                screen.getByText('New scene first line.')
            ).toBeInTheDocument();
        });

        it('snaps to full text (no animation) on an external dialogueIndex change', async () => {
            const { rerenderRaw } = renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync(); // line 0 fully typed
            // Simulate popstate/restore: parent bumps index without an advance.
            await rerenderRaw({ dialogueIndex: 1 });
            // No typewriter cursor should be present (snap, not animate).
            expect(
                document.querySelectorAll('[class*="animate-pulse"]').length
            ).toBe(0);
            // Active line is fully visible right away (no timers needed).
            expect(screen.getByText('Second line.')).toBeInTheDocument();
        });

        it('animates (does not snap) when scene ref and index both change — lastIndex race regression', async () => {
            // Regression guard for `lastIndex = dialogueIndex` in Signal 1.
            // When a rerender swaps the dialogue array reference AND resets
            // dialogueIndex in the same tick, BOTH signals fire. Signal 1 must
            // sync `lastIndex = dialogueIndex` so Signal 2 does not mistake the
            // scene change for an external index change and snap away the
            // animation.
            const { rerenderRaw } = renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync(); // line 0 fully typed, lastIndex == 0

            // Parent jumps to index 2: Signal 2 snaps, lastIndex becomes 2.
            await rerenderRaw({ dialogueIndex: 2 });
            await vi.runAllTimersAsync();

            // Scene change: NEW dialogue array reference AND reset to index 0.
            const newDialogue: DialogueEntry[] = [
                { characterId: 'narrator', dialogue: 'New scene first.' },
                { characterId: 'narrator', dialogue: 'New scene second.' },
                { characterId: 'narrator', dialogue: 'New scene third.' },
            ];
            await rerenderRaw({ dialogue: newDialogue, dialogueIndex: 0 });

            // Mid-typing: cursor visible. Signal 1 started animating and
            // Signal 2 did NOT snap.
            expect(
                document.querySelectorAll('[class*="animate-pulse"]').length
            ).toBeGreaterThan(0);
        });

        it('bookmarks dialogueIndex + 1', async () => {
            const onBookmark = vi.fn();
            renderReader({ dialogueIndex: 2, onBookmark });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Bookmark'));
            expect(onBookmark).toHaveBeenCalledWith(3);
        });
    });

    describe('mobile chrome & overlays', () => {
        it('first tap completes typing, second tap advances with parent lift', async () => {
            const { onIndexChange, rerenderAt } = renderReader({
                dialogueIndex: 0,
            });
            const tap = screen.getByLabelText('Tap to continue');
            await fireEvent.click(tap); // skip typing of line 1
            await vi.runAllTimersAsync();
            expect(screen.getByText('First line.')).toBeInTheDocument();
            await fireEvent.click(tap); // emit onIndexChange(1)
            expect(onIndexChange).toHaveBeenCalledWith(1);
            await rerenderAt({ dialogueIndex: 1 });
            await vi.runAllTimersAsync();
            expect(screen.getByText('Second line.')).toBeInTheDocument();
            // Only the current line shows in the active panel (backlog closed).
            expect(screen.queryByText('First line.')).not.toBeInTheDocument();
        });

        it('advances with the Enter key', async () => {
            const { onIndexChange } = renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.keyDown(window, { key: 'Enter' });
            expect(onIndexChange).toHaveBeenCalledWith(1);
        });

        it('shows line progress', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            expect(screen.getByText('Line 1 of 3')).toBeInTheDocument();
        });

        it('calls onNext on the last line when canGoNext', async () => {
            const onNext = vi.fn();
            renderReader({
                dialogue: [mockDialogue[0]],
                dialogueIndex: 0,
                canGoNext: true,
                onNext,
            });
            await vi.runAllTimersAsync();
            // Line already complete; tap advances past the end → onNext.
            await fireEvent.click(screen.getByLabelText('Tap to continue'));
            expect(onNext).toHaveBeenCalled();
        });

        it('renders choices on the last line and calls onChoice', async () => {
            const onChoice = vi.fn();
            renderReader({
                dialogue: [mockDialogue[0]],
                dialogueIndex: 0,
                choice: mockChoice,
                onChoice,
            });
            await vi.runAllTimersAsync();
            expect(screen.getByText('Pick one?')).toBeInTheDocument();
            await fireEvent.click(screen.getByText('Option A'));
            expect(onChoice).toHaveBeenCalledWith('sceneA');
        });

        it('bookmarks the current line number at index 0', async () => {
            const onBookmark = vi.fn();
            renderReader({
                dialogueIndex: 0,
                showBookmarkButton: true,
                onBookmark,
            });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Bookmark'));
            expect(onBookmark).toHaveBeenCalledWith(1);
        });

        it('toggles chrome with the menu button', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            expect(
                screen.queryByLabelText('Back to Home')
            ).not.toBeInTheDocument();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            expect(screen.getByLabelText('Back to Home')).toBeInTheDocument();
        });

        it('opens the acts drawer from chrome and navigates', async () => {
            const onNavigate = vi.fn();
            renderReader({
                dialogueIndex: 0,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
            });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            expect(
                screen.queryAllByRole('button', { name: 'Close acts panel' })
            ).toHaveLength(0);
            await fireEvent.click(screen.getByLabelText('Open acts panel'));
            expect(
                screen.queryAllByRole('button', { name: 'Close acts panel' })
                    .length
            ).toBeGreaterThan(0);
            expect(screen.getByText('Act 1')).toBeInTheDocument();
        });

        it('does NOT call onNavigate when the drawer selects the already-current act (same-scene guard)', async () => {
            // Regression: MobileNovelReader previously forwarded every drawer
            // selection to onNavigate without the desktop reader's same-scene
            // guard. goToScene unconditionally resets dialogueIndex to 0 and
            // pushes/persists, so tapping the current act lost the user's
            // line progress. The guard must skip onNavigate for the current
            // scene while still forwarding a different-scene selection.
            const flowWithScenes = {
                start: 'b1a_act1',
                nodes: [
                    {
                        kind: 'scene',
                        id: 'b1a_act1',
                        sceneId: 'b1a_act1',
                        next: 'b1a_act2',
                    },
                    {
                        kind: 'scene',
                        id: 'b1a_act2',
                        sceneId: 'b1a_act2',
                        next: null,
                    },
                ],
            };
            const onNavigate = vi.fn();
            renderReader({
                flow: flowWithScenes,
                dialogueIndex: 2,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
            });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open acts panel'));
            // Act buttons are the buttons inside the dialog without aria-label
            // (the scrim/close button carry aria-label "Close acts panel").
            const dialog = screen.getByRole('dialog');
            const actButtons = within(dialog)
                .getAllByRole('button')
                .filter(b => !b.getAttribute('aria-label'));
            const currentAct = actButtons.find(
                b => b.textContent?.trim() === 'Act 1'
            )!;
            await fireEvent.click(currentAct);
            // Same-scene selection: guard must suppress onNavigate so the
            // manager's goToScene does not reset dialogueIndex to 0.
            expect(onNavigate).not.toHaveBeenCalled();
        });

        it('renders the chrome as labeled icon buttons with a progress bar', async () => {
            renderReader({
                dialogueIndex: 0,
                showBookmarkButton: true,
            });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            expect(screen.getByLabelText('Back to Home')).toBeInTheDocument();
            expect(
                screen.getByLabelText('Open acts panel')
            ).toBeInTheDocument();
            expect(screen.getByLabelText('Open history')).toBeInTheDocument();
            expect(screen.getByLabelText('Bookmark')).toBeInTheDocument();
            expect(screen.getByText('Line 1 of 3')).toBeInTheDocument();
        });

        it('shows a disabled previous-line button on the first line without opening the menu', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            expect(
                screen.queryByLabelText('Back to Home')
            ).not.toBeInTheDocument();
            expect(screen.getByLabelText('Previous line')).toBeInTheDocument();
            expect(screen.getByLabelText('Previous line')).toBeDisabled();
        });

        it('advances when tapping the dialogue text and keeps the box scrollable', async () => {
            const { onIndexChange, rerenderAt } = renderReader({
                dialogueIndex: 0,
            });
            await vi.runAllTimersAsync();
            const line1 = screen.getByText('First line.');
            expect(line1.closest('p')?.className).toContain(
                'pointer-events-auto'
            );
            await fireEvent.click(line1);
            expect(onIndexChange).toHaveBeenCalledWith(1);
            await rerenderAt({ dialogueIndex: 1 });
            await vi.runAllTimersAsync();
            expect(screen.getByText('Second line.')).toBeInTheDocument();
        });

        it('steps back one line within the scene without leaving it', async () => {
            const onNext = vi.fn();
            const { onIndexChange, rerenderAt } = renderReader({
                dialogueIndex: 0,
                onNext,
            });
            const tap = screen.getByLabelText('Tap to continue');
            await fireEvent.click(tap); // complete typing of line 1
            await vi.runAllTimersAsync();
            await fireEvent.click(tap); // emit onIndexChange(1)
            await rerenderAt({ dialogueIndex: 1 });
            await vi.runAllTimersAsync();
            expect(screen.getByText('Second line.')).toBeInTheDocument();
            await fireEvent.click(screen.getByLabelText('Previous line'));
            expect(onIndexChange).toHaveBeenCalledWith(0);
            await rerenderAt({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            expect(screen.getByText('First line.')).toBeInTheDocument();
            expect(screen.queryByText('Second line.')).not.toBeInTheDocument();
            expect(onNext).not.toHaveBeenCalled();
        });

        it('reveals an icon label on long-press and hides it on release', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            const acts = screen.getByLabelText('Open acts panel');
            await fireEvent.pointerDown(acts);
            await vi.advanceTimersByTimeAsync(450);
            expect(screen.getByText('Open acts panel')).toBeInTheDocument();
            await fireEvent.pointerUp(acts);
            expect(
                screen.queryByText('Open acts panel')
            ).not.toBeInTheDocument();
        });

        it('anchors the tooltip next to the pressed control, not at a fixed screen position', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            const acts = screen.getByLabelText('Open acts panel');
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
            expect(style).toContain('left: 140px');
            expect(style).toContain('top: calc(92px');
            expect(style).not.toContain('3.5rem');
            expect(bubble.className).not.toContain('left-1/2');
            expect(bubble.className).toContain('fixed');
            await fireEvent.pointerUp(acts);
            expect(
                screen.queryByText('Open acts panel')
            ).not.toBeInTheDocument();
        });

        it('clears the tooltip anchor on release so stale coords cannot leak into a later long-press', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            const acts = screen.getByLabelText('Open acts panel');
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
            expect(
                screen.queryByText('Open acts panel')
            ).not.toBeInTheDocument();
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
            expect(bubble.getAttribute('style') ?? '').toContain('left: 220px');
            expect(bubble.getAttribute('style') ?? '').not.toContain(
                'left: 140px'
            );
            await fireEvent.pointerUp(acts);
        });

        it('opens the backlog with the current scene lines', async () => {
            const { rerenderAt } = renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            const tap = screen.getByLabelText('Tap to continue');
            await fireEvent.click(tap);
            await fireEvent.click(tap);
            await rerenderAt({ dialogueIndex: 1 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open history'));
            expect(
                screen.queryByLabelText('Back to Home')
            ).not.toBeInTheDocument();
            await waitFor(() => {
                expect(screen.getByText('History')).toBeInTheDocument();
            });
            expect(screen.getByText('First line.')).toBeInTheDocument();
            // Second line is the current line; it appears in both the active
            // reading box and the backlog.
            expect(screen.getAllByText('Second line.').length).toBeGreaterThan(
                0
            );
        });

        it('cancels in-flight typing without errors when unmounted mid-typewriter', async () => {
            const { unmount } = renderReader({ dialogueIndex: 0 });
            unmount();
            await vi.runAllTimersAsync();
            expect(
                screen.queryByLabelText('Tap to continue')
            ).not.toBeInTheDocument();
        });

        it('inerts the reader background while an overlay is open and restores it on close', async () => {
            renderReader({
                dialogueIndex: 0,
                storyId: 's',
                currentSceneId: 'b1a_act1',
            });
            await vi.runAllTimersAsync();
            const tap = screen.getByLabelText('Tap to continue');
            expect(tap.closest('[inert]')).toBeNull();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open acts panel'));
            expect(tap.closest('[inert]')).not.toBeNull();
            const closeBtn = screen.getAllByRole('button', {
                name: 'Close acts panel',
            })[0];
            expect(closeBtn.closest('[inert]')).toBeNull();
            await fireEvent.click(closeBtn);
            expect(tap.closest('[inert]')).toBeNull();
        });

        it('inerts the reader background while the backlog sheet is open', async () => {
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open history'));
            const tap = screen.getByLabelText('Tap to continue');
            expect(tap.closest('[inert]')).not.toBeNull();
        });

        it('hides the line-progress count when the dialogue is empty', async () => {
            renderReader({ dialogue: [], dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            expect(screen.queryByText('Line 1 of 0')).not.toBeInTheDocument();
        });

        it('restores focus to the persistent menu toggle after closing the acts drawer', async () => {
            renderReader({
                dialogueIndex: 0,
                storyId: 's',
                currentSceneId: 'b1a_act1',
            });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open acts panel'));
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
            renderReader({ dialogueIndex: 0 });
            await vi.runAllTimersAsync();
            await fireEvent.click(screen.getByLabelText('Open menu'));
            await fireEvent.click(screen.getByLabelText('Open history'));
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
});
