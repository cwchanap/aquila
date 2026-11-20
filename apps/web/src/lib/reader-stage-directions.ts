import type { RubySpan } from '@aquila/stories';

/** The text the reader shows for one line, with its furigana spans. */
export type DisplayLine = { dialogue: string; ruby?: RubySpan[] };

// Leading stage directions such as (內心), （點頭）, （心の声） or (thinking).
// Same shape as STAGE_DIRECTIONS in packages/stories/src/voice/cast.ts, which
// reads them off the compiled text to pick the delivery, so the compiled
// dialogue keeps them and only the visual novel view hides them.
const LEADING_DIRECTIONS = /^\s*(?:[（(][^（）()]*[）)]\s*)+/;

/**
 * The line without its leading bracketed stage directions, for the visual
 * novel view. Furigana spans are moved to the new start of the text. Brackets
 * further into the line are story text and stay. A line that is nothing but a
 * direction, such as （沉默）, is returned as it is so the box is never empty.
 */
export function hideStageDirections(entry: DisplayLine): DisplayLine {
    const cut = LEADING_DIRECTIONS.exec(entry.dialogue)?.[0].length ?? 0;
    if (cut === 0 || !entry.dialogue.slice(cut).trim()) return entry;

    const line: DisplayLine = { dialogue: entry.dialogue.slice(cut) };
    if (entry.ruby) {
        line.ruby = entry.ruby
            .filter(span => span.start >= cut)
            .map(span => ({
                ...span,
                start: span.start - cut,
                end: span.end - cut,
            }));
    }
    return line;
}
