export type StoryLoadErrorCode =
    | 'unknown-story'
    | 'unsupported-locale'
    | 'load-failed';

type ErrorOptions = {
    cause?: unknown;
};

export class StoryLoadError extends Error {
    constructor(
        public readonly code: StoryLoadErrorCode,
        message: string,
        options?: ErrorOptions
    ) {
        super(message);
        if (options && 'cause' in options) {
            Object.defineProperty(this, 'cause', {
                configurable: true,
                value: options.cause,
                writable: true,
            });
        }
        this.name = 'StoryLoadError';
    }
}
