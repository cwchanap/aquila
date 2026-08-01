export type PublisherErrorCode =
    | 'configuration'
    | 'input'
    | 'coverage'
    | 'source'
    | 'encoding'
    | 'integrity'
    | 'storage'
    | 'concurrency'
    | 'activation-target'
    | 'clock-skew'
    | 'non-monotonic-pointer-time';

export class PublisherError extends Error {
    constructor(
        readonly code: PublisherErrorCode,
        message: string,
        options?: ErrorOptions & { context?: Readonly<Record<string, unknown>> }
    ) {
        super(message, options);
        this.name = 'PublisherError';
        this.context = options?.context ?? {};
    }

    readonly context: Readonly<Record<string, unknown>>;
}

export function publisherExitCode(error: unknown): number {
    if (!(error instanceof PublisherError)) return 3;
    if (error.code === 'configuration') return 1;
    if (
        error.code === 'input' ||
        error.code === 'coverage' ||
        error.code === 'source' ||
        error.code === 'encoding' ||
        error.code === 'integrity'
    ) {
        return 2;
    }
    if (error.code === 'storage') return 3;
    if (error.code === 'concurrency') return 4;
    return 5;
}
