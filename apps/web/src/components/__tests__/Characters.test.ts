// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import { loadStoryNotes } from '@aquila/stories/async';
import { getTranslations } from '@aquila/stories/translations';
import { selectCharacterNotes } from '@/lib/character-notes';
import Characters from '../Characters.svelte';

describe('Characters', () => {
    afterEach(() => vi.unstubAllGlobals());
    it('only renders reached labels and facts, and never requests an unmet portrait', async () => {
        const { notes, flow } = await loadStoryNotes('train_adventure');
        const model = selectCharacterNotes({
            notes,
            flow,
            progress: {
                sceneId: 'act1',
                dialogueIndex: 8,
                visited: ['act1'],
                endings: [],
            },
            locale: 'en',
            t: getTranslations('en'),
        });
        const portraitUrl = vi.fn((id: string) => `/portraits/${id}/base.webp`);
        const { container } = render(Characters, {
            props: { model, locale: 'en', portraitUrl },
        });
        expect(screen.getAllByText(/student/i).length).toBeGreaterThan(0);
        expect(container.innerHTML).not.toMatch(
            /Tanaka Kenta|Shimizu Emi|sketchbook/i
        );
        expect(container.innerHTML).not.toContain('shimizu_emi');
        expect(container.innerHTML).not.toContain('tanaka_kenta');
        expect(portraitUrl).not.toHaveBeenCalledWith('shimizu_emi');
        await fireEvent.click(
            screen.getAllByRole('button', { name: /student/i })[0]
        );
        expect(container.innerHTML).not.toMatch(
            /Tanaka Kenta|Shimizu Emi|sketchbook/i
        );
    });

    it('shows a portrait for a met unnamed person when the URL is opaque', () => {
        const model = {
            metCount: 1,
            characters: [
                {
                    id: 'secret_name',
                    hidden: false,
                    met: true,
                    nameKnown: false,
                    label: 'Quiet Girl',
                    facts: [],
                    factCount: 1,
                },
            ],
        };
        const { container } = render(Characters, {
            props: {
                model,
                locale: 'en',
                portraitUrl: () => '/assets/abcdef.webp',
            },
        });
        expect(container.querySelector('img')).toHaveAttribute(
            'src',
            '/assets/abcdef.webp'
        );
        expect(container.innerHTML).not.toContain('secret_name');
        expect(screen.getAllByText('Name ???')).toHaveLength(2);
    });

    it('moves focus into phone detail and returns it to the selected card', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const model = {
            metCount: 1,
            characters: [
                {
                    id: 'person',
                    hidden: false,
                    met: true,
                    nameKnown: false,
                    label: 'Quiet Girl',
                    facts: [],
                    factCount: 0,
                },
            ],
        };
        render(Characters, { props: { model, locale: 'en' } });
        const card = screen.getByRole('button', { name: /quiet girl/i });
        await fireEvent.click(card);
        const back = screen.getByRole('button', { name: 'Back' });
        expect(back).toHaveFocus();
        await fireEvent.click(back);
        expect(card).toHaveFocus();
    });
});
