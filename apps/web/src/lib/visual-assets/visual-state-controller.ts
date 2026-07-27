import {
    AssetResolverError,
    qualifyAssetIdentity,
    type AssetFallback,
    type AssetResolver,
    type LogicalAssetIdentity,
} from '@aquila/stories/runtime-assets';
import type {
    DialogueEntry,
    StoryFlowConfig,
    StoryPresentationMetadata,
} from '@aquila/stories';
import type { DecodedAssetCache } from './decoded-asset-cache';
import { PrefetchQueue } from './prefetch-queue';
import type {
    DecodedAsset,
    VisualImageLayer,
    VisualLayerState,
    VisualPortraitLayer,
    VisualReleaseState,
    VisualSnapshot,
} from './types';

const SOFT_REVALIDATE_AGE_MS = 60_000;

type GetSceneDialogue = (
    storyId: string,
    sceneId: string
) => readonly DialogueEntry[] | null;

type VisualAssetCache = Pick<
    DecodedAssetCache,
    'load' | 'prefetch' | 'setProtectedKeys'
>;

export type VisualControllerInput = {
    storyId: string;
    sceneId: string;
    dialogue: readonly DialogueEntry[];
    dialogueIndex: number;
    flow: StoryFlowConfig;
    presentation: StoryPresentationMetadata | null;
};

export type VisualStateControllerOptions = {
    resolver: AssetResolver | null;
    cache: VisualAssetCache;
    getSceneDialogue: GetSceneDialogue;
    now?: () => number;
};

type LoadResult =
    | { status: 'ready'; decoded: DecodedAsset }
    | { status: 'fallback'; fallback: AssetFallback }
    | { status: 'failed' };

type EdgePrefetchReservation = {
    generation: number;
    state: 'in-flight' | 'complete';
};

function imageLayer(
    state: VisualLayerState,
    identity: string | null = null
): VisualImageLayer {
    return Object.freeze({
        state,
        identity,
        objectUrl: null,
        width: null,
        height: null,
    });
}

function readyImageLayer(
    identity: string,
    decoded: DecodedAsset
): VisualImageLayer {
    return Object.freeze({
        state: 'ready' as const,
        identity,
        objectUrl: decoded.objectUrl,
        width: decoded.width,
        height: decoded.height,
    });
}

function portraitLayer(
    state: VisualLayerState,
    slot: VisualPortraitLayer['slot'],
    identity: string | null = null
): VisualPortraitLayer {
    return Object.freeze({
        ...imageLayer(state, identity),
        slot,
    });
}

function readyPortraitLayer(
    identity: string,
    decoded: DecodedAsset,
    slot: VisualPortraitLayer['slot']
): VisualPortraitLayer {
    return Object.freeze({
        ...readyImageLayer(identity, decoded),
        slot,
    });
}

function initialSnapshot(): VisualSnapshot {
    return Object.freeze({
        release: 'idle' as const,
        activeBackground: imageLayer('omitted'),
        stagingBackground: imageLayer('omitted'),
        portrait: portraitLayer('omitted', 'center'),
        status: null,
    });
}

function identityFor(
    type: LogicalAssetIdentity['type'],
    key: string | undefined
): LogicalAssetIdentity | null {
    return key ? { type, key } : null;
}

function identitiesForLine(
    entry: DialogueEntry | undefined
): LogicalAssetIdentity[] {
    if (!entry) return [];
    const identities: LogicalAssetIdentity[] = [];
    if (entry.background) {
        identities.push({ type: 'background', key: entry.background });
    }
    if (entry.portrait) {
        identities.push({ type: 'portrait', key: entry.portrait });
    }
    return identities;
}

function visualSignature(entry: DialogueEntry | undefined): string {
    return `${entry?.background ?? ''}\u0000${entry?.portrait ?? ''}`;
}

function releaseStateForError(error: unknown): VisualReleaseState {
    if (
        error instanceof AssetResolverError &&
        (error.code === 'timeout' ||
            error.code === 'network' ||
            error.code === 'unavailable' ||
            error.code === 'stale-pointer')
    ) {
        return 'unavailable';
    }
    return 'invalid';
}

