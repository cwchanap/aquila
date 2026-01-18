<script lang="ts">
  import { getTranslations } from '@aquila/dialogue';
  import type { Locale } from '@aquila/dialogue';
  import Button from './ui/Button.svelte';

  interface BulkActionBarProps {
    /** Whether bulk action bar is visible */
    isVisible: boolean;
    /** Selected item IDs */
    selectedIds: string[];
    /** Callback when bulk action should be cancelled */
    onCancel: () => void;
    /** Callback when a bulk action is selected */
    onAction?: (action: string) => void;
    /** Locale for translations */
    locale: Locale;
  }

  let {
    isVisible,
    selectedIds,
    onCancel,
    onAction,
    locale,
  }: BulkActionBarProps = $props();

  // Get translations using $derived for Svelte 5 runes mode
  const t = $derived(getTranslations(locale));

  // Instance-scoped state for outside click handling
  // Use regular variables to track listener state - avoids $effect infinite loop
  // These persist across renders but don't trigger reactivity
  let addOutsideClickListenerTimer: number | undefined = undefined;
  let isListenerAttached = false;
  let containerRef: HTMLElement | undefined = $state(undefined);

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;
    if (containerRef && !containerRef.contains(target)) {
      onCancel();
    }
  }

  // Reactive effect to manage outside click listener based on isVisible and selectedIds
  $effect(() => {
    // Cleanup function - runs before re-running effect or on unmount
    const cleanup = () => {
      if (addOutsideClickListenerTimer !== undefined) {
        window.clearTimeout(addOutsideClickListenerTimer);
        addOutsideClickListenerTimer = undefined;
      }
      // Only remove listener if it was attached and document is available
      if (isListenerAttached && typeof document !== 'undefined') {
        document.removeEventListener('click', handleClickOutside);
        isListenerAttached = false;
      }
    };

    // Run cleanup first when dependencies change
    cleanup();

    // Then re-attach if conditions are met
    if (
      isVisible &&
      selectedIds.length > 0 &&
      typeof document !== 'undefined'
    ) {
      if (!isListenerAttached) {
        // Defer listener attachment until after the current event loop
        // This ensures that clicks in the current interaction (like selecting a checkbox)
        // are already processed before the listener starts watching for outside clicks
        addOutsideClickListenerTimer = window.setTimeout(() => {
          document.addEventListener('click', handleClickOutside);
          isListenerAttached = true;
          addOutsideClickListenerTimer = undefined;
        }, 0);
      }
    }

    // Return cleanup function for when effect re-runs or component unmounts
    return cleanup;
  });
</script>

{#if isVisible && selectedIds.length > 0}
  <div
    bind:this={containerRef}
    class="bulk-action-bar"
    role="toolbar"
    aria-label={t.bulkAction.title}
  >
    <div class="bulk-action-bar-content">
      <span class="selection-count">
        {selectedIds.length}
        {selectedIds.length !== 1 ? t.bulkAction.items : t.bulkAction.item}
        {t.bulkAction.selected}
      </span>

      <div class="bulk-action-buttons">
        {#if onAction}
          <Button
            variant="menu"
            className="bulk-action-btn"
            on:click={() => onAction('delete')}
          >
            {t.bulkAction.delete}
          </Button>
          <Button
            variant="menu"
            className="bulk-action-btn"
            on:click={() => onAction('archive')}
          >
            {t.bulkAction.archive}
          </Button>
        {/if}

        <Button
          variant="menu"
          className="bulk-action-btn bulk-action-btn--cancel"
          on:click={onCancel}
        >
          {t.bulkAction.cancel}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bulk-action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    padding: 1rem;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
    z-index: 100;
  }

  .bulk-action-bar-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .selection-count {
    font-weight: 500;
    color: #333;
  }

  .bulk-action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  :global(.bulk-action-btn) {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    background: #4a90d9;
    color: white;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  :global(.bulk-action-btn:hover) {
    background: #3a7bc8;
  }

  :global(.bulk-action-btn--cancel) {
    background: #6b7280;
  }

  :global(.bulk-action-btn--cancel:hover) {
    background: #4b5563;
  }
</style>
