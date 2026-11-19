<script lang="ts">
  import type { Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import type { TypingSpeed } from '@/lib/reader-typing-speed';
  import { cn } from '@/lib/utils';

  let { locale, value, onChange, compact = false }: {
    locale: Locale;
    value: TypingSpeed;
    onChange: (value: TypingSpeed) => void;
    compact?: boolean;
  } = $props();

  let t = $derived(getTranslations(locale));
</script>

<div role="group" aria-label={t.reader.typingSpeed} class={cn('flex flex-col gap-2', compact && 'gap-1.5')}>
  <p class={cn('m-0 font-semibold text-slate-600', compact ? 'text-xs' : 'text-sm')}>{t.reader.typingSpeed}</p>
  <div class={cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
    {#each [
      { value: 'instant', label: t.reader.typingSpeedInstant },
      { value: 'fast', label: t.reader.typingSpeedFast },
      { value: 'normal', label: t.reader.typingSpeedNormal },
    ] as option (option.value)}
      <button
        type="button"
        class={cn('rounded-xl border-2 border-slate-200 font-semibold hover:border-blue-300 hover:text-blue-600 aria-pressed:border-blue-400 aria-pressed:text-blue-700', compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2')}
        aria-pressed={value === option.value}
        onclick={() => onChange(option.value as TypingSpeed)}
      >{option.label}</button>
    {/each}
  </div>
</div>
