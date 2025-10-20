<script lang="ts">
  /* eslint-disable no-undef */
  import { onMount } from 'svelte';
  import { getLocale } from '$lib/i18n';
  import Phaser from 'phaser';
  import { PreloadScene, StoryScene } from '@aquila/game';

  let gameContainer: HTMLDivElement;
  let game: Phaser.Game | null = null;

  onMount(() => {
    const storyId = 'train_adventure';
    const locale = getLocale();

    // Check if character setup exists, otherwise use default
    let characterName = 'Player';
    try {
      const stored = localStorage.getItem(`aquila:character:${storyId}`);
      if (stored) {
        const data = JSON.parse(stored);
        characterName = data.characterName || 'Player';
      }
    } catch (e) {
      console.warn('Failed to read character setup, using default name:', e);
    }

    // Initialize Phaser game
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: gameContainer,
      backgroundColor: '#2c3e50',
      scene: [PreloadScene, StoryScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      }
    };

    game = new Phaser.Game(config);
    // Pass character name, locale, and storyId to the preload scene
    game.scene.start('PreloadScene', { characterName, locale, storyId });

    // Cleanup on unmount
    return () => {
      if (game) {
        game.destroy(true);
        game = null;
      }
    };
  });
</script>

<svelte:head>
  <title>Train Adventure</title>
</svelte:head>

<div bind:this={gameContainer} class="game-container"></div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  .game-container {
    width: 100vw;
    height: 100vh;
    background-color: #000;
  }
</style>
