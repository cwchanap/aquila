import { afterEach, describe, it, expect, vi } from 'vitest';
import { longpress } from '@/lib/longpress';

describe('longpress action', () => {
    afterEach(() => vi.clearAllTimers());

    it('fires onLongPress after the delay, then onRelease on release', () => {
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const onRelease = vi.fn();
        const handle = longpress(node, { onLongPress, onRelease, delay: 450 });

        node.dispatchEvent(new Event('pointerdown'));
        expect(onLongPress).not.toHaveBeenCalled();
        vi.advanceTimersByTime(450);
        expect(onLongPress).toHaveBeenCalledTimes(1);
        // The callback receives the pressed node so callers can anchor UI
        // (e.g. a tooltip) to the specific control that was held.
        expect(onLongPress).toHaveBeenCalledWith(node);

        node.dispatchEvent(new Event('pointerup'));
        expect(onRelease).toHaveBeenCalledTimes(1);
        handle.destroy();
    });

    it('does not fire when released before the delay', () => {
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const onRelease = vi.fn();
        const handle = longpress(node, { onLongPress, onRelease, delay: 450 });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(200);
        node.dispatchEvent(new Event('pointerup'));
        vi.advanceTimersByTime(450);
        expect(onLongPress).not.toHaveBeenCalled();
        expect(onRelease).not.toHaveBeenCalled();
        handle.destroy();
    });

    it('suppresses the click that follows a long-press (peek-only)', () => {
        // Model Svelte's delegated click handler as a bubble-phase listener on
        // an ancestor: stopping propagation at the target must prevent it.
        const parent = document.createElement('div');
        const node = document.createElement('button');
        parent.appendChild(node);
        const delegated = vi.fn();
        parent.addEventListener('click', delegated);

        const handle = longpress(node, {
            onLongPress: vi.fn(),
            onRelease: vi.fn(),
            delay: 450,
        });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(450);
        node.dispatchEvent(new Event('pointerup'));

        const click = new Event('click', { bubbles: true, cancelable: true });
        node.dispatchEvent(click);

        expect(click.defaultPrevented).toBe(true);
        expect(delegated).not.toHaveBeenCalled();
        handle.destroy();
    });

    it('lets a normal click through when there was no long-press', () => {
        const parent = document.createElement('div');
        const node = document.createElement('button');
        parent.appendChild(node);
        const delegated = vi.fn();
        parent.addEventListener('click', delegated);

        const handle = longpress(node, {
            onLongPress: vi.fn(),
            onRelease: vi.fn(),
            delay: 450,
        });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(200);
        node.dispatchEvent(new Event('pointerup'));
        node.dispatchEvent(
            new Event('click', { bubbles: true, cancelable: true })
        );

        expect(delegated).toHaveBeenCalledTimes(1);
        handle.destroy();
    });

    it('does not suppress a later click when a long-press ends via pointercancel/pointerleave', () => {
        const parent = document.createElement('div');
        const node = document.createElement('button');
        parent.appendChild(node);
        const delegated = vi.fn();
        parent.addEventListener('click', delegated);

        const handle = longpress(node, {
            onLongPress: vi.fn(),
            onRelease: vi.fn(),
            delay: 450,
        });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(450);
        // Long-press fires, then the gesture is cancelled (e.g. browser scroll
        // takes over) — no click follows this pointer sequence.
        node.dispatchEvent(new Event('pointercancel'));
        node.dispatchEvent(new Event('pointerleave'));

        // A subsequent click (e.g. keyboard activation on a focused control)
        // must bubble normally — the suppression flag was cleared on cancel.
        const click = new Event('click', { bubbles: true, cancelable: true });
        node.dispatchEvent(click);

        expect(click.defaultPrevented).toBe(false);
        expect(delegated).toHaveBeenCalledTimes(1);
        handle.destroy();
    });

    it('removes listeners on destroy', () => {
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const handle = longpress(node, {
            onLongPress,
            onRelease: vi.fn(),
            delay: 450,
        });
        handle.destroy();
        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(450);
        expect(onLongPress).not.toHaveBeenCalled();
    });

    it('releases on destroy if a long-press is still active', () => {
        // If the host node is removed mid-press (e.g. the chrome bar hides
        // while a tooltip is showing), destroy() must clear the tooltip so it
        // does not stick around with stale anchor coordinates.
        const node = document.createElement('button');
        const onLongPress = vi.fn();
        const onRelease = vi.fn();
        const handle = longpress(node, {
            onLongPress,
            onRelease,
            delay: 450,
        });

        node.dispatchEvent(new Event('pointerdown'));
        vi.advanceTimersByTime(450);
        expect(onLongPress).toHaveBeenCalledTimes(1);
        expect(onRelease).not.toHaveBeenCalled();

        handle.destroy();
        expect(onRelease).toHaveBeenCalledTimes(1);
    });
});
