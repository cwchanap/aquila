import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import NovelReader from '../NovelReader.svelte';
import type { DialogueEntry, ChoiceDefinition } from '@aquila/stories';

// Mock @aquila/stories
vi.mock('@aquila/stories', () => {
    return {
        getStoryFlow: vi.fn(() => ({
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
                    next: 'b1a_act3',
                },
                {
                    kind: 'scene',
                    id: 'b1a_act3',
                    sceneId: 'b1a_act3',
                    next: null,
                },
            ],
        })),
        getTranslations: vi.fn((locale: string) => ({
            reader: {
                title: 'Novel Reader - Aquila',
                bookmarkPrompt: 'Enter bookmark name:',
                defaultBookmarkName: 'Scene:',
                bookmarkSaved: 'Bookmark saved!',
                bookmarkFailed: 'Failed to save bookmark:',
                bookmarkError: 'Failed to save bookmark. Please try again.',
                endOfStory: 'End of story!',
                unknown: 'Unknown',
                continue: 'Continue',
                nextScene: 'Next Scene',
                complete: 'Complete',
                bookmark: 'Bookmark',
                pageDisplay: '{current} / {total}',
                actPanel: 'Acts',
                actLabel: 'Act {n}',
                actFinal: 'Final Act',
                actEpilogue: 'Epilogue',
                openActsPanel: 'Open acts panel',
                closeActsPanel: 'Close acts panel',
            },
            characterNames: {
                narrator: 'Narrator',
                tanaka_kenta: '田中健太',
            },
            common: {
                logout: 'Logout',
                login: 'Login',
                back: 'Back',
                backToHome: 'Back to Home',
            },
            locale,
        })),
    };
});

// Controlled-component helper: tracks the index the parent would own and
// re-renders with the full prop bag when asked, simulating the store->props
// bridge (ReaderShell) lifting onIndexChange into a new dialogueIndex prop.
function renderReader(overrides: Record<string, unknown> = {}) {
    const onIndexChange = vi.fn();
    let current: Record<string, unknown> = {
        dialogue: mockDialogue,
        choice: null,
        locale: 'en',
        dialogueIndex: 0,
        ...overrides,
        onIndexChange: overrides.onIndexChange ?? onIndexChange,
    };
    const result = render(NovelReader, { props: current });
    const rerenderRaw = async (next: Record<string, unknown> = {}) => {
        current = { ...current, ...next };
        await result.rerender(current);
    };
    // Convenience: rerender then settle all timers (used when the test does not
    // need to inspect mid-animation state).
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

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator' as any, dialogue: 'First dialogue line.' },
    { characterId: 'narrator' as any, dialogue: 'Second dialogue line.' },
    { characterId: 'narrator' as any, dialogue: 'Third dialogue line.' },
];

