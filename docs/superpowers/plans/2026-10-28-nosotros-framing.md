# Nosotros photo framing Implementation Plan

> Execute inline following the user's request to drag photos and adjust the visible crop.

**Goal:** Adjust the position and zoom of each Nosotros photo and publish that framing to the homepage.

**Architecture:** Store optional position percentages and zoom alongside each image in the existing JSON gallery; no SQL migration is needed. Use a shared framing helper for the editor and carousel. Existing photos default to horizontal center, vertical top, zoom 1, matching the current display. Keep the bulk product photo work intact.

**Tech Stack:** React pointer events, CSS object-position/transform, TypeScript, Supabase JSON, node:test, Playwright.

### Task 1: Framing math
Files: create `src/lib/storefront-framing.ts` and `tests/storefront-framing.test.cjs`; update `src/lib/storefront-gallery.ts`.
- [x] Test legacy defaults, bounds, invalid data, correct movement by pixel overflow, zoom, and no-overflow axes. Implement normalized framing and shared CSS style helpers; four focused tests pass after the initial missing-implementation failure.

### Task 2: Editor and public display
Files: create `src/components/storefront-photo-framer.tsx`; update `src/components/storefront-admin.tsx`, `src/components/storefront-carousel.tsx`, `src/app/globals.css`.
- [x] Add mouse/touch dragging with pointer capture, keyboard arrows, labeled horizontal/vertical/zoom sliders and reset. Preview desktop/mobile shapes and explain that the crop adapts to screen dimensions.
- [x] Preserve image metadata when editing descriptions or ordering; reset framing when replacing a photo. Publish framing through the existing JSON save and render it in the carousel, preserving legacy defaults and clipping transformed images.

### Task 3: Verify and document
Files: update `tests/products-ui.spec.cjs`, `docs/nosotros-carousel.md`.
- [x] Browser tests with mocked gallery: no writes before publish, drag changes, sliders, zoom, save/reload persistence, public carousel styling, mobile touch and reset. Confirm failed publication retains edits for retry.
- [x] Run `npm.cmd test`, `npx.cmd tsc --noEmit`, `npm.cmd run build`, browser tests and `git diff --check`: 55 unit/SQL tests and all 13 browser tests pass; TypeScript and production build pass. Verified framing in gallery history snapshots. Inspected desktop/mobile screenshots. Used an independent local production server and ignored `.next/framing-playwright.config.cjs` to avoid the existing Windows webServer teardown hang.
- [x] Document controls, responsive framing, legacy behavior and publication. Leave all changes local until commit/push is requested.
