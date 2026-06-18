export interface TypewriterOptions {
    /** Full text to type out. */
    text: string;
    /** Delay per character, in milliseconds. */
    speed: number;
    /** Called with the visible substring on each tick (and full text on skip). */
    onTick: (partial: string) => void;
    /** When true, reveal the full text immediately and stop. */
    isSkipped: () => boolean;
    /** When true, abort without finalizing (e.g. the scene changed). */
    isCancelled: () => boolean;
}

export type TypewriterResult = 'done' | 'cancelled';

/**
 * Types `text` one character at a time, emitting partials via `onTick`.
 * Reactivity is owned by the caller through the supplied closures, keeping
 * this helper pure and testable. Returns 'cancelled' if `isCancelled()`
 * becomes true mid-run, otherwise 'done'.
 */
export async function typeText(
    options: TypewriterOptions
): Promise<TypewriterResult> {
    const { text, speed, onTick, isSkipped, isCancelled } = options;

    for (let i = 0; i < text.length; i++) {
        if (isCancelled()) return 'cancelled';
        if (isSkipped()) {
            onTick(text);
            break;
        }
        onTick(text.slice(0, i + 1));
        await new Promise<void>(resolve =>
            globalThis.setTimeout(resolve, speed)
        );
    }

    if (isCancelled()) return 'cancelled';
    return 'done';
}
