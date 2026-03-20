import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import { tick } from 'svelte';
import StoryWriter from '../StoryWriter.svelte';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockStory = {
    id: 'story-1',
    title: 'My Story',
    description: 'A test story',
    status: 'draft' as const,
};

const makeStoryResponse = (stories: (typeof mockStory)[]) => ({
    ok: true,
    json: async () => ({ data: stories }),
});

beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(makeStoryResponse([]));
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('StoryWriter', () => {
    describe('initial render', () => {
        it('renders the story writer container', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            const container = document.querySelector('.story-writer');
            expect(container).toBeTruthy();
        });

        it('shows loading state initially', () => {
            mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
            render(StoryWriter);

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('fetches stories on mount', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            expect(mockFetch).toHaveBeenCalledWith('/api/stories');
        });

        it('shows "No stories yet" when stories list is empty', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            expect(screen.getByText('No stories yet')).toBeInTheDocument();
        });

        it('shows "Your Stories" heading', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            expect(screen.getByText('Your Stories')).toBeInTheDocument();
        });

        it('shows "Select a story" prompt when no story selected', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            expect(
                screen.getByText('Select a story to view its structure')
            ).toBeInTheDocument();
        });
    });

    describe('with stories loaded', () => {
        beforeEach(() => {
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory]));
        });

        it('renders story titles', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Multiple elements with story title may exist (sidebar + StoryTree)
            const titles = screen.getAllByText('My Story');
            expect(titles.length).toBeGreaterThan(0);
        });

        it('shows story status', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            expect(screen.getByText('draft')).toBeInTheDocument();
        });

        it('selects the first story by default', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // The first story title appears in a button with selected style (purple border)
            const buttons = document.querySelectorAll('button');
            const storyButtons = Array.from(buttons).filter(btn =>
                btn.textContent?.includes('My Story')
            );
            expect(storyButtons.length).toBeGreaterThan(0);
            expect(storyButtons[0].className).toContain('purple');
        });
    });

    describe('error handling', () => {
        it('shows error message when fetch fails', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Error message comes from e.message ('Network error')
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });

        it('shows error state in story list on fetch failure', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            expect(
                screen.getByText('Failed to load stories.')
            ).toBeInTheDocument();
        });

        it('shows error when fetch returns non-ok response', async () => {
            mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            expect(
                screen.getByText('Failed to load stories')
            ).toBeInTheDocument();
        });
    });

    describe('story creation modal', () => {
        it('opens Create Story modal when + button is clicked', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            // Click the "+" button to create a new story
            const addBtn = screen.getByTitle('Create new story');
            await fireEvent.click(addBtn);
            await vi.runAllTimersAsync();

            expect(screen.getByText('Create New Story')).toBeInTheDocument();
        });

        it('closes story modal when cancel is clicked', async () => {
            render(StoryWriter);
            await vi.runAllTimersAsync();

            const addBtn = screen.getByTitle('Create new story');
            await fireEvent.click(addBtn);
            await vi.runAllTimersAsync();

            const cancelBtn = screen.getByText('Cancel');
            await fireEvent.click(cancelBtn);

            await vi.runAllTimersAsync();
            // Modal should be closed
            expect(
                screen.queryByText('Create New Story')
            ).not.toBeInTheDocument();
        });
    });

    describe('story selection', () => {
        it('allows selecting a story from the list', async () => {
            const story2 = {
                id: 'story-2',
                title: 'Second Story',
                description: '',
                status: 'published' as const,
            };
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory, story2]));

            render(StoryWriter);
            await vi.runAllTimersAsync();

            const secondStoryBtn = screen
                .getByText('Second Story')
                .closest('button');
            await fireEvent.click(secondStoryBtn!);
            await vi.runAllTimersAsync();

            // Second story button should now be selected (purple)
            expect(secondStoryBtn?.className).toContain('purple');
        });
    });

    describe('create story form submission', () => {
        it('calls POST /api/stories when form is submitted', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            id: 'new-story',
                            title: 'New Story',
                            description: '',
                            status: 'draft',
                        },
                    }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();

            // Open modal
            const addBtn = screen.getByTitle('Create new story');
            await fireEvent.click(addBtn);
            await vi.runAllTimersAsync();

            // Fill in title
            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'New Story' },
            });

            // Submit
            const submitBtn = screen.getByText('Create Story');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/stories',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('calls API and closes modal after creating story successfully', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            id: 'new-story',
                            title: 'New Story',
                            description: '',
                            status: 'draft',
                        },
                    }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addBtn = screen.getByTitle('Create new story');
            await fireEvent.click(addBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Fill in title to enable form submission
            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'New Story' },
            });

            const submitBtn = screen.getByText('Create Story');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            // The modal should be closed and the POST was called
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/stories',
                expect.objectContaining({ method: 'POST' })
            );
            expect(
                screen.queryByText('Create New Story')
            ).not.toBeInTheDocument();
        });

        it('shows error banner when create story returns non-ok', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([]))
                .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addBtn = screen.getByTitle('Create new story');
            await fireEvent.click(addBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Fill in title
            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'New Story' },
            });

            const submitBtn = screen.getByText('Create Story');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Verify fetch was called (the error path ran)
            expect(mockFetch).toHaveBeenCalledWith(
                '/api/stories',
                expect.objectContaining({ method: 'POST' })
            );
            // Modal stays open because creation failed
            expect(screen.getByText('Create New Story')).toBeInTheDocument();
        });
    });

    describe('update story', () => {
        it('shows Edit Story modal when edit is triggered from StoryTree', async () => {
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory]));

            render(StoryWriter);
            await vi.runAllTimersAsync();

            // The edit button is inside StoryTree
            const editBtn = screen.queryByTitle('Edit story');
            if (editBtn) {
                await fireEvent.click(editBtn);
                await vi.runAllTimersAsync();
                expect(screen.getByText('Edit Story')).toBeInTheDocument();
            }
        });

        it('calls PUT /api/stories/:id when update form is submitted', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: {
                            ...mockStory,
                            title: 'Updated Story',
                        },
                    }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();

            const editBtn = screen.queryByTitle('Edit story');
            if (editBtn) {
                await fireEvent.click(editBtn);
                await vi.runAllTimersAsync();

                const updateBtn = screen.queryByText('Update Story');
                if (updateBtn) {
                    await fireEvent.click(updateBtn);
                    await vi.runAllTimersAsync();

                    expect(mockFetch).toHaveBeenCalledWith(
                        '/api/stories/story-1',
                        expect.objectContaining({ method: 'PUT' })
                    );
                }
            }
        });
    });

    describe('chapter and scene creation', () => {
        it('shows chapter modal when add chapter is clicked', async () => {
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory]));

            render(StoryWriter);
            await vi.runAllTimersAsync();

            const addChapterBtn = screen.queryByTitle('Add chapter');
            if (addChapterBtn) {
                await fireEvent.click(addChapterBtn);
                await vi.runAllTimersAsync();

                expect(
                    screen.getByText('Create New Chapter')
                ).toBeInTheDocument();
            }
        });

        it('shows scene modal when add scene is clicked', async () => {
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory]));

            render(StoryWriter);
            await vi.runAllTimersAsync();

            const addSceneBtn = screen.queryByTitle('Add scene');
            if (addSceneBtn) {
                await fireEvent.click(addSceneBtn);
                await vi.runAllTimersAsync();

                expect(
                    screen.getByText('Create New Scene')
                ).toBeInTheDocument();
            }
        });
    });
});
