import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Modal from '../ui/Modal.svelte';

describe('Modal', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('Visibility', () => {
        it('renders content when open is true', () => {
            render(Modal, { props: { open: true, title: 'Test Modal' } });

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('does not render when open is false', () => {
            render(Modal, { props: { open: false, title: 'Test Modal' } });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('does not render by default (open defaults to false)', () => {
            render(Modal, { props: {} });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Title', () => {
        it('renders the title text', () => {
            render(Modal, { props: { open: true, title: 'My Dialog Title' } });

            expect(screen.getByText('My Dialog Title')).toBeInTheDocument();
        });

        it('renders empty title when not provided', () => {
            render(Modal, { props: { open: true } });

            const heading = screen.getByRole('heading', { level: 2 });
            expect(heading).toBeInTheDocument();
            expect(heading.textContent).toBe('');
        });
    });

    describe('Close button', () => {
        it('renders a close button', () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            expect(
                screen.getByRole('button', { name: 'Close modal' })
            ).toBeInTheDocument();
        });

        it('closes the modal when close button is clicked', async () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            const closeButton = screen.getByRole('button', {
                name: 'Close modal',
            });
            await fireEvent.click(closeButton);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Overlay', () => {
        it('renders a backdrop overlay', () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            const overlay = document.querySelector('[aria-hidden="true"]');
            expect(overlay).toBeInTheDocument();
        });

        it('closes the modal when overlay is clicked', async () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            expect(screen.getByRole('dialog')).toBeInTheDocument();

            const overlay = document.querySelector(
                '[aria-hidden="true"]'
            ) as HTMLElement;
            await fireEvent.click(overlay);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Keyboard interaction', () => {
        it('closes the modal when Escape key is pressed on dialog', async () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            const dialog = screen.getByRole('dialog');
            await fireEvent.keyDown(dialog, { key: 'Escape' });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('does not close on other key presses on dialog', async () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            const dialog = screen.getByRole('dialog');
            await fireEvent.keyDown(dialog, { key: 'Enter' });

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has role="dialog"', () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('has aria-modal="true"', () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            expect(screen.getByRole('dialog')).toHaveAttribute(
                'aria-modal',
                'true'
            );
        });

        it('overlay has aria-hidden="true"', () => {
            render(Modal, { props: { open: true, title: 'Test' } });

            const overlay = document.querySelector('[aria-hidden="true"]');
            expect(overlay).toBeInTheDocument();
        });
    });
});
