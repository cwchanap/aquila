import {
    AssetResolverError,
    type AssetFallbackReason,
    type AssetResolutionResult,
    type AssetResolver,
    type LogicalAssetIdentity,
    type ResolvedAsset,
    type ValidatedAssetRelease,
} from '@aquila/stories/runtime-assets';
import type {
    DialogueEntry,
    StoryFlowConfig,
    StoryPresentationMetadata,
} from '@aquila/stories';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DecodedAsset, VisualSnapshot } from '../types';
import {
    VisualStateController,
    type VisualControllerInput,
} from '../visual-state-controller';

const storyId = 'the_seventh_mirror';
const presentation: StoryPresentationMetadata = {
    portrait: {
        activeLimit: 1,
        defaultSlot: 'right',
        slotsByCharacterId: {
            mio: 'left',
            yuma: 'right',
        },
    },
};
const linearFlow = {
    start: 'scene',
    nodes: [
        { kind: 'scene', id: 'scene', sceneId: 'scene', next: 'next' },
        { kind: 'scene', id: 'next', sceneId: 'next', next: 'after_next' },
        {
            kind: 'scene',
            id: 'after_next',
            sceneId: 'after_next',
            next: null,
        },
    ],
} as unknown as StoryFlowConfig;

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

function decoded(key: string): DecodedAsset {
    return {
        cacheKey: `webp:sha-${key}`,
        objectUrl: `blob:${key}`,
        byteLength: 10,
        width: 1600,
        height: 900,
        decodedBytes: 5_760_000,
    };
}

function resolved(identity: LogicalAssetIdentity): ResolvedAsset {
    return {
        status: 'resolved',
        asset: {
            identity,
            width: 1600,
            height: 900,
            variants: {
                webp: {
                    format: 'webp',
                    path: `vn/objects/${identity.key}.webp`,
                    sha256: `sha-${identity.key}`,
                    byteLength: 10,
                },
            },
        },
        webpUrl: new URL(`https://assets.example/${identity.key}.webp`),
    } as ResolvedAsset;
}

function fallback(
    identity: LogicalAssetIdentity,
    reason: AssetFallbackReason
): AssetResolutionResult {
    const code =
        reason === 'not-found'
            ? 'not-found'
            : reason === 'release-unavailable'
              ? 'unavailable'
              : reason === 'integrity-failure'
                ? 'integrity'
                : 'validation';
    return {
        status: 'fallback',
        identity,
        reason,
        error: new AssetResolverError(code, reason),
    };
}

function release(source: 'network' | 'last-validated-release' = 'network') {
    return {
        pointer: { releaseId: 'sha256-fixed-release' },
        manifest: {},
        validatedAt: '2026-07-26T00:00:00.000Z',
        source,
    } as ValidatedAssetRelease;
}

function createHarness(options?: {
    loadRelease?: () => Promise<ValidatedAssetRelease>;
    loadAsset?: (asset: ResolvedAsset) => Promise<DecodedAsset>;
    resolveAsset?: (identity: LogicalAssetIdentity) => AssetResolutionResult;
    now?: () => number;
    sceneDialogue?: Record<string, readonly DialogueEntry[] | null>;
}) {
    const resolveAsset =
        options?.resolveAsset ??
        ((identity: LogicalAssetIdentity) => resolved(identity));
    const resolver: AssetResolver = {
        source: {
            environment: 'local',
            storyId,
            baseUrl: 'https://assets.example/',
            target: { kind: 'preview', previewId: 'hpa-228-test' },
        },
        loadActiveRelease: vi.fn(
            options?.loadRelease ?? (async () => release())
        ),
        resolve: vi.fn(resolveAsset),
        prefetchNextEdge: vi.fn(async request => ({
            requested: request.assets.length,
            cached: request.assets.length,
            failed: [],
        })),
        clear: vi.fn(),
    };
    const cache = {
        load: vi.fn(
            options?.loadAsset ??
                (async asset => decoded(asset.asset.identity.key))
        ),
        prefetch: vi.fn(async () => {}),
        setProtectedKeys: vi.fn(),
    };
    const getSceneDialogue = vi.fn(
        (_requestedStoryId: string, sceneId: string) =>
            options?.sceneDialogue?.[sceneId] ?? null
    );
    const controller = new VisualStateController({
        resolver,
        cache,
        getSceneDialogue,
        now: options?.now,
    });
    const snapshots: VisualSnapshot[] = [];
    controller.subscribe(snapshot => snapshots.push(snapshot));
    return {
        cache,
        controller,
        getSceneDialogue,
        latest: () => snapshots.at(-1)!,
        resolver,
        snapshots,
    };
}

function input(
    dialogue: readonly DialogueEntry[],
    overrides: Partial<VisualControllerInput> = {}
): VisualControllerInput {
    return {
        storyId,
        sceneId: 'scene',
        dialogue,
        dialogueIndex: 0,
        flow: linearFlow,
        presentation,
        ...overrides,
    };
}

