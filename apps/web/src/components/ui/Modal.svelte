<script lang="ts">
  import { X } from 'lucide-svelte';
  import { cn } from '@/lib/utils';

  let {
    open = $bindable(false),
    title = '',
    className = '',
  }: {
    open?: boolean;
    title?: string;
    className?: string;
  } = $props();

  function handleClose() {
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClose();
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      role="presentation"
      aria-hidden="true"
      tabindex="0"
      onclick={handleClose}
      onkeydown={handleOverlayKeydown}
    />
    <div
      class={cn(
        'relative bg-gradient-to-br from-gray-900/95 to-gray-800/95 rounded-2xl shadow-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-hidden',
        className
      )}
      onkeydown={handleKeydown}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between p-6 border-b border-white/10"
      >
        <h2 class="text-2xl font-bold text-white">{title}</h2>
        <button
          type="button"
          onclick={handleClose}
          class="p-2 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X size={24} class="text-gray-400 hover:text-white" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
        <slot />
      </div>
    </div>
  </div>
{/if}

<style>
  div[role='dialog'] {
    animation: slideUp 0.3s ease-out;
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
