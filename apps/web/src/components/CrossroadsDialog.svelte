<script lang="ts">
  import { ChevronLeft, GitFork } from 'lucide-svelte';
  import type {
    ChoiceDefinition,
    ChoiceOptionDefinition,
    Translations,
  } from '@aquila/stories';
  import type { SecondChoiceLabels } from '@/lib/reader-second-language';
  import { actLabel } from '@/lib/act-navigation';
  import { focusTrap } from '@/lib/focus-trap';
  import RubyText from '@/components/RubyText.svelte';

  let {
    open,
    choice,
    secondChoice = null,
    actName = '',
    textLang = undefined,
    secondLang = undefined,
    furigana = true,
    t,
    onSelect,
    onClose,
  }: {
    open: boolean;
    choice: ChoiceDefinition;
    secondChoice?: SecondChoiceLabels | null;
    actName?: string;
    textLang?: string;
    secondLang?: string;
    furigana?: boolean;
    t: Translations;
    onSelect: (nextScene: string) => void;
    onClose: () => void;
  } = $props();

  const ROUTE_LETTERS = ['A', 'B', 'C', 'D'];
  const ROUTE_WIDTHS = [
    '',
    'sm:max-w-[440px]',
    'sm:max-w-[720px]',
    'sm:max-w-[1020px]',
    'sm:max-w-[1120px]',
  ];

  let headingEl = $state<HTMLElement | null>(null);
  let picked = $state(false);
  let activeRoute = $state<number | null>(null);

  let options = $derived(choice.options);
  let actCaption = $derived(actName ? actLabel(actName, t) : '');
  let eyebrow = $derived(
    actCaption
      ? `${t.reader.storyMap.decision} · ${actCaption}`
      : t.reader.storyMap.decision
  );
  let routesWidth = $derived(
    ROUTE_WIDTHS[Math.min(options.length, ROUTE_WIDTHS.length - 1)]
  );
  let fanMid = $derived(options.length / 2);

  $effect(() => {
    if (open) {
      picked = false;
      activeRoute = null;
    }
  });

  function routeLabel(index: number): string {
    return t.reader.crossroads.route.replace(
      '{letter}',
      ROUTE_LETTERS[index] ?? String(index + 1)
    );
  }

  function keyHint(index: number): string {
    return t.reader.crossroads.keyHint.replace('{key}', String(index + 1));
  }

  function select(option: ChoiceOptionDefinition): void {
    if (picked) return;
    picked = true;
    onSelect(option.nextScene);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (!open || e.defaultPrevented) return;
    if (e.repeat || e.isComposing) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const target = e.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        !!target.closest('input, textarea, select, [contenteditable]'))
    ) {
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (!/^[1-4]$/.test(e.key)) return;
    const option = options[Number(e.key) - 1];
    if (!option) return;
    e.preventDefault();
    e.stopPropagation();
    select(option);
  }
</script>

<svelte:window onkeydowncapture={handleKeydown} />

