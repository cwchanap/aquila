import {
    AssetResolverError,
    assertActivationAllowed,
    validateReleaseCoverage,
    type AuthoringAssetCatalog,
    type PublicationTarget,
    type StoryAssetCoverageReport,
    type StoryAssetReleasePlanV1,
} from '@aquila/stories/runtime-assets';
import { PublisherError } from './errors';

export interface ValidatePublisherCoverageOptions {
    catalog: AuthoringAssetCatalog;
    plan: StoryAssetReleasePlanV1;
    target: PublicationTarget;
    availableSourcePaths: ReadonlySet<string>;
}

function coverageDiagnostic(error: AssetResolverError): string {
    if (
        error.details?.some(detail => detail.startsWith('Source path mismatch'))
    ) {
        return 'coverage/source-path-mismatch';
    }
    if (
        error.details?.some(detail =>
            detail.startsWith('Missing included source asset')
        )
    ) {
        return 'coverage/missing-source';
    }
    if (error.message.includes('Preview release plans')) {
        return 'coverage/activation-not-allowed';
    }
    return 'coverage/validation-failed';
}

export function validatePublisherCoverage(
    options: ValidatePublisherCoverageOptions
): StoryAssetCoverageReport {
    try {
        assertActivationAllowed(options.plan, options.target);
        return validateReleaseCoverage(
            options.catalog,
            options.plan,
            options.availableSourcePaths
        );
    } catch (error) {
        if (
            !(error instanceof AssetResolverError) ||
            error.code !== 'coverage'
        ) {
            throw error;
        }
        const diagnostic = coverageDiagnostic(error);
        throw new PublisherError('coverage', diagnostic, {
            cause: error,
            context: { diagnostic },
        });
    }
}
