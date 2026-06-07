import { describe, it, expect } from 'vitest';
import { parsePortraits } from '../parse-portraits';
import { CharacterId } from '../../characters';
import type { ResolvedCharacter } from '../config';

const resolve = (name: string): ResolvedCharacter | undefined => {
    if (name === '李杰') return { id: CharacterId.LiJie, displayName: '李杰' };
    if (name === '旁白')
        return { id: CharacterId.Narrator, displayName: '旁白' };
    return undefined;
};

describe('parsePortraits', () => {
    it('extracts portrait prompts from characters.md format', () => {
        const md = [
            '# 角色設定文件',
            '',
            '## 1. 李杰（Li Jie）',
            '',
            '### 基本資料',
            '',
            '- **身份**：男主角',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: 17yo boy, short black hair, school uniform',
            '- **angry**: clenched jaw, narrowed eyes',
            '- **sad**: downcast eyes, trembling lips',
            '',
            '### 說話風格',
            '',
            '- 極度精簡',
        ].join('\n');

        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.LiJie]).toEqual({
            base: '17yo boy, short black hair, school uniform',
            angry: 'clenched jaw, narrowed eyes',
            sad: 'downcast eyes, trembling lips',
        });
    });

    it('handles characters without Portrait Prompts section', () => {
        const md = [
            '## 1. 旁白（Narrator）',
            '',
            '### 基本資料',
            '',
            '- **身份**：旁白',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.Narrator]).toBeUndefined();
    });

    it('normalizes expression keys to lowercase', () => {
        const md = [
            '## 1. 李杰（Li Jie）',
            '',
            '### Portrait Prompts',
            '',
            '- **Angry**: clenched jaw',
            '- **SAD**: downcast eyes',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.LiJie]!.angry).toBe('clenched jaw');
        expect(result[CharacterId.LiJie]!.sad).toBe('downcast eyes');
    });

    it('handles multi-line prompts', () => {
        const md = [
            '## 1. 李杰（Li Jie）',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: 17yo boy, short black hair,',
            '  school uniform, guarded expression',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(result[CharacterId.LiJie]!.base).toContain('17yo boy');
        expect(result[CharacterId.LiJie]!.base).toContain('guarded expression');
    });

    it('skips characters that cannot be resolved', () => {
        const md = [
            '## 1. 未知角色（Unknown）',
            '',
            '### Portrait Prompts',
            '',
            '- **base**: something',
        ].join('\n');
        const result = parsePortraits(md, resolve);
        expect(Object.keys(result)).toHaveLength(0);
    });
});
