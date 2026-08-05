import type { PublicationTarget } from '@aquila/stories/runtime-assets';
import {
    parsePublisherReportV1,
    type PublisherReportV1,
} from '../publisher/report';

export type GateIdentityV1 = {
    storyId: string;
    target: PublicationTarget;
    previewId: string;
    releaseId: string;
    manifestSha256: string;
    commitSha: string;
    scenarioSha256: string;
};

export type CandidateEvidenceSummaryV1 = {
    includedIdentities: string[];
    omittedIdentities: string[];
    includedCount: number;
    omittedCount: number;
    pointerChanged: false;
};

export class CandidateEvidenceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CandidateEvidenceError';
    }
}

function fail(message: string): never {
    throw new CandidateEvidenceError(message);
}

function identitiesForDisposition(
    report: PublisherReportV1,
    disposition: 'include' | 'omit'
): string[] {
    const identities = report.actions
        .filter(action => action.kind === disposition)
        .map(action => action.identity);
    if (identities.some(identity => identity === undefined)) {
        return fail('Publisher coverage actions must identify every asset');
    }

    const qualified = identities as string[];
    if (new Set(qualified).size !== qualified.length) {
        return fail('Publisher coverage actions contain duplicate identities');
    }
    return [...qualified].sort();
}

function countIdentitiesByType(
    identities: string[]
): Record<'background' | 'portrait', number> {
    const counts = { background: 0, portrait: 0 };
    for (const identity of identities) {
        const separator = identity.indexOf(':');
        const type = separator === -1 ? '' : identity.slice(0, separator);
        if (type !== 'background' && type !== 'portrait') {
            return fail('Publisher coverage actions contain an invalid type');
        }
        counts[type] += 1;
    }
    return counts;
}

/**
 * Validates the retained immutable production publication report that feeds a
 * release-gate preview. It deliberately consumes the publisher-owned parser
 * rather than accepting a parallel wire schema or rereading mutable plans.
 */
export function validateCandidatePublisherEvidence(
    report: PublisherReportV1,
    expected: GateIdentityV1
): CandidateEvidenceSummaryV1 {
    let parsed: PublisherReportV1;
    try {
        parsed = parsePublisherReportV1(report);
    } catch {
        return fail('Candidate report is not valid retained publisher JSON');
    }
    if (parsed.command !== 'publish') {
        return fail('Candidate report must describe a publish command');
    }
    if (parsed.status !== 'success' && parsed.status !== 'no-op') {
        return fail('Candidate report must have a successful status');
    }
    if (parsed.target.kind !== 'production') {
        return fail(
            'Candidate report must target production immutable storage'
        );
    }
    if (
        parsed.storyId !== expected.storyId ||
        parsed.releaseId !== expected.releaseId ||
        parsed.manifestSha256 !== expected.manifestSha256
    ) {
        return fail('Candidate report does not match the expected release');
    }
    if (parsed.counts.pointersWritten !== 0) {
        return fail('Candidate report must not write a pointer');
    }
    if (parsed.pointer === undefined || parsed.pointer.changed !== false) {
        return fail('Candidate report must not change a pointer');
    }
    if (parsed.actions.some(action => action.kind === 'write-pointer')) {
        return fail('Candidate report must not record a pointer write');
    }

    const coverage = parsed.coverage;
    if (coverage === undefined) {
        return fail('Candidate report must retain coverage evidence');
    }
    if (coverage.storyId !== expected.storyId) {
        return fail('Candidate coverage does not match the expected story');
    }
    if (coverage.totals.unclassified !== 0) {
        return fail('Candidate coverage must not contain unclassified assets');
    }
    if (
        parsed.counts.included !== coverage.totals.included ||
        parsed.counts.omitted !== coverage.totals.omitted
    ) {
        return fail('Candidate publisher counts do not match coverage totals');
    }

    const includedIdentities = identitiesForDisposition(parsed, 'include');
    const omittedIdentities = identitiesForDisposition(parsed, 'omit');
    if (
        includedIdentities.length !== coverage.totals.included ||
        omittedIdentities.length !== coverage.totals.omitted
    ) {
        return fail('Candidate coverage actions do not match coverage totals');
    }
    if (
        omittedIdentities.some(identity =>
            includedIdentities.includes(identity)
        )
    ) {
        return fail(
            'Candidate coverage actions overlap included and omitted assets'
        );
    }

    const includedByType = countIdentitiesByType(includedIdentities);
    const omittedByType = countIdentitiesByType(omittedIdentities);
    for (const type of ['background', 'portrait'] as const) {
        const expectedTypeCoverage = coverage.byType[type];
        if (
            includedByType[type] !== expectedTypeCoverage.included ||
            omittedByType[type] !== expectedTypeCoverage.omitted
        ) {
            return fail(
                'Candidate coverage actions do not match coverage by type'
            );
        }
    }

    return {
        includedIdentities,
        omittedIdentities,
        includedCount: coverage.totals.included,
        omittedCount: coverage.totals.omitted,
        pointerChanged: false,
    };
}
