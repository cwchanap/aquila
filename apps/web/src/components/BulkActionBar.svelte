<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface BulkActionBarProps {
    /** Whether the bulk action bar is visible */
    isVisible: boolean;
    /** Selected item IDs */
    selectedIds: string[];
    /** Callback when bulk action should be cancelled */
    onCancel: () => void;
    /** Callback when a bulk action is selected */
    onAction?: (action: string) => void;
  }

  let { isVisible, selectedIds, onCancel, onAction }: BulkActionBarProps = $props();

  // Instance-scoped state for outside click handling
  // Each BulkActionBar instance has its own state - no shared module-level variables
  let addOutsideClickListenerTimer: number | undefined = $state(undefined);
  let outsideClickListenerAttached = $state(false);
  let containerRef: HTMLElement | undefined = $state(undefined);

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;
    if (containerRef && !containerRef.contains(target)) {
      // Delay cancellation to allow for checkbox interactions
      addOutsideClickListenerTimer = window.setTimeout(() => {
        onCancel();
      }, 200);
    }
  }

  onMount(() => {
    if (isVisible && selectedIds.length > 0) {
      // Set up outside click listener
      if (!outsideClickListenerAttached) {
        document.addEventListener('click', handleClickOutside);
        outsideClickListenerAttached = true;
      }
    }
  });

  onDestroy(() => {
    // Cleanup: clear timer and remove listener if attached
    // This ensures proper cleanup per instance
    if (addOutsideClickListenerTimer !== undefined) {
      window.clearTimeout(addOutsideClickListenerTimer);
      addOutsideClickListenerTimer = undefined;
    }
    if (outsideClickListenerAttached) {
      document.removeEventListener('click', handleClickOutside);
      outsideClickListenerAttached = false;
    }
  });
</script>

{#if isVisible && selectedIds.length > 0}
  <div
    bind:this={containerRef}
    class="bulk-action-bar"
    role="toolbar"
    aria-label="Bulk actions"
  >
    <div class="bulk-action-bar-content">
      <span class="selection-count">
        {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
      </span>
      
      <div class="bulk-action-buttons">
        {#if onAction}
          <button
            type="button"
            class="bulk-action-btn"
            onclick={() => onAction('delete')}
          >
            Delete
          </button>
          <button
            type="button"
            class="bulk-action-btn"
            onclick={() => onAction('archive')}
          >
            Archive
          </button>
        {/if}
        
        <button
          type="button"
          class="bulk-action-btn bulk-action-btn--cancel"
          onclick={onCancel}
        >
          Cancel
        </button>
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

  .bulk-action-btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    background: #4a90d9;
    color: white;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .bulk-action-btn:hover {
    background: #3a7bc8;
  }

  .bulk-action-btn--cancel {
    background: #6b7280;
  }

  .bulk-action-btn--cancel:hover {
    background: #4b5563;
  }
</style>
