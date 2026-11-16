# HPA-911 — My Progress and character setup retirement
Design specification · 2026-11-15 · Aquila web

## Decision and scope

**One PR for HPA-911.** Start with this design/plan-only draft; implement and validate on the same branch and in the same PR. The source of truth for UI details is [Linear HPA-911](https://linear.app/cwchanap/issue/HPA-911/replace-character-setup-with-a-my-progress-page), including its attached **UI mockup (HTML): My Progress page, menus, Acts slider Home** and **UI mockup (PNG, all frames)**. No new image art, audio, or desktop-app changes are required.

Replace the obsolete web character-naming flow with a readable per-story progress dashboard at `/[locale]/progress`. Keep the existing cloud progress contract created by [HPA-703 / PR #117](https://github.com/cwchanap/aquila/pull/117): the browser is still the working copy; the authenticated `POST /api/progress` merges it with the account. No new endpoint, table, schema for progress, auth API, or localStorage key.

The start menu replaces its nonfunctional Settings control with My Progress. The account dropdown replaces Story Config with My Progress. Both desktop reader modes gain Home on the Acts panel's **always-visible** rail (the existing mobile Text Home remains).

## Existing architecture verified on main

| Current location | Existing responsibility | Proposed use |
| --- | --- | --- |
| `apps/web/src/components/StorySelect.svelte` | Reactive progress, session revalidation, sync lifecycle, catalog cards | Extract only the shared lifecycle; leave story-select presentation intact |
| `apps/web/src/lib/story-progress-store.ts` | Anonymous/account-scoped local progress, session import and anonymous claim | Reuse without changing storage keys or merge rules |
| `apps/web/src/lib/story-progress-sync.ts` | Account-scoped `POST /api/progress` with validated response and safe merge | Reuse unchanged for both views |
| `apps/web/src/lib/story-select.ts` | `buildCards`, reader URLs, chapter/ending text, Continue and Read Again | Reuse the same card model and links |
| `apps/web/src/pages/[locale]/stories/index.astro` | Server-derived auth state, ocean background, layout and navigation | Model the new Astro route on this page |
| `apps/web/src/components/MainMenu.svelte` and `UserStatus.svelte` | Start and account menus | Replace entry points, do not create a second menu system |
| `apps/web/src/components/ActPanel.svelte` | Always-visible tab + optional Acts content | Add a separate Home link in the rail; forward the existing `ReaderShell.backUrl` via its leaf readers |
| `apps/web/src/lib/drizzle/schema.ts` and `repositories.ts` | Obsolete `characterSetups` table and repository | Remove and generate the destructive migration |
| `packages/stories/src/translations/{en,zh,ja}.json` | Localized UI strings | Remove dead character-setup keys and add My Progress strings |

[HPA-961 / PR #125](https://github.com/cwchanap/aquila/pull/125) is now merged into `main`. Build on the merged Crossroads implementation; avoid unnecessary changes to `ReaderShell` or choice/Story Map behavior. No extra rebase gate is needed unless `main` advances. [HPA-821](https://linear.app/cwchanap/issue/HPA-821/reader-friction-main-menu-settings-does-nothing-first-choice-is-hidden) overlaps the dead Settings control but remains a separate follow-up for its other reader issues.

## Shared progress view lifecycle

Create a small per-instance client helper, e.g. `apps/web/src/lib/story-progress-view.svelte.ts`, with a factory accepting `locale` and server-rendered `authState/userId`. It owns only the state and operations **already inside** StorySelect:

- Read via `StoryProgressStore`, import old saved reader sessions, and claim anonymous progress **only for a validated account**.
- Use existing `syncStoryProgress` and `STORY_SELECT_SYNC_TIMEOUT_MS`. Preserve current sync results (idle/synced/failed/local-read failure/local-save failure); both pages use the same source of truth.
- Seed auth from the Astro page; recheck when auth is unavailable or a page is restored from the back/forward cache. Preserve the existing restore-generation and validated-account safeguards, so a stale account cannot claim progress or overwrite the next account's view.
- Join concurrent sync requests and queue at most one refresh after a validated restore, as StorySelect does now. No global event bus, cache service, framework store, or new API.
- Expose reactive `progress`, `authState`, `userId`, `syncState` and a mount/cleanup hook to each component. StorySelect retains its current status-line rule; My Progress maps the same state to the richer save card.
- Never call `/api/progress` for signed-out or unavailable users. If auth lookup or cloud sync fails, show only the readable browser copy and the appropriate failure state.

Both views derive story cards with `buildCards(STORY_CATALOG, progress, locale, translations.stories)`. Extract `StorySelect.svelte`'s existing `ICONS` and `ACCENTS` mappings into one small `lib/story-presentation.ts` module used by both views (retain the `Sparkles` icon fallback); do not duplicate story status computation or change the reader URL format.

## My Progress: presentation and calculations

Route: `apps/web/src/pages/[locale]/progress.astro` (same ocean/glass treatment as story select), mounting `MyProgress.svelte` using the already resolved server session. Page structure and mobile geometry must follow the attached Linear mockups:

1. **Save card:** signed in + idle/syncing, synced, and failure variants; signed out + browser-only and sign-in guidance (even with zero progress); unavailable + browser-only but **no login tip**. Keep local-read and local-save failures visible rather than claiming an unverified cloud save.
2. **Counters:** calculate all values from the catalog-bound `StoryCardModel[]` returned by `buildCards` (no separate raw-progress count logic). Started = cards with `card.progress !== null`; finished = cards with `card.endingsFound > 0` (ever reached an ending, even after restarting a story); endings found = `sum(card.endingsFound)`, already capped to each catalog entry's `stats.endings` by `buildCard`. Denominators = total cards and `sum(card.endingsTotal)` (no hardcoded 8). `StoryProgress.finished` represents the **current** reading position and may become false on re-read, so it must not drive the historical finished count.
3. **Your stories:** only started catalog cards, sorted by `card.progress.updatedAt` descending with catalog order as a stable tie-break. Show icon, genre, format, translated title, exact `card.status`, chapter bar or ending dots, and the existing `card.href` / `card.startOverHref` for Continue / Read Again. Format last-read age using the built-in `Intl.RelativeTimeFormat(locale)`; **omit last-read text when `updatedAt === 0`** (older seeded/imported progress intentionally uses the epoch as an ordering sentinel). Restart still uses `restart=1`; continue still uses saved `scene` and 1-based `dialogue` URL.
4. **Browse:** a localized count of catalog stories without progress; link to `/[locale]/stories`.
5. **Empty state:** explain automatic save and link to story select. The save card remains visible.
6. **Localization:** en/zh/ja for visible copy, labels and accessibility names; localized relative times via `Intl.RelativeTimeFormat`, not new per-unit translation strings. No text baked into image assets; mockup callout labels are not product UI.

This page is a **view**, not another persistence owner. Do not fetch story dialogues to construct its rows. Unknown/deleted story IDs in local progress do not count towards catalog statistics.

## Navigation and character setup removal

- Start menu order: **Start Game → My Progress → Bookmarks**. Delete the dead Settings handler/button and its unused strings.
- Account dropdown: **Profile → My Progress → Logout**. This entry is only present for signed-in users; the start menu gives signed-out users access.
- In `ActPanel.svelte`, make Home an independent accessible `<a>` on the **always-visible** 48px rail, above (not nested in) the Acts toggle. Keep the rail operational when the content panel is open or closed. `ReaderShell` already receives `backUrl` (`/[locale]/`) and forwards it to `NovelReader` and `VisualNovelReader`; these readers only need to pass it to `ActPanel`. Use the existing `t.common.backToHome` label from `ReaderSettingsMenu`; no new Home translation is necessary. Mobile Text already has Home and should not acquire a duplicate.
- Remove the web pages `/[locale]/characters`, `/[locale]/story/setup`, `/[locale]/story/train_adventure`, and `/api/character-setup` (they should 404 rather than redirect).
- Delete obsolete web-only character setup manager/local-storage helper, repository, types, validation schema, error codes, translation keys and tests. Keep `lib/character-name.ts`: it resolves speaker names and is unrelated.
- Remove character setup handling from `StoryRepository.deleteWithDependents`, while preserving bookmark handling.
- Remove `characterSetups` from Drizzle schema, generate and inspect a migration that drops `character_setups`. Saved names are intentionally discarded; no compatibility layer or data migration.
- Do not edit generated/ignored `pages/zh` and `pages/ja` proxy files; the existing generator owns them. Keep the Tauri/Phaser desktop code unchanged.

## Validation and operational constraints

The PR starts as **documentation-only draft**. Code, tests, and migration are added later to **this same PR**; no implementation-split PR. There is no art/SFX ticket because no new assets are necessary.

Acceptance is agent-executable **through MCP running the repository's committed checks**, not throwaway browser/DB scripts: anonymous progress, empty states, routing, Continue/Read Again and Acts Home are covered in Playwright; signed-in cloud merge, claim, account switch, sync states, and bfcache are covered by Svelte component tests with mocked `authClient` plus the existing progress API tests. The app supports Google OAuth only and has no browser sign-in fixture, so do not add a custom OAuth/session E2E harness for this ticket. The existing CI `e2e-tests.yml` runs migrations and `progress-db.test.ts` against real PostgreSQL; extend it to check `character_setups` is gone and bookmark deletion scope, without a special legacy-data seed harness. Use MCP to execute/inspect these repeatable suites and record outputs. MCP-driven browser screenshots compare desktop and mobile views to HPA-911 HTML/PNG mockups (signed-in/out, Chinese phone, empty, error/syncing, menu, Acts rail open/closed) and attach visual-diff evidence. No human visual acceptance condition.

**Production sequencing:** Vercel build does not apply migrations. Since the currently deployed app still reads `character_setups`, deploy the new web code first and run `bun drizzle:migrate` on production only after the rollout and the ticket's owner authorization. This is a release operation, not an activity to perform while writing a design-only PR.

## Explicit non-goals

A real Settings screen; resetting/deleting reading progress; syncing reader preferences; changing sign-in return navigation; redesigning story selection; new story content, translations of story dialogue, image generation, audio, or desktop features; broad abstractions for progress synchronization; backward compatibility with removed character-setup URLs or saved names.