export class VisualStateController {
    private readonly resolver: AssetResolver | null;
    private readonly cache: VisualAssetCache;
    private readonly getSceneDialogue: GetSceneDialogue;
    private readonly now: () => number;
    private readonly queue = new PrefetchQueue(2);
    private readonly listeners = new Set<(snapshot: VisualSnapshot) => void>();
    private readonly abortController = new AbortController();
    private readonly prefetchedEdges = new Map<
        string,
        EdgePrefetchReservation
    >();

    private snapshot: VisualSnapshot = initialSnapshot();
    private currentInput: VisualControllerInput | null = null;
    private generation = 0;
    private disposed = false;
    private releasePromise: Promise<boolean> | null = null;
    private lastReleaseCheckAt: number | null = null;
    private activeBackgroundCacheKey: string | null = null;
    private stagingBackgroundCacheKey: string | null = null;
    private portraitCacheKey: string | null = null;

    constructor(options: VisualStateControllerOptions) {
        this.resolver = options.resolver;
        this.cache = options.cache;
        this.getSceneDialogue = options.getSceneDialogue;
        this.now = options.now ?? Date.now;
    }

    subscribe(listener: (snapshot: VisualSnapshot) => void): () => void {
        if (this.disposed) {
            listener(this.snapshot);
            return () => {};
        }
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => this.listeners.delete(listener);
    }

    update(input: VisualControllerInput): void {
        if (this.disposed) return;
        const previousStoryId = this.currentInput?.storyId;
        this.currentInput = input;
        const generation = ++this.generation;
        if (
            previousStoryId !== undefined &&
            previousStoryId !== input.storyId
        ) {
            this.prefetchedEdges.clear();
        }
        this.prepareLoadingLayers(input);
        void this.prepareCurrentInput(input, generation);
    }

    commitBackgroundTransition(): void {
        if (
            this.disposed ||
            this.snapshot.stagingBackground.state !== 'ready'
        ) {
            return;
        }
        this.activeBackgroundCacheKey = this.stagingBackgroundCacheKey;
        this.stagingBackgroundCacheKey = null;
        this.publish({
            activeBackground: this.snapshot.stagingBackground,
            stagingBackground: imageLayer('omitted'),
        });
    }

    async detachObjectUrl(objectUrl: string): Promise<void> {
        const detach = <T extends VisualImageLayer>(layer: T): T => {
            if (layer.objectUrl !== objectUrl) return layer;
            return Object.freeze({ ...layer, objectUrl: null });
        };
        const activeBackground = detach(this.snapshot.activeBackground);
        const stagingBackground = detach(this.snapshot.stagingBackground);
        const portrait = detach(this.snapshot.portrait);
        if (
            activeBackground !== this.snapshot.activeBackground ||
            stagingBackground !== this.snapshot.stagingBackground ||
            portrait !== this.snapshot.portrait
        ) {
            if (this.snapshot.activeBackground.objectUrl === objectUrl) {
                this.activeBackgroundCacheKey = null;
            }
            if (this.snapshot.stagingBackground.objectUrl === objectUrl) {
                this.stagingBackgroundCacheKey = null;
            }
            if (this.snapshot.portrait.objectUrl === objectUrl) {
                this.portraitCacheKey = null;
            }
            this.publish({ activeBackground, stagingBackground, portrait });
        }
        await new Promise<void>(resolve => {
            if (typeof globalThis.requestAnimationFrame === 'function') {
                globalThis.requestAnimationFrame(() => resolve());
            } else {
                globalThis.setTimeout(resolve, 0);
            }
        });
    }

    async softRevalidate(): Promise<void> {
        if (this.disposed || this.resolver === null) return;
        const now = this.now();
        if (
            this.lastReleaseCheckAt !== null &&
            now - this.lastReleaseCheckAt < SOFT_REVALIDATE_AGE_MS
        ) {
            return;
        }
        const releaseReady = await this.loadRelease(true);
        const input = this.currentInput;
        const generation = this.generation;
        if (
            !releaseReady ||
            !input ||
            !this.isInputCurrent(input, generation)
        ) {
            return;
        }
        this.prepareLoadingLayers(input);
        await this.prepareCurrentInput(input, generation);
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        this.abortController.abort();
        this.currentInput = null;
        this.activeBackgroundCacheKey = null;
        this.stagingBackgroundCacheKey = null;
        this.portraitCacheKey = null;
        this.snapshot = initialSnapshot();
        this.cache.setProtectedKeys(new Set());
        for (const listener of this.listeners) listener(this.snapshot);
        this.listeners.clear();
    }

