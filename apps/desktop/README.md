# The Platform at the End of the World - Desktop App

A desktop application for The Platform at the End of the World visual novel game, built with Tauri + SvelteKit + TypeScript.

## Features

- **Standalone Desktop App**: No web browser required
- **Tailored for The Platform at the End of the World**: Pre-configured for The Platform at the End of the World story
- **Offline First**: All game data stored locally (no remote API calls)
- **Bilingual Support**: English and Chinese language options
- **Character Setup**: Create and save your character locally
- **Phaser Game Engine**: Powered by Phaser 3 for smooth gameplay

## Architecture

- **Framework**: Tauri v2 + SvelteKit (SPA mode)
- **Game Engine**: Phaser 3
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript
- **Game Content**: Uses `@aquila/game` and `@aquila/dialogue` workspace packages

## Development

### Prerequisites

- Node.js 18+
- pnpm 10.8.0+
- Rust (for Tauri)

### Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Run in development mode
pnpm --filter desktop dev

# Or build the desktop app
pnpm --filter desktop tauri build
```

## Pages

- **Main Menu** (`/`): Start game or access settings
- **Character Setup** (`/setup`): Create your character for The Platform at the End of the World
- **Game** (`/game`): The main Phaser game scene

## Key Differences from Web App

- **No Authentication**: Desktop app doesn't require login
- **No Story Selection**: Hardcoded to The Platform at the End of the World
- **Local Storage Only**: Character data saved to localStorage
- **No Remote API**: All game state managed locally

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
