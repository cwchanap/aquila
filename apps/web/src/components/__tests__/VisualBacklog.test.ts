import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { DialogueEntry } from '@aquila/stories';

vi.mock('@aquila/stories/translations', () => ({
    getTranslations: vi.fn(() => ({
        reader: {
            historyTitle: 'History',
            closeHistory: 'Close history',
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

const threeLines: DialogueEntry[] = [
    { characterId: 'narrator', dialogue: 'First' },
    { character: 'Guide', dialogue: 'Second' },
    { dialogue: 'Third' },
];

describe('VisualBacklog', () => {
    afterEach(() => {
        document.body.replaceChildren();
        vi.clearAllMocks();
    });

    it('shows current-scene dialogue through the active line', () => {
        render(VisualBacklog, {
            props: {
                dialogue: threeLines,
                dialogueIndex: 1,
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

    it('moves focus inside on open and returns focus to the trigger on close', async () => {
        const trigger = document.createElement('button');
        document.body.append(trigger);
        const onClose = vi.fn();

        render(VisualBacklog, {
            props: {
                dialogue: threeLines,
                dialogueIndex: 0,
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
                dialogue: threeLines,
                dialogueIndex: 0,
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
});
