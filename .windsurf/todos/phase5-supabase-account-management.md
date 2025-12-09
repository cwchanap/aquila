---
description: Phase 5 – Supabase account management (logout, recovery)
---

- [x] T024: POST /api/auth/logout clears Supabase session + local auth context (apps/web/src/pages/api/auth/logout.ts)
- [x] T025: Sign-out UI wired to logout endpoint (UserStatus.svelte)
- [x] T026: Forgot password trigger via Supabase API (login page)
- [x] T027: Reset/change password flow (reset page or login flow)
- [x] T028: Localize auth management success/error messages (translations)
- [x] T023: Playwright E2E for sign-out + password reset + recovery login (packages/e2e/tests/auth-account-management.spec.ts)
