import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';

vi.mock('@aquila/stories/translations', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories/translations')>()),
    getTranslations: vi.fn(() => ({
        reader: {
            historyTitle: 'History',
            closeHistory: 'Close history',
            replayVoice: 'Play voice',
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

    it('scrolls the list to the most recent line on open', () => {
        const original = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            'scrollHeight'
        );
        Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
            configurable: true,
            get: () => 620,
        });
        try {
            render(VisualBacklog, {
                props: {
                    lines: threeLines,
                    onClose: vi.fn(),
                },
            });
            expect(screen.getByRole('list').scrollTop).toBe(620);
        } finally {
            if (original) {
                Object.defineProperty(
                    HTMLElement.prototype,
                    'scrollHeight',
                    original
                );
            } else {
                delete (HTMLElement.prototype as { scrollHeight?: number })
                    .scrollHeight;
            }
        }
    });
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

describe('VisualBacklog voice replay', () => {
    const voicedLines = [
        { characterName: 'Narrator', text: 'First', sceneId: 'act1', index: 0 },
        { characterName: 'Guide', text: 'Second', sceneId: 'act1', index: 1 },
        { characterName: 'Guide', text: 'Third', sceneId: 'act2', index: 0 },
    ];
    const voiceWith = (voiced: string[]) => ({
        has: vi.fn((sceneId: string, index: number) =>
            voiced.includes(`${sceneId}:${index}`)
        ),
        play: vi.fn(),
    });

    afterEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
    });

    it('offers a replay button only on lines that have a take', () => {
        const voice = voiceWith(['act1:1', 'act2:0']);
        render(VisualBacklog, {
            props: { lines: voicedLines, voice, onClose: vi.fn() },
        });

        const [second, third] = screen.getAllByRole('button', {
            name: 'Play voice',
        });
        expect(
            screen.getAllByRole('button', { name: 'Play voice' })
        ).toHaveLength(2);
        expect(screen.getByText('Second').closest('li')).toContainElement(
            second
        );
        expect(screen.getByText('Third').closest('li')).toContainElement(third);
        expect(screen.getByText('First').closest('li')).not.toContainElement(
            second
        );
    });

    it('plays the take for the line it sits on', async () => {
        const voice = voiceWith(['act1:1', 'act2:0']);
        render(VisualBacklog, {
            props: { lines: voicedLines, voice, onClose: vi.fn() },
        });

        const [second, third] = screen.getAllByRole('button', {
            name: 'Play voice',
        });
        await fireEvent.click(third);
        expect(voice.play).toHaveBeenLastCalledWith('act2', 0);
        await fireEvent.click(second);
        expect(voice.play).toHaveBeenLastCalledWith('act1', 1);
        expect(voice.play).toHaveBeenCalledTimes(2);
    });

    it('shows no replay buttons without voice or without a line position', () => {
        const voice = voiceWith(['act1:0', 'act1:1', 'act2:0']);
        const { unmount } = render(VisualBacklog, {
            props: { lines: voicedLines, onClose: vi.fn() },
        });
        expect(
            screen.queryByRole('button', { name: 'Play voice' })
        ).not.toBeInTheDocument();
        unmount();

        render(VisualBacklog, {
            props: { lines: threeLines, voice, onClose: vi.fn() },
        });
        expect(
            screen.queryByRole('button', { name: 'Play voice' })
        ).not.toBeInTheDocument();
        expect(voice.has).not.toHaveBeenCalled();
    });

    it('keeps the replay button for a voiced line without a speaker name', () => {
        render(VisualBacklog, {
            props: {
                lines: [
                    {
                        characterName: '',
                        text: 'Hush',
                        sceneId: 'act1',
                        index: 0,
                    },
                ],
                voice: voiceWith(['act1:0']),
                onClose: vi.fn(),
            },
        });

        expect(
            screen.getByRole('button', { name: 'Play voice' })
        ).toBeInTheDocument();
    });
});
