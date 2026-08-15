import { describe, it, expect } from 'vitest';
import { parseScene } from '../parse-scene';

const resolve = (name: string) =>
    name === '旁白'
        ? { id: 'narrator', displayName: '旁白' }
        : name === '李杰'
          ? { id: 'li_jie', displayName: '李杰' }
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
                characterId: 'narrator',
                displayName: '旁白',
                dialogue: '深夜的月台。',
            },
            {
                characterId: 'li_jie',
                displayName: '李杰',
                dialogue: '(內心)又是一個夜晚。',
            },
        ]);
    });

    it('accepts a half-width colon', () => {
        const result = parseScene('**旁白**:hello', resolve, 'x.md');
        expect(result.entries[0]).toEqual({
            characterId: 'narrator',
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
        const narrator = { id: 'narrator', displayName: '旁白' };
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
                characterId: 'narrator',
                displayName: '旁白',
                dialogue: '<完>',
            },
            {
                characterId: 'narrator',
                displayName: '旁白',
                dialogue: 'plain forum prose',
            },
            {
                characterId: 'li_jie',
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

    it('applies sfx to exactly the next dialogue entry', () => {
        const md = [
            '```sfx',
            'door-open',
            '```',
            '',
            '**旁白**：第一段。',
            '',
            '**旁白**：第二段。',
        ].join('\n');

        const result = parseScene(md, resolve, 'act1.md');

        expect(result.entries[0].sfx).toBe('door-open');
        expect(result.entries[1].sfx).toBeUndefined();
    });

    it('applies pending bg and sfx to the same next entry', () => {
        const md = [
            '```bg',
            '月台夜景',
            '```',
            '',
            '```sfx',
            'notification-beep',
            '```',
            '',
            '**李杰**：手機亮了。',
        ].join('\n');

        const result = parseScene(md, resolve, 'act1.md');

        expect(result.entries[0]).toMatchObject({
            backgroundPrompt: '月台夜景',
            sfx: 'notification-beep',
        });
    });

    it('consumes sfx on default-speaker narration', () => {
        const narrator = { id: 'narrator', displayName: '旁白' };
        const md = ['```sfx', 'impact', '```', '', '腳落在地板上。'].join('\n');

        const result = parseScene(md, resolve, 'act1.md', narrator);

        expect(result.entries[0]).toMatchObject({
            characterId: 'narrator',
            dialogue: '腳落在地板上。',
            sfx: 'impact',
        });
    });

    it('applies BGM start, change, and stop to the next dialogue entry', () => {
        const narrator = { id: 'narrator', displayName: '旁白' };
        const markdown = `# Scene

\`\`\`bgm
dawn-apartment
\`\`\`

**旁白**：First.

\`\`\`bgm
tension-pulse
\`\`\`

**旁白**：Second.

\`\`\`bgm
stop
\`\`\`

**旁白**：Third.

**旁白**：Fourth.`;

        const result = parseScene(markdown, resolve, 'fixture.md', narrator);

        expect(result.entries).toHaveLength(4);
        expect(result.entries[0]).toEqual({
            characterId: 'narrator',
            displayName: '旁白',
            dialogue: 'First.',
            bgm: 'dawn-apartment',
        });
        expect(result.entries[1]).toEqual({
            characterId: 'narrator',
            displayName: '旁白',
            dialogue: 'Second.',
            bgm: 'tension-pulse',
        });
        expect(result.entries[2]).toEqual({
            characterId: 'narrator',
            displayName: '旁白',
            dialogue: 'Third.',
            bgm: null,
        });
        expect(result.entries[3]).toEqual({
            characterId: 'narrator',
            displayName: '旁白',
            dialogue: 'Fourth.',
        });
        expect(result.entries[3]).not.toHaveProperty('bgm');
    });

    it('applies pending bg, sfx, and BGM to the same next entry', () => {
        const md = [
            '```bg',
            '月台夜景',
            '```',
            '',
            '```sfx',
            'notification-beep',
            '```',
            '',
            '```bgm',
            'tension-pulse',
            '```',
            '',
            '**李杰**：手機亮了。',
        ].join('\n');

        const result = parseScene(md, resolve, 'act1.md');

        expect(result.entries[0]).toMatchObject({
            backgroundPrompt: '月台夜景',
            sfx: 'notification-beep',
            bgm: 'tension-pulse',
        });
    });

    it('accepts an unknown but syntactically valid SFX key', () => {
        const result = parseScene(
            ['```sfx', 'new-door-cue', '```', '', '**旁白**：Door.'].join('\n'),
            resolve,
            'fixture.md'
        );
        expect(result.entries[0].sfx).toBe('new-door-cue');
    });

    it('accepts an unknown but syntactically valid BGM key', () => {
        const result = parseScene(
            ['```bgm', 'new-music-cue', '```', '', '**旁白**：Music.'].join(
                '\n'
            ),
            resolve,
            'fixture.md'
        );
        expect(result.entries[0].bgm).toBe('new-music-cue');
    });

    it.each([
        ['empty', ['```bgm', '', '```'].join('\n'), /invalid bgm block/],
        [
            'capitalized',
            ['```bgm', 'Dawn-Apartment', '```'].join('\n'),
            /invalid bgm block/,
        ],
        [
            'multi-token',
            ['```bgm', 'dawn apartment', '```'].join('\n'),
            /invalid bgm block/,
        ],
    ])('rejects %s BGM blocks', (_label, block, error) => {
        const md = [block, '', '**旁白**：hello'].join('\n');
        expect(() => parseScene(md, resolve, 'act1.md')).toThrow(error);
    });

    it('rejects a second BGM block while one is pending', () => {
        const md = [
            '```bgm',
            'dawn-apartment',
            '```',
            '',
            '```bgm',
            'tension-pulse',
            '```',
            '',
            '**旁白**：hello',
        ].join('\n');

        expect(() => parseScene(md, resolve, 'act1.md')).toThrow(
            /pending bgm/i
        );
    });

    it('rejects an unconsumed BGM block at EOF', () => {
        const md = [
            '**旁白**：hello',
            '',
            '```bgm',
            'dawn-apartment',
            '```',
        ].join('\n');

        expect(() => parseScene(md, resolve, 'act1.md')).toThrow(
            /unconsumed bgm/i
        );
    });

    it.each([
        ['empty', ['```sfx', '', '```'].join('\n')],
        ['multi-token', ['```sfx', 'door open', '```'].join('\n')],
        ['capitalized', ['```sfx', 'Door-Open', '```'].join('\n')],
    ])('rejects %s sfx blocks', (_label, block) => {
        const md = [block, '', '**旁白**：hello'].join('\n');
        expect(() => parseScene(md, resolve, 'act1.md')).toThrow(/sfx/i);
    });

    it('rejects a second sfx block while one is pending', () => {
        const md = [
            '```sfx',
            'door-open',
            '```',
            '',
            '```sfx',
            'impact',
            '```',
            '',
            '**旁白**：hello',
        ].join('\n');

        expect(() => parseScene(md, resolve, 'act1.md')).toThrow(
            /pending sfx/i
        );
    });

    it('rejects an unconsumed sfx block at EOF', () => {
        const md = ['**旁白**：hello', '', '```sfx', 'door-open', '```'].join(
            '\n'
        );

        expect(() => parseScene(md, resolve, 'act1.md')).toThrow(
            /unconsumed sfx/i
        );
    });
});