    private prepareLoadingLayers(input: VisualControllerInput): void {
        const entry = input.dialogue[input.dialogueIndex];
        const backgroundIdentity = identityFor('background', entry?.background);
        const portraitIdentity = identityFor('portrait', entry?.portrait);
        const backgroundKey = backgroundIdentity
            ? qualifyAssetIdentity(backgroundIdentity)
            : null;
        const portraitKey = portraitIdentity
            ? qualifyAssetIdentity(portraitIdentity)
            : null;
        const sameActiveBackground =
            backgroundKey !== null &&
            this.snapshot.activeBackground.state === 'ready' &&
            this.snapshot.activeBackground.identity === backgroundKey;
        const slot = this.portraitSlot(input, entry?.characterId);
        const samePortrait =
            portraitKey !== null &&
            this.snapshot.portrait.state === 'ready' &&
            this.snapshot.portrait.identity === portraitKey;

        this.stagingBackgroundCacheKey = null;
        if (!samePortrait) this.portraitCacheKey = null;
        this.publish({
            stagingBackground:
                backgroundKey === null || sameActiveBackground
                    ? imageLayer('omitted')
                    : imageLayer('loading', backgroundKey),
            portrait:
                portraitKey === null
                    ? portraitLayer('omitted', slot)
                    : samePortrait
                      ? Object.freeze({ ...this.snapshot.portrait, slot })
                      : portraitLayer('loading', slot, portraitKey),
        });
    }

    private async prepareCurrentInput(
        input: VisualControllerInput,
        generation: number
    ): Promise<void> {
        const entry = input.dialogue[input.dialogueIndex];
        if (this.resolver === null) {
            if (!this.isInputCurrent(input, generation)) return;
            const hasKeyedVisual = identitiesForLine(entry).length > 0;
            this.publish({ release: hasKeyedVisual ? 'unavailable' : 'idle' });
            if (hasKeyedVisual) this.failKeyedLayers(input, entry);
            return;
        }
        const releaseReady = await this.ensureRelease();
        if (!this.isInputCurrent(input, generation)) return;
        if (!releaseReady) {
            this.failKeyedLayers(input, entry);
            return;
        }
        const work: Promise<void>[] = [];
        if (
            entry?.background &&
            !(
                this.snapshot.activeBackground.state === 'ready' &&
                this.snapshot.activeBackground.identity ===
                    qualifyAssetIdentity({
                        type: 'background',
                        key: entry.background,
                    })
            )
        ) {
            work.push(
                this.loadBackground(input, generation, {
                    type: 'background',
                    key: entry.background,
                })
            );
        }
        if (
            entry?.portrait &&
            !(
                this.snapshot.portrait.state === 'ready' &&
                this.snapshot.portrait.identity ===
                    qualifyAssetIdentity({
                        type: 'portrait',
                        key: entry.portrait,
                    })
            )
        ) {
            work.push(
                this.loadPortrait(
                    input,
                    generation,
                    {
                        type: 'portrait',
                        key: entry.portrait,
                    },
                    this.portraitSlot(input, entry.characterId)
                )
            );
        }
        this.warmWithinScene(input, generation);
        this.prefetchImmediateEdges(input, generation);
        await Promise.all(work);
    }

    private ensureRelease(): Promise<boolean> {
        if (
            this.snapshot.release === 'ready' ||
            this.snapshot.release === 'stale-but-usable'
        ) {
            return Promise.resolve(true);
        }
        if (
            this.snapshot.release === 'unavailable' ||
            this.snapshot.release === 'invalid'
        ) {
            return Promise.resolve(false);
        }
        return this.loadRelease(false);
    }

    private loadRelease(revalidating: boolean): Promise<boolean> {
        const resolver = this.resolver;
        if (resolver === null) return Promise.resolve(false);
        if (this.releasePromise) return this.releasePromise;
        const hadUsableRelease =
            this.snapshot.release === 'ready' ||
            this.snapshot.release === 'stale-but-usable';
        if (!hadUsableRelease) this.publish({ release: 'loading' });
        this.lastReleaseCheckAt = this.now();
        const promise = resolver
            .loadActiveRelease({ signal: this.abortController.signal })
            .then(validated => {
                if (this.disposed) return false;
                this.publish({
                    release:
                        validated.source === 'last-validated-release'
                            ? 'stale-but-usable'
                            : 'ready',
                });
                if (revalidating) this.prefetchedEdges.clear();
                return true;
            })
            .catch(error => {
                if (this.disposed || this.abortController.signal.aborted) {
                    return false;
                }
                if (hadUsableRelease) {
                    this.publish({ release: 'stale-but-usable' });
                    return true;
                }
                this.publish({ release: releaseStateForError(error) });
                return false;
            })
            .finally(() => {
                if (this.releasePromise === promise) {
                    this.releasePromise = null;
                }
            });
        this.releasePromise = promise;
        return promise;
    }

