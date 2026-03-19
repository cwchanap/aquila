import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import StoryTree from '../ui/StoryTree.svelte';

const makeStory = (overrides = {}) => ({
    id: 'story-1',
    title: 'My Story',
    chapters: [],
    directScenes: [],
    ...overrides,
});

const makeChapter = (overrides = {}) => ({
    id: 'chapter-1',
    title: 'Chapter One',
    order: 1,
    scenes: [],
    ...overrides,
});

const makeScene = (overrides = {}) => ({
    id: 'scene-1',
    title: 'Scene One',
    order: 1,
    ...overrides,
});

describe('StoryTree', () => {
    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('Story rendering', () => {
        it('renders the story title', () => {
            render(StoryTree, { props: { story: makeStory() } });

            expect(screen.getByText('My Story')).toBeInTheDocument();
        });

        it('renders the story container', () => {
            const { container } = render(StoryTree, {
                props: { story: makeStory() },
            });

            expect(container.querySelector('.story-tree')).toBeInTheDocument();
        });

        it('is expanded by default (showing chapter area)', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [makeChapter()],
                    }),
                },
            });

            expect(screen.getByText('Chapter One')).toBeInTheDocument();
        });
    });

    describe('Story expand/collapse', () => {
        it('collapses the story when the story toggle button is clicked', async () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [makeChapter()],
                    }),
                },
            });

            expect(screen.getByText('Chapter One')).toBeInTheDocument();

            // The first button inside story-root is the toggle
            const storyRoot = document.querySelector('.story-root')!;
            const toggleBtn = storyRoot.querySelector('button')!;
            await fireEvent.click(toggleBtn);

            expect(screen.queryByText('Chapter One')).not.toBeInTheDocument();
        });

        it('re-expands after collapse', async () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [makeChapter()],
                    }),
                },
            });

            const storyRoot = document.querySelector('.story-root')!;
            const toggleBtn = storyRoot.querySelector('button')!;

            // Collapse
            await fireEvent.click(toggleBtn);
            expect(screen.queryByText('Chapter One')).not.toBeInTheDocument();

            // Re-expand
            await fireEvent.click(toggleBtn);
            expect(screen.getByText('Chapter One')).toBeInTheDocument();
        });
    });

    describe('Chapter rendering', () => {
        it('renders chapter title', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [makeChapter({ title: 'The Beginning' })],
                    }),
                },
            });

            expect(screen.getByText('The Beginning')).toBeInTheDocument();
        });

        it('renders scene count for chapter', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [
                            makeChapter({
                                scenes: [
                                    makeScene(),
                                    makeScene({ id: 'scene-2', order: 2 }),
                                ],
                            }),
                        ],
                    }),
                },
            });

            expect(screen.getByText('(2 scenes)')).toBeInTheDocument();
        });

        it('renders multiple chapters sorted by order', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [
                            makeChapter({
                                id: 'ch-2',
                                title: 'Chapter Two',
                                order: 2,
                            }),
                            makeChapter({
                                id: 'ch-1',
                                title: 'Chapter One',
                                order: 1,
                            }),
                        ],
                    }),
                },
            });

            // getAllByText returns elements in DOM order, so this asserts sorting by `order`
            const chapterTitles = screen.getAllByText(/Chapter (One|Two)/);
            expect(chapterTitles).toHaveLength(2);
            expect(chapterTitles[0]).toHaveTextContent('Chapter One');
            expect(chapterTitles[1]).toHaveTextContent('Chapter Two');
        });

        it('chapters are collapsed by default', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [
                            makeChapter({
                                scenes: [makeScene({ title: 'Inner Scene' })],
                            }),
                        ],
                    }),
                },
            });

            // Scene should not be visible since chapter is collapsed
            expect(screen.queryByText('Inner Scene')).not.toBeInTheDocument();
        });
    });

    describe('Chapter expand/collapse', () => {
        it('renders a toggle button for each chapter', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [
                            makeChapter({
                                scenes: [makeScene({ title: 'Hidden Scene' })],
                            }),
                        ],
                    }),
                },
            });

            const chapterItem = document.querySelector('.chapter-item')!;
            const toggleBtn = chapterItem.querySelector('button');
            expect(toggleBtn).toBeInTheDocument();
        });

        it('scenes are hidden in chapter when chapter starts collapsed', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        chapters: [
                            makeChapter({
                                scenes: [makeScene({ title: 'Hidden Scene' })],
                            }),
                        ],
                    }),
                },
            });

            // Chapter starts collapsed, so scene should not be visible
            expect(screen.queryByText('Hidden Scene')).not.toBeInTheDocument();
        });
    });

    describe('Direct scenes', () => {
        it('renders direct scenes (no chapter)', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        directScenes: [makeScene({ title: 'Direct Scene' })],
                    }),
                },
            });

            expect(screen.getByText('Direct Scene')).toBeInTheDocument();
        });

        it('shows "Individual Scenes" label for direct scenes', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({
                        directScenes: [makeScene()],
                    }),
                },
            });

            expect(screen.getByText('Individual Scenes')).toBeInTheDocument();
        });

        it('does not show "Individual Scenes" label when there are no direct scenes', () => {
            render(StoryTree, {
                props: {
                    story: makeStory({ directScenes: [] }),
                },
            });

            expect(
                screen.queryByText('Individual Scenes')
            ).not.toBeInTheDocument();
        });
    });

    describe('Callbacks', () => {
        it('calls onEditStory when edit story button is clicked', async () => {
            const onEditStory = vi.fn();
            render(StoryTree, {
                props: { story: makeStory(), onEditStory },
            });

            const editBtn = screen.getByTitle('Edit story');
            await fireEvent.click(editBtn);

            expect(onEditStory).toHaveBeenCalledWith('story-1');
        });

        it('calls onAddChapter when add chapter button is clicked', async () => {
            const onAddChapter = vi.fn();
            render(StoryTree, {
                props: { story: makeStory(), onAddChapter },
            });

            const addChapterBtn = screen.getByTitle('Add chapter');
            await fireEvent.click(addChapterBtn);

            expect(onAddChapter).toHaveBeenCalledWith('story-1');
        });

        it('calls onAddScene when add scene button on story is clicked', async () => {
            const onAddScene = vi.fn();
            render(StoryTree, {
                props: { story: makeStory(), onAddScene },
            });

            const addSceneBtn = screen.getByTitle('Add scene');
            await fireEvent.click(addSceneBtn);

            expect(onAddScene).toHaveBeenCalledWith('story-1');
        });

        it('calls onEditChapter with chapter id when edit chapter button is clicked', async () => {
            const onEditChapter = vi.fn();
            render(StoryTree, {
                props: {
                    story: makeStory({ chapters: [makeChapter()] }),
                    onEditChapter,
                },
            });

            const editChapterBtn = screen.getByTitle('Edit chapter');
            await fireEvent.click(editChapterBtn);

            expect(onEditChapter).toHaveBeenCalledWith('chapter-1');
        });

        it('calls onDeleteChapter with chapter id when delete chapter button is clicked', async () => {
            const onDeleteChapter = vi.fn();
            render(StoryTree, {
                props: {
                    story: makeStory({ chapters: [makeChapter()] }),
                    onDeleteChapter,
                },
            });

            const deleteChapterBtn = screen.getByTitle('Delete chapter');
            await fireEvent.click(deleteChapterBtn);

            expect(onDeleteChapter).toHaveBeenCalledWith('chapter-1');
        });

        it('calls onEditScene with scene id when edit scene button is clicked', async () => {
            const onEditScene = vi.fn();
            render(StoryTree, {
                props: {
                    story: makeStory({
                        directScenes: [makeScene({ title: 'Test Scene' })],
                    }),
                    onEditScene,
                },
            });

            const editSceneBtn = screen.getByTitle('Edit scene');
            await fireEvent.click(editSceneBtn);

            expect(onEditScene).toHaveBeenCalledWith('scene-1');
        });

        it('calls onDeleteScene with scene id when delete scene button is clicked', async () => {
            const onDeleteScene = vi.fn();
            render(StoryTree, {
                props: {
                    story: makeStory({
                        directScenes: [makeScene({ title: 'Test Scene' })],
                    }),
                    onDeleteScene,
                },
            });

            const deleteSceneBtn = screen.getByTitle('Delete scene');
            await fireEvent.click(deleteSceneBtn);

            expect(onDeleteScene).toHaveBeenCalledWith('scene-1');
        });
    });
});
