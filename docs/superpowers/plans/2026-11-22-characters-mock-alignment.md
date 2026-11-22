# Characters Mock Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the shared Characters view closer to the approved desktop and phone mock without changing its spoiler-safe behavior.

**Architecture:** Update the existing shared `Characters.svelte` presentation so both the standalone page and reader sheet receive the same visual improvements. Preserve the existing model, dialog behavior, portrait provider and progress selection.

**Tech Stack:** Svelte 5, CSS, Vitest, Playwright.

**Spec:** `docs/plans/2026-11-21-hpa-1131-characters-story-notes.md` and the approved follow-up: translucent blue panels, integrated desktop detail, more prominent name and badges, styled fact cards, and a lighter, more compact phone grid and detail.

## Global Constraints

- Use the mock in `.superpowers/sdd/2026-11-21-hpa-1131-characters-story-notes/evidence/hpa-1131-mockup.html` as the visual reference.
- No Mysteries, new artwork, new content, progress storage, or changes to the selector.
- Standalone and text mode retain initials; VN mode uses only currently available safe portraits.
- Preserve localization, contrast, keyboard and touch access, safe areas, and locked/unmet spoiler safety.
- Keep PR #149 open and use its existing branch.
- Work in this existing worktree: the reference mock is gitignored.

## Review Focus

- Unmet and unnamed characters: existing component and browser spoiler assertions must still pass.
- Missing or delayed portraits: initials remain legible; no layout shift breaks interaction.
- Long localized names and facts: no clipping or horizontal overflow at phone width.
- Nested reader dialog: Back, Escape, focus restoration, and background input blocking still work.
- Limited progress: locked facts remain anonymous and the standalone desktop layout stays wide.

---

### Task 1: Align the shared Characters presentation

**Files:**
- Modify: `apps/web/src/components/Characters.svelte`
- Modify: `packages/e2e/tests/utils.ts`
- Modify: `packages/e2e/tests/ocean-page-shell.spec.ts`
- Test: `apps/web/src/components/__tests__/Characters.test.ts`
- Test: `packages/e2e/tests/character-notes.spec.ts`

**Interfaces:** Preserve the `model`, `locale`, `portraitUrl`, and `onMobileDetailChange` props, existing class names, and accessible dialog semantics. Restyle rather than restructuring the component.

- [ ] **Step 1: Establish visual regression checks.** Extract the existing canvas color conversion, compositing, luminance, and contrast calculation from `ocean-page-shell.spec.ts` into `utils.ts` while preserving the Ocean tests. Assert at least 4.5:1 for secondary text in the desktop rail, desktop detail and phone card over the lightest sky stop, composing every relevant translucent background. Confirm the contrast test detects the mock's unsafe 0.30 glass by applying it temporarily; the existing darker UI may already pass. At 390×844 visit `/en/notes` and `/ja/notes` with the existing act2/5 eight-met seed and check `scrollWidth <= clientWidth + 1` for each `.cast button` and visible `.facts li`, including the long Mysterious Man in Black label. Retain existing grid, equal-height, Back, Escape, spoiler and focus checks.
- [ ] **Step 2: Update the shared presentation.** Make `.characters` a transparent desktop grid with a 1.5rem gap; put separate `rgba(2, 6, 23, 0.65)` glass surfaces on `.cast` and `.desktop-detail`, not `.detail`. Set secondary text to `#e2e8f0`; make phone cards carry their own glass and keep `.mobile-dialog` opaque. Use rounded fact cards, act chips, dashed locked cards, and a compact fixed-size 112px-wide, 3:4 phone header portrait for images and initials. Omit backdrop blur and mock labels or descriptions unsupported by the model. The compact portrait deliberately differs from the mock's larger phone hero.
- [ ] **Step 3: Validate the component.** Run the available Svelte autofixer, `bun --filter web test src/components/__tests__/Characters.test.ts` from the root, and `bunx playwright test tests/character-notes.spec.ts tests/ocean-page-shell.spec.ts --project=chromium --workers=1` from `packages/e2e`. Expect all tests to pass.
- [ ] **Step 4: Compare in a browser.** Capture desktop 1440×900 and phone 390×844, including a VN portrait state and an initials state. For VN, supply `PUBLIC_ASSET_BASE_URL=https://assets.aquila.cwchanap.dev/` and `PUBLIC_ASSET_ENVIRONMENT=production` to the dev server without overwriting the user's `.env`. Compare with the mock at comparable progress; check close/back, readable text, and overflow. Record deliberate differences.
- [ ] **Step 5: Deliver.** Review the diff, run `bun lint`, commit the changes on the existing branch, push, and update PR #149 with the new evidence and verification results.
