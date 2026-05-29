import { CharacterDirectory } from '../../src/characters';
import type { StoryCompilerConfig } from '../../src/compiler/config';

const config: StoryCompilerConfig = {
    storyId: 'train_adventure',
    resolveCharacter: name => CharacterDirectory.getIdByName(name),
};

export default config;
