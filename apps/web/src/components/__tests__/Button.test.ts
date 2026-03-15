import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Button from '../ui/Button.svelte';

describe('Button', () => {
    describe('Rendering as button element', () => {
        it('renders a button element when no href is provided', () => {
            render(Button, { props: { type: 'button' } });

            const button = screen.getByRole('button');
            expect(button).toBeInTheDocument();
        });

        it('renders with default button type', () => {
            render(Button, { props: {} });

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'button');
        });

        it('renders with submit type when specified', () => {
            render(Button, { props: { type: 'submit' } });

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'submit');
        });

        it('renders with reset type when specified', () => {
            render(Button, { props: { type: 'reset' } });

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('type', 'reset');
        });
    });

    describe('Rendering as anchor element', () => {
        it('renders an anchor element when href is provided', () => {
            render(Button, { props: { href: '/some-path' } });

            const link = screen.getByRole('link');
            expect(link).toBeInTheDocument();
        });

        it('sets the href attribute on anchor', () => {
            render(Button, { props: { href: '/some-path' } });

            const link = screen.getByRole('link');
            expect(link).toHaveAttribute('href', '/some-path');
        });

        it('does not render a button element when href is provided', () => {
            render(Button, { props: { href: '/some-path' } });

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });
    });

    describe('Disabled state', () => {
        it('renders button as disabled when disabled prop is true', () => {
            render(Button, { props: { disabled: true } });

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();
        });

        it('sets aria-disabled when disabled', () => {
            render(Button, { props: { disabled: true } });

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-disabled', 'true');
        });

        it('is not disabled by default', () => {
            render(Button, { props: {} });

            const button = screen.getByRole('button');
            expect(button).not.toBeDisabled();
        });

        it('has aria-disabled=false when not disabled', () => {
            render(Button, { props: { disabled: false } });

            const button = screen.getByRole('button');
            expect(button).toHaveAttribute('aria-disabled', 'false');
        });
    });

    describe('CSS variants', () => {
        it('applies default variant classes by default', () => {
            render(Button, { props: {} });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('bg-purple-500');
        });

        it('applies menu variant classes when variant=menu', () => {
            render(Button, { props: { variant: 'menu' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('uppercase');
        });

        it('applies menu-compact variant classes when variant=menu-compact', () => {
            render(Button, { props: { variant: 'menu-compact' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('inline-block');
        });

        it('applies additional className prop', () => {
            render(Button, { props: { className: 'my-custom-class' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('my-custom-class');
        });

        it('merges className with variant classes', () => {
            render(Button, { props: { className: 'extra-class' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('extra-class');
            expect(button).toHaveClass('bg-purple-500');
        });
    });

    describe('Size variants', () => {
        it('applies sm size classes', () => {
            render(Button, { props: { size: 'sm' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('h-9');
        });

        it('applies lg size classes', () => {
            render(Button, { props: { size: 'lg' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('h-11');
        });

        it('applies icon size classes', () => {
            render(Button, { props: { size: 'icon' } });

            const button = screen.getByRole('button');
            expect(button).toHaveClass('w-10');
        });
    });
});
