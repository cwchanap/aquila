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
        },
        locale: 'en',
    })),
}));

import ActPanel from '../ActPanel.svelte';

describe('ActPanel', () => {
    const onNavigate = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders act buttons for all acts in the flow', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                locale: 'en',
            },
        });

        const buttons = screen.getAllByRole('button');
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

    it('highlights the current act button', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act2',
                onNavigate,
                locale: 'en',
            },
        });

        const buttons = screen.getAllByRole('button');
        const activeButton = buttons.find(b => b.textContent === 'Act 2');
        expect(activeButton).toHaveClass('bg-blue-500');
    });

    it('calls onNavigate when an act button is clicked', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                locale: 'en',
            },
        });

        const buttons = screen.getAllByRole('button');
        await fireEvent.click(buttons[1]);

        expect(onNavigate).toHaveBeenCalledWith('b1a_act2');
    });

    it('calls onNavigate with currentSceneId when backdrop is clicked', async () => {
        const { container } = render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                locale: 'en',
            },
        });

        const backdrop = container.firstElementChild as HTMLElement;
        await fireEvent.click(backdrop);

        expect(onNavigate).toHaveBeenCalledWith('b1a_act1');
    });

    it('renders epilogue label for actEpilogue', () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'actEpilogue',
                onNavigate,
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
                locale: 'en',
            },
        });

        const buttons = screen.getAllByRole('button');
        const labels = buttons.map(b => b.textContent);
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

    it('calls onNavigate with currentSceneId when Escape is pressed', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                locale: 'en',
            },
        });

        await fireEvent.keyDown(window, { key: 'Escape' });

        expect(onNavigate).toHaveBeenCalledWith('b1a_act1');
    });

    it('does not call onNavigate on non-Escape key press', async () => {
        render(ActPanel, {
            props: {
                storyId: 'test_story',
                currentSceneId: 'b1a_act1',
                onNavigate,
                locale: 'en',
            },
        });

        await fireEvent.keyDown(window, { key: 'Enter' });

        expect(onNavigate).not.toHaveBeenCalled();
    });

    it('renders empty panel when story has no flow', async () => {
        const { getStoryFlow } = await import('@aquila/stories');
        (getStoryFlow as ReturnType<typeof vi.fn>).mockReturnValueOnce(
            undefined
        );

        render(ActPanel, {
            props: {
                storyId: 'unknown',
                currentSceneId: 'act1',
                onNavigate,
                locale: 'en',
            },
        });

        const buttons = screen.queryAllByRole('button');
        expect(buttons.length).toBe(0);
    });
});
