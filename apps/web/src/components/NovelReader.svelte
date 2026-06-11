<script lang="ts">
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories';
  import { untrack } from 'svelte';
  import ActPanel from '@/components/ActPanel.svelte';
  import { readerState } from '@/lib/reader-state.svelte';

  let {
    onChoice = () => {},
    onBookmark = () => {},
    onNext = () => {},
    showBookmarkButton = true,
    backUrl = '/',
    initialDialogueIndex = null,
    onNavigate = () => {},
    dialogue: dialogueProp = undefined,
    choice: choiceProp = undefined,
    storyId: storyIdProp = undefined,
    currentSceneId: currentSceneIdProp = undefined,
    canGoNext: canGoNextProp = undefined,
    locale: localeProp = undefined,
  }: {
    onChoice: (nextScene: string) => void;
    onBookmark: (dialogueNumber: number) => void;
    onNext: () => void;
    showBookmarkButton: boolean;
    backUrl: string;
    initialDialogueIndex: number | null;
    onNavigate: (sceneId: string) => void;
    dialogue?: DialogueEntry[];
    choice?: ChoiceDefinition | null;
    storyId?: string;
    currentSceneId?: string;
    canGoNext?: boolean;
    locale?: Locale;
  } = $props();

  let dialogue = $derived(
    dialogueProp !== undefined ? dialogueProp : readerState.dialogue
  );
  let choice = $derived(
    choiceProp !== undefined ? choiceProp : readerState.choice
  );
  let storyId = $derived(
    storyIdProp !== undefined ? storyIdProp : readerState.storyId
  );
  let currentSceneId = $derived(
    currentSceneIdProp !== undefined ? currentSceneIdProp : readerState.currentSceneId
  );
  let canGoNext = $derived(
    canGoNextProp !== undefined ? canGoNextProp : readerState.canGoNext
  );
  let locale = $derived(
    (localeProp !== undefined ? localeProp : readerState.locale) as Locale
  );

  let t = $derived(getTranslations(locale));

  let currentDialogueIndex = $state(0);
  let displayedDialogues: {
    text: string;
    characterName: string;
    characterId?: string;
  } = $state([]);
  let isTyping = $state(false);
  let typingSpeed = 30;
  let skipTyping = $state(false);
  let typingText = $state('');
  let lastDialogueSnapshot = $state('');
  let dialogueContainer: HTMLElement | null = $state(null);
  let hasAppliedInitialIndex = $state(false);
  let hasUserAdvanced = $state(false);
  let showActPanel = $state(false);
  let sceneVersion = $state(0);

  let currentDialogue = $derived(dialogue[currentDialogueIndex]);
  let isLastDialogue = $derived(currentDialogueIndex >= dialogue.length - 1);

  function getCharacterName(dialogueEntry: DialogueEntry | undefined): string {
    if (!dialogueEntry) return '';

    // Prefer the emitted displayName (preserves author's intent for
    // aliases / role labels like "健談男大生" before the character is named).
    if (dialogueEntry.character) {
      return dialogueEntry.character;
    }

    if (dialogueEntry.characterId) {
      const characterId = dialogueEntry.characterId;
      const localizedName =
        (t as Record<string, unknown>).characterNames &&
        typeof (t as Record<string, unknown>).characterNames === 'object'
          ? ((
              t as {
                characterNames?: Record<string, string>;
              }
            ).characterNames?.[characterId] ?? undefined)
          : undefined;

      if (localizedName) {
        return localizedName;
      }

      return t.reader.unknown;
    }

    return '';
  }

  // Reset displayed dialogues when dialogue array changes (new scene)
  $effect(() => {
    const snapshot = JSON.stringify(dialogue);
    if (snapshot !== lastDialogueSnapshot) {
      lastDialogueSnapshot = snapshot;
      sceneVersion++;
      currentDialogueIndex = 0;
      displayedDialogues = [];
      skipTyping = false;
      isTyping = false;
      typingText = '';
      hasUserAdvanced = false;
      hasAppliedInitialIndex = false;
    }
  });

  // Apply initial dialogue index (if provided) once per mount
  $effect(() => {
    if (
      !hasAppliedInitialIndex &&
      initialDialogueIndex !== null &&
      initialDialogueIndex >= 0 &&
      dialogue.length > 0
    ) {
      const targetIndex = Math.min(initialDialogueIndex, dialogue.length - 1);

      displayedDialogues = [];
      isTyping = false;
      skipTyping = false;
      typingText = '';

      for (let i = 0; i <= targetIndex; i++) {
        const entry = dialogue[i];
        if (!entry) break;
        addDialogueToDisplay(entry.dialogue, entry);
      }

      currentDialogueIndex = targetIndex;
      hasAppliedInitialIndex = true;
    }
  });

  // Start typing new dialogue when index changes
  $effect(() => {
    if (
      dialogue[currentDialogueIndex] &&
      displayedDialogues.length === currentDialogueIndex &&
    (!hasAppliedInitialIndex || hasUserAdvanced)
    ) {
      // untrack prevents skipTyping (read inside startTypingNewDialogue)
      // from becoming an implicit dependency of this effect.
      untrack(() => startTypingNewDialogue());
    }
  });

  function startTypingNewDialogue() {
    const dialogueEntry = dialogue[currentDialogueIndex];
    if (!dialogueEntry) return;

    if (!skipTyping) {
      typingText = '';
      isTyping = true;
      // Capture current scene version for cancellation guard
      const version = sceneVersion;
      // Scroll to bottom when starting new dialogue
      globalThis.setTimeout(() => {
        if (dialogueContainer) {
          dialogueContainer.scrollTop = dialogueContainer.scrollHeight;
        }
      }, 50);
      const executeTyping = async () => {
        await typeText(dialogueEntry.dialogue, dialogueEntry, version);
      };
      void executeTyping();
    } else {
      addDialogueToDisplay(dialogueEntry.dialogue, dialogueEntry);
      isTyping = false;
    }
  }

  function addDialogueToDisplay(
    text: string,
    entry: DialogueEntry | undefined = currentDialogue
  ) {
    const characterName = getCharacterName(entry);
    displayedDialogues = [
      ...displayedDialogues,
      {
        text,
        characterName,
        characterId: entry?.characterId,
      },
    ];

    // Auto-scroll to bottom after adding new dialogue
    globalThis.setTimeout(() => {
      if (dialogueContainer) {
        dialogueContainer.scrollTop = dialogueContainer.scrollHeight;
      }
    }, 50);
  }

  async function typeText(
    text: string,
    entry: DialogueEntry | undefined = currentDialogue,
    version?: number
  ): Promise<void> {
    for (let i = 0; i < text.length; i++) {
      // Cancel if scene changed since typing started
      if (version !== undefined && version !== sceneVersion) {
        return;
      }
      if (skipTyping) {
        typingText = text;
        break;
      }
      typingText = text.slice(0, i + 1);
      await new Promise<void>(resolve =>
        globalThis.setTimeout(resolve, typingSpeed)
      );
    }
    // Only finalize if scene hasn't changed
    if (version !== undefined && version !== sceneVersion) {
      return;
    }
    addDialogueToDisplay(text, entry);
    isTyping = false;
  }

  function handleNext() {
    if (isTyping) {
      skipTyping = true;
      return;
    }

    hasUserAdvanced = true;

    if (currentDialogueIndex < dialogue.length - 1) {
      currentDialogueIndex++;
      skipTyping = false;
    } else if (canGoNext && !choice) {
      onNext();
    }
  }

  function handleChoice(nextScene: string) {
    onChoice(nextScene);
  }

  function handleKeyPress(event: globalThis.KeyboardEvent) {
    if (event.defaultPrevented) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    if (showActPanel) {
      return;
    }

    const activeElement = globalThis.document
      .activeElement as HTMLElement | null;
    const rawTarget = (event.target ?? activeElement) as unknown;
    const target = rawTarget instanceof HTMLElement ? rawTarget : activeElement;

    if (target) {
      const tagName = target.tagName.toLowerCase();
      const interactiveTags = ['input', 'textarea', 'select', 'option', 'button', 'a'];
      const hasEditableAttr =
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true';

      if (interactiveTags.includes(tagName) || hasEditableAttr) {
        return;
      }
    }
    event.preventDefault();
    handleNext();
  }
