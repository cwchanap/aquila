import type { CharacterId } from '../characters';

export interface StoryCompilerConfig {
    /** Registry id used by getStoryContent/getStoryFlow, e.g. 'train_adventure'. */
    storyId: string;
    /** Resolve a markdown character header (real name OR alias) to a CharacterId. */
    resolveCharacter: (name: string) => CharacterId | undefined;
}
