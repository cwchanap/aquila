import type { Locale } from '@aquila/stories';
import { isRegisteredStoryId, type StoryPayload } from '@aquila/stories/async';
import {
    DEFAULT_SCENE_ID,
    clampIndex,
    parseDialogueParam,
    sceneExists,
    type PersistedSession,
    type ReaderSessionState,
} from './reader-session';

export type ReaderIntentSource = 'url' | 'persisted' | 'default';

export interface ReaderIntent {
    source: ReaderIntentSource;
    storyId: string;
    requestedSceneId: string | null;
    requestedDialogueIndex: number | null;
    malformedDialogue: boolean;
    locale: Locale;
}

export type IntentSelection =
    | { kind: 'load'; intent: ReaderIntent }
    | { kind: 'unknown-story'; storyId: string; locale: Locale };

export type LoadedIntentResult =
    | { kind: 'apply'; state: ReaderSessionState }
    | { kind: 'soft-reject' }
    | { kind: 'fallback-default' };

export interface ReaderIntentDeps {
    defaultStoryId: string;
}

export type LoadedIntentPhase = 'initial' | 'popstate';

/**
 * Chooses which registered story to load using only URL, persistence, and
 * registry metadata. Flow and dialogue inspection is deliberately deferred
 * until its asynchronous payload has arrived.
 */
export function selectReaderIntent(
    params: URLSearchParams,
    persisted: PersistedSession | null,
    locale: Locale,
    deps: ReaderIntentDeps
): IntentSelection {
    const urlStoryId = params.get('story');
    if (urlStoryId !== null) {
        if (!isRegisteredStoryId(urlStoryId)) {
            return { kind: 'unknown-story', storyId: urlStoryId, locale };
        }

        const rawDialogue = params.get('dialogue');
        const requestedDialogueIndex = parseDialogueParam(rawDialogue);
        const isZeroEquivalentDialogue =
            rawDialogue === '' ||
            (rawDialogue !== null && /^0+$/.test(rawDialogue));
        return {
            kind: 'load',
            intent: {
                source: 'url',
                storyId: urlStoryId,
                requestedSceneId: params.get('scene'),
                requestedDialogueIndex,
                malformedDialogue:
                    rawDialogue !== null &&
                    !isZeroEquivalentDialogue &&
                    (requestedDialogueIndex === null ||
                        !Number.isFinite(requestedDialogueIndex)),
                locale,
            },
        };
    }

    if (
        persisted &&
        persisted.locale === locale &&
        isRegisteredStoryId(persisted.storyId)
    ) {
        return {
            kind: 'load',
            intent: {
                source: 'persisted',
                storyId: persisted.storyId,
                requestedSceneId: persisted.sceneId,
                requestedDialogueIndex: persisted.dialogueIndex,
                malformedDialogue: false,
                locale,
            },
        };
    }

    return {
        kind: 'load',
        intent: {
            source: 'default',
            storyId: deps.defaultStoryId,
            requestedSceneId: null,
            requestedDialogueIndex: null,
            malformedDialogue: false,
            locale,
        },
    };
}

/**
 * Resolves an already selected intent against the asynchronously loaded story
 * payload. Initial URL failures canonicalize to a safe state; popstate input
 * is rejected without mutating the current reader state.
 */
export function validateLoadedIntent(
    intent: ReaderIntent,
    payload: StoryPayload,
    phase: LoadedIntentPhase
): LoadedIntentResult {
    const fallbackSceneId = payload.flow.start ?? DEFAULT_SCENE_ID;
    let sceneId = intent.requestedSceneId ?? fallbackSceneId;
    let dialogueIndex = intent.requestedDialogueIndex ?? 0;

    if (!sceneExists(payload.flow, sceneId)) {
        if (intent.source === 'persisted') {
            return { kind: 'fallback-default' };
        }
        if (phase === 'popstate') {
            return { kind: 'soft-reject' };
        }
        sceneId = fallbackSceneId;
        dialogueIndex = 0;
    }

    if (intent.malformedDialogue) {
        if (phase === 'popstate') {
            return { kind: 'soft-reject' };
        }
        dialogueIndex = 0;
    }

    if (!Number.isFinite(dialogueIndex) || dialogueIndex < 0) {
        return intent.source === 'persisted'
            ? { kind: 'fallback-default' }
            : { kind: 'soft-reject' };
    }

    return {
        kind: 'apply',
        state: {
            storyId: intent.storyId,
            sceneId,
            dialogueIndex: clampIndex(
                dialogueIndex,
                payload.dialogue[sceneId]?.length ?? 0
            ),
            locale: intent.locale,
        },
    };
}
