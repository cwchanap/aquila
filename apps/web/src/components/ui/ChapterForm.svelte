<script lang="ts">
  import type { Locale } from '@aquila/dialogue';
  import { getTranslations } from '@aquila/dialogue';
  import Button from './Button.svelte';

  interface Props {
    title?: string;
    description?: string;
    onSubmit: (e: Event & { submitter: HTMLElement | null }) => void;
    onCancel: () => void;
    submitLabel?: string;
    locale?: Locale;
  }

  let {
    title = $bindable(''),
    description = $bindable(''),
    onSubmit,
    onCancel,
    submitLabel,
    locale = 'en',
  }: Props = $props();

  $: t = getTranslations(locale);
  $: resolvedSubmitLabel = submitLabel ?? t.actions.createChapter;
</script>

<form on:submit|preventDefault={onSubmit} class="space-y-6">
  <div>
    <label
      for="chapter-title"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      {t.chapter.title} <span class="text-red-400">*</span>
    </label>
    <input
      id="chapter-title"
      type="text"
      bind:value={title}
      required
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
      placeholder={t.chapter.placeholderTitle}
    />
  </div>

  <div>
    <label
      for="chapter-description"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      {t.chapter.description}
    </label>
    <textarea
      id="chapter-description"
      bind:value={description}
      rows="4"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
      placeholder={t.chapter.placeholderDescriptionOptional}
    ></textarea>
  </div>

  <div class="flex justify-end gap-3 pt-4">
    <Button
      type="button"
      variant="default"
      onclick={onCancel}
      className="bg-gray-600 hover:bg-gray-700"
    >
      {t.actions.cancel}
    </Button>
    <Button
      type="submit"
      variant="default"
      className="bg-cyan-600 hover:bg-cyan-700"
    >
      {resolvedSubmitLabel}
    </Button>
  </div>
</form>
