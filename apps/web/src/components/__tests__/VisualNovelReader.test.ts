import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type {
    ChoiceDefinition,
    DialogueEntry,
    StoryFlowConfig,
    StoryPresentationMetadata,
} from '@aquila/stories';
import type {
    VisualSnapshot,
    VisualStateController,
} from '@/lib/visual-assets';

vi.mock('@aquila/stories/translations', () => ({
    getTranslations: vi.fn((locale: string) => ({
        reader: {
            unknown: 'Unknown',
            continue: 'Continue',
            nextScene: 'Next Scene',
            complete: 'Complete',
            bookmark: 'Bookmark',
            pageDisplay: 'Page {current} of {total}',
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
            historyTitle: 'History',
            openHistory: 'Open history',
            closeHistory: 'Close history',
            tapToContinue: 'Tap to continue',
            lineProgress: 'Line {current} of {total}',
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
        common: {
            backToHome: 'Back to Home',
        },
        locale,
    })),
}));

import VisualNovelReader from '../VisualNovelReader.svelte';

const flow = {
    start: 'b1a_act1',
    nodes: [
        {
            kind: 'scene',
            id: 'b1a_act1',
            sceneId: 'b1a_act1',
            next: 'b1a_act2',
        },
        {
            kind: 'scene',
            id: 'b1a_act2',
            sceneId: 'b1a_act2',
            next: null,
        },
    ],
} as unknown as StoryFlowConfig;

const presentation: StoryPresentationMetadata = {
    portrait: {
        activeLimit: 1,
        defaultSlot: 'center',
        slotsByCharacterId: { narrator: 'right' },
    },
};

const dialogue: DialogueEntry[] = [
    {
        characterId: 'narrator',
        dialogue: 'First visual line.',
        background: 'room',
        portrait: 'narrator-neutral',
    },
    { characterId: 'narrator', dialogue: 'Second visual line.' },
    { dialogue: 'Third visual line.' },
];

const choice: ChoiceDefinition = {
    prompt: 'Choose a route',
    options: [
        { id: 'left', label: 'Take the left path', nextScene: 'b1a_act2' },
    ],
};

const omittedLayer = {
    state: 'omitted' as const,
    identity: null,
    objectUrl: null,
    width: null,
    height: null,
};

const readySnapshot: VisualSnapshot = {
    release: 'ready',
    activeBackground: {
        state: 'ready',
        identity: 'background:room',
        objectUrl: 'blob:active',
        width: 1600,
        height: 900,
    },
    stagingBackground: {
        state: 'ready',
        identity: 'background:hall',
        objectUrl: 'blob:staging',
        width: 1600,
        height: 900,
    },
    portrait: {
        state: 'ready',
        identity: 'portrait:narrator-neutral',
        objectUrl: 'blob:portrait',
        width: 800,
        height: 1200,
        slot: 'right',
    },
    status: null,
};

function makeController(initialSnapshot: VisualSnapshot = readySnapshot) {
    let listener: ((snapshot: VisualSnapshot) => void) | null = null;
    const unsubscribe = vi.fn();
    const controller = {
        subscribe: vi.fn((next: (snapshot: VisualSnapshot) => void) => {
            listener = next;
            next(initialSnapshot);
            return unsubscribe;
        }),
        update: vi.fn(),
        commitBackgroundTransition: vi.fn(),
        dispose: vi.fn(),
    } as unknown as VisualStateController;

    return {
        controller,
        unsubscribe,
        emit(snapshot: VisualSnapshot) {
            listener?.(snapshot);
        },
    };
}

function setReducedMotion(matches: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => ({
            matches,
            media: '(prefers-reduced-motion: reduce)',
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

function renderReader(overrides: Record<string, unknown> = {}) {
    const runtime = makeController();
    const onIndexChange = vi.fn();
    const props: Record<string, unknown> = {
        controller: runtime.controller,
        flow,
        dialogue,
        dialogueIndex: 0,
        storyId: 'the_seventh_mirror',
        currentSceneId: 'b1a_act1',
        canGoNext: false,
        choice: null,
        locale: 'en',
        presentation,
        onChoice: vi.fn(),
        onBookmark: vi.fn(),
        onNext: vi.fn(),
        onNavigate: vi.fn(),
        onIndexChange,
        showBookmarkButton: true,
        backUrl: '/en/stories',
        isInitialMount: true,
        interactionDisabled: false,
        ...overrides,
    };
    const result = render(VisualNovelReader, { props });
    return {
        ...result,
        runtime,
        onIndexChange,
        rerender: (next: Record<string, unknown>) =>
            result.rerender({ ...props, ...next }),
    };
}

describe('VisualNovelReader', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders stable verified image layers and the visual release hooks', () => {
        setReducedMotion(false);
        renderReader({ isInitialMount: false });

        expect(screen.getByTestId('visual-novel-reader')).toHaveAttribute(
            'data-visual-release-state',
            'ready'
        );
        expect(screen.getByTestId('visual-novel-reader')).toHaveAttribute(
            'data-reader-mode',
            'visual'
        );
        expect(screen.getByTestId('visual-portrait')).toHaveAttribute(
            'data-portrait-slot',
            'right'
        );
        expect(screen.getByTestId('visual-portrait')).toHaveAttribute(
            'src',
            'blob:portrait'
        );
        expect(
            document.querySelector('[data-bg-layer="active"]')
        ).toHaveAttribute('src', 'blob:active');
        expect(
            document.querySelector('[data-bg-layer="staging"]')
        ).toHaveAttribute('src', 'blob:staging');
    });

    it('keeps all three image elements mounted and clears absent sources', () => {
        setReducedMotion(false);
        const runtime = makeController({
            release: 'ready',
            activeBackground: omittedLayer,
            stagingBackground: omittedLayer,
            portrait: { ...omittedLayer, slot: 'center' },
            status: null,
        });
        renderReader({
            controller: runtime.controller,
            isInitialMount: false,
        });

        expect(document.querySelectorAll('img')).toHaveLength(3);
        expect(
            document.querySelector('[data-bg-layer="active"]')
        ).not.toHaveAttribute('src');
        expect(
            document.querySelector('[data-bg-layer="staging"]')
        ).not.toHaveAttribute('src');
        expect(screen.getByTestId('visual-portrait')).not.toHaveAttribute(
            'src'
        );
    });

    it('updates and unsubscribes from the retained controller without disposing it', async () => {
        setReducedMotion(false);
        const { runtime, unmount } = renderReader({ dialogueIndex: 1 });
        await Promise.resolve();

        expect(runtime.controller.update).toHaveBeenCalledWith(
            expect.objectContaining({
                storyId: 'the_seventh_mirror',
                sceneId: 'b1a_act1',
                dialogueIndex: 1,
                dialogue,
                flow,
                presentation,
            })
        );

        unmount();
        expect(runtime.unsubscribe).toHaveBeenCalledOnce();
        expect(runtime.controller.dispose).not.toHaveBeenCalled();
    });

    it('uses the first touch action to skip typing and the second to advance', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader();
        const root = screen.getByTestId('visual-novel-reader');
        await vi.advanceTimersByTimeAsync(60);

        await fireEvent.pointerDown(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        await vi.advanceTimersByTimeAsync(50);
        expect(screen.getByText('First visual line.')).toBeInTheDocument();
        expect(onIndexChange).not.toHaveBeenCalled();

        await fireEvent.pointerDown(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('shows final-line choices and sends the selected next scene', async () => {
        setReducedMotion(false);
        const onChoice = vi.fn();
        renderReader({
            dialogue: [dialogue[0]],
            dialogueIndex: 0,
            choice,
            onChoice,
        });
        await vi.runAllTimersAsync();

        await fireEvent.click(
            screen.getByRole('button', { name: 'Take the left path' })
        );
        expect(onChoice).toHaveBeenCalledWith('b1a_act2');
    });

    it('does not show choices before the final line', async () => {
        setReducedMotion(false);
        renderReader({ choice, dialogueIndex: 0 });
        await vi.runAllTimersAsync();

        expect(screen.queryByText('Choose a route')).not.toBeInTheDocument();
    });

    it('makes reader content inert while backlog owns focus and restores the trigger', async () => {
        setReducedMotion(false);
        renderReader({ isInitialMount: false });
        const trigger = screen.getByRole('button', { name: 'Open history' });
        await fireEvent.click(trigger);

        expect(screen.getByTestId('visual-reader-content')).toHaveAttribute(
            'inert'
        );
        expect(screen.getByRole('dialog')).toContainElement(
            document.activeElement
        );

        await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
    });

    it('does not advance from interactive controls', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({ isInitialMount: false });
        const history = screen.getByRole('button', { name: 'Open history' });

        await fireEvent.pointerUp(history, {
            button: 0,
            pointerType: 'mouse',
            isPrimary: true,
        });
        await fireEvent.keyDown(history, { key: 'Enter' });

        expect(onIndexChange).not.toHaveBeenCalled();
    });

    it.each(['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const)(
        'does not advance from a primary pointer with %s',
        async modifier => {
            setReducedMotion(false);
            const { onIndexChange } = renderReader({
                isInitialMount: false,
            });
            const root = screen.getByTestId('visual-novel-reader');

            await fireEvent.pointerUp(root, {
                button: 0,
                pointerType: 'mouse',
                isPrimary: true,
                [modifier]: true,
            });

            expect(onIndexChange).not.toHaveBeenCalled();
        }
    );

    it('uses the dynamic viewport height without forcing a taller landscape minimum', () => {
        setReducedMotion(false);
        renderReader({ isInitialMount: false });

        expect(
            screen.getByTestId('visual-novel-reader').getAttribute('style')
        ).toContain('height: 100dvh; min-height: 0');
    });

    it('keeps dialogue usable and reports unavailable visuals to the shell', async () => {
        setReducedMotion(false);
        const onVisualStatusChange = vi.fn();
        const failed = makeController({
            release: 'unavailable',
            activeBackground: omittedLayer,
            stagingBackground: {
                ...omittedLayer,
                state: 'failed',
                identity: 'background:room',
            },
            portrait: {
                ...omittedLayer,
                state: 'failed',
                identity: 'portrait:narrator-neutral',
                slot: 'right',
            },
            status: 'unavailable',
        });
        renderReader({
            controller: failed.controller,
            isInitialMount: false,
            onVisualStatusChange,
        });

        expect(onVisualStatusChange).toHaveBeenLastCalledWith('unavailable');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('First visual line.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    });

    it('commits staging immediately without a crossfade for reduced motion', async () => {
        setReducedMotion(true);
        const { runtime } = renderReader({ isInitialMount: false });
        await Promise.resolve();
        const staging = document.querySelector(
            '[data-bg-layer="staging"]'
        ) as HTMLImageElement;

        expect(staging).not.toHaveClass('background-staging--transition');
        expect(
            runtime.controller.commitBackgroundTransition
        ).toHaveBeenCalledOnce();
    });

    it('commits normal-motion staging only after the transition ends', async () => {
        setReducedMotion(false);
        const { runtime } = renderReader({ isInitialMount: false });
        const staging = document.querySelector(
            '[data-bg-layer="staging"]'
        ) as HTMLImageElement;

        expect(staging).toHaveClass('background-staging--transition');
        expect(
            runtime.controller.commitBackgroundTransition
        ).not.toHaveBeenCalled();

        await fireEvent.transitionEnd(staging);
        expect(
            runtime.controller.commitBackgroundTransition
        ).toHaveBeenCalledOnce();
    });

    it('crossfades the staging layer from loading to ready', async () => {
        setReducedMotion(false);
        const loadingSnapshot: VisualSnapshot = {
            ...readySnapshot,
            stagingBackground: {
                state: 'loading',
                identity: 'background:hall',
                objectUrl: null,
                width: null,
                height: null,
            },
        };
        const runtime = makeController(loadingSnapshot);
        renderReader({
            controller: runtime.controller,
            isInitialMount: false,
        });
        const staging = document.querySelector(
            '[data-bg-layer="staging"]'
        ) as HTMLImageElement;

        expect(getComputedStyle(staging).opacity).toBe('0');

        runtime.emit(readySnapshot);
        await Promise.resolve();
        expect(getComputedStyle(staging).opacity).toBe('1');
    });

    it('snaps external index changes to fully revealed text', async () => {
        setReducedMotion(false);
        const rendered = renderReader({ dialogueIndex: 0 });
        await vi.runAllTimersAsync();

        await rendered.rerender({ dialogueIndex: 1 });

        expect(screen.getByText('Second visual line.')).toBeInTheDocument();
        expect(
            screen.queryByTestId('visual-typewriter-cursor')
        ).not.toBeInTheDocument();
    });

    it('does not show a typewriter cursor when startTyping is called with an out-of-bounds index', async () => {
        setReducedMotion(false);
        // Render with an empty dialogue so Signal 1 does not call startTyping.
        const { rerender } = renderReader({
            dialogue: [],
            dialogueIndex: 0,
        });
        expect(
            screen.queryByTestId('visual-typewriter-cursor')
        ).not.toBeInTheDocument();

        // Rerender with a non-empty dialogue at an out-of-bounds index so
        // Signal 1 calls startTyping with an undefined entry (lines 170-174).
        rerender({ dialogue: [dialogue[0]], dialogueIndex: 5 });
        await Promise.resolve();
        expect(
            screen.queryByTestId('visual-typewriter-cursor')
        ).not.toBeInTheDocument();
    });

    it('starts typing the next line when the parent lifts a self-initiated advance', async () => {
        setReducedMotion(false);
        const { onIndexChange, rerender } = renderReader({
            dialogueIndex: 0,
        });
        await vi.runAllTimersAsync(); // finish typing line 0

        // Click advance → sets selfAdvanceTarget = 1, emits onIndexChange(1).
        await fireEvent.pointerDown(screen.getByTestId('visual-novel-reader'), {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        await fireEvent.pointerUp(screen.getByTestId('visual-novel-reader'), {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        expect(onIndexChange).toHaveBeenCalledWith(1);

        // Parent lifts the index → Signal 2 fires with selfAdvanced = true
        // → startTyping(1) (line 225).
        rerender({ dialogueIndex: 1 });
        expect(
            screen.getByTestId('visual-typewriter-cursor')
        ).toBeInTheDocument();
    });

    it('calls onNext when advancing past the last line with canGoNext and no choice', async () => {
        setReducedMotion(false);
        const onNext = vi.fn();
        renderReader({
            dialogue: [dialogue[0]],
            dialogueIndex: 0,
            canGoNext: true,
            choice: null,
            onNext,
        });
        await vi.runAllTimersAsync(); // finish typing

        await fireEvent.click(screen.getByText('Next Scene'));
        expect(onNext).toHaveBeenCalled();
    });

    it('does not advance when a non-Enter/Space key is pressed', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({
            dialogueIndex: 0,
            isInitialMount: false,
        });
        await vi.runAllTimersAsync();

        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onIndexChange).not.toHaveBeenCalled();
    });

    it('advances the dialogue when Enter is pressed on a non-interactive target', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({
            dialogueIndex: 0,
            isInitialMount: false,
        });
        await vi.runAllTimersAsync(); // finish typing line 0

        // Fire Enter on the main reader element (not a data-reader-interactive target)
        // to exercise handleKeydown's preventDefault + advance() path (lines 260-262).
        const root = screen.getByTestId('visual-novel-reader');
        await fireEvent.keyDown(root, { key: 'Enter' });
        expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('toggles the act panel open and closed via the toggle button', async () => {
        setReducedMotion(false);
        renderReader({ isInitialMount: false });

        const toggle = screen.getByRole('button', {
            name: 'Open acts panel',
        });
        await fireEvent.click(toggle);
        expect(
            screen.getByRole('button', { name: 'Close acts panel' })
        ).toBeInTheDocument();

        await fireEvent.click(
            screen.getByRole('button', { name: 'Close acts panel' })
        );
        expect(
            screen.getByRole('button', { name: 'Open acts panel' })
        ).toBeInTheDocument();
    });

    it('calls onNavigate when the act panel selects a different scene', async () => {
        setReducedMotion(false);
        const onNavigate = vi.fn();
        renderReader({ isInitialMount: false, onNavigate });

        await fireEvent.click(
            screen.getByRole('button', { name: 'Open acts panel' })
        );
        await waitFor(() =>
            expect(screen.getByText('Act 2')).toBeInTheDocument()
        );
        await fireEvent.click(screen.getByText('Act 2'));
        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
    });

    it('calls onBookmark with dialogueIndex + 1 when the bookmark button is clicked', async () => {
        setReducedMotion(false);
        const onBookmark = vi.fn();
        renderReader({
            dialogueIndex: 1,
            onBookmark,
            isInitialMount: false,
        });

        await fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }));
        expect(onBookmark).toHaveBeenCalledWith(2);
    });

    it('renders choices for a choice-only scene with empty dialogue', async () => {
        setReducedMotion(false);
        const onChoice = vi.fn();
        renderReader({
            dialogue: [],
            dialogueIndex: 0,
            choice,
            onChoice,
        });

        await fireEvent.click(
            screen.getByRole('button', { name: 'Take the left path' })
        );
        expect(onChoice).toHaveBeenCalledWith('b1a_act2');
    });

    it('does not advance when a pointer moves beyond the tap threshold between down and up', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({
            dialogueIndex: 0,
            isInitialMount: false,
        });
        await vi.runAllTimersAsync();
        const root = screen.getByTestId('visual-novel-reader');

        await fireEvent.pointerDown(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 100,
            clientY: 200,
        });
        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 100,
            clientY: 250,
        });

        expect(onIndexChange).not.toHaveBeenCalled();
    });

    it('does not advance after a pointercancel resets the pointer tracking', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({
            dialogueIndex: 0,
            isInitialMount: false,
        });
        await vi.runAllTimersAsync();
        const root = screen.getByTestId('visual-novel-reader');

        await fireEvent.pointerDown(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 50,
            clientY: 50,
        });
        await fireEvent.pointerCancel(root, {
            pointerType: 'touch',
            isPrimary: true,
        });
        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 50,
            clientY: 50,
        });

        expect(onIndexChange).not.toHaveBeenCalled();
    });

    it('does not advance when a gesture begins on an interactive control and releases on the reader', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({
            dialogueIndex: 0,
            isInitialMount: false,
        });
        await vi.runAllTimersAsync();
        const root = screen.getByTestId('visual-novel-reader');
        const history = screen.getByRole('button', { name: 'Open history' });

        await fireEvent.pointerDown(history, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 10,
            clientY: 10,
        });
        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            clientX: 200,
            clientY: 200,
        });

        expect(onIndexChange).not.toHaveBeenCalled();
    });

    it('does not advance when movement exceeds the threshold and returns to the origin before release', async () => {
        setReducedMotion(false);
        const { onIndexChange } = renderReader({
            dialogueIndex: 0,
            isInitialMount: false,
        });
        await vi.runAllTimersAsync();
        const root = screen.getByTestId('visual-novel-reader');

        await fireEvent.pointerDown(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
        });
        await fireEvent.pointerMove(root, {
            pointerType: 'touch',
            isPrimary: true,
            pointerId: 1,
            clientX: 100,
            clientY: 150,
        });
        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
            pointerId: 1,
            clientX: 100,
            clientY: 100,
        });

        expect(onIndexChange).not.toHaveBeenCalled();
    });
});
