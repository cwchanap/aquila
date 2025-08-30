# Aquila Game

A modern web-based game built with Astro, Svelte, and Phaser, featuring Turso database integration and Vercel deployment.

## Features

- 🎮 **Game Engine**: Phaser 3 for interactive gameplay
- 🎨 **UI Framework**: Astro with Svelte components
- 🎯 **Styling**: Tailwind CSS with custom animations
- 🗄️ **Database**: Turso (LibSQL) with Kysely ORM
- 🚀 **Deployment**: Vercel with serverless functions
- 📱 **Responsive**: Mobile-friendly design

## Quick Start

1. **Install dependencies:**
   ```sh
   pnpm install
   ```

2. **Set up database:**
   See [DATABASE.md](./DATABASE.md) for detailed setup instructions.
   ```sh
   cp .env.example .env
   # Edit .env with your Turso credentials
   pnpm db:migrate
   ```

3. **Start development server:**
   ```sh
   pnpm dev
   ```

4. **Open in browser:**
   Navigate to `http://localhost:5090`

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm db:migrate` - Run database migrations
- `pnpm db:migrate:down` - Rollback last migration

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **UI Components**: [Svelte](https://svelte.dev/)
- **Game Engine**: [Phaser 3](https://phaser.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [Turso](https://turso.tech/) with [Kysely](https://kysely.dev/)
- **Deployment**: [Vercel](https://vercel.com/)

## Project Structure

```
src/
├── components/         # Reusable UI components
├── game/              # Phaser game logic
│   ├── scenes/        # Game scenes
│   ├── characters/    # Character classes
│   └── dialogue/      # Dialogue systems
├── layouts/           # Astro layouts
├── lib/               # Database and utilities
│   ├── db.ts          # Database connection
│   ├── repositories.ts # Database operations
│   └── migrations/    # Database migrations
├── pages/             # Astro pages and API routes
│   ├── api/           # API endpoints
│   └── story/         # Game story pages
└── styles/            # Global styles
```

## Database

The project uses Turso as the database provider with Kysely as the ORM. See [DATABASE.md](./DATABASE.md) for complete setup instructions.

## Deployment

The app is configured for Vercel deployment with the Vercel adapter. Environment variables should be set in your Vercel dashboard.

For complete setup instructions, please see our [Tailwind Integration Guide](https://docs.astro.build/en/guides/integrations-guide/tailwind).
