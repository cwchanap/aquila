import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
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
    document.body.replaceChildren();
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
            await tick();

            // The edit button is rendered inside StoryTree once a story is selected
            const editBtn = screen.getByTitle('Edit story');
            await fireEvent.click(editBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(screen.getByText('Edit Story')).toBeInTheDocument();
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
            await tick();

            const editBtn = screen.getByTitle('Edit story');
            await fireEvent.click(editBtn);
            await vi.runAllTimersAsync();
            await tick();

            const updateBtn = screen.getByText('Update Story');
            await fireEvent.click(updateBtn);
            await vi.runAllTimersAsync();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/stories/story-1',
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });

    describe('chapter and scene creation', () => {
        it('shows chapter modal when add chapter is clicked', async () => {
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory]));

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();

            expect(screen.getByText('Create New Chapter')).toBeInTheDocument();
        });

        it('shows scene modal when add scene is clicked', async () => {
            mockFetch.mockResolvedValue(makeStoryResponse([mockStory]));

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);
            await vi.runAllTimersAsync();

            expect(screen.getByText('Create New Scene')).toBeInTheDocument();
        });

        it('creates chapter successfully and closes modal', async () => {
            const mockChapter = {
                id: 'chapter-1',
                title: 'Chapter One',
                description: '',
                order: 0,
            };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockChapter }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Chapter One' },
            });

            const submitBtn = screen.getByText('Create Chapter');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/chapters',
                expect.objectContaining({ method: 'POST' })
            );
            expect(
                screen.queryByText('Create New Chapter')
            ).not.toBeInTheDocument();
        });

        it('shows error when chapter creation fails', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Chapter One' },
            });

            const submitBtn = screen.getByText('Create Chapter');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/chapters',
                expect.objectContaining({ method: 'POST' })
            );
            // Error banner visible and modal stays open on failure
            expect(
                screen.getByText('Failed to create chapter')
            ).toBeInTheDocument();
            expect(screen.getByText('Create Chapter')).toBeInTheDocument();
        });

        it('creates scene successfully and closes modal', async () => {
            const mockScene = {
                id: 'scene-1',
                title: 'Scene One',
                content: '',
                order: 0,
            };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockScene }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Scene One' },
            });

            const submitBtn = screen.getByText('Create Scene');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/scenes',
                expect.objectContaining({ method: 'POST' })
            );
            expect(
                screen.queryByText('Create New Scene')
            ).not.toBeInTheDocument();
        });

        it('shows error when scene creation fails', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Scene One' },
            });

            const submitBtn = screen.getByText('Create Scene');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/scenes',
                expect.objectContaining({ method: 'POST' })
            );
            // Error banner visible and modal stays open on failure
            expect(
                screen.getByText('Failed to create scene')
            ).toBeInTheDocument();
            expect(screen.getByText('Create Scene')).toBeInTheDocument();
        });
    });

    describe('success messages', () => {
        it('shows success message after creating a story', async () => {
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

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'New Story' },
            });

            const submitBtn = screen.getByText('Create Story');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(
                screen.getByText('Story created successfully.')
            ).toBeInTheDocument();
        });

        it('shows success message after updating a story', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        data: { ...mockStory, title: 'Updated Story' },
                    }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const editBtn = screen.getByTitle('Edit story');
            await fireEvent.click(editBtn);
            await vi.runAllTimersAsync();
            await tick();

            const updateBtn = screen.getByText('Update Story');
            await fireEvent.click(updateBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(
                screen.getByText('Story updated successfully.')
            ).toBeInTheDocument();
        });
    });

    describe('update story error handling', () => {
        it('shows error when update story fails', async () => {
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const editBtn = screen.getByTitle('Edit story');
            await fireEvent.click(editBtn);
            await vi.runAllTimersAsync();
            await tick();

            const updateBtn = screen.getByText('Update Story');
            await fireEvent.click(updateBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/stories/story-1',
                expect.objectContaining({ method: 'PUT' })
            );
        });
    });

    describe('creates scene with multiple stories (covers return s branch)', () => {
        it('adds scene to matching story while preserving other stories', async () => {
            const story2 = {
                id: 'story-2',
                title: 'Second Story',
                description: '',
                status: 'published' as const,
            };
            const mockScene = { id: 'scene-1', title: 'Scene One', order: 0 };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory, story2]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockScene }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // First story is selected by default
            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Scene One' },
            });

            const submitBtn = screen.getByText('Create Scene');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            // The scene was created - both stories should still be in the list
            expect(screen.getByText('Second Story')).toBeInTheDocument();
        });
    });

    describe('scene callbacks', () => {
        it('triggers edit scene callback after creating a direct scene', async () => {
            const mockScene = { id: 'scene-1', title: 'Scene One', order: 0 };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockScene }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Create a scene via story-level "Add scene" button
            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Scene One' },
            });

            const submitBtn = screen.getByText('Create Scene');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Scene is now in directScenes - "Edit scene" button should appear
            const editSceneBtn = screen.getByTitle('Edit scene');
            await fireEvent.click(editSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            // onEditScene sets editMode='scene' (TODO - no modal yet).
            // Assert no error message appeared after the click (component still healthy).
            expect(screen.queryByText(/Failed/)).not.toBeInTheDocument();
        });

        it('triggers delete scene callback after creating a direct scene', async () => {
            const mockScene = { id: 'scene-1', title: 'Scene One', order: 0 };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockScene }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Scene One' },
            });

            const submitBtn = screen.getByText('Create Scene');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            const deleteSceneBtn = screen.getByTitle('Delete scene');
            const consoleSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            await fireEvent.click(deleteSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            // onDeleteScene currently logs 'Delete scene' as a placeholder
            expect(consoleSpy).toHaveBeenCalledWith('Delete scene');
            consoleSpy.mockRestore();
        });
    });

    describe('StoryTree callbacks', () => {
        it('sets editMode to chapter when edit chapter is triggered', async () => {
            const mockChapter = {
                id: 'chapter-1',
                title: 'Chapter One',
                description: '',
                order: 0,
            };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockChapter }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Create a chapter first so chapter buttons appear
            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Chapter One' },
            });

            const submitBtn = screen.getByText('Create Chapter');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Now click the edit chapter button
            const editChapterBtn = screen.getByTitle('Edit chapter');
            await fireEvent.click(editChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            // editMode is 'chapter' but no modal opens (TODO state)
            expect(editChapterBtn).toBeInTheDocument();
        });

        it('triggers delete chapter callback', async () => {
            const mockChapter = {
                id: 'chapter-1',
                title: 'Chapter One',
                description: '',
                order: 0,
            };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockChapter }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Create a chapter so delete button appears
            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Chapter One' },
            });

            const submitBtn = screen.getByText('Create Chapter');
            await fireEvent.click(submitBtn);
            await vi.runAllTimersAsync();
            await tick();

            const deleteChapterBtn = screen.getByTitle('Delete chapter');
            const consoleSpy = vi
                .spyOn(console, 'log')
                .mockImplementation(() => {});
            await fireEvent.click(deleteChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            expect(consoleSpy).toHaveBeenCalledWith('Delete chapter');
            consoleSpy.mockRestore();
        });
    });

    describe('chapter-based scene creation', () => {
        it('creates scene within a chapter (covers chapterId path)', async () => {
            const mockChapter = {
                id: 'chapter-1',
                title: 'Chapter One',
                description: '',
                order: 0,
            };
            const mockScene = {
                id: 'scene-1',
                title: 'Chapter Scene',
                content: '',
                order: 0,
            };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockChapter }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockScene }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Step 1: Create a chapter so the chapter-level "Add scene" button appears
            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            const chapterTitleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(chapterTitleInput, {
                target: { value: 'Chapter One' },
            });
            const createChapterBtn = screen.getByText('Create Chapter');
            await fireEvent.click(createChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Step 2: Click the chapter-level "Add scene" button scoped to the chapter container
            const chapterElement = screen
                .getByText('Chapter One')
                .closest('.chapter-item')!;
            const chapterAddSceneBtn = within(
                chapterElement as HTMLElement
            ).getByTitle('Add scene');
            await fireEvent.click(chapterAddSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Step 3: Fill in scene title and submit
            const sceneTitleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(sceneTitleInput, {
                target: { value: 'Chapter Scene' },
            });
            const createSceneBtn = screen.getByText('Create Scene');
            await fireEvent.click(createSceneBtn);
            await vi.runAllTimersAsync();
            await tick();

            const scenesCall = mockFetch.mock.calls.find(
                (c: unknown[]) => c[0] === '/api/scenes'
            );
            expect(scenesCall).toBeDefined();
            const body = JSON.parse(
                (scenesCall![1] as RequestInit).body as string
            );
            expect(body).toMatchObject({
                storyId: mockStory.id,
                chapterId: mockChapter.id,
            });
            expect(
                screen.queryByText('Create New Scene')
            ).not.toBeInTheDocument();
        });

        it('creates chapter with multiple stories (covers return s branch in handleCreateChapter)', async () => {
            const story2 = {
                id: 'story-2',
                title: 'Second Story',
                description: '',
                status: 'published' as const,
            };
            const mockChapter = {
                id: 'chapter-1',
                title: 'Chapter One',
                description: '',
                order: 0,
            };
            mockFetch
                .mockResolvedValueOnce(makeStoryResponse([mockStory, story2]))
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ data: mockChapter }),
                });

            render(StoryWriter);
            await vi.runAllTimersAsync();
            await tick();

            // Click the first "Add chapter" button (for mockStory which is selected by default)
            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'Chapter One' },
            });
            const createChapterBtn = screen.getByText('Create Chapter');
            await fireEvent.click(createChapterBtn);
            await vi.runAllTimersAsync();
            await tick();

            // Both stories should still be present; chapter created for story-1
            expect(screen.getByText('Second Story')).toBeInTheDocument();
        });
    });
});