    private async loadBackground(
        input: VisualControllerInput,
        generation: number,
        identity: LogicalAssetIdentity
    ): Promise<void> {
        const identityKey = qualifyAssetIdentity(identity);
        const result = await this.loadIdentity(identity);
        if (!this.isCurrent(input, generation, identity)) return;
        if (result.status === 'ready') {
            const ready = readyImageLayer(identityKey, result.decoded);
            this.stagingBackgroundCacheKey = result.decoded.cacheKey;
            if (this.snapshot.activeBackground.state !== 'ready') {
                this.activeBackgroundCacheKey = result.decoded.cacheKey;
                this.stagingBackgroundCacheKey = null;
                this.publish({
                    activeBackground: ready,
                    stagingBackground: imageLayer('omitted'),
                });
            } else {
                this.publish({ stagingBackground: ready });
            }
            return;
        }
        this.stagingBackgroundCacheKey = null;
        if (result.status === 'fallback') {
            this.applyFallbackReleaseState(result.fallback);
            this.publish({
                stagingBackground: imageLayer(
                    result.fallback.reason === 'not-found'
                        ? 'missing'
                        : 'failed',
                    identityKey
                ),
            });
        } else {
            this.publish({
                stagingBackground: imageLayer('failed', identityKey),
            });
        }
    }

    private async loadPortrait(
        input: VisualControllerInput,
        generation: number,
        identity: LogicalAssetIdentity,
        slot: VisualPortraitLayer['slot']
    ): Promise<void> {
        const identityKey = qualifyAssetIdentity(identity);
        const result = await this.loadIdentity(identity);
        if (!this.isCurrent(input, generation, identity)) return;
        if (result.status === 'ready') {
            this.portraitCacheKey = result.decoded.cacheKey;
            this.publish({
                portrait: readyPortraitLayer(identityKey, result.decoded, slot),
            });
            return;
        }
        this.portraitCacheKey = null;
        if (result.status === 'fallback') {
            this.applyFallbackReleaseState(result.fallback);
            this.publish({
                portrait: portraitLayer(
                    result.fallback.reason === 'not-found'
                        ? 'missing'
                        : 'failed',
                    slot,
                    identityKey
                ),
            });
        } else {
            this.publish({
                portrait: portraitLayer('failed', slot, identityKey),
            });
        }
    }

    private async loadIdentity(
        identity: LogicalAssetIdentity
    ): Promise<LoadResult> {
        const resolution = this.resolver?.resolve(identity);
        if (!resolution) {
            return {
                status: 'fallback',
                fallback: {
                    status: 'fallback',
                    identity,
                    reason: 'release-unavailable',
                    error: new AssetResolverError(
                        'unavailable',
                        'No runtime asset source is configured for this story'
                    ),
                },
            };
        }
        if (resolution.status === 'fallback') {
            return { status: 'fallback', fallback: resolution };
        }
        try {
            const decoded = await this.cache.load(resolution, {
                signal: this.abortController.signal,
            });
            return { status: 'ready', decoded };
        } catch {
            return { status: 'failed' };
        }
    }

    private applyFallbackReleaseState(fallback: AssetFallback): void {
        if (fallback.reason === 'release-unavailable') {
            this.publish({ release: 'unavailable' });
        } else if (
            fallback.reason === 'invalid-release' ||
            fallback.reason === 'integrity-failure'
        ) {
            this.publish({ release: 'invalid' });
        }
    }

