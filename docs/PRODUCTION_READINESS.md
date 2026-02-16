# HooshPro – Production Readiness Report
Date: 2026-02-14

## Scope
Current production-readiness snapshot after the service-first refactor and frontend build verification.

## Current State (verified)
- Backend is service-first for all active admin/public modules:
  - Pages, media, templates, menus
  - Collections/content-types/entries
  - Options
  - Taxonomies/terms/entry-term assignment
  - Themes
- Routers are thin and delegate to `backend/app/services/*`.
- DB bootstrap is migration-first:
  - Startup runs Alembic upgrade head.
  - Seed defaults are isolated under `backend/app/seed/`.
- CSRF middleware is enabled for unsafe cookie-auth methods (with auth login/token exemptions).
- Frontend checks are green:
  - `npm run lint` passes
  - `npm run build` passes
- Backend checks are green:
  - `ruff check backend/app` passes
  - `python -m compileall backend/app` passes

## What Was Fixed in This Cycle
1. Themes no longer use legacy resource pattern; they now have a dedicated service (`backend/app/services/themes_service.py`) and thin router (`backend/app/routers/themes.py`).
2. Frontend API typing/build issue fixed in `frontend/lib/http.ts` by switching CSRF header handling to `Headers` API.
3. Frontend API layer started (`frontend/lib/api/*`) with concrete modules:
   - `frontend/lib/api/themes.ts`
   - `frontend/lib/api/options.ts`
   - `frontend/lib/api/pages.ts`
4. `admin/settings` and `admin/themes` are aligned with this API-layer direction.

## Remaining Gaps to Reach Production MVP
### Backend
1. Legacy cleanup:
   - DONE: removed unused `backend/app/resource_engine/`.
2. Security hardening:
   - Add login-rate limiting.
   - Add explicit CSRF token bootstrap/refresh endpoint documentation for frontend clients.
3. Operational hardening:
   - Add structured request logging + error correlation ids.
   - Add backup/restore docs for SQLite (or finalize Postgres target for production).

### Frontend
1. Complete API client split:
   - DONE this cycle for collections/taxonomies/entries/themes/settings/pages baseline; continue pages/media/templates/menus detail screens.
2. Reduce editor complexity for MVP:
   - Keep primitives-first flow and trim non-essential insert presets.
3. Add focused smoke automation for:
   - auth redirect behavior
   - page edit/save
   - media upload + select
   - public slug rendering

### QA / Release
1. Run backend + frontend full checks in CI.
2. Execute smoke matrix from `docs/HOOSHPRO_REFERENCE.md` before release.
3. Freeze schema and perform a clean DB bootstrap validation from empty state.

## Release Gate (MVP)
MVP is release-ready when all are true:
- Lint/build/compile all green in CI.
- Admin CRUD for pages/media/templates/menus/themes/options/taxonomies/collections works end-to-end.
- Public render works for `/`, `/[slug]`, theme resolution, and menu/footer template composition.
- Security baseline in place: session auth, CSRF, admin-route enforcement.

