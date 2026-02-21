/**
 * Promise-based custom dialog replacements for window.alert, window.confirm, window.prompt.
 * Styled with glassmorphism to match the existing game UI.
 */

function createOverlay(): HTMLDivElement {
    const overlay = document.createElement('div');
    overlay.style.cssText =
        'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);';
    return overlay;
}

function createPanel(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.style.cssText =
        'background:rgba(255,255,255,0.1);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.2);border-radius:1.5rem;padding:2rem;max-width:28rem;width:90%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';
    return panel;
}

function createMessage(text: string): HTMLParagraphElement {
    const msg = document.createElement('p');
    msg.style.cssText =
        'color:#fff;font-size:1rem;line-height:1.5;margin:0 0 1.5rem 0;text-align:center;';
    msg.textContent = text;
    return msg;
}

function createButton(label: string, primary: boolean): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = primary
        ? 'padding:0.625rem 1.5rem;background:linear-gradient(to right,#3b82f6,#22d3ee);color:#fff;font-weight:700;border:none;border-radius:0.75rem;cursor:pointer;font-size:0.875rem;transition:opacity 0.2s;'
        : 'padding:0.625rem 1.5rem;background:rgba(255,255,255,0.15);color:#e5e7eb;font-weight:600;border:1px solid rgba(255,255,255,0.2);border-radius:0.75rem;cursor:pointer;font-size:0.875rem;transition:opacity 0.2s;';
    btn.addEventListener('mouseenter', () => {
        btn.style.opacity = '0.85';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.opacity = '1';
    });
    return btn;
}

function createButtonRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:0.75rem;justify-content:center;';
    return row;
}

export function showAlert(message: string): Promise<void> {
    return new Promise(resolve => {
        const overlay = createOverlay();
        const panel = createPanel();

        // ARIA attributes for accessibility
        const msgId = 'dialog-msg-' + Date.now();
        panel.setAttribute('role', 'alertdialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Alert');
        panel.setAttribute('aria-describedby', msgId);

        const msg = createMessage(message);
        msg.id = msgId;
        panel.appendChild(msg);

        const row = createButtonRow();
        const ok = createButton('OK', true);

        function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
        }

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                cleanup();
                resolve();
            }
            // Focus trap: keep focus within the panel
            if (e.key === 'Tab') {
                e.preventDefault();
                ok.focus();
            }
        }

        document.addEventListener('keydown', onKeyDown);

        ok.addEventListener('click', () => {
            cleanup();
            resolve();
        });
        row.appendChild(ok);
        panel.appendChild(row);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        ok.focus();
    });
}

export function showConfirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
        const overlay = createOverlay();
        const panel = createPanel();

        // ARIA attributes
        const msgId = 'dialog-msg-' + Date.now();
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Confirmation');
        panel.setAttribute('aria-describedby', msgId);

        const msg = createMessage(message);
        msg.id = msgId;
        panel.appendChild(msg);

        const row = createButtonRow();
        const cancel = createButton('Cancel', false);
        const ok = createButton('OK', true);

        function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
        }

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
            // Focus trap between cancel and ok buttons
            if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift+Tab: move focus backward (ok -> cancel, cancel -> ok)
                    if (document.activeElement === cancel) {
                        ok.focus();
                    } else {
                        cancel.focus();
                    }
                } else {
                    // Tab: move focus forward (cancel -> ok, ok -> cancel)
                    if (document.activeElement === ok) {
                        cancel.focus();
                    } else {
                        ok.focus();
                    }
                }
            }
        }

        document.addEventListener('keydown', onKeyDown);

        cancel.addEventListener('click', () => {
            cleanup();
            resolve(false);
        });
        ok.addEventListener('click', () => {
            cleanup();
            resolve(true);
        });

        row.appendChild(cancel);
        row.appendChild(ok);
        panel.appendChild(row);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        ok.focus();
    });
}

export function showPrompt(
    message: string,
    defaultValue?: string
): Promise<string | null> {
    return new Promise(resolve => {
        const overlay = createOverlay();
        const panel = createPanel();

        // ARIA attributes for accessibility
        const msgId = 'dialog-msg-' + Date.now();
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Prompt');
        panel.setAttribute('aria-describedby', msgId);

        const msg = createMessage(message);
        msg.id = msgId;
        panel.appendChild(msg);

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue ?? '';
        input.style.cssText =
            'width:100%;padding:0.75rem 1rem;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:0.75rem;color:#fff;font-size:0.875rem;margin-bottom:1.5rem;outline:none;box-sizing:border-box;';
        panel.appendChild(input);

        const row = createButtonRow();
        const cancel = createButton('Cancel', false);
        const ok = createButton('OK', true);

        function cleanup() {
            document.removeEventListener('keydown', onKeyDown);
            overlay.remove();
        }

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                cleanup();
                resolve(null);
            }
            if (e.key === 'Enter' && document.activeElement !== cancel) {
                cleanup();
                resolve(input.value);
            }
            // Focus trap among input, cancel, and ok
            if (e.key === 'Tab') {
                e.preventDefault();
                const focusable = [input, cancel, ok];
                const currentIndex = focusable.indexOf(
                    document.activeElement as HTMLElement
                );
                if (e.shiftKey) {
                    const prevIndex =
                        currentIndex <= 0
                            ? focusable.length - 1
                            : currentIndex - 1;
                    focusable[prevIndex].focus();
                } else {
                    const nextIndex =
                        currentIndex >= focusable.length - 1
                            ? 0
                            : currentIndex + 1;
                    focusable[nextIndex].focus();
                }
            }
        }

        document.addEventListener('keydown', onKeyDown);

        cancel.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });
        ok.addEventListener('click', () => {
            cleanup();
            resolve(input.value);
        });

        row.appendChild(cancel);
        row.appendChild(ok);
        panel.appendChild(row);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        input.focus();
        input.select();
    });
}