{#if open}
  <button
    type="button"
    data-testid="crossroads-scrim"
    class="scrim fixed inset-0 z-[95]"
    aria-hidden="true"
    tabindex="-1"
    onclick={onClose}
  ></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="crossroads-eyebrow crossroads-title"
    data-testid="crossroads-dialog"
    use:focusTrap={{ enabled: true, initialFocus: () => headingEl }}
    class="pointer-events-none fixed inset-0 z-[96] flex flex-col text-slate-50"
  >
    <div
      class="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
    >
      <div
        class="pointer-events-auto m-auto flex w-full max-w-5xl flex-col items-center px-5 pb-10 pt-[max(2.5rem,env(safe-area-inset-top))] text-center sm:px-10"
      >
        <GitFork
          size={40}
          strokeWidth={1.75}
          class="text-sky-200"
          aria-hidden="true"
        />
        <p
          id="crossroads-eyebrow"
          class="mt-3 text-[13px] font-semibold uppercase tracking-[0.24em] text-cyan-200"
        >
          {eyebrow}
        </p>
        <h2
          id="crossroads-title"
          bind:this={headingEl}
          tabindex="-1"
          lang={textLang}
          class="mt-3 max-w-[900px] text-balance font-serif text-[27px] font-semibold leading-snug outline-none sm:text-[42px] sm:leading-tight"
        >
          <RubyText
            text={choice.prompt}
            ruby={choice.promptRuby}
            show={furigana}
          />
        </h2>
        {#if secondChoice}
          <p
            class="mt-2 max-w-[900px] font-serif text-[15px] italic leading-normal text-slate-300 sm:text-lg"
            lang={secondLang}
            data-testid="second-line"
          >
            <RubyText
              text={secondChoice.prompt}
              ruby={secondChoice.promptRuby}
              show={furigana}
            />
          </p>
        {/if}
        <div
          class="mt-5 w-full sm:mt-6 {routesWidth}"
          data-testid="crossroads-routes"
        >
          <div
            class="relative hidden h-16 w-full sm:block"
            aria-hidden="true"
          >
            <svg
              class="block h-full w-full overflow-visible"
              viewBox="0 0 {options.length} 64"
              preserveAspectRatio="none"
            >
              {#each options as option, i (option.id)}
                <path
                  vector-effect="non-scaling-stroke"
                  class="route-line"
                  class:on={activeRoute === i}
                  d="M {fanMid} 2 C {fanMid} 35.2, {i + 0.5} 28.8, {i +
                    0.5} 64"
                />
              {/each}
            </svg>
            <span
              class="absolute left-1/2 top-[3px] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300"
            ></span>
          </div>
          <ul
            class="relative grid w-full grid-cols-1 gap-3.5 pl-9 sm:grid-flow-col sm:auto-cols-fr sm:gap-0 sm:pl-0"
          >
            {#each options as option, i (option.id)}
              <li class="route-item relative sm:px-3">
                <button
                  type="button"
                  data-testid="crossroads-route"
                  aria-keyshortcuts={String(i + 1)}
                  class="route-card relative flex min-h-11 w-full flex-col gap-1.5 rounded-2xl border border-white/20 bg-white/[0.07] px-4 py-3.5 text-left text-slate-50 backdrop-blur-md transition-[border-color,background-color,transform,box-shadow] duration-150 hover:-translate-y-[3px] hover:border-cyan-300 hover:bg-cyan-400/10 hover:shadow-[0_0_0_4px_rgba(34,211,238,0.12),0_20px_40px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:border-cyan-300 focus-visible:bg-cyan-400/10 focus-visible:ring-2 focus-visible:ring-cyan-300/70 sm:min-h-[132px] sm:gap-2.5 sm:rounded-[20px] sm:px-[22px] sm:pb-[18px] sm:pt-[22px]"
                  onclick={() => select(option)}
                  onmouseenter={() => (activeRoute = i)}
                  onmouseleave={() => (activeRoute = null)}
                  onfocus={() => (activeRoute = i)}
                  onblur={() => (activeRoute = null)}
                >
                  <span
                    class="flex items-center justify-between gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-cyan-200"
                  >
                    <span>{routeLabel(i)}</span>
                    <i
                      class="hidden not-italic text-[13px] font-semibold normal-case tracking-normal text-slate-200/60 sm:block"
                      aria-hidden="true">{i + 1}</i
                    >
                    <span class="sr-only">{keyHint(i)}</span>
                  </span>
                  <span
                    class="font-serif text-[19px] font-semibold leading-snug sm:text-[23px]"
                    lang={textLang}
                  >
                    <RubyText
                      text={option.label}
                      ruby={option.labelRuby}
                      show={furigana}
                    />
                  </span>
                  {#if secondChoice?.labels[option.id]}
                    <span
                      class="font-serif text-sm italic leading-normal text-slate-300 sm:text-[15px]"
                      lang={secondLang}
                      data-testid="second-line"
                    >
                      <RubyText
                        text={secondChoice.labels[option.id]}
                        ruby={secondChoice.labelRuby?.[option.id]}
                        show={furigana}
                      />
                    </span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
    <div
      class="pointer-events-auto flex shrink-0 justify-center px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2"
    >
      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] font-medium text-slate-300 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        onclick={onClose}
      >
        <ChevronLeft size={18} aria-hidden="true" />
        {t.reader.crossroads.back}
      </button>
    </div>
  </div>
{/if}

<style>
  .scrim {
    background: radial-gradient(
      120% 90% at 50% 25%,
      rgba(15, 23, 42, 0.78),
      rgba(2, 6, 23, 0.95)
    );
    backdrop-filter: blur(2px);
  }
  .route-line {
    fill: none;
    stroke: rgba(125, 211, 252, 0.45);
    stroke-width: 2;
    stroke-dasharray: 6 6;
    transition: stroke 0.15s;
  }
  .route-line.on {
    stroke: #67e8f9;
    stroke-dasharray: none;
    stroke-width: 3;
  }
  @media (max-width: 639px) {
    .route-item::before {
      content: '';
      position: absolute;
      left: -24px;
      top: -14px;
      bottom: 0;
      border-left: 2px dashed rgba(125, 211, 252, 0.45);
    }
    .route-item:first-child::before {
      top: -24px;
    }
    .route-item:last-child::before {
      bottom: 50%;
    }
    .route-card::before {
      content: '';
      position: absolute;
      left: -24px;
      top: 50%;
      width: 22px;
      border-top: 2px dashed rgba(125, 211, 252, 0.45);
    }
    .route-card::after {
      content: '';
      position: absolute;
      left: -28px;
      top: calc(50% - 4px);
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #67e8f9;
    }
  }
</style>
