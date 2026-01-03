<script lang="ts">
  import type { Locale } from '@aquila/dialogue';
  import { getTranslations } from '@aquila/dialogue';
  import Button from './Button.svelte';

  interface Props {
    title?: string;
    description?: string;
    status?: 'draft' | 'published' | 'archived';
    onSubmit: (e: Event & { submitter: HTMLElement | null }) => void;
    onCancel: () => void;
    submitLabel?: string;
    locale?: Locale;
  }

  let {
    title = $bindable(''),
    description = $bindable(''),
    status = $bindable<'draft' | 'published' | 'archived'>('draft'),
    onSubmit,
    onCancel,
    submitLabel,
    locale = 'en',
  }: Props = $props();

  const t = $derived(getTranslations(locale));
  const resolvedSubmitLabel = $derived(submitLabel ?? t.actions.createStory);
</script>

<form on:submit|preventDefault={onSubmit} class="space-y-6">
  <div>
    <label
      for="story-title"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      {t.story.title} <span class="text-red-400">*</span>
    </label>
    <input
      id="story-title"
      type="text"
      bind:value={title}
      required
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
      placeholder={t.story.placeholderTitle}
    />
  </div>

  <div>
    <label
      for="story-description"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      {t.story.description}
    </label>
    <textarea
      id="story-description"
      bind:value={description}
      rows="4"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
      placeholder={t.story.placeholderDescriptionOptional}
    ></textarea>
  </div>

  <div>
    <label
      for="story-status"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      {t.status.label}
    </label>
    <select
      id="story-status"
      bind:value={status}
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
    >
      <option value="draft">{t.status.draft}</option>
      <option value="published">{t.status.published}</option>
      <option value="archived">{t.status.archived}</option>
    </select>
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
      className="bg-purple-600 hover:bg-purple-700"
    >
      {resolvedSubmitLabel}
    </Button>
  </div>
</form>
