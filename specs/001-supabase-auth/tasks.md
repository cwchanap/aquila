# Tasks: Supabase Auth Integration (Shared Supabase Project)

**Input**: Design documents from `/specs/001-supabase-auth/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: This feature relies on existing testing discipline (Vitest + Playwright). We include focused test tasks for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions (Aquila monorepo)

- Web app: `apps/web/src/...`
- Web tests (unit): `apps/web/src/**/__tests__/*.test.ts`
- E2E tests: `packages/e2e/tests/*.spec.ts`
- Translations: `packages/dialogue/src/translations/*.json`
- Feature docs: `specs/001-supabase-auth/*`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment and documentation setup for Supabase integration.

- [x] T001 Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` at repo root
- [x] T002 [P] Verify Supabase env var instructions in `specs/001-supabase-auth/quickstart.md` match the actual shared project configuration
- [x] T003 [P] Confirm `specs/001-supabase-auth/research.md` decisions align with the current shared Supabase project (no extra providers or migrations enabled)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Add `supabaseUserId` column to the Aquila Application User table in `apps/web/src/lib/drizzle/schema.ts`
- [x] T005 [P] Generate and review Drizzle migrations for the new `supabaseUserId` column in `apps/web/src/lib/drizzle/migrations/`
- [x] T006 [P] Extend user repository to load/create users by `supabaseUserId` in `apps/web/src/lib/drizzle/repositories.ts`
- [x] T007 [P] Create Supabase client helper using `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `apps/web/src/lib/auth/supabaseClient.ts`
- [x] T008 [P] Refactor `apps/web/src/lib/auth.ts` to stop initializing Better Auth for the web app and instead expose Supabase-based helpers (e.g., `getSupabaseClient`, `getCurrentSession`)
- [x] T009 [P] Add baseline auth-related translation keys (labels, errors, buttons) to `packages/dialogue/src/translations/en.json` and `packages/dialogue/src/translations/zh.json`
- [x] T010 Ensure feature documentation set is complete (spec, plan, research, data-model, contracts, quickstart) in `specs/001-supabase-auth/`

**Checkpoint**: Foundation ready – user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Player with existing Supabase account signs in (Priority: P1) 🎯 MVP

**Goal**: Existing Supabase users (from this or other apps in the shared project) can sign in to Aquila and access or create their game progress and settings.

**Independent Test**: A user with an existing Supabase account used by another application can sign in using the shared Supabase auth and see their Aquila-specific data if it exists or seamlessly create new Aquila data, without manual account linking.

### Tests for User Story 1

- [x] T011 [P] [US1] Add Vitest unit tests for repository method `findOrCreateBySupabaseUserId` in `apps/web/src/lib/drizzle/__tests__/userRepository.supabase.test.ts`
- [x] T012 [P] [US1] Add Playwright E2E test for existing Supabase user sign-in journey in `packages/e2e/tests/auth-existing-supabase-user.spec.ts`

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement `findOrCreateBySupabaseUserId` (or equivalent) in the user repository in `apps/web/src/lib/drizzle/repositories.ts`
- [x] T014 [P] [US1] Implement `GET /api/me` route that maps the current Supabase session to an Aquila Application User in `apps/web/src/pages/api/me.ts`
- [x] T015 [US1] Update `apps/web/src/lib/auth.ts` to call Supabase via `supabaseClient.ts` and `/api/me`, exposing a `getCurrentUser` helper for server/client usage
- [x] T016 [US1] Implement or update the sign-in UI to use Supabase email/password sign-in for existing users in `apps/web/src/pages/auth/index.astro`
- [x] T017 [US1] Wire the main entrypoint page to require an authenticated user (e.g., redirect unauthenticated users to auth page) in `apps/web/src/pages/index.astro`

**Checkpoint**: User Story 1 should be fully functional and testable independently (existing Supabase users can sign in and reach Aquila with correct data).

---

## Phase 4: User Story 2 - New player creates account (Priority: P2)

**Goal**: New players can create an account using Supabase email/password auth and immediately start playing, with a linked Application User stored in Cockroach/Postgres.

**Independent Test**: A new user can register, verify their account as required, and reach the game experience within one session without needing manual support.

### Tests for User Story 2

- [x] T018 [P] [US2] Add Playwright E2E test for new-user signup and first-play journey in `packages/e2e/tests/auth-new-user-signup.spec.ts`

### Implementation for User Story 2

- [x] T019 [P] [US2] Implement Supabase email/password signup UI (including basic validation) in `apps/web/src/pages/auth/signup.astro`
- [x] T020 [US2] Ensure signup flow creates an Aquila Application User linked by `supabaseUserId` on first successful sign-up in `apps/web/src/lib/auth.ts`
- [x] T021 [US2] Handle duplicate email and validation error states with localized messages in `apps/web/src/pages/auth/signup.astro` using translations from `packages/dialogue/src/translations/*.json`
- [x] T022 [US2] Ensure newly registered users are redirected into the main game experience after signup in `apps/web/src/pages/auth/signup.astro`

**Checkpoint**: User Stories 1 AND 2 should both work independently (existing users sign in, new users sign up and play).

---

## Phase 5: User Story 3 - Player manages and recovers account (Priority: P3)

**Goal**: Players can sign out, change passwords where applicable, and recover access if they forget credentials, via Supabase-powered flows.

**Independent Test**: A player who has lost access to their password can regain access to their account via the supported recovery flows without assistance from support.

### Tests for User Story 3

- [x] T023 [P] [US3] Add Playwright E2E test covering sign-out, password-reset request, and recovery login in `packages/e2e/tests/auth-account-management.spec.ts`

### Implementation for User Story 3

- [x] T024 [P] [US3] Implement `POST /api/auth/logout` route that clears Supabase session and local auth context in `apps/web/src/pages/api/auth/logout.ts`
- [x] T025 [US3] Implement sign-out UI (e.g., button in user menu) wired to `/api/auth/logout` in `apps/web/src/components/auth/UserMenu.svelte`
- [x] T026 [US3] Implement "forgot password" / password-reset trigger UI using Supabase password reset APIs in `apps/web/src/pages/auth/index.astro`
- [x] T027 [US3] Implement change-password or post-reset password update flow using Supabase APIs in `apps/web/src/pages/auth/index.astro` or a dedicated `apps/web/src/pages/auth/reset.astro`
- [x] T028 [US3] Localize success and error messages for account management flows using `packages/dialogue/src/translations/en.json` and `packages/dialogue/src/translations/zh.json`

**Checkpoint**: All three user stories are independently functional and testable (sign-in, sign-up, and account management/recovery).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and overall robustness.

- [ ] T029 [P] Update `specs/001-supabase-auth/quickstart.md` with any final changes to setup, env vars, or test commands
- [ ] T030 [P] Document Supabase auth integration and limitations in `apps/web/docs/auth-supabase.md` or, if missing, create this file
- [ ] T031 Run full test and lint suite (`bun --filter web test`, `bun test:e2e`, `bun lint`) and fix any failures in `apps/web` and `packages/e2e`
- [ ] T032 Remove remaining Better Auth-specific code and configuration from `apps/web/src/lib/auth.ts` and any related auth wiring files in `apps/web/src/pages/api/`
- [ ] T033 [P] Instrument auth flows to record end-to-end sign-in latency (from form submit to main experience) in `apps/web/src/lib/auth.ts` and relevant pages
- [ ] T034 [P] Add a script or dashboard query to compute 95th percentile sign-in latency for SC-001 using telemetry in `apps/web/scripts/` or `apps/web/docs/auth-supabase.md`
- [ ] T035 [P] [US1] Add negative Vitest tests verifying that `/api/me` and repository methods never return another user's data when Supabase user IDs differ in `apps/web/src/lib/drizzle/__tests__/userRepository.supabase.test.ts` and `apps/web/src/pages/api/__tests__/me.test.ts`
- [ ] T036 [P] [US3] Add Playwright E2E tests attempting cross-user data access and asserting denial in `packages/e2e/tests/auth-cross-user-deny.spec.ts`
- [ ] T037 [P] Implement user-facing error handling and logging when Supabase authentication succeeds but loading/creating the Application User in Cockroach/Postgres fails in `apps/web/src/lib/auth.ts` and `/api/me`
- [ ] T038 [P] Implement graceful degradation and user messaging when Supabase auth endpoints are unavailable in `apps/web/src/pages/auth/*.astro` and `apps/web/src/lib/auth.ts`
- [ ] T039 [P] Add unit/E2E tests for the above failure modes in `apps/web/src/**/__tests__` and `packages/e2e/tests/auth-error-states.spec.ts`
- [ ] T040 [P] Add a verification script that scans Supabase users against Application User records by `supabaseUserId` to detect unlinked records in `apps/web/scripts/verify-supabase-links.ts`
- [ ] T041 [P] Document how to run the Supabase link verification and interpret results in `apps/web/docs/auth-supabase.md`
- [ ] T042 [P] Define and document how to monitor support tickets related to auth issues (tags/labels, basic report) and run at least one post-release review for SC-004 in `apps/web/docs/auth-supabase.md` or an ops runbook

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies – can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion – BLOCKS all user stories.
- **User Stories (Phases 3–5)**: All depend on Foundational phase completion.
  - User Story 1 (P1) should be implemented first as the MVP.
  - User Stories 2 and 3 can follow sequentially or in parallel once Phase 2 completes.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2); no dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2); reuses infrastructure from US1 but remains independently testable.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2); reuses infrastructure from US1/US2 but remains independently testable.

### Within Each User Story

- Tests should be written and executed alongside implementation.
- Repository changes before API routes.
- API routes before UI wiring.
- Core sign-in/sign-up/account flows before secondary polish.
- Story should be complete and independently testable before moving to the next priority story.

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel.
- All Foundational tasks marked [P] can run in parallel within Phase 2.
- After Phase 2, User Stories 2 and 3 can progress in parallel if staffing allows, once US1 core foundation is stable.
- Within each user story, tasks marked [P] can be worked on in parallel when they touch different files.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL – blocks all stories).
3. Complete Phase 3: User Story 1 (existing Supabase users sign in and play).
4. **STOP and VALIDATE**: Run unit and E2E tests for US1; verify `/api/me` and main flows.
5. Deploy/demo if ready.

### Incremental Delivery

1. Complete Setup + Foundational → foundation ready.
2. Add User Story 1 → Test independently → Deploy/Demo (MVP).
3. Add User Story 2 → Test independently → Deploy/Demo.
4. Add User Story 3 → Test independently → Deploy/Demo.
5. Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together.
2. Once Foundational is done:
   - Developer A: User Story 1.
   - Developer B: User Story 2.
   - Developer C: User Story 3.
3. Stories complete and integrate independently, then Phase 6 polish tasks are shared.

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to a specific user story for traceability.
- Each user story should be independently completable and testable.
- Avoid vague tasks and cross-story dependencies that break independence.