    private failKeyedLayers(
        input: VisualControllerInput,
        entry: DialogueEntry | undefined
    ): void {
        const changes: Partial<VisualSnapshot> = {};
        if (entry?.background) {
            changes.stagingBackground = imageLayer(
                'failed',
                qualifyAssetIdentity({
                    type: 'background',
                    key: entry.background,
                })
            );
        }
        if (entry?.portrait) {
            changes.portrait = portraitLayer(
                'failed',
                this.portraitSlot(input, entry.characterId),
                qualifyAssetIdentity({
                    type: 'portrait',
                    key: entry.portrait,
                })
            );
        }
        if (Object.keys(changes).length > 0) this.publish(changes);
    }

    private warmWithinScene(
        input: VisualControllerInput,
        generation: number
    ): void {
        const resolver = this.resolver;
        if (resolver === null) return;
        const currentSignature = visualSignature(
            input.dialogue[input.dialogueIndex]
        );
        const next = input.dialogue
            .slice(input.dialogueIndex + 1)
            .find(entry => visualSignature(entry) !== currentSignature);
        if (!next) return;
        for (const identity of identitiesForLine(next)) {
            if (!this.isInputCurrent(input, generation)) return;
            void this.queue
                .run(async () => {
                    if (
                        !this.isWarmPrefetchCurrent(input, generation, identity)
                    ) {
                        return;
                    }
                    const resolution = resolver.resolve(identity);
                    if (
                        resolution.status !== 'resolved' ||
                        !this.isWarmPrefetchCurrent(input, generation, identity)
                    ) {
                        return;
                    }
                    await this.cache.prefetch(resolution);
                })
                .catch(() => {});
        }
    }

    private prefetchImmediateEdges(
        input: VisualControllerInput,
        generation: number
    ): void {
        const resolver = this.resolver;
        if (resolver === null) return;
        if (input.dialogueIndex !== input.dialogue.length - 1) return;
        const sceneNode = input.flow.nodes.find(
            node => node.kind === 'scene' && node.sceneId === input.sceneId
        );
        if (!sceneNode || sceneNode.kind !== 'scene' || !sceneNode.next) return;
        const nextNodeId = sceneNode.next;
        let targets: readonly string[];
        if (nextNodeId.startsWith('choice:')) {
            const choiceNode = input.flow.nodes.find(
                node => node.kind === 'choice' && node.id === nextNodeId
            );
            targets =
                choiceNode?.kind === 'choice'
                    ? [...new Set(Object.values(choiceNode.nextByOption))]
                    : [];
        } else {
            targets = [nextNodeId];
        }
        for (const toSceneId of targets) {
            if (!this.isInputCurrent(input, generation)) return;
            const edgeKey = `${input.storyId}\u0000${input.sceneId}\u0000${toSceneId}`;
            const reservation = this.prefetchedEdges.get(edgeKey);
            if (
                reservation?.state === 'complete' ||
                reservation?.generation === generation
            ) {
                continue;
            }
            const dialogue = this.getSceneDialogue(input.storyId, toSceneId);
            const firstVisualLine = dialogue?.find(
                entry => identitiesForLine(entry).length > 0
            );
            const assets = identitiesForLine(firstVisualLine);
            if (assets.length === 0) continue;
            this.prefetchedEdges.set(edgeKey, {
                generation,
                state: 'in-flight',
            });
            void this.queue
                .run(async () => {
                    if (
                        !this.isEdgePrefetchCurrent(
                            input,
                            generation,
                            toSceneId,
                            assets
                        )
                    ) {
                        this.releaseEdgeReservation(edgeKey, generation);
                        return;
                    }
                    const result = await resolver.prefetchNextEdge({
                        fromSceneId: input.sceneId,
                        toSceneId,
                        assets,
                        signal: this.abortController.signal,
                    });
                    if (
                        !this.isEdgePrefetchCurrent(
                            input,
                            generation,
                            toSceneId,
                            assets
                        )
                    ) {
                        this.releaseEdgeReservation(edgeKey, generation);
                        return;
                    }
                    if (result.failed.length > 0) {
                        this.completeEdgeReservation(edgeKey, generation);
                        return;
                    }
                    await Promise.all(
                        assets.map(identity => {
                            if (
                                !this.isEdgePrefetchCurrent(
                                    input,
                                    generation,
                                    toSceneId,
                                    assets
                                )
                            ) {
                                return Promise.resolve();
                            }
                            const resolution = resolver.resolve(identity);
                            return resolution.status === 'resolved'
                                ? this.cache.prefetch(resolution)
                                : Promise.resolve();
                        })
                    );
                    this.completeEdgeReservation(edgeKey, generation);
                })
                .catch(() => this.releaseEdgeReservation(edgeKey, generation));
        }
    }

