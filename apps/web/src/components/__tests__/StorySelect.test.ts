import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import StorySelect from '../StorySelect.svelte';
import { STORY_PROGRESS_KEY } from '../../lib/story-progress-store';

function saveProgress(map: Record<string, unknown>): void {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(map));
}

function cardLink(id: string): HTMLAnchorElement {
    const link = document.querySelector<HTMLAnchorElement>(
        `a.story-card[data-story-id="${id}"]`
    );
    if (!link) throw new Error(`no card for ${id}`);
    return link;
}

describe('StorySelect', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('puts short stories and sagas on separate shelves', () => {
        render(StorySelect, { props: { locale: 'en' } });

        const quickReads = screen.getByTestId('quick-reads');
        const sagas = screen.getByTestId('sagas');
        expect(
            within(quickReads).getByRole('heading', { name: 'Quick reads' })
        ).toBeInTheDocument();
        expect(quickReads.querySelectorAll('a.story-card')).toHaveLength(5);
        expect(sagas.querySelectorAll('a.story-card')).toHaveLength(3);
        expect(
            within(quickReads).getByText('The Elevator Game')
        ).toBeInTheDocument();
        expect(cardLink('elevator_game')).toHaveTextContent(/\d+ min/);
        expect(cardLink('the_seventh_mirror')).toHaveTextContent('28 chapters');
        expect(screen.queryByTestId('continue-reading')).toBeNull();
        expect(
            screen.queryByTestId('start-over-the_seventh_mirror')
        ).toBeNull();
    });

    it('renders in Chinese', () => {
        render(StorySelect, { props: { locale: 'zh' } });
        expect(cardLink('elevator_game').getAttribute('href')).toBe(
            '/zh/reader?story=elevator_game'
        );
        expect(cardLink('elevator_game')).toHaveTextContent(/\d+ 分鐘/);
    });

    it('offers to continue a saga and keeps short story endings', () => {
        saveProgress({
            the_seventh_mirror: {
                sceneId: 'ch3_act2',
                dialogueIndex: 4,
                updatedAt: 20,
                finished: false,
                endings: [],
            },
            elevator_game: {
                sceneId: 'b1a_act4',
                dialogueIndex: 9,
                updatedAt: 30,
                finished: true,
                endings: ['b1a_act4'],
            },
        });
        render(StorySelect, { props: { locale: 'en' } });

        const resume =
            '/en/reader?story=the_seventh_mirror&scene=ch3_act2&dialogue=5';
        const strip = screen.getByTestId('continue-reading');
        expect(strip).toHaveAttribute('href', resume);
        expect(strip).toHaveTextContent('The Seventh Mirror');
        expect(strip).toHaveTextContent('Chapter 3 of 28');
        expect(cardLink('the_seventh_mirror')).toHaveAttribute('href', resume);
        expect(
            screen.getByTestId('start-over-the_seventh_mirror')
        ).toHaveAttribute('href', '/en/reader?story=the_seventh_mirror');

        expect(cardLink('elevator_game')).toHaveTextContent('1 of 2 endings');
        expect(cardLink('elevator_game')).toHaveAttribute(
            'href',
            '/en/reader?story=elevator_game'
        );
    });

    it('offers Continue for a place saved before per-story progress existed', () => {
        localStorage.setItem(
            'aquila:readerState:en',
            JSON.stringify({
                storyId: 'the_seventh_mirror',
                sceneId: 'ch4_act2',
                dialogueIndex: 6,
                locale: 'en',
                version: 2,
            })
        );
        render(StorySelect, { props: { locale: 'en' } });

        const resume =
            '/en/reader?story=the_seventh_mirror&scene=ch4_act2&dialogue=7';
        expect(screen.getByTestId('continue-reading')).toHaveAttribute(
            'href',
            resume
        );
        expect(cardLink('the_seventh_mirror')).toHaveAttribute('href', resume);
    });

    it('re-reads progress when the page returns from the back/forward cache', async () => {
        render(StorySelect, { props: { locale: 'en' } });
        expect(screen.queryByTestId('continue-reading')).toBeNull();

        saveProgress({
            train_adventure: {
                sceneId: 'act2',
                dialogueIndex: 0,
                updatedAt: 5,
                finished: false,
                endings: [],
            },
        });
        // A normal pageshow (not from the cache) keeps what was rendered.
        window.dispatchEvent(new Event('pageshow'));
        await Promise.resolve();
        expect(screen.queryByTestId('continue-reading')).toBeNull();

        const restored = Object.assign(new Event('pageshow'), {
            persisted: true,
        });
        window.dispatchEvent(restored);
        expect(await screen.findByTestId('continue-reading')).toHaveAttribute(
            'href',
            '/en/reader?story=train_adventure&scene=act2&dialogue=1'
        );
    });
});
