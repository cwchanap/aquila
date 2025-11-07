<script lang="ts">
    /* eslint-disable svelte/infinite-reactive-loop */
    import type { DialogueEntry, ChoiceDefinition, Locale } from '@aquila/dialogue';
    import { CharacterDirectory, getTranslations } from '@aquila/dialogue';
    
    export let dialogue: DialogueEntry[] = [];
    export let choice: ChoiceDefinition | null = null;
    export let onChoice: (nextScene: string) => void = () => {};
    export let onBookmark: () => void = () => {};
    export let onNext: () => void = () => {};
    export let canGoNext: boolean = false;
    export let showBookmarkButton: boolean = true;
    export let locale: Locale = 'en';
    export let backUrl: string = '/';

    $: t = getTranslations(locale);

    let currentDialogueIndex = 0;
    let displayedText = '';
    let isTyping = false;
    let typingSpeed = 30; // milliseconds per character
    let skipTyping = false;
    let lastDialogueText = '';

    $: currentDialogue = dialogue[currentDialogueIndex];
    $: characterName = (() => {
        if (!currentDialogue) return '';

        if (currentDialogue.characterId) {
            const characterId = currentDialogue.characterId;
            const localizedName =
                (t as Record<string, unknown>).characterNames &&
                typeof (t as Record<string, unknown>).characterNames === 'object'
                    ? (
                          (t as {
                              characterNames?: Record<string, string>;
                          }).characterNames?.[characterId] ?? undefined
                      )
                    : undefined;

            if (localizedName) {
                return localizedName;
            }

            const info = CharacterDirectory.getById(characterId);
            return info?.name ?? t.reader.unknown;
        }

        return currentDialogue.character || '';
    })();
    $: isLastDialogue = currentDialogueIndex >= dialogue.length - 1;

    // Type out text effect - only trigger when dialogue actually changes
    $: if (currentDialogue?.dialogue && currentDialogue.dialogue !== lastDialogueText) {
        lastDialogueText = currentDialogue.dialogue;
        if (!skipTyping) {
            displayedText = '';
            isTyping = true;
            const executeTyping = async () => {
                await typeText(currentDialogue.dialogue);
            };
            void executeTyping();
        } else {
            displayedText = currentDialogue.dialogue;
            isTyping = false;
        }
    }

    async function typeText(text: string): Promise<void> {
        for (let i = 0; i < text.length; i++) {
            if (skipTyping) {
                displayedText = text;
                break;
            }
            displayedText = text.slice(0, i + 1);
            await new Promise<void>(resolve => globalThis.setTimeout(resolve, typingSpeed));
        }
        isTyping = false;
    }

    function handleNext() {
        if (isTyping) {
            skipTyping = true;
            return;
        }

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

        const target = (event.target ?? globalThis.document.activeElement) as globalThis.HTMLElement | null;
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

<div class="novel-reader min-h-screen bg-gradient-to-b from-sky-200 via-sky-300 to-blue-400 flex items-center justify-center p-6">
    <!-- Back button at top left -->
    <div class="fixed top-6 left-6 z-10">
        <a
            href={backUrl}
            class="inline-flex items-center px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
        >
            {t.common.backToHome}
        </a>
    </div>

    <div class="max-w-4xl w-full">
        <!-- Main dialogue box with glassmorphism style -->
        <div class="bg-white/90 backdrop-blur-md rounded-3xl p-8 shadow-2xl border border-white/50">
            {#if currentDialogue}
                <!-- Character name -->
                {#if characterName}
                    <div class="mb-4">
                        <span class="text-xl font-bold text-blue-600 px-4 py-2 bg-blue-100/80 rounded-xl inline-block">
                            {characterName}
                        </span>
                    </div>
                {/if}

                <!-- Dialogue text -->
                <div class="text-lg text-slate-800 leading-relaxed mb-6 min-h-[120px]">
                    {displayedText}
                    {#if isTyping}
                        <span class="inline-block w-2 h-5 bg-blue-600 ml-1 animate-pulse"></span>
                    {/if}
                </div>

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
            {/if}

            <!-- Choice options -->
            {#if choice && !isTyping && isLastDialogue}
                <div class="mt-6 space-y-4">
                    <p class="text-lg font-semibold text-slate-700 mb-4">{choice.prompt}</p>
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
                    on:click={onBookmark}
                    class="px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white/90 text-slate-700 hover:text-blue-600 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-white/40"
                >
                    {t.reader.bookmark}
                </button>
            {/if}

            <!-- Progress indicator -->
            <div class="text-white/90 text-sm font-medium">
                {t.reader.pageDisplay.replace('{current}', (currentDialogueIndex + 1).toString()).replace('{total}', dialogue.length.toString())}
            </div>
        </div>
    </div>
</div>

<style>
    .novel-reader {
        font-family: 'Georgia', 'Times New Roman', serif;
    }
</style>
