<script lang="ts">
  /* global HTMLButtonElement, HTMLDialogElement */
  import type { Locale } from '@aquila/stories';
  import { getTranslations } from '@aquila/stories/translations';
  import type { CharacterNotesCharacterView, CharacterNotesView } from '@/lib/character-notes';
  import { focusTrap } from '@/lib/focus-trap';

  let { model, locale, portraitUrl, onMobileDetailChange }: {
    model: CharacterNotesView;
    locale: Locale;
    portraitUrl?: (characterId: string) => string | null;
    onMobileDetailChange?: (open: boolean) => void;
  } = $props();
  let selectedId = $state<string | null>(null);
  let mobileDetail = $state(false);
  let selectedButton: HTMLButtonElement | null = null;
  let detailAnnounced = false;
  let t = $derived(getTranslations(locale).notes);
  let characters = $derived([
    ...model.characters.filter(character => character.met),
    ...model.characters.filter(character => !character.met),
  ]);
  let selected = $derived(
    characters.find(character => character.id === selectedId) ??
    characters.find(character => character.met) ?? null
  );

  function label(character: CharacterNotesCharacterView): string {
    return character.met && character.label ? character.label : t.unknown;
  }

  function initials(character: CharacterNotesCharacterView): string {
    if (!character.met || !character.label) return '?';
    return character.label.trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toUpperCase() || '?';
  }

  function portrait(character: CharacterNotesCharacterView): string | null {
    if (!character.met) return null;
    const url = portraitUrl?.(character.id) ?? null;
    if (!url || character.nameKnown) return url;
    try {
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = normalize(character.id);
      return id && !normalize(decodeURIComponent(url)).includes(id) ? url : null;
    } catch {
      return null;
    }
  }

  function select(character: CharacterNotesCharacterView, button: HTMLButtonElement) {
    selectedId = character.id;
    if (window.matchMedia?.('(max-width: 640px)').matches) {
      selectedButton = button;
      button.focus();
      mobileDetail = true;
      notifyDetail(true);
    }
  }

  function back() {
    if (!mobileDetail) return;
    mobileDetail = false;
    notifyDetail(false);
  }

  function notifyDetail(open: boolean) {
    if (detailAnnounced === open) return;
    detailAnnounced = open;
    onMobileDetailChange?.(open);
  }

  function phoneDialog(dialog: HTMLDialogElement) {
    const trap = focusTrap(dialog, { enabled: true, restoreFocus: selectedButton });
    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>('button')?.focus();
    const stopSheetKeys = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Escape') event.stopPropagation();
    };
    const media = window.matchMedia('(max-width: 640px)');
    const onResize = () => { if (!media.matches) back(); };
    dialog.addEventListener('keydown', stopSheetKeys);
    media.addEventListener?.('change', onResize);
    return () => {
      media.removeEventListener?.('change', onResize);
      dialog.removeEventListener('keydown', stopSheetKeys);
      dialog.close();
      trap.destroy();
      notifyDetail(false);
    };
  }

  function cancelDetail(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    back();
  }
</script>

