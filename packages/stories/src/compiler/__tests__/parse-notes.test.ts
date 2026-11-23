import { describe, expect, it } from 'vitest';
import { parseNotesMarkdown } from '../parse-notes';

describe('parseNotesMarkdown', () => {
    it('parses character sections, structural flags and fact lines', () => {
        const parsed = parseNotesMarkdown(
            [
                '## li_jie',
                '',
                'hidden: true',
                '',
                '- age: 十七歲',
                '- secret: 其實是班長',
                '',
                '## emi',
                '',
                'known-as: 文靜少女',
                '',
                '- height: 很高',
            ].join('\n'),
            'notes/zh.md',
            'zh'
        );

        expect(parsed.characters).toMatchObject([
            {
                id: 'li_jie',
                line: 1,
                hidden: true,
                facts: [
                    { id: 'age', text: '十七歲', line: 5 },
                    { id: 'secret', text: '其實是班長', line: 6 },
                ],
            },
            {
                id: 'emi',
                line: 8,
                hidden: false,
                knownAs: '文靜少女',
                facts: [{ id: 'height', text: '很高', line: 12 }],
            },
        ]);
        expect(parsed.getById('li_jie')?.facts).toHaveLength(2);
        expect(parsed.getById('nope')).toBeUndefined();
    });

    it('accepts an empty notes file', () => {
        expect(
            parseNotesMarkdown('\n\n', 'notes/zh.md', 'zh').characters
        ).toEqual([]);
    });

    it('accepts name overrides in mirror locales', () => {
        const parsed = parseNotesMarkdown(
            ['## li_jie', '', 'name: Li Jie', '', '- age: seventeen'].join(
                '\n'
            ),
            'notes/en.md',
            'en'
        );
        expect(parsed.characters[0]).toMatchObject({
            id: 'li_jie',
            name: 'Li Jie',
            facts: [{ id: 'age', text: 'seventeen' }],
        });
    });

    it('rejects content before the first section', () => {
        expect(() =>
            parseNotesMarkdown('- age: 17', 'notes/zh.md', 'zh')
        ).toThrow(/before the first "## character_id" section/);
    });

    it('rejects duplicate character sections and fact ids', () => {
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', '## li_jie'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/duplicate character section "li_jie"/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', '- age: 1', '', '- age: 2'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/duplicate fact "age" for character "li_jie"/);
    });

    it('rejects invalid character ids, fact ids and reserved fact ids', () => {
        expect(() =>
            parseNotesMarkdown('## 李杰', 'notes/zh.md', 'zh')
        ).toThrow(/invalid character id/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', '- Age: 1'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/malformed fact line/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', '- constructor: 1'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/reserved/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', '- met: 1'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/reserved/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', '- name: 1'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/reserved/);
    });

    it('rejects malformed or duplicated structural fields', () => {
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', 'hidden: false'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/hidden must be exactly "true"/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', 'known-as: A', '', 'known-as: B'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/duplicate known-as/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', 'something: else'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/unrecognized notes line/);
    });

    it('rejects zh name overrides and mirror-only structural flags', () => {
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', 'name: 李杰'].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/zh notes take canonical names from docs\/characters.md/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', 'hidden: true'].join('\n'),
                'notes/en.md',
                'en'
            )
        ).toThrow(/only zh notes can set "hidden"/);
        expect(() =>
            parseNotesMarkdown(
                ['## li_jie', '', 'name-aliases: 杰'].join('\n'),
                'notes/en.md',
                'en'
            )
        ).toThrow(/only zh notes can set "name-aliases"/);
    });

    it('parses and validates name-aliases in zh notes', () => {
        const parsed = parseNotesMarkdown(
            ['## tanaka_kenta', '', 'name-aliases: 健太, 田中'].join('\n'),
            'notes/zh.md',
            'zh'
        );
        expect(parsed.characters[0].nameAliases).toEqual(['健太', '田中']);

        expect(() =>
            parseNotesMarkdown(
                ['## tanaka_kenta', '', 'name-aliases:  , '].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/at least one comma-separated alias/);

        expect(() =>
            parseNotesMarkdown(
                [
                    '## tanaka_kenta',
                    '',
                    'name-aliases: 健太',
                    'name-aliases: 田中',
                ].join('\n'),
                'notes/zh.md',
                'zh'
            )
        ).toThrow(/duplicate name-aliases/);
    });
});
