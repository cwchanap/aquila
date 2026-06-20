import { afterEach, describe, it, expect } from 'vitest';
import { focusTrap } from '@/lib/focus-trap';

/**
 * Drives the `focusTrap` Svelte action directly against a hand-built DOM so the
 * trap logic (activate focuses first child, Tab wraps both directions, focus is
 * restored on deactivate) is verified independently of component rendering.
 */
function dispatchTab(target: HTMLElement, shift = false): void {
    target.dispatchEvent(
        new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true,
            shiftKey: shift,
        })
    );
}

function makeButton(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    return btn;
}

describe('focusTrap', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('moves focus into the container and onto the first focusable element when enabled', () => {
        const outside = makeButton('outside');
        const container = document.createElement('div');
        const a = makeButton('a');
        const b = makeButton('b');
        container.append(a, b);
        document.body.append(outside, container);

        outside.focus();
        expect(document.activeElement).toBe(outside);

        focusTrap(container, true);

        expect(document.activeElement).toBe(a);
    });

    it('wraps Tab from the last focusable back to the first', () => {
        const container = document.createElement('div');
        const a = makeButton('a');
        const b = makeButton('b');
        const c = makeButton('c');
        container.append(a, b, c);
        document.body.append(container);

        const handle = focusTrap(container, true);
        c.focus();
        dispatchTab(c);

        expect(document.activeElement).toBe(a);
        handle.destroy();
    });

    it('wraps Shift+Tab from the first focusable to the last', () => {
        const container = document.createElement('div');
        const a = makeButton('a');
        const b = makeButton('b');
        const c = makeButton('c');
        container.append(a, b, c);
        document.body.append(container);

        const handle = focusTrap(container, true);
        a.focus();
        dispatchTab(a, /* shift */ true);

        expect(document.activeElement).toBe(c);
        handle.destroy();
    });

    it('does not intercept Tab from a middle element (lets normal order proceed)', () => {
        const container = document.createElement('div');
        const a = makeButton('a');
        const b = makeButton('b');
        const c = makeButton('c');
        container.append(a, b, c);
        document.body.append(container);

        const handle = focusTrap(container, true);
        b.focus();
        const event = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true,
        });
        b.dispatchEvent(event);

        // Middle element: trap must NOT preventDefault; focus stays on b until
        // the browser moves it (we only assert non-interception here).
        expect(event.defaultPrevented).toBe(false);
        handle.destroy();
    });

    it('restores focus to the previously focused element when disabled', () => {
        const outside = makeButton('outside');
        const container = document.createElement('div');
        const a = makeButton('a');
        container.append(a);
        document.body.append(outside, container);

        outside.focus();
        const handle = focusTrap(container, true);
        expect(document.activeElement).toBe(a);

        handle.update(false);

        expect(document.activeElement).toBe(outside);
        handle.destroy();
    });

    it('starts inactive when enabled=false and never steals focus', () => {
        const outside = makeButton('outside');
        const container = document.createElement('div');
        const a = makeButton('a');
        container.append(a);
        document.body.append(outside, container);

        outside.focus();
        const handle = focusTrap(container, false);

        expect(document.activeElement).toBe(outside);
        handle.destroy();
    });

    it('skips focusables that live inside an inert subtree', () => {
        const container = document.createElement('div');
        const a = makeButton('a');
        const b = makeButton('b');
        b.setAttribute('inert', '');
        container.append(a, b);
        document.body.append(container);

        const handle = focusTrap(container, true);
        // `b` is inert, so the first (and only reachable) focusable is `a`.
        expect(document.activeElement).toBe(a);
        // Tab from a: with only one reachable focusable, focus stays on a.
        a.focus();
        dispatchTab(a);
        expect(document.activeElement).toBe(a);
        handle.destroy();
    });
});
