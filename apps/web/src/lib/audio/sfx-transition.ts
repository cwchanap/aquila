import type { ReaderMode } from '@/lib/reader-mode';
import type { StoryFlowConfig } from '@aquila/stories';

export type LinePosition = {
    storyId: string;
    sceneId: string;
    index: number;
};

export type SfxCommand =
    | { type: 'play'; cueKey: string }
    | { type: 'stop' }
    | { type: 'noop' };

export type PendingSfxPlayback = {
    position: LinePosition;
    cueKey: string;
};

export function sameLinePosition(
    left: LinePosition | null,
    right: LinePosition
): boolean {
    return (
        left !== null &&
        left.storyId === right.storyId &&
        left.sceneId === right.sceneId &&
        left.index === right.index
    );
}

export function pendingSfxAfterTransition(
    command: SfxCommand,
    next: LinePosition,
    initialLoadPending: boolean
): PendingSfxPlayback | null {
    return initialLoadPending && command.type === 'play'
        ? { position: next, cueKey: command.cueKey }
        : null;
}

export function sfxCommandOnInitialRelease(
    pending: PendingSfxPlayback | null,
    current: LinePosition,
    options: {
        mode: ReaderMode;
        enabled: boolean;
        cueResolvable: boolean;
    }
): SfxCommand {
    if (
        pending === null ||
        !sameLinePosition(pending.position, current) ||
        options.mode !== 'visual' ||
        !options.enabled ||
        !options.cueResolvable
    ) {
        return { type: 'noop' };
    }
    return { type: 'play', cueKey: pending.cueKey };
}

function isDirectFlowEdge(
    flow: StoryFlowConfig | null,
    fromSceneId: string,
    toSceneId: string
): boolean {
    if (!flow) return false;
    const scene = flow.nodes.find(
        node => node.kind === 'scene' && node.sceneId === fromSceneId
    );
    if (!scene || scene.kind !== 'scene' || !scene.next) return false;
    if (scene.next === toSceneId) return true;
    if (!scene.next.startsWith('choice:')) return false;

    const choice = flow.nodes.find(
        node => node.kind === 'choice' && node.id === scene.next
    );
    return (
        choice?.kind === 'choice' &&
        Object.values(choice.nextByOption).some(
            sceneId => sceneId === toSceneId
        )
    );
}

export function isForwardAdjacent(
    previous: LinePosition,
    next: LinePosition,
    flow: StoryFlowConfig | null
): boolean {
    if (previous.storyId !== next.storyId) return false;
    if (previous.sceneId === next.sceneId) {
        return next.index === previous.index + 1;
    }
    return (
        next.index === 0 &&
        isDirectFlowEdge(flow, previous.sceneId, next.sceneId)
    );
}

export function nextSfxCommand(
    previous: LinePosition | null,
    next: LinePosition,
    cueKey: string | undefined,
    options: {
        mode: ReaderMode;
        enabled: boolean;
        flow: StoryFlowConfig | null;
    }
): SfxCommand {
    if (!previous) return { type: 'noop' };
    if (previous.storyId !== next.storyId) return { type: 'stop' };
    if (!isForwardAdjacent(previous, next, options.flow)) {
        return { type: 'noop' };
    }
    if (options.mode !== 'visual' || !options.enabled || !cueKey) {
        return { type: 'noop' };
    }
    return { type: 'play', cueKey };
}