async function flushAsyncWork(): Promise<void> {
    for (let index = 0; index < 8; index += 1) {
        await Promise.resolve();
    }
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('VisualStateController', () => {
    it('starts with an immutable neutral background and no portrait', () => {
        const { latest } = createHarness();

        expect(latest()).toEqual({
            release: 'idle',
            activeBackground: {
                state: 'omitted',
                identity: null,
                objectUrl: null,
                width: null,
                height: null,
            },
            stagingBackground: {
                state: 'omitted',
                identity: null,
                objectUrl: null,
                width: null,
                height: null,
            },
            portrait: {
                state: 'omitted',
                identity: null,
                objectUrl: null,
                width: null,
                height: null,
                slot: 'center',
            },
            status: null,
        });
        expect(Object.isFrozen(latest())).toBe(true);
        expect(Object.isFrozen(latest().activeBackground)).toBe(true);
    });

    it('maps omitted, missing, and failed keyed visuals independently', async () => {
        const { controller, latest } = createHarness({
            resolveAsset: identity => {
                if (identity.key === 'missing') {
                    return fallback(identity, 'not-found');
                }
                if (identity.key === 'unavailable') {
                    return fallback(identity, 'release-unavailable');
                }
                return resolved(identity);
            },
        });

        controller.update(input([{ dialogue: 'No visuals' }]));
        await flushAsyncWork();
        expect(latest().stagingBackground.state).toBe('omitted');
        expect(latest().portrait.state).toBe('omitted');
        expect(latest().status).toBeNull();

        controller.update(
            input([{ dialogue: 'Missing', background: 'missing' }])
        );
        await flushAsyncWork();
        expect(latest().release).toBe('ready');
        expect(latest().stagingBackground.state).toBe('missing');
        expect(latest().status).toBe('fallback');

        controller.update(
            input([{ dialogue: 'Unavailable', portrait: 'unavailable' }])
        );
        await flushAsyncWork();
        expect(latest().release).toBe('unavailable');
        expect(latest().portrait.state).toBe('failed');
        expect(latest().status).toBe('unavailable');
    });

    it('keeps omitted lines neutral and marks keyed lines unavailable without a source', async () => {
        const cache = {
            load: vi.fn(),
            prefetch: vi.fn(),
            setProtectedKeys: vi.fn(),
        };
        const controller = new VisualStateController({
            resolver: null,
            cache: cache,
            getSceneDialogue: vi.fn(() => null),
        });
        const snapshots: VisualSnapshot[] = [];
        controller.subscribe(snapshot => snapshots.push(snapshot));
        const latest = () => snapshots.at(-1)!;

        controller.update(input([{ dialogue: 'Intentionally omitted' }]));
        await flushAsyncWork();
        expect(latest().release).toBe('idle');
        expect(latest().stagingBackground.state).toBe('omitted');
        expect(latest().portrait.state).toBe('omitted');
        expect(latest().status).toBeNull();

        controller.update(
            input([
                {
                    dialogue: 'Authored visuals without a source',
                    background: 'room',
                    portrait: 'speaker/base',
                },
            ])
        );
        await flushAsyncWork();
        expect(latest().release).toBe('unavailable');
        expect(latest().stagingBackground.state).toBe('failed');
        expect(latest().portrait.state).toBe('failed');
        expect(latest().status).toBe('unavailable');

        controller.update(input([{ dialogue: 'Omitted again' }]));
        await flushAsyncWork();
        expect(latest().release).toBe('idle');
        expect(latest().status).toBeNull();
        expect(cache.load).not.toHaveBeenCalled();
        expect(cache.prefetch).not.toHaveBeenCalled();
    });

    it('maps an invalid release fallback to invalid plus a failed layer', async () => {
        const { controller, latest } = createHarness({
            loadRelease: async () => {
                throw new AssetResolverError(
                    'integrity',
                    'Manifest checksum mismatch'
                );
            },
        });

        controller.update(
            input([{ dialogue: 'Broken release', background: 'room' }])
        );
        await flushAsyncWork();

        expect(latest().release).toBe('invalid');
        expect(latest().stagingBackground.state).toBe('failed');
        expect(latest().status).toBe('unavailable');
    });

    it('keeps stale release state while a layer is ready', async () => {
        const { controller, latest } = createHarness({
            loadRelease: async () => release('last-validated-release'),
        });

        controller.update(
            input([{ dialogue: 'Cached release', background: 'room' }])
        );
        await flushAsyncWork();

        expect(latest().release).toBe('stale-but-usable');
        expect(latest().activeBackground.state).toBe('ready');
        expect(latest().status).toBe('stale');
    });

    it('retains the active background when staging fails', async () => {
        const { controller, latest } = createHarness({
            loadAsset: async asset => {
                if (asset.asset.identity.key === 'broken') {
                    throw new AssetResolverError('integrity', 'bad bytes');
                }
                return decoded(asset.asset.identity.key);
            },
        });
        controller.update(input([{ dialogue: 'First', background: 'first' }]));
        await flushAsyncWork();
        const first = latest().activeBackground.objectUrl;

        controller.update(
            input([{ dialogue: 'Broken', background: 'broken' }])
        );
        await flushAsyncWork();

        expect(first).toBe('blob:first');
        expect(latest().activeBackground.objectUrl).toBe(first);
        expect(latest().stagingBackground.state).toBe('failed');
    });

    it('keeps the old active background until the view commits the transition', async () => {
        const { controller, latest } = createHarness();
        controller.update(input([{ dialogue: 'First', background: 'first' }]));
        await flushAsyncWork();
        const first = latest().activeBackground.objectUrl;

        controller.update(
            input([{ dialogue: 'Second', background: 'second' }])
        );
        await flushAsyncWork();

        expect(latest().activeBackground.objectUrl).toBe(first);
        expect(latest().stagingBackground.state).toBe('ready');
        controller.commitBackgroundTransition();
        expect(latest().activeBackground.identity).toBe('background:second');
        expect(latest().stagingBackground.state).toBe('omitted');
    });

    it('stops protecting abandoned staging when returning to the active background', async () => {
        const { cache, controller, latest } = createHarness();
        controller.update(input([{ dialogue: 'First', background: 'first' }]));
        await flushAsyncWork();
        controller.update(
            input([{ dialogue: 'Second', background: 'second' }])
        );
        await flushAsyncWork();
        expect(latest().stagingBackground.identity).toBe('background:second');
        expect(cache.setProtectedKeys).toHaveBeenLastCalledWith(
            new Set(['webp:sha-first', 'webp:sha-second'])
        );

        controller.update(input([{ dialogue: 'Back', background: 'first' }]));
        await flushAsyncWork();

        expect(latest().stagingBackground.state).toBe('omitted');
        expect(cache.setProtectedKeys).toHaveBeenLastCalledWith(
            new Set(['webp:sha-first'])
        );
    });

    it('ignores late decode completion from an older line generation', async () => {
        const slow = deferred<DecodedAsset>();
        const { controller, latest } = createHarness({
            loadAsset: asset =>
                asset.asset.identity.key === 'slow'
                    ? slow.promise
                    : Promise.resolve(decoded(asset.asset.identity.key)),
        });
        const dialogue = [
            { dialogue: 'Slow', background: 'slow' },
            { dialogue: 'Fast', background: 'fast' },
        ];

        controller.update(input(dialogue));
        await flushAsyncWork();
        controller.update(input(dialogue, { dialogueIndex: 1 }));
        await flushAsyncWork();
        slow.resolve(decoded('slow'));
        await flushAsyncWork();

        expect(latest().activeBackground.identity).toBe('background:fast');
        expect(latest().stagingBackground.identity).not.toBe('background:slow');
    });

    it('removes the prior portrait before a replacement finishes decoding', async () => {
        const slow = deferred<DecodedAsset>();
        const { controller, latest } = createHarness({
            loadAsset: asset =>
                asset.asset.identity.key === 'slow'
                    ? slow.promise
                    : Promise.resolve(decoded(asset.asset.identity.key)),
        });
        const dialogue = [
            {
                dialogue: 'Mio',
                characterId: 'mio',
                portrait: 'mio-base',
            },
            { dialogue: 'Yuma', characterId: 'yuma', portrait: 'slow' },
        ];
        controller.update(input(dialogue));
        await flushAsyncWork();
        expect(latest().portrait.objectUrl).toBe('blob:mio-base');

        controller.update(input(dialogue, { dialogueIndex: 1 }));
        await flushAsyncWork();

        expect(latest().portrait.state).toBe('loading');
        expect(latest().portrait.objectUrl).toBeNull();
        expect(latest().portrait.slot).toBe('right');
    });

    it.each([
        ['mio', presentation, 'left'],
        ['yuma', presentation, 'right'],
        ['unassigned', presentation, 'right'],
        ['unassigned', null, 'center'],
    ] as const)(
        'places character %s in its deterministic portrait slot',
        async (characterId, metadata, expectedSlot) => {
            const { controller, latest } = createHarness();
            controller.update(
                input(
                    [
                        {
                            dialogue: 'Portrait',
                            characterId,
                            portrait: 'portrait',
                        },
                    ],
                    { presentation: metadata }
                )
            );
            await flushAsyncWork();

            expect(latest().portrait.state).toBe('ready');
            expect(latest().portrait.slot).toBe(expectedSlot);
        }
    );

    it('detaches a URL from every layer and resolves after the next animation frame', async () => {
        let frameCallback: FrameRequestCallback | undefined;
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((callback: FrameRequestCallback) => {
                frameCallback = callback;
                return 1;
            })
        );
        const { controller, latest } = createHarness({
            loadAsset: async () => ({
                ...decoded('shared'),
                objectUrl: 'blob:shared',
            }),
        });
        const dialogue = [
            {
                dialogue: 'First',
                background: 'first',
                portrait: 'portrait',
            },
            { dialogue: 'Second', background: 'second' },
        ];
        controller.update(input(dialogue));
        await flushAsyncWork();
        controller.update(input(dialogue, { dialogueIndex: 1 }));
        await flushAsyncWork();
        expect(latest().activeBackground.objectUrl).toBe('blob:shared');
        expect(latest().stagingBackground.objectUrl).toBe('blob:shared');

        let detached = false;
        const pending = controller
            .detachObjectUrl('blob:shared')
            .then(() => (detached = true));

        expect(latest().activeBackground.objectUrl).toBeNull();
        expect(latest().stagingBackground.objectUrl).toBeNull();
        expect(latest().portrait.objectUrl).toBeNull();
        await Promise.resolve();
        expect(detached).toBe(false);
        frameCallback?.(0);
        await pending;
        expect(detached).toBe(true);
    });

    it('detaches a URL through the setTimeout fallback when requestAnimationFrame is undefined', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', undefined);
        try {
            const { controller, latest } = createHarness();
            controller.update(input([{ dialogue: 'x', background: 'room' }]));
            await flushAsyncWork();
            const url = latest().activeBackground.objectUrl;
            expect(url).not.toBeNull();

            let detached = false;
            const pending = controller
                .detachObjectUrl(url!)
                .then(() => (detached = true));

            expect(latest().activeBackground.objectUrl).toBeNull();
            await Promise.resolve();
            expect(detached).toBe(false);

            await vi.advanceTimersByTimeAsync(0);
            await pending;
            expect(detached).toBe(true);
        } finally {
            vi.unstubAllGlobals();
            vi.useRealTimers();
        }
    });

    it('soft revalidates only after the last pointer check is 60 seconds old', async () => {
        let now = 1_000;
        const { controller, resolver } = createHarness({ now: () => now });
        controller.update(input([{ dialogue: 'Visual', background: 'room' }]));
        await flushAsyncWork();
        expect(resolver.loadActiveRelease).toHaveBeenCalledTimes(1);

        now = 60_999;
        await controller.softRevalidate();
        expect(resolver.loadActiveRelease).toHaveBeenCalledTimes(1);

        now = 61_000;
        await controller.softRevalidate();
        expect(resolver.loadActiveRelease).toHaveBeenCalledTimes(2);
    });

    it('does not claim a stale release after revalidation fails without any usable release', async () => {
        let now = 0;
        const { controller, latest, resolver } = createHarness({
            loadRelease: async () => {
                throw new AssetResolverError('network', 'offline');
            },
            now: () => now,
        });
        controller.update(
            input([{ dialogue: 'Unavailable', background: 'room' }])
        );
        await flushAsyncWork();
        expect(latest().release).toBe('unavailable');

        now = 30_000;
        controller.update(
            input([{ dialogue: 'Still unavailable', background: 'room-two' }])
        );
        await flushAsyncWork();
        expect(resolver.loadActiveRelease).toHaveBeenCalledTimes(1);

        now = 60_000;
        await controller.softRevalidate();

        expect(resolver.loadActiveRelease).toHaveBeenCalledTimes(2);
        expect(latest().release).toBe('unavailable');
        expect(latest().status).toBe('unavailable');
    });

    it('retries the current visual after a successful soft revalidation', async () => {
        let now = 0;
        let attempts = 0;
        const { controller, latest } = createHarness({
            loadRelease: async () => {
                attempts += 1;
                if (attempts === 1) {
                    throw new AssetResolverError('network', 'offline');
                }
                return release();
            },
            now: () => now,
        });
        controller.update(
            input([{ dialogue: 'Recoverable', background: 'room' }])
        );
        await flushAsyncWork();
        expect(latest().stagingBackground.state).toBe('failed');

        now = 60_000;
        await controller.softRevalidate();
        await flushAsyncWork();

        expect(latest().release).toBe('ready');
        expect(latest().activeBackground.objectUrl).toBe('blob:room');
        expect(latest().status).toBeNull();
    });

    it('reloads the current background and portrait when a revalidation activates a new release', async () => {
        let now = 0;
        let firstLoad = true;
        const loadRelease = vi.fn(async () => {
            const releaseId = firstLoad
                ? 'sha256-release-v1'
                : 'sha256-release-v2';
            firstLoad = false;
            return {
                pointer: { releaseId },
                manifest: {},
                validatedAt: '2026-07-26T00:00:00.000Z',
                source: 'network',
            } as ValidatedAssetRelease;
        });
        const { cache, controller, latest } = createHarness({
            loadRelease,
            now: () => now,
        });
        controller.update(
            input([
                {
                    dialogue: 'Same identity',
                    background: 'room',
                    portrait: 'mio/base',
                    characterId: 'mio',
                },
            ])
        );
        await flushAsyncWork();
        expect(latest().activeBackground.state).toBe('ready');
        expect(latest().portrait.state).toBe('ready');
        const initialLoadCalls = (cache.load as ReturnType<typeof vi.fn>).mock
            .calls.length;

        now = 70_000;
        await controller.softRevalidate();
        await flushAsyncWork();

        // The logical identity is unchanged but the release ID changed, so the
        // controller must request the new variant from the cache rather than
        // treating the old Blob URL as current.
        expect(
            (cache.load as ReturnType<typeof vi.fn>).mock.calls.length
        ).toBeGreaterThan(initialLoadCalls);
        expect(latest().release).toBe('ready');
    });

    it('rejects an older-release background load that completes after a refresh', async () => {
        let now = 0;
        let firstLoad = true;
        const v1Decode = deferred<DecodedAsset>();
        let roomBLoadCount = 0;
        const loadRelease = vi.fn(async () => {
            const releaseId = firstLoad ? 'sha256-v1' : 'sha256-v2';
            firstLoad = false;
            return {
                pointer: { releaseId },
                manifest: {},
                validatedAt: '2026-07-26T00:00:00.000Z',
                source: 'network',
            } as ValidatedAssetRelease;
        });
        const loadAsset = vi.fn(async (asset: ResolvedAsset) => {
            const key = asset.asset.identity.key;
            if (key === 'room-b') {
                roomBLoadCount += 1;
                if (roomBLoadCount === 1) {
                    return v1Decode.promise;
                }
                return {
                    ...decoded(key),
                    objectUrl: `blob:v2-${key}`,
                    cacheKey: `webp:sha-v2-${key}`,
                };
            }
            return decoded(key);
        });
        const { controller, latest } = createHarness({
            loadRelease,
            loadAsset,
            now: () => now,
        });
        const dialogue = [
            { dialogue: 'Room A', background: 'room-a' },
            { dialogue: 'Room B', background: 'room-b' },
        ];

        // Display room-a as the active background.
        controller.update(input(dialogue));
        await flushAsyncWork();
        expect(latest().activeBackground.objectUrl).toBe('blob:room-a');

        // Advance to room-b. V1 load starts for room-b (deferred).
        controller.update(input(dialogue, { dialogueIndex: 1 }));
        await flushAsyncWork();

        // Soft-revalidate activates V2 and starts a V2 load for room-b
        // that completes immediately, populating staging.
        now = 70_000;
        await controller.softRevalidate();
        await flushAsyncWork();
        expect(latest().stagingBackground.state).toBe('ready');
        expect(latest().stagingBackground.objectUrl).toBe('blob:v2-room-b');

        // The older V1 load completes last. It must not overwrite V2 staging.
        v1Decode.resolve({
            ...decoded('room-b'),
            objectUrl: 'blob:v1-room-b',
            cacheKey: 'webp:sha-v1-room-b',
        });
        await flushAsyncWork();

        expect(latest().stagingBackground.objectUrl).toBe('blob:v2-room-b');

        // Committing the transition must activate V2, not V1.
        controller.commitBackgroundTransition();
        expect(latest().activeBackground.objectUrl).toBe('blob:v2-room-b');
    });

    it('reloads a background under the new release after an omitted line clears the refresh flag', async () => {
        let now = 0;
        let firstLoad = true;
        let roomLoadCount = 0;
        const loadRelease = vi.fn(async () => {
            const releaseId = firstLoad ? 'sha256-v1' : 'sha256-v2';
            firstLoad = false;
            return {
                pointer: { releaseId },
                manifest: {},
                validatedAt: '2026-07-26T00:00:00.000Z',
                source: 'network',
            } as ValidatedAssetRelease;
        });
        const loadAsset = vi.fn(async (asset: ResolvedAsset) => {
            const key = asset.asset.identity.key;
            if (key === 'room') {
                roomLoadCount += 1;
                if (roomLoadCount === 1) {
                    return decoded(key);
                }
                return {
                    ...decoded(key),
                    objectUrl: `blob:v2-${key}`,
                    cacheKey: `webp:sha-v2-${key}`,
                };
            }
            return decoded(key);
        });
        const { cache, controller, latest } = createHarness({
            loadRelease,
            loadAsset,
            now: () => now,
        });
        const dialogue = [
            { dialogue: 'Room', background: 'room' },
            { dialogue: 'No background' },
            { dialogue: 'Room again', background: 'room' },
        ];

        // Display room under V1.
        controller.update(input(dialogue));
        await flushAsyncWork();
        expect(latest().activeBackground.objectUrl).toBe('blob:room');

        // Soft-revalidate activates V2. V2 'room' loads to staging
        // (active is already ready with V1 'room').
        now = 70_000;
        await controller.softRevalidate();
        await flushAsyncWork();
        expect(latest().stagingBackground.state).toBe('ready');
        expect(latest().stagingBackground.objectUrl).toBe('blob:v2-room');

        // Advance to the omitted line (no background). Staging is cleared.
        controller.update(input(dialogue, { dialogueIndex: 1 }));
        await flushAsyncWork();
        expect(latest().stagingBackground.state).toBe('omitted');
        const loadCallsAfterOmit = (cache.load as ReturnType<typeof vi.fn>).mock
            .calls.length;

        // Return to the same logical background. The controller must reload
        // under V2 rather than treating the old V1 layer as current.
        controller.update(input(dialogue, { dialogueIndex: 2 }));
        await flushAsyncWork();

        expect(
            (cache.load as ReturnType<typeof vi.fn>).mock.calls.length
        ).toBeGreaterThan(loadCallsAfterOmit);
        expect(latest().stagingBackground.state).toBe('ready');
        expect(latest().stagingBackground.objectUrl).toBe('blob:v2-room');
    });

    it('warms the next distinct within-scene visual through resolve and cache prefetch', async () => {
        const { cache, controller, resolver } = createHarness();
        controller.update(
            input([
                { dialogue: 'First', background: 'room-a' },
                { dialogue: 'Same', background: 'room-a' },
                {
                    dialogue: 'Next visual',
                    background: 'room-b',
                    portrait: 'mio-base',
                },
            ])
        );
        await flushAsyncWork();

        expect(resolver.resolve).toHaveBeenCalledWith({
            type: 'background',
            key: 'room-b',
        });
        expect(resolver.resolve).toHaveBeenCalledWith({
            type: 'portrait',
            key: 'mio-base',
        });
        expect(cache.prefetch).toHaveBeenCalledWith(
            expect.objectContaining({
                asset: expect.objectContaining({
                    identity: { type: 'background', key: 'room-b' },
                }),
            })
        );
    });

    it('drops within-scene warming that becomes stale while queued', async () => {
        const firstPrefetch = deferred<void>();
        const secondPrefetch = deferred<void>();
        const terminalFlow = {
            start: 'terminal',
            nodes: [
                {
                    kind: 'scene',
                    id: 'terminal',
                    sceneId: 'terminal',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const { cache, controller } = createHarness();
        cache.prefetch
            .mockImplementationOnce(() => firstPrefetch.promise)
            .mockImplementationOnce(() => secondPrefetch.promise);
        controller.update(
            input([
                { dialogue: 'Current', background: 'current-a' },
                {
                    dialogue: 'Occupies both permits',
                    background: 'warm-a',
                    portrait: 'warm-b',
                },
            ])
        );
        await flushAsyncWork();
        expect(cache.prefetch).toHaveBeenCalledTimes(2);

        controller.update(
            input([
                { dialogue: 'New current', background: 'current-b' },
                { dialogue: 'Queued stale warm', background: 'stale-warm' },
            ])
        );
        await flushAsyncWork();
        controller.update(
            input([{ dialogue: 'Navigated away' }], {
                sceneId: 'terminal',
                flow: terminalFlow,
            })
        );
        firstPrefetch.resolve();
        secondPrefetch.resolve();
        await flushAsyncWork();

        expect(cache.prefetch).not.toHaveBeenCalledWith(
            expect.objectContaining({
                asset: expect.objectContaining({
                    identity: { type: 'background', key: 'stale-warm' },
                }),
            })
        );
    });

    it('prefetches the first visual state across one linear edge', async () => {
        const { controller, getSceneDialogue, resolver } = createHarness({
            sceneDialogue: {
                next: [
                    { dialogue: 'No visual yet' },
                    { dialogue: 'First visual', background: 'next-room' },
                ],
                after_next: [
                    { dialogue: 'Too far', background: 'too-far-room' },
                ],
            },
        });

        controller.update(
            input([{ dialogue: 'Final', background: 'current-room' }])
        );
        await flushAsyncWork();

        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(1);
        expect(resolver.prefetchNextEdge).toHaveBeenCalledWith(
            expect.objectContaining({
                fromSceneId: 'scene',
                toSceneId: 'next',
                assets: [{ type: 'background', key: 'next-room' }],
            })
        );
        expect(getSceneDialogue).not.toHaveBeenCalledWith(
            storyId,
            'after_next'
        );
    });

    it('does not decode edge assets when navigation changes during edge prefetch', async () => {
        const edgePrefetch = deferred<{
            requested: number;
            cached: number;
            failed: [];
        }>();
        const terminalFlow = {
            start: 'terminal',
            nodes: [
                {
                    kind: 'scene',
                    id: 'terminal',
                    sceneId: 'terminal',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const { cache, controller, resolver } = createHarness({
            sceneDialogue: {
                next: [{ dialogue: 'Next', background: 'next-room' }],
            },
        });
        vi.mocked(resolver.prefetchNextEdge).mockImplementation(
            () => edgePrefetch.promise
        );
        controller.update(
            input([{ dialogue: 'Final', background: 'current-room' }])
        );
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(1);
        cache.prefetch.mockClear();

        controller.update(
            input([{ dialogue: 'Navigated away' }], {
                sceneId: 'terminal',
                flow: terminalFlow,
            })
        );
        edgePrefetch.resolve({ requested: 1, cached: 1, failed: [] });
        await flushAsyncWork();

        expect(cache.prefetch).not.toHaveBeenCalled();
    });

    it('warms a re-entered edge once while its older generation is still in flight', async () => {
        const oldEdgePrefetch = deferred<{
            requested: number;
            cached: number;
            failed: [];
        }>();
        const terminalFlow = {
            start: 'terminal',
            nodes: [
                {
                    kind: 'scene',
                    id: 'terminal',
                    sceneId: 'terminal',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const { cache, controller, resolver } = createHarness({
            sceneDialogue: {
                next: [{ dialogue: 'Next', background: 'next-room' }],
            },
        });
        vi.mocked(resolver.prefetchNextEdge)
            .mockImplementationOnce(() => oldEdgePrefetch.promise)
            .mockResolvedValue({
                requested: 1,
                cached: 1,
                failed: [],
            });
        const edgeInput = input([
            { dialogue: 'Final', background: 'current-room' },
        ]);
        controller.update(edgeInput);
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(1);

        controller.update(
            input([{ dialogue: 'Navigated away' }], {
                sceneId: 'terminal',
                flow: terminalFlow,
            })
        );
        controller.update(edgeInput);
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(2);

        oldEdgePrefetch.resolve({ requested: 1, cached: 1, failed: [] });
        await flushAsyncWork();

        expect(cache.prefetch).toHaveBeenCalledTimes(1);
        expect(cache.prefetch).toHaveBeenCalledWith(
            expect.objectContaining({
                asset: expect.objectContaining({
                    identity: { type: 'background', key: 'next-room' },
                }),
            })
        );
    });

    it('keeps an edge reservation retryable when prefetchNextEdge reports failures', async () => {
        const { controller, resolver } = createHarness({
            sceneDialogue: {
                next: [{ dialogue: 'Next', background: 'next-room' }],
            },
        });
        vi.mocked(resolver.prefetchNextEdge).mockResolvedValue({
            requested: 1,
            cached: 0,
            failed: [
                {
                    status: 'fallback',
                    identity: { type: 'background', key: 'next-room' },
                    reason: 'not-found',
                    error: new AssetResolverError('not-found', 'not-found'),
                },
            ],
        });

        const edgeInput = input([
            { dialogue: 'Final', background: 'current-room' },
        ]);
        controller.update(edgeInput);
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(1);

        controller.update(edgeInput);
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(2);
    });

    it('prefetches every immediate choice edge once but never a second edge', async () => {
        const flow = {
            start: 'choice_scene',
            nodes: [
                {
                    kind: 'scene',
                    id: 'choice_scene',
                    sceneId: 'choice_scene',
                    next: 'choice:route',
                },
                {
                    kind: 'choice',
                    id: 'choice:route',
                    choiceId: 'route',
                    nextByOption: { a: 'branch_a', b: 'branch_b' },
                },
                {
                    kind: 'scene',
                    id: 'branch_a',
                    sceneId: 'branch_a',
                    next: 'branch_a_next',
                },
                {
                    kind: 'scene',
                    id: 'branch_b',
                    sceneId: 'branch_b',
                    next: null,
                },
                {
                    kind: 'scene',
                    id: 'branch_a_next',
                    sceneId: 'branch_a_next',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const { controller, getSceneDialogue, resolver } = createHarness({
            sceneDialogue: {
                branch_a: [{ dialogue: 'A', background: 'branch-a-room' }],
                branch_b: [{ dialogue: 'B', portrait: 'branch-b-portrait' }],
                branch_a_next: [
                    { dialogue: 'Too far', background: 'too-far-room' },
                ],
            },
        });

        controller.update(
            input([{ dialogue: 'Choose', background: 'choice-room' }], {
                sceneId: 'choice_scene',
                flow,
            })
        );
        await flushAsyncWork();

        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(2);
        expect(resolver.prefetchNextEdge).toHaveBeenCalledWith(
            expect.objectContaining({
                fromSceneId: 'choice_scene',
                toSceneId: 'branch_a',
            })
        );
        expect(resolver.prefetchNextEdge).toHaveBeenCalledWith(
            expect.objectContaining({
                fromSceneId: 'choice_scene',
                toSceneId: 'branch_b',
            })
        );
        expect(getSceneDialogue).not.toHaveBeenCalledWith(
            storyId,
            'branch_a_next'
        );
    });

    it('aborts pending work and clears protected cache keys on dispose', async () => {
        const slowRelease = deferred<ValidatedAssetRelease>();
        const { cache, controller } = createHarness({
            loadRelease: () => slowRelease.promise,
        });
        controller.update(
            input([{ dialogue: 'Pending', background: 'pending-room' }])
        );

        controller.dispose();
        slowRelease.resolve(release());
        await flushAsyncWork();

        expect(cache.setProtectedKeys).toHaveBeenLastCalledWith(new Set());
    });

    it('calls the listener immediately and returns a no-op unsubscribe when disposed', () => {
        const { controller, latest } = createHarness();
        controller.dispose();
        const listener = vi.fn();
        const unsubscribe = controller.subscribe(listener);
        expect(listener).toHaveBeenCalledWith(latest());
        expect(unsubscribe).not.toThrow();
    });

    it('does nothing when commitBackgroundTransition is called without a ready staging background', async () => {
        const { controller, latest } = createHarness();
        const before = latest();
        controller.commitBackgroundTransition();
        expect(latest()).toBe(before);
    });

    it('does nothing when commitBackgroundTransition is called after dispose', async () => {
        const { controller } = createHarness();
        controller.dispose();
        expect(() => controller.commitBackgroundTransition()).not.toThrow();
    });

    it('detaches an object URL from the active background layer', async () => {
        let frameCallback: FrameRequestCallback | undefined;
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((callback: FrameRequestCallback) => {
                frameCallback = callback;
                return 1;
            })
        );
        const { controller, latest } = createHarness();
        controller.update(input([{ dialogue: 'x', background: 'room' }]));
        await flushAsyncWork();
        const url = latest().activeBackground.objectUrl;
        expect(url).not.toBeNull();
        const pending = controller.detachObjectUrl(url!);
        expect(latest().activeBackground.objectUrl).toBeNull();
        await Promise.resolve();
        frameCallback?.(0);
        await pending;
    });

    it('detaches an object URL from the portrait layer', async () => {
        let frameCallback: FrameRequestCallback | undefined;
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((callback: FrameRequestCallback) => {
                frameCallback = callback;
                return 1;
            })
        );
        const { controller, latest } = createHarness();
        controller.update(
            input([{ dialogue: 'x', portrait: 'mio/base', characterId: 'mio' }])
        );
        await flushAsyncWork();
        const url = latest().portrait.objectUrl;
        expect(url).not.toBeNull();
        const pending = controller.detachObjectUrl(url!);
        expect(latest().portrait.objectUrl).toBeNull();
        await Promise.resolve();
        frameCallback?.(0);
        await pending;
    });

    it('falls back to setTimeout when requestAnimationFrame is unavailable', async () => {
        vi.useFakeTimers();
        const original = globalThis.requestAnimationFrame;
        // @ts-expect-error - deleting for test
        delete globalThis.requestAnimationFrame;
        try {
            const { controller, latest } = createHarness();
            controller.update(input([{ dialogue: 'x', background: 'room' }]));
            await flushAsyncWork();
            const url = latest().activeBackground.objectUrl;
            const detachPromise = controller.detachObjectUrl(url!);
            await vi.advanceTimersByTimeAsync(0);
            await detachPromise;
            expect(latest().activeBackground.objectUrl).toBeNull();
        } finally {
            globalThis.requestAnimationFrame = original;
            vi.useRealTimers();
        }
    });

    it('softRevalidate returns early when disposed', async () => {
        const { controller } = createHarness();
        controller.dispose();
        await expect(controller.softRevalidate()).resolves.toBeUndefined();
    });

    it('does not wait for an animation frame when detaching an unreferenced URL', async () => {
        const rafSpy = vi.fn((callback: FrameRequestCallback) => {
            callback(0);
            return 1;
        });
        vi.stubGlobal('requestAnimationFrame', rafSpy);
        const { controller } = createHarness();
        // No layers are mounted, so the URL matches nothing.
        await expect(
            controller.detachObjectUrl('blob:unreferenced')
        ).resolves.toBeUndefined();
        expect(rafSpy).not.toHaveBeenCalled();
    });

    it('uses at most one animation frame when clearing multiple unreferenced cached objects', async () => {
        let frameCount = 0;
        const rafSpy = vi.fn((callback: FrameRequestCallback) => {
            frameCount += 1;
            callback(0);
            return 1;
        });
        vi.stubGlobal('requestAnimationFrame', rafSpy);
        const { controller } = createHarness();
        // Simulate cache.clear() after dispose: the snapshot is reset to
        // initialSnapshot(), so every URL is unreferenced. Sequential
        // detachObjectUrl calls must not each wait for a frame.
        controller.dispose();
        const urls = Array.from(
            { length: 48 },
            (_, index) => `blob:cached-${index}`
        );
        for (const url of urls) {
            await controller.detachObjectUrl(url);
        }
        expect(frameCount).toBeLessThanOrEqual(1);
    });

    it('softRevalidate returns early when resolver is null', async () => {
        const cache = {
            load: vi.fn(),
            prefetch: vi.fn(),
            setProtectedKeys: vi.fn(),
        };
        const controller = new VisualStateController({
            resolver: null,
            cache: cache,
            getSceneDialogue: vi.fn(() => null),
        });
        await expect(controller.softRevalidate()).resolves.toBeUndefined();
    });

    it('softRevalidate skips when called within the revalidation age window', async () => {
        vi.useFakeTimers();
        const now = vi.fn(() => 1000);
        const { controller, resolver } = createHarness({ now });
        controller.update(input([{ dialogue: 'x', background: 'room' }]));
        await flushAsyncWork();
        await controller.softRevalidate();
        const initialCalls = (
            resolver.loadActiveRelease as ReturnType<typeof vi.fn>
        ).mock.calls.length;
        vi.advanceTimersByTime(30_000);
        now.mockReturnValue(31_000);
        await controller.softRevalidate();
        expect(
            (resolver.loadActiveRelease as ReturnType<typeof vi.fn>).mock.calls
                .length
        ).toBe(initialCalls);
        vi.useRealTimers();
    });

    it('proceeds without reloading when release is stale-but-usable', async () => {
        const { controller, latest, resolver } = createHarness({
            loadRelease: async () => release('last-validated-release'),
        });
        controller.update(input([{ dialogue: 'x', background: 'room' }]));
        await flushAsyncWork();
        expect(latest().release).toBe('stale-but-usable');
        const callsBefore = (
            resolver.loadActiveRelease as ReturnType<typeof vi.fn>
        ).mock.calls.length;
        controller.update(
            input(
                [
                    { dialogue: 'y', background: 'room' },
                    { dialogue: 'x', background: 'room' },
                ],
                { dialogueIndex: 1 }
            )
        );
        await flushAsyncWork();
        expect(
            (resolver.loadActiveRelease as ReturnType<typeof vi.fn>).mock.calls
                .length
        ).toBe(callsBefore);
    });

    it('transitions to an error state when a revalidation load fails after the release expires', async () => {
        vi.useFakeTimers();
        const now = vi.fn(() => 1000);
        const loadRelease = vi
            .fn()
            .mockResolvedValueOnce(release('network'))
            .mockRejectedValue(new AssetResolverError('network', 'offline'));
        const { controller, latest } = createHarness({ loadRelease, now });
        controller.update(input([{ dialogue: 'x', background: 'room' }]));
        await flushAsyncWork();
        expect(latest().release).toBe('ready');
        now.mockReturnValue(70_000);
        vi.advanceTimersByTime(70_000);
        await controller.softRevalidate();
        await flushAsyncWork();
        // The resolver rejected, meaning even the stored fallback is expired
        // or invalid. The controller must not claim stale-but-usable; it
        // transitions to unavailable so keyed layers fail rather than
        // displaying expired assets.
        expect(latest().release).toBe('unavailable');
        expect(latest().status).toBe('unavailable');
        vi.useRealTimers();
    });

    it('returns release-unavailable fallback for keyed visuals when resolver is null', async () => {
        const cache = {
            load: vi.fn(),
            prefetch: vi.fn(),
            setProtectedKeys: vi.fn(),
        };
        const controller = new VisualStateController({
            resolver: null,
            cache: cache,
            getSceneDialogue: vi.fn(() => null),
        });
        const snapshots: VisualSnapshot[] = [];
        controller.subscribe(s => snapshots.push(s));
        controller.update(
            input([{ dialogue: 'x', background: 'room', portrait: 'mio/base' }])
        );
        await flushAsyncWork();
        const latestSnap = snapshots.at(-1)!;
        expect(latestSnap.release).toBe('unavailable');
        expect(latestSnap.stagingBackground.state).toBe('failed');
        expect(latestSnap.portrait.state).toBe('failed');
    });

    it('marks portrait as failed when cache.load rejects', async () => {
        const { controller, latest } = createHarness({
            loadAsset: async () => {
                throw new Error('decode failed');
            },
        });
        controller.update(
            input([{ dialogue: 'x', portrait: 'mio/base', characterId: 'mio' }])
        );
        await flushAsyncWork();
        expect(latest().portrait.state).toBe('failed');
    });

    it('marks release as invalid for an invalid-release fallback reason', async () => {
        const { controller, latest } = createHarness({
            resolveAsset: identity => fallback(identity, 'invalid-release'),
        });
        controller.update(input([{ dialogue: 'x', background: 'room' }]));
        await flushAsyncWork();
        expect(latest().release).toBe('invalid');
    });

    it('marks release as invalid for an integrity-failure fallback reason', async () => {
        const { controller, latest } = createHarness({
            resolveAsset: identity => fallback(identity, 'integrity-failure'),
        });
        controller.update(input([{ dialogue: 'x', background: 'room' }]));
        await flushAsyncWork();
        expect(latest().release).toBe('invalid');
    });

    it('does not warm prefetch when all remaining lines share the same signature', async () => {
        const { controller, resolver } = createHarness();
        controller.update(
            input([
                { dialogue: 'a', background: 'room' },
                { dialogue: 'b', background: 'room' },
            ])
        );
        await flushAsyncWork();
        // Same background, no portrait → same signature → no warm prefetch
        // resolve is called once for the active background load only.
        expect(
            (resolver.resolve as ReturnType<typeof vi.fn>).mock.calls.length
        ).toBe(1);
    });

    it('prefetches all choice targets when the current scene ends at a choice node', async () => {
        const choiceFlow = {
            start: 'scene',
            nodes: [
                {
                    kind: 'scene',
                    id: 'scene',
                    sceneId: 'scene',
                    next: 'choice:pick',
                },
                {
                    kind: 'choice',
                    id: 'choice:pick',
                    nextByOption: {
                        left: 'left_scene',
                        right: 'right_scene',
                    },
                },
                {
                    kind: 'scene',
                    id: 'left_scene',
                    sceneId: 'left_scene',
                    next: null,
                },
                {
                    kind: 'scene',
                    id: 'right_scene',
                    sceneId: 'right_scene',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const sceneDialogue: Record<string, readonly DialogueEntry[] | null> = {
            left_scene: [{ dialogue: 'left', background: 'left_bg' }],
            right_scene: [{ dialogue: 'right', background: 'right_bg' }],
        };
        const { controller, resolver, getSceneDialogue } = createHarness({
            sceneDialogue,
        });
        (getSceneDialogue as ReturnType<typeof vi.fn>).mockImplementation(
            (_sid: string, sceneId: string) => sceneDialogue[sceneId] ?? null
        );
        controller.update(
            input([{ dialogue: 'last', background: 'room' }], {
                flow: choiceFlow,
                dialogueIndex: 0,
            })
        );
        await flushAsyncWork();
        await flushAsyncWork();
        const prefetchCalls = (
            resolver.prefetchNextEdge as ReturnType<typeof vi.fn>
        ).mock.calls;
        const targets = prefetchCalls
            .map(
                (call: unknown[]) =>
                    (call[0] as { toSceneId: string }).toSceneId
            )
            .sort();
        expect(targets).toEqual(['left_scene', 'right_scene']);
    });

    it('keeps the edge reservation retryable when prefetch returns failed assets', async () => {
        const choiceFlow = {
            start: 'scene',
            nodes: [
                {
                    kind: 'scene',
                    id: 'scene',
                    sceneId: 'scene',
                    next: 'choice:pick',
                },
                {
                    kind: 'choice',
                    id: 'choice:pick',
                    nextByOption: { left: 'left_scene' },
                },
                {
                    kind: 'scene',
                    id: 'left_scene',
                    sceneId: 'left_scene',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const terminalFlow = {
            start: 'terminal',
            nodes: [
                {
                    kind: 'scene',
                    id: 'terminal',
                    sceneId: 'terminal',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const sceneDialogue: Record<string, readonly DialogueEntry[] | null> = {
            left_scene: [{ dialogue: 'left', background: 'left_bg' }],
        };
        const { controller, resolver, getSceneDialogue } = createHarness({
            sceneDialogue,
            resolveAsset: identity => fallback(identity, 'not-found'),
        });
        (getSceneDialogue as ReturnType<typeof vi.fn>).mockImplementation(
            (_sid: string, sceneId: string) => sceneDialogue[sceneId] ?? null
        );
        (
            resolver.prefetchNextEdge as ReturnType<typeof vi.fn>
        ).mockResolvedValue({
            requested: 1,
            cached: 0,
            failed: [
                {
                    status: 'fallback',
                    identity: { type: 'background', key: 'left_bg' },
                    reason: 'not-found',
                    error: new AssetResolverError('not-found', 'x'),
                },
            ],
        });
        const edgeInput = input([{ dialogue: 'last', background: 'room' }], {
            flow: choiceFlow,
            dialogueIndex: 0,
        });
        controller.update(edgeInput);
        await flushAsyncWork();
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(1);

        // Navigate away, then re-enter the same edge. Because the failed
        // prefetch released (not completed) the reservation, re-entering
        // must trigger a second prefetch attempt.
        controller.update(
            input([{ dialogue: 'navigated away' }], {
                sceneId: 'terminal',
                flow: terminalFlow,
            })
        );
        controller.update(edgeInput);
        await flushAsyncWork();
        await flushAsyncWork();
        expect(resolver.prefetchNextEdge).toHaveBeenCalledTimes(2);
    });

    it('clears prefetched edges when the story id changes between updates', async () => {
        const choiceFlow = {
            start: 'scene',
            nodes: [
                {
                    kind: 'scene',
                    id: 'scene',
                    sceneId: 'scene',
                    next: 'choice:pick',
                },
                {
                    kind: 'choice',
                    id: 'choice:pick',
                    nextByOption: { left: 'left_scene' },
                },
                {
                    kind: 'scene',
                    id: 'left_scene',
                    sceneId: 'left_scene',
                    next: null,
                },
            ],
        } as unknown as StoryFlowConfig;
        const sceneDialogue: Record<string, readonly DialogueEntry[] | null> = {
            left_scene: [{ dialogue: 'left', background: 'left_bg' }],
        };
        const { controller, resolver, getSceneDialogue } = createHarness({
            sceneDialogue,
        });
        (getSceneDialogue as ReturnType<typeof vi.fn>).mockImplementation(
            (_sid: string, sceneId: string) => sceneDialogue[sceneId] ?? null
        );
        controller.update(
            input([{ dialogue: 'last', background: 'room' }], {
                flow: choiceFlow,
                dialogueIndex: 0,
            })
        );
        await flushAsyncWork();
        await flushAsyncWork();
        const callsAfterFirst = (
            resolver.prefetchNextEdge as ReturnType<typeof vi.fn>
        ).mock.calls.length;
        expect(callsAfterFirst).toBeGreaterThan(0);
        // Change story id - prefetchedEdges should be cleared
        controller.update(
            input([{ dialogue: 'new story', background: 'room' }], {
                storyId: 'different_story',
                flow: choiceFlow,
                dialogueIndex: 0,
            })
        );
        await flushAsyncWork();
        await flushAsyncWork();
        // After story change, re-updating the original story should re-prefetch
        // the same edge (because prefetchedEdges was cleared).
        controller.update(
            input([{ dialogue: 'last', background: 'room' }], {
                flow: choiceFlow,
                dialogueIndex: 0,
            })
        );
        await flushAsyncWork();
        await flushAsyncWork();
        expect(
            (resolver.prefetchNextEdge as ReturnType<typeof vi.fn>).mock.calls
                .length
        ).toBeGreaterThan(callsAfterFirst);
    });
});
