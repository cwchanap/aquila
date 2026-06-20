<script lang="ts">
  import { getTranslations, type Locale } from '@aquila/stories';
  import { focusTrap } from '@/lib/focus-trap';

  let {
    lines = [],
    open = false,
    onClose,
    locale = 'en',
  }: {
    lines: { characterName: string; text: string }[];
    open?: boolean;
    onClose: () => void;
    locale?: Locale;
  } = $props();

  let t = $derived(getTranslations(locale));

  function handleEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleEscape} />

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/40"
    aria-label={t.reader.closeHistory}
    onclick={onClose}
  ></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="backlog-title"
    use:focusTrap={open}
    class="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white/95 p-6 shadow-2xl backdrop-blur-xl"
    style="padding-bottom: calc(1.5rem + env(safe-area-inset-bottom));"
  >
    <div class="mb-4 flex items-center justify-between">
      <h2 id="backlog-title" class="text-lg font-bold text-slate-800">{t.reader.historyTitle}</h2>
      <button
        type="button"
        class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label={t.reader.closeHistory}
        onclick={onClose}
      >
        ✕
      </button>
    </div>
    <ul class="space-y-4">
      {#each lines as line, i (i)}
        <li>
          {#if line.characterName}
            <p class="text-sm font-bold text-blue-600">{line.characterName}</p>
          {/if}
          <p class="text-base leading-relaxed text-slate-800">{line.text}</p>
        </li>
      {/each}
    </ul>
  </div>
{/if}
