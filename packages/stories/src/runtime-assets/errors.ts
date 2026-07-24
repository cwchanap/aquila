export type AssetResolverErrorCode =
    | 'unknown-schema-version'
    | 'validation'
    | 'unsafe-path'
    | 'integrity'
    | 'story-mismatch'
    | 'release-mismatch'
    | 'stale-pointer'
    | 'coverage'
    | 'timeout'
    | 'network'
    | 'unavailable'
    | 'not-found';

export class AssetResolverError extends Error {
    readonly code: AssetResolverErrorCode;
    readonly details?: readonly string[];

    constructor(
        code: AssetResolverErrorCode,
        message: string,
        options?: { cause?: unknown; details?: readonly string[] }
    ) {
        super(
            message,
            options?.cause === undefined ? undefined : { cause: options.cause }
        );
        this.name = 'AssetResolverError';
        this.code = code;
        this.details = options?.details;
    }
}
