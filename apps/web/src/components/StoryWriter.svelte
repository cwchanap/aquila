<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus, BookOpen } from 'lucide-svelte';
  import Modal from './ui/Modal.svelte';
  import StoryForm from './ui/StoryForm.svelte';
  import StoryTree from './ui/StoryTree.svelte';
  import ChapterForm from './ui/ChapterForm.svelte';
  import SceneForm from './ui/SceneForm.svelte';

  type Scene = {
    id: string;
    title: string;
    order: number;
    content?: string;
  };

  type Chapter = {
    id: string;
    title: string;
    order: number;
    description?: string;
    scenes: Scene[];
  };

  type Story = {
    id: string;
    title: string;
    description?: string;
    status: 'draft' | 'published' | 'archived';
    chapters: Chapter[];
    directScenes: Scene[];
  };

  type ApiStory = Omit<Story, 'chapters' | 'directScenes'>;

  let stories = $state<Story[]>([]);
  let selectedStoryId = $state<string | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  // Modal states
  let showStoryModal = $state(false);
  let showChapterModal = $state(false);
  let showSceneModal = $state(false);

  // Form states
  let storyForm = $state<{
    title: string;
    description: string;
    status: 'draft' | 'published' | 'archived';
  }>({
    title: '',
    description: '',
    status: 'draft',
  });
  let chapterForm = $state({ title: '', description: '', storyId: '' });
  let sceneForm = $state({
    title: '',
    content: '',
    storyId: '',
    chapterId: '',
  });

  // Edit mode
  let editMode = $state<'story' | 'chapter' | 'scene' | null>(null);
  let editingStoryId = $state<string | null>(null);

  onMount(async () => {
    await loadStories();
  });

  async function loadStories() {
    loading = true;
    error = null;
    try {
      const response = await fetch('/api/stories');
      if (!response.ok) {
        throw new Error('Failed to load stories');
      }
      const data = (await response.json()) as ApiStory[];

      // Transform data to include chapters and scenes
      // For now, use empty arrays as the API returns empty
      stories = data.map(story => ({
        ...story,
        chapters: [],
        directScenes: [],
      }));

      if (stories.length > 0 && !selectedStoryId) {
        selectedStoryId = stories[0].id;
      }
    } catch (e) {
      successMessage = null;
      error = e instanceof Error ? e.message : 'An error occurred';
      console.error('Failed to load stories:', e);
    } finally {
      loading = false;
    }
  }

  async function handleCreateStory() {
    try {
      error = null;
      successMessage = null;
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyForm),
      });

      if (!response.ok) {
        throw new Error('Failed to create story');
      }

      const newStory = await response.json();
      stories = [...stories, { ...newStory, chapters: [], directScenes: [] }];
      selectedStoryId = newStory.id;
      showStoryModal = false;
      storyForm = { title: '', description: '', status: 'draft' };
      successMessage = 'Story created successfully.';
    } catch (e) {
      successMessage = null;
      error = e instanceof Error ? e.message : 'Failed to create story';
    }
  }

  async function handleUpdateStory() {
    if (!editingStoryId) return;

    try {
      error = null;
      successMessage = null;
      const response = await fetch(`/api/stories/${editingStoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyForm),
      });

      if (!response.ok) {
        throw new Error('Failed to update story');
      }

      const updatedStory = await response.json();

      stories = stories.map(story => {
        if (story.id !== updatedStory.id) return story;
        return {
          ...story,
          title: updatedStory.title,
          description: updatedStory.description ?? '',
          status: updatedStory.status,
        };
      });

      selectedStoryId = updatedStory.id;
      showStoryModal = false;
      storyForm = { title: '', description: '', status: 'draft' };
      editingStoryId = null;
      successMessage = 'Story updated successfully.';
    } catch (e) {
      successMessage = null;
      error = e instanceof Error ? e.message : 'Failed to update story';
    }
  }

  async function handleCreateChapter() {
    if (!chapterForm.storyId) return;

    try {
      error = null;
      successMessage = null;
      const story = stories.find(s => s.id === chapterForm.storyId);
      const order = story?.chapters.length || 0;

      const response = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: chapterForm.storyId,
          title: chapterForm.title,
          description: chapterForm.description,
          order,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create chapter');
      }

      const newChapter = await response.json();

      stories = stories.map(s => {
        if (s.id === chapterForm.storyId) {
          return {
            ...s,
            chapters: [...s.chapters, { ...newChapter, scenes: [] }],
          };
        }
        return s;
      });

      showChapterModal = false;
      chapterForm = { title: '', description: '', storyId: '' };
      successMessage = 'Chapter created successfully.';
    } catch (e) {
      successMessage = null;
      error = e instanceof Error ? e.message : 'Failed to create chapter';
    }
  }

  async function handleCreateScene() {
    if (!sceneForm.storyId) return;

    try {
      error = null;
      successMessage = null;
      const story = stories.find(s => s.id === sceneForm.storyId);
      let order = 0;

      if (sceneForm.chapterId) {
        const chapter = story?.chapters.find(c => c.id === sceneForm.chapterId);
        order = chapter?.scenes.length || 0;
      } else {
        order = story?.directScenes.length || 0;
      }

      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: sceneForm.storyId,
          chapterId: sceneForm.chapterId || null,
          title: sceneForm.title,
          content: sceneForm.content,
          order,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create scene');
      }

      const newScene = await response.json();

      stories = stories.map(s => {
        if (s.id === sceneForm.storyId) {
          if (sceneForm.chapterId) {
            return {
              ...s,
              chapters: s.chapters.map(c => {
                if (c.id === sceneForm.chapterId) {
                  return {
                    ...c,
                    scenes: [...c.scenes, newScene],
                  };
                }
                return c;
              }),
            };
          } else {
            return {
              ...s,
              directScenes: [...s.directScenes, newScene],
            };
          }
        }
        return s;
      });

      showSceneModal = false;
      sceneForm = { title: '', content: '', storyId: '', chapterId: '' };
      successMessage = 'Scene created successfully.';
    } catch (e) {
      successMessage = null;
      error = e instanceof Error ? e.message : 'Failed to create scene';
    }
  }

  function openStoryModal() {
    storyForm = { title: '', description: '', status: 'draft' };
    editMode = null;
    editingStoryId = null;
    showStoryModal = true;
  }

  function openChapterModal(storyId: string) {
    chapterForm = { title: '', description: '', storyId };
    editMode = null;
    showChapterModal = true;
  }

  function openSceneModal(storyId: string, chapterId?: string) {
    sceneForm = { title: '', content: '', storyId, chapterId: chapterId || '' };
    editMode = null;
    showSceneModal = true;
  }

  let selectedStory = $derived(stories.find(s => s.id === selectedStoryId));
</script>

<div class="story-writer">
  <!-- Error Banner -->
  {#if error}
    <div
      class="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200"
    >
      {error}
    </div>
  {/if}

  {#if successMessage}
    <div
      class="mb-6 p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-emerald-200"
    >
      {successMessage}
    </div>
  {/if}

  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <!-- Story List Sidebar -->
    <div class="lg:col-span-1">
      <div
        class="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-semibold text-white">Your Stories</h2>
          <button
            on:click={openStoryModal}
            class="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Create new story"
          >
            <Plus size={20} class="text-green-300" />
          </button>
        </div>

        {#if loading}
          <div class="text-center py-8 text-gray-400">Loading...</div>
        {:else if error}
          <div class="text-center py-8 text-red-200">
            <p>Failed to load stories.</p>
            <p class="text-sm mt-2">Please refresh or try again later.</p>
          </div>
        {:else if stories.length === 0}
          <div class="text-center py-8 text-gray-400">
            <BookOpen size={48} class="mx-auto mb-4 opacity-50" />
            <p>No stories yet</p>
            <p class="text-sm mt-2">Create your first story to get started</p>
          </div>
        {:else}
          <div class="space-y-2">
            {#each stories as story (story.id)}
              <button
                on:click={() => (selectedStoryId = story.id)}
                class={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedStoryId === story.id
                    ? 'bg-purple-500/20 border-purple-400/50'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div class="font-medium text-white truncate">{story.title}</div>
                <div class="text-xs text-gray-400 mt-1 capitalize">
                  {story.status}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Story Tree View -->
    <div class="lg:col-span-3">
      {#if selectedStory}
        <StoryTree
          story={selectedStory}
          onAddChapter={openChapterModal}
          onAddScene={openSceneModal}
          onEditStory={id => {
            editMode = 'story';
            editingStoryId = id;
            const story = stories.find(s => s.id === id);
            if (story) {
              storyForm = {
                title: story.title,
                description: story.description || '',
                status: story.status,
              };
              showStoryModal = true;
            }
          }}
          onEditChapter={() => {
            editMode = 'chapter';
            // Find chapter and populate form
            // TODO: Implement edit functionality
          }}
          onEditScene={() => {
            editMode = 'scene';
            // Find scene and populate form
            // TODO: Implement edit functionality
          }}
          onDeleteChapter={async () => {
            // TODO: Implement delete functionality
            console.log('Delete chapter');
          }}
          onDeleteScene={async () => {
            // TODO: Implement delete functionality
            console.log('Delete scene');
          }}
        />
      {:else if error}
        <div
          class="bg-white/5 backdrop-blur-sm rounded-lg p-12 border border-white/10 text-center text-red-200"
        >
          <p class="text-lg font-semibold">Unable to display stories.</p>
          <p class="text-sm mt-2">Please resolve the error above and retry.</p>
        </div>
      {:else}
        <div
          class="bg-white/5 backdrop-blur-sm rounded-lg p-12 border border-white/10 text-center"
        >
          <BookOpen size={64} class="mx-auto mb-4 text-gray-500" />
          <p class="text-gray-400 text-lg">
            Select a story to view its structure
          </p>
        </div>
      {/if}
    </div>
  </div>

  <!-- Modals -->
  <Modal
    bind:open={showStoryModal}
    title={editMode === 'story' ? 'Edit Story' : 'Create New Story'}
  >
    <StoryForm
      bind:title={storyForm.title}
      bind:description={storyForm.description}
      bind:status={storyForm.status}
      onSubmit={editMode === 'story' ? handleUpdateStory : handleCreateStory}
      onCancel={() => (showStoryModal = false)}
      submitLabel={editMode === 'story' ? 'Update Story' : 'Create Story'}
    />
  </Modal>

  <Modal bind:open={showChapterModal} title="Create New Chapter">
    <ChapterForm
      bind:title={chapterForm.title}
      bind:description={chapterForm.description}
      onSubmit={handleCreateChapter}
      onCancel={() => (showChapterModal = false)}
    />
  </Modal>

  <Modal bind:open={showSceneModal} title="Create New Scene">
    <SceneForm
      bind:title={sceneForm.title}
      bind:content={sceneForm.content}
      onSubmit={handleCreateScene}
      onCancel={() => (showSceneModal = false)}
    />
  </Modal>
</div>

<style>
  .story-writer {
    animation: fadeIn 0.5s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
