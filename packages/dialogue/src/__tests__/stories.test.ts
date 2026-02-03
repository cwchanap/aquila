import { describe, it, expect } from 'vitest';
import { getTrainAdventureStory } from '../stories/trainAdventure';
import { trainAdventureFlow } from '../stories/trainAdventure/flow';

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
            const content = getTrainAdventureStory('en');
            const dialogueKeys = Object.keys(content.dialogue);
            expect(dialogueKeys.length).toBeGreaterThan(0);
        });

        it('dialogue entries have required properties', () => {
            const content = getTrainAdventureStory('en');
            const firstSceneKey = Object.keys(content.dialogue)[0];
            const entries = content.dialogue[firstSceneKey];

            expect(Array.isArray(entries)).toBe(true);
            if (entries.length > 0) {
                const entry = entries[0];
                expect(entry).toHaveProperty('dialogue');
            }
        });
    });

    describe('trainAdventureFlow', () => {
        it('has valid flow configuration', () => {
            expect(trainAdventureFlow).toBeDefined();
            expect(trainAdventureFlow.start).toBeDefined();
            expect(trainAdventureFlow.nodes).toBeDefined();
            expect(Array.isArray(trainAdventureFlow.nodes)).toBe(true);
        });

        it('starts with scene_1', () => {
            expect(trainAdventureFlow.start).toBe('scene_1');
        });

        it('has scene nodes for all scenes', () => {
            const sceneNodes = trainAdventureFlow.nodes.filter(
                n => n.kind === 'scene'
            );
            expect(sceneNodes.length).toBeGreaterThan(0);

            const sceneIds = sceneNodes.map(
                n => (n as { sceneId: string }).sceneId
            );
            expect(sceneIds).toContain('scene_1');
        });

        it('has at least one choice node', () => {
            const choiceNodes = trainAdventureFlow.nodes.filter(
                n => n.kind === 'choice'
            );
            expect(choiceNodes.length).toBeGreaterThan(0);
        });
    });
});
