// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    within,
} from '@testing-library/svelte';
import '@testing-library/jest-dom';
import { loadStoryNotes } from '@aquila/stories/async';
import { getTranslations } from '@aquila/stories/translations';
import { selectCharacterNotes } from '@/lib/character-notes';
import { focusTrap } from '@/lib/focus-trap';
import Characters from '../Characters.svelte';

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
const showModalDescriptor = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'showModal'
);
const closeDescriptor = Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'close'
);

describe('Characters', () => {
    beforeEach(() => {
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
            configurable: true,
            value: vi.fn(function (this: HTMLDialogElement) {
                this.setAttribute('open', '');
            }),
        });
        Object.defineProperty(HTMLDialogElement.prototype, 'close', {
            configurable: true,
            value: vi.fn(function (this: HTMLDialogElement) {
                this.removeAttribute('open');
            }),
        });
    });
    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        if (showModalDescriptor)
            Object.defineProperty(
                HTMLDialogElement.prototype,
                'showModal',
                showModalDescriptor
            );
        else
            delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)
                .showModal;
        if (closeDescriptor)
            Object.defineProperty(
                HTMLDialogElement.prototype,
                'close',
                closeDescriptor
            );
        else
            delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>)
                .close;
    });
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

    it('exposes the selected button as selection changes without revealing names', async () => {
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
        const { container } = render(Characters, {
            props: { model, locale: 'en' },
        });
        const first = screen.getByRole('button', { name: /Li Jie/i });
        const second = screen.getByRole('button', {
            name: /Loudmouth Student/i,
        });
        const unknown = screen.getAllByRole('button', {
            name: 'Unknown character',
        })[0];
        expect(first).toHaveAttribute('aria-pressed', 'true');
        expect(second).toHaveAttribute('aria-pressed', 'false');
        expect(unknown).toHaveAttribute('aria-pressed', 'false');
        await fireEvent.click(second);
        expect(first).toHaveAttribute('aria-pressed', 'false');
        expect(second).toHaveAttribute('aria-pressed', 'true');
        await fireEvent.click(unknown);
        expect(second).toHaveAttribute('aria-pressed', 'false');
        expect(unknown).toHaveAttribute('aria-pressed', 'true');
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

    it('falls back to initials when the portrait URL cannot be decoded', () => {
        const { container } = render(Characters, {
            props: {
                model,
                locale: 'en',
                portraitUrl: () => '/portraits/%',
            },
        });
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('.avatar')?.textContent?.trim()).toBe(
            'QG'
        );
    });

    it('moves focus into phone detail and returns it to the selected card', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        render(Characters, { props: { model, locale: 'en' } });
        const card = screen.getByRole('button', { name: /quiet girl/i });
        await fireEvent.click(card);
        const dialog = screen.getByRole('dialog', { name: 'Quiet Girl' });
        expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const back = within(dialog).getByRole('button', { name: 'Back' });
        expect(back).toHaveFocus();
        await fireEvent.click(back);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(card).toHaveFocus();
    });

    it('contains Tab inside the phone modal and prevents an enclosing sheet from handling it', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const outer = document.createElement('div');
        document.body.append(outer);
        const outerKeys = vi.fn();
        outer.addEventListener('keydown', outerKeys);
        const result = render(Characters, {
            target: outer,
            props: { model, locale: 'en' },
        });
        const outerTrap = focusTrap(outer, true);
        await fireEvent.click(
            screen.getByRole('button', { name: /quiet girl/i })
        );
        const dialog = screen.getByRole('dialog', { name: 'Quiet Girl' });
        const back = within(dialog).getByRole('button', { name: 'Back' });
        for (const shiftKey of [false, true]) {
            const event = new KeyboardEvent('keydown', {
                key: 'Tab',
                shiftKey,
                bubbles: true,
                cancelable: true,
            });
            back.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(back).toHaveFocus();
        }
        expect(outerKeys).not.toHaveBeenCalled();
        outerTrap.destroy();
        result.unmount();
        outer.remove();
    });

    it('Escape dismisses only the phone detail and restores the selected card', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const outer = document.createElement('div');
        document.body.append(outer);
        const outerKeys = vi.fn();
        outer.addEventListener('keydown', outerKeys);
        const result = render(Characters, {
            target: outer,
            props: { model, locale: 'en' },
        });
        const card = screen.getByRole('button', { name: /quiet girl/i });
        await fireEvent.click(card);
        const dialog = screen.getByRole('dialog', { name: 'Quiet Girl' });
        const back = within(dialog).getByRole('button', { name: 'Back' });
        await fireEvent.keyDown(back, { key: 'Escape' });
        expect(outerKeys).not.toHaveBeenCalled();
        await fireEvent(dialog, new Event('cancel', { cancelable: true }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(card).toHaveFocus();
        result.unmount();
        outer.remove();
    });

    it('closes the phone modal and restores focus when the viewport becomes desktop', async () => {
        const media = new EventTarget() as MediaQueryList;
        Object.defineProperty(media, 'matches', {
            configurable: true,
            value: true,
        });
        vi.stubGlobal('matchMedia', () => media);
        render(Characters, { props: { model, locale: 'en' } });
        const card = screen.getByRole('button', { name: /quiet girl/i });
        await fireEvent.click(card);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        Object.defineProperty(media, 'matches', {
            configurable: true,
            value: false,
        });
        await fireEvent(media, new Event('change'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(card).toHaveFocus();
    });

    it('selects inline on desktop without opening a modal', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: false }));
        render(Characters, { props: { model, locale: 'en' } });
        await fireEvent.click(
            screen.getByRole('button', { name: /quiet girl/i })
        );
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled();
    });

    it('lets a capture-phase sheet Escape handler yield while detail is open', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        let detailOpen = false;
        const closeSheet = vi.fn();
        const onDetailChange = vi.fn((open: boolean) => {
            detailOpen = open;
        });
        const onSheetKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !detailOpen) closeSheet();
        };
        window.addEventListener('keydown', onSheetKey, true);
        const result = render(Characters, {
            props: {
                model,
                locale: 'en',
                onMobileDetailChange: onDetailChange,
            },
        });
        const card = screen.getByRole('button', { name: /quiet girl/i });
        await fireEvent.click(card);
        const dialog = screen.getByRole('dialog', { name: 'Quiet Girl' });
        await fireEvent.keyDown(
            within(dialog).getByRole('button', { name: 'Back' }),
            { key: 'Escape' }
        );
        expect(closeSheet).not.toHaveBeenCalled();
        await fireEvent(dialog, new Event('cancel', { cancelable: true }));
        expect(onDetailChange.mock.calls).toEqual([[true], [false]]);
        await fireEvent.keyDown(card, { key: 'Escape' });
        expect(closeSheet).toHaveBeenCalledOnce();
        result.unmount();
        window.removeEventListener('keydown', onSheetKey, true);
    });

    it('clears the detail-open notification when its host unmounts', async () => {
        vi.stubGlobal('matchMedia', () => ({ matches: true }));
        const onMobileDetailChange = vi.fn();
        const result = render(Characters, {
            props: { model, locale: 'en', onMobileDetailChange },
        });
        await fireEvent.click(
            screen.getByRole('button', { name: /quiet girl/i })
        );
        result.unmount();
        expect(onMobileDetailChange.mock.calls).toEqual([[true], [false]]);
    });
});
