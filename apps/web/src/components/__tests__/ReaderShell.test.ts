// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry, StoryFlowConfig } from '@aquila/stories';
import { StoryLoadError } from '@aquila/stories/async';
import {
    AssetResolverError,
    type AssetResolver,
    type AssetResolverSource,
} from '@aquila/stories/runtime-assets';
import {
    VisualStateController,
    type VisualReaderRuntime,
} from '@/lib/visual-assets';
import { READER_MODE_KEY } from '@/lib/reader-mode';

const { mockGetTranslations } = vi.hoisted(() => ({
    mockGetTranslations: vi.fn((locale: string) => ({
        reader: {
            unknown: 'Unknown',
            continue: 'Continue',
            nextScene: 'Next Scene',
            complete: 'Complete',
            bookmark: 'Bookmark',
            pageDisplay: '{current} / {total}',
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
            historyTitle: 'History',
            openMenu: 'Open menu',
            closeMenu: 'Close menu',
            openHistory: 'Open history',
            closeHistory: 'Close history',
            tapToContinue: 'Tap to continue',
            lineProgress: 'Line {current} of {total}',
            previousLine: 'Previous line',
            loadingStory: 'Loading story',
            storyLoadFailed: 'Story failed to load',
            unknownStory: 'Unknown story',
            unsupportedLocale: 'Unsupported locale',
            backToStories: 'Back to stories',
            retry: 'Retry',
            readerMode: 'Reader mode',
            textMode: 'Text',
            visualNovelMode: 'Visual Novel',
            visualStaleRelease: 'Using previously validated visuals',
            visualAssetFallback: 'Some visuals are unavailable',
            visualUnavailable: 'Visuals are unavailable',
        },
        characterNames: { narrator: 'Narrator' },
        common: { backToHome: 'Back to Home' },
        locale,
    })),
}));

vi.mock('@aquila/stories/translations', () => ({
    getTranslations: mockGetTranslations,
}));

import ReaderShell from '../ReaderShell.svelte';
import { readerState } from '@/lib/reader-state.svelte';

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First dialogue line.' },
    { characterId: 'narrator', dialogue: 'Second dialogue line.' },
    { characterId: 'narrator', dialogue: 'Third dialogue line.' },
];

const flow = {
    start: 'act1',
    nodes: [{ kind: 'scene', id: 'act1', sceneId: 'act1', next: null }],
} as unknown as StoryFlowConfig;

function createRuntimeHarness(): {
    runtime: VisualReaderRuntime;
    softRevalidate: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.spyOn>;
} {
    const source: AssetResolverSource = {
        environment: 'local',
        storyId: 'the_seventh_mirror',
        baseUrl: 'http://localhost:5090/assets/',
        target: { kind: 'preview', previewId: 'hpa-228-local' },
    };
    const resolver: AssetResolver = {
        source,
        loadActiveRelease: vi.fn(async () => {
            throw new AssetResolverError(
                'unavailable',
                'No visual release in this component test'
            );
        }),
        resolve: vi.fn(() => {
            throw new Error('resolve is unreachable without an active release');
        }),
        prefetchNextEdge: vi.fn(async request => ({
            requested: request.assets.length,
            cached: 0,
            failed: [],
        })),
        clear: vi.fn(),
    };
    const cache = {
        load: vi.fn(async () => {
            throw new Error('load is unreachable without an active release');
        }),
        prefetch: vi.fn(async () => {}),
        setProtectedKeys: vi.fn(),
    };
    const controller = new VisualStateController({
        resolver,
        cache,
        getSceneDialogue: () => null,
    });
    const subscribe = vi.spyOn(controller, 'subscribe');
    const softRevalidate = vi.fn(async () => {});
    const dispose = vi.fn(async () => {
        controller.dispose();
    });
    return {
        runtime: { controller, softRevalidate, dispose },
        softRevalidate,
        dispose,
        subscribe,
    };
}

