<script lang="ts">
  import type { DialogueEntry, Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import { resolveCharacterName } from '@/lib/character-name';
  import { focusTrap } from '@/lib/focus-trap';

  let {
    dialogue = [],
    dialogueIndex = 0,
    locale = 'en',
    onClose = () => {},
    trigger = null,
  }: {
    dialogue?: DialogueEntry[];
    dialogueIndex?: number;
    locale?: Locale;
    onClose?: () => void;
    trigger?: HTMLElement | null;
  } = $props();

  let t = $derived(getTranslations(locale));
  let visibleDialogue = $derived(dialogue.slice(0, dialogueIndex + 1));

  function close(): void {
    trigger?.focus();
    onClose();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }
</script>

<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="visual-backlog-title"
  tabindex="-1"
  data-reader-interactive
  class="visual-backlog"
  onkeydown={handleKeydown}
  use:focusTrap={{ enabled: true, restoreFocus: trigger }}
>
  <header>
    <h2 id="visual-backlog-title">{t.reader.historyTitle}</h2>
    <button
      type="button"
      aria-label={t.reader.closeHistory}
      data-reader-interactive
      onclick={close}
    >
      <span aria-hidden="true">×</span>
    </button>
  </header>

  <ol>
    {#each visibleDialogue as entry, index (index)}
      {@const characterName = resolveCharacterName(entry, t)}
      <li>
        {#if characterName}
          <p class="speaker">{characterName}</p>
        {/if}
        <p>{entry.dialogue}</p>
      </li>
    {/each}
  </ol>
</div>

<style>
  .visual-backlog {
    position: absolute;
    inset: max(1rem, env(safe-area-inset-top))
      max(1rem, env(safe-area-inset-right))
      max(1rem, env(safe-area-inset-bottom))
      max(1rem, env(safe-area-inset-left));
    z-index: 50;
    display: flex;
    flex-direction: column;
    max-width: 48rem;
    margin: auto;
    overflow: hidden;
    color: #f8fafc;
    background: rgb(15 23 42 / 0.94);
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 1rem;
    box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 0.5);
    backdrop-filter: blur(1rem);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgb(255 255 255 / 0.16);
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
  }

  button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    color: inherit;
    font: inherit;
    font-size: 1.75rem;
    background: rgb(255 255 255 / 0.1);
    border: 0;
    border-radius: 999px;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 3px solid #7dd3fc;
    outline-offset: 2px;
  }

  ol {
    padding: 1.25rem;
    margin: 0;
    overflow-y: auto;
    list-style: none;
  }

  li + li {
    padding-top: 1rem;
    margin-top: 1rem;
    border-top: 1px solid rgb(255 255 255 / 0.12);
  }

  p {
    margin: 0;
    line-height: 1.65;
  }

  .speaker {
    margin-bottom: 0.25rem;
    color: #7dd3fc;
    font-weight: 700;
  }
</style>
