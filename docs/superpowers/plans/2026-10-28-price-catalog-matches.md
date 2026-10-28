# Catalog price matches Implementation Plan

> Execute inline in this session, following the user's implementation request.

**Goal:** Review and update prices only for codes already present in the catalog, including variant codes and leading zeros.

**Architecture:** Keep the existing price preview and transactional save flow. Classify unknown codes before validating prices or detecting conflicts, omit their details from the review, and report only an omitted count. Prefer the Código column over an Artículo description in spreadsheet headers.

**Tech Stack:** React, TypeScript, Next.js, node:test.

### Task 1: Regression coverage
- [x] Add tests in `tests/product-workspace.test.cjs` for unknown duplicate/invalid prices, variant matches, unchanged products, and Código after Artículo. Run `node --test tests/product-workspace.test.cjs` and confirm failures.

### Task 2: Implement
- [x] Update `src/lib/admin-price-preview.ts` to exclude unknown codes before price validation and conflict detection, counting each unknown code once.
- [x] Update `src/lib/admin-product-tools.ts` to prefer explicit Código/SKU headers over Artículo.
- [x] Update `src/components/product-price-manager.tsx` to display only matched changes and matched conflicts, with an omitted count and an explicit empty result. Exclude local-only drafts using `remoteId` so price updates cannot create them.

### Task 3: Verify and document
- [x] Run `npm.cmd test`, `npx.cmd tsc --noEmit`, and `npm.cmd run build`: 45 tests passed, TypeScript and production build passed. Browser checks reported OK for CSV matching/save/empty results, real PDF preview and failed-save retry using intercepted Supabase requests.
- [x] Update `docs/product-admin-modules.md` and `docs/pendientes.md` with the implemented behavior. Review the diff and preserve unrelated data files.
