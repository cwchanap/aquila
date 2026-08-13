// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import ReaderSettingsMenu from '../ReaderSettingsMenu.svelte';

function renderSettings(
    overrides: Record<string, unknown> = {}
): ReturnType<typeof render> {
    return render(ReaderSettingsMenu, {
        props: {
            open: true,
            locale: 'en',
            mode: 'visual',
            onModeChange: vi.fn(),
            onBookmark: vi.fn(),
            showBookmarkButton: true,
            backUrl: '/en/',
            bookmarkDisabled: false,
            triggerUnavailable: false,
            sfxEnabled: true,
            onSfxEnabledChange: vi.fn(),
            bgmEnabled: true,
            onBgmEnabledChange: vi.fn(),
            ...overrides,
        },
    });
}

afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
});

describe('ReaderSettingsMenu', () => {
    it('opens an accessible dialog and focuses the first mode action', () => {
        renderSettings();

        expect(
            screen.getByRole('dialog', { name: 'Reader settings' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Close reader settings' })
        ).toHaveFocus();
    });

    it.each([
        ['Escape', async () => fireEvent.keyDown(window, { key: 'Escape' })],
        [
            'scrim',
            async () =>
                fireEvent.click(screen.getByTestId('reader-settings-scrim')),
        ],
    ])('closes through %s', async (_label, close) => {
        renderSettings();

        await close();

        expect(
            screen.queryByRole('dialog', { name: 'Reader settings' })
        ).not.toBeInTheDocument();
    });

    it('closes through the close action', async () => {
        renderSettings();

        await fireEvent.click(
            screen.getByRole('button', { name: 'Close reader settings' })
        );

        expect(
            screen.queryByRole('dialog', { name: 'Reader settings' })
        ).not.toBeInTheDocument();
    });

    it('deactivates the trap before opening the bookmark prompt', async () => {
        const onBookmark = vi.fn(() => {
            const input = document.createElement('input');
            input.setAttribute('aria-label', 'Bookmark name');
            document.body.append(input);
            input.focus();
        });
        renderSettings({ onBookmark });

        await fireEvent.click(
            screen.getByRole('button', { name: '📖 Bookmark' })
        );

        expect(onBookmark).toHaveBeenCalledOnce();
        expect(screen.getByLabelText('Bookmark name')).toHaveFocus();
        expect(
            screen.queryByRole('dialog', { name: 'Reader settings' })
        ).not.toBeInTheDocument();
    });

    it('exposes mode state, optional bookmark, home, and unavailable trigger behavior', async () => {
        const onModeChange = vi.fn();
        const view = renderSettings({ onModeChange });

        expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        expect(
            screen.getByRole('button', { name: 'Visual Novel' })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            screen.getByRole('link', { name: '← Back to Home' })
        ).toHaveAttribute('href', '/en/');

        await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
        expect(onModeChange).toHaveBeenCalledWith('text');

        view.unmount();
        const withoutBookmark = renderSettings({ showBookmarkButton: false });
        expect(
            screen.queryByRole('button', { name: '📖 Bookmark' })
        ).not.toBeInTheDocument();
        withoutBookmark.unmount();

        const disabledBookmark = renderSettings({ bookmarkDisabled: true });
        expect(
            screen.getByRole('button', { name: '📖 Bookmark' })
        ).toBeDisabled();
        const trigger = screen.getByRole('button', {
            name: 'Open reader settings',
        });
        expect(trigger).toBeEnabled();
        disabledBookmark.unmount();

        const unavailable = renderSettings({ triggerUnavailable: true });
        expect(
            screen.getByRole('button', { name: 'Open reader settings' })
        ).toHaveAttribute('tabindex', '-1');
        expect(
            screen.getByRole('button', { name: 'Open reader settings' })
        ).toBeDisabled();
        unavailable.unmount();
    });

    it('shows and toggles Sound Effects only in Visual mode', async () => {
        const onSfxEnabledChange = vi.fn();
        const view = renderSettings({ onSfxEnabledChange, mode: 'visual' });

        const toggle = screen.getByRole('button', { name: /Sound effects/i });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await fireEvent.click(toggle);
        expect(onSfxEnabledChange).toHaveBeenCalledWith(false);

        view.unmount();
        renderSettings({ mode: 'text' });
        expect(
            screen.queryByRole('button', { name: /Sound effects/i })
        ).not.toBeInTheDocument();
    });

    it('shows and toggles Background Music independently in Visual mode', async () => {
        const onBgmEnabledChange = vi.fn();
        const onSfxEnabledChange = vi.fn();
        const view = renderSettings({
            mode: 'visual',
            onBgmEnabledChange,
            onSfxEnabledChange,
        });

        const toggle = screen.getByRole('button', {
            name: /background music/i,
        });
        expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await fireEvent.click(toggle);
        expect(onBgmEnabledChange).toHaveBeenCalledWith(false);
        expect(onSfxEnabledChange).not.toHaveBeenCalled();

        view.unmount();
        renderSettings({ mode: 'text' });
        expect(
            screen.queryByRole('button', { name: /background music/i })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /sound effects/i })
        ).not.toBeInTheDocument();
    });
});
