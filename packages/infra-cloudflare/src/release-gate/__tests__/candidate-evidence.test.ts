import { describe, expect, it } from 'vitest';
import type { PublisherReportV1 } from '../../publisher/report';
import {
    validateCandidatePublisherEvidence,
    type GateIdentityV1,
} from '../candidate-evidence';

const RELEASE_ID = `sha256-${'a'.repeat(64)}`;
const MANIFEST_SHA256 = 'b'.repeat(64);

const gateIdentity: GateIdentityV1 = {
    storyId: 'the_seventh_mirror',
    target: { kind: 'preview', previewId: 'hpa-233' },
    previewId: 'hpa-233',
    releaseId: RELEASE_ID,
    manifestSha256: MANIFEST_SHA256,
    commitSha: 'c'.repeat(40),
    scenarioSha256: 'd'.repeat(64),
};

function validPublisherReport(): PublisherReportV1 {
    return {
        schemaVersion: 1,
        command: 'publish',
        status: 'success',
        storyId: 'the_seventh_mirror',
        target: { kind: 'production' },
        releaseId: RELEASE_ID,
        manifestSha256: MANIFEST_SHA256,
        coverage: {
            storyId: 'the_seventh_mirror',
            byType: {
                background: {
                    total: 2,
                    included: 1,
                    omitted: 1,
                    unclassified: 0,
                },
                portrait: {
                    total: 1,
                    included: 1,
                    omitted: 0,
                    unclassified: 0,
                },
            },
            bySection: {
                opening: {
                    total: 3,
                    included: 2,
                    omitted: 1,
                    unclassified: 0,
                },
            },
            totals: {
                total: 3,
                included: 2,
                omitted: 1,
                unclassified: 0,
            },
        },
        counts: {
            included: 2,
            omitted: 1,
            objectsCreated: 2,
            objectsReused: 1,
            manifestsCreated: 1,
            manifestsReused: 0,
            pointersWritten: 0,
        },
        actions: [
            {
                stage: 'input',
                kind: 'include',
                identity: 'background:opening/station',
            },
            {
                stage: 'input',
                kind: 'include',
                identity: 'portrait:characters/mei',
            },
            {
                stage: 'input',
                kind: 'omit',
                identity: 'background:opening/fallback',
            },
            { stage: 'activation', kind: 'no-op' },
        ],
        warnings: [],
        errors: [],
        pointer: { changed: false },
    };
}

describe('candidate publisher evidence', () => {
    it('accepts only a production publish report with no pointer write', () => {
        const summary = validateCandidatePublisherEvidence(
            validPublisherReport(),
            gateIdentity
        );

        expect(summary.pointerChanged).toBe(false);
        expect(summary.includedIdentities).toEqual([
            'background:opening/station',
            'portrait:characters/mei',
        ]);
        expect(summary.omittedIdentities).toEqual([
            'background:opening/fallback',
        ]);
        expect(summary.includedCount).toBe(2);
        expect(summary.omittedCount).toBe(1);
    });

    it('rejects aggregate-matching actions assigned to the wrong asset types', () => {
        const report = validPublisherReport();
        report.actions = [
            {
                stage: 'input',
                kind: 'include',
                identity: 'background:opening/station',
            },
            {
                stage: 'input',
                kind: 'include',
                identity: 'background:opening/fallback',
            },
            {
                stage: 'input',
                kind: 'omit',
                identity: 'portrait:characters/mei',
            },
            { stage: 'activation', kind: 'no-op' },
        ];

        expect(() =>
            validateCandidatePublisherEvidence(report, gateIdentity)
        ).toThrow('Candidate coverage actions do not match coverage by type');
    });

    it.each([
        [
            'wrong command',
            () => ({ ...validPublisherReport(), command: 'activate' as const }),
        ],
        [
            'pointer write',
            () => ({
                ...validPublisherReport(),
                counts: {
                    ...validPublisherReport().counts,
                    pointersWritten: 1,
                },
            }),
        ],
        [
            'pointer change',
            () => ({
                ...validPublisherReport(),
                pointer: { changed: true },
            }),
        ],
        [
            'missing pointer evidence',
            () => {
                const report = validPublisherReport();
                delete report.pointer;
                return report;
            },
        ],
        [
            'preview target',
            () => ({
                ...validPublisherReport(),
                target: { kind: 'preview' as const, previewId: 'hpa-233' },
            }),
        ],
        [
            'unclassified coverage',
            () => ({
                ...validPublisherReport(),
                coverage: {
                    ...validPublisherReport().coverage!,
                    byType: {
                        background: {
                            total: 2,
                            included: 1,
                            omitted: 0,
                            unclassified: 1,
                        },
                        portrait: {
                            total: 1,
                            included: 1,
                            omitted: 0,
                            unclassified: 0,
                        },
                    },
                    bySection: {
                        opening: {
                            total: 3,
                            included: 2,
                            omitted: 0,
                            unclassified: 1,
                        },
                    },
                    totals: {
                        total: 3,
                        included: 2,
                        omitted: 0,
                        unclassified: 1,
                    },
                },
                counts: {
                    ...validPublisherReport().counts,
                    omitted: 0,
                },
                actions: validPublisherReport().actions.filter(
                    action => action.kind !== 'omit'
                ),
            }),
        ],
        [
            'missing omitted identity',
            () => ({
                ...validPublisherReport(),
                actions: validPublisherReport().actions.filter(
                    action => action.kind !== 'omit'
                ),
            }),
        ],
    ])('rejects %s', (_label, createInvalidReport) => {
        expect(() =>
            validateCandidatePublisherEvidence(
                createInvalidReport(),
                gateIdentity
            )
        ).toThrow();
    });
});
