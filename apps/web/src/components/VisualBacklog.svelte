<script lang="ts">
  import RubyText from '@/components/RubyText.svelte';
  import type { Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import type { HistoryLine } from '@/lib/reader-history';
  import type { VoicePlayer } from '@/lib/audio/voice-player';
  import { focusTrap } from '@/lib/focus-trap';
  import { hideStageDirections } from '@/lib/reader-stage-directions';
  import { Volume2 } from 'lucide-svelte';

  let {
    lines = [],
    textLang = undefined,
    secondLang = undefined,
    furigana = true,
    locale = 'en',
    onClose = () => {},
    trigger = null,
    voice = null,
  }: {
    lines?: HistoryLine[];
    textLang?: string;
    secondLang?: string;
    /** Show furigana over Japanese text that has it. */
    furigana?: boolean;
    locale?: Locale;
    onClose?: () => void;
    trigger?: HTMLElement | null;
    /** Lets a voiced line be played again; omit it for no replay buttons. */
    voice?: Pick<VoicePlayer, 'has' | 'play'> | null;
  } = $props();

  let t = $derived(getTranslations(locale));
  let listEl: HTMLElement | null = $state(null);

  $effect(() => {
    if (listEl) {
      listEl.scrollTop = listEl.scrollHeight;
    }
  });

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

  <ol bind:this={listEl}>
    {#each lines as line, index (index)}
      {@const text = hideStageDirections({
        dialogue: line.text,
        ruby: line.ruby,
      })}
      {@const second = line.secondText
        ? hideStageDirections({
            dialogue: line.secondText,
            ruby: line.secondRuby,
          })
        : null}
      {@const voicedAt =
        voice &&
        line.sceneId &&
        line.index !== undefined &&
        voice.has(line.sceneId, line.index)
          ? { sceneId: line.sceneId, index: line.index }
          : null}
      <li>
        {#if line.separator}<h3>{line.separator}</h3>{/if}
        {#if line.characterName || voicedAt}
          <div class="speaker-row">
            {#if line.characterName}<p class="speaker">{line.characterName}</p>{/if}
            {#if voicedAt}
              <button
                type="button"
                class="replay"
                aria-label={t.reader.replayVoice}
                aria-describedby={`history-line-${index}`}
                data-reader-interactive
                onclick={() => voice?.play(voicedAt.sceneId, voicedAt.index)}
              >
                <Volume2 size={18} aria-hidden="true" />
              </button>
            {/if}
          </div>
        {/if}
        <p id={`history-line-${index}`} lang={textLang}><RubyText text={text.dialogue} ruby={text.ruby} show={furigana} /></p>
        {#if second}
          <p class="second-text" lang={secondLang}>
            <RubyText text={second.dialogue} ruby={second.ruby} show={furigana} />
          </p>
        {/if}
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
    min-height: 0;
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

  .speaker-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .speaker {
    color: #7dd3fc;
    font-weight: 700;
  }

  button.replay {
    width: 2.25rem;
    height: 2.25rem;
    flex: none;
  }

  .second-text {
    margin-top: 0.25rem;
    color: rgb(226 232 240 / 0.72);
    font-size: 0.9rem;
  }
</style>