    private releaseEdgeReservation(edgeKey: string, generation: number): void {
        const reservation = this.prefetchedEdges.get(edgeKey);
        if (
            reservation?.generation === generation &&
            reservation.state === 'in-flight'
        ) {
            this.prefetchedEdges.delete(edgeKey);
        }
    }

    private completeEdgeReservation(edgeKey: string, generation: number): void {
        const reservation = this.prefetchedEdges.get(edgeKey);
        if (reservation?.generation === generation) {
            this.prefetchedEdges.set(edgeKey, {
                generation,
                state: 'complete',
            });
        }
    }

    private isWarmPrefetchCurrent(
        input: VisualControllerInput,
        generation: number,
        identity: LogicalAssetIdentity
    ): boolean {
        if (!this.isInputCurrent(input, generation)) return false;
        const currentSignature = visualSignature(
            input.dialogue[input.dialogueIndex]
        );
        const next = input.dialogue
            .slice(input.dialogueIndex + 1)
            .find(entry => visualSignature(entry) !== currentSignature);
        return identitiesForLine(next).some(
            candidate =>
                candidate.type === identity.type &&
                candidate.key === identity.key
        );
    }

    private isEdgePrefetchCurrent(
        input: VisualControllerInput,
        generation: number,
        toSceneId: string,
        assets: readonly LogicalAssetIdentity[]
    ): boolean {
        if (!this.isInputCurrent(input, generation)) return false;
        const dialogue = this.getSceneDialogue(input.storyId, toSceneId);
        const firstVisualLine = dialogue?.find(
            entry => identitiesForLine(entry).length > 0
        );
        const currentAssets = identitiesForLine(firstVisualLine);
        return (
            currentAssets.length === assets.length &&
            currentAssets.every(
                (identity, index) =>
                    identity.type === assets[index]?.type &&
                    identity.key === assets[index]?.key
            )
        );
    }

    private portraitSlot(
        input: VisualControllerInput,
        characterId: string | undefined
    ): VisualPortraitLayer['slot'] {
        return (
            (characterId
                ? input.presentation?.portrait.slotsByCharacterId[characterId]
                : undefined) ??
            input.presentation?.portrait.defaultSlot ??
            'center'
        );
    }

    private isInputCurrent(
        input: VisualControllerInput,
        generation: number
    ): boolean {
        const current = this.currentInput;
        return (
            !this.disposed &&
            this.generation === generation &&
            current?.storyId === input.storyId &&
            current.sceneId === input.sceneId &&
            current.dialogueIndex === input.dialogueIndex
        );
    }

    private isCurrent(
        input: VisualControllerInput,
        generation: number,
        identity: LogicalAssetIdentity
    ): boolean {
        if (!this.isInputCurrent(input, generation)) return false;
        const entry = input.dialogue[input.dialogueIndex];
        return (
            (identity.type === 'background'
                ? entry?.background
                : entry?.portrait) === identity.key
        );
    }

    private publish(changes: Partial<VisualSnapshot>): void {
        if (this.disposed) return;
        const candidate = {
            ...this.snapshot,
            ...changes,
        };
        this.snapshot = Object.freeze({
            ...candidate,
            status: this.statusFor(candidate),
        });
        this.cache.setProtectedKeys(
            new Set(
                [
                    this.activeBackgroundCacheKey,
                    this.stagingBackgroundCacheKey,
                    this.portraitCacheKey,
                ].filter((key): key is string => key !== null)
            )
        );
        for (const listener of this.listeners) listener(this.snapshot);
    }

    private statusFor(
        snapshot: Omit<VisualSnapshot, 'status'> | VisualSnapshot
    ): VisualSnapshot['status'] {
        if (
            snapshot.release === 'unavailable' ||
            snapshot.release === 'invalid'
        ) {
            return 'unavailable';
        }
        if (
            snapshot.stagingBackground.state === 'missing' ||
            snapshot.stagingBackground.state === 'failed' ||
            snapshot.portrait.state === 'missing' ||
            snapshot.portrait.state === 'failed'
        ) {
            return 'fallback';
        }
        return snapshot.release === 'stale-but-usable' ? 'stale' : null;
    }
}
