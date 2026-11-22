// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import { storyProgressKey } from '@/lib/story-progress-store';
import NotesPage from '../NotesPage.svelte';

describe('NotesPage', () => {
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