</script>

<svelte:window on:keydown={handleKeyPress} />

<div
  class="novel-reader min-h-screen bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400 flex overflow-hidden"
>
  <!-- Left panel -- embedded toggle, slider animation -->
  <aside class="flex-shrink-0 h-screen relative z-30">
    {#if storyId && currentSceneId}
      <ActPanel
        {storyId}
        {currentSceneId}
        open={showActPanel}
        onToggle={() => (showActPanel = !showActPanel)}
        onNavigate={(sceneId: string) => {
          if (sceneId !== currentSceneId) {
            onNavigate(sceneId);
          }
        }}
        {locale}
      />
    {/if}
  </aside>

  <!-- Main content area -->
  <main class="flex-1 flex items-center justify-center p-6 relative min-w-0">
    <!-- Back button at top right -->
    <div class="absolute top-6 right-6 z-10">
      <a
        href={backUrl}
        class="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
      >
        {t.common.backToHome}
      </a>
    </div>

    <div class="w-full max-w-4xl">
    <!-- Main dialogue box with glassmorphism style -->
    <div
      bind:this={dialogueContainer}
      class="bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/50 max-h-[70vh] overflow-y-auto scroll-smooth"
    >
      <!-- Display all accumulated dialogues -->
      {#each displayedDialogues as dialogueItem, index (index)}
        <div
          class="mb-6 {index < displayedDialogues.length - 1
            ? 'pb-6 border-b border-slate-200'
            : ''}"
        >
          <div class="flex gap-4 items-start">
            <!-- Character name -->
            <div class="w-32 shrink-0">
              {#if dialogueItem.characterName}
                <span
                  class="text-xl font-bold text-blue-600 px-4 py-2 bg-blue-100/80 rounded-xl inline-block"
                >
                  {dialogueItem.characterName}
                </span>
              {/if}
            </div>

            <!-- Dialogue text -->
            <div class="flex-1 text-lg text-slate-800 leading-relaxed">
              {dialogueItem.text}
            </div>
          </div>
        </div>
      {/each}

      <!-- Currently typing dialogue -->
      {#if isTyping && currentDialogue}
        <div class="mb-6">
          <div class="flex gap-4 items-start">
            <!-- Character name -->
            <div class="w-32 shrink-0">
              {#if getCharacterName(currentDialogue)}
                <span
                  class="text-xl font-bold text-blue-600 px-4 py-2 bg-blue-100/80 rounded-xl inline-block"
                >
                  {getCharacterName(currentDialogue)}
                </span>
              {/if}
            </div>

            <!-- Dialogue text being typed -->
            <div
              class="flex-1 text-lg text-slate-800 leading-relaxed min-h-[60px]"
            >
              {typingText}
              <span class="inline-block w-2 h-5 bg-blue-600 ml-1 animate-pulse"
              ></span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Continue indicator -->
      {#if !isTyping && !choice}
        <div class="text-center">
          <button
            onclick={handleNext}
            class="group px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            {#if isLastDialogue && canGoNext}
              {t.reader.nextScene}
            {:else if isLastDialogue}
              {t.reader.complete}
            {:else}
              {t.reader.continue}
            {/if}
          </button>
        </div>
      {/if}

      <!-- Choice options -->
      {#if choice && !isTyping && isLastDialogue}
        <div class="mt-6 space-y-4">
          <p class="text-lg font-semibold text-slate-700 mb-4">
            {choice.prompt}
          </p>
          {#each choice.options as option (option.id)}
            <button
              onclick={() => handleChoice(option.nextScene)}
              class="w-full p-4 bg-gradient-to-r from-slate-100 to-white hover:from-blue-100 hover:to-cyan-50 text-slate-800 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] border-2 border-slate-200 hover:border-blue-300 text-left"
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Action buttons -->
    <div class="mt-6 flex justify-between items-center">
      <!-- Bookmark button -->
      {#if showBookmarkButton}
        <button
          onclick={() =>
            onBookmark(displayedDialogues.length + (isTyping ? 1 : 0))}
          class="px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-white/40"
        >
          {t.reader.bookmark}
        </button>
      {/if}

      <!-- Progress indicator -->
      <div class="text-white/90 text-sm font-medium">
        {t.reader.pageDisplay
          .replace(
            '{current}',
            (displayedDialogues.length + (isTyping ? 1 : 0)).toString()
          )
          .replace('{total}', dialogue.length.toString())}
      </div>
    </div>
    </div>
  </main>
</div>

<style>
  .novel-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
