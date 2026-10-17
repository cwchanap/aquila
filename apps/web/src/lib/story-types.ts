// Story-related types and enums

export enum StoryId {
    TRAIN_ADVENTURE = 'train_adventure',
    DONT_SAVE_ME_BEFORE_MIDNIGHT = 'dont_save_me_before_midnight',
    THE_SEVENTH_MIRROR = 'the_seventh_mirror',
    ELEVATOR_GAME = 'elevator_game',
    DEMON_LORD_IS_HIRING = 'demon_lord_is_hiring',
    THREE_AM_LAUNDROMAT = 'three_am_laundromat',
    DAY_4012 = 'day_4012',
    ONE_POT_BEFORE_DAWN = 'one_pot_before_dawn',
}

export const STORY_NAMES: Record<StoryId, string> = {
    [StoryId.TRAIN_ADVENTURE]: 'Train Adventure',
    [StoryId.DONT_SAVE_ME_BEFORE_MIDNIGHT]: "Don't Save Me Before Midnight",
    [StoryId.THE_SEVENTH_MIRROR]: 'The Seventh Mirror',
    [StoryId.ELEVATOR_GAME]: 'The Elevator Game',
    [StoryId.DEMON_LORD_IS_HIRING]: 'The Demon Lord Is Hiring',
    [StoryId.THREE_AM_LAUNDROMAT]: 'The 3 A.M. Laundromat',
    [StoryId.DAY_4012]: 'Day 4,012',
    [StoryId.ONE_POT_BEFORE_DAWN]: 'One Pot Before Dawn',
};

export function isValidStoryId(story: string): story is StoryId {
    return Object.values(StoryId).includes(story as StoryId);
}
