/**
 * Svelte action: traps keyboard focus inside `node` while `enabled` is true, so
 * a modal overlay (drawer / sheet) keeps Tab/Shift+Tab within itself instead of
 * reaching controls hidden behind the scrim. On activation it records the
 * previously focused element and moves focus to the first focusable descendant;
 * on deactivation (or unmount) it restores focus to that element.
 *
 * Pair with `inert` on the background content so screen readers that ignore
 * `aria-modal` still can't reach the concealed controls (defense in depth).
 *
 * `params` may be a plain boolean (back-compat) or an object with:
 *   - `enabled`: whether the trap is active
 *   - `restoreFocus`: optional element to focus on deactivate. Use this when the
 *     element that opened the overlay is unmounted in the same reactive batch as
 *     activation (so `activeElement` is already detached when the trap records
 *     it). The restore target should be an always-mounted control such as the
 *     app's persistent menu toggle.
 */
export type FocusTrapParams =
    | boolean
    | { enabled: boolean; restoreFocus?: HTMLElement | null };

const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), ' +
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"])';

function getFocusable(node: HTMLElement): HTMLElement[] {
    return Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter(el => {
        // Skip elements that are themselves inside an inert subtree (e.g. the
        // overlay is closing and a sibling got inerted) — they can't take focus.
        if (el.closest('[inert]')) return false;
        return true;
    });
}

function normalizeParams(params: FocusTrapParams): {
    enabled: boolean;
    restoreFocus?: HTMLElement | null;
} {
    if (typeof params === 'boolean') {
        return { enabled: params };
    }
    return {
        enabled: params.enabled,
        restoreFocus: params.restoreFocus,
    };
}

export function focusTrap(node: HTMLElement, params: FocusTrapParams = true) {
    let active = false;
    let previouslyFocused: HTMLElement | null = null;
    let restoreFocus: HTMLElement | null | undefined = undefined;

    function activate(): void {
        if (active) return;
        const doc = node.ownerDocument;
        previouslyFocused = (doc?.activeElement as HTMLElement | null) ?? null;
        active = true;
        moveFocusIn();
    }

    /**
     * Move focus onto the first reachable focusable descendant, or onto the
     * container itself if there is none.
     *
     * Handles the "inert race": an overlay such as MobileActDrawer keeps its
     * dialog permanently mounted and toggles both the trap (`enabled: open`)
     * and `inert={!open}` from the same prop. If this action's update runs in
     * the same reactive flush as the attribute removal — before the browser has
     * actually dropped `inert` — `getFocusable` sees an empty list (every
     * descendant is masked by the inert subtree) and focusing the still-inert
     * container would strand focus on <body>. When we detect that situation we
     * defer one microtask (which runs after the synchronous flush settles, so
     * the attribute has cleared) and retry. `getFocusable`/`closest` queries
     * the live DOM each pass, so the retry sees the post-flush state.
     */
    function moveFocusIn(): void {
        if (!active) return;
        const focusable = getFocusable(node);
        if (focusable.length > 0) {
            // Move focus into the overlay so the user lands inside the dialog
            // rather than on a control behind the scrim.
            focusable[0].focus();
            return;
        }
        if (node.closest('[inert]')) {
            queueMicrotask(moveFocusIn);
            return;
        }
        // No focusable child and not inert: make the container itself focusable
        // so Esc and screen-reader commands still target the dialog.
        if (!node.hasAttribute('tabindex')) {
            node.setAttribute('tabindex', '-1');
        }
        node.focus();
    }

    function deactivate(): void {
        active = false;
        // Prefer the explicit restoreFocus target when provided (the opener
        // button may have been unmounted in the same batch as activation, in
        // which case `previouslyFocused` points at a detached node and focusing
        // it would strand focus on <body>). Fall back to the recorded element
        // only when no explicit target was supplied.
        const target =
            restoreFocus && restoreFocus.isConnected
                ? restoreFocus
                : previouslyFocused;
        previouslyFocused = null;
        restoreFocusTo(target);
    }

    /**
     * Restore focus to the element that opened the overlay, matching the
     * modal-dialog contract. Mirrors the `moveFocusIn` inert handling: the
     * restore target can live in a subtree whose `inert` is cleared in the
     * same flush as the overlay closing (MobileNovelReader inerts the whole
     * background wrapper while an overlay is open). Focusing an inert element
     * is a no-op, so without deferral focus would strand on <body>. Retry once
     * the attribute has settled.
     */
    function restoreFocusTo(target: HTMLElement | null): void {
        if (!target || typeof target.focus !== 'function') return;
        if (target.closest('[inert]')) {
            const retry = (): void => {
                // Abandon if the target was removed before inert cleared.
                if (!target.isConnected) return;
                if (target.closest('[inert]')) {
                    queueMicrotask(retry);
                    return;
                }
                target.focus();
            };
            queueMicrotask(retry);
            return;
        }
        target.focus();
    }

    function setEnabled(value: boolean): void {
        if (value) activate();
        else if (active) deactivate();
    }

    function onKeydown(event: KeyboardEvent): void {
        if (!active || event.key !== 'Tab') return;
        const focusable = getFocusable(node);
        if (focusable.length === 0) {
            event.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const doc = node.ownerDocument;
        const current = doc?.activeElement as HTMLElement | null;
        const inside = current && node.contains(current);

        if (event.shiftKey) {
            // Shift+Tab from the first item (or from outside the trap) wraps to
            // the last, keeping focus inside the overlay.
            if (current === first || !inside) {
                event.preventDefault();
                last.focus();
            }
        } else {
            // Tab from the last item wraps back to the first.
            if (current === last || !inside) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    node.addEventListener('keydown', onKeydown);
    const initial = normalizeParams(params);
    restoreFocus = initial.restoreFocus ?? null;
    setEnabled(initial.enabled);

    return {
        update(next: FocusTrapParams): void {
            const normalized = normalizeParams(next);
            restoreFocus = normalized.restoreFocus ?? null;
            setEnabled(normalized.enabled);
        },
        destroy(): void {
            node.removeEventListener('keydown', onKeydown);
            if (active) deactivate();
        },
    };
}
