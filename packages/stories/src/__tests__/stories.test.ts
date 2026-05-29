import { describe, it, expect } from 'vitest';
import {
    getTrainAdventureStory,
    trainAdventureFlow,
} from '../stories/trainAdventure';
import { getStoryContent, getStoryFlow } from '../stories';

describe('stories', () => {
    describe('getTrainAdventureStory', () => {
        it('returns English story content', () => {
            const content = getTrainAdventureStory('en');
            expect(content).toBeDefined();
            expect(content.dialogue).toBeDefined();
            expect(content.choices).toBeDefined();
        });

        it('returns Chinese story content', () => {
            const content = getTrainAdventureStory('zh');
            expect(content).toBeDefined();
            expect(content.dialogue).toBeDefined();
            expect(content.choices).toBeDefined();
        });

        it('has dialogue entries', () => {
            const content = getTrainAdventureStory('zh');
            const dialogueKeys = Object.keys(content.dialogue);
            expect(dialogueKeys.length).toBeGreaterThan(0);
        });

        it('dialogue entries have required properties', () => {
            const content = getTrainAdventureStory('zh');
            const firstSceneKey = Object.keys(content.dialogue)[0];
            const entries = content.dialogue[firstSceneKey];

            expect(Array.isArray(entries)).toBe(true);
            expect(entries.length).toBeGreaterThan(0);
            const entry = entries[0];
            expect(entry).toHaveProperty('dialogue');
        });
    });

    describe('trainAdventureFlow', () => {
        it('has valid flow configuration', () => {
            expect(trainAdventureFlow).toBeDefined();
            expect(trainAdventureFlow.start).toBeDefined();
            expect(trainAdventureFlow.nodes).toBeDefined();
            expect(Array.isArray(trainAdventureFlow.nodes)).toBe(true);
        });

        it('starts with act1', () => {
            expect(trainAdventureFlow.start).toBe('act1');
        });

        it('has scene nodes for all scenes', () => {
            const sceneNodes = trainAdventureFlow.nodes.filter(
                n => n.kind === 'scene'
            );
            expect(sceneNodes.length).toBeGreaterThan(0);

            const sceneIds = sceneNodes.map(
                n => (n as { sceneId: string }).sceneId
            );
            expect(sceneIds).toContain('act1');
        });

        it('has at least one choice node', () => {
            const choiceNodes = trainAdventureFlow.nodes.filter(
                n => n.kind === 'choice'
            );
            expect(choiceNodes.length).toBeGreaterThan(0);
        });
    });

    describe('getTrainAdventureStory locale fallback', () => {
        it('treats zh-TW as Chinese', () => {
            const zhTW = getTrainAdventureStory('zh-TW');
            const zh = getTrainAdventureStory('zh');
            expect(zhTW.dialogue).toEqual(zh.dialogue);
            expect(zhTW.choices).toEqual(zh.choices);
        });

        it('treats zh-CN as Chinese', () => {
            const zhCN = getTrainAdventureStory('zh-CN');
            const zh = getTrainAdventureStory('zh');
            expect(zhCN.dialogue).toEqual(zh.dialogue);
        });

        it('falls back to English for unknown locale', () => {
            const fr = getTrainAdventureStory('fr');
            const en = getTrainAdventureStory('en');
            expect(fr.dialogue).toEqual(en.dialogue);
            expect(fr.choices).toEqual(en.choices);
        });

        it('en currently mirrors zh dialogue (placeholder until en is authored)', () => {
            const en = getTrainAdventureStory('en');
            const zh = getTrainAdventureStory('zh');
            expect(en.dialogue).toBe(zh.dialogue);
        });
    });
});

