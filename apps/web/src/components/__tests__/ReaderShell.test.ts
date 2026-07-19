// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry } from '@aquila/stories';

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => ({ start: 'a1', nodes: [] })),
    getTranslations: vi.fn((locale: string) => ({
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
        },
        characterNames: { narrator: 'Narrator' },
        common: { backToHome: 'Back to Home' },
        locale,
    })),
}));

import ReaderShell from '../ReaderShell.svelte';
import { readerState } from '@/lib/reader-state.svelte';

const mockDialogue: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First dialogue line.' },
    { characterId: 'narrator', dialogue: 'Second dialogue line.' },
    { characterId: 'narrator', dialogue: 'Third dialogue line.' },
];

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
        readerState.dialogue = mockDialogue;
        readerState.locale = 'en';
    });
    afterEach(() => vi.clearAllMocks());

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
});
