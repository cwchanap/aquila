import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import StoryForm from '../ui/StoryForm.svelte';

describe('StoryForm', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    afterEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    describe('Rendering', () => {
        it('renders the title input field', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
        });

        it('renders the description textarea', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
        });

        it('renders the status select', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
        });

        it('renders the default submit button label', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('button', { name: 'Create Story' })
            ).toBeInTheDocument();
        });

        it('renders a custom submit label when provided', () => {
            render(StoryForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    submitLabel: 'Update Story',
                },
            });

            expect(
                screen.getByRole('button', { name: 'Update Story' })
            ).toBeInTheDocument();
        });

        it('renders the cancel button', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('button', { name: 'Cancel' })
            ).toBeInTheDocument();
        });

        it('renders with initial title value', () => {
            render(StoryForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    title: 'My Story',
                },
            });

            const titleInput = screen.getByLabelText(
                /title/i
            ) as HTMLInputElement;
            expect(titleInput.value).toBe('My Story');
        });

        it('renders with initial description value', () => {
            render(StoryForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    description: 'An epic tale.',
                },
            });

            const descTextarea = screen.getByLabelText(
                /description/i
            ) as HTMLTextAreaElement;
            expect(descTextarea.value).toBe('An epic tale.');
        });
    });

    describe('Status dropdown', () => {
        it('defaults to draft status', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const statusSelect = screen.getByLabelText(
                /status/i
            ) as HTMLSelectElement;
            expect(statusSelect.value).toBe('draft');
        });

        it('renders draft option', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('option', { name: 'Draft' })
            ).toBeInTheDocument();
        });

        it('renders published option', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('option', { name: 'Published' })
            ).toBeInTheDocument();
        });

        it('renders archived option', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            expect(
                screen.getByRole('option', { name: 'Archived' })
            ).toBeInTheDocument();
        });

        it('shows initial status when provided', () => {
            render(StoryForm, {
                props: {
                    onSubmit: mockOnSubmit,
                    onCancel: mockOnCancel,
                    status: 'published',
                },
            });

            const statusSelect = screen.getByLabelText(
                /status/i
            ) as HTMLSelectElement;
            expect(statusSelect.value).toBe('published');
        });
    });

    describe('Form submission', () => {
        it('calls onSubmit when form is submitted', async () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const form = document.querySelector('form')!;
            await fireEvent.submit(form);

            expect(mockOnSubmit).toHaveBeenCalledTimes(1);
        });

        it('submit button has type="submit"', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const submitBtn = screen.getByRole('button', {
                name: 'Create Story',
            });
            expect(submitBtn).toHaveAttribute('type', 'submit');
        });

        it('does not call onCancel when form is submitted', async () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const form = document.querySelector('form')!;
            await fireEvent.submit(form);

            expect(mockOnCancel).not.toHaveBeenCalled();
        });
    });

    describe('Cancel action', () => {
        it('calls onCancel when cancel button is clicked', async () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('does not call onSubmit when cancel is clicked', async () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
            await fireEvent.click(cancelBtn);

            expect(mockOnSubmit).not.toHaveBeenCalled();
        });
    });

    describe('Title field', () => {
        it('title input is marked as required', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            expect(titleInput).toBeRequired();
        });

        it('title input has correct placeholder', () => {
            render(StoryForm, {
                props: { onSubmit: mockOnSubmit, onCancel: mockOnCancel },
            });

            const titleInput = screen.getByLabelText(/title/i);
            expect(titleInput).toHaveAttribute(
                'placeholder',
                'Enter story title'
            );
        });
    });
});
