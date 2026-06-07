import { describe, it, expect } from 'vitest';
import { resolveSceneAssets } from '../resolve-assets';
import { CharacterId } from '../../characters';
import type { DialogueEntryIR } from '../ir';

type PortraitPromptMap = Partial<Record<string, Record<string, string>>>;

const portraitMap: PortraitPromptMap = {
    [CharacterId.LiJie]: {
        base: '17yo boy, school uniform',
        angry: 'clenched jaw, narrowed eyes',
    },
};

describe('resolveSceneAssets', () => {
    it('assigns background keys to every entry in a section', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'a',
                backgroundPrompt: '月台',
            },
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: 'b',
            },
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'c',
            },
        ];
        const { backgrounds } = resolveSceneAssets(
            'demo',
            'act1',
            'act1.md',
            entries,
            portraitMap
        );
        expect(entries[0].background).toBe('_root/act1_s0');
        expect(entries[1].background).toBe('_root/act1_s0');
        expect(entries[2].background).toBe('_root/act1_s0');
        expect(backgrounds).toHaveLength(1);
        expect(backgrounds[0].key).toBe('_root/act1_s0');
        expect(backgrounds[0].prompt).toBe('月台');
    });

    it('handles multiple bg sections with incrementing index', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'a',
                backgroundPrompt: 'scene1',
            },
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'b',
                backgroundPrompt: 'scene2',
            },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].background).toBe('_root/act1_s0');
        expect(entries[1].background).toBe('_root/act1_s1');
    });

    it('uses directory name from sourcePath for nested scenes', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'a',
                backgroundPrompt: 'x',
            },
        ];
        resolveSceneAssets(
            'demo',
            'b1a_act4',
            'branch_1a/act4.md',
            entries,
            portraitMap
        );
        expect(entries[0].background).toBe('branch_1a/b1a_act4_s0');
    });

    it('assigns portrait base key for characters with portrait prompts', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: 'a',
            },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].portrait).toBe('li_jie/base');
    });

    it('assigns portrait expression override key', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: 'a',
                expressionKey: 'angry',
            },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].portrait).toBe('li_jie/angry');
    });

    it('does not assign portrait for characters without portrait prompts', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.Narrator,
                displayName: '旁白',
                dialogue: 'a',
            },
        ];
        resolveSceneAssets('demo', 'act1', 'act1.md', entries, portraitMap);
        expect(entries[0].portrait).toBeUndefined();
    });

    it('does not assign portrait when expression and base are both missing', () => {
        const incompleteMap: PortraitPromptMap = {
            [CharacterId.LiJie]: { happy: 'smiling' } as Record<string, string>,
        };
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: 'a',
                expressionKey: 'nonexistent',
            },
        ];
        const { portraits } = resolveSceneAssets(
            'demo',
            'act1',
            'act1.md',
            entries,
            incompleteMap
        );
        expect(entries[0].portrait).toBeUndefined();
        expect(portraits).toHaveLength(0);
    });

    it('builds manifest entries with correct paths', () => {
        const entries: DialogueEntryIR[] = [
            {
                characterId: CharacterId.LiJie,
                displayName: '李杰',
                dialogue: 'a',
                backgroundPrompt: '月台',
            },
        ];
        const { backgrounds, portraits } = resolveSceneAssets(
            'demo',
            'act1',
            'act1.md',
            entries,
            portraitMap
        );
        expect(backgrounds[0].path).toBe('demo/backgrounds/_root/act1_s0.png');
        expect(portraits[0].path).toBe('demo/characters/li_jie/base.png');
        expect(portraits[0].prompt).toBe('17yo boy, school uniform');
    });
});
