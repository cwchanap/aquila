export interface LongpressParams {
    onLongPress: (node: HTMLElement) => void;
    onRelease: () => void;
    delay?: number;
}

const DEFAULT_DELAY = 450;

/**
 * Svelte action: hold the pointer for `delay` ms to "peek" — fires
 * `onLongPress` with the pressed node (e.g. so a tooltip can anchor to it via
 * getBoundingClientRect) and suppresses the click that would otherwise follow,
 * so holding a control to read its label never triggers it. A short tap is
 * untouched.
 */
export function longpress(node: HTMLElement, params: LongpressParams) {
    let current = params;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fired = false;

    function clearTimer(): void {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
    }

    function onPointerDown(): void {
        fired = false;
        clearTimer();
        timer = setTimeout(() => {
            timer = undefined;
            fired = true;
            current.onLongPress(node);
        }, current.delay ?? DEFAULT_DELAY);
    }

    function onPointerUp(): void {
        clearTimer();
        if (fired) {
            current.onRelease();
        }
        // Keep `fired` true: a click follows pointerup and must be suppressed.
    }

    function onPointerLeave(): void {
        clearTimer();
        if (fired) {
            current.onRelease();
        }
        // No click follows pointerleave/pointercancel, so clear the suppression
        // flag — otherwise a later keyboard-activated click would be swallowed.
        fired = false;
    }

    // Capture-phase: a long-press swallows the subsequent click before it can
    // reach the element's (delegated) click handler.
    function onClickCapture(event: Event): void {
        if (fired) {
            event.stopImmediatePropagation();
            event.preventDefault();
            fired = false;
        }
    }

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointerleave', onPointerLeave);
    node.addEventListener('pointercancel', onPointerLeave);
    node.addEventListener('click', onClickCapture, true);

    return {
        update(next: LongpressParams): void {
            current = next;
        },
        destroy(): void {
            clearTimer();
            if (fired) {
                current.onRelease();
                fired = false;
            }
            node.removeEventListener('pointerdown', onPointerDown);
            node.removeEventListener('pointerup', onPointerUp);
            node.removeEventListener('pointerleave', onPointerLeave);
            node.removeEventListener('pointercancel', onPointerLeave);
            node.removeEventListener('click', onClickCapture, true);
        },
    };
}
