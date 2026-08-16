import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioPlanAsset } from '../../audio-plan';
import {
    audioGenerationSpecSha256,
    buildAudioGenerationSpec,
    type CurrentAudioGenerationSpec,
} from '../spec';
import {
    ElevenLabsProviderError,
    type AudioGenerationProvider,
} from '../elevenlabs';
import {
    LocalAudioGenerationStore,
    type GeneratedAudioCandidate,
    type VerifiedStoredCandidate,
} from '../store';
import {
    loadAudioGenerationStoryContext,
    planAudioGeneration,
    runAudioGeneration,
    type AudioGenerationPlan,
    type AudioGenerationStoryContext,
    type RunDependencies,
} from '../run';

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(
        roots.splice(0).map(root => rm(root, { force: true, recursive: true }))
    );
});

function sfx(key: string, prompt = `${key} prompt`): AudioPlanAsset {
    return {
        key,
        type: 'sfx',
        prompt,
        durationMs: 1_000,
    };
}

function bgm(key: string, prompt = `${key} prompt`): AudioPlanAsset {
    return {
        key,
        type: 'bgm',
        prompt,
        durationMs: 3_000,
        loop: true,
    };
}

function contextFor(
    assets: readonly AudioPlanAsset[]
): AudioGenerationStoryContext {
    return {
        storyFolder: 'fixture',
        storyId: 'the_seventh_mirror',
        plan: {
            schemaVersion: 1,
            assets: [...assets],
        },
    };
}

function fakeVerifiedCandidates(count: number): VerifiedStoredCandidate[] {
    return Array.from({ length: count }, () => ({}) as VerifiedStoredCandidate);
}

function planningStore(counts: Record<string, number> = {}) {
    const matchingSuccessfulCandidates = vi.fn(async (key: string) =>
        fakeVerifiedCandidates(counts[key] ?? 0)
    );
    return {
        matchingSuccessfulCandidates,
    } as unknown as LocalAudioGenerationStore & {
        matchingSuccessfulCandidates: typeof matchingSuccessfulCandidates;
    };
}

function candidate(): GeneratedAudioCandidate {
    return {
        bytes: Uint8Array.from([0x49, 0x44, 0x33]),
        mediaType: 'audio/mpeg',
        actualDurationMs: null,
    };
}

function fakeRunStore(
    options: {
        readonly hasMusicTermsNote?: boolean;
        readonly onEvent?: (event: string) => void;
    } = {}
): RunDependencies['store'] & {
    readonly events: string[];
    readonly failureMarkers: Array<{
        candidateId: string;
        spec: CurrentAudioGenerationSpec;
    }>;
} {
    const events: string[] = [];
    const failureMarkers: Array<{
        candidateId: string;
        spec: CurrentAudioGenerationSpec;
    }> = [];
    const emit = (event: string) => {
        events.push(event);
        options.onEvent?.(event);
    };
    let nextCandidateNumber = 1;
    return {
        events,
        failureMarkers,
        matchingSuccessfulCandidates: vi.fn(async () => []),
        nextCandidateId: vi.fn(async () => {
            const id = `candidate-${String(nextCandidateNumber).padStart(3, '0')}`;
            nextCandidateNumber += 1;
            return id;
        }),
        writeSuccess: vi.fn(async ({ candidateId }) => {
            emit(`persist:${candidateId}`);
            return {} as never;
        }),
        writeFailureMarker: vi.fn(async ({ candidateId, spec }) => {
            failureMarkers.push({ candidateId, spec });
            emit(`failure:${candidateId}`);
            return `/tmp/${candidateId}.failure.json`;
        }),
        readVerifiedCandidate: vi.fn(async () => null),
        hasMusicTermsNote: vi.fn(async () => {
            emit('terms-check');
            return options.hasMusicTermsNote ?? true;
        }),
    } as unknown as RunDependencies['store'] & {
        readonly events: string[];
        readonly failureMarkers: Array<{
            candidateId: string;
            spec: CurrentAudioGenerationSpec;
        }>;
    };
}