{#snippet avatar(character: CharacterNotesCharacterView, large = false)}
  {@const url = portrait(character)}
  <span class={['avatar', { large }]} aria-hidden="true">
    {#if url}
      <img src={url} alt="" />
    {:else}
      {initials(character)}
    {/if}
  </span>
{/snippet}

{#snippet detail()}
  {#if selected}
    <div class="portrait">{@render avatar(selected, true)}</div>
    <div class="details">
      <h2>{selected.met ? label(selected) : t.unknown}</h2>
      {#if selected.met}
        {#if !selected.nameKnown}<p class="unknown-name">{t.nameUnknown}</p>{/if}
        <h3>{t.facts}</h3>
        <ul class="facts">
          {#each selected.facts as fact (fact.id)}
            <li><p>{fact.text}</p><small>{fact.act}</small></li>
          {/each}
          {#each Array(Math.max(0, selected.factCount - selected.facts.length)), i (i)}
            <li class="locked" aria-label={t.locked}><span></span><span></span></li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <p class="placeholder">{t.select}</p>
  {/if}
{/snippet}

<section class="characters" aria-label={t.title}>
  <div class="cast">
    <div class="cast-heading"><h2>{t.title}</h2><span>{t.met}: {model.metCount}</span></div>
    <ul>
      {#each characters as character (character.id)}
        <li>
          <button type="button" aria-label={!character.met ? t.unknown : undefined} class={{ chosen: selected?.id === character.id }} onclick={event => select(character, event.currentTarget)}>
            {@render avatar(character)}
            <span class="row-text">
              <strong>{character.met ? label(character) : '?'}</strong>
              {#if character.met && !character.nameKnown}<small class="unknown-name">{t.nameUnknown}</small>{/if}
              {#if character.met}<small>{character.facts.length} {t.facts}</small>{/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
  <div class="detail desktop-detail">{@render detail()}</div>
  {#if mobileDetail}
    <dialog class="detail mobile-dialog" aria-modal="true" aria-label={selected ? label(selected) : t.unknown} oncancel={cancelDetail} {@attach phoneDialog}>
      <button type="button" class="back" onclick={back}>{t.back}</button>
      {@render detail()}
    </dialog>
  {/if}
</section>

<style>
  .characters { display: grid; grid-template-columns: minmax(230px, 32%) minmax(0, 1fr); min-height: 32rem; color: #f8fafc; overflow: hidden; border: 1px solid #ffffff30; border-radius: 1.25rem; background: #111c32e8; }
  .cast { min-width: 0; border-right: 1px solid #ffffff20; }
  .cast-heading { padding: 1.25rem; }
  h2, h3, p { margin: 0; }
  .cast-heading h2, .details h2 { font: 600 1.45rem Georgia, serif; }
  .cast-heading span, small { color: #cbd5e1; font-size: .75rem; }
  .cast ul, .facts { list-style: none; margin: 0; padding: 0; }
  .cast ul { max-height: 35rem; overflow-y: auto; padding: 0 .6rem .6rem; }
  .cast button { display: flex; align-items: center; gap: .75rem; text-align: left; width: 100%; min-height: 60px; padding: .5rem; border: 0; border-radius: .8rem; background: transparent; color: inherit; cursor: pointer; }
  .cast button:hover, .cast button.chosen { background: #ffffff18; }
  button:focus-visible { outline: 2px solid #a5f3fc; outline-offset: 2px; }
  .row-text { display: flex; flex-direction: column; min-width: 0; overflow-wrap: anywhere; }
  .avatar { display: flex; flex: none; align-items: center; justify-content: center; width: 2.8rem; height: 2.8rem; overflow: hidden; border-radius: 50%; background: #61728b; color: white; font-weight: 600; }
  .avatar img { width: 100%; height: 100%; object-fit: cover; }
  .detail { display: flex; min-width: 0; background: #19243a; }
  .portrait { display: flex; flex: 0 0 40%; align-items: center; justify-content: center; background: linear-gradient(160deg, #526784, #27354e); min-width: 0; }
  .avatar.large { width: min(75%, 12rem); height: auto; aspect-ratio: 1; font-size: 3rem; background: #ffffff25; }
  .portrait .avatar.large:has(img) { width: 100%; height: 100%; aspect-ratio: auto; align-self: stretch; border-radius: 0; }
  .details { flex: 1; min-width: 0; padding: 1.75rem; overflow-wrap: anywhere; }
  .unknown-name { margin-top: .5rem; color: #b4c3d6; font-size: .8rem; }
  .details h3 { margin: 2rem 0 1rem; font-size: .85rem; text-transform: uppercase; letter-spacing: .1em; }
  .facts li { padding: 0 0 1rem; margin-bottom: 1rem; border-bottom: 1px solid #ffffff18; }
  .facts p { line-height: 1.55; }
  .locked span { display: block; width: 100%; height: .55rem; margin: .5rem 0; border-radius: 1rem; background: #ffffff20; }
  .locked span + span { width: 60%; }
  .placeholder { margin: auto; color: #cbd5e1; }
  .back { display: block; align-self: flex-start; min-width: 44px; min-height: 44px; padding: .5rem 1rem; border: 0; background: transparent; color: white; cursor: pointer; }
  .mobile-dialog { position: fixed; inset: 0; display: flex; flex-direction: column; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; border: 0; color: white; overflow-y: auto; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
  @media (max-width: 640px) {
    .characters { display: block; min-height: 0; }
    .cast { border: 0; }
    .cast ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; max-height: none; padding: .75rem; }
    .cast button { flex-direction: column; justify-content: flex-start; align-items: stretch; min-height: 9rem; padding: .5rem; background: #ffffff1a; text-align: left; }
    .cast button.chosen { background: #ffffff0e; }
    .cast .avatar { width: 100%; height: auto; aspect-ratio: 3 / 4; border-radius: .6rem; }
    .row-text { font-size: .8rem; }
    .desktop-detail { display: none; }
    .portrait { flex: none; min-height: 14rem; }
    .avatar.large { width: 9rem; }
    .details { flex: none; padding: 1.5rem; }
  }
</style>
