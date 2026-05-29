import { describe, it, expect } from 'vitest';
import { parseScene } from '../parse-scene';
import { CharacterId } from '../../characters';

const resolve = (name: string) =>
    name === '旁白'
        ? { id: CharacterId.Narrator, displayName: '旁白' }
        : name === '李杰'
          ? { id: CharacterId.LiJie, displayName: '李杰' }
          : undefined;

describe('parseScene', () => {
    it('extracts title and entries, keeping parentheticals verbatim', () => {
        const md = [
            '# 第一幕：月台',
            '',
            '**旁白**：深夜的月台。',
            '',
            '**李杰**：(內心)又是一個夜晚。',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.title).toBe('第一幕：月台');
        expect(result.entries).toEqual([
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: '深夜的月台。',
            },
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: '(內心)又是一個夜晚。',
            },
        ]);
    });

    it('accepts a half-width colon', () => {
        const result = parseScene('**旁白**:hello', resolve, 'x.md');
        expect(result.entries[0]).toEqual({
            characterId: CharacterId.Narrator,
            displayName: '旁白',
            dialogue: 'hello',
        });
    });

    it('skips --- horizontal-rule separators', () => {
        const md = ['**旁白**：a', '', '---', '', '**李杰**：b'].join('\n');
        const result = parseScene(md, resolve, 'x.md');
        expect(result.entries.map(e => e.dialogue)).toEqual(['a', 'b']);
    });

    it('throws on an unknown character', () => {
        expect(() => parseScene('**陌生人**：hi', resolve, 'x.md')).toThrow(
            /unknown character/
        );
    });

    it('throws on a non-header paragraph', () => {
        expect(() => parseScene('just some prose', resolve, 'x.md')).toThrow(
            /unrecognized paragraph/
        );
    });
});
