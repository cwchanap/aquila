import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';

const mockFlow = {
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
            next: 'b1a_act3',
        },
        {
            kind: 'scene',
            id: 'b1a_act3',
            sceneId: 'b1a_act3',
            next: 'choice:ch1',
        },
        {
            kind: 'choice',
            id: 'choice:ch1',
            choiceId: 'ch1',
            nextByOption: { a: 'b1a_b2a_act4', b: 'b1a_b2b_act4' },
        },
        {
            kind: 'scene',
            id: 'b1a_b2a_act4',
            sceneId: 'b1a_b2a_act4',
            next: 'actFinal',
        },
        {
            kind: 'scene',
            id: 'b1a_b2b_act4',
            sceneId: 'b1a_b2b_act4',
            next: 'actFinal',
        },
        {
            kind: 'scene',
            id: 'actFinal',
            sceneId: 'actFinal',
            next: 'actEpilogue',
        },
        {
            kind: 'scene',
            id: 'actEpilogue',
            sceneId: 'actEpilogue',
            next: null,
        },
    ],
};

vi.mock('@aquila/stories', () => ({
    getStoryFlow: vi.fn(() => mockFlow),
    getTranslations: vi.fn(() => ({
        reader: {
            actPanel: 'Acts',
            actLabel: 'Act {n}',
            actFinal: 'Final Act',
            actEpilogue: 'Epilogue',
            chapterLabel: 'Chapter {n}',
            openActsPanel: 'Open acts panel',
            closeActsPanel: 'Close acts panel',
        },
        locale: 'en',
    })),
}));

import ActPanel from '../ActPanel.svelte';

function getActButtons() {
    // Exclude the toggle tab button; only return act navigation buttons
    return screen
        .getAllByRole('button')
        .filter(
            b =>
                !b.getAttribute('aria-label')?.includes('acts panel') &&
                !b.getAttribute('aria-label')?.includes('panel')
        );
}

