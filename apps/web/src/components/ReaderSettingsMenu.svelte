<script lang="ts">
  import { tick } from 'svelte';
  import { Cog, X } from 'lucide-svelte';
  import type { Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import type { ReaderMode } from '@/lib/reader-mode';
  import { focusTrap } from '@/lib/focus-trap';

  let {
    open = $bindable(false),
    locale,
    mode,
    onModeChange,
    onBookmark,
    showBookmarkButton,
    backUrl,
    bookmarkDisabled,
    triggerUnavailable,
  }: {
    open?: boolean;
    locale: Locale;
    mode: ReaderMode;
    onModeChange: (mode: ReaderMode) => void | Promise<void>;
    onBookmark: () => void;
    showBookmarkButton: boolean;
    backUrl: string;
    bookmarkDisabled: boolean;
    triggerUnavailable: boolean;
  } = $props();

  let trigger: globalThis.HTMLButtonElement | null = $state(null);
  let t = $derived(getTranslations(locale));

  function close(): void {
    open = false;
  }

  function handleEscape(event: KeyboardEvent): void {
    if (!open || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  async function chooseMode(nextMode: ReaderMode): Promise<void> {
    open = false;
    await tick();
    await onModeChange(nextMode);
  }

  async function bookmark(): Promise<void> {
    open = false;
    await tick();
    onBookmark();
  }
</script>

<svelte:window onkeydown={handleEscape} />

<div
  data-reader-settings
  class="pointer-events-none fixed inset-0 z-[90]"
>
  <button
    id="reader-settings-trigger"
    type="button"
    bind:this={trigger}
    class="pointer-events-auto fixed right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow backdrop-blur-sm hover:bg-white disabled:pointer-events-none disabled:opacity-50"
    style="top: calc(0.75rem + env(safe-area-inset-top)); right: calc(0.75rem + env(safe-area-inset-right));"
    aria-label={t.reader.openSettings}
    aria-haspopup="dialog"
    aria-expanded={open}
    disabled={triggerUnavailable}
    tabindex={triggerUnavailable ? -1 : undefined}
    onclick={() => (open = true)}
  >
    <Cog size={20} aria-hidden="true" />
  </button>

  {#if open}
    <button
      type="button"
      data-testid="reader-settings-scrim"
      aria-hidden="true"
      tabindex="-1"
      class="pointer-events-auto fixed inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      onclick={close}
    ></button>

    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-settings-title"
      data-reader-settings-dialog
      class="pointer-events-auto fixed left-1/2 top-1/2 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 rounded-3xl bg-white/95 p-6 text-slate-800 shadow-2xl backdrop-blur-xl"
      use:focusTrap={{ enabled: true, restoreFocus: trigger }}
    >
      <div class="flex items-center justify-between gap-4">
        <h2 id="reader-settings-title" class="text-xl font-bold">
          {t.reader.settingsTitle}
        </h2>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label={t.reader.closeSettings}
          onclick={close}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div class="flex flex-col gap-2" aria-label={t.reader.readerMode}>
        <button
          type="button"
          class="rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600"
          aria-pressed={mode === 'text'}
          onclick={() => void chooseMode('text')}
        >
          {t.reader.textMode}
        </button>
        <button
          type="button"
          class="rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600"
          aria-pressed={mode === 'visual'}
          onclick={() => void chooseMode('visual')}
        >
          {t.reader.visualNovelMode}
        </button>
      </div>

      {#if showBookmarkButton}
        <button
          type="button"
          class="rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={bookmarkDisabled}
          onclick={() => void bookmark()}
        >
          {t.reader.bookmark}
        </button>
      {/if}

      <a
        href={backUrl}
        class="rounded-xl border-2 border-slate-200 px-4 py-3 text-left font-semibold hover:border-blue-300 hover:text-blue-600"
      >
        {t.common.backToHome}
      </a>
    </div>
  {/if}
</div>
