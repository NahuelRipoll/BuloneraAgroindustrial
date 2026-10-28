# Bulk product photos Implementation Plan

> Execute inline following the user's request to implement multiple photo selection with SKU matching and review.

**Goal:** Select multiple photos, match filenames to saved products or their variant codes, correct matches, and save only after review.

**Architecture:** Add a Fotos module with a pure matching/validation helper and a client review component. Reuse image optimization and the transactional product save. The current schema has one gallery per product: matching a variant adds to that product's shared gallery. New photos precede existing photos; existing files are retained. No ZIP support in this step.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Storage, node:test, Playwright.

### Task 1: Matching and limits
Files: create `src/lib/admin-photo-preview.ts` and `tests/admin-photo-preview.test.cjs`.
- [x] Test exact codes with leading zeros, `SKU-1.jpg` ordering, hyphenated SKUs, saved-only targets, variant-to-parent matching, ambiguous codes, duplicate gallery positions, invalid orders and a six-photo limit including existing images.
- [x] Implement `photoFilename(products, name)` with exact SKU precedence, and `buildPhotoPreview(products, rows)` returning reviewed rows and valid product groups. Preserve unmatched rows for manual correction, exclude unchecked rows from groups, and reject selected conflicts before saving.
- [x] Run `node --test tests/admin-photo-preview.test.cjs` and verify results: six passed after confirming the missing implementation initially failed.

### Task 2: Review UI and transactional save
Files: create `src/components/product-photo-manager.tsx`; modify `src/lib/admin-product-modules.ts`, `src/components/product-admin.tsx`, `src/app/globals.css`.
- [x] Add `/admin/productos/fotos` via the existing module registry and static route generator.
- [x] Select JPEG/PNG/WebP files (up to 60, 12 MB each, 120 MB total); use object URLs for previews and release them when removed or unmounted. Show SKU, order, destination, selected status and errors in review. Allow correcting destination codes and ordering before saving.
- [x] Explain shared variant galleries and the new cover order. Keep existing images, reject more than six per gallery, allow removing/unchecking conflicting files, and save only selected valid groups.
- [x] Optimize locally after confirmation, then reuse product save without staging photo payloads into local drafts before success. Keep failed groups for retry and remove successful groups to prevent duplicate uploads.

### Task 3: Verification and documentation
Files: modify `tests/products-ui.spec.cjs`, `docs/product-admin-modules.md` and `docs/flujo-importacion-masiva.md`.
- [x] Test browser previews with intercepted Supabase: no uploads before save, unmatched correction, variants, image order, preserved existing images, retry after failure and corrupted image handling.
- [x] Run `npm.cmd test`, `npx.cmd tsc --noEmit`, `npm.cmd run build` and browser tests: 51 unit/SQL tests passed, TypeScript and build passed, all 11 browser tests passed. To avoid the existing Windows webServer teardown hang, ran the production server independently and used an ignored `.next/photo-playwright.config.cjs` with `webServer: undefined`. Reviewed desktop/mobile screenshots and `git diff --check`.
- [x] Document filename rules, cover behavior, shared galleries, limits and retry behavior. Preserve preexisting `data` and `next-env.d.ts` changes; leave changes uncommitted unless requested.
