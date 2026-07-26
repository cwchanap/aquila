import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
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
            visualStaleRelease: 'Using saved visuals',
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

        await fireEvent.pointerUp(root, {
            button: 0,
            pointerType: 'touch',
            isPrimary: true,
        });
        await vi.advanceTimersByTimeAsync(50);
        expect(screen.getByText('First visual line.')).toBeInTheDocument();
        expect(onIndexChange).not.toHaveBeenCalled();

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

    it('keeps dialogue usable and announces unavailable visuals nonblockingly', async () => {
        setReducedMotion(false);
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
        });

        expect(screen.getByRole('status')).toHaveTextContent(
            'Visuals are unavailable'
        );
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
});
