# Aquila Game

A modern web-based game built with Astro, Svelte, and Phaser, featuring Drizzle ORM migrations and Vercel deployment.

## Features

- 🎮 **Game Engine**: Phaser 3 for interactive gameplay
- 🎨 **UI Framework**: Astro with Svelte components
- 🎯 **Styling**: Tailwind CSS with custom animations
- 🗄️ **Database**: PostgreSQL-compatible database via Drizzle ORM
- 🚀 **Deployment**: Vercel with serverless functions
- 📱 **Responsive**: Mobile-friendly design

## Quick Start

1. **Install dependencies:**
   ```sh
   pnpm install
   ```

2. **Set up environment:**
   ```sh
   cp .env.example .env
   # Edit .env with connection info (PostgreSQL required)
   ```
   Ensure `DATABASE_URL` is defined for local development, CI, and production.

3. **Generate and run migrations:**
   ```sh
   pnpm drizzle:generate
   pnpm drizzle:migrate
   ```
   > ⚠️ **CockroachDB warning:** Drizzle's CockroachDB support is pre-release. The default `pnpm drizzle:migrate` command blocks CockroachDB URLs to prevent accidental schema corruption. If you have verified compatibility in a staging environment, run `pnpm drizzle:migrate:allow-cockroach` with `ALLOW_COCKROACH_MIGRATIONS=true` set explicitly. The repo pins `pg@^8.11.3`; newer majors have known issues with CockroachDB and Drizzle.

4. **Start development server:**
   ```sh
   pnpm dev
   ```

5. **Open in browser:**
   Navigate to `http://localhost:5090`

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm drizzle:generate` - Generate SQL migrations from the schema
- `pnpm drizzle:migrate` - Run Drizzle migrations (blocks CockroachDB URLs)
- `pnpm drizzle:migrate:allow-cockroach` - Run migrations after explicitly allowing CockroachDB

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **UI Components**: [Svelte](https://svelte.dev/)
- **Game Engine**: [Phaser 3](https://phaser.io/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [Drizzle ORM](https://orm.drizzle.team/) targeting PostgreSQL-compatible databases
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

The project now uses a PostgreSQL-compatible database (CockroachDB staging or managed PostgreSQL in production) via Drizzle ORM. Ensure migrations have been applied to PostgreSQL and previous SQLite/Turso data has been migrated before deployment.

## Deployment

The app is configured for Vercel deployment with the Vercel adapter. Environment variables should be set in your Vercel dashboard, including **`DATABASE_URL`**.

### PostgreSQL migration checklist

1. Apply the latest Drizzle migrations to your PostgreSQL instance (`pnpm drizzle:migrate`).
2. If migrating from SQLite or Turso, run your data migration scripts to seed PostgreSQL.
3. Verify critical tables (`users`, `sessions`, `accounts`, `verificationTokens`) contain expected data before deploying.
4. Ensure CI/CD pipelines export `DATABASE_URL` so schema validation and tests use PostgreSQL.
5. Optional tuning: set `DB_ALLOW_SELF_SIGNED=true` in non-production environments requiring self-signed certificates, and adjust `DB_POOL_MAX` to tune PostgreSQL connection pooling (defaults to 10).

For complete setup instructions, please see our [Tailwind Integration Guide](https://docs.astro.build/en/guides/integrations-guide/tailwind).
