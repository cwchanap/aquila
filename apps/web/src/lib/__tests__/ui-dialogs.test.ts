import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showAlert, showConfirm, showPrompt } from '../ui-dialogs';

describe('ui-dialogs', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        // Cleanup any remaining overlays
        document
            .querySelectorAll('div[style*="position:fixed"]')
            .forEach(el => el.remove());
    });

    describe('showAlert', () => {
        it('creates an alert dialog with ARIA attributes', async () => {
            const promise = showAlert('Test message');

            const panel = document.querySelector('[role="alertdialog"]');
            expect(panel).toBeTruthy();
            expect(panel?.getAttribute('aria-modal')).toBe('true');
            expect(panel?.getAttribute('aria-describedby')).toBeTruthy();

            // Click OK to resolve
            const okBtn = panel?.querySelector('button');
            okBtn?.click();
            await promise;
        });

        it('resolves when OK is clicked', async () => {
            const promise = showAlert('Test');
            const btn = document.querySelector('button');
            btn?.click();
            await expect(promise).resolves.toBeUndefined();
        });

        it('resolves when Escape is pressed', async () => {
            const promise = showAlert('Test');
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await expect(promise).resolves.toBeUndefined();
        });

        it('removes overlay on Escape', async () => {
            const promise = showAlert('Test');
            expect(document.body.children.length).toBeGreaterThan(0);

            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await promise;

            // Overlay should be removed
            const overlay = document.querySelector(
                'div[style*="position:fixed"]'
            );
            expect(overlay).toBeNull();
        });

        it('traps focus on Tab key', async () => {
            const promise = showAlert('Test');

            // Tab should not propagate
            const tabEvent = new KeyboardEvent('keydown', {
                key: 'Tab',
                cancelable: true,
            });
            const spy = vi.fn();
            document.addEventListener('keydown', spy);
            document.dispatchEvent(tabEvent);

            // Cleanup
            document.removeEventListener('keydown', spy);
            const btn = document.querySelector('button');
            btn?.click();
            await promise;
        });
    });

    describe('showConfirm', () => {
        it('resolves true when OK is clicked', async () => {
            const promise = showConfirm('Confirm?');
            const buttons = document.querySelectorAll('button');
            const okBtn = buttons[buttons.length - 1]; // OK is the last button
            okBtn?.click();
            await expect(promise).resolves.toBe(true);
        });

        it('resolves false when Cancel is clicked', async () => {
            const promise = showConfirm('Confirm?');
            const buttons = document.querySelectorAll('button');
            const cancelBtn = buttons[0]; // Cancel is the first button
            cancelBtn?.click();
            await expect(promise).resolves.toBe(false);
        });

        it('resolves false when Escape is pressed', async () => {
            const promise = showConfirm('Confirm?');
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await expect(promise).resolves.toBe(false);
        });

        it('removes overlay after resolving', async () => {
            const promise = showConfirm('Confirm?');
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await promise;
            const overlay = document.querySelector(
                'div[style*="position:fixed"]'
            );
            expect(overlay).toBeNull();
        });

        it('has dialog ARIA role', async () => {
            const promise = showConfirm('Confirm?');
            const panel = document.querySelector('[role="dialog"]');
            expect(panel).toBeTruthy();
            expect(panel?.getAttribute('aria-modal')).toBe('true');

            // Cleanup
            const buttons = document.querySelectorAll('button');
            buttons[0]?.click();
            await promise;
        });
    });

    describe('showPrompt', () => {
        it('resolves with input value when OK is clicked', async () => {
            const promise = showPrompt('Enter value:');
            const input = document.querySelector('input') as HTMLInputElement;
            input.value = 'hello';
            const buttons = document.querySelectorAll('button');
            const okBtn = buttons[buttons.length - 1];
            okBtn?.click();
            await expect(promise).resolves.toBe('hello');
        });

        it('resolves null when Cancel is clicked', async () => {
            const promise = showPrompt('Enter value:');
            const buttons = document.querySelectorAll('button');
            buttons[0]?.click();
            await expect(promise).resolves.toBeNull();
        });

        it('resolves null when Escape is pressed on input', async () => {
            const promise = showPrompt('Enter value:');
            const input = document.querySelector('input') as HTMLInputElement;
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
            );
            await expect(promise).resolves.toBeNull();
        });

        it('resolves with value when Enter is pressed on input', async () => {
            const promise = showPrompt('Enter value:');
            const input = document.querySelector('input') as HTMLInputElement;
            input.value = 'test';
            input.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
            );
            await expect(promise).resolves.toBe('test');
        });

        it('uses default value', async () => {
            const promise = showPrompt('Enter:', 'default');
            const input = document.querySelector('input') as HTMLInputElement;
            expect(input.value).toBe('default');

            // Cleanup
            const buttons = document.querySelectorAll('button');
            buttons[0]?.click();
            await promise;
        });
    });
});
