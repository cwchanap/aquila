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

    it('renders non-header paragraphs as narration when a defaultSpeaker is given', () => {
        const narrator = { id: CharacterId.Narrator, displayName: '旁白' };
        const md = [
            '**<完>**',
            '',
            'plain forum prose',
            '',
            '**李杰**：hi',
        ].join('\n');
        const result = parseScene(md, resolve, 'x.md', narrator);
        expect(result.entries).toEqual([
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: '<完>',
            },
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'plain forum prose',
            },
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: 'hi',
            },
        ]);
    });

    it('parses ```bg blocks and sets backgroundPrompt on the next entry', () => {
        const md = [
            '**旁白**：第一段。',
            '',
            '```bg',
            '月台夜景，冷色調',
            '```',
            '',
            '**李杰**：第二段。',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toBeUndefined();
        expect(result.entries[1].backgroundPrompt).toBe('月台夜景，冷色調');
    });

    it('carries backgroundPrompt to subsequent entries after a bg block', () => {
        const md = [
            '```bg',
            '月台夜景',
            '```',
            '',
            '**旁白**：第一段。',
            '',
            '**李杰**：第二段。',
            '',
            '**旁白**：第三段。',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toBe('月台夜景');
        expect(result.entries[1].backgroundPrompt).toBeUndefined();
        expect(result.entries[2].backgroundPrompt).toBeUndefined();
    });

    it('handles multiple bg blocks in one scene', () => {
        const md = [
            '```bg',
            '場景一',
            '```',
            '',
            '**旁白**：a',
            '',
            '```bg',
            '場景二',
            '```',
            '',
            '**旁白**：b',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toBe('場景一');
        expect(result.entries[1].backgroundPrompt).toBe('場景二');
    });

    it('handles multi-line bg prompts', () => {
        const md = [
            '```bg',
            '月台夜景',
            '冷色調',
            '無人',
            '```',
            '',
            '**旁白**：hello',
        ].join('\n');
        const result = parseScene(md, resolve, 'act1.md');
        expect(result.entries[0].backgroundPrompt).toContain('月台夜景');
        expect(result.entries[0].backgroundPrompt).toContain('無人');
    });

    it('parses [expression] override tag after speaker name', () => {
        const result = parseScene(
            '**李杰** [angry]：妳做什麼！',
            resolve,
            'x.md'
        );
        expect(result.entries[0].expressionKey).toBe('angry');
        expect(result.entries[0].dialogue).toBe('妳做什麼！');
    });

    it('works without expression tag (backward compatible)', () => {
        const result = parseScene('**李杰**：hello', resolve, 'x.md');
        expect(result.entries[0].expressionKey).toBeUndefined();
    });

    it('combines bg block and expression tag', () => {
        const md = [
            '```bg',
            '月台',
            '```',
            '',
            '**李杰** [scared]：这是什麼？',
        ].join('\n');
        const result = parseScene(md, resolve, 'x.md');
        expect(result.entries[0].backgroundPrompt).toBe('月台');
        expect(result.entries[0].expressionKey).toBe('scared');
    });
});
