<script lang="ts">
  import Button from './Button.svelte';

  let {
    title = $bindable(''),
    content = $bindable(''),
    onSubmit,
    onCancel,
    submitLabel = 'Create Scene',
  }: {
    title?: string;
    content?: string;
    onSubmit: () => void;
    onCancel: () => void;
    submitLabel?: string;
  } = $props();
</script>

<form onsubmit={onSubmit} class="space-y-6">
  <div>
    <label
      for="scene-title"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      Title <span class="text-red-400">*</span>
    </label>
    <input
      id="scene-title"
      type="text"
      bind:value={title}
      required
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
      placeholder="Enter scene title"
    />
  </div>

  <div>
    <label
      for="scene-content"
      class="block text-sm font-medium text-gray-300 mb-2"
    >
      Content
    </label>
    <textarea
      id="scene-content"
      bind:value={content}
      rows="8"
      class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all resize-none font-mono text-sm"
      placeholder="Enter scene content (optional)"
    ></textarea>
  </div>

  <div class="flex justify-end gap-3 pt-4">
    <Button
      type="button"
      variant="default"
      onclick={onCancel}
      className="bg-gray-600 hover:bg-gray-700"
    >
      Cancel
    </Button>
    <Button
      type="submit"
      variant="default"
      className="bg-yellow-600 hover:bg-yellow-700"
    >
      {submitLabel}
    </Button>
  </div>
</form>
