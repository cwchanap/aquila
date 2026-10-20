<script lang="ts">
  import type { Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import { cn } from '@/lib/utils';

  let {
    locale,
    on,
    onChange,
    compact = false,
  }: {
    locale: Locale;
    on: boolean;
    onChange: (on: boolean) => void;
    compact?: boolean;
  } = $props();

  let t = $derived(getTranslations(locale));
</script>

<button
  type="button"
  class={cn(
    'flex items-center justify-between rounded-xl border-2 border-slate-200 text-left font-semibold hover:border-blue-300 hover:text-blue-600',
    compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-3'
  )}
  aria-pressed={on}
  aria-label={t.reader.furigana}
  data-testid="furigana-toggle"
  onclick={() => onChange(!on)}
>
  <span>{t.reader.furigana}</span>
  <span>{on ? t.reader.furiganaOn : t.reader.furiganaOff}</span>
</button>
