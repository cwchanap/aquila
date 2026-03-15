import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import SceneForm from '../ui/SceneForm.svelte';

describe('SceneForm', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('Rendering', () => {
        it('renders the title input field', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        });

        it('renders the content textarea', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
        });

        it('renders the default submit button label', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('button', { name: 'Create Scene' })
            ).toBeInTheDocument();
        });

        it('renders a custom submit label when provided', () => {
            render(SceneForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    submitLabel: 'Update Scene',
                },
            });

            expect(
                screen.getByRole('button', { name: 'Update Scene' })
            ).toBeInTheDocument();
        });

        it('renders the cancel button', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('button', { name: 'Cancel' })
            ).toBeInTheDocument();
        });

        it('renders with initial title value', () => {
            render(SceneForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    title: 'My Scene',
                },
            });

            const titleInput = screen.getByLabelText(
                /title/i
            ) as HTMLInputElement;
            expect(titleInput.value).toBe('My Scene');
        });

        it('renders with initial content value', () => {
            render(SceneForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    content: 'Once upon a time...',
                },
            });

            const contentTextarea = screen.getByLabelText(
                /content/i
            ) as HTMLTextAreaElement;
            expect(contentTextarea.value).toBe('Once upon a time...');
        });
    });

    describe('Form submission', () => {
        it('calls onSubmit when the form is submitted', async () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const form = document.querySelector('form')!;
            await fireEvent.submit(form);

            expect(mockOnSubmit).toHaveBeenCalledTimes(1);
        });

        it('submit button has type="submit"', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const submitBtn = screen.getByRole('button', {
                name: 'Create Scene',
            });
            expect(submitBtn).toHaveAttribute('type', 'submit');
        });

        it('does not call onCancel when form is submitted', async () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const form = document.querySelector('form')!;
            await fireEvent.submit(form);

            expect(mockOnCancel).not.toHaveBeenCalled();
        });
    });

    describe('Cancel action', () => {
        it('calls onCancel when cancel button is clicked', async () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('does not call onSubmit when cancel is clicked', async () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Title field', () => {
        it('title input is marked as required', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            expect(titleInput).toBeRequired();
        });

        it('title input has correct placeholder', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            expect(titleInput).toHaveAttribute(
                'placeholder',
                'Enter scene title'
            );
        });
    });

    describe('Content field', () => {
        it('content field is not required', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const contentTextarea = screen.getByLabelText(/content/i);
            expect(contentTextarea).not.toBeRequired();
        });

        it('content textarea has correct placeholder', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const contentTextarea = screen.getByLabelText(/content/i);
            expect(contentTextarea).toHaveAttribute(
                'placeholder',
                'Enter scene content (optional)'
            );
        });

        it('content textarea uses monospace font', () => {
            render(SceneForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const contentTextarea = screen.getByLabelText(/content/i);
            expect(contentTextarea).toHaveClass('font-mono');
        });
    });
});
