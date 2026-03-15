import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import ChapterForm from '../ui/ChapterForm.svelte';

describe('ChapterForm', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('Rendering', () => {
        it('renders the title input field', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        });

        it('renders the description textarea', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        });

        it('renders the default submit button label', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('button', { name: 'Create Chapter' })
            ).toBeInTheDocument();
        });

        it('renders a custom submit label when provided', () => {
            render(ChapterForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    submitLabel: 'Save Chapter',
                },
            });

            expect(
                screen.getByRole('button', { name: 'Save Chapter' })
            ).toBeInTheDocument();
        });

        it('renders the cancel button', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('button', { name: 'Cancel' })
            ).toBeInTheDocument();
        });

        it('renders with initial title value', () => {
            render(ChapterForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    title: 'My Chapter',
                },
            });

            const titleInput = screen.getByLabelText(
                /title/i
            ) as HTMLInputElement;
            expect(titleInput.value).toBe('My Chapter');
        });

        it('renders with initial description value', () => {
            render(ChapterForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    description: 'A great chapter',
                },
            });

            const descTextarea = screen.getByLabelText(
                /description/i
            ) as HTMLTextAreaElement;
            expect(descTextarea.value).toBe('A great chapter');
        });
    });

    describe('Form submission', () => {
        it('calls onSubmit when the form is submitted', async () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            await fireEvent.input(titleInput, {
                target: { value: 'My Chapter' },
            });

            const form = document.querySelector('form')!;
            await fireEvent.submit(form);

            expect(mockOnSubmit).toHaveBeenCalledTimes(1);
        });

        it('submit button has type="submit"', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const submitBtn = screen.getByRole('button', {
                name: 'Create Chapter',
            });
            expect(submitBtn).toHaveAttribute('type', 'submit');
        });

        it('does not call onCancel when form is submitted', async () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const form = document.querySelector('form')!;
            await fireEvent.submit(form);

            expect(mockOnCancel).not.toHaveBeenCalled();
        });
    });

    describe('Cancel action', () => {
        it('calls onCancel when cancel button is clicked', async () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('does not call onSubmit when cancel is clicked', async () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Title field', () => {
        it('title input is marked as required', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            expect(titleInput).toBeRequired();
        });

        it('title input has correct placeholder', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            expect(titleInput).toHaveAttribute(
                'placeholder',
                'Enter chapter title'
            );
        });
    });

    describe('Description field', () => {
        it('description field is not required', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const descTextarea = screen.getByLabelText(/description/i);
            expect(descTextarea).not.toBeRequired();
        });

        it('description textarea has correct placeholder', () => {
            render(ChapterForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const descTextarea = screen.getByLabelText(/description/i);
            expect(descTextarea).toHaveAttribute(
                'placeholder',
                'Enter chapter description (optional)'
            );
        });
    });
});
