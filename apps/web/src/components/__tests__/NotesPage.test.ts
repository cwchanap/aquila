// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import { storyProgressKey } from '@/lib/story-progress-store';
import NotesPage from '../NotesPage.svelte';
import { loadStoryNotes } from '@aquila/stories/async';

vi.mock('@aquila/stories/async', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@aquila/stories/async')>();
    return { ...actual, loadStoryNotes: vi.fn(actual.loadStoryNotes) };
});

describe('NotesPage', () => {
    it('replaces loading with a localized alert if the notes import rejects', async () => {
        let rejectLoad!: (error: Error) => void;
        vi.mocked(loadStoryNotes).mockImplementationOnce(
            () =>
                new Promise((_, reject) => {
                    rejectLoad = reject;
                })
        );
        const { container } = render(NotesPage, {
            props: {
                storyId: 'train_adventure',
                locale: 'ja',
                authState: 'signed-out',
                userId: null,
            },
        });
        expect(screen.getByRole('status')).toHaveTextContent(
            '登場人物を読み込み中…'
        );
        rejectLoad(new Error('chunk unavailable'));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            '人物ノートを読み込めませんでした。'
        );
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('region', { name: '登場人物' })
        ).not.toBeInTheDocument();
        expect(container.querySelector('img')).toBeNull();
    });

    it.each(['unknown', 'elevator_game', ''])(
        'shows a selection state for unsupported story %s',
        storyId => {
            render(NotesPage, {
                props: {
                    storyId,
                    locale: 'en',
                    authState: 'signed-out',
                    userId: null,
                },
            });
            expect(screen.getByText(/choose a story/i)).toBeInTheDocument();
            expect(screen.queryByText(/Li Jie/)).not.toBeInTheDocument();
        }
    );

    it('loads only the signed-out owner’s current line without later names', async () => {
        localStorage.clear();
        localStorage.setItem(
            storyProgressKey(),
            JSON.stringify({
                train_adventure: {
                    sceneId: 'act1',
                    dialogueIndex: 8,
                    visited: ['act1'],
                    endings: [],
                    updatedAt: 10,
                    finished: false,
                },
            })
        );
        localStorage.setItem(
            storyProgressKey('another-owner'),
            JSON.stringify({
                train_adventure: {
                    sceneId: 'act3',
                    dialogueIndex: 40,
                    visited: ['act1', 'act2', 'act3'],
                    endings: [],
                    updatedAt: 20,
                    finished: false,
                },
            })
        );
        const { container } = render(NotesPage, {
            props: {
                storyId: 'train_adventure',
                locale: 'en',
                authState: 'signed-out',
                userId: null,
            },
        });
        expect(
            await screen.findAllByText('Loudmouth Student')
        ).not.toHaveLength(0);
        expect(container.textContent).not.toContain('sketchbook');
        expect(container.textContent).not.toContain('Tanaka Kenta');
        expect(container.querySelector('img')).toBeNull();
        localStorage.clear();
    });
});
