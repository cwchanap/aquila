<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import type { DialogueEntry } from '@aquila/stories';
  import type { AudioAssetType } from '@aquila/stories/runtime-assets';
  import type { Locale } from '@aquila/stories';
  import { getTranslations, localeLangTag } from '@aquila/stories/translations';
  import { getCatalogEntry } from '@aquila/stories/catalog';
  import {
    hasStoryText,
    isRegisteredStoryId,
    loadStoryContent,
    resolveStoryTextLocale,
    supportsVisualMode,
    type AsyncStoryLoaderResult,
  } from '@aquila/stories/async';
  import { readerState } from '@/lib/reader-state.svelte';
  import { logger } from '@/lib/logger';
  import type { StoryProgress } from '@/lib/story-progress-store';
  import {
    readReaderMode,
    writeReaderMode,
    type ReaderMode,
  } from '@/lib/reader-mode';
  import {
    alignSecondDialogue,
    readSecondLanguage,
    secondChoiceLabels,
    secondLanguageOptions,
    writeSecondLanguage,
    type SecondLanguage,
  } from '@/lib/reader-second-language';
  import { readFurigana, writeFurigana } from '@/lib/reader-furigana';
  import {
    createSfxPlayer as createDefaultSfxPlayer,
  } from '@/lib/audio/sfx-player';
  import {
    createAudioRuntime as createDefaultAudioRuntime,
    type AudioReaderRuntime,
  } from '@/lib/audio/audio-runtime';
  import { readSfxEnabled, writeSfxEnabled } from '@/lib/audio/sfx-preference';
  import {
    createBgmPlayer as createDefaultBgmPlayer,
  } from '@/lib/audio/bgm-player';
  import { readBgmEnabled, writeBgmEnabled } from '@/lib/audio/bgm-preference';
  import {
    createVoicePlayer as createDefaultVoicePlayer,
  } from '@/lib/audio/voice-player';
  import {
    readVoiceEnabled,
    writeVoiceEnabled,
  } from '@/lib/audio/voice-preference';
  import {
    nextBgmSelection,
  } from '@/lib/audio/bgm-transition';
  import {
    isReaderInteractiveTarget,
    isReaderProgressionTarget,
  } from '@/lib/reader-interaction';
  import {
    nextSfxCommand,
    pendingSfxAfterTransition,
    sameLinePosition,
    type LinePosition,
  } from '@/lib/audio/sfx-transition';
  import {
    createVisualRuntime as createDefaultVisualRuntime,
    type RuntimeReleaseIdentity,
    type VisualReleaseIdentity,
    type VisualSnapshot,
    type VisualReaderRuntime,
  } from '@/lib/visual-assets';
  import {
    hasRealDecision,
    visibleSceneIds,
  } from '@/lib/story-map';
  import NovelReader from '@/components/NovelReader.svelte';
  import MobileNovelReader from '@/components/MobileNovelReader.svelte';
  import ReaderSettingsMenu from '@/components/ReaderSettingsMenu.svelte';
  import StoryMapSheet from '@/components/StoryMapSheet.svelte';
  import VisualNovelReader from '@/components/VisualNovelReader.svelte';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    onNavigate = () => {},
    onIndexChange = () => {},
    getSceneDialogue = () => null,
    getCurrentStoryProgressSnapshot = () => null,
    createVisualRuntime = createDefaultVisualRuntime,
    createSfxPlayer = createDefaultSfxPlayer,
    createBgmPlayer = createDefaultBgmPlayer,
    createVoicePlayer = createDefaultVoicePlayer,
    createAudioRuntime = createDefaultAudioRuntime,
    onRetry = () => {},
    showBookmarkButton = true,
    backUrl = '/',
    loadSecondLanguageContent = loadStoryContent,
  }: {
    onChoice?: (nextScene: string) => void;
    onBookmark?: (dialogueNumber: number) => void;
    onNext?: () => void;
    onNavigate?: (sceneId: string, at?: 'start' | 'end') => void;
    onIndexChange?: (index: number) => void;
    getSceneDialogue?: (
      storyId: string,
      sceneId: string
    ) => readonly DialogueEntry[] | null;
    getCurrentStoryProgressSnapshot?: () => StoryProgress | null;
    createVisualRuntime?: typeof createDefaultVisualRuntime;
    createSfxPlayer?: typeof createDefaultSfxPlayer;
    createBgmPlayer?: typeof createDefaultBgmPlayer;
    createVoicePlayer?: typeof createDefaultVoicePlayer;
    createAudioRuntime?: (
      storyId: string,
      origin: string
    ) => AudioReaderRuntime | null;
    onRetry?: () => void;
    showBookmarkButton?: boolean;
    backUrl?: string;
    loadSecondLanguageContent?: (
      storyId: string,
      locale: Locale
    ) => Promise<AsyncStoryLoaderResult>;
  } = $props();

  // Full reactive store->props bridge: every progressive field is derived here.
  let dialogue = $derived(readerState.dialogue);
  let choice = $derived(readerState.choice);
  let storyId = $derived(readerState.storyId);
  let currentSceneId = $derived(readerState.currentSceneId);
  let canGoNext = $derived(readerState.canGoNext);
  let locale = $derived(readerState.locale);
  let dialogueIndex = $derived(readerState.dialogueIndex);
  let activeFlow = $derived(readerState.activeFlow);
  let loadStatus = $derived(readerState.loadStatus);
  let loadError = $derived(readerState.loadError);
  let hasActivePayload = $derived(readerState.hasActivePayload);
  let isBlocking = $derived(
    loadStatus === 'loading' || loadStatus === 'error'
  );
  let t = $derived(getTranslations(locale));
  let readerReadyElement: HTMLElement | null = $state(null);
  // The saved choice applies to every story that has visuals; a text-only
  // story reads as text without overwriting it.
  let preferredMode = $state(readReaderMode());
  let visualModeAvailable = $derived(supportsVisualMode(storyId));
  let readerMode: ReaderMode = $derived(
    visualModeAvailable ? preferredMode : 'text'
  );
  // Second language for learners: a translation line under every story line.
  // The text is read in the page locale when the story has it, otherwise in
  // its zh source; the second language is any other language the story has.
  let secondLanguage = $state<SecondLanguage>(readSecondLanguage());
  let textLocale: Locale = $derived(
    isRegisteredStoryId(storyId)
      ? resolveStoryTextLocale(storyId, locale)
      : locale
  );
  // Offered only when the story has text in at least one other language.
  let secondLanguageChoices = $derived.by(() => {
    const choices = secondLanguageOptions(textLocale).map(option => ({
      locale: option,
      available: hasStoryText(storyId, option),
    }));
    return choices.some(option => option.available) ? choices : [];
  });
  let activeSecondLocale: Locale | null = $derived(
    secondLanguage !== 'off' &&
      secondLanguage !== textLocale &&
      hasStoryText(storyId, secondLanguage)
      ? secondLanguage
      : null
  );
  let secondStory = $state<{
    key: string;
    content: AsyncStoryLoaderResult;
  } | null>(null);
  let secondStoryKey = $derived(
    activeSecondLocale ? `${storyId}:${activeSecondLocale}` : null
  );
  let secondContent = $derived(
    secondStory && secondStory.key === secondStoryKey
      ? secondStory.content
      : null
  );
  let secondDialogue = $derived(
    secondContent
      ? alignSecondDialogue(
          dialogue,
          secondContent.dialogue[currentSceneId]
        )
      : null
  );
  let secondChoice = $derived.by(() => {
    if (!secondContent || !choice || !activeFlow) return null;
    const next = activeFlow.nodes.find(
      node => node.kind === 'scene' && node.sceneId === currentSceneId
    )?.next;
    if (!next?.startsWith('choice:')) return null;
    return secondChoiceLabels(
      choice,
      secondContent.choices[next.slice('choice:'.length)]
    );
  });
  let textLang = $derived(localeLangTag(textLocale));
  let secondLang = $derived(
    activeSecondLocale ? localeLangTag(activeSecondLocale) : undefined
  );

  $effect(() => {
    const key = secondStoryKey;
    const second = activeSecondLocale;
    const activeStoryId = storyId;
    if (!key || !second || secondStory?.key === key) return;
    void loadSecondLanguageContent(activeStoryId, second)
      .then(content => {
        if (!destroyed && secondStoryKey === key) {
          secondStory = { key, content };
        }
      })
      .catch(error => {
        // The main text stays readable; only the translation line is missing.
        logger.warn('Second-language text unavailable', {
          storyId: activeStoryId,
          locale: second,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });

  function setSecondLanguage(value: SecondLanguage): void {
    if (secondLanguage === value) return;
    secondLanguage = value;
    writeSecondLanguage(value);
  }

  // Furigana over Japanese text, whether it is the story text or the
  // second language.
  let furigana = $state(readFurigana());
  let furiganaAvailable = $derived(
    textLocale === 'ja' || activeSecondLocale === 'ja'
  );

  function setFurigana(on: boolean): void {
    furigana = on;
    writeFurigana(on);
  }

  let audioRuntime: AudioReaderRuntime | null = $state(null);
  let audioReleaseIdentity: RuntimeReleaseIdentity | null = $state(null);
  let audioRuntimeStoryId: string | null = $state(null);
  let audioRuntimeAttempted = $state(false);
  let audioInitialLoadPending = $state(false);
  let sfxEnabled = $state(readSfxEnabled());
  let bgmEnabled = $state(readBgmEnabled());
  const sfxPlayer = createSfxPlayer(
    undefined,
    cueKey => resolveAudioPlayerUrl('sfx', cueKey)
  );
  const bgmPlayer = createBgmPlayer(
    undefined,
    cueKey => resolveAudioPlayerUrl('bgm', cueKey)
  );
  let voiceEnabled = $state(readVoiceEnabled());
  const voicePlayer = createVoicePlayer();
  let selectedBgmKey: string | null = null;
  let bgmActivated = false;
  let visualRuntime: VisualReaderRuntime | null = $state(null);
  let visualStatus = $state<VisualSnapshot['status']>(null);
  // Identity of the validated release serving visuals. Held in shell state
  // (not in the visual leaf) so the data-asset-* attributes on the reader-ready
  // host survive text-mode switches and responsive leaf remounts.
  let visualIdentity = $state<VisualReleaseIdentity | null>(null);
  let visualRuntimeStoryId: string | null = $state(null);
  let visualRuntimeAttempted = $state(false);
  let runtimeTransitioning = $state(false);
  let runtimeGeneration = 0;
  let destroyed = false;
  let removeVisibilityListener = () => {};
  let visualStatusText = $derived(
    readerMode !== 'visual'
      ? null
      : visualStatus === 'stale'
        ? t.reader.visualStaleRelease
        : visualStatus === 'fallback'
          ? t.reader.visualAssetFallback
          : visualStatus === 'unavailable'
            ? t.reader.visualUnavailable
            : null
  );

  function setReaderMode(mode: ReaderMode): void {
    if (readerMode === mode) return;
    if (mode === 'visual' && !visualModeAvailable) return;
    if (mode === 'text') {
      sfxPlayer.stop();
      voicePlayer.stop();
      bgmPlayer.stop();
      bgmActivated = false;
    }
    const retainedRuntime =
      mode === 'visual' &&
      visualRuntimeStoryId === storyId
        ? visualRuntime
        : null;
    const retainedAudioRuntime =
      mode === 'visual' &&
      audioRuntimeStoryId === storyId
        ? audioRuntime
        : null;
    preferredMode = mode;
    writeReaderMode(mode);
    if (retainedRuntime) void retainedRuntime.softRevalidate();
    if (retainedAudioRuntime && !audioInitialLoadPending) {
      softRevalidateAudioRuntime();
    }
  }

  function runtimeOrigin(): string {
    return globalThis.location?.origin ?? 'http://localhost';
  }

  function handleVisualStatusChange(
    status: VisualSnapshot['status']
  ): void {
    visualStatus = status;
  }

  function resolveAudioPlayerUrl(
    type: AudioAssetType,
    cueKey: string
  ): string | undefined {
    const runtime = audioRuntime;
    if (!runtime) {
      logger.warn('Visual-novel audio unavailable', {
        type,
        cueKey,
        reason: 'runtime-unavailable',
      });
      return undefined;
    }
    const result = runtime.resolve(type, cueKey);
    if (result.status === 'unavailable') {
      logger.warn('Visual-novel audio cue unavailable', {
        type,
        cueKey,
        reason: result.reason,
      });
      return undefined;
    }
    return result.url;
  }

  function ensureVisualRuntime(activeStoryId: string): void {
    if (
      destroyed ||
      runtimeTransitioning ||
      (visualRuntimeAttempted &&
        visualRuntimeStoryId === activeStoryId)
    ) {
      return;
    }
    visualRuntimeStoryId = activeStoryId;
    visualRuntimeAttempted = true;
    visualRuntime = createVisualRuntime(
      activeStoryId,
      runtimeOrigin(),
      getSceneDialogue
    );
  }

  function currentLinePosition(): LinePosition {
    return {
      storyId,
      sceneId: currentSceneId,
      index: dialogueIndex,
    };
  }

  function finishInitialAudioLoad(
    activeStoryId: string,
    generation: number,
    identity: RuntimeReleaseIdentity | null
  ): void {
    if (
      destroyed ||
      generation !== runtimeGeneration ||
      audioRuntimeStoryId !== activeStoryId
    ) {
      return;
    }

    audioReleaseIdentity = identity;
    audioInitialLoadPending = false;
    // Drop any SFX that was queued while the release was loading — replaying
    // it here would call HTMLAudioElement.play() outside the user gesture that
    // caused the transition, which WebKit rejects (and the players swallow the
    // rejection). BGM is not replayed either; the next eligible reader
    // interaction (pointerdown on the reader-ready host) calls activateBgm(),
    // which starts armed BGM now that audioInitialLoadPending is false.
  }

  function ensureAudioRuntime(activeStoryId: string): void {
    if (
      destroyed ||
      runtimeTransitioning ||
      (audioRuntimeAttempted && audioRuntimeStoryId === activeStoryId)
    ) {
      return;
    }
    audioRuntimeStoryId = activeStoryId;
    audioRuntimeAttempted = true;
    const runtime = createAudioRuntime(activeStoryId, runtimeOrigin());
    audioRuntime = runtime;
    audioReleaseIdentity = null;
    if (!runtime) {
      audioInitialLoadPending = false;
      return;
    }

    audioInitialLoadPending = true;
    const generation = runtimeGeneration;
    void runtime
      .loadActiveRelease()
      .then(identity =>
        finishInitialAudioLoad(activeStoryId, generation, identity)
      )
      .catch(() => {
        if (
          !destroyed &&
          generation === runtimeGeneration &&
          audioRuntimeStoryId === activeStoryId
        ) {
          audioInitialLoadPending = false;
        }
      });
  }

  function softRevalidateAudioRuntime(): void {
    const runtime = audioRuntime;
    if (!runtime) return;
    const activeStoryId = audioRuntimeStoryId;
    const generation = runtimeGeneration;
    void runtime
      .softRevalidate()
      .then(identity => {
        if (
          !destroyed &&
          generation === runtimeGeneration &&
          activeStoryId !== null &&
          audioRuntimeStoryId === activeStoryId &&
          storyId === activeStoryId
        ) {
          audioReleaseIdentity = identity;
        }
      })
      .catch(() => {
        // Soft revalidation is best-effort; retain the accepted identity.
      });
  }

  async function disposeRuntimesForStoryChange(
    nextStoryId: string
  ): Promise<void> {
    const generation = ++runtimeGeneration;
    const visual = visualRuntime;
    const audio = audioRuntime;
    visualRuntime = null;
    audioRuntime = null;
    visualIdentity = null;
    audioReleaseIdentity = null;
    visualRuntimeStoryId = nextStoryId;
    audioRuntimeStoryId = nextStoryId;
    visualRuntimeAttempted = false;
    audioRuntimeAttempted = false;
    audioInitialLoadPending = false;
    runtimeTransitioning = true;
    try {
      audio?.dispose();
    } catch {
      // Swallow disposal errors — the runtime is being replaced regardless.
    }
    try {
      await visual?.dispose();
    } catch {
      // Swallow disposal errors — fire-and-forget must not produce
      // unhandled rejections. The runtime is being replaced regardless.
    }
    if (destroyed || generation !== runtimeGeneration) return;
    runtimeTransitioning = false;
  }

  $effect(() => {
    const activeStoryId = storyId;
    const wantsVisualRuntime =
      readerMode === 'visual' &&
      hasActivePayload &&
      activeFlow !== null;
    const wantsAudioRuntime =
      wantsVisualRuntime && (sfxEnabled || bgmEnabled);
    if (runtimeTransitioning) return;
    if (
      (visualRuntimeStoryId !== null &&
        visualRuntimeStoryId !== activeStoryId) ||
      (audioRuntimeStoryId !== null && audioRuntimeStoryId !== activeStoryId)
    ) {
      void disposeRuntimesForStoryChange(activeStoryId);
      return;
    }
    if (wantsVisualRuntime) ensureVisualRuntime(activeStoryId);
    if (wantsAudioRuntime) ensureAudioRuntime(activeStoryId);
  });

  // Track the validated release identity on the shell itself: the visual leaf
  // subscribes for its layers, but it unmounts on text-mode switches and
  // responsive remounts, so the identity must live here and be rendered on the
  // stable `reader-ready` host. Clearing the runtime clears the identity.
  $effect(() => {
    const runtime = visualRuntime;
    if (!runtime) {
      visualIdentity = null;
      return;
    }
    return runtime.controller.subscribe((snapshot) => {
      visualIdentity = snapshot.releaseIdentity;
    });
  });

  let lastActivePosition: LinePosition | null = $state(null);
  $effect(() => {
    const nextPosition = currentLinePosition();
    const previous = lastActivePosition;
    if (sameLinePosition(previous, nextPosition)) return;
    lastActivePosition = nextPosition;

    if (
      previous !== null &&
      readerMode === 'visual' &&
      visualRuntime &&
      visualRuntimeStoryId === storyId
    ) {
      void visualRuntime.softRevalidate();
    }

    const command = nextSfxCommand(
      previous,
      nextPosition,
      dialogue[dialogueIndex]?.sfx,
      { mode: readerMode, enabled: sfxEnabled, flow: activeFlow }
    );
    const delayed = pendingSfxAfterTransition(
      command,
      nextPosition,
      audioInitialLoadPending
    );
    if (!delayed) {
      if (command.type === 'play') {
        sfxPlayer.play(command.cueKey);
      } else if (command.type === 'stop') {
        sfxPlayer.stop();
      }
    }

    // Voice follows the line on screen; one dub plays for every language.
    if (readerMode === 'visual' && voiceEnabled) {
      voicePlayer.play(nextPosition.sceneId, dialogueIndex);
    } else {
      voicePlayer.stop();
    }

    const storyChanged =
      previous !== null && previous.storyId !== nextPosition.storyId;

    if (storyChanged) {
      bgmPlayer.stop();
      selectedBgmKey = null;
      bgmActivated = false;
    }

    const previousBgmKey = selectedBgmKey;
    const previousSceneLength =
      previous && previous.sceneId !== nextPosition.sceneId
        ? getSceneDialogue(previous.storyId, previous.sceneId)?.length ?? null
        : null;
    const nextBgmKey = nextBgmSelection(
      previous,
      nextPosition,
      dialogue,
      selectedBgmKey,
      activeFlow,
      previousSceneLength
    );
    selectedBgmKey = nextBgmKey;

    if (!storyChanged && previousBgmKey !== null && nextBgmKey === null) {
      bgmPlayer.stop();
    } else if (
      nextBgmKey !== null &&
      nextBgmKey !== previousBgmKey &&
      bgmActivated &&
      bgmEnabled &&
      !audioInitialLoadPending
    ) {
      bgmPlayer.play(nextBgmKey);
    }
  });

  $effect(() => {
    if (readerMode === 'visual' && voiceEnabled && storyId) {
      const loadingStoryId = storyId;
      void voicePlayer.load(loadingStoryId).then(ready => {
        // Speak the line on screen: it may have tried before the index
        // arrived, or Voice / Visual mode was just turned back on.
        if (
          ready &&
          !destroyed &&
          storyId === loadingStoryId &&
          readerMode === 'visual' &&
          voiceEnabled
        ) {
          voicePlayer.play(currentSceneId, dialogueIndex);
        }
      });
    }
  });

  // Svelte updates `inert` as a DOM property, which does not reflect to an
  // attribute in every runtime. Keep the actual attribute synchronized so
  // assistive technology, CSS selectors, and the inert polyfill all observe
  // the blocking state without replacing the mounted reader subtree.
  $effect(() => {
    if (!readerReadyElement) return;
    if (leafDisabled) readerReadyElement.setAttribute('inert', '');
    else readerReadyElement.removeAttribute('inert');
  });

  function loadErrorMessage(): string {
    if (loadError?.code === 'unknown-story') return t.reader.unknownStory;
    if (loadError?.code === 'unsupported-locale') {
      return t.reader.unsupportedLocale;
    }
    return t.reader.storyLoadFailed;
  }

  const MOBILE_QUERY = '(max-width: 1023px)';
  function readMatch(): boolean {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }
    return window.matchMedia(MOBILE_QUERY).matches;
  }
  let isMobile = $state(readMatch());
  let settingsOpen = $state(false);
  let leafOverlayOpen = $state(false);
  let storyMapOpen = $state(false);
  let storyMapProgress = $state<StoryProgress | null>(null);
  let restoreMobileMenuFocus = $state(false);
  let settingsAvailable = $derived(
    readerMode === 'visual' || !isMobile || isBlocking
  );
  let leafDisabled = $derived(isBlocking || settingsOpen || storyMapOpen);
  let activeChoices = $derived(readerState.activeChoices);
  let storyMapAvailable = $derived(
    activeFlow !== null && hasRealDecision(activeFlow)
  );
  let storyTitle = $derived.by(() => {
    const id = readerState.storyId;
    if (id === null) return '';
    const key = getCatalogEntry(id)?.translationKey;
    return (
      (t.stories as unknown as Record<string, string>)[key ?? ''] ?? id
    );
  });
  let storyMapVisibleIds = $derived.by(
    (): ReadonlySet<string> | undefined => {
      if (!storyMapAvailable || !activeFlow) return undefined;
      return visibleSceneIds(activeFlow, storyMapProgress, currentSceneId);
    }
  );
  let storyMapFocusTarget = $derived.by((): HTMLElement | null => {
    if (!storyMapOpen || typeof document === 'undefined') return null;
    const id =
      readerMode === 'text' && isMobile
        ? 'mobile-reader-menu-trigger'
        : 'reader-settings-trigger';
    return document.getElementById(id);
  });

  async function changeReaderMode(mode: ReaderMode): Promise<void> {
    leafOverlayOpen = false;
    setReaderMode(mode);
    await tick();
    const triggerId =
      mode === 'text' && isMobile && !isBlocking
        ? 'mobile-reader-menu-trigger'
        : 'reader-settings-trigger';
    document.getElementById(triggerId)?.focus();
  }

  function setSfxEnabled(enabled: boolean): void {
    if (sfxEnabled === enabled) return;
    sfxEnabled = enabled;
    writeSfxEnabled(enabled);
    if (!enabled) {
      sfxPlayer.stop();
    }
  }

  function setVoiceEnabled(enabled: boolean): void {
    if (voiceEnabled === enabled) return;
    voiceEnabled = enabled;
    writeVoiceEnabled(enabled);
    if (!enabled) {
      voicePlayer.stop();
    }
  }

  function activateBgm(event?: PointerEvent | KeyboardEvent): void {
    if (readerMode !== 'visual' || leafDisabled) return;
    if (
      event &&
      isReaderInteractiveTarget(event.target) &&
      !isReaderProgressionTarget(event.target)
    ) {
      return;
    }
    bgmActivated = true;
    voicePlayer.resume();
    if (bgmEnabled && selectedBgmKey && !audioInitialLoadPending) {
      bgmPlayer.play(selectedBgmKey);
    }
  }

  function handleBgmActivationKey(event: KeyboardEvent): void {
    if (readerMode !== 'visual' || leafDisabled) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target ?? document.activeElement;
    if (
      isReaderInteractiveTarget(target) &&
      !isReaderProgressionTarget(target)
    ) {
      return;
    }
    activateBgm();
  }

  function setBgmEnabled(enabled: boolean): void {
    if (bgmEnabled === enabled) return;
    bgmEnabled = enabled;
    writeBgmEnabled(enabled);

    if (!enabled) {
      bgmActivated = false;
      bgmPlayer.stop();
      return;
    }

    if (readerMode === 'visual' && selectedBgmKey) {
      bgmActivated = true;
      if (!audioInitialLoadPending) bgmPlayer.play(selectedBgmKey);
    }
  }

  function handleVisualOverlayChange(open: boolean): void {
    leafOverlayOpen = open;
  }

  $effect.pre(() => {
    if (storyMapOpen && !(storyMapAvailable && activeChoices !== null)) {
      storyMapOpen = false;
    }
  });

  $effect(() => {
    void readerState.storyId;
    void readerState.currentSceneId;
    untrack(() => {
      storyMapProgress = getCurrentStoryProgressSnapshot();
    });
  });

  function openStoryMap(): void {
    if (!storyMapAvailable || storyMapOpen) return;
    storyMapProgress = getCurrentStoryProgressSnapshot();
    storyMapOpen = true;
  }

  async function closeStoryMap(): Promise<void> {
    if (!storyMapOpen) return;
    storyMapOpen = false;
    await tick();
  }

  function handleStoryMapJump(sceneId: string, at?: 'start' | 'end'): void {
    if (!hasActivePayload) return;
    onNavigate(sceneId, at);
    if (storyMapOpen) void closeStoryMap();
  }

  $effect.pre(() => {
    if (settingsAvailable) return;
    const focusWasInSettings =
      document.activeElement?.closest('[data-reader-settings]') !== null;
    if (focusWasInSettings) restoreMobileMenuFocus = true;
    if (settingsOpen) settingsOpen = false;
  });

  $effect(() => {
    if (settingsAvailable || !restoreMobileMenuFocus) return;
    restoreMobileMenuFocus = false;
    void tick().then(() => {
      document.getElementById('mobile-reader-menu-trigger')?.focus();
    });
  });

  // Tracks whether ANY leaf reader has ever mounted in this ReaderShell
  // instance. The first leaf to mount sees `isInitialMount=true` (a genuine
  // fresh scene start — animate line 0 per spec). On a responsive-breakpoint
  // swap, the old leaf unmounts and a NEW leaf mounts; that new leaf sees
  // `isInitialMount=false` and snaps the current line instead of re-typing it,
  // even at index 0. Without this signal the leaf cannot distinguish a
  // breakpoint remount at index 0 from a fresh scene start at index 0.
  //
  // The flip waits for the first payload-backed leaf's mount effects to flush,
  // rather than ReaderShell's own mount. Task 7 mounts the shell before its
  // initial async payload exists; flipping on the shell mount would make that
  // eventual first leaf look like a responsive remount and incorrectly snap.
  let everMounted = $state(false);
  let isInitialMount = $derived(!everMounted);

  $effect(() => {
    if (everMounted || !hasActivePayload || !activeFlow) return;
    void tick().then(() => {
      if (readerState.hasActivePayload && readerState.activeFlow) {
        everMounted = true;
      }
    });
  });

  onMount(() => {
    const handleVisibility = (): void => {
      if (
        document.visibilityState === 'visible' &&
        readerMode === 'visual' &&
        visualRuntime &&
        visualRuntimeStoryId === storyId
      ) {
        void visualRuntime.softRevalidate();
      }
      if (
        document.visibilityState === 'visible' &&
        readerMode === 'visual' &&
        audioRuntime &&
        audioRuntimeStoryId === storyId &&
        !audioInitialLoadPending
      ) {
        softRevalidateAudioRuntime();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    removeVisibilityListener = () =>
      document.removeEventListener('visibilitychange', handleVisibility);

    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }
    const mql = window.matchMedia(MOBILE_QUERY);
    const update = (e: globalThis.MediaQueryListEvent) => {
      isMobile = e.matches;
    };
    isMobile = mql.matches;
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  });

  onDestroy(() => {
    destroyed = true;
    runtimeGeneration += 1;
    removeVisibilityListener();
    const audio = audioRuntime;
    audioRuntime = null;
    audioReleaseIdentity = null;
    audioRuntimeStoryId = null;
    audioRuntimeAttempted = false;
    audioInitialLoadPending = false;
    sfxPlayer.dispose();
    voicePlayer.dispose();
    bgmPlayer.dispose();
    try {
      audio?.dispose();
    } catch {
      // Swallow disposal errors on destroy — component is gone regardless.
    }
    const runtime = visualRuntime;
    visualRuntime = null;
    void runtime?.dispose().catch(() => {
      // Swallow disposal errors on destroy — component is gone regardless.
    });
  });
</script>

<svelte:window onkeydown={handleBgmActivationKey} />

{#snippet loadSurface()}
  {#if loadStatus === 'error'}
    <div
      role="alert"
      class="flex flex-col items-center gap-4 rounded-2xl bg-slate-950/90 p-8 text-center text-white shadow-2xl"
    >
      <p>{loadErrorMessage()}</p>
      {#if loadError?.code === 'load-failed'}
        <button
          type="button"
          class="rounded-lg bg-white px-5 py-2 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          onclick={onRetry}
        >
          {t.reader.retry}
        </button>
      {:else}
        <a
          class="rounded-lg bg-white px-5 py-2 font-semibold text-slate-900 transition-colors hover:bg-slate-100"
          href={`/${locale}/stories`}
        >
          {t.reader.backToStories}
        </a>
      {/if}
    </div>
  {:else}
    <div
      role="status"
      class="rounded-2xl bg-slate-950/90 p-8 text-center text-white shadow-2xl"
    >
      {t.reader.loadingStory}
    </div>
  {/if}
{/snippet}

{#if settingsAvailable}
  <ReaderSettingsMenu
    bind:open={settingsOpen}
    {locale}
    mode={readerMode}
    {visualModeAvailable}
    onModeChange={changeReaderMode}
    {sfxEnabled}
    onSfxEnabledChange={setSfxEnabled}
    {bgmEnabled}
    onBgmEnabledChange={setBgmEnabled}
    {voiceEnabled}
    onVoiceEnabledChange={setVoiceEnabled}
    {secondLanguage}
    secondLanguageOptions={secondLanguageChoices}
    onSecondLanguageChange={setSecondLanguage}
    {furigana}
    {furiganaAvailable}
    onFuriganaChange={setFurigana}
    onBookmark={() => onBookmark(dialogueIndex + 1)}
    {showBookmarkButton}
    {backUrl}
    bookmarkDisabled={isBlocking}
    triggerUnavailable={storyMapOpen || (leafOverlayOpen && !isBlocking)}
    {storyMapAvailable}
    onOpenStoryMap={openStoryMap}
  />
{/if}

{#if visualStatusText}
  <p
    data-testid="visual-status"
    class="fixed z-[80] m-0 max-w-[min(32rem,calc(100vw-2rem))] rounded-full bg-amber-900/90 px-4 py-2 text-center text-amber-100 shadow-lg backdrop-blur-sm"
    style="top: calc(4.25rem + env(safe-area-inset-top)); right: calc(0.75rem + env(safe-area-inset-right));"
    role="status"
    aria-live="polite"
  >
    {visualStatusText}
  </p>
{/if}

{#if hasActivePayload && activeFlow}
  <div class="relative min-h-screen">
    <div
      bind:this={readerReadyElement}
      data-testid="reader-ready"
      onpointerdown={activateBgm}
      data-asset-environment={visualIdentity?.assetEnvironment}
      data-asset-preview-id={visualIdentity?.previewId ?? undefined}
      data-asset-release-id={visualIdentity?.releaseId}
      data-asset-manifest-sha256={visualIdentity?.manifestSha256}
      data-audio-environment={audioReleaseIdentity?.assetEnvironment}
      data-audio-preview-id={audioReleaseIdentity?.previewId ?? undefined}
      data-audio-release-id={audioReleaseIdentity?.releaseId}
      data-audio-manifest-sha256={audioReleaseIdentity?.manifestSha256}
      aria-hidden={leafDisabled ? 'true' : undefined}
    >
      {#if readerMode === 'visual'}
        <VisualNovelReader
          {secondDialogue}
          {secondChoice}
          {textLang}
          {secondLang}
          {furigana}
          controller={visualRuntimeStoryId === storyId
            ? visualRuntime?.controller ?? null
            : null}
          flow={activeFlow}
          {dialogueIndex}
          {onIndexChange}
          {dialogue}
          {choice}
          {storyId}
          {currentSceneId}
          {canGoNext}
          {locale}
          {onChoice}
          {onNext}
          {onNavigate}
          onVisualStatusChange={handleVisualStatusChange}
          onOverlayChange={handleVisualOverlayChange}
          {isInitialMount}
          interactionDisabled={leafDisabled}
          visibleSceneIds={storyMapVisibleIds}
        />
      {:else if isMobile}
        <MobileNovelReader
          {secondDialogue}
          {secondChoice}
          {textLang}
          {secondLang}
          {furigana}
          flow={activeFlow}
          {dialogueIndex}
          {onIndexChange}
          {dialogue}
          {choice}
          {storyId}
          {currentSceneId}
          {canGoNext}
          {locale}
          {onChoice}
          {onBookmark}
          {onNext}
          {onNavigate}
          {backUrl}
          {showBookmarkButton}
          onModeChange={changeReaderMode}
          {visualModeAvailable}
          {secondLanguage}
          {secondLanguageChoices}
          onSecondLanguageChange={setSecondLanguage}
          {furiganaAvailable}
          onFuriganaChange={setFurigana}
          {isInitialMount}
          interactionDisabled={leafDisabled}
          visibleSceneIds={storyMapVisibleIds}
          {storyMapAvailable}
          onOpenStoryMap={openStoryMap}
        />
      {:else}
        <NovelReader
          {secondDialogue}
          {secondChoice}
          {textLang}
          {secondLang}
          {furigana}
          flow={activeFlow}
          {dialogueIndex}
          {onIndexChange}
          {dialogue}
          {choice}
          {storyId}
          {currentSceneId}
          {canGoNext}
          {locale}
          {onChoice}
          {onNext}
          {onNavigate}
          {isInitialMount}
          interactionDisabled={leafDisabled}
          visibleSceneIds={storyMapVisibleIds}
        />
      {/if}
    </div>

    {#if isBlocking}
      <div class="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-6">
        {@render loadSurface()}
      </div>
    {/if}
  </div>
{:else}
  <div class="flex min-h-screen items-center justify-center bg-slate-950 p-6">
    {@render loadSurface()}
  </div>
{/if}

{#if hasActivePayload && activeFlow && activeChoices}
  <StoryMapSheet
    open={storyMapOpen}
    flow={activeFlow}
    choices={activeChoices}
    {storyTitle}
    currentSceneId={currentSceneId ?? ''}
    {dialogueIndex}
    lineCount={dialogue.length}
    progress={storyMapProgress}
    {t}
    onJump={handleStoryMapJump}
    onClose={() => void closeStoryMap()}
    restoreFocusTarget={storyMapFocusTarget}
  />
{/if}
