// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import { getTranslations } from '@aquila/stories/translations';
import type {
    ChoiceDefinition,
    ChoiceOptionDefinition,
    Translations,
} from '@aquila/stories';
import type { SecondChoiceLabels } from '@/lib/reader-second-language';
import CrossroadsDialog from '@/components/CrossroadsDialog.svelte';

const t = {
    locale: 'en',
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        storyMap: { decision: 'Decision' },
        crossroads: {
            back: 'Back to the last line',
            route: 'Route {letter}',
            keyHint: 'Press {key}',
        },
    },
} as unknown as Translations;

function makeOptions(labels: string[]): ChoiceOptionDefinition[] {
    return labels.map((label, i) => ({
        id: `o${i + 1}`,
        nextScene: `b1${String.fromCharCode(97 + i)}_act4`,
        label,
    }));
}

const choiceTwo: ChoiceDefinition = {
    prompt: 'The doors are open. Do you step out?',
    options: makeOptions(['Step off onto the platform', 'Stay on the train']),
};

const choiceJa: ChoiceDefinition = {
    prompt: 'ドアが開いた。外へ出るか？',
    promptRuby: [
        { start: 4, end: 5, reading: 'ひら' },
        { start: 11, end: 12, reading: 'で' },
    ],
    options: [
        {
            id: 'o1',
            nextScene: 'b1a_act4',
            label: 'ホームに降りる',
            labelRuby: [{ start: 4, end: 5, reading: 'お' }],
        },
        {
            id: 'o2',
            nextScene: 'b1b_act4',
            label: '列車に残る',
            labelRuby: [{ start: 0, end: 2, reading: 'れっしゃ' }],
        },
    ],
};

const secondTwo: SecondChoiceLabels = {
    prompt: '車門開了，要踏出去嗎？',
    labels: { o1: '下車，踏上月台', o2: '留在列車上' },
};

