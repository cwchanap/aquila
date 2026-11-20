import type { RubySpan } from '@aquila/stories';

/** The text the reader shows for one line, with its furigana spans. */
export type DisplayLine = { dialogue: string; ruby?: RubySpan[] };

// Leading bracketed groups such as (內心), （點頭）, （心の声） or (thinking).
// Same shape as STAGE_DIRECTIONS in packages/stories/src/voice/cast.ts, which
// reads them off the compiled text to pick the delivery, so the compiled
// dialogue keeps them and only the visual novel view hides them.
const DIRECTION = /\s*[（(]([^（）()]*)[）)]\s*/y;

// A group that says what the line is rather than how it is acted: a message
// from afar, or the language spoken. It stays visible, together with anything
// else inside the same brackets, e.g. （隔著門，精靈語）.
const CONTENT_LABEL =
    /^(?:訊息|メッセージ|message)$|(?:精靈|日|英|中)[語文]|エルフ語|日本語|中国語|elvish|japanese|chinese|english/i;

/**
 * The line without its leading bracketed stage directions, for the visual
 * novel view. Furigana spans are moved to match the shortened text. Message
 * and language labels, and brackets further into the line, are story text and
 * stay. A line that is nothing but directions, such as （沉默）, is returned
 * as it is so the box is never empty.
 */
export function hideStageDirections(entry: DisplayLine): DisplayLine {
    const text = entry.dialogue;
    const hidden: [start: number, end: number][] = [];
    let runEnd = 0;
    DIRECTION.lastIndex = 0;
    for (let m = DIRECTION.exec(text); m; m = DIRECTION.exec(text)) {
        if (!CONTENT_LABEL.test(m[1].trim())) {
            hidden.push([m.index, m.index + m[0].length]);
        }
        runEnd = DIRECTION.lastIndex;
    }
    if (hidden.length === 0 || !text.slice(runEnd).trim()) return entry;

    let dialogue = '';
    let from = 0;
    for (const [start, end] of hidden) {
        dialogue += text.slice(from, start);
        from = end;
    }
    dialogue += text.slice(from);

    const line: DisplayLine = { dialogue };
    if (entry.ruby) {
        line.ruby = entry.ruby
            .filter(span =>
                hidden.every(([s, e]) => span.start >= e || span.end <= s)
            )
            .map(span => {
                const shift = hidden.reduce(
                    (n, [s, e]) => (e <= span.start ? n + e - s : n),
                    0
                );
                return {
                    ...span,
                    start: span.start - shift,
                    end: span.end - shift,
                };
            });
    }
    return line;
}
