import type { RubySpan } from './types';

/** Furigana markup in Japanese source text, Aozora Bunko style:
 *  `｜漢字《かんじ》`. The full-width bar is required so a Chinese book title
 *  in 《》 is never read as a reading. */
const RUBY_MARKUP = /｜([^｜《》\n]+)《([^｜《》\n]+)》/g;

/** Splits marked-up text into the plain text readers show and the readings
 *  that sit over parts of it. Text without markup comes back unchanged. */
export function parseRuby(source: string): {
    text: string;
    ruby: RubySpan[];
} {
    const ruby: RubySpan[] = [];
    let text = '';
    let last = 0;
    for (const match of source.matchAll(RUBY_MARKUP)) {
        const [whole, base, reading] = match;
        text += source.slice(last, match.index);
        ruby.push({
            start: text.length,
            end: text.length + base.length,
            reading,
        });
        text += base;
        last = match.index + whole.length;
    }
    text += source.slice(last);
    return { text, ruby };
}