describe('ActPanel', () => {
    const onNavigate = vi.fn();
    const onToggle = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders act buttons for all acts in the flow', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const buttons = getActButtons();
        expect(buttons.length).toBe(6);
        expect(buttons.map(b => b.textContent)).toEqual([
            'Act 1',
            'Act 2',
            'Act 3',
            'Act 4',
            'Final Act',
            'Epilogue',
        ]);
    });

    it('filters out acts from divergent branches', async () => {
        // When on b1a_b2b branch which terminates at act4,
        // acts that only exist on the sibling b1a_b2a branch should not appear.
        const { getStoryFlow } = await import('@aquila/stories');
        const divergentFlow = {
            start: 'act1',
            nodes: [
                {
                    kind: 'scene',
                    id: 'act1',
                    sceneId: 'act1',
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
                    next: 'b1a_act3',
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
                    next: null,
                },
                {
                    kind: 'scene',
                    id: 'b1b_act2',
                    sceneId: 'b1b_act2',
                    next: null,
                },
            ],
        };
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            divergentFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1b_act2',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        // On b1b branch: act1 (shared root) + act2 (b1b_act2) should show.
        // act3 and act4 only exist on b1a branch and should be filtered out.
        const buttons = getActButtons();
        expect(buttons.map(b => b.textContent)).toEqual(['Act 1', 'Act 2']);
    });

    it('highlights the current act button', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act2',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const activeButton = screen
            .getAllByRole('button')
            .find(b => b.textContent === 'Act 2');
        expect(activeButton).toHaveClass('bg-blue-500');
    });

    it('calls onNavigate when an act button is clicked', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const act2Button = screen
            .getAllByRole('button')
            .find(b => b.textContent === 'Act 2');
        expect(act2Button).toBeDefined();
        await fireEvent.click(act2Button!);

        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
    });

    it('calls onToggle when Escape is pressed while open', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        await fireEvent.keyDown(window, { key: 'Escape' });

        expect(onToggle).toHaveBeenCalled();
    });

    it('does not call onToggle when Escape is pressed while closed', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: false,
                locale: 'en',
            },
        });

        await fireEvent.keyDown(window, { key: 'Escape' });

        expect(onToggle).not.toHaveBeenCalled();
    });

    it('renders epilogue label for actEpilogue', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'actEpilogue',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        expect(screen.getByText('Epilogue')).toBeInTheDocument();
    });

    it('sorts acts by numeric order with Final and Epilogue last', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const labels = getActButtons().map(b => b.textContent);
        const act1Idx = labels.indexOf('Act 1');
        const act2Idx = labels.indexOf('Act 2');
        const act3Idx = labels.indexOf('Act 3');
        const act4Idx = labels.indexOf('Act 4');
        const finalIdx = labels.indexOf('Final Act');

        expect(act1Idx).toBeLessThan(act2Idx);
        expect(act2Idx).toBeLessThan(act3Idx);
        expect(act3Idx).toBeLessThan(act4Idx);
        expect(act4Idx).toBeLessThan(finalIdx);
    });

    it('does not call onNavigate on non-Escape key press', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        await fireEvent.keyDown(window, { key: 'Enter' });

        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('renders only toggle tab when story has no flow', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            undefined
        );

        render(ActPanel, {
            props: {
                storyId: 'unknown',
                currentSceneId: 'act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        // Toggle tab is always rendered; no act buttons when flow is missing
        const actButtons = getActButtons();
        expect(actButtons.length).toBe(0);
        // Toggle tab should still be present
        expect(
            screen.getByRole('button', { name: /acts panel/i })
        ).toBeInTheDocument();
    });

    it('uses translated aria-label for toggle button when open', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        expect(
            screen.getByRole('button', { name: 'Close acts panel' })
        ).toBeInTheDocument();
    });

    it('uses translated aria-label for toggle button when closed', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: false,
                locale: 'en',
            },
        });

        expect(
            screen.getByRole('button', { name: 'Open acts panel' })
        ).toBeInTheDocument();
    });

    it('marks panel content inert and aria-hidden when closed', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                onToggle,
                open: false,
                locale: 'en',
            },
        });

        // All act buttons should be hidden from accessibility tree when closed
        const actButtons = getActButtons();
        for (const btn of actButtons) {
            // Buttons inside an [inert] container are not focusable and not exposed
            // to accessibility APIs.
            const inertAncestor = btn.closest('[inert]');
            expect(inertAncestor).not.toBeNull();
            expect(inertAncestor?.getAttribute('aria-hidden')).toBe('true');
        }
    });

    it('navigates to branch-matching act when on b1a_b2a branch', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_b2a_act4',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        // Act 4 button should navigate to b1a_b2a_act4 (matching branch)
        const act4Button = screen
            .getAllByRole('button')
            .find(b => b.textContent === 'Act 4');
        expect(act4Button).toBeDefined();
        await fireEvent.click(act4Button!);
        expect(onNavigate).toHaveBeenCalledWith('b1a_b2a_act4');
    });

    it('navigates to branch-matching act when on b1a_b2b branch', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_b2b_act4',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        // Act 4 button should navigate to b1a_b2b_act4 (matching branch)
        const act4Button = screen
            .getAllByRole('button')
            .find(b => b.textContent === 'Act 4');
        expect(act4Button).toBeDefined();
        await fireEvent.click(act4Button!);
        expect(onNavigate).toHaveBeenCalledWith('b1a_b2b_act4');
    });

    it('navigates to shared root acts regardless of current branch', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_b2b_act4',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        // Act 1,2,3 are on the shared root — clicking them should work correctly
        const act1Button = screen
            .getAllByRole('button')
            .find(b => b.textContent === 'Act 1');
        expect(act1Button).toBeDefined();
        await fireEvent.click(act1Button!);
        expect(onNavigate).toHaveBeenCalledWith('b1a_act1');
    });
});

