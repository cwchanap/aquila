<script lang="ts">
  /* eslint-disable svelte/infinite-reactive-loop */
  import type {
    DialogueEntry,
    ChoiceDefinition,
    Locale,
  } from '@aquila/dialogue';
  import { CharacterDirectory, getTranslations } from '@aquila/dialogue';

  export let dialogue: DialogueEntry[] = [];
  export let choice: ChoiceDefinition | null = null;
  export let onChoice: (nextScene: string) => void = () => {};
  export let onBookmark: (dialogueNumber: number) => void = () => {};
  export let onNext: () => void = () => {};
  export let canGoNext: boolean = false;
  export let showBookmarkButton: boolean = true;
  export let locale: Locale = 'en';
  export let backUrl: string = '/';
  export let initialDialogueIndex: number | null = null;

  $: t = getTranslations(locale);

  let currentDialogueIndex = 0;
  let displayedDialogues: {
    text: string;
    characterName: string;
    characterId?: string;
  }[] = [];
  let isTyping = false;
  let typingSpeed = 30; // milliseconds per character
  let skipTyping = false;
  let typingText = '';
  let lastDialogueSnapshot = '';
  let dialogueContainer: HTMLElement | null = null;
  let hasAppliedInitialIndex = false;
  let hasUserAdvanced = false;

  $: currentDialogue = dialogue[currentDialogueIndex];

  function getCharacterName(dialogueEntry: DialogueEntry | undefined): string {
    if (!dialogueEntry) return '';

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

      const info = CharacterDirectory.getById(characterId);
      return info?.name ?? t.reader.unknown;
    }

    return dialogueEntry.character || '';
  }

  $: isLastDialogue = currentDialogueIndex >= dialogue.length - 1;

  // Reset displayed dialogues when dialogue array changes (new scene)
  $: {
    const snapshot = JSON.stringify(dialogue);
    if (snapshot !== lastDialogueSnapshot) {
      lastDialogueSnapshot = snapshot;
      currentDialogueIndex = 0;
      displayedDialogues = [];
      skipTyping = false;
      isTyping = false;
      typingText = '';
      hasUserAdvanced = false;
      hasAppliedInitialIndex = false;
    }
  }

  // Apply initial dialogue index (if provided) once per mount
  $: if (
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

  // Start typing new dialogue when index changes
  $: if (
    dialogue[currentDialogueIndex] &&
    displayedDialogues.length === currentDialogueIndex &&
    (!hasAppliedInitialIndex || hasUserAdvanced)
  ) {
    startTypingNewDialogue();
  }

  function startTypingNewDialogue() {
    const dialogueEntry = dialogue[currentDialogueIndex];
    if (!dialogueEntry) return;

    if (!skipTyping) {
      typingText = '';
      isTyping = true;
      // Scroll to bottom when starting new dialogue
      globalThis.setTimeout(() => {
        if (dialogueContainer) {
          dialogueContainer.scrollTop = dialogueContainer.scrollHeight;
        }
      }, 50);
      const executeTyping = async () => {
        await typeText(dialogueEntry.dialogue, dialogueEntry);
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
    entry: DialogueEntry | undefined = currentDialogue
  ): Promise<void> {
    for (let i = 0; i < text.length; i++) {
      if (skipTyping) {
        typingText = text;
        break;
      }
      typingText = text.slice(0, i + 1);
      await new Promise<void>(resolve =>
        globalThis.setTimeout(resolve, typingSpeed)
      );
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

    const activeElement = globalThis.document
      .activeElement as HTMLElement | null;
    const rawTarget = (event.target ?? activeElement) as unknown;
    const target = rawTarget instanceof HTMLElement ? rawTarget : activeElement;

    if (target) {
      const tagName = target.tagName.toLowerCase();
      const interactiveTags = ['input', 'textarea', 'select', 'option'];
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
  class="novel-reader min-h-screen bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400 flex items-center justify-center p-6"
>
  <!-- Back button at top left -->
  <div class="fixed top-6 left-6 z-10">
    <a
      href={backUrl}
      class="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
    >
      {t.common.backToHome}
    </a>
  </div>

  <div class="w-[90vw] max-w-[90vw] mx-auto">
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
            on:click={handleNext}
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
              on:click={() => handleChoice(option.nextScene)}
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
          on:click={() =>
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
</div>

<style>
  .novel-reader {
    font-family: 'Georgia', 'Times New Roman', serif;
  }
</style>
