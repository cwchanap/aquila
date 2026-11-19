import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';

vi.mock('@aquila/stories/translations', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories/translations')>()),
    getTranslations: vi.fn(() => ({
        reader: {
            historyTitle: 'History',
            closeHistory: 'Close history',
            unknown: 'Unknown',
            readerMode: 'Reader mode',
            textMode: 'Text',
            visualNovelMode: 'Visual Novel',
            visualStaleRelease: 'Using previously validated visuals',
            visualAssetFallback: 'Some visuals are unavailable',
            visualUnavailable: 'Visuals are unavailable',
        },
        characterNames: {
            narrator: 'Narrator',
        },
        locale: 'en',
    })),
}));

import VisualBacklog from '../VisualBacklog.svelte';

const threeLines = [
    { characterName: 'Narrator', text: 'First' },
    { characterName: 'Guide', text: 'Second' },
    { characterName: '', text: 'Third' },
];

describe('VisualBacklog', () => {
    afterEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
    });

    it('shows the supplied history lines', () => {
        render(VisualBacklog, {
            props: {
                lines: threeLines.slice(0, 2),
                locale: 'en',
                onClose: vi.fn(),
            },
        });

        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.queryByText('Third')).not.toBeInTheDocument();
        expect(screen.getByText('Narrator')).toBeInTheDocument();
        expect(screen.getByText('Guide')).toBeInTheDocument();
    });

    it('hides leading stage directions and keeps readings on the right text', () => {
        render(VisualBacklog, {
            props: {
                lines: [
                    {
                        characterName: 'Narrator',
                        text: '(內心)好。',
                        secondText: '(thinking) Fine.',
                    },
                    {
                        characterName: 'Narrator',
                        text: '（心の声）今日は雨。',
                        ruby: [
                            { start: 1, end: 2, reading: 'こころ' },
                            { start: 5, end: 7, reading: 'きょう' },
                        ],
                        secondText: 'Rain today.',
                    },
                ],
                locale: 'en',
                onClose: vi.fn(),
            },
        });

        const history = screen.getByRole('dialog');
        expect(history).toHaveTextContent('好。');
        expect(history).toHaveTextContent('Fine.');
        expect(history).not.toHaveTextContent('內心');
        expect(history).not.toHaveTextContent('心の声');
        expect(history).not.toHaveTextContent('thinking');
        const readings = [...history.querySelectorAll('rt')].map(
            rt => rt.textContent
        );
        expect(readings).toEqual(['きょう']);
    });

    it('moves focus inside on open and returns focus to the trigger on close', async () => {
        const trigger = document.createElement('button');
        document.body.append(trigger);
        const onClose = vi.fn();

        render(VisualBacklog, {
            props: {
                lines: threeLines,
                trigger,
                onClose,
            },
        });

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toContainElement(
                document.activeElement
            );
        });
        await fireEvent.keyDown(screen.getByRole('dialog'), {
            key: 'Escape',
        });

        expect(onClose).toHaveBeenCalledOnce();
        expect(trigger).toHaveFocus();
    });

    it('closes from the translated close control and restores focus', async () => {
        const trigger = document.createElement('button');
        document.body.append(trigger);
        const onClose = vi.fn();
        render(VisualBacklog, {
            props: {
                lines: threeLines,
                trigger,
                onClose,
            },
        });

        await fireEvent.click(
            screen.getByRole('button', { name: 'Close history' })
        );

        expect(onClose).toHaveBeenCalledOnce();
        expect(trigger).toHaveFocus();
    });

    it.each([
        ['forward', false],
        ['reverse', true],
    ] as const)(
        'wraps %s Tab focus inside the modal',
        async (_label, shiftKey) => {
            render(VisualBacklog, {
                props: {
                    lines: threeLines,
                    onClose: vi.fn(),
                },
            });
            const close = screen.getByRole('button', { name: 'Close history' });
            close.focus();
            const event = new KeyboardEvent('keydown', {
                key: 'Tab',
                shiftKey,
                bubbles: true,
                cancelable: true,
            });

            close.dispatchEvent(event);

            expect(event.defaultPrevented).toBe(true);
            expect(close).toHaveFocus();
        }
    );
});

describe('VisualBacklog second language', () => {
    afterEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
    });

    it('shows each line with its second-language text', () => {
        render(VisualBacklog, {
            props: {
                lines: [
                    { ...threeLines[0], secondText: '一' },
                    { ...threeLines[1], secondText: '二' },
                ],
                textLang: 'en',
                secondLang: 'ja',
                onClose: vi.fn(),
            },
        });

        expect(screen.getByText('一')).toHaveAttribute('lang', 'ja');
        expect(screen.getByText('二')).toHaveAttribute('lang', 'ja');
        expect(screen.queryByText('三')).not.toBeInTheDocument();
    });
});

describe('VisualBacklog furigana', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('shows readings over Japanese lines', () => {
        render(VisualBacklog, {
            props: {
                lines: [
                    {
                        characterName: '',
                        text: '今日は雨。',
                        ruby: [{ start: 0, end: 2, reading: 'きょう' }],
                    },
                ],
                onClose: vi.fn(),
            },
        });
        expect(document.querySelector('rt')).toHaveTextContent('きょう');
    });
});
