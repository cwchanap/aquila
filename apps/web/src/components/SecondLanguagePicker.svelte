<script lang="ts">
  import type { Locale } from '@aquila/stories';
  import { getTranslations, localeLangTag } from '@aquila/stories/translations';
  import type { SecondLanguage } from '@/lib/reader-second-language';
  import { cn } from '@/lib/utils';

  let {
    locale,
    value,
    options,
    onChange,
    compact = false,
  }: {
    /** UI language for the labels. */
    locale: Locale;
    value: SecondLanguage;
    /** Every language other than the one being read, with whether this
     *  story has text in it. */
    options: { locale: Locale; available: boolean }[];
    onChange: (value: SecondLanguage) => void;
    compact?: boolean;
  } = $props();

  let t = $derived(getTranslations(locale));

  // Language names are shown in their own language (English, 中文, 日本語),
  // so a learner can find theirs whatever the UI language is.
  const ENDONYM_KEYS = {
    en: 'english',
    zh: 'chinese',
    ja: 'japanese',
  } as const satisfies Record<Locale, keyof typeof t.languages>;

  function languageName(code: Locale): string {
    return t.languages[ENDONYM_KEYS[code]];
  }

  const choiceClass =
    'rounded-xl border-2 border-slate-200 font-semibold hover:border-blue-300 hover:text-blue-600 aria-pressed:border-blue-400 aria-pressed:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-inherit';
</script>

<div
  role="group"
  aria-label={t.reader.secondLanguage}
  data-testid="second-language-picker"
  class={cn('flex flex-col gap-2', compact && 'gap-1.5')}
>
  <p class={cn('m-0 font-semibold text-slate-600', compact ? 'text-xs' : 'text-sm')}>
    {t.reader.secondLanguage}
  </p>
  <div class={cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
    <button
      type="button"
      class={cn(choiceClass, compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2')}
      aria-pressed={value === 'off'}
      onclick={() => onChange('off')}
    >
      {t.reader.secondLanguageOff}
    </button>
    {#each options as option (option.locale)}
      <button
        type="button"
        lang={localeLangTag(option.locale)}
        class={cn(choiceClass, compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2')}
        aria-pressed={value === option.locale}
        disabled={!option.available}
        title={option.available ? undefined : t.reader.secondLanguageUnavailable}
        onclick={() => onChange(option.locale)}
      >
        {languageName(option.locale)}
      </button>
    {/each}
  </div>
  {#if options.some(option => !option.available)}
    <p class={cn('m-0 text-slate-500', compact ? 'text-xs' : 'text-sm')}>
      {t.reader.secondLanguageUnavailable}:
      {options
        .filter(option => !option.available)
        .map(option => languageName(option.locale))
        .join(', ')}
    </p>
  {/if}
</div>
