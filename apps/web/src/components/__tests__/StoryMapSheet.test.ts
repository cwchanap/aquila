import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { ChoiceMap, StoryFlowConfig, Translations } from '@aquila/stories';
import type { StoryProgress } from '@/lib/story-progress-store';
import StoryMapSheet from '@/components/StoryMapSheet.svelte';

const t = {
    reader: {
        actLabel: 'Act {n}',
        actFinal: 'Final',
        actEpilogue: 'Epilogue',
        actRangeLabel: 'Acts {first}–{last}',
        lineProgress: 'Line {current} of {total}',
        endOfStory: 'End of story!',
        storyMap: {
            title: 'Story map',
            open: 'Open story map',
            close: 'Close story map',
            locateCurrent: 'Locate current position',
            currentPosition: 'Current position',
            statsActs: '{n} acts',
            statsDecisions: '{n} decisions',
            statsEndings: '{n} endings',
            expandRun: 'Expand {label}',
            collapseRun: 'Collapse {label}',
            decision: 'Decision',
            options: '{n} options',
            unreadLabel: 'Not read yet',
            endingLabel: 'Ending {label}',
            withBranch: '{label} — {branch}',
            jumpTo: 'Jump to {label}',
        },
    },
} as unknown as Translations;

const forkFlow = {
    start: 'act1',
    nodes: [
        { kind: 'scene', id: 'act1', sceneId: 'act1', next: 'act2' },
        { kind: 'scene', id: 'act2', sceneId: 'act2', next: 'choice:c1' },
        {
            kind: 'choice',
            id: 'choice:c1',
            choiceId: 'c1',
            nextByOption: {
                b1a: 'b1a_act3',
                b1b: 'b1b_act3',
                b1c: 'b1c_act3',
            },
        },
        {
            kind: 'scene',
            id: 'b1a_act3',
            sceneId: 'b1a_act3',
            next: 'b1a_act4',
        },
        {
            kind: 'scene',
            id: 'b1a_act4',
            sceneId: 'b1a_act4',
            next: 'choice:c2',
        },
        {
            kind: 'choice',
            id: 'choice:c2',
            choiceId: 'c2',
            nextByOption: { b2a: 'b1a_b2a_act5', b2b: 'b1a_b2b_act5' },
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_act5',
            sceneId: 'b1a_b2a_act5',
            next: 'b1a_b2a_actFinal',
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_actFinal',
            sceneId: 'b1a_b2a_actFinal',
            next: null,
        },
        {
            kind: 'scene',
            id: 'b1a_b2b_act5',
            sceneId: 'b1a_b2b_act5',
            next: null,
        },
        { kind: 'scene', id: 'b1b_act3', sceneId: 'b1b_act3', next: null },
        { kind: 'scene', id: 'b1c_act3', sceneId: 'b1c_act3', next: null },
    ],
} as unknown as StoryFlowConfig;

const choices: ChoiceMap = {
    c1: {
        prompt: 'Which fork?',
        options: [
            { id: 'b1a', nextScene: 'b1a_act3', label: 'Left path' },
            { id: 'b1b', nextScene: 'b1b_act3', label: 'Middle path' },
            { id: 'b1c', nextScene: 'b1c_act3', label: 'Right path' },
        ],
    },
    c2: {
        prompt: 'Up or down?',
        options: [
            { id: 'b2a', nextScene: 'b1a_b2a_act5', label: 'Climb' },
            { id: 'b2b', nextScene: 'b1a_b2b_act5', label: 'Descend' },
        ],
    },
};

function progress(visited: string[], endings: string[] = []): StoryProgress {
    return {
        sceneId: visited[visited.length - 1] ?? 'act1',
        dialogueIndex: 0,
        updatedAt: 0,
        finished: false,
        endings,
        visited,
    };
}

function baseProps(overrides: Record<string, unknown> = {}) {
    return {
        open: true,
        flow: forkFlow,
        choices,
        storyTitle: 'The Fork',
        currentSceneId: 'b1a_act3',
        dialogueIndex: 2,
        lineCount: 5,
        progress: progress(['act1', 'act2', 'b1a_act3']),
        t,
        onJump: vi.fn(),
        onClose: vi.fn(),
        ...overrides,
    };
}

function details() {
    return screen.getByTestId('story-map-details');
}