const mockChoice: ChoiceDefinition = {
    prompt: 'What do you want to do?',
    options: [
        { id: 'option1', label: 'Option 1', nextScene: 'scene_2' },
        { id: 'option2', label: 'Option 2', nextScene: 'scene_3' },
    ],
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('NovelReader — controlled contract', () => {
    it('renders the active line at the dialogueIndex prop', async () => {
        renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });

    it('emits onIndexChange on Enter/click advance (and not while typing)', async () => {
        const { onIndexChange } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync(); // finish typing first line
        // Second Enter advances (emits onIndexChange); parent does NOT update
        // the prop here, so the component must still have emitted.
        await fireEvent.keyDown(window, { key: 'Enter' });
        expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('does NOT emit onIndexChange when a key during typing only skips', async () => {
        const { onIndexChange } = renderReader({ dialogueIndex: 0 });
        // Start typing but do not run all timers
        await vi.advanceTimersByTimeAsync(60);
        await fireEvent.keyDown(window, { key: 'Enter' }); // skip typing only
        await vi.advanceTimersByTimeAsync(50);
        expect(onIndexChange).not.toHaveBeenCalled();
    });

    it('renders visible history as the lines before dialogueIndex', async () => {
        // Parent has advanced to index 1: line 0 is history, line 1 animates.
        renderReader({ dialogueIndex: 1 });
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
        // Line 2 (index 2) should not yet be visible.
        expect(
            screen.queryByText('Third dialogue line.')
        ).not.toBeInTheDocument();
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
        expect(
            document.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0);
        await vi.runAllTimersAsync();
        expect(screen.getByText('New scene first line.')).toBeInTheDocument();
    });

    it('snaps to full text (no animation) on an external dialogueIndex change', async () => {
        const { rerenderRaw } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync(); // line 0 fully typed
        // Simulate popstate/restore: parent bumps index without an advance.
        await rerenderRaw({ dialogueIndex: 1 });
        // No typewriter cursor should be present (snap, not animate).
        expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        // Active line is fully visible right away (no timers needed to reveal it).
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
    });

    it('snaps (does not animate) when a popstate overrides the index in the same tick as an advance', async () => {
        // Regression guard for the same-tick selfAdvance race (spec §239-241).
        // A user advance sets selfAdvanceTarget = currentIndex + 1 and emits
        // onIndexChange. If a popstate lands in the same effect batch and the
        // parent rerenders with a DIFFERENT index, Signal 2 must snap (the
        // popstate's index !== the advance's target) rather than animate.
        // Under the old boolean selfAdvance, the flag would still be true and
        // the popstate's line would animate — violating the spec requirement
        // that popstate always snaps.
        const { rerenderRaw } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync(); // line 0 fully typed
        // User clicks Continue: sets selfAdvanceTarget = 1, emits onIndexChange(1).
        await fireEvent.click(screen.getByText('Continue'));
        // Before the parent lifts the index, a popstate overrides to index 2.
        // Do NOT settle timers — observe the snap state immediately after rerender.
        await rerenderRaw({ dialogueIndex: 2 });
        // No typewriter cursor → Signal 2 took the snap branch, not the animate one.
        expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        // The popstate's target line is fully visible (snap reveals it immediately).
        expect(screen.getByText('Third dialogue line.')).toBeInTheDocument();
    });

    it('animates (does not snap) when scene ref and index both change — lastIndex race regression', async () => {
        // Regression guard for `lastIndex = dialogueIndex` in Signal 1.
        // When a rerender swaps the dialogue array reference AND resets
        // dialogueIndex in the same tick, BOTH signals fire. Signal 1 must
        // sync `lastIndex = dialogueIndex` so Signal 2 does not mistake the
        // scene change for an external index change and snap away the
        // animation. Deleting that line makes this test fail.
        const { rerenderRaw } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync(); // line 0 fully typed, lastIndex == 0

        // Parent jumps to index 2: Signal 2 snaps, lastIndex becomes 2.
        await rerenderRaw({ dialogueIndex: 2 });
        await vi.runAllTimersAsync();

        // Scene change: NEW dialogue array reference AND reset to index 0.
        // Without `lastIndex = dialogueIndex` in Signal 1, Signal 2 sees
        // 0 !== 2 and snaps (isTyping stays false, cursor never appears).
        const newDialogue: DialogueEntry[] = [
            { characterId: 'narrator' as any, dialogue: 'New scene first.' },
            { characterId: 'narrator' as any, dialogue: 'New scene second.' },
            { characterId: 'narrator' as any, dialogue: 'New scene third.' },
        ];
        await rerenderRaw({ dialogue: newDialogue, dialogueIndex: 0 });

        // Do NOT settle timers — observe the mid-typing state. Signal 1
        // started animating (cursor visible) and Signal 2 did NOT snap.
        expect(
            document.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0);
    });

    it('snaps (does not animate) on first mount with a nonzero dialogueIndex (bookmark/deep-link restore)', async () => {
        // Regression guard for the first-mount restore case. When the reader
        // mounts with dialogueIndex > 0 (bookmark, deep link, or breakpoint
        // remount), Signal 1 must NOT animate the active line — the user
        // expects it fully revealed. A first Enter/click must advance, not
        // just skip typing.
        const { onIndexChange } = renderReader({ dialogueIndex: 1 });
        // No typewriter cursor should be present (snap, not animate).
        expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        // Active line is fully visible immediately, no timers needed.
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
        // First Enter advances (does NOT consume the tap as a skip-typing).
        await fireEvent.keyDown(window, { key: 'Enter' });
        expect(onIndexChange).toHaveBeenCalledWith(2);
    });
});

describe('NovelReader — basic rendering', () => {
    it('renders the component shell', () => {
        renderReader({ dialogueIndex: 0 });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });

    it('displays the resolved character name', async () => {
        renderReader({ dialogueIndex: 0 });
        await waitFor(() => {
            expect(screen.getAllByText('Narrator').length).toBeGreaterThan(0);
        });
    });

    it('shows the bookmark button when enabled', () => {
        renderReader({ showBookmarkButton: true });
        expect(screen.getByText('Bookmark')).toBeInTheDocument();
    });

    it('hides the bookmark button when disabled', () => {
        renderReader({ showBookmarkButton: false });
        expect(screen.queryByText('Bookmark')).not.toBeInTheDocument();
    });
});

describe('NovelReader — dialogue accumulation (controlled advance)', () => {
    it('accumulates dialogues when the parent lifts onIndexChange into the prop', async () => {
        const { onIndexChange, rerenderAt } = renderReader({
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();

        const continueBtn = screen.getByText('Continue');
        await fireEvent.click(continueBtn);
        expect(onIndexChange).toHaveBeenCalledWith(1);
        // Parent lifts the emitted index back into the prop.
        await rerenderAt({ dialogueIndex: 1 });

        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
    });

    it('keeps all previous dialogues visible across multiple advances', async () => {
        const { rerenderAt } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();

        let continueBtn = screen.getByText('Continue');
        await fireEvent.click(continueBtn);
        await rerenderAt({ dialogueIndex: 1 });
        continueBtn = screen.getByText('Continue');
        await fireEvent.click(continueBtn);
        await rerenderAt({ dialogueIndex: 2 });

        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
        expect(screen.getByText('Third dialogue line.')).toBeInTheDocument();
    });
});

describe('NovelReader — typing animation', () => {
    it('shows the typing cursor while typing', async () => {
        renderReader({ dialogueIndex: 0 });
        await vi.advanceTimersByTimeAsync(100);
        expect(
            document.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0);
    });

    it('completes the full text after timers elapse', async () => {
        renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });

    it('skips to the full line when Enter is pressed during typing', async () => {
        renderReader({ dialogueIndex: 0 });
        await vi.advanceTimersByTimeAsync(100);
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.advanceTimersByTimeAsync(50);
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });
});

describe('NovelReader — keyboard navigation', () => {
    it('emits onIndexChange on Enter', async () => {
        const { onIndexChange, rerenderAt } = renderReader({
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync();
        await fireEvent.keyDown(window, { key: 'Enter' });
        expect(onIndexChange).toHaveBeenCalledWith(1);
        await rerenderAt({ dialogueIndex: 1 });
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
    });

    it('emits onIndexChange on Space', async () => {
        const { onIndexChange } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        await fireEvent.keyDown(window, { key: ' ' });
        expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('ignores unrelated keys', async () => {
        const { onIndexChange } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        await fireEvent.keyDown(window, { key: 'a' });
        expect(onIndexChange).not.toHaveBeenCalled();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });
});

describe('NovelReader — scene changes', () => {
    it('clears history and animates the new scene first line', async () => {
        const { rerenderAt } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByText('Continue'));
        await rerenderAt({ dialogueIndex: 1 });
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        const newDialogue: DialogueEntry[] = [
            { characterId: 'narrator', dialogue: 'New scene dialogue.' },
        ];
        await rerenderAt({ dialogue: newDialogue, dialogueIndex: 0 });
        await vi.runAllTimersAsync();

        expect(
            screen.queryByText('First dialogue line.')
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Second dialogue line.')
        ).not.toBeInTheDocument();
        expect(screen.getByText('New scene dialogue.')).toBeInTheDocument();
    });
});

describe('NovelReader — choice handling', () => {
    it('shows choices after the last dialogue', async () => {
        renderReader({
            dialogue: [mockDialogue[0]],
            dialogueIndex: 0,
            choice: mockChoice,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('What do you want to do?')).toBeInTheDocument();
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('calls onChoice when an option is clicked', async () => {
        const onChoice = vi.fn();
        renderReader({
            dialogue: [mockDialogue[0]],
            dialogueIndex: 0,
            choice: mockChoice,
            onChoice,
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByText('Option 1'));
        expect(onChoice).toHaveBeenCalledWith('scene_2');
    });

    it('hides choices before the last dialogue', async () => {
        renderReader({ dialogueIndex: 0, choice: mockChoice });
        await vi.runAllTimersAsync();
        expect(
            screen.queryByText('What do you want to do?')
        ).not.toBeInTheDocument();
    });
});

describe('NovelReader — navigation buttons', () => {
    it('shows Continue for a non-last dialogue', async () => {
        renderReader({ dialogueIndex: 0, canGoNext: false });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    it('shows Next Scene on the last dialogue when canGoNext', async () => {
        renderReader({
            dialogue: [mockDialogue[0]],
            dialogueIndex: 0,
            canGoNext: true,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Next Scene')).toBeInTheDocument();
    });

    it('shows Complete on the last dialogue when not canGoNext', async () => {
        renderReader({
            dialogue: [mockDialogue[0]],
            dialogueIndex: 0,
            canGoNext: false,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('calls onNext when the next-scene button is clicked', async () => {
        const onNext = vi.fn();
        renderReader({
            dialogue: [mockDialogue[0]],
            dialogueIndex: 0,
            canGoNext: true,
            onNext,
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByText('Next Scene'));
        expect(onNext).toHaveBeenCalled();
    });
});

describe('NovelReader — bookmark & progress', () => {
    it('calls onBookmark with dialogueIndex + 1', async () => {
        const onBookmark = vi.fn();
        renderReader({
            dialogueIndex: 0,
            onBookmark,
            showBookmarkButton: true,
        });
        await fireEvent.click(screen.getByText('Bookmark'));
        expect(onBookmark).toHaveBeenCalledWith(1);
    });

    it('shows progress (dialogueIndex + 1) / total', async () => {
        renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('updates progress as the index advances', async () => {
        const { rerenderAt } = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();
        await fireEvent.click(screen.getByText('Continue'));
        await rerenderAt({ dialogueIndex: 1 });
        expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });
});

describe('NovelReader — localization & back button', () => {
    it('renders with the Chinese locale', () => {
        renderReader({ locale: 'zh' });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });

    it('uses the provided backUrl', () => {
        renderReader({ backUrl: '/en/stories' });
        const backLink = screen.getByText('Back to Home').closest('a');
        expect(backLink).toHaveAttribute('href', '/en/stories');
    });

    it('defaults the back URL to /', () => {
        renderReader({});
        const backLink = screen.getByText('Back to Home').closest('a');
        expect(backLink).toHaveAttribute('href', '/');
    });
});

describe('NovelReader — character display name priority', () => {
    it('prefers the emitted character displayName over the localized name', async () => {
        renderReader({
            dialogue: [
                {
                    characterId: 'tanaka_kenta' as any,
                    character: '健談男大生',
                    dialogue: 'Some line.',
                },
            ],
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('健談男大生')).toBeInTheDocument();
        expect(screen.queryByText('田中健太')).not.toBeInTheDocument();
    });

    it('falls back to the localized name when the character field is absent', async () => {
        renderReader({
            dialogue: [
                { characterId: 'narrator' as any, dialogue: 'Narrator line.' },
            ],
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync();
        expect(screen.getAllByText('Narrator').length).toBeGreaterThan(0);
    });

    it('prefers the character field even when a localized name exists', async () => {
        renderReader({
            dialogue: [
                {
                    characterId: 'narrator' as any,
                    character: '旁白',
                    dialogue: 'Chinese line.',
                },
            ],
            dialogueIndex: 0,
            locale: 'zh',
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('旁白')).toBeInTheDocument();
    });
});

describe('NovelReader — act panel navigation guard', () => {
    it('does not call onNavigate when closing on the same sceneId', async () => {
        const onNavigate = vi.fn();
        renderReader({
            dialogueIndex: 0,
            storyId: 'test_story',
            currentSceneId: 'b1a_act1',
            onNavigate,
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(
            screen.getByRole('button', { name: 'Open acts panel' })
        );
        await waitFor(() =>
            expect(screen.getByText('Act 1')).toBeInTheDocument()
        );
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('calls onNavigate when the act panel selects a different scene', async () => {
        const onNavigate = vi.fn();
        renderReader({
            dialogueIndex: 0,
            storyId: 'test_story',
            currentSceneId: 'b1a_act1',
            onNavigate,
        });
        await vi.runAllTimersAsync();
        await fireEvent.click(
            screen.getByRole('button', { name: 'Open acts panel' })
        );
        await waitFor(() =>
            expect(screen.getByText('Act 2')).toBeInTheDocument()
        );
        await fireEvent.click(screen.getByText('Act 2'));
        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
    });
});

describe('NovelReader — edge cases', () => {
    it('handles an empty dialogue array without crashing', () => {
        renderReader({ dialogue: [], dialogueIndex: 0 });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });

    it('handles a dialogue without a character', async () => {
        renderReader({
            dialogue: [{ dialogue: 'Anonymous dialogue.' }],
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Anonymous dialogue.')).toBeInTheDocument();
    });

    it('falls back to "Unknown" when characterNames is missing', async () => {
        const { getTranslations } = await import('@aquila/stories');
        (getTranslations as ReturnType<typeof vi.fn>).mockReturnValueOnce({
            reader: {
                unknown: 'Unknown',
                continue: 'Continue',
                nextScene: 'Next Scene',
                complete: 'Complete',
                bookmark: 'Bookmark',
                pageDisplay: '{current} / {total}',
                actPanel: 'Acts',
                actLabel: 'Act {n}',
                openActsPanel: 'Open acts panel',
                closeActsPanel: 'Close acts panel',
            },
            common: {
                logout: 'Logout',
                login: 'Login',
                back: 'Back',
                backToHome: 'Back to Home',
            },
            locale: 'en',
        });
        renderReader({
            dialogue: [
                {
                    characterId: 'unknown_char' as any,
                    dialogue: 'Missing names line.',
                },
            ],
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Unknown')).toBeInTheDocument();
        expect(screen.getByText('Missing names line.')).toBeInTheDocument();
    });
});
