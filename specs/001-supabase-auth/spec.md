# Feature Specification: Supabase Auth Integration (Shared Supabase Project)

**Feature Branch**: `[001-supabase-auth]`  
 **Created**: 2025-11-29  
 **Status**: Draft  
 **Input**: User description: "Migrate web app authentication to supabase auth. Only use supabase for auth, while keeping all other stuff in existing cockroach postgres database"

## Clarifications

### Session 2025-11-29

- Q: Which user roles need to authenticate through Supabase as part of this feature? → A: All current player-facing web users; any future web-based admin/staff UIs must also use Supabase auth.

## User Scenarios & Testing _(mandatory)_

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.

  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Player with existing Supabase account signs in (Priority: P1)

Players who already have a Supabase account (for this or another app in the same Supabase project) can log in to Aquila through the Supabase-based authentication flow and access or create their game progress and settings.

**Why this priority**: This preserves continuity for players who already use the shared Supabase project and avoids confusion or duplicate accounts when they start using Aquila.

**Independent Test**: A user with an existing Supabase account used by another application can sign in using the shared Supabase auth and see their Aquila-specific data if it exists or seamlessly create new Aquila data, without manual account linking.

**Acceptance Scenarios**:

1.  **Given** a player account that already exists in the shared Supabase project, **When** the player signs in via Aquila’s Supabase-based authentication flow, **Then** the player is authenticated and any existing Aquila game data and settings linked to that Supabase user are available with no duplication.
2.  **Given** a player who has an existing Supabase account from another app but has never used Aquila before, **When** they sign in to Aquila using that account, **Then** a new Aquila application user record is created and linked to the Supabase identity without creating duplicate Supabase user records.

---

### User Story 2 - New player creates account (Priority: P2)

A new player can create an account using the Supabase-based authentication flow and immediately start playing, with all new game data stored in the existing Cockroach/Postgres database and tied to their account.

**Why this priority**: New players must have a simple, reliable onboarding experience so that authentication does not block adoption or gameplay.

**Independent Test**: A new user can register, verify their account as required, and reach the game experience within one session without needing manual support.

**Acceptance Scenarios**:

1.  **Given** a new visitor with no existing account, **When** they complete the Supabase-based sign-up flow, **Then** a Supabase identity and a linked application user record are created and the player can reach the main game screen.
2.  **Given** a new visitor, **When** they attempt to sign up with an email that already belongs to an existing account, **Then** the system clearly explains that the account exists and offers sign-in or account recovery options instead of silently failing.

---

### User Story 3 - Player manages and recovers account (Priority: P3)

A player can manage basic account security actions (sign out, change password where applicable, request magic links if used, and recover access if they forget their credentials) through flows powered by Supabase authentication.

**Why this priority**: Clear and reliable recovery flows reduce support load and build trust in the security of the game account.

**Independent Test**: A player who has lost access to their password can regain access to their account via the supported recovery flows without assistance from support.

**Acceptance Scenarios**:

1.  **Given** a signed-in player, **When** they initiate a sign-out or password change through the UI, **Then** their session is ended or updated across the application and subsequent access to protected data requires reauthentication.
2.  **Given** a player who can no longer remember their credentials, **When** they use the supported recovery flow (for example, password reset or magic link), **Then** they regain access to their existing account and associated game data without creating a duplicate account.

---

Additional user stories may be added later as needed to cover new authentication-related journeys.

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when a user signs in with a Supabase account that already exists in the shared Supabase project but has no Aquila application user record yet?
- How does the system handle cases where Supabase authentication succeeds but creating or loading the linked application user record in Cockroach/Postgres fails?
- What happens when Supabase authentication is temporarily unavailable while the rest of the application and database remain healthy?

## Requirements _(mandatory)_

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST authenticate all web application users (including any player-facing and admin/staff web UIs) through Supabase-managed authentication and must no longer accept credentials through the legacy authentication mechanism.
- **FR-002**: System MUST create and maintain exactly one canonical application user record in the existing Cockroach/Postgres database for each authenticated Supabase user, using a stable Supabase user identifier as the link between them.
- **FR-003**: System MUST ensure that all requests for player-specific or account-specific data are authorized based on the currently authenticated Supabase user and their linked application user record.
- **FR-004**: System MUST support account lifecycle flows including sign-up, sign-in, sign-out, password reset (if applicable), and email verification using Supabase-provided capabilities.
- **FR-005**: System MUST support signing in users who already exist in the shared Supabase project without requiring any migration or modification of their existing Supabase identity records.
- **FR-006**: System MUST create a new Aquila application user record and link it to the Supabase user on first successful sign-in to Aquila when no such record exists, without modifying other applications that share the same Supabase project.
- **FR-007**: System MUST support Supabase’s default email/password authentication as the only identity method in scope for the initial rollout, including Supabase-managed email verification and password reset flows, and MUST NOT introduce social login providers or other external identity providers as part of this feature.
- **FR-008**: System MUST treat the existing application database as the system of record for all profile and gameplay fields (such as display name, avatar, and locale), while Supabase stores only the minimal identity information required for authentication (for example, unique identifier, email address, and verification status).

### Assumptions

- Existing production Supabase users may already exist because of other applications that share the same Supabase project; this feature will integrate with those users as-is rather than performing any production data migration of Supabase identity records.
- There is no requirement to migrate existing production user data from a legacy authentication system into Supabase as part of this feature; any such migration, if needed later, will be handled by a separate initiative.
- Any future web-based admin or staff UIs for Aquila MUST also authenticate via Supabase; non-web tools remain out of scope for this feature.
- Supabase will be configured with its standard email/password authentication and default security capabilities; any future support for additional providers or custom policies will be addressed in separate features.

### Key Entities _(include if feature involves data)_

- **Supabase Identity**: Represents the authenticated user as managed by Supabase (for example, unique user identifier, email address, verification status, and high-level metadata). Used solely for authentication and coarse account status.
- **Application User**: Represents the player’s in-game and application-level data stored in the existing Cockroach/Postgres database, linked 1:1 to a Supabase Identity via its stable identifier and containing game progress and other domain data, but no credential secrets.

## Success Criteria _(mandatory)_

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: At least 95% of successful sign-in attempts complete in under 3 seconds from submitting the sign-in form to loading the player’s main experience.
- **SC-002**: 100% of newly created Aquila accounts result in both a Supabase identity (either pre-existing or newly created) and a linked application user record in the existing Cockroach/Postgres database, as verified by automated checks or reports.
- **SC-003**: Security and QA testing find 0 cases where a player can access another player’s data when using valid Supabase-based authentication, including when accounts are shared across multiple applications.
- **SC-004**: Within 30 days of release, fewer than 2% of active users contact support for issues related to sign-in, shared-account access, or password/account recovery caused by the new authentication system.
