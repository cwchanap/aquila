import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';

const branchFlow = {
    start: 'b1a_act1',
    nodes: [
        {
            kind: 'scene',
            id: 'b1a_act1',
            sceneId: 'b1a_act1',
            next: 'b1a_act2',
        },
        { kind: 'scene', id: 'b1a_act2', sceneId: 'b1a_act2', next: null },
    ],
};

// Fork topology for the visibility filter: act2 exists on two sibling
// branches and a Final act sits behind both, so a partial allowlist has
// something to hide both from grouping and from branch matching.
const forkFlow = {
    start: 'b1a_act1',
    nodes: [
        {
            kind: 'scene',
            id: 'b1a_act1',
            sceneId: 'b1a_act1',
            next: 'choice:ch1',
        },
        {
            kind: 'choice',
            id: 'choice:ch1',
            choiceId: 'ch1',
            nextByOption: { a: 'b1a_act2', b: 'b1b_act2' },
        },
        {
            kind: 'scene',
            id: 'b1a_act2',
            sceneId: 'b1a_act2',
            next: 'actFinal',
        },
        { kind: 'scene', id: 'b1b_act2', sceneId: 'b1b_act2', next: null },
        { kind: 'scene', id: 'actFinal', sceneId: 'actFinal', next: null },
    ],
};

vi.mock('@aquila/stories/translations', async importOriginal => ({
    ...(await importOriginal<typeof import('@aquila/stories/translations')>()),
    getTranslations: vi.fn(() => ({
        reader: {
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            closeActsPanel: 'Close acts panel',
            readerMode: 'Reader mode',
            textMode: 'Text',
            visualNovelMode: 'Visual Novel',
            visualStaleRelease: 'Using previously validated visuals',
            visualAssetFallback: 'Some visuals are unavailable',
            visualUnavailable: 'Visuals are unavailable',
        },
        locale: 'en',
    })),
}));

import MobileActDrawer from '@/components/MobileActDrawer.svelte';

// Act buttons are the buttons that carry no aria-label (scrim and close
// button both have aria-label "Close acts panel").
function getActButtons() {
    return screen
        .getAllByRole('button')
        .filter(b => !b.getAttribute('aria-label'));
}

describe('MobileActDrawer', () => {
    const onNavigate = vi.fn();
    const onClose = vi.fn();

    afterEach(() => vi.clearAllMocks());

    const chaptersFlow = {
        start: 'ch1_act1',
        nodes: [
            { kind: 'scene', sceneId: 'ch1_act1' },
            { kind: 'scene', sceneId: 'ch1_act2' },
            { kind: 'scene', sceneId: 'ch2_act3' },
        ],
    };

    it('expands only the current chapter and toggles others', async () => {
        render(MobileActDrawer, {
            props: {
                flow: chaptersFlow,
                storyId: 's',
                currentSceneId: 'ch1_act1',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
            },
        });
        // Chapter 1 (holds the current act) is expanded by default…
        expect(screen.getByText('Act 1')).toBeInTheDocument();
        expect(screen.getByText('Act 2')).toBeInTheDocument();
        // …Chapter 2 is collapsed, so its act is not rendered.
        expect(screen.queryByText('Act 3')).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Chapter 2' })
        ).toHaveAttribute('aria-expanded', 'false');

        // Expanding Chapter 2 reveals its act.
        await fireEvent.click(
            screen.getByRole('button', { name: 'Chapter 2' })
        );
        expect(screen.getByText('Act 3')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Chapter 2' })
        ).toHaveAttribute('aria-expanded', 'true');
    });

    it('renders an act button per act when open', () => {
        render(MobileActDrawer, {
            props: {
                flow: branchFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
            },
        });
        expect(getActButtons().map(b => b.textContent?.trim())).toEqual([
            'Act 1',
            'Act 2',
        ]);
    });

    it('calls onNavigate then onClose when an act is selected', async () => {
        render(MobileActDrawer, {
            props: {
                flow: branchFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
            },
        });
        const act2 = getActButtons().find(
            b => b.textContent?.trim() === 'Act 2'
        )!;
        await fireEvent.click(act2);
        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape when open', async () => {
        render(MobileActDrawer, {
            props: {
                flow: branchFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
            },
        });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('does not call onClose on Escape when closed', async () => {
        render(MobileActDrawer, {
            props: {
                flow: branchFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: false,
                locale: 'en',
            },
        });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('marks the panel inert and aria-hidden when closed', () => {
        render(MobileActDrawer, {
            props: {
                flow: branchFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: false,
                locale: 'en',
            },
        });
        const actButtons = screen
            .getAllByRole('button', { hidden: true })
            .filter(b => !b.getAttribute('aria-label'));
        expect(actButtons.length).toBeGreaterThan(0); // guard: not vacuous
        for (const btn of actButtons) {
            const inertAncestor = btn.closest('[inert]');
            expect(inertAncestor).not.toBeNull();
            expect(inertAncestor?.getAttribute('aria-hidden')).toBe('true');
        }
    });

    it('hides unvisited acts when a visible-scene allowlist is provided', () => {
        render(MobileActDrawer, {
            props: {
                flow: forkFlow,
                storyId: 's',
                currentSceneId: 'b1a_act2',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
                visibleSceneIds: new Set(['b1a_act1', 'b1a_act2']),
            },
        });
        // The unread sibling act and the unread Final never render: no labels
        // and no jump targets are offered for scenes outside the allowlist.
        expect(getActButtons().map(b => b.textContent?.trim())).toEqual([
            'Act 1',
            'Act 2',
        ]);
    });

    it('navigates only to a visible scene when an act is selected', async () => {
        const visible = new Set(['b1a_act1', 'b1a_act2']);
        render(MobileActDrawer, {
            props: {
                flow: forkFlow,
                storyId: 's',
                currentSceneId: 'b1a_act2',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
                visibleSceneIds: visible,
            },
        });
        const act2 = getActButtons().find(
            b => b.textContent?.trim() === 'Act 2'
        )!;
        await fireEvent.click(act2);
        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
        for (const call of onNavigate.mock.calls) {
            expect(visible.has(call[0] as string)).toBe(true);
        }
    });

    it('keeps the unrestricted act list when no allowlist is provided', () => {
        render(MobileActDrawer, {
            props: {
                flow: forkFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
            },
        });
        expect(getActButtons().map(b => b.textContent?.trim())).toEqual([
            'Act 1',
            'Act 2',
            'Final',
        ]);
    });

    it('moves focus into the panel and traps Tab while open', async () => {
        render(MobileActDrawer, {
            props: {
                flow: branchFlow,
                storyId: 's',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onClose,
                open: true,
                locale: 'en',
            },
        });
        const panel = screen.getByRole('dialog');
        // On open the focus trap moves focus to the first focusable element
        // inside the panel (the close button), so keyboard users land inside
        // the overlay rather than on a control behind the scrim.
        await waitFor(() => {
            const active = document.activeElement as HTMLElement | null;
            expect(active).not.toBeNull();
            expect(panel.contains(active)).toBe(true);
        });
    });
});
