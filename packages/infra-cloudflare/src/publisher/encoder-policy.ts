import {
    isSafeRelativePath,
    RUNTIME_ASSET_DIMENSION_POLICY,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';
import type { PublisherDiagnosticV1 } from './types';

export const ENCODER_POLICY_V1 = {
    id: 'aquila-vn-encoder-v1',
    aspectWarningRelativeError: 0.005,
    background: {
        width: 1600,
        height: 900,
        formats: ['webp', 'avif'] as const,
    },
    portrait: {
        width: 900,
        height: 1200,
        formats: ['webp'] as const,
    },
    webp: {
        quality: 82,
        alphaQuality: 100,
        effort: 6,
        lossless: false,
        smartSubsample: true,
        preset: 'picture' as const,
    },
    avif: {
        quality: 50,
        effort: 6,
        lossless: false,
        chromaSubsampling: '4:4:4' as const,
    },
} as const;

function preferredAspect(assetType: 'background' | 'portrait'): number {
    const preferred = RUNTIME_ASSET_DIMENSION_POLICY[assetType].preferredSource;
    return preferred.width / preferred.height;
}

function minimumSource(assetType: 'background' | 'portrait'): {
    width: number;
    height: number;
} {
    return RUNTIME_ASSET_DIMENSION_POLICY[assetType].minimumSource;
}

export function sourceAspectDiagnostic(
    assetType: 'background' | 'portrait',
    width: number,
    height: number
): PublisherDiagnosticV1 | undefined {
    const actualAspect = width / height;
    const relativeError = Math.abs(
        actualAspect / preferredAspect(assetType) - 1
    );
    if (relativeError <= ENCODER_POLICY_V1.aspectWarningRelativeError) {
        return undefined;
    }
    return {
        code: 'source/aspect-ratio',
        stage: 'source',
        message: `Source aspect ratio differs from the ${assetType} policy`,
        assetType,
    };
}

export function sourceMinimumDiagnostic(
    assetType: 'background' | 'portrait',
    width: number,
    height: number
): PublisherDiagnosticV1 | undefined {
    const minimum = minimumSource(assetType);
    if (width >= minimum.width && height >= minimum.height) {
        return undefined;
    }
    return {
        code: 'source/minimum-dimension',
        stage: 'source',
        message: `Source dimensions are below the ${assetType} minimum`,
        assetType,
    };
}

export interface SourceDiagnosticInput {
    identity: { type: 'background' | 'portrait'; key: string };
    sourcePath: string;
    metadata: { width: number; height: number };
}

export function evaluateSourceDiagnostics(
    input: SourceDiagnosticInput
): PublisherDiagnosticV1[] {
    if (!isSafeRelativePath(input.sourcePath)) {
        throw new PublisherError('source', 'Source path is unsafe', {
            context: { input: 'sourcePath', stage: 'source' },
        });
    }
    // Dimensions are orientation-normalized by the source loader, so a portrait
    // stored with EXIF orientation 6 is evaluated as a portrait. Both
    // diagnostics are independent: an undersized source can also have a
    // correct aspect ratio, and a correctly sized source can have a wrong one.
    const candidates = [
        sourceAspectDiagnostic(
            input.identity.type,
            input.metadata.width,
            input.metadata.height
        ),
        sourceMinimumDiagnostic(
            input.identity.type,
            input.metadata.width,
            input.metadata.height
        ),
    ];
    return candidates
        .filter(
            (diagnostic): diagnostic is PublisherDiagnosticV1 =>
                diagnostic !== undefined
        )
        .map(diagnostic => ({
            ...diagnostic,
            identity: `${input.identity.type}:${input.identity.key}`,
            safePath: input.sourcePath,
        }));
}

function compareText(left: string, right: string): number {
    return left < right ? -1 : left > right ? 1 : 0;
}

export function aggregateDiagnostics(
    diagnostics: readonly PublisherDiagnosticV1[]
): PublisherDiagnosticV1[] {
    const groups = new Map<string, PublisherDiagnosticV1[]>();
    for (const diagnostic of diagnostics) {
        const key = `${diagnostic.code}\u0000${diagnostic.assetType ?? ''}`;
        const group = groups.get(key);
        if (group) group.push(diagnostic);
        else groups.set(key, [diagnostic]);
    }
    return [...groups.entries()]
        .sort(([left], [right]) => compareText(left, right))
        .map(([, group]) => {
            const ordered = [...group].sort((left, right) => {
                const leftKey = `${left.identity ?? ''}\u0000${left.safePath ?? ''}`;
                const rightKey = `${right.identity ?? ''}\u0000${right.safePath ?? ''}`;
                return compareText(leftKey, rightKey);
            });
            const [first] = ordered;
            const sampleIdentities = [
                ...new Set(
                    ordered
                        .map(diagnostic => diagnostic.identity)
                        .filter(
                            (identity): identity is string =>
                                identity !== undefined
                        )
                ),
            ];
            const sampleSafePaths = [
                ...new Set(
                    ordered
                        .map(diagnostic => diagnostic.safePath)
                        .filter((path): path is string => path !== undefined)
                ),
            ].sort();
            return {
                ...first,
                ...(sampleIdentities.length === 0 ? {} : { sampleIdentities }),
                ...(sampleSafePaths.length === 0 ? {} : { sampleSafePaths }),
                count: group.length,
            };
        });
}
