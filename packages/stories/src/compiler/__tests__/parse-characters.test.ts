import { describe, it, expect } from 'vitest';
import { parseCharacters } from '../parse-characters';

describe('parseCharacters', () => {
    const sample = `# Characters

## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`
- **Aliases**: 小顧, 顧言同學
- **Portrait Slot**: left

Some bio prose.

### Portrait Prompts

- **base**: anime portrait of a boy
- **angry**: clenched jaw, narrowed eyes

## 2. 旁白（Narrator）

- **ID**: \`narrator\`

## 3. 學生（Student）

- **ID**: \`student\`
- **Aliases**: 同學, 隔壁同學
`;

    it('parses character IDs from metadata bullets', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')).toBeDefined();
        expect(dir.getById('narrator')).toBeDefined();
        expect(dir.getById('student')).toBeDefined();
    });

    it('extracts display name from heading', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.name).toBe('顧言');
        expect(dir.getById('narrator')?.name).toBe('旁白');
    });

    it('extracts aliases', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.aliases).toEqual(['小顧', '顧言同學']);
        expect(dir.getById('student')?.aliases).toEqual(['同學', '隔壁同學']);
        expect(dir.getById('narrator')?.aliases).toEqual([]);
    });

    it('resolves name to id', () => {
        const dir = parseCharacters(sample);
        expect(dir.getIdByName('顧言')).toBe('gu_yan');
        expect(dir.getIdByName('小顧')).toBe('gu_yan');
        expect(dir.getIdByName('narrator')).toBeUndefined();
        expect(dir.getIdByName('旁白')).toBe('narrator');
    });

    it('parses portrait prompts', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.portraits.base).toBe(
            'anime portrait of a boy'
        );
        expect(dir.getById('gu_yan')?.portraits.angry).toBe(
            'clenched jaw, narrowed eyes'
        );
        expect(dir.getById('narrator')?.portraits).toEqual({});
    });

    it('parses optional portrait slots', () => {
        const dir = parseCharacters(sample);
        expect(dir.getById('gu_yan')?.portraitSlot).toBe('left');
        expect(dir.getById('narrator')?.portraitSlot).toBeUndefined();
    });

    it('rejects invalid portrait slots', () => {
        const invalid = `## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`
- **Portrait Slot**: foreground
`;
        expect(() => parseCharacters(invalid)).toThrow(
            /Portrait Slot.*left, center, or right/
        );
    });

    it('rejects empty or multi-token portrait slots instead of ignoring them', () => {
        const empty = `## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`
- **Portrait Slot**:
`;
        expect(() => parseCharacters(empty)).toThrow(
            /Portrait Slot.*left, center, or right/
        );

        const multi = `## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`
- **Portrait Slot**: left center
`;
        expect(() => parseCharacters(multi)).toThrow(
            /Portrait Slot.*left, center, or right/
        );
    });

    it('accepts case-insensitive center and right slots', () => {
        const md = `## 1. 甲（A）

- **ID**: \`a\`
- **Portrait Slot**: CENTER

## 2. 乙（B）

- **ID**: \`b\`
- **Portrait Slot**: Right
`;
        const dir = parseCharacters(md);
        expect(dir.getById('a')?.portraitSlot).toBe('center');
        expect(dir.getById('b')?.portraitSlot).toBe('right');
    });

    it('throws on missing ID', () => {
        const noId = `## 1. 無名（No Name）\n\nNo ID bullet.\n`;
        expect(() => parseCharacters(noId)).toThrow(/missing.*ID/i);
    });

    it('throws on duplicate ID', () => {
        const dupId = `## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`

## 2. 顧言二號（Gu Yan II）

- **ID**: \`gu_yan\`
`;
        expect(() => parseCharacters(dupId)).toThrow(/duplicate.*ID.*gu_yan/i);
    });

    it('rejects reserved Object.prototype names as character IDs', () => {
        // Character IDs become raw-string keys in the generated
        // `characterTable` and `slotsByCharacterId` (ordinary objects). A
        // lookup for a reserved name returns the inherited Object.prototype
        // value instead of `undefined` when no own property is emitted,
        // breaking the `T | undefined` contract. Reject at parse time so the
        // whole class is caught at the source. Covers both the explicit-slot
        // and absent-slot cases.
        const protoId = `## 1. 原型（Proto）

- **ID**: \`__proto__\`
- **Portrait Slot**: Left
`;
        expect(() => parseCharacters(protoId)).toThrow(
            /__proto__[\s\S]*reserved/s
        );

        const constructorId = `## 1. 構造（Constructor）

- **ID**: \`constructor\`
`;
        expect(() => parseCharacters(constructorId)).toThrow(
            /constructor[\s\S]*reserved/s
        );

        const toStringId = `## 1. 字串（String）

- **ID**: \`toString\`
`;
        expect(() => parseCharacters(toStringId)).toThrow(
            /toString[\s\S]*reserved/s
        );
    });

    it('handles characters without aliases bullet', () => {
        const noAliases = `## 1. 張昊（Zhang Hao）\n\n- **ID**: \`zhang_hao\`\n`;
        const dir = parseCharacters(noAliases);
        expect(dir.getById('zhang_hao')?.aliases).toEqual([]);
    });

    it('handles multi-line portrait prompts', () => {
        const multiLine = `## 1. 李杰（Li Jie）

- **ID**: \`li_jie\`

### Portrait Prompts

- **base**: 17yo boy, short black hair,
  school uniform, guarded expression
`;
        const dir = parseCharacters(multiLine);
        expect(dir.getById('li_jie')?.portraits.base).toBe(
            '17yo boy, short black hair, school uniform, guarded expression'
        );
    });

    it('returns all characters in order', () => {
        const dir = parseCharacters(sample);
        expect(dir.characters.map(c => c.id)).toEqual([
            'gu_yan',
            'narrator',
            'student',
        ]);
    });

    it('resets state on non-character ## headings', () => {
        const withSection = `## 1. 顧言（Gu Yan）

- **ID**: \`gu_yan\`
- **Aliases**: 小顧

## 8. 次要角色

### 顧澤（顧言父親）

- **ID**: \`gu_ze\`
`;
        const dir = parseCharacters(withSection);
        expect(dir.characters.map(c => c.id)).toEqual(['gu_yan']);
        // gu_ze should NOT be captured because the ## 8 heading reset state
        // and ### headings are not character headings
        expect(dir.getById('gu_ze')).toBeUndefined();
    });

    it('accepts decimal numbering (e.g. 7.5) in headings', () => {
        const decimal = `## 7.5. 司機（Driver）

- **ID**: \`driver\`
- **Aliases**: 校務車司機
`;
        const dir = parseCharacters(decimal);
        expect(dir.getById('driver')).toBeDefined();
        expect(dir.getById('driver')?.name).toBe('司機');
        expect(dir.getIdByName('司機')).toBe('driver');
        expect(dir.getIdByName('校務車司機')).toBe('driver');
    });
});
