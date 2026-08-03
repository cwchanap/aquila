import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeReleaseGateEvidence } from './release-gate-reporter';

const temporaryDirectories: string[] = [];
const SHA_A = 'a'.repeat(64);
const RELEASE_ID = `sha256-${SHA_A}`;

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map(directory => rm(directory, { force: true, recursive: true }))
    );
});

describe('release-gate reporter', () => {
    it('writes one safe result per project and a deterministic aggregate index', async () => {
        const evidenceDir = await mkdtemp(
            join(tmpdir(), 'aquila-release-gate-')
        );
        temporaryDirectories.push(evidenceDir);
        const trace = join(evidenceDir, 'source-trace.zip');
        const screenshot = join(evidenceDir, 'source-screenshot.png');
        await writeFile(trace, 'trace bytes');
        await writeFile(screenshot, 'screenshot bytes');

        await writeReleaseGateEvidence({
            evidenceDir,
            projectEvidence: [
                {
                    schemaVersion: 1,
                    project: 'release-gate-mobile-chrome',
                    storyId: 'hpa_233_fixture',
                    target: 'preview',
                    previewId: 'hpa-233-fixture',
                    releaseId: RELEASE_ID,
                    manifestSha256: SHA_A,
                    scenarioSha256: 'b'.repeat(64),
                    identity: {
                        assetEnvironment: 'preview',
                        previewId: 'hpa-233-fixture',
                        releaseId: RELEASE_ID,
                        manifestSha256: SHA_A,
                    },
                    requestPaths: {
                        pointerRequestUrl:
                            'https://assets.example.test/vn/previews/hpa-233-fixture/stories/hpa_233_fixture/current.json',
                        manifestRequestUrl: `https://assets.example.test/vn/previews/hpa-233-fixture/stories/hpa_233_fixture/releases/${RELEASE_ID}/runtime-manifest.json`,
                        observedUrls: [],
                    },
                    scenarioCases: [{ id: 'direct-open', status: 'passed' }],
                    status: 'passed',
                    traces: [trace],
                    screenshots: [screenshot],
                },
                {
                    schemaVersion: 1,
                    project: 'release-gate-chromium',
                    storyId: 'hpa_233_fixture',
                    target: 'preview',
                    previewId: 'hpa-233-fixture',
                    releaseId: RELEASE_ID,
                    manifestSha256: SHA_A,
                    scenarioSha256: 'b'.repeat(64),
                    identity: {
                        assetEnvironment: 'preview',
                        previewId: 'hpa-233-fixture',
                        releaseId: RELEASE_ID,
                        manifestSha256: SHA_A,
                    },
                    requestPaths: {
                        pointerRequestUrl:
                            'https://assets.example.test/vn/previews/hpa-233-fixture/stories/hpa_233_fixture/current.json',
                        manifestRequestUrl: `https://assets.example.test/vn/previews/hpa-233-fixture/stories/hpa_233_fixture/releases/${RELEASE_ID}/runtime-manifest.json`,
                        observedUrls: [],
                    },
                    scenarioCases: [{ id: 'direct-open', status: 'passed' }],
                    status: 'passed',
                    traces: [],
                    screenshots: [],
                },
            ],
        });

        const index = JSON.parse(
            await readFile(join(evidenceDir, 'index.json'), 'utf8')
        ) as {
            projects: {
                project: string;
                path: string;
                status: 'passed' | 'failed';
            }[];
        };
        const mobileEvidence = JSON.parse(
            await readFile(
                join(evidenceDir, 'release-gate-mobile-chrome.json'),
                'utf8'
            )
        ) as { traces: string[]; screenshots: string[] };

        expect(index.projects).toEqual([
            {
                project: 'release-gate-chromium',
                path: 'release-gate-chromium.json',
                status: 'passed',
            },
            {
                project: 'release-gate-mobile-chrome',
                path: 'release-gate-mobile-chrome.json',
                status: 'passed',
            },
        ]);
        expect(mobileEvidence.traces).toEqual([
            'artifacts/release-gate-mobile-chrome/trace-0.zip',
        ]);
        expect(mobileEvidence.screenshots).toEqual([
            'artifacts/release-gate-mobile-chrome/screenshot-0.png',
        ]);
        expect(JSON.stringify(mobileEvidence)).not.toContain(evidenceDir);
    });
});