function fakeProvider(
    outcomes: Array<GeneratedAudioCandidate | Error>,
    events: string[] = []
): AudioGenerationProvider & { readonly calls: CurrentAudioGenerationSpec[] } {
    const calls: CurrentAudioGenerationSpec[] = [];
    return {
        calls,
        async generate(spec) {
            calls.push(spec);
            events.push(`provider:${spec.key}`);
            const outcome = outcomes.shift();
            if (outcome instanceof Error) throw outcome;
            return outcome ?? candidate();
        },
    };
}

function deps(
    store: RunDependencies['store'],
    provider: AudioGenerationProvider
): RunDependencies {
    return { store, provider, apiKey: 'test-secret' };
}

async function makeRealStore() {
    const root = await mkdtemp(join(tmpdir(), 'audio-generation-run-'));
    roots.push(root);
    return {
        root,
        store: new LocalAudioGenerationStore({
            root,
            storyId: 'the_seventh_mirror',
        }),
    };
}

async function planFor(
    assets: readonly AudioPlanAsset[],
    store: LocalAudioGenerationStore,
    options: {
        readonly keys?: readonly string[];
        readonly missing?: boolean;
        readonly candidateCount?: number;
        readonly maxRequests?: number;
        readonly dryRun?: boolean;
    } = {}
): Promise<AudioGenerationPlan> {
    return planAudioGeneration({
        context: contextFor(assets),
        store,
        ...options,
    });
}

describe('audio generation story context and planner', () => {
    it('loads the Seventh Mirror story folder through its runtime story id', async () => {
        const context =
            await loadAudioGenerationStoryContext('theSeventhMirror');

        expect(context.storyFolder).toBe('theSeventhMirror');
        expect(context.storyId).toBe('the_seventh_mirror');
        expect(context.plan.assets).toHaveLength(41);
    });

    it('keeps explicit keys in plan order', async () => {
        const assets = [sfx('first'), sfx('second'), sfx('third')];
        const store = planningStore();

        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            keys: ['third', 'first'],
            candidateCount: 1,
            maxRequests: 100,
        });

        expect(plan.scheduledRequests.map(request => request.key)).toEqual([
            'first',
            'third',
        ]);
    });

    it('uses every plan row for --missing in plan order', async () => {
        const assets = [sfx('first'), bgm('second'), sfx('third')];
        const store = planningStore();

        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 100,
        });

        expect(plan.scheduledRequests.map(request => request.key)).toEqual([
            'first',
            'second',
            'third',
        ]);
    });

    it('treats candidate count as the desired total current-spec success count', async () => {
        const assets = [sfx('first')];
        const store = planningStore({ first: 1 });

        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            keys: ['first'],
            candidateCount: 2,
            maxRequests: 100,
        });

        expect(plan.scheduledRequests).toHaveLength(1);
        expect(plan.scheduledRequests[0]?.key).toBe('first');
    });

    it('does not count an old-spec success toward the desired count', async () => {
        const { store } = await makeRealStore();
        const oldSpec = buildAudioGenerationSpec({
            ...sfx('first'),
            prompt: 'old prompt',
        });

        await store.writeSuccess({
            candidateId: 'candidate-001',
            spec: oldSpec,
            specSha256: audioGenerationSpecSha256(oldSpec),
            generated: candidate(),
        });

        const plan = await planFor([sfx('first')], store, {
            keys: ['first'],
            candidateCount: 1,
            maxRequests: 100,
        });

        expect(plan.scheduledRequests.map(request => request.key)).toEqual([
            'first',
        ]);
    });

    it('blocks all paid work and propagates every provider issue', async () => {
        const assets: AudioPlanAsset[] = [
            { key: 'too-short', type: 'sfx', prompt: 'x', durationMs: 400 },
            { key: 'too-long', type: 'sfx', prompt: 'y', durationMs: 30_001 },
            {
                key: 'tiny-music',
                type: 'bgm',
                prompt: 'z',
                durationMs: 2_999,
                loop: true,
            },
        ];
        const store = planningStore();

        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 100,
        });

        expect(plan.providerIssues.map(issue => issue.key)).toEqual([
            'too-short',
            'too-long',
            'tiny-music',
        ]);
        expect(plan.scheduledRequests).toEqual([]);
        expect(plan.estimate.costUsd).toBe(0);
    });

    it('takes a deterministic prefix under the logical request cap', async () => {
        const assets = [sfx('first'), sfx('second'), sfx('third')];
        const store = planningStore();

        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 2,
        });

        expect(plan.scheduledRequests.map(request => request.key)).toEqual([
            'first',
            'second',
        ]);
        expect(plan.remaining).toEqual([{ key: 'third', count: 1 }]);
    });

    it('reports a capped run as successful while retaining the remainder', async () => {
        const assets = [sfx('first'), sfx('second')];
        const store = fakeRunStore();
        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 1,
        });
        const provider = fakeProvider([candidate()], store.events);

        const result = await runAudioGeneration(plan, deps(store, provider));

        expect(result.success).toBe(true);
        expect(result.remaining).toEqual([{ key: 'second', count: 1 }]);
    });

    it('does not mutate the store or call the provider for a dry run', async () => {
        const assets = [sfx('first')];
        const store = fakeRunStore();
        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            missing: true,
            candidateCount: 1,
            dryRun: true,
        });
        const provider = fakeProvider([candidate()], store.events);

        await expect(
            runAudioGeneration(plan, deps(store, provider))
        ).resolves.toMatchObject({
            success: true,
            completedRequests: 0,
        });
        expect(provider.calls).toEqual([]);
        expect(store.events).toEqual([]);
        expect(store.writeSuccess).not.toHaveBeenCalled();
        expect(store.writeFailureMarker).not.toHaveBeenCalled();
    });

    it('estimates the repeated scheduled spec list, not unique keys', async () => {
        const assets = [sfx('first')];
        const store = planningStore();

        const plan = await planAudioGeneration({
            context: contextFor(assets),
            store,
            keys: ['first'],
            candidateCount: 2,
            maxRequests: 100,
        });

        expect(plan.scheduledRequests).toHaveLength(2);
        expect(plan.estimate.scheduledRequestCount).toBe(2);
        expect(plan.estimate.costUsd).toBeCloseTo(0.004, 8);
    });
});

