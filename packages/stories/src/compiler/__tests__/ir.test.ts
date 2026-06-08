import { describe, it, expect } from 'vitest';
import type { DialogueEntryIR } from '../ir';
import type { StoryCompilerConfig } from '../config';

describe('DialogueEntryIR', () => {
    it('supports backgroundPrompt and expressionKey for raw parsed data', () => {
        const entry: DialogueEntryIR = {
            characterId: 'li_jie' as any,
            displayName: '李杰',
            dialogue: 'hello',
            backgroundPrompt: '月台夜景',
            expressionKey: 'angry',
        };
        expect(entry.backgroundPrompt).toBe('月台夜景');
        expect(entry.expressionKey).toBe('angry');
    });

    it('supports resolved background and portrait asset keys', () => {
        const entry: DialogueEntryIR = {
            characterId: 'li_jie' as any,
            displayName: '李杰',
            dialogue: 'hello',
            background: '_root/act1_s0',
            portrait: 'li_jie/angry',
        };
        expect(entry.background).toBe('_root/act1_s0');
        expect(entry.portrait).toBe('li_jie/angry');
    });
});

describe('StoryCompilerConfig', () => {
    it('accepts optional charactersDocPath', () => {
        const config: StoryCompilerConfig = {
            storyId: 'demo',
            charactersDocPath: 'docs/characters.md',
        };
        expect(config.charactersDocPath).toBe('docs/characters.md');
    });

    it('works without charactersDocPath (defaults internally)', () => {
        const config: StoryCompilerConfig = {
            storyId: 'demo',
        };
        expect(config.charactersDocPath).toBeUndefined();
    });
});
