/**
 * Svelte action: traps keyboard focus inside `node` while `enabled` is true, so
 * a modal overlay (drawer / sheet) keeps Tab/Shift+Tab within itself instead of
 * reaching controls hidden behind the scrim. On activation it records the
 * previously focused element and moves focus to the first focusable descendant;
 * on deactivation (or unmount) it restores focus to that element.
 *
 * Pair with `inert` on the background content so screen readers that ignore
 * `aria-modal` still can't reach the concealed controls (defense in depth).
 */
export type FocusTrapParams = boolean;

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

export function focusTrap(node: HTMLElement, enabled: FocusTrapParams = true) {
    let active = false;
    let previouslyFocused: HTMLElement | null = null;

    function activate(): void {
        if (active) return;
        const doc = node.ownerDocument;
        previouslyFocused = (doc?.activeElement as HTMLElement | null) ?? null;
        active = true;
        const focusable = getFocusable(node);
        // Move focus into the overlay so the user lands inside the dialog
        // rather than on a control behind the scrim.
        if (focusable.length > 0) {
            focusable[0].focus();
        } else {
            // No focusable child: make the container itself focusable so Esc
            // and screen-reader commands still target the dialog.
            if (!node.hasAttribute('tabindex')) {
                node.setAttribute('tabindex', '-1');
            }
            node.focus();
        }
    }

    function deactivate(): void {
        active = false;
        const target = previouslyFocused;
        previouslyFocused = null;
        // Restore focus to whatever opened the overlay (e.g. the toolbar
        // button), matching the modal-dialog contract.
        if (target && typeof target.focus === 'function') {
            target.focus();
        }
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
    setEnabled(enabled);

    return {
        update(next: FocusTrapParams): void {
            setEnabled(next);
        },
        destroy(): void {
            node.removeEventListener('keydown', onKeydown);
            if (active) deactivate();
        },
    };
}
