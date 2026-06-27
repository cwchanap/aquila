// Story-related types and enums

export enum StoryId {
    TRAIN_ADVENTURE = 'train_adventure',
    DONT_SAVE_ME_BEFORE_MIDNIGHT = 'dont_save_me_before_midnight',
    THE_SEVENTH_MIRROR = 'the_seventh_mirror',
}

export const STORY_NAMES: Record<StoryId, string> = {
    [StoryId.TRAIN_ADVENTURE]: 'Train Adventure',
    [StoryId.DONT_SAVE_ME_BEFORE_MIDNIGHT]: "Don't Save Me Before Midnight",
    [StoryId.THE_SEVENTH_MIRROR]: 'The Seventh Mirror',
};

export function isValidStoryId(story: string): story is StoryId {
    return Object.values(StoryId).includes(story as StoryId);
}
