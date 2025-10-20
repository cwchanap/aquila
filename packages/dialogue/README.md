# @aquila/dialogue

Standalone dialogue system package for the Aquila game project.

## Overview

This package contains all dialogue content, character definitions, and story scripts for Aquila. It is designed to be framework-agnostic and can be used independently of the game engine.

## Features

- **Character System**: Enum-based character IDs with metadata (name, alias)
- **Dialogue Types**: Type-safe dialogue entries and choice definitions
- **Story Content**: Localized dialogue for multiple languages (currently EN/ZH)
- **Translations**: Shared UI translations for web and desktop apps
- **Framework Agnostic**: No dependencies on Phaser or other game engines

## Structure

```
src/
├── characters/
│   ├── CharacterId.ts       # Character enum and directory
│   └── index.ts
├── stories/
│   ├── trainAdventure/      # Story-specific dialogue
│   │   ├── en.ts            # English dialogue
│   │   ├── zh.ts            # Chinese dialogue
│   │   └── index.ts
│   └── index.ts             # Story loader
├── translations/            # Shared UI translations
│   ├── en.json              # English UI strings
│   └── zh.json              # Chinese UI strings
├── types.ts                 # Core dialogue types
└── index.ts                 # Package exports
```

## Usage

### Basic Import

```typescript
import { CharacterId, getStoryContent } from '@aquila/dialogue';

// Get story content for a locale
const { dialogue, choices } = getStoryContent('train_adventure', 'zh');

// Access character information
import { CharacterDirectory } from '@aquila/dialogue';
const characterInfo = CharacterDirectory.getById(CharacterId.LiJie);
```

### Character References in Dialogue

All dialogue entries use `characterId` field with `CharacterId` enum values:

```typescript
{
    characterId: CharacterId.Narrator,
    dialogue: "The train arrives at the station..."
}
```

This avoids circular dependencies and allows the dialogue package to remain independent of the game engine.

### Translations

UI translations are shared between web and desktop apps:

```typescript
// Import translations
import en from '@aquila/dialogue/translations/en.json';
import zh from '@aquila/dialogue/translations/zh.json';

// Use in your app
const translations = { en, zh };
const locale = 'zh';
const text = translations[locale].menu.startGame; // "开始游戏"
```

The translation files contain all UI strings for:
- Authentication (login, profile)
- Menu and navigation
- Character setup
- Story selection
- Common UI elements

## Development

```bash
# Type checking
pnpm typecheck

# Build declaration files
pnpm build

# Lint
pnpm lint

# Run all checks
pnpm turbo build test lint --filter=@aquila/dialogue
```

## Integration with Game Package

The `@aquila/game` package extends the base dialogue types to support game-specific features like `characterRef` (Character class instances) while consuming the base dialogue content from this package.

## Adding New Stories

1. Create a new directory under `src/stories/`
2. Add locale-specific dialogue files (e.g., `en.ts`, `zh.ts`)
3. Export a loader function in the story's `index.ts`
4. Register the loader in `src/stories/index.ts`

## Adding New Characters

1. Add character ID to `CharacterId` enum in `src/characters/CharacterId.ts`
2. Add character info to `characterTable` with name and alias
3. Character will be automatically available via `CharacterDirectory`