function surface() {
    return screen.getByTestId('story-map-surface');
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('StoryMapSheet', () => {
    it('renders nothing when closed', () => {
        render(StoryMapSheet, { props: baseProps({ open: false }) });
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens as a labelled modal dialog with translated chrome', () => {
        render(StoryMapSheet, { props: baseProps() });
        const dialog = screen.getByRole('dialog', { name: 'Story map' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(screen.getByText('The Fork')).toBeTruthy();
        expect(
            screen.getAllByRole('button', { name: 'Close story map' }).length
        ).toBeGreaterThanOrEqual(2);
        expect(
            screen.getByRole('button', { name: 'Locate current position' })
        ).toBeTruthy();
    });

    it('shows the current act, line and discovered stats by default', () => {
        render(StoryMapSheet, { props: baseProps() });
        expect(within(details()).getByText('Current position')).toBeTruthy();
        expect(within(details()).getByText('Act 3')).toBeTruthy();
        expect(within(details()).getByText('Line 3 of 5')).toBeTruthy();
        expect(within(details()).getByText('3 acts')).toBeTruthy();
        expect(within(details()).getByText('1 decisions')).toBeTruthy();
        expect(within(details()).getByText('0 endings')).toBeTruthy();
    });

    it('marks the current node and moves focus inside the dialog', () => {
        render(StoryMapSheet, { props: baseProps() });
        const current = screen.getByRole('button', {
            name: 'Current position: Act 3 — Left path',
        });
        expect(current.getAttribute('aria-current')).toBe('location');
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('selects a scene node and offers a start jump to it', async () => {
        const onJump = vi.fn();
        render(StoryMapSheet, { props: baseProps({ onJump }) });
        await fireEvent.click(
            screen.getByRole('button', {
                name: 'Current position: Act 3 — Left path',
            })
        );
        await fireEvent.click(
            within(details()).getByRole('button', { name: 'Jump to Act 3' })
        );
        expect(onJump).toHaveBeenCalledWith('b1a_act3', 'start');
    });

    it('unfolds a collapsed run when selected and folds it back from details', async () => {
        const onJump = vi.fn();
        render(StoryMapSheet, { props: baseProps({ onJump }) });
        await fireEvent.click(
            within(surface()).getByRole('button', { name: 'Expand Acts 1–2' })
        );
        expect(screen.getByRole('button', { name: 'Act 1' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Act 2' })).toBeTruthy();
        expect(within(details()).getByText('Acts 1–2')).toBeTruthy();
        await fireEvent.click(
            within(details()).getByRole('button', {
                name: 'Jump to Acts 1–2',
            })
        );
        expect(onJump).toHaveBeenCalledWith('act1', 'start');
        await fireEvent.click(
            within(details()).getByRole('button', {
                name: 'Collapse Acts 1–2',
            })
        );
        expect(
            within(surface()).queryByRole('button', { name: 'Act 2' })
        ).toBeNull();
        expect(
            within(details()).getByRole('button', { name: 'Expand Acts 1–2' })
        ).toBeTruthy();
    });

    it('activates focused nodes with Enter and Space', async () => {
        render(StoryMapSheet, { props: baseProps() });
        const pill = within(surface()).getByRole('button', {
            name: 'Expand Acts 1–2',
        });
        pill.focus();
        await fireEvent.keyDown(pill, { key: 'Enter' });
        expect(screen.getByRole('button', { name: 'Act 1' })).toBeTruthy();
        await fireEvent.click(
            within(details()).getByRole('button', {
                name: 'Collapse Acts 1–2',
            })
        );
        const folded = within(surface()).getByRole('button', {
            name: 'Expand Acts 1–2',
        });
        folded.focus();
        await fireEvent.keyDown(folded, { key: ' ' });
        expect(screen.getByRole('button', { name: 'Act 1' })).toBeTruthy();
    });

    it('marks the selected node with aria-pressed', async () => {
        render(StoryMapSheet, { props: baseProps() });
        const current = screen.getByRole('button', {
            name: 'Current position: Act 3 — Left path',
        });
        await fireEvent.click(current);
        expect(current.getAttribute('aria-pressed')).toBe('true');
    });

    it('shows the decision prompt, option statuses and an end jump', async () => {
        const onJump = vi.fn();
        render(StoryMapSheet, { props: baseProps({ onJump }) });
        await fireEvent.click(
            screen.getByRole('button', { name: 'Decision · 3 options' })
        );
        expect(within(details()).getByText('Which fork?')).toBeTruthy();
        expect(within(details()).getByText('Left path')).toBeTruthy();
        expect(within(details()).getByText('Middle path')).toBeTruthy();
        expect(within(details()).getByText('Right path')).toBeTruthy();
        expect(within(details()).getAllByText('Not read yet')).toHaveLength(2);
        expect(within(details()).getByText('Act 3')).toBeTruthy();
        await fireEvent.click(
            within(details()).getByRole('button', { name: 'Jump to Act 2' })
        );
        expect(onJump).toHaveBeenCalledWith('act2', 'end');
    });

    it('keeps unpassed decisions and unread destinations hidden', () => {
        const { container } = render(StoryMapSheet, {
            props: baseProps({
                progress: progress(['act1', 'act2']),
                currentSceneId: 'act2',
            }),
        });
        expect(screen.queryByRole('button', { name: /^Decision/ })).toBeNull();
        expect(screen.queryByText('Left path')).toBeNull();
        expect(
            within(surface()).getAllByRole('button', {
                name: 'Not read yet',
            }).length
        ).toBeGreaterThan(0);
        expect(container.innerHTML).not.toContain('b1a_act3');
        expect(container.innerHTML).not.toContain('b1b_act3');
        expect(container.innerHTML).not.toContain('choice:c1');
    });

    it('shows option labels on the map only once the choice is passed', () => {
        render(StoryMapSheet, { props: baseProps() });
        expect(screen.getByText('Middle path')).toBeTruthy();
        expect(screen.getByText('Right path')).toBeTruthy();
    });

    it('shows Not read yet for unread markers and offers no jump', async () => {
        render(StoryMapSheet, { props: baseProps() });
        const unknown = within(surface()).getAllByRole('button', {
            name: /^Not read yet/,
        })[0];
        await fireEvent.click(unknown);
        expect(within(details()).getByText('Not read yet')).toBeTruthy();
        expect(
            within(details()).queryByRole('button', { name: /^Jump to/ })
        ).toBeNull();
    });

    it('marks a completed ending and jumps to its scene', async () => {
        const onJump = vi.fn();
        const { container } = render(StoryMapSheet, {
            props: baseProps({
                progress: progress(
                    ['act1', 'act2', 'b1a_act3', 'b1b_act3'],
                    ['b1b_act3']
                ),
                currentSceneId: 'b1b_act3',
                onJump,
            }),
        });
        const ending = container.querySelector('[data-kind="ending"]');
        expect(ending).not.toBeNull();
        expect(
            screen.getByRole('button', { name: 'Ending Act 3 — Middle path' })
        ).toBeTruthy();
        await fireEvent.click(ending as HTMLElement);
        expect(within(details()).getByText('Ending Act 3')).toBeTruthy();
        await fireEvent.click(
            within(details()).getByRole('button', { name: 'Jump to Act 3' })
        );
        expect(onJump).toHaveBeenCalledWith('b1b_act3', 'start');
    });

    it('keeps an uncompleted terminal behind a Not read yet marker', () => {
        const { container } = render(StoryMapSheet, {
            props: baseProps({
                progress: progress(['act1', 'act2', 'b1a_act3', 'b1b_act3']),
                currentSceneId: 'b1b_act3',
            }),
        });
        expect(container.querySelector('[data-kind="ending"]')).toBeNull();
        expect(container.innerHTML).not.toContain('data-kind="ending"');
    });

    it('names nodes with type and revealed branch context', () => {
        render(StoryMapSheet, {
            props: baseProps({
                progress: progress([
                    'act1',
                    'act2',
                    'b1a_act3',
                    'b1a_act4',
                    'b1a_b2a_act5',
                ]),
                currentSceneId: 'b1a_b2a_act5',
            }),
        });
        expect(
            screen.getByRole('button', {
                name: 'Current position: Act 5 — Climb',
            })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Expand Acts 3–4 — Left path' })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'Decision · 2 options — Left path',
            })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Not read yet — Descend' })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Not read yet — Climb' })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Expand Acts 1–2' })
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Decision · 3 options' })
        ).toBeTruthy();
    });

    it('paints route strokes with a map-space gradient', () => {
        const { container } = render(StoryMapSheet, { props: baseProps() });
        const gradient = container.querySelector('linearGradient');
        expect(gradient?.getAttribute('gradientUnits')).toBe('userSpaceOnUse');
        const x1 = Number(gradient?.getAttribute('x1'));
        const x2 = Number(gradient?.getAttribute('x2'));
        expect(x2).toBeGreaterThan(x1);
        expect(
            container.querySelectorAll('path[stroke="url(#story-map-route)"]')
                .length
        ).toBeGreaterThan(0);
    });

    it('styles the shared trunk from the side branches it serves', () => {
        const { container } = render(StoryMapSheet, { props: baseProps() });
        const stub = container.querySelector('path[data-edge-kind="stub"]');
        const trunks = container.querySelectorAll(
            'path[data-edge-kind="trunk"]'
        );
        expect(stub?.getAttribute('data-edge-status')).toBe('unread');
        expect(trunks.length).toBeGreaterThan(0);
        for (const t of trunks) {
            expect(t.getAttribute('data-edge-status')).toBe('unread');
        }
    });

    it('splits the trunk at offshoots so unread-only sections stay unread', () => {
        const { container } = render(StoryMapSheet, {
            props: baseProps({
                progress: progress(['act1', 'act2', 'b1a_act3', 'b1b_act3']),
                currentSceneId: 'b1b_act3',
            }),
        });
        const stub = container.querySelector('path[data-edge-kind="stub"]');
        const trunks = [
            ...container.querySelectorAll('path[data-edge-kind="trunk"]'),
        ];
        expect(stub?.getAttribute('data-edge-status')).toBe('explored');
        expect(trunks.length).toBe(3);
        expect(trunks.map(t => t.getAttribute('data-edge-status'))).toEqual([
            'explored',
            'unread',
            'unread',
        ]);
    });

    it('scrolls the current node into view on open and on locate', async () => {
        const scrollSpy = vi
            .spyOn(Element.prototype, 'scrollIntoView')
            .mockImplementation(() => {});
        render(StoryMapSheet, { props: baseProps() });
        await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        scrollSpy.mockClear();
        await fireEvent.click(
            screen.getByRole('button', { name: 'Locate current position' })
        );
        expect(scrollSpy).toHaveBeenCalled();
        expect(within(details()).getByText('Current position')).toBeTruthy();
    });

    it('closes on Escape and on the scrim', async () => {
        const onClose = vi.fn();
        render(StoryMapSheet, { props: baseProps({ onClose }) });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
        const scrim = screen.getAllByRole('button', {
            name: 'Close story map',
        })[0];
        await fireEvent.click(scrim);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('restores focus to the opener when closed', async () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { unmount } = render(StoryMapSheet, { props: baseProps() });
        expect(
            screen.getByRole('dialog').contains(document.activeElement)
        ).toBe(true);
        unmount();
        expect(document.activeElement).toBe(opener);
        opener.remove();
    });

    it('scrolls instantly when reduced motion is preferred', async () => {
        const scrollSpy = vi
            .spyOn(Element.prototype, 'scrollIntoView')
            .mockImplementation(() => {});
        const matchSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
            query =>
                ({
                    matches: query.includes('reduce'),
                    media: query,
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                }) as unknown as MediaQueryList
        );
        render(StoryMapSheet, { props: baseProps() });
        await vi.waitFor(() => expect(scrollSpy).toHaveBeenCalled());
        expect(scrollSpy).toHaveBeenCalledWith(
            expect.objectContaining({ behavior: 'auto' })
        );
        matchSpy.mockRestore();
    });

    it('keeps Tab cycling inside the sheet', async () => {
        render(StoryMapSheet, { props: baseProps() });
        const dialog = screen.getByRole('dialog');
        const buttons = dialog.querySelectorAll('button');
        const last = buttons[buttons.length - 1] as HTMLElement;
        last.focus();
        await fireEvent.keyDown(last, { key: 'Tab' });
        expect(document.activeElement).toBe(buttons[0]);
    });

    it('renders the supplied translations', () => {
        const zhT = {
            reader: {
                ...t.reader,
                actLabel: '第 {n} 章',
                actRangeLabel: '第 {first}–{last} 章',
                lineProgress: '第 {current} / {total} 行',
                storyMap: {
                    title: '故事地圖',
                    open: '開啟故事地圖',
                    close: '關閉故事地圖',
                    locateCurrent: '顯示目前位置',
                    currentPosition: '目前位置',
                    statsActs: '{n} 章',
                    statsDecisions: '{n} 個抉擇',
                    statsEndings: '{n} 個結局',
                    expandRun: '展開 {label}',
                    collapseRun: '收合 {label}',
                    decision: '抉擇',
                    options: '{n} 個選項',
                    unreadLabel: '尚未閱讀',
                    endingLabel: '結局 {label}',
                    withBranch: '{label} — {branch}',
                    jumpTo: '跳至 {label}',
                },
            },
        } as unknown as Translations;
        render(StoryMapSheet, { props: baseProps({ t: zhT }) });
        expect(screen.getByRole('dialog', { name: '故事地圖' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: '展開 第 1–2 章' })
        ).toBeTruthy();
        expect(within(details()).getByText('3 章')).toBeTruthy();
        expect(within(details()).getByText('第 3 / 5 行')).toBeTruthy();
        expect(
            within(surface()).getAllByRole('button', { name: /^尚未閱讀/ })
                .length
        ).toBeGreaterThan(0);
    });
});
