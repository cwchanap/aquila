import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseBrowserEvidenceV1 } from '@aquila/infra-cloudflare/release-gate';
import { writeReleaseGateEvidence } from './release-gate-reporter';

const temporaryDirectories: string[] = [];
const SHA_A = 'a'.repeat(64);
const RELEASE_ID = `sha256-${SHA_A}`;
const TARGET = { kind: 'preview', previewId: 'hpa-233-fixture' } as const;
const STORY_ID = 'hpa_233_fixture';
const SCENARIO_SHA256 = 'b'.repeat(64);

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map(directory => rm(directory, { force: true, recursive: true }))
    );
});

function scenarioCases() {
    return [
        { id: 'direct-open', status: 'passed' as const },
        { id: 'identity-and-requests', status: 'passed' as const },
        { id: 'visual-transition', status: 'passed' as const },
        { id: 'mode-swap', status: 'passed' as const },
        { id: 'viewport-swap', status: 'passed' as const },
        { id: 'history-focus', status: 'passed' as const },
        { id: 'bookmark-restore', status: 'passed' as const },
        { id: 'omitted-fallback', status: 'passed' as const },
        { id: 'choice', status: 'passed' as const },
        { id: 'reload-and-lazy-chunk', status: 'passed' as const },
    ];
}

function projectEvidence(
    project: 'release-gate-chromium' | 'release-gate-mobile-chrome'
) {
    return {
        schemaVersion: 1,
        flow: 'preview-release-gate',
        project,
        status: 'passed',
        webBaseUrl: 'https://preview.example.test',
        storyId: STORY_ID,
        target: TARGET,
        assetEnvironment: 'preview',
        releaseId: RELEASE_ID,
        manifestSha256: SHA_A,
        scenarioSha256: SCENARIO_SHA256,
        requestPaths: {
            pointerRequestUrl:
                'https://assets.example.test/vn/previews/hpa-233-fixture/stories/hpa_233_fixture/current.json',
            manifestRequestUrl: `https://assets.example.test/vn/previews/hpa-233-fixture/stories/hpa_233_fixture/releases/${RELEASE_ID}/runtime-manifest.json`,
        },
        scenarioCases: scenarioCases(),
        screenshots: [],
    };
}

const aggregateIdentity = {
    schemaVersion: 1,
    flow: 'preview-release-gate' as const,
    webBaseUrl: 'https://preview.example.test',
    storyId: STORY_ID,
    target: TARGET,
    releaseId: RELEASE_ID,
    manifestSha256: SHA_A,
    scenarioSha256: SCENARIO_SHA256,
} as const;

describe('release-gate reporter', () => {
    it('writes one deterministic inline aggregate and retains screenshots only', async () => {
        const evidenceDir = await mkdtemp(
            join(tmpdir(), 'aquila-release-gate-evidence-')
        );
        const sourceDir = await mkdtemp(
            join(tmpdir(), 'aquila-release-gate-source-')
        );
        temporaryDirectories.push(evidenceDir, sourceDir);
        const screenshot = join(sourceDir, 'source-screenshot.png');
        await writeFile(screenshot, 'screenshot bytes');

        await writeReleaseGateEvidence({
            evidenceDir,
            aggregate: aggregateIdentity,
            projectEvidence: [
                {
                    evidence: projectEvidence('release-gate-mobile-chrome'),
                    screenshotSources: [screenshot],
                },
                {
                    evidence: projectEvidence('release-gate-chromium'),
                    screenshotSources: [],
                },
            ],
        });

        const evidence = parseBrowserEvidenceV1(
            JSON.parse(
                await readFile(
                    join(evidenceDir, 'browser-evidence.json'),
                    'utf8'
                )
            )
        );

        expect(evidence.status).toBe('passed');
        expect(evidence.webBaseUrl).toBe('https://preview.example.test');
        expect(
            evidence.projects.every(
                project => project.webBaseUrl === 'https://preview.example.test'
            )
        ).toBe(true);
        expect(evidence.projects.map(project => project.project)).toEqual([
            'release-gate-chromium',
            'release-gate-mobile-chrome',
        ]);
        expect(evidence.projects[1]?.screenshots).toEqual([
            'screenshots/release-gate-mobile-chrome/screenshot-0.png',
        ]);
        expect((await readdir(evidenceDir)).sort()).toEqual([
            'browser-evidence.json',
            'screenshots',
        ]);
        expect(JSON.stringify(evidence)).not.toContain(sourceDir);
        expect(JSON.stringify(evidence)).not.toContain('.zip');
        await expect(
            readFile(join(evidenceDir, 'index.json'), 'utf8')
        ).rejects.toThrow();
    });

    it('rejects a raw Playwright trace instead of retaining it', async () => {
        const evidenceDir = await mkdtemp(
            join(tmpdir(), 'aquila-release-gate-evidence-')
        );
        temporaryDirectories.push(evidenceDir);

        await expect(
            writeReleaseGateEvidence({
                evidenceDir,
                aggregate: aggregateIdentity,
                projectEvidence: [
                    {
                        evidence: {
                            ...projectEvidence('release-gate-chromium'),
                            traces: ['trace.zip'],
                        },
                        screenshotSources: [],
                    },
                    {
                        evidence: projectEvidence('release-gate-mobile-chrome'),
                        screenshotSources: [],
                    },
                ],
            })
        ).rejects.toThrow();
    });
});