function stubMatchMedia(initial: boolean) {
    let listeners: Array<(e: { matches: boolean }) => void> = [];
    const mql = {
        matches: initial,
        media: '(max-width: 1023px)',
        onchange: null,
        addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
            listeners.push(cb),
        removeEventListener: (
            _: string,
            cb: (e: { matches: boolean }) => void
        ) => {
            listeners = listeners.filter(l => l !== cb);
        },
        addListener: (cb: (e: { matches: boolean }) => void) =>
            listeners.push(cb),
        removeListener: (cb: (e: { matches: boolean }) => void) => {
            listeners = listeners.filter(l => l !== cb);
        },
        dispatchEvent: () => true,
    };
    Object.defineProperty(window, 'matchMedia', {
        value: vi.fn(() => mql),
        writable: true,
        configurable: true,
    });
    return {
        setMatches(v: boolean) {
            mql.matches = v;
            listeners.forEach(l => l({ matches: v }));
        },
    };
}

describe('ReaderShell', () => {
    // The global beforeEach in test-setup.ts resets readerState; seed the
    // store here so the bridge derives non-empty dialogue/locale.
    beforeEach(() => {
        localStorage.clear();
        readerState.dialogue = mockDialogue;
        readerState.storyId = 'the_seventh_mirror';
        readerState.currentSceneId = 'act1';
        readerState.locale = 'en';
        readerState.activeFlow = flow;
        readerState.hasActivePayload = true;
        readerState.loadStatus = 'ready';
    });
    afterEach(() => vi.clearAllMocks());

    it('defaults to Text and restores Visual synchronously without a Text leaf flash', () => {
        stubMatchMedia(false);
        const defaultFactory = vi.fn(() => createRuntimeHarness().runtime);
        const first = render(ReaderShell, {
            props: { createVisualRuntime: defaultFactory },
        });

        expect(
            screen.getByRole('group', { name: 'Reader mode' })
        ).toHaveAttribute('data-reader-mode', 'text');
        expect(
            screen.queryByTestId('visual-novel-reader')
        ).not.toBeInTheDocument();
        expect(defaultFactory).not.toHaveBeenCalled();
        first.unmount();

        localStorage.setItem(READER_MODE_KEY, 'visual');
        const persistedHarness = createRuntimeHarness();
        const persistedFactory = vi.fn(() => persistedHarness.runtime);
        render(ReaderShell, {
            props: { createVisualRuntime: persistedFactory },
        });

        expect(
            screen.getByRole('group', { name: 'Reader mode' })
        ).toHaveAttribute('data-reader-mode', 'visual');
        expect(screen.getByTestId('visual-novel-reader')).toBeInTheDocument();
        expect(persistedHarness.subscribe).toHaveBeenCalledOnce();
    });

    it.each([
        ['payload', 'ready', true],
        ['initial loading', 'loading', false],
        ['replacement error', 'error', true],
    ] as const)(
        'keeps the mode control interactive during %s',
        (_label, status, hasPayload) => {
            stubMatchMedia(false);
            readerState.hasActivePayload = hasPayload;
            readerState.activeFlow = hasPayload ? flow : null;
            readerState.loadStatus = status;
            if (status === 'error') {
                readerState.loadError = new StoryLoadError(
                    'load-failed',
                    'failed'
                );
            }

            render(ReaderShell);

            const control = screen.getByRole('group', {
                name: 'Reader mode',
            });
            expect(control).toHaveAttribute('data-reader-interactive');
            expect(screen.getByRole('button', { name: 'Text' })).toBeEnabled();
            expect(
                screen.getByRole('button', { name: 'Visual Novel' })
            ).toBeEnabled();
        }
    );

    it('preserves the exact nonzero line across mode toggles and breakpoint changes', async () => {
        const mm = stubMatchMedia(false);
        readerState.dialogueIndex = 1;
        const harness = createRuntimeHarness();
        const createRuntime = vi.fn(() => harness.runtime);
        render(ReaderShell, { props: { createVisualRuntime: createRuntime } });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        await fireEvent.click(
            screen.getByRole('button', { name: 'Visual Novel' })
        );
        await tick();
        expect(screen.getByTestId('visual-novel-reader')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        mm.setMatches(true);
        await tick();
        expect(screen.getByTestId('visual-novel-reader')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
        await vi.runAllTimersAsync();
        expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        mm.setMatches(false);
        await vi.runAllTimersAsync();
        expect(
            screen.queryByLabelText('Tap to continue')
        ).not.toBeInTheDocument();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
    });

    it('creates one retained runtime and disposes it before replacement and on destroy', async () => {
        stubMatchMedia(false);
        const events: string[] = [];
        const harnesses = [createRuntimeHarness(), createRuntimeHarness()];
        harnesses.forEach((harness, index) => {
            harness.dispose.mockImplementation(async () => {
                events.push(`dispose:${index}:start`);
                await Promise.resolve();
                events.push(`dispose:${index}:end`);
                harness.runtime.controller.dispose();
            });
        });
        const createRuntime = vi.fn((storyId: string) => {
            const index = createRuntime.mock.calls.length - 1;
            events.push(`create:${storyId}`);
            return harnesses[index]?.runtime ?? null;
        });
        const view = render(ReaderShell, {
            props: { createVisualRuntime: createRuntime },
        });

        await fireEvent.click(
            screen.getByRole('button', { name: 'Visual Novel' })
        );
        await tick();
        await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
        await fireEvent.click(
            screen.getByRole('button', { name: 'Visual Novel' })
        );
        await tick();
        expect(createRuntime).toHaveBeenCalledTimes(1);
        expect(harnesses[0].dispose).not.toHaveBeenCalled();

        readerState.storyId = 'replacement_story';
        await tick();
        await Promise.resolve();
        await tick();
        expect(createRuntime).toHaveBeenCalledTimes(2);
        expect(events).toEqual([
            'create:the_seventh_mirror',
            'dispose:0:start',
            'dispose:0:end',
            'create:replacement_story',
        ]);
        expect(harnesses[1].subscribe).toHaveBeenCalledOnce();

        view.unmount();
        await Promise.resolve();
        expect(harnesses[1].dispose).toHaveBeenCalledOnce();
    });

    it('requests revalidation only on aged visual lifecycle events and never from a timer', async () => {
        stubMatchMedia(false);
        const harness = createRuntimeHarness();
        render(ReaderShell, {
            props: { createVisualRuntime: () => harness.runtime },
        });

        await fireEvent.click(
            screen.getByRole('button', { name: 'Visual Novel' })
        );
        await tick();
        expect(harness.softRevalidate).not.toHaveBeenCalled();

        await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
        await vi.advanceTimersByTimeAsync(60_001);
        expect(harness.softRevalidate).not.toHaveBeenCalled();
        await fireEvent.click(
            screen.getByRole('button', { name: 'Visual Novel' })
        );
        expect(harness.softRevalidate).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(60_001);
        expect(harness.softRevalidate).toHaveBeenCalledTimes(1);
        readerState.dialogueIndex = 1;
        await tick();
        expect(harness.softRevalidate).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(60_001);
        document.dispatchEvent(new Event('visibilitychange'));
        expect(harness.softRevalidate).toHaveBeenCalledTimes(3);
    });

    it('marks keyed source-less visuals unavailable and keeps omitted lines neutral without requests', async () => {
        stubMatchMedia(false);
        readerState.storyId = 'train_adventure';
        readerState.dialogue = [
            {
                characterId: 'narrator',
                dialogue: 'Keyed without a source.',
                background: 'train/platform',
            },
        ];
        localStorage.setItem(READER_MODE_KEY, 'visual');
        const fetchSpy = vi.spyOn(globalThis, 'fetch');

        render(ReaderShell);
        await waitFor(() => {
            expect(screen.getByTestId('visual-novel-reader')).toHaveAttribute(
                'data-visual-release-state',
                'unavailable'
            );
        });

        expect(screen.getByTestId('visual-status')).toHaveTextContent(
            'Visuals are unavailable'
        );
        expect(fetchSpy).not.toHaveBeenCalled();

        readerState.dialogue = [{ dialogue: 'Intentionally omitted.' }];
        await tick();
        await waitFor(() => {
            expect(screen.getByTestId('visual-novel-reader')).toHaveAttribute(
                'data-visual-release-state',
                'idle'
            );
        });
        expect(screen.queryByTestId('visual-status')).not.toBeInTheDocument();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('keeps visual status above and outside the inert reader during replacement loading', async () => {
        stubMatchMedia(false);
        readerState.dialogue = [
            {
                characterId: 'narrator',
                dialogue: 'A keyed visual line.',
                background: 'room',
            },
        ];
        localStorage.setItem(READER_MODE_KEY, 'visual');
        const harness = createRuntimeHarness();
        render(ReaderShell, {
            props: { createVisualRuntime: () => harness.runtime },
        });

        const visualStatus = await screen.findByTestId('visual-status');
        const ready = screen.getByTestId('reader-ready');
        expect(visualStatus).toHaveTextContent('Visuals are unavailable');
        expect(ready).not.toContainElement(visualStatus);

        readerState.loadStatus = 'loading';
        await tick();

        expect(ready).toHaveAttribute('inert');
        expect(visualStatus).toBeVisible();
        expect(ready).not.toContainElement(visualStatus);
    });

    it('keeps the dialogue bridge deferred for the visual reader runtime', () => {
        stubMatchMedia(false);
        const getSceneDialogue = vi.fn(() => null);

        render(ReaderShell, { props: { getSceneDialogue } });

        expect(getSceneDialogue).not.toHaveBeenCalled();
    });

    it('renders only a standalone status while the initial payload is loading', () => {
        stubMatchMedia(false);
        readerState.activeFlow = null;
        readerState.hasActivePayload = false;
        readerState.loadStatus = 'loading';

        render(ReaderShell, { props: { onIndexChange: () => {} } });

        expect(screen.getByRole('status')).toHaveTextContent('Loading story');
        expect(screen.queryByTestId('reader-ready')).not.toBeInTheDocument();
        expect(screen.queryByText('Back to Home')).not.toBeInTheDocument();
    });

    it('treats the first leaf mounted after initial loading as a fresh scene', async () => {
        stubMatchMedia(false);
        readerState.activeFlow = null;
        readerState.hasActivePayload = false;
        readerState.loadStatus = 'loading';
        render(ReaderShell);
        await tick();

        readerState.activeFlow = flow;
        readerState.hasActivePayload = true;
        readerState.loadStatus = 'ready';
        await tick();

        expect(screen.getByTestId('reader-ready')).toBeInTheDocument();
        expect(
            document.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0);
    });

    it('keeps the same reader leaf mounted and inert under replacement loading', async () => {
        stubMatchMedia(false);
        const onIndexChange = vi.fn();
        render(ReaderShell, { props: { onIndexChange } });
        await vi.runAllTimersAsync();
        const ready = screen.getByTestId('reader-ready');

        readerState.loadStatus = 'loading';
        await tick();

        expect(screen.getByTestId('reader-ready')).toBe(ready);
        expect(ready).toHaveAttribute('inert');
        expect(ready).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByRole('status')).toHaveTextContent('Loading story');
        await fireEvent.keyDown(window, { key: 'Enter' });
        expect(onIndexChange).not.toHaveBeenCalled();
        expect(readerState.dialogueIndex).toBe(0);

        readerState.loadStatus = 'ready';
        await tick();
        expect(screen.getByTestId('reader-ready')).toBe(ready);
        expect(ready).not.toHaveAttribute('inert');
        expect(ready).not.toHaveAttribute('aria-hidden');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('renders a retryable alert without unmounting the active reader', async () => {
        const onRetry = vi.fn();
        stubMatchMedia(false);
        render(ReaderShell, { props: { onRetry } });
        const ready = screen.getByTestId('reader-ready');

        readerState.loadError = new StoryLoadError('load-failed', 'failed');
        readerState.loadStatus = 'error';
        await tick();

        expect(screen.getByTestId('reader-ready')).toBe(ready);
        expect(ready).toHaveAttribute('inert');
        expect(screen.getByRole('alert')).toHaveTextContent(
            'Story failed to load'
        );
        await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalledOnce();
    });

    it('blocks the mobile window keyboard path under a replacement error', async () => {
        const onIndexChange = vi.fn();
        stubMatchMedia(true);
        render(ReaderShell, { props: { onIndexChange } });
        await vi.runAllTimersAsync();

        readerState.loadError = new StoryLoadError('load-failed', 'failed');
        readerState.loadStatus = 'error';
        await tick();
        await fireEvent.keyDown(window, { key: ' ' });

        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(onIndexChange).not.toHaveBeenCalled();
        expect(readerState.dialogueIndex).toBe(0);
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });

    it.each([
        ['unknown-story', 'Unknown story'],
        ['unsupported-locale', 'Unsupported locale'],
    ] as const)(
        'renders %s as a terminal error with a locale story-list link',
        (code, message) => {
            stubMatchMedia(false);
            readerState.activeFlow = null;
            readerState.hasActivePayload = false;
            readerState.loadError = new StoryLoadError(code, 'failed');
            readerState.loadStatus = 'error';

            render(ReaderShell);

            expect(screen.getByRole('alert')).toHaveTextContent(message);
            expect(
                screen.getByRole('link', { name: 'Back to stories' })
            ).toHaveAttribute('href', '/en/stories');
            expect(
                screen.queryByRole('button', { name: 'Retry' })
            ).not.toBeInTheDocument();
        }
    );

    it('renders the desktop reader at >= lg', async () => {
        stubMatchMedia(false);
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
        expect(
            screen.queryByLabelText('Tap to continue')
        ).not.toBeInTheDocument();
    });

    it('renders the mobile reader below lg', async () => {
        stubMatchMedia(true);
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument();
    });

    it('switches readers when the media query changes', async () => {
        const mm = stubMatchMedia(false);
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        expect(screen.getByText('Back to Home')).toBeInTheDocument();
        mm.setMatches(true);
        await waitFor(() => {
            expect(
                screen.getByLabelText('Tap to continue')
            ).toBeInTheDocument();
        });
    });

    it('forwards store-derived dialogueIndex to whichever reader is mounted', async () => {
        stubMatchMedia(false);
        readerState.dialogueIndex = 1;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
    });

    it('preserves the store-derived index when switching layouts', async () => {
        const mm = stubMatchMedia(false);
        readerState.dialogueIndex = 1;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        // Rotate/resize across the 1023px breakpoint -> mobile reader mounts.
        mm.setMatches(true);
        await waitFor(() => {
            expect(
                screen.getByLabelText('Tap to continue')
            ).toBeInTheDocument();
        });
        await vi.runAllTimersAsync();

        // The mobile reader should resume at the store-derived index (1).
        // The backlog sheet is closed by default, so only the current line's
        // text is in the DOM.
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
        expect(
            screen.queryByText('First dialogue line.')
        ).not.toBeInTheDocument();
    });

    it('uses the latest readerState.dialogueIndex on layout swap, not a stale value', async () => {
        const mm = stubMatchMedia(false);
        readerState.dialogueIndex = 1;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();

        // Advance the store index after the desktop reader has mounted.
        readerState.dialogueIndex = 2;

        // Swap to mobile: must pick up the latest store value (2), not the
        // value that was current at desktop mount time (1).
        mm.setMatches(true);
        await waitFor(() => {
            expect(
                screen.getByLabelText('Tap to continue')
            ).toBeInTheDocument();
        });
        await vi.runAllTimersAsync();
        expect(screen.getByText('Third dialogue line.')).toBeInTheDocument();
        expect(
            screen.queryByText('Second dialogue line.')
        ).not.toBeInTheDocument();
    });

    // End-to-end regression: drive the full loop through the canonical store —
    // keyboard advance on desktop fires onIndexChange, which writes
    // readerState.dialogueIndex; flipping the media query mounts the mobile
    // reader, which must resume at that store-owned index. Proves the store
    // survives the layout swap with no liveIndex/hasSwapped machinery.
    it('preserves the exact line across a desktop->mobile swap via the store', async () => {
        const mm = stubMatchMedia(false);
        const onIndexChange = (i: number) => {
            readerState.dialogueIndex = i;
        };
        render(ReaderShell, { props: { onIndexChange } });
        // Let mount effects flush so the typewriter is in-flight (isTyping
        // === true) before the first Enter — do NOT runAllTimers here, or
        // typing would already be complete and the first Enter would advance.
        await tick();

        // First Enter only skips the typewriter (parent owns the index).
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.runAllTimersAsync(); // typewriter breaks out, isTyping = false
        // Second Enter advances via onIndexChange -> readerState.dialogueIndex.
        await fireEvent.keyDown(window, { key: 'Enter' });
        await vi.runAllTimersAsync();
        expect(readerState.dialogueIndex).toBe(1);

        // Swap layouts across the breakpoint. The mobile reader mounts fresh
        // and must read the store-owned index (1), not a mount-time snapshot.
        mm.setMatches(true);
        await waitFor(() =>
            expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument()
        );
        await vi.runAllTimersAsync();
        expect(screen.getByText('Second dialogue line.')).toBeInTheDocument();
    });

    // Regression guard for the breakpoint-remount-at-index-0 case. When the
    // user resizes across the 1023px breakpoint while the current scene is at
    // index 0, the new leaf mounts with `lastDialogueRef === undefined` and
    // `dialogueIndex === 0`. Without the `isInitialMount` signal from
    // ReaderShell, the leaf cannot tell this apart from a genuine fresh scene
    // start at index 0 and would re-type the already-completed line 0. The
    // signal (`isInitialMount=false` on a swap) makes Signal 1 snap instead.
    it('snaps (does not re-type) line 0 across a desktop->mobile breakpoint swap', async () => {
        const mm = stubMatchMedia(false);
        readerState.dialogueIndex = 0;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        // Let the desktop leaf finish typing line 0.
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();

        // Swap across the breakpoint -> mobile leaf mounts at index 0.
        mm.setMatches(true);
        await waitFor(() =>
            expect(screen.getByLabelText('Tap to continue')).toBeInTheDocument()
        );
        // The mobile leaf must NOT re-animate line 0 (no typewriter cursor).
        // Do NOT settle timers — observe the snap state immediately after swap.
        expect(
            document.querySelectorAll('[class*="animate-pulse"]').length
        ).toBe(0);
        // Line 0 is fully visible immediately (snap reveals it).
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });

    it('snaps (does not re-type) line 0 across a mobile->desktop breakpoint swap', async () => {
        const mm = stubMatchMedia(true);
        readerState.dialogueIndex = 0;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        // Let the mobile leaf finish typing line 0.
        await vi.runAllTimersAsync();
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();

        // Swap across the breakpoint -> desktop leaf mounts at index 0.
        mm.setMatches(false);
        await waitFor(() =>
            expect(screen.getByText('Back to Home')).toBeInTheDocument()
        );
        // The desktop leaf must NOT re-animate line 0 (no typewriter cursor).
        expect(document.querySelectorAll('.animate-pulse').length).toBe(0);
        expect(screen.getByText('First dialogue line.')).toBeInTheDocument();
    });

    // The very first leaf mount at index 0 (genuine fresh scene start) must
    // STILL animate — the breakpoint-remount snap must not regress this. The
    // `isInitialMount=true` signal (everMounted is false on the first render)
    // distinguishes a fresh start from a swap.
    it('animates line 0 on the very first desktop mount (fresh scene start)', async () => {
        stubMatchMedia(false);
        readerState.dialogueIndex = 0;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        // Do NOT settle timers — observe the in-flight typewriter immediately.
        expect(
            document.querySelectorAll('.animate-pulse').length
        ).toBeGreaterThan(0);
    });
    it('animates line 0 on the very first mobile mount (fresh scene start)', async () => {
        stubMatchMedia(true);
        readerState.dialogueIndex = 0;
        render(ReaderShell, { props: { onIndexChange: () => {} } });
        expect(
            document.querySelectorAll('[class*="animate-pulse"]').length
        ).toBeGreaterThan(0);
    });

    it('defaults to desktop and skips the media-query listener when matchMedia is unavailable', () => {
        // Remove matchMedia to cover the SSR/no-matchMedia guard branches
        // (readMatch returns false, onMount returns early).
        const original = window.matchMedia;
        Object.defineProperty(window, 'matchMedia', {
            value: undefined,
            writable: true,
            configurable: true,
        });
        try {
            const view = render(ReaderShell);
            // readMatch returns false → desktop reader renders.
            expect(screen.getByText('Back to Home')).toBeInTheDocument();
            expect(
                screen.queryByLabelText('Tap to continue')
            ).not.toBeInTheDocument();
            // Unmount to trigger onDestroy → removeVisibilityListener().
            view.unmount();
        } finally {
            Object.defineProperty(window, 'matchMedia', {
                value: original,
                writable: true,
                configurable: true,
            });
        }
    });

    it('returns early when setReaderMode is called with the current mode', async () => {
        stubMatchMedia(false);
        const defaultFactory = vi.fn(() => createRuntimeHarness().runtime);
        render(ReaderShell, { props: { createVisualRuntime: defaultFactory } });

        // Default mode is 'text'. Clicking Text again should be a no-op:
        // setReaderMode returns early (readerMode === mode).
        await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
        expect(
            screen.getByRole('group', { name: 'Reader mode' })
        ).toHaveAttribute('data-reader-mode', 'text');
        // The visual runtime factory must not have been called.
        expect(defaultFactory).not.toHaveBeenCalled();
    });
});
