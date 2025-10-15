<script lang="ts">
    import { ChevronRight, ChevronDown, FileText, BookOpen, Film, Plus, Trash2, Edit2 } from 'lucide-svelte';

    type Scene = {
        id: string;
        title: string;
        order: number;
    };

    type Chapter = {
        id: string;
        title: string;
        order: number;
        scenes: Scene[];
    };

    type Story = {
        id: string;
        title: string;
        chapters: Chapter[];
        directScenes: Scene[];
    };

    let { 
        story,
        onAddChapter = () => {},
        onAddScene = () => {},
        onEditStory = () => {},
        onEditChapter = () => {},
        onEditScene = () => {},
        onDeleteChapter = () => {},
        onDeleteScene = () => {}
    }: {
        story: Story;
        onAddChapter?: (storyId: string) => void;
        onAddScene?: (storyId: string, chapterId?: string) => void;
        onEditStory?: (storyId: string) => void;
        onEditChapter?: (chapterId: string) => void;
        onEditScene?: (sceneId: string) => void;
        onDeleteChapter?: (chapterId: string) => void;
        onDeleteScene?: (sceneId: string) => void;
    } = $props();

    let expandedChapters = $state<Set<string>>(new Set());
    let expandedStory = $state(true);

    function toggleChapter(chapterId: string) {
        if (expandedChapters.has(chapterId)) {
            expandedChapters.delete(chapterId);
        } else {
            expandedChapters.add(chapterId);
        }
        expandedChapters = expandedChapters;
    }
</script>

<div class="story-tree bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
    <!-- Story Root -->
    <div class="story-root mb-4">
        <div class="flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg border border-purple-300/30 hover:border-purple-300/50 transition-colors">
            <div class="flex items-center gap-2 flex-1">
                <button
                    onclick={() => expandedStory = !expandedStory}
                    class="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    {#if expandedStory}
                        <ChevronDown size={20} class="text-purple-300" />
                    {:else}
                        <ChevronRight size={20} class="text-purple-300" />
                    {/if}
                </button>
                <BookOpen size={20} class="text-purple-300" />
                <span class="font-semibold text-white">{story.title}</span>
            </div>
            <div class="flex items-center gap-2">
                <button
                    onclick={() => onEditStory(story.id)}
                    class="p-2 hover:bg-white/10 rounded transition-colors"
                    title="Edit story"
                >
                    <Edit2 size={16} class="text-blue-300" />
                </button>
                <button
                    onclick={() => onAddChapter(story.id)}
                    class="p-2 hover:bg-white/10 rounded transition-colors"
                    title="Add chapter"
                >
                    <Plus size={16} class="text-green-300" />
                </button>
                <button
                    onclick={() => onAddScene(story.id)}
                    class="p-2 hover:bg-white/10 rounded transition-colors"
                    title="Add scene"
                >
                    <Film size={16} class="text-cyan-300" />
                </button>
            </div>
        </div>
    </div>

    {#if expandedStory}
        <div class="pl-8">
            <!-- Chapters -->
            {#each story.chapters.sort((a, b) => a.order - b.order) as chapter (chapter.id)}
                <div class="chapter-item mb-3">
                    <div class="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                        <div class="flex items-center gap-2 flex-1">
                            <button
                                onclick={() => toggleChapter(chapter.id)}
                                class="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                {#if expandedChapters.has(chapter.id)}
                                    <ChevronDown size={18} class="text-cyan-300" />
                                {:else}
                                    <ChevronRight size={18} class="text-cyan-300" />
                                {/if}
                            </button>
                            <FileText size={18} class="text-cyan-300" />
                            <span class="text-white">{chapter.title}</span>
                            <span class="text-xs text-gray-400">({chapter.scenes.length} scenes)</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button
                                onclick={() => onEditChapter(chapter.id)}
                                class="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Edit chapter"
                            >
                                <Edit2 size={14} class="text-blue-300" />
                            </button>
                            <button
                                onclick={() => onAddScene(story.id, chapter.id)}
                                class="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Add scene"
                            >
                                <Plus size={14} class="text-green-300" />
                            </button>
                            <button
                                onclick={() => onDeleteChapter(chapter.id)}
                                class="p-1 hover:bg-white/10 rounded transition-colors"
                                title="Delete chapter"
                            >
                                <Trash2 size={14} class="text-red-300" />
                            </button>
                        </div>
                    </div>

                    {#if expandedChapters.has(chapter.id)}
                        <div class="pl-8 mt-2 space-y-2">
                            {#each chapter.scenes.sort((a, b) => a.order - b.order) as scene (scene.id)}
                                <div class="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5 hover:border-white/10 transition-colors">
                                    <div class="flex items-center gap-2">
                                        <Film size={16} class="text-yellow-300" />
                                        <span class="text-sm text-gray-200">{scene.title}</span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button
                                            onclick={() => onEditScene(scene.id)}
                                            class="p-1 hover:bg-white/10 rounded transition-colors"
                                            title="Edit scene"
                                        >
                                            <Edit2 size={12} class="text-blue-300" />
                                        </button>
                                        <button
                                            onclick={() => onDeleteScene(scene.id)}
                                            class="p-1 hover:bg-white/10 rounded transition-colors"
                                            title="Delete scene"
                                        >
                                            <Trash2 size={12} class="text-red-300" />
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/each}

            <!-- Direct Scenes (no chapter) -->
            {#if story.directScenes.length > 0}
                <div class="direct-scenes mt-4 space-y-2">
                    <div class="text-xs text-gray-400 uppercase tracking-wider mb-2">Individual Scenes</div>
                    {#each story.directScenes.sort((a, b) => a.order - b.order) as scene (scene.id)}
                        <div class="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5 hover:border-white/10 transition-colors">
                            <div class="flex items-center gap-2">
                                <Film size={16} class="text-yellow-300" />
                                <span class="text-sm text-gray-200">{scene.title}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button
                                    onclick={() => onEditScene(scene.id)}
                                    class="p-1 hover:bg-white/10 rounded transition-colors"
                                    title="Edit scene"
                                >
                                    <Edit2 size={12} class="text-blue-300" />
                                </button>
                                <button
                                    onclick={() => onDeleteScene(scene.id)}
                                    class="p-1 hover:bg-white/10 rounded transition-colors"
                                    title="Delete scene"
                                >
                                    <Trash2 size={12} class="text-red-300" />
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .story-tree {
        animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