describe('getStoryContent', () => {
    it('returns content for train_adventure story', () => {
        const result = getStoryContent('train_adventure', 'en');
        expect(result).toBeDefined();
        expect(result.dialogue).toBeDefined();
        expect(result.choices).toBeDefined();
    });

    it('falls back to train_adventure for unknown storyId', () => {
        const fallback = getStoryContent('unknown_story', 'en');
        const trainAdventure = getStoryContent('train_adventure', 'en');
        expect(fallback.dialogue).toBe(trainAdventure.dialogue);
    });

    it('falls back to train_adventure for undefined storyId', () => {
        const fallback = getStoryContent(undefined, 'en');
        const trainAdventure = getStoryContent('train_adventure', 'en');
        expect(fallback.dialogue).toBe(trainAdventure.dialogue);
    });

    it('defaults to English for undefined locale', () => {
        const result = getStoryContent('train_adventure', undefined);
        const en = getStoryContent('train_adventure', 'en');
        expect(result.dialogue).toBe(en.dialogue);
    });

    it('handles locale case-insensitively', () => {
        const upper = getStoryContent('train_adventure', 'EN');
        const lower = getStoryContent('train_adventure', 'en');
        expect(upper.dialogue).toBe(lower.dialogue);
    });

    it('returns Chinese content when locale is zh', () => {
        const zh = getStoryContent('train_adventure', 'zh');
        expect(zh.dialogue).toBeDefined();
        expect(Object.keys(zh.dialogue).length).toBeGreaterThan(0);
    });
});

describe('getStoryFlow', () => {
    it('returns flow for train_adventure', () => {
        const flow = getStoryFlow('train_adventure');
        expect(flow).toBeDefined();
        expect(flow?.start).toBe('act1');
    });

    it('falls back to train_adventure for unknown storyId', () => {
        const flow = getStoryFlow('nonexistent');
        expect(flow).toBeDefined();
        expect(flow?.start).toBe('act1');
    });

    it('falls back to train_adventure for undefined storyId', () => {
        const flow = getStoryFlow(undefined);
        expect(flow).toBeDefined();
        expect(flow?.nodes).toBeDefined();
    });

    it('returned flow matches trainAdventureFlow', () => {
        const flow = getStoryFlow('train_adventure');
        expect(flow).toBe(trainAdventureFlow);
    });
});

// ── Content consistency ────────────────────────────────────────────────────

describe('trainAdventure content consistency', () => {
    const en = getTrainAdventureStory('en');
    const zh = getTrainAdventureStory('zh');

    const sceneNodes = trainAdventureFlow.nodes.filter(n => n.kind === 'scene');
    const choiceNodes = trainAdventureFlow.nodes.filter(
        n => n.kind === 'choice'
    );

    it('en and zh dialogue have the same scene keys', () => {
        const enKeys = Object.keys(en.dialogue).sort();
        const zhKeys = Object.keys(zh.dialogue).sort();
        expect(enKeys).toEqual(zhKeys);
    });

    it('every flow scene node has a matching entry in the zh dialogue', () => {
        for (const node of sceneNodes) {
            const sceneId = (node as { sceneId: string }).sceneId;
            expect(zh.dialogue[sceneId]).toBeDefined();
        }
    });

    it('every dialogue scene maps to a flow scene node', () => {
        const flowSceneIds = new Set(
            sceneNodes.map(n => (n as { sceneId: string }).sceneId)
        );
        for (const sceneId of Object.keys(zh.dialogue)) {
            expect(flowSceneIds.has(sceneId)).toBe(true);
        }
    });

    it('most dialogue scenes have at least one entry', () => {
        const emptyScenes = Object.entries(zh.dialogue)
            .filter(([, entries]) => entries.length === 0)
            .map(([sceneId]) => sceneId);
        const nonEmptyCount = Object.values(zh.dialogue).filter(
            e => e.length > 0
        ).length;
        expect(nonEmptyCount).toBeGreaterThan(emptyScenes.length);
    });

    it('every flow choice node has a matching entry in choices', () => {
        for (const node of choiceNodes) {
            const choiceId = (node as { choiceId: string }).choiceId;
            expect(zh.choices[choiceId]).toBeDefined();
        }
    });

    it('en and zh expose the same choice IDs', () => {
        const enChoiceIds = Object.keys(en.choices).sort();
        const zhChoiceIds = Object.keys(zh.choices).sort();
        expect(enChoiceIds).toEqual(zhChoiceIds);
    });

    it('every choice has at least one option with a label', () => {
        for (const [, choiceDef] of Object.entries(zh.choices)) {
            // ChoiceMap values are { prompt, options: ChoiceOption[] }
            const { options } = choiceDef as {
                prompt: string;
                options: { id: string; label: string }[];
            };
            expect(Array.isArray(options)).toBe(true);
            expect(options.length).toBeGreaterThan(0);
            for (const opt of options) {
                expect(typeof opt.label).toBe('string');
                expect(opt.label.length).toBeGreaterThan(0);
            }
        }
    });
});
