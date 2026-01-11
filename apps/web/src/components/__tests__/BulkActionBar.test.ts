import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import BulkActionBar from '../BulkActionBar.svelte';
import type { Locale } from '@aquila/dialogue';

describe('BulkActionBar', () => {
    const mockOnCancel = vi.fn();
    const mockOnAction = vi.fn();
    const defaultLocale: Locale = 'en';

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Clear any document event listeners between tests
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
        vi.useRealTimers();
    });

    describe('Basic Rendering', () => {
        it('should render when visible with selected items', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1', 'item-2'],
                    onCancel: mockOnCancel,
                    onAction: mockOnAction,
                    locale: defaultLocale,
                },
            });

            expect(screen.getByText('2 items selected')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Delete' })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Archive' })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Cancel' })
            ).toBeInTheDocument();
        });

        it('should not render when isVisible is false', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: false,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(
                screen.queryByText('1 item selected')
            ).not.toBeInTheDocument();
            expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
        });

        it('should not render when selectedIds is empty', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: [],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(
                screen.queryByText('0 items selected')
            ).not.toBeInTheDocument();
            expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
        });

        it('should render singular "item" for single selection', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(screen.getByText('1 item selected')).toBeInTheDocument();
        });
    });

    describe('Outside Click Handling', () => {
        it('should call onCancel when clicking outside the component', async () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            // Advance timers to allow the outside click listener to be attached
            await vi.advanceTimersByTimeAsync(0);

            // Click outside the component
            const outsideElement = document.createElement('div');
            document.body.appendChild(outsideElement);
            await fireEvent.click(outsideElement);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('should not call onCancel when clicking inside the component', async () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            // Advance timers to allow the outside click listener to be attached
            await vi.advanceTimersByTimeAsync(0);

            // Click on the component itself
            const toolbar = screen.getByRole('toolbar');
            await fireEvent.click(toolbar);

            expect(mockOnCancel).not.toHaveBeenCalled();
        });

        it('should not attach listener when not visible', async () => {
            render(BulkActionBar, {
                props: {
                    isVisible: false,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            // Advance timers
            await vi.advanceTimersByTimeAsync(0);

            // Click outside - should not trigger onCancel since no listener should be attached
            const outsideElement = document.createElement('div');
            document.body.appendChild(outsideElement);
            await fireEvent.click(outsideElement);

            expect(mockOnCancel).not.toHaveBeenCalled();
        });
    });

    describe('Reactive Behavior', () => {
        it('should render when component becomes visible after initial mount', async () => {
            const { rerender } = render(BulkActionBar, {
                props: {
                    isVisible: false,
                    selectedIds: [],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

            // Make visible with selections
            await rerender({
                isVisible: true,
                selectedIds: ['item-1', 'item-2'],
                onCancel: mockOnCancel,
                locale: defaultLocale,
            });

            expect(screen.getByText('2 items selected')).toBeInTheDocument();
        });

        it('should attach listener when becoming visible with selections', async () => {
            const { rerender } = render(BulkActionBar, {
                props: {
                    isVisible: false,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            await vi.advanceTimersByTimeAsync(0);

            // Make visible
            await rerender({
                isVisible: true,
                selectedIds: ['item-1'],
                onCancel: mockOnCancel,
                locale: defaultLocale,
            });

            await vi.advanceTimersByTimeAsync(0);

            // Click outside should now trigger onCancel
            const outsideElement = document.createElement('div');
            document.body.appendChild(outsideElement);
            await fireEvent.click(outsideElement);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('should update selection count when selectedIds changes', async () => {
            const { rerender } = render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(screen.getByText('1 item selected')).toBeInTheDocument();

            // Add more selections
            await rerender({
                isVisible: true,
                selectedIds: ['item-1', 'item-2', 'item-3'],
                onCancel: mockOnCancel,
                locale: defaultLocale,
            });

            expect(screen.getByText('3 items selected')).toBeInTheDocument();
        });

        it('should hide when all selections are cleared', async () => {
            const { rerender } = render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1', 'item-2'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(screen.getByRole('toolbar')).toBeInTheDocument();

            // Clear selections
            await rerender({
                isVisible: true,
                selectedIds: [],
                onCancel: mockOnCancel,
                locale: defaultLocale,
            });

            expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
        });
    });

    describe('Action Callbacks', () => {
        it('should call onAction with "delete" when delete button is clicked', async () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    onAction: mockOnAction,
                    locale: defaultLocale,
                },
            });

            const deleteBtn = screen.getByRole('button', { name: 'Delete' });
            await fireEvent.click(deleteBtn);

            expect(mockOnAction).toHaveBeenCalledWith('delete');
            expect(mockOnCancel).not.toHaveBeenCalled();
        });

        it('should call onAction with "archive" when archive button is clicked', async () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    onAction: mockOnAction,
                    locale: defaultLocale,
                },
            });

            const archiveBtn = screen.getByRole('button', { name: 'Archive' });
            await fireEvent.click(archiveBtn);

            expect(mockOnAction).toHaveBeenCalledWith('archive');
            expect(mockOnCancel).not.toHaveBeenCalled();
        });

        it('should call onCancel when cancel button is clicked', async () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    onAction: mockOnAction,
                    locale: defaultLocale,
                },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
            expect(mockOnAction).not.toHaveBeenCalled();
        });

        it('should not show action buttons when onAction is not provided', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    onAction: undefined,
                    locale: defaultLocale,
                },
            });

            expect(
                screen.queryByRole('button', { name: 'Delete' })
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: 'Archive' })
            ).not.toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'Cancel' })
            ).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have role toolbar', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(screen.getByRole('toolbar')).toBeInTheDocument();
        });

        it('should have aria-label', () => {
            render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            expect(screen.getByRole('toolbar')).toHaveAttribute(
                'aria-label',
                'Bulk Actions'
            );
        });
    });

    describe('Listener Cleanup', () => {
        it('should not have duplicate listeners when visibility toggles', async () => {
            const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
            const removeEventListenerSpy = vi.spyOn(
                document,
                'removeEventListener'
            );

            const { rerender } = render(BulkActionBar, {
                props: {
                    isVisible: true,
                    selectedIds: ['item-1'],
                    onCancel: mockOnCancel,
                    locale: defaultLocale,
                },
            });

            await vi.advanceTimersByTimeAsync(0);
            addEventListenerSpy.mockClear();

            // Hide the component
            await rerender({
                isVisible: false,
                selectedIds: ['item-1'],
                onCancel: mockOnCancel,
                locale: defaultLocale,
            });

            // Show again
            await rerender({
                isVisible: true,
                selectedIds: ['item-1'],
                onCancel: mockOnCancel,
                locale: defaultLocale,
            });

            await vi.advanceTimersByTimeAsync(0);

            // Verify remove was called when hiding
            expect(removeEventListenerSpy).toHaveBeenCalled();

            // Verify add was called when showing again
            expect(addEventListenerSpy).toHaveBeenCalled();

            // Restore spies to prevent cross-test leakage
            addEventListenerSpy.mockRestore();
            removeEventListenerSpy.mockRestore();
        });
    });
});
