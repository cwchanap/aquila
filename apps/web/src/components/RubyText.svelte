<script lang="ts">
  import type { RubySpan } from '@aquila/stories';
  import { rubySegments } from '@/lib/reader-furigana';

  let {
    text,
    ruby = undefined,
    show = true,
  }: {
    text: string;
    /** Furigana spans over `text` (Japanese only). */
    ruby?: RubySpan[];
    show?: boolean;
  } = $props();

  let segments = $derived(show && ruby?.length ? rubySegments(text, ruby) : null);
</script>

{#if segments}{#each segments as segment, i (i)}{#if segment.reading}<ruby>{segment.text}<rp>(</rp><rt>{segment.reading}</rt><rp>)</rp></ruby>{:else}{segment.text}{/if}{/each}{:else}{text}{/if}

<style>
  rt {
    font-size: 0.5em;
    font-weight: normal;
    letter-spacing: 0;
  }
</style>
