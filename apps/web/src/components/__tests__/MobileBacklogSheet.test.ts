import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';

vi.mock('@aquila/stories', () => ({
    getTranslations: vi.fn(() => ({
        reader: { historyTitle: 'History', closeHistory: 'Close history' },
        locale: 'en',
    })),
}));

import MobileBacklogSheet from '@/components/MobileBacklogSheet.svelte';

const lines = [
    { characterName: 'Narrator', text: 'Line one.' },
    { characterName: '', text: 'Line two.' },
];

describe('MobileBacklogSheet', () => {
    const onClose = vi.fn();
    afterEach(() => vi.clearAllMocks());

    it('renders nothing when closed', () => {
        render(MobileBacklogSheet, {
            props: { lines, open: false, onClose, locale: 'en' },
        });
        expect(screen.queryByText('Line one.')).not.toBeInTheDocument();
    });

    it('renders all lines with names when open', () => {
        render(MobileBacklogSheet, {
            props: { lines, open: true, onClose, locale: 'en' },
        });
        expect(screen.getByText('Line one.')).toBeInTheDocument();
        expect(screen.getByText('Line two.')).toBeInTheDocument();
        expect(screen.getByText('Narrator')).toBeInTheDocument();
    });

    it('calls onClose from the close button', async () => {
        render(MobileBacklogSheet, {
            props: { lines, open: true, onClose, locale: 'en' },
        });
        const closeButtons = screen.getAllByLabelText('Close history');
        await fireEvent.click(closeButtons[0]);
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose on Escape when open', async () => {
        render(MobileBacklogSheet, {
            props: { lines, open: true, onClose, locale: 'en' },
        });
        await fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });
});
