<script lang="ts">
    import Button from './Button.svelte';

    let { 
        title = $bindable(''),
        description = $bindable(''),
        onSubmit,
        onCancel,
        submitLabel = 'Create Chapter'
    }: {
        title?: string;
        description?: string;
        onSubmit: () => void;
        onCancel: () => void;
        submitLabel?: string;
    } = $props();
</script>

<form onsubmit={(e) => { e.preventDefault(); onSubmit(); }} class="space-y-6">
    <div>
        <label for="chapter-title" class="block text-sm font-medium text-gray-300 mb-2">
            Title <span class="text-red-400">*</span>
        </label>
        <input
            id="chapter-title"
            type="text"
            bind:value={title}
            required
            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            placeholder="Enter chapter title"
        />
    </div>

    <div>
        <label for="chapter-description" class="block text-sm font-medium text-gray-300 mb-2">
            Description
        </label>
        <textarea
            id="chapter-description"
            bind:value={description}
            rows="4"
            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
            placeholder="Enter chapter description (optional)"
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
            className="bg-cyan-600 hover:bg-cyan-700"
        >
            {submitLabel}
        </Button>
    </div>
</form>
