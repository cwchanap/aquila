import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
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

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => branchFlow),
    getTranslations: vi.fn(() => ({
        reader: {
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            closeActsPanel: 'Close acts panel',
        },
        locale: 'en',
    })),
}));

import MobileActDrawer from '../MobileActDrawer.svelte';

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

    it('renders an act button per act when open', () => {
        render(MobileActDrawer, {
            props: {
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
});
