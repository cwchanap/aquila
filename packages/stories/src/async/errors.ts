export type StoryLoadErrorCode =
    | 'unknown-story'
    | 'unsupported-locale'
    | 'load-failed';

export class StoryLoadError extends Error {
    constructor(
        public readonly code: StoryLoadErrorCode,
        message: string,
        options?: ErrorOptions
    ) {
        super(message, options);
        this.name = 'StoryLoadError';
    }
}
