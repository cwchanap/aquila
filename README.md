# Aquila

A visual novel game platform with interactive storytelling, built as a monorepo with web and desktop applications.

## Overview

Aquila is a narrative-driven game featuring dialogue-based storytelling with character interactions, choices, and multiple language support. The project includes:

- **Web App**: Full-featured web application with authentication and story management
- **Desktop App**: Standalone Tauri application optimized for offline gameplay
- **Shared Packages**: Reusable game engine and dialogue content libraries

## Features

- 🎮 **Phaser 3 Game Engine**: Interactive gameplay with scene management and dialogue systems
- 🎨 **Modern UI**: Astro with Svelte components and glassmorphism design patterns
- 🌍 **Multilingual**: Built-in support for English and Chinese
- 🗄️ **Database**: PostgreSQL via Drizzle ORM with type-safe queries
- 🔐 **Authentication**: Better Auth integration with session management
- 📦 **Monorepo**: Turborepo for efficient builds and parallel task execution
- 🚀 **Vercel Deployment**: Serverless deployment with SSR support

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.1.26 or higher
- PostgreSQL-compatible database (for web app development)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp apps/web/.env.example apps/web/.env
# Edit apps/web/.env with your DATABASE_URL
```

### Development

```bash
# Start all workspaces in development mode
bun dev

# Or start only the web app (port 5090)
bun dev:web

# Or start only the desktop app
bun --filter desktop dev
```

Visit `http://localhost:5090` for the web app.

### Database Setup

```bash
# Generate migrations from schema changes
bun drizzle:generate

# Apply migrations to your database
bun drizzle:migrate

# Open Drizzle Studio GUI (optional)
bun drizzle:studio
```

> **Database**: Prisma Postgres (managed PostgreSQL). Migrations run with `bun drizzle:migrate`.

## Project Structure

This is a monorepo managed by Turborepo and Bun workspaces:

```
apps/
├── web/                # Astro web application (SSR)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── lib/        # Database, auth, utilities
│   │   ├── pages/      # Routes and API endpoints
│   │   └── styles/     # Tailwind configuration
└── desktop/            # Tauri desktop application
    └── src/            # SvelteKit SPA

packages/
├── game/               # @aquila/game - Phaser scenes and engine
│   └── src/
│       ├── scenes/     # BaseScene, StoryScene
│       └── types.ts    # Game type definitions
├── stories/            # @aquila/stories - Story content (raw markdown → compiled)
│   ├── raw/            # Hand-authored markdown acts + compiler.config.ts
│   └── src/
│       ├── compiler/   # Markdown → dialogue/flow compiler
│       ├── generated/  # Compiled output (do not edit; run bun compile:stories)
│       ├── stories/    # Generated loaders + index.ts registry
│       └── translations/ # UI text (en.json, zh.json)
├── e2e/                # Playwright E2E test suite
│   └── tests/          # E2E specs, setup, utilities
└── assets/             # Shared game assets
```

## Available Commands

### Development

- `bun dev` - Start all workspaces (web + desktop) with hot reload
- `bun dev:web` - Start Astro web app on port 5090
- `bun build` - Build all workspaces for production
- `bun preview` - Preview production build (web)

### Testing

- `bun test` - Run all tests (unit + E2E)
- `bun test:e2e` - Run Playwright E2E tests
- `bun test:headed` - Run E2E tests with visible browser
- `bun test:debug` - Debug E2E tests
- `bun test:report` - View Playwright HTML report
- `bun --filter web test` - Run Vitest unit tests
- `bun --filter web test:watch` - Unit tests in watch mode

### Database

- `bun drizzle:generate` - Generate SQL migrations from schema
- `bun drizzle:migrate` - Apply migrations
- `bun drizzle:studio` - Open Drizzle Studio database GUI

### Code Quality

- `bun lint` - Run ESLint across all workspaces
- `bun lint:fix` - Auto-fix ESLint issues

## Technology Stack

### Web App (`apps/web`)

- **Framework**: [Astro](https://astro.build/) 5.x with SSR
- **Components**: [Svelte](https://svelte.dev/) 5.x
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4
- **Database**: [Drizzle ORM](https://orm.drizzle.team/) + PostgreSQL
- **Auth**: [Better Auth](https://www.better-auth.com/)
- **Testing**: [Vitest](https://vitest.dev/) + [Playwright](https://playwright.dev/)

### Desktop App (`apps/desktop`)

- **Framework**: [Tauri](https://tauri.app/) v2 + SvelteKit
- **Runtime**: Rust + Web technologies
- **Mode**: SPA (no SSR)

### Shared Packages

- **Game Engine**: [Phaser](https://phaser.io/) 3.x (`@aquila/game`)
- **Content**: Story content package (`@aquila/stories`, compile-from-raw)
- **Build Tool**: [Turborepo](https://turbo.build/repo)

## Development Workflow

### Adding a New Story

1. Author story as markdown acts in `packages/stories/raw/[storyName]/` with a `compiler.config.ts`
2. Compile with `bun compile:stories` (generates `packages/stories/src/generated/[storyName]/` and loaders)
3. Register the loader in `packages/stories/src/stories/index.ts`
4. Add the story id to the `StoryId` enum in `apps/web/src/lib/story-types.ts`

### Database Schema Changes

1. Modify `apps/web/src/lib/drizzle/schema.ts`
2. Run `bun drizzle:generate` to create migration files
3. Review generated SQL in `apps/web/src/lib/drizzle/migrations/`
4. Apply with `bun drizzle:migrate`

### Running Specific Tests

```bash
# Single E2E test file
bun --filter e2e test:e2e tests/homepage.spec.ts

# Specific test by name
bun --filter e2e test:e2e -g "should navigate to login"

# Unit tests for a specific file
bun --filter web test src/lib/__tests__/utils.test.ts
```

## Environment Variables

### Required (Web App)

- `DATABASE_URL` - PostgreSQL connection string

### Optional

- `BETTER_AUTH_URL` - Auth service URL (defaults to app URL)
- `BETTER_AUTH_SECRET` - Auth encryption key (auto-generated in dev)
- `DB_ALLOW_SELF_SIGNED` - Allow self-signed SSL certs (`true`/`false`)
- `DB_POOL_MAX` - PostgreSQL connection pool size (default: 10)

## Deployment

### Vercel (Web App)

The web app is configured for Vercel with automatic deployments:

1. Connect your repository to Vercel
2. Set `DATABASE_URL` in environment variables
3. Set `BETTER_AUTH_SECRET` for production
4. Deploy (Vercel will run `bun build` automatically)

### Desktop App

Build platform-specific binaries:

```bash
# Build for current platform
bun --filter desktop tauri build

# Output: apps/desktop/src-tauri/target/release/
```

## Contributing

This project uses:

- **Git Hooks**: Husky with lint-staged for pre-commit checks
- **Code Style**: Prettier + ESLint with Astro and Svelte plugins
- **Commit Format**: Conventional commits recommended

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Detailed architecture and development patterns
- [E2E Tests](./packages/e2e/tests/README.md) - Playwright E2E testing guide
- [Desktop App](./apps/desktop/README.md) - Desktop-specific setup

## License

This project is private and not licensed for public use.
