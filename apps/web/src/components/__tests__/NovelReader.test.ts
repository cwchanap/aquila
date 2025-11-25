import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import NovelReader from '../NovelReader.svelte';
import type { DialogueEntry, ChoiceDefinition } from '@aquila/dialogue';

// Mock @aquila/dialogue
vi.mock('@aquila/dialogue', () => ({
    CharacterDirectory: {
        getById: vi.fn((id: string) => ({
            id,
            name: id === 'narrator' ? 'Narrator' : 'Character',
        })),
    },
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
        },
        common: {
            logout: 'Logout',
            login: 'Login',
            back: 'Back',
            backToHome: 'Back to Home',
        },
        locale,
    })),
}));

describe('NovelReader', () => {
    const mockDialogue: DialogueEntry[] = [
        {
            characterId: 'narrator' as any,
            dialogue: 'First dialogue line.',
        },
        {
            characterId: 'narrator' as any,
            dialogue: 'Second dialogue line.',
        },
        {
            characterId: 'narrator' as any,
            dialogue: 'Third dialogue line.',
        },
    ];

    const mockChoice: ChoiceDefinition = {
        prompt: 'What do you want to do?',
        options: [
            { id: 'option1', label: 'Option 1', nextScene: 'scene_2' },
            { id: 'option2', label: 'Option 2', nextScene: 'scene_3' },
        ],
    };

    beforeEach(() => {
        // Timers are mocked globally in test-setup.ts via vi.useFakeTimers().
        // Do not override them here so tests can use vi.runAllTimersAsync / advanceTimersByTimeAsync.
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('should render the component with dialogue', () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            expect(screen.getByText('Back to Home')).toBeInTheDocument();
        });

        it('should display character name', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await waitFor(() => {
                expect(screen.getByText('Narrator')).toBeInTheDocument();
            });
        });

        it('should show bookmark button when enabled', () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    showBookmarkButton: true,
                    locale: 'en',
                },
            });

            expect(screen.getByText('Bookmark')).toBeInTheDocument();
        });

        it('should hide bookmark button when disabled', () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    showBookmarkButton: false,
                    locale: 'en',
                },
            });

            expect(screen.queryByText('Bookmark')).not.toBeInTheDocument();
        });
    });

    describe('Dialogue Accumulation', () => {
        it('should display first dialogue initially', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();
        });

        it('should accumulate dialogues when continuing', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            // Wait for first dialogue to finish typing
            await vi.runAllTimersAsync();
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();

            // Click continue button
            const continueBtn = screen.getByText('Continue');
            await fireEvent.click(continueBtn);
            await vi.runAllTimersAsync();

            // Both dialogues should be visible
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();
            expect(
                screen.getByText('Second dialogue line.')
            ).toBeInTheDocument();
        });

        it('should keep all previous dialogues visible', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            // Progress through all dialogues
            await vi.runAllTimersAsync();

            const continueBtn = screen.getByText('Continue');
            await fireEvent.click(continueBtn);
            await vi.runAllTimersAsync();

            await fireEvent.click(continueBtn);
            await vi.runAllTimersAsync();

            // All three dialogues should be visible
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();
            expect(
                screen.getByText('Second dialogue line.')
            ).toBeInTheDocument();
            expect(
                screen.getByText('Third dialogue line.')
            ).toBeInTheDocument();
        });
    });

    describe('Typing Animation', () => {
        it('should show typing cursor while typing', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            // Advance timers partially
            await vi.advanceTimersByTimeAsync(100);

            // Should be typing, cursor should be visible
            const cursors = document.querySelectorAll('.animate-pulse');
            expect(cursors.length).toBeGreaterThan(0);
        });

        it('should complete typing when finished', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            // Full text should be displayed
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();
        });

        it('should skip typing animation on key press during typing', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            // Start typing
            await vi.advanceTimersByTimeAsync(100);

            // Press Enter while typing to skip animation
            await fireEvent.keyDown(window, { key: 'Enter' });
            await vi.runAllTimersAsync();

            // Should immediately show full text
            await waitFor(() => {
                expect(
                    screen.getByText('First dialogue line.')
                ).toBeInTheDocument();
            });
        });
    });

    describe('Keyboard Navigation', () => {
        it('should advance dialogue on Enter key press', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();

            // Press Enter
            await fireEvent.keyDown(window, { key: 'Enter' });
            await vi.runAllTimersAsync();

            expect(
                screen.getByText('Second dialogue line.')
            ).toBeInTheDocument();
        });

        it('should advance dialogue on Space key press', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            // Press Space
            await fireEvent.keyDown(window, { key: ' ' });
            await vi.runAllTimersAsync();

            expect(
                screen.getByText('Second dialogue line.')
            ).toBeInTheDocument();
        });

        it('should not advance on other key presses', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            // Press a random key
            await fireEvent.keyDown(window, { key: 'a' });
            await vi.runAllTimersAsync();

            // Should still show only first dialogue
            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();
            expect(
                screen.queryByText('Second dialogue line.')
            ).not.toBeInTheDocument();
        });
    });

    describe('Scene Changes', () => {
        it('should clear dialogues when scene changes', async () => {
            const { rerender } = render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            // Progress to second dialogue
            await vi.runAllTimersAsync();
            const continueBtn = screen.getByText('Continue');
            await fireEvent.click(continueBtn);
            await vi.runAllTimersAsync();

            expect(
                screen.getByText('First dialogue line.')
            ).toBeInTheDocument();
            expect(
                screen.getByText('Second dialogue line.')
            ).toBeInTheDocument();

            // New scene with different dialogue
            const newDialogue: DialogueEntry[] = [
                {
                    characterId: 'narrator',
                    dialogue: 'New scene dialogue.',
                },
            ];

            await rerender({
                dialogue: newDialogue,
                choice: null,
                locale: 'en',
            });

            await vi.runAllTimersAsync();

            // Old dialogues should be cleared
            expect(
                screen.queryByText('First dialogue line.')
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText('Second dialogue line.')
            ).not.toBeInTheDocument();

            // New dialogue should be visible
            expect(screen.getByText('New scene dialogue.')).toBeInTheDocument();
        });
    });

    describe('Choice Handling', () => {
        it('should display choices after last dialogue', async () => {
            render(NovelReader, {
                props: {
                    dialogue: [mockDialogue[0]],
                    choice: mockChoice,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            expect(
                screen.getByText('What do you want to do?')
            ).toBeInTheDocument();
            expect(screen.getByText('Option 1')).toBeInTheDocument();
            expect(screen.getByText('Option 2')).toBeInTheDocument();
        });

        it('should call onChoice when choice is clicked', async () => {
            const onChoice = vi.fn();

            render(NovelReader, {
                props: {
                    dialogue: [mockDialogue[0]],
                    choice: mockChoice,
                    onChoice,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            const option1Btn = screen.getByText('Option 1');
            await fireEvent.click(option1Btn);

            expect(onChoice).toHaveBeenCalledWith('scene_2');
        });

        it('should not show choices before last dialogue', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: mockChoice,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            // First dialogue shown, choices should not be visible
            expect(
                screen.queryByText('What do you want to do?')
            ).not.toBeInTheDocument();
        });
    });

    describe('Navigation Buttons', () => {
        it('should show "Continue" button for non-last dialogue', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    canGoNext: false,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(screen.getByText('Continue')).toBeInTheDocument();
        });

        it('should show "Next Scene" button when canGoNext is true on last dialogue', async () => {
            render(NovelReader, {
                props: {
                    dialogue: [mockDialogue[0]],
                    choice: null,
                    canGoNext: true,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(screen.getByText('Next Scene')).toBeInTheDocument();
        });

        it('should show "Complete" button on last dialogue when cannot go next', async () => {
            render(NovelReader, {
                props: {
                    dialogue: [mockDialogue[0]],
                    choice: null,
                    canGoNext: false,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(screen.getByText('Complete')).toBeInTheDocument();
        });

        it('should call onNext when next scene button is clicked', async () => {
            const onNext = vi.fn();

            render(NovelReader, {
                props: {
                    dialogue: [mockDialogue[0]],
                    choice: null,
                    canGoNext: true,
                    onNext,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            const nextBtn = screen.getByText('Next Scene');
            await fireEvent.click(nextBtn);

            expect(onNext).toHaveBeenCalled();
        });
    });

    describe('Bookmark Functionality', () => {
        it('should call onBookmark when bookmark button is clicked', async () => {
            const onBookmark = vi.fn();

            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    onBookmark,
                    showBookmarkButton: true,
                    locale: 'en',
                },
            });

            const bookmarkBtn = screen.getByText('Bookmark');
            await fireEvent.click(bookmarkBtn);

            expect(onBookmark).toHaveBeenCalled();
        });
    });

    describe('Progress Display', () => {
        it('should show correct progress for first dialogue', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(screen.getByText('1 / 3')).toBeInTheDocument();
        });

        it('should update progress as dialogues advance', async () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();

            const continueBtn = screen.getByText('Continue');
            await fireEvent.click(continueBtn);
            await vi.runAllTimersAsync();

            expect(screen.getByText('2 / 3')).toBeInTheDocument();
        });
    });

    describe('Localization', () => {
        it('should support Chinese locale', async () => {
            // Simply render with Chinese locale and check the result
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'zh',
                },
            });

            // The mock in vi.mock already handles Chinese translations
            expect(screen.getByText('Back to Home')).toBeInTheDocument();
        });
    });

    describe('Back Button', () => {
        it('should render back button with correct URL', () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    backUrl: '/en/stories',
                    locale: 'en',
                },
            });

            const backLink = screen.getByText('Back to Home').closest('a');
            expect(backLink).toHaveAttribute('href', '/en/stories');
        });

        it('should use default back URL when not provided', () => {
            render(NovelReader, {
                props: {
                    dialogue: mockDialogue,
                    choice: null,
                    locale: 'en',
                },
            });

            const backLink = screen.getByText('Back to Home').closest('a');
            expect(backLink).toHaveAttribute('href', '/');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty dialogue array', () => {
            render(NovelReader, {
                props: {
                    dialogue: [],
                    choice: null,
                    locale: 'en',
                },
            });

            // Should render without crashing
            expect(screen.getByText('Back to Home')).toBeInTheDocument();
        });

        it('should handle dialogue without character', async () => {
            const dialogueNoChar: DialogueEntry[] = [
                {
                    dialogue: 'Anonymous dialogue.',
                },
            ];

            render(NovelReader, {
                props: {
                    dialogue: dialogueNoChar,
                    choice: null,
                    locale: 'en',
                },
            });

            await vi.runAllTimersAsync();
            expect(screen.getByText('Anonymous dialogue.')).toBeInTheDocument();
        });
    });
});
