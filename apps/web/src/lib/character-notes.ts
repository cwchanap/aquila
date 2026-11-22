import type {
    Locale,
    FlowConfig,
    StoryNoteCharacter,
    StoryNoteEvent,
    StoryNotes,
    Translations,
} from '@aquila/stories';
import type { StoryProgress } from './story-progress-store';
import { actLabel, extractActName } from './act-navigation';
import { flowDepths, passedSceneIds, visibleSceneIds } from './story-map';

type Flow = Pick<FlowConfig, 'start' | 'nodes'>;

/** The reader's currently displayed position, which can lead the saved one. */
export interface CharacterNotesLivePosition {
    sceneId: string;
    dialogueIndex: number;
}

export interface CharacterNotesFactView {
    id: string;
    text: string;
    /** Localized act provenance from the unlocking scene. */
    act: string;
}

export interface CharacterNotesCharacterView {
    id: string;
    hidden: boolean;
    met: boolean;
    /** The canonical name is only exposed after a reached `name` event. */
    nameKnown: boolean;
    /**
     * Safe visible label: the canonical name once known, otherwise a reached
     * speech label or authored known-as. Null while unmet so the UI can show
     * its generic anonymous row.
     */
    label: string | null;
    facts: CharacterNotesFactView[];
    factCount: number;
}

export interface CharacterNotesView {
    characters: CharacterNotesCharacterView[];
    /** Characters shown and met; hidden unmet characters are absent. */
    metCount: number;
}

type Progress = Pick<
    StoryProgress,
    'sceneId' | 'dialogueIndex' | 'visited' | 'endings'
>;

/**
 * Spoiler-safe character notes for one reading position. Visited means
 * entered, not finished: only fully passed scenes and the active scene up to
 * its displayed line unlock events. Pure; no storage or dialogue imports.
 */
export function selectCharacterNotes({
    notes,
    flow,
    progress,
    live,
    locale,
    t,
}: {
    notes: StoryNotes;
    flow: Flow;
    progress?: Progress | null;
    live?: CharacterNotesLivePosition | null;
    locale: Locale;
    t: Translations;
}): CharacterNotesView {
    const activeSceneId = live?.sceneId ?? progress?.sceneId ?? null;
    const activeIndex = live?.dialogueIndex ?? progress?.dialogueIndex ?? 0;
    const displayedIndex = Number.isFinite(activeIndex)
        ? Math.max(0, Math.trunc(activeIndex))
        : 0;

    const reachedScenes = new Set(progress?.visited ?? []);
    if (progress?.sceneId) reachedScenes.add(progress.sceneId);
    if (live?.sceneId) reachedScenes.add(live.sceneId);

    const passed = passedSceneIds(
        flow,
        {
            visited: [...reachedScenes],
            endings: progress?.endings ?? [],
        },
        activeSceneId
    );
    const currentRoute = activeSceneId
        ? visibleSceneIds(flow, null, activeSceneId)
        : new Set<string>();
    const depths = flowDepths(flow);

    const isReached = (event: StoryNoteEvent): boolean =>
        passed.has(event.sceneId) ||
        (event.sceneId === activeSceneId &&
            currentRoute.has(event.sceneId) &&
            event.entryIndex <= displayedIndex);

    const reachedByCharacter = new Map<string, StoryNoteEvent[]>();
    for (const event of notes.events) {
        if (!isReached(event)) continue;
        const events = reachedByCharacter.get(event.characterId);
        if (events) events.push(event);
        else reachedByCharacter.set(event.characterId, [event]);
    }

    const byDepth = (a: StoryNoteEvent, b: StoryNoteEvent): number =>
        (depths.get(a.sceneId) ?? Infinity) -
            (depths.get(b.sceneId) ?? Infinity) ||
        Number(currentRoute.has(b.sceneId)) -
            Number(currentRoute.has(a.sceneId)) ||
        a.entryIndex - b.entryIndex ||
        (a.sceneId < b.sceneId ? -1 : a.sceneId > b.sceneId ? 1 : 0);

    const firstSpeech = (
        events: StoryNoteEvent[]
    ): StoryNoteEvent | undefined =>
        events
            .filter(event => event.kind === 'speech' && event.labels)
            .sort(byDepth)[0];

    const label = (
        character: StoryNoteCharacter,
        events: StoryNoteEvent[]
    ): string | null => {
        if (events.length === 0) return null;
        if (events.some(event => event.kind === 'name')) {
            return character.name[locale];
        }
        const identity = events
            .filter(event => event.kind === 'speech' || event.kind === 'met')
            .sort(byDepth)[0];
        if (identity?.kind === 'speech') {
            return (
                identity.labels?.[locale] ??
                firstSpeech(events)?.labels?.[locale] ??
                character.knownAs?.[locale] ??
                null
            );
        }
        return (
            character.knownAs?.[locale] ??
            firstSpeech(events)?.labels?.[locale] ??
            null
        );
    };

    const facts = (
        character: StoryNoteCharacter,
        events: StoryNoteEvent[]
    ): CharacterNotesFactView[] => {
        const unlocked: CharacterNotesFactView[] = [];
        for (const fact of character.facts) {
            const unlock = events
                .filter(
                    event => event.kind === 'fact' && event.factId === fact.id
                )
                .sort(byDepth)[0];
            if (!unlock) continue;
            unlocked.push({
                id: fact.id,
                text: fact.text[locale],
                act: actLabel(extractActName(unlock.sceneId), t),
            });
        }
        return unlocked;
    };

    const characters: CharacterNotesCharacterView[] = [];
    for (const character of notes.characters) {
        const reached = reachedByCharacter.get(character.id) ?? [];
        const met = reached.length > 0;
        if (character.hidden && !met) continue;
        characters.push({
            id: character.id,
            hidden: character.hidden,
            met,
            nameKnown: reached.some(event => event.kind === 'name'),
            label: label(character, reached),
            facts: facts(character, reached),
            factCount: character.facts.length,
        });
    }

    return {
        characters,
        metCount: characters.filter(character => character.met).length,
    };
}
