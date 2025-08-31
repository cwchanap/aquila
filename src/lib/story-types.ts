// Story-related types and enums

export enum StoryId {
  TRAIN_ADVENTURE = 'train_adventure'
}

export const STORY_NAMES: Record<StoryId, string> = {
  [StoryId.TRAIN_ADVENTURE]: 'Train Adventure'
}

export function isValidStoryId(story: string): story is StoryId {
  return Object.values(StoryId).includes(story as StoryId)
}
