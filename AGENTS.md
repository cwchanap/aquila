# Repository Guidelines

## Project Structure & Module Organization
Aquila uses a pnpm/turbo monorepo. Web client and API routes live in `apps/web` (Astro + Svelte) while the desktop shell sits in `apps/desktop` (Tauri + SvelteKit). Shared Phaser engine logic resides in `packages/game`, with reusable media in `packages/assets`. Database helpers and migrations are under `apps/web/src/lib`, including migration files in `apps/web/src/lib/migrations`. Unit-level specs sit alongside the libraries in `apps/web/src/lib/__tests__`, and Playwright suites live in `apps/web/tests`. Repo-wide scripts (for example `scripts/verify-db.sh`) support database verification and CI tasks.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `pnpm dev`: run every package’s `dev` target via Turbo (web, assets, supporting tools).
- `pnpm dev:web`: start the Astro dev server on http://localhost:5090.
- `pnpm dev:db`: launch the local Turso emulator on port 5091.
- `pnpm build`: execute all package build pipelines.
- `pnpm lint` / `pnpm lint:fix`: run ESLint across the workspace, optionally auto-fixing.
- `pnpm test`: execute Vitest suites; scope with `pnpm --filter web test` when iterating.
- `pnpm test:e2e`: execute Playwright specs from `apps/web/tests`.
- `pnpm db:migrate` / `pnpm db:migrate:down`: apply or rollback migrations against the configured database.

## Coding Style & Naming Conventions
Prettier enforces formatting (80-character wrap, semicolons, single quotes); TypeScript files use 4-space indentation, other files 2 spaces. ESLint (Astro, Svelte, and TypeScript configs) guards imports, unused code, and accessibility rules. Prefer PascalCase for component files (`MainMenu.astro`, `Button.svelte`), camelCase for utilities, and SCREAMING_SNAKE_CASE for environment variables. Keep co-located styles (`.astro`, `.svelte`, or module CSS) close to the component they style, and scope Tailwind classes to component blocks rather than globals.

## Testing Guidelines
Vitest powers unit tests; add new coverage under `apps/web/src/lib/__tests__` using the `*.test.ts` suffix and verify with `pnpm --filter web test:coverage`. End-to-end flows rely on Playwright specs in `apps/web/tests/*.spec.ts`; start `pnpm dev` (and `pnpm dev:db` when exercising auth) before running `pnpm test:e2e`. Use `pnpm test:report` to review traces, videos, and screenshots, and update failing snapshots intentionally.

## Commit & Pull Request Guidelines
Adhere to Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in the Git history. Write imperative, scope-aware summaries (e.g. `feat: add desktop tauri app scaffold`) and include detail in the body when necessary. Pull requests should link related issues, list verification commands, and attach screenshots or recordings for UX or gameplay changes. Ensure lint, unit, and e2e checks pass before requesting review.

## Environment & Configuration Tips
Copy `.env.example` to `.env` and supply Turso credentials before running database scripts. Use `pnpm db:setup` to bootstrap a fresh schema against the local Turso instance. Keep secrets out of version control (`.env.local` is ignored) and mirror required keys in Vercel before deployment. For desktop builds, configure Tauri environment variables within `apps/desktop/src-tauri/tauri.conf.json`.