describe('ActPanel — chapter mode', () => {
    const onNavigate = vi.fn();
    const onToggle = vi.fn();

    const chapterFlow = {
        start: 'ch1_act1',
        nodes: [
            {
                kind: 'scene',
                id: 'ch1_act1',
                sceneId: 'ch1_act1',
                next: 'ch1_act2',
            },
            {
                kind: 'scene',
                id: 'ch1_act2',
                sceneId: 'ch1_act2',
                next: 'ch2_act1',
            },
            {
                kind: 'scene',
                id: 'ch2_act1',
                sceneId: 'ch2_act1',
                next: 'ch2_act2',
            },
            {
                kind: 'scene',
                id: 'ch2_act2',
                sceneId: 'ch2_act2',
                next: 'ch3_act1',
            },
            { kind: 'scene', id: 'ch3_act1', sceneId: 'ch3_act1', next: null },
        ],
    };

    function findChapterButton(name: string): HTMLElement | undefined {
        return screen
            .getAllByRole('button')
            .find(
                b =>
                    b.textContent?.includes(name) &&
                    !b.getAttribute('aria-label')
            );
    }

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders chapter headers with only current chapter expanded', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch2_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        expect(screen.getByText('Chapter 1')).toBeInTheDocument();
        expect(screen.getByText('Chapter 2')).toBeInTheDocument();
        expect(screen.getByText('Chapter 3')).toBeInTheDocument();

        const ch2Header = findChapterButton('Chapter 2')!;
        const ch2Section = ch2Header.parentElement!;
        const ch2Acts = ch2Section.querySelectorAll(':scope .ml-3 button');
        expect(ch2Acts.length).toBe(2);

        const ch1Header = findChapterButton('Chapter 1')!;
        const ch1Section = ch1Header.parentElement!;
        const ch1Acts = ch1Section.querySelectorAll(':scope .ml-3 button');
        expect(ch1Acts.length).toBe(0);

        const ch3Header = findChapterButton('Chapter 3')!;
        const ch3Section = ch3Header.parentElement!;
        const ch3Acts = ch3Section.querySelectorAll(':scope .ml-3 button');
        expect(ch3Acts.length).toBe(0);
    });

    it('highlights the current chapter header', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch2_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const ch2Button = findChapterButton('Chapter 2')!;
        expect(ch2Button).toHaveClass('bg-slate-800');

        const ch1Button = findChapterButton('Chapter 1')!;
        expect(ch1Button).toHaveClass('bg-slate-100');
    });

    it('highlights the current act within the expanded chapter', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch2_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const ch2Header = findChapterButton('Chapter 2')!;
        const ch2Section = ch2Header.parentElement!;
        const ch2ActButtons = ch2Section.querySelectorAll(
            ':scope .ml-3 button'
        );
        expect(ch2ActButtons[0]).toHaveClass('bg-blue-500');
    });

    it('expands chapter on click without navigating', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch1_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const ch3Button = findChapterButton('Chapter 3');
        expect(ch3Button).toBeDefined();
        await fireEvent.click(ch3Button!);

        const ch3Header = findChapterButton('Chapter 3')!;
        const ch3Section = ch3Header.parentElement!;
        const ch3Acts = ch3Section.querySelectorAll(':scope .ml-3 button');
        expect(ch3Acts.length).toBe(1);

        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('shows all chapter headers regardless of current position', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch1_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        expect(screen.getByText('Chapter 1')).toBeInTheDocument();
        expect(screen.getByText('Chapter 2')).toBeInTheDocument();
        expect(screen.getByText('Chapter 3')).toBeInTheDocument();
    });

    it('chapter buttons have aria-expanded reflecting expansion state', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch2_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        // ch2 is the current chapter, so it starts expanded
        const ch2Button = findChapterButton('Chapter 2')!;
        expect(ch2Button).toHaveAttribute('aria-expanded', 'true');

        const ch1Button = findChapterButton('Chapter 1')!;
        expect(ch1Button).toHaveAttribute('aria-expanded', 'false');

        const ch3Button = findChapterButton('Chapter 3')!;
        expect(ch3Button).toHaveAttribute('aria-expanded', 'false');
    });

    it('chapter buttons have aria-controls pointing to their acts container', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            chapterFlow
        );

        render(ActPanel, {
            props: {
                storyId: 'chapter_story',
                currentSceneId: 'ch2_act1',
                onNavigate,
                onToggle,
                open: true,
                locale: 'en',
            },
        });

        const ch2Button = findChapterButton('Chapter 2')!;
        expect(ch2Button).toHaveAttribute('aria-controls', 'chapter-2-acts');

        // Verify the controlled element exists and has the matching id
        const actsContainer = document.getElementById('chapter-2-acts');
        expect(actsContainer).not.toBeNull();
    });
});
