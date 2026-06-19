export interface LongpressParams {
    onLongPress: () => void;
    onRelease: () => void;
    delay?: number;
}

const DEFAULT_DELAY = 450;

/**
 * Svelte action: hold the pointer for `delay` ms to "peek" — fires
 * `onLongPress` (e.g. show a tooltip) and suppresses the click that would
 * otherwise follow, so holding a control to read its label never triggers it.
 * A short tap is untouched.
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
            current.onLongPress();
        }, current.delay ?? DEFAULT_DELAY);
    }

    function onPointerEnd(): void {
        clearTimer();
        if (fired) {
            current.onRelease();
        }
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
    node.addEventListener('pointerup', onPointerEnd);
    node.addEventListener('pointerleave', onPointerEnd);
    node.addEventListener('pointercancel', onPointerEnd);
    node.addEventListener('click', onClickCapture, true);

    return {
        update(next: LongpressParams): void {
            current = next;
        },
        destroy(): void {
            clearTimer();
            node.removeEventListener('pointerdown', onPointerDown);
            node.removeEventListener('pointerup', onPointerEnd);
            node.removeEventListener('pointerleave', onPointerEnd);
            node.removeEventListener('pointercancel', onPointerEnd);
            node.removeEventListener('click', onClickCapture, true);
        },
    };
}
