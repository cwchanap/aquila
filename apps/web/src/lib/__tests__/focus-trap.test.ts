import { afterEach, describe, it, expect, vi } from 'vitest';
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
        document.body.replaceChildren();
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

    it('focuses the container itself when there are no focusable descendants', () => {
        const container = document.createElement('div');
        document.body.append(container);

        const handle = focusTrap(container, true);
        // No focusable child and not inert: the container becomes the focus
        // target (tabindex=-1) so Esc / SR commands still reach the dialog.
        expect(document.activeElement).toBe(container);
        handle.destroy();
    });

    it('defers the focus move when the container is inert at activation, then moves focus once inert clears', async () => {
        // Mirrors MobileActDrawer: the trap (`enabled: open`) and `inert={!open}`
        // flip in the same reactive batch. If the action update runs before the
        // attribute has cleared, no descendant is focusable and focusing the
        // inert container would strand focus on <body>. The trap must defer and
        // retry once the inert attribute settles.
        const container = document.createElement('div');
        container.setAttribute('inert', '');
        const first = makeButton('first');
        container.append(first);
        document.body.append(container);

        const handle = focusTrap(container, { enabled: true });
        // Synchronously still inert: focus NOT moved off <body>.
        expect(document.activeElement).toBe(document.body);

        // Attribute settles after the flush; clearing it lets the deferred
        // microtask retry see the now-reachable button.
        container.removeAttribute('inert');
        await Promise.resolve();

        expect(document.activeElement).toBe(first);
        handle.destroy();
    });

    it('aborts the deferred focus move if the trap is deactivated before inert clears', async () => {
        const container = document.createElement('div');
        container.setAttribute('inert', '');
        const first = makeButton('first');
        container.append(first);
        document.body.append(container);

        const outside = makeButton('outside');
        document.body.append(outside);

        const handle = focusTrap(container, { enabled: true });
        // Deactivate while still inert (overlay closed again same-frame).
        handle.update({ enabled: false });
        // Inert never clears in this scenario.
        await Promise.resolve();

        // The deferred retry must bail (active === false), so it does NOT steal
        // focus onto the (still inert) first button after the fact.
        expect(document.activeElement).not.toBe(first);
        handle.destroy();
    });

    it('stops retrying moveFocusIn after a bounded number of attempts when inert never clears', async () => {
        // Guards against an unbounded microtask flood: if the `inert` attribute
        // is never removed (a bug elsewhere), the retry loop must give up after
        // a small, bounded number of attempts instead of rescheduling forever.
        // (This test uses the global fake-timer setup, so we drain microtasks
        // directly rather than waiting on a real timer.)
        const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

        const container = document.createElement('div');
        container.setAttribute('inert', '');
        const first = makeButton('first');
        container.append(first);
        document.body.append(container);

        const handle = focusTrap(container, { enabled: true });

        // Drain the microtask retry chain (well past the MAX_INERT_RETRIES cap).
        for (let i = 0; i < 20; i++) {
            await Promise.resolve();
        }
        const countAfterDrain = queueMicrotaskSpy.mock.calls.length;

        // A few more drains: if the retry were unbounded, each would add
        // another queueMicrotask call. With the cap, the count is frozen.
        for (let i = 0; i < 5; i++) {
            await Promise.resolve();
        }

        // Focus was never moved into the permanently-inert container.
        expect(document.activeElement).not.toBe(first);
        // The retry stopped (no growth) and is clearly bounded — not the
        // thousands of calls an unbounded loop would produce.
        expect(queueMicrotaskSpy.mock.calls.length).toBe(countAfterDrain);
        expect(countAfterDrain).toBeLessThan(50);

        queueMicrotaskSpy.mockRestore();
        handle.destroy();
    });

    it('defers focus restore when the restore target is inert at deactivate, then restores once it clears', async () => {
        // Mirrors MobileNovelReader: the menu-toggle restore target lives in a
        // background wrapper that is `inert` while an overlay is open. When the
        // overlay closes, the trap's enabled:false update and the wrapper's
        // inert removal happen in the same flush — so deactivate may see an
        // inert target. Restore must defer and land focus once inert clears,
        // not strand it on <body>.
        const backdrop = document.createElement('div');
        backdrop.setAttribute('inert', '');
        const toggle = makeButton('menu');
        backdrop.append(toggle);
        document.body.append(backdrop);

        const container = document.createElement('div');
        const closeBtn = makeButton('close');
        container.append(closeBtn);
        document.body.append(container);

        const handle = focusTrap(container, {
            enabled: true,
            restoreFocus: toggle,
        });
        expect(document.activeElement).toBe(closeBtn);

        // Deactivate while the restore target is still inert.
        handle.update({ enabled: false, restoreFocus: toggle });
        // Synchronously still inert: focus NOT moved onto the toggle.
        expect(document.activeElement).not.toBe(toggle);

        // Attribute settles after the flush; clear it and flush the retry.
        backdrop.removeAttribute('inert');
        await Promise.resolve();

        expect(document.activeElement).toBe(toggle);
        handle.destroy();
    });

    it('restores focus to the explicit restoreFocus target instead of the detached opener', () => {
        // Simulate the overlay scenario: the opener button is unmounted in the
        // same batch as activation, so by the time the trap records
        // activeElement the opener is already detached from the DOM. Without an
        // explicit restore target, deactivate would strand focus on <body>.
        const persistentToggle = makeButton('menu');
        document.body.append(persistentToggle);

        const opener = makeButton('opener');
        document.body.append(opener);
        opener.focus();

        const container = document.createElement('div');
        const closeBtn = makeButton('close');
        container.append(closeBtn);
        document.body.append(container);

        // Activate with the opener still focused…
        const handle = focusTrap(container, {
            enabled: true,
            restoreFocus: persistentToggle,
        });
        expect(document.activeElement).toBe(closeBtn);

        // …then detach the opener (mimicking the chrome bar unmounting).
        opener.remove();

        // Deactivate must restore focus to the persistent toggle, not the
        // detached opener (which would leave focus on <body>).
        handle.update({ enabled: false, restoreFocus: persistentToggle });
        expect(document.activeElement).toBe(persistentToggle);
        handle.destroy();
    });

    it('falls back to the previously focused element when restoreFocus is disconnected', () => {
        const outside = makeButton('outside');
        const container = document.createElement('div');
        const a = makeButton('a');
        container.append(a);
        document.body.append(outside, container);

        outside.focus();
        const staleToggle = makeButton('stale');
        const handle = focusTrap(container, {
            enabled: true,
            restoreFocus: staleToggle,
        });
        expect(document.activeElement).toBe(a);

        // The restore target was removed from the DOM before close. The trap
        // must fall back to the recorded previously-focused element.
        staleToggle.remove();
        handle.update({ enabled: false, restoreFocus: staleToggle });
        expect(document.activeElement).toBe(outside);
        handle.destroy();
    });
});