describe('audio generation sequential runner', () => {
    it('executes requests one at a time and persists each success before the next call', async () => {
        const store = fakeRunStore();
        const provider = fakeProvider([candidate(), candidate()], store.events);
        const plan = await planAudioGeneration({
            context: contextFor([sfx('first'), sfx('second')]),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 2,
        });

        await runAudioGeneration(plan, deps(store, provider));

        expect(store.events).toEqual([
            'provider:first',
            'persist:candidate-001',
            'provider:second',
            'persist:candidate-002',
        ]);
    });

    it('writes the final provider failure marker and stops before the next request', async () => {
        const store = fakeRunStore();
        const provider = fakeProvider(
            [
                candidate(),
                new ElevenLabsProviderError(
                    'non-retryable-status',
                    'provider failed',
                    400
                ),
                candidate(),
            ],
            store.events
        );
        const plan = await planAudioGeneration({
            context: contextFor([sfx('first'), sfx('second'), sfx('third')]),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 3,
        });

        await expect(
            runAudioGeneration(plan, deps(store, provider))
        ).rejects.toThrow('provider failed');
        expect(provider.calls.map(spec => spec.key)).toEqual([
            'first',
            'second',
        ]);
        expect(store.events).toEqual([
            'provider:first',
            'persist:candidate-001',
            'provider:second',
            'failure:candidate-002',
        ]);
        expect(store.failureMarkers[0]).toMatchObject({
            candidateId: 'candidate-002',
            spec: expect.objectContaining({ key: 'second' }),
        });
        expect(store.writeFailureMarker).toHaveBeenCalledWith(
            expect.objectContaining({
                failure: {
                    kind: 'non-retryable-status',
                    status: 400,
                    message: 'provider failed',
                },
            })
        );
    });

    it('allocates the next ordinal on the next run after a final failure', async () => {
        const { root, store } = await makeRealStore();
        const firstPlan = await planFor([sfx('first')], store, {
            keys: ['first'],
            candidateCount: 1,
            maxRequests: 1,
        });
        const firstProvider: AudioGenerationProvider = {
            async generate() {
                throw new ElevenLabsProviderError(
                    'retryable-status',
                    'temporary outage',
                    503
                );
            },
        };

        await expect(
            runAudioGeneration(firstPlan, deps(store, firstProvider))
        ).rejects.toThrow('temporary outage');

        const secondPlan = await planFor([sfx('first')], store, {
            keys: ['first'],
            candidateCount: 1,
            maxRequests: 1,
        });
        const secondProvider: AudioGenerationProvider = {
            async generate() {
                return candidate();
            },
        };

        await runAudioGeneration(secondPlan, deps(store, secondProvider));

        await expect(
            readFile(join(root, 'first', 'candidate-001.failure.json'), 'utf8')
        ).resolves.toContain('temporary outage');
        await expect(
            store.readVerifiedCandidate('first', 'candidate-002')
        ).resolves.toMatchObject({ candidateId: 'candidate-002' });
    });

    it('does not regenerate a matching verified success', async () => {
        const { store } = await makeRealStore();
        const spec = buildAudioGenerationSpec(sfx('first'));
        await store.writeSuccess({
            candidateId: 'candidate-001',
            spec,
            specSha256: audioGenerationSpecSha256(spec),
            generated: candidate(),
        });
        const plan = await planFor([sfx('first')], store, {
            keys: ['first'],
            candidateCount: 1,
            maxRequests: 1,
        });
        const provider = fakeProvider([candidate()]);

        const result = await runAudioGeneration(plan, deps(store, provider));

        expect(result.completedRequests).toBe(0);
        expect(provider.calls).toEqual([]);
    });

    it('does not invoke the provider when candidate verification fails', async () => {
        const { root, store } = await makeRealStore();
        const spec = buildAudioGenerationSpec(sfx('first'));
        const receipt = await store.writeSuccess({
            candidateId: 'candidate-001',
            spec,
            specSha256: audioGenerationSpecSha256(spec),
            generated: candidate(),
        });
        const audioPath = join(root, spec.key, receipt.output.filename);
        await chmod(audioPath, 0o000);
        const provider = fakeProvider([candidate()]);

        try {
            await expect(
                planFor([sfx('first')], store, {
                    keys: ['first'],
                    candidateCount: 1,
                    maxRequests: 1,
                })
            ).rejects.toMatchObject({ code: 'EACCES' });
            expect(provider.calls).toEqual([]);
        } finally {
            await chmod(audioPath, 0o644);
        }
    });

    it('requires music terms before the first real BGM call', async () => {
        const store = fakeRunStore({ hasMusicTermsNote: false });
        const provider = fakeProvider([candidate(), candidate()], store.events);
        const plan = await planAudioGeneration({
            context: contextFor([bgm('music'), bgm('music-two')]),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 2,
        });

        await expect(
            runAudioGeneration(plan, deps(store, provider))
        ).rejects.toThrow('music-terms-note');

        expect(store.hasMusicTermsNote).toHaveBeenCalledTimes(1);
        expect(provider.calls).toEqual([]);
    });

    it('checks music terms only once across multiple BGM requests', async () => {
        const store = fakeRunStore();
        const provider = fakeProvider([candidate(), candidate()], store.events);
        const plan = await planAudioGeneration({
            context: contextFor([bgm('music'), bgm('music-two')]),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 2,
        });

        await runAudioGeneration(plan, deps(store, provider));

        expect(store.hasMusicTermsNote).toHaveBeenCalledTimes(1);
        expect(provider.calls.map(spec => spec.key)).toEqual([
            'music',
            'music-two',
        ]);
    });

    it('does not retry a Ctrl-C-like thrown error or disturb earlier success', async () => {
        const store = fakeRunStore();
        const interrupt = new Error('interrupt');
        const provider = fakeProvider([candidate(), interrupt], store.events);
        const plan = await planAudioGeneration({
            context: contextFor([sfx('first'), sfx('second')]),
            store,
            missing: true,
            candidateCount: 1,
            maxRequests: 2,
        });

        await expect(
            runAudioGeneration(plan, deps(store, provider))
        ).rejects.toBe(interrupt);
        expect(provider.calls.map(spec => spec.key)).toEqual([
            'first',
            'second',
        ]);
        expect(store.events).toEqual([
            'provider:first',
            'persist:candidate-001',
            'provider:second',
        ]);
        expect(store.failureMarkers).toEqual([]);
    });
});