function baseProps(overrides: Record<string, unknown> = {}) {
    return {
        open: true,
        choice: choiceTwo,
        secondChoice: null,
        actName: 'act3',
        textLang: 'en',
        secondLang: undefined as string | undefined,
        furigana: true,
        t,
        onSelect: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('CrossroadsDialog', () => {
    it('renders nothing when closed', () => {
        render(CrossroadsDialog, { props: baseProps({ open: false }) });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens as a labelled modal dialog with the decision eyebrow', () => {
        render(CrossroadsDialog, { props: baseProps() });
        const dialog = screen.getByRole('dialog', {
            name: /Decision · Act 3/,
        });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(screen.getByText('Decision · Act 3')).toBeVisible();
        expect(
            screen.getByRole('heading', {
                name: 'The doors are open. Do you step out?',
            })
        ).toBeVisible();
    });

    it('names the dialog from the eyebrow when the prompt is empty', () => {
        render(CrossroadsDialog, {
            props: baseProps({
                choice: { prompt: '', options: choiceTwo.options },
            }),
        });
        expect(
            screen.getByRole('dialog', { name: 'Decision · Act 3' })
        ).toBeTruthy();
    });

    it('renders a fork icon', () => {
        render(CrossroadsDialog, { props: baseProps() });
        const dialog = screen.getByRole('dialog');
        const icon = dialog.querySelector('svg.lucide-git-fork');
        expect(icon).not.toBeNull();
        expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });

    it.each([
        [['Only way'], ['Route A']],
        [
            ['Step off', 'Stay on'],
            ['Route A', 'Route B'],
        ],
        [
            ['Left', 'Middle', 'Right'],
            ['Route A', 'Route B', 'Route C'],
        ],
        [
            ['Red', 'Blue', 'Neither', 'Both'],
            ['Route A', 'Route B', 'Route C', 'Route D'],
        ],
    ])('renders %i route cards', (labels: string[], routeNames: string[]) => {
        render(CrossroadsDialog, {
            props: baseProps({
                choice: { prompt: 'Pick one', options: makeOptions(labels) },
            }),
        });
        const cards = screen.getAllByTestId('crossroads-route');
        expect(cards).toHaveLength(labels.length);
        routeNames.forEach((name, i) => {
            expect(within(cards[i]).getByText(name)).toBeVisible();
            expect(within(cards[i]).getByText(labels[i])).toBeVisible();
            expect(
                within(cards[i]).getByText(`Press ${i + 1}`)
            ).toBeInTheDocument();
            expect(cards[i].getAttribute('aria-keyshortcuts')).toBe(
                String(i + 1)
            );
        });
    });

    it('wraps long unbroken labels instead of overflowing the card row', () => {
        const longWord = 'Investigatethetransmission'.repeat(3);
        render(CrossroadsDialog, {
            props: baseProps({
                secondChoice: {
                    prompt: 'セカンドプロンプト'.repeat(8),
                    labels: {
                        o1: 'セカンドラベル'.repeat(8),
                        o2: 'セカンドラベル'.repeat(8),
                    },
                },
                secondLang: 'ja',
                choice: {
                    prompt: `${longWord}?`,
                    options: makeOptions([
                        longWord,
                        longWord,
                        longWord,
                        longWord,
                    ]),
                },
            }),
        });
        // overflow-wrap anywhere lets a single long word break inside its
        // box instead of pushing the card past its grid track.
        expect(screen.getByRole('heading').className).toContain(
            'wrap-anywhere'
        );
        const cards = screen.getAllByTestId('crossroads-route');
        expect(cards).toHaveLength(4);
        for (const card of cards) {
            // Each grid item may not exceed its 1fr track width.
            expect(card.parentElement?.className).toContain('min-w-0');
            // The lang'd spans are the main/secondary text containers.
            const texts = card.querySelectorAll('[lang]');
            expect(texts.length).toBeGreaterThan(0);
            texts.forEach(span => {
                expect(span.className).toContain('wrap-anywhere');
            });
        }
        const seconds = screen.getAllByTestId('second-line');
        expect(seconds.length).toBeGreaterThan(0);
        seconds.forEach(el => expect(el.className).toContain('wrap-anywhere'));
        // The desktop card row is retained.
        const list = cards[0].closest('ul');
        expect(list?.className).toContain('sm:grid-flow-col');
    });

    it('keeps hit targets at least 44px tall', () => {
        render(CrossroadsDialog, { props: baseProps() });
        for (const card of screen.getAllByTestId('crossroads-route')) {
            expect(card.className).toMatch(/min-h-11/);
        }
        const back = screen.getByRole('button', {
            name: 'Back to the last line',
        });
        expect(back.className).toMatch(/min-h-11/);
    });

    it('applies the bottom safe-area inset to the dialog footer', () => {
        render(CrossroadsDialog, { props: baseProps() });
        const back = screen.getByRole('button', {
            name: 'Back to the last line',
        });
        expect(back.parentElement?.className).toMatch(
            /pb-\[max\(1\.5rem,env\(safe-area-inset-bottom\)\)\]/
        );
    });

    it('shows the second-language prompt and labels when enabled', () => {
        render(CrossroadsDialog, {
            props: baseProps({
                secondChoice: secondTwo,
                secondLang: 'zh-Hant',
            }),
        });
        const seconds = screen.getAllByTestId('second-line');
        expect(seconds).toHaveLength(3);
        expect(seconds[0]).toHaveTextContent('車門開了，要踏出去嗎？');
        expect(seconds[0].getAttribute('lang')).toBe('zh-Hant');
        const cards = screen.getAllByTestId('crossroads-route');
        expect(within(cards[0]).getByText('下車，踏上月台')).toBeVisible();
        expect(within(cards[1]).getByText('留在列車上')).toBeVisible();
    });

    it('marks the main text with textLang and second text with secondLang', () => {
        render(CrossroadsDialog, {
            props: baseProps({
                secondChoice: secondTwo,
                secondLang: 'zh-Hant',
            }),
        });
        const heading = screen.getByRole('heading');
        expect(heading.getAttribute('lang')).toBe('en');
        const cards = screen.getAllByTestId('crossroads-route');
        const main = within(cards[0]).getByText('Step off onto the platform');
        expect(main.closest('[lang]')?.getAttribute('lang')).toBe('en');
    });

    it('renders furigana for the Japanese prompt and option labels', () => {
        const { container } = render(CrossroadsDialog, {
            props: baseProps({
                choice: choiceJa,
                textLang: 'ja',
                t: getTranslations('ja'),
            }),
        });
        const readings = Array.from(container.querySelectorAll('rt')).map(
            el => el.textContent
        );
        expect(readings).toContain('ひら');
        expect(readings).toContain('で');
        expect(readings).toContain('お');
        expect(readings).toContain('れっしゃ');
        expect(container.querySelectorAll('ruby').length).toBeGreaterThan(0);
    });

    it('hides furigana when the setting is off', () => {
        const { container } = render(CrossroadsDialog, {
            props: baseProps({
                choice: choiceJa,
                textLang: 'ja',
                furigana: false,
            }),
        });
        expect(container.querySelectorAll('rt')).toHaveLength(0);
        expect(
            screen.getByText('ドアが開いた。外へ出るか？')
        ).toBeInTheDocument();
    });

    it('focuses the prompt heading, not an option', () => {
        render(CrossroadsDialog, { props: baseProps() });
        const heading = screen.getByRole('heading');
        expect(heading.getAttribute('tabindex')).toBe('-1');
        expect(document.activeElement).toBe(heading);
        expect(document.activeElement?.tagName).not.toBe('BUTTON');
    });

    it('does not select a route on a bare Enter right after opening', async () => {
        const onSelect = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect }) });
        await fireEvent.keyDown(window, { key: 'Enter' });
        await fireEvent.keyDown(document.activeElement as Element, {
            key: 'Enter',
        });
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('lets Tab cycle through option cards and the back button', async () => {
        render(CrossroadsDialog, { props: baseProps() });
        const dialog = screen.getByRole('dialog');
        const buttons = dialog.querySelectorAll('button');
        // Cards then Back: Tab from the heading lands on the first button.
        const last = buttons[buttons.length - 1] as HTMLElement;
        last.focus();
        await fireEvent.keyDown(last, { key: 'Tab' });
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('activates the focused card without intercepting Enter', async () => {
        const onSelect = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect }) });
        const card = screen.getAllByTestId('crossroads-route')[1];
        card.focus();
        const notPrevented = await fireEvent.keyDown(card, { key: 'Enter' });
        expect(notPrevented).toBe(true);
        await fireEvent.click(card);
        expect(onSelect).toHaveBeenCalledWith('b1b_act4');
    });

    it.each([
        ['1', 0],
        ['2', 1],
        ['3', 2],
        ['4', 3],
    ] as const)(
        'selects route %s with its digit shortcut',
        async (key, index) => {
            const onSelect = vi.fn();
            render(CrossroadsDialog, {
                props: baseProps({
                    onSelect,
                    choice: {
                        prompt: 'Pick one',
                        options: makeOptions(['A', 'B', 'C', 'D']),
                    },
                }),
            });
            await fireEvent.keyDown(window, { key });
            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(onSelect).toHaveBeenCalledWith(
                `b1${String.fromCharCode(97 + index)}_act4`
            );
        }
    );

    it('ignores digits beyond the option count', async () => {
        const onSelect = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect }) });
        // Two options: 3 and 4 are out of range, 5 is not a shortcut at all.
        const notPrevented = await fireEvent.keyDown(window, { key: '3' });
        expect(notPrevented).toBe(true);
        await fireEvent.keyDown(window, { key: '4' });
        await fireEvent.keyDown(window, { key: '5' });
        await fireEvent.keyDown(window, { key: '0' });
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('ignores modified, repeated and composing digit presses', async () => {
        const onSelect = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect }) });
        await fireEvent.keyDown(window, { key: '1', ctrlKey: true });
        await fireEvent.keyDown(window, { key: '1', metaKey: true });
        await fireEvent.keyDown(window, { key: '1', altKey: true });
        await fireEvent.keyDown(window, { key: '1', shiftKey: true });
        await fireEvent.keyDown(window, { key: '1', repeat: true });
        await fireEvent.keyDown(window, { key: '1', isComposing: true });
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('ignores shortcuts typed into editable controls', async () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect, onClose }) });
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        const notPrevented = await fireEvent.keyDown(input, { key: '1' });
        expect(notPrevented).toBe(true);
        await fireEvent.keyDown(input, { key: 'Escape' });
        expect(onSelect).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
        input.remove();
    });

    it('does not steal keys while closed', async () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        render(CrossroadsDialog, {
            props: baseProps({ open: false, onSelect, onClose }),
        });
        const notPrevented = await fireEvent.keyDown(window, { key: '1' });
        expect(notPrevented).toBe(true);
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onSelect).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('closes on Escape without selecting', async () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect, onClose }) });
        const prevented = await fireEvent.keyDown(window, { key: 'Escape' });
        expect(prevented).toBe(false);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onSelect).not.toHaveBeenCalled();
    });

    it('stops handled keys before other window listeners', async () => {
        const onClose = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onClose }) });
        const spy = vi.fn();
        window.addEventListener('keydown', spy);
        await fireEvent.keyDown(document.body, { key: 'Escape' });
        expect(spy).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
        window.removeEventListener('keydown', spy);
    });

    it('closes on a backdrop click but not on clicks inside the modal', async () => {
        const onClose = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onClose }) });
        const dialog = screen.getByRole('dialog');
        await fireEvent.click(dialog);
        expect(onClose).not.toHaveBeenCalled();
        const heading = screen.getByRole('heading');
        await fireEvent.click(heading);
        expect(onClose).not.toHaveBeenCalled();
        await fireEvent.click(screen.getByTestId('crossroads-scrim'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes via the Back to the last line button', async () => {
        const onClose = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onClose }) });
        await fireEvent.click(
            screen.getByRole('button', { name: 'Back to the last line' })
        );
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('selects a route once and does not close itself', async () => {
        const onSelect = vi.fn();
        const onClose = vi.fn();
        render(CrossroadsDialog, { props: baseProps({ onSelect, onClose }) });
        const cards = screen.getAllByTestId('crossroads-route');
        await fireEvent.click(cards[0]);
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('b1a_act4');
        expect(onClose).not.toHaveBeenCalled();
        // A second pick while still open is a no-op.
        await fireEvent.click(cards[1]);
        await fireEvent.keyDown(window, { key: '2' });
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('allows a fresh selection after reopening, including synchronous keydown on reopen', async () => {
        const onSelect = vi.fn();
        const { rerender } = render(CrossroadsDialog, {
            props: baseProps({ onSelect }),
        });
        await fireEvent.click(screen.getAllByTestId('crossroads-route')[0]);
        expect(onSelect).toHaveBeenCalledTimes(1);
        await rerender(baseProps({ open: false, onSelect }));
        await rerender(baseProps({ onSelect }));
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: '2', bubbles: true })
        );
        expect(onSelect).toHaveBeenCalledTimes(2);
        expect(onSelect).toHaveBeenLastCalledWith('b1b_act4');
    });

    it('restores focus to the opener when closed', async () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { unmount } = render(CrossroadsDialog, {
            props: baseProps(),
        });
        expect(
            screen.getByRole('dialog').contains(document.activeElement)
        ).toBe(true);
        unmount();
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it.each([
        ['zh', '抉擇 · 第 3 章', '路線 A', '返回最後一行'],
        ['ja', '分岐 · 第 3 幕', 'ルート A', '最後の行に戻る'],
    ] as const)(
        'renders the %s chrome from real translations',
        (locale, eyebrow, route, back) => {
            render(CrossroadsDialog, {
                props: baseProps({ t: getTranslations(locale) }),
            });
            expect(
                screen.getByRole('dialog', { name: new RegExp(eyebrow) })
            ).toBeTruthy();
            expect(screen.getByText(route)).toBeVisible();
            expect(screen.getByRole('button', { name: back })).toBeVisible();
        }
    );

    it('renders dashed route lines on desktop markup', () => {
        const { container } = render(CrossroadsDialog, {
            props: baseProps({
                choice: {
                    prompt: 'Pick one',
                    options: makeOptions(['A', 'B', 'C']),
                },
            }),
        });
        const paths = container.querySelectorAll('.route-line');
        expect(paths).toHaveLength(3);
        paths.forEach(path => {
            expect(path.getAttribute('d')).toContain('C');
        });
        // A single option gets one straight line instead of a fan.
        const { container: single } = render(CrossroadsDialog, {
            props: baseProps({
                choice: { prompt: 'Pick one', options: makeOptions(['A']) },
            }),
        });
        const line = single.querySelector('.route-line');
        expect(line).not.toBeNull();
        expect(line?.getAttribute('d')).toMatch(/C 0\.5 .* 0\.5 64$/);
    });

    it('shows a bare decision eyebrow when the act name is empty', () => {
        render(CrossroadsDialog, { props: baseProps({ actName: '' }) });
        const dialog = screen.getByRole('dialog', {
            name: /Decision/,
        });
        expect(dialog).toBeVisible();
        expect(document.getElementById('crossroads-eyebrow')).toHaveTextContent(
            /^Decision$/
        );
    });

    it('letters routes beyond D and omits shortcut hints past the fourth card', () => {
        render(CrossroadsDialog, {
            props: baseProps({
                choice: {
                    prompt: 'Pick one',
                    options: makeOptions(['A', 'B', 'C', 'D', 'E']),
                },
            }),
        });
        expect(screen.getByText('Route E')).toBeVisible();
        const cards = screen.getAllByTestId('crossroads-route');
        expect(cards).toHaveLength(5);
        for (let i = 0; i < 4; i++) {
            expect(cards[i].getAttribute('aria-keyshortcuts')).toBe(
                String(i + 1)
            );
            expect(
                within(cards[i]).getByText(`Press ${i + 1}`)
            ).toBeInTheDocument();
        }
        expect(cards[4].getAttribute('aria-keyshortcuts')).toBeNull();
        expect(within(cards[4]).queryByText('Press 5')).not.toBeInTheDocument();
        expect(within(cards[4]).queryByText('5')).not.toBeInTheDocument();
    });

    it('lights the route line under the hovered or focused card', async () => {
        const { container } = render(CrossroadsDialog, {
            props: baseProps(),
        });
        const cards = screen.getAllByTestId('crossroads-route');
        const lines = container.querySelectorAll('.route-line');
        expect(lines[1]).not.toHaveClass('on');

        await fireEvent.mouseEnter(cards[1]);
        expect(lines[1]).toHaveClass('on');
        await fireEvent.mouseLeave(cards[1]);
        expect(lines[1]).not.toHaveClass('on');

        await fireEvent.focus(cards[0]);
        expect(lines[0]).toHaveClass('on');
        await fireEvent.blur(cards[0]);
        expect(lines[0]).not.toHaveClass('on');
    });

    it('renders when a locale string is missing', () => {
        const sparse = {
            ...t,
            reader: {
                ...t.reader,
                crossroads: { ...t.reader.crossroads, back: undefined },
            },
        } as unknown as Translations;
        render(CrossroadsDialog, { props: baseProps({ t: sparse }) });
        expect(screen.getByRole('dialog')).toBeVisible();
        expect(screen.getAllByTestId('crossroads-route')).toHaveLength(2);
    });
});
