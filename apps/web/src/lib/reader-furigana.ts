import type { RubySpan } from '@aquila/stories';
import { getBrowserStorage } from './reader-mode';

/** Furigana over Japanese text is on unless the reader turned it off. */
export const READER_FURIGANA_KEY = 'aquila:reader-furigana:v1';

export function readFurigana(
    storage: Storage | null = getBrowserStorage()
): boolean {
    try {
        return storage?.getItem(READER_FURIGANA_KEY) !== 'off';
    } catch {
        return true;
    }
}

export function writeFurigana(
    on: boolean,
    storage: Storage | null = getBrowserStorage()
): void {
    try {
        if (on) {
            storage?.removeItem(READER_FURIGANA_KEY);
        } else {
            storage?.setItem(READER_FURIGANA_KEY, 'off');
        }
    } catch {
        return;
    }
}

export type RubySegment = { text: string; reading?: string };

/** Cuts a line into plain runs and runs with a reading over them. A span
 *  that is out of range or overlaps the one before it is dropped, so bad
 *  data costs a reading, never the text. */
export function rubySegments(
    text: string,
    ruby: readonly RubySpan[]
): RubySegment[] {
    const segments: RubySegment[] = [];
    let cursor = 0;
    for (const span of ruby) {
        if (
            span.start < cursor ||
            span.end <= span.start ||
            span.end > text.length
        ) {
            continue;
        }
        if (span.start > cursor) {
            segments.push({ text: text.slice(cursor, span.start) });
        }
        segments.push({
            text: text.slice(span.start, span.end),
            reading: span.reading,
        });
        cursor = span.end;
    }
    if (cursor < text.length) segments.push({ text: text.slice(cursor) });
    return segments;
}
