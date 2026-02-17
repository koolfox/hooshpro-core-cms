# HooshPro – Production Readiness Report
Date: 2026-02-17

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
  - `python -m compileall backend/app` passes
  - `.\.venv\Scripts\python -m ruff check app scripts` passes

## What Was Fixed in This Cycle
1. Themes no longer use legacy resource pattern; they now have a dedicated service (`backend/app/services/themes_service.py`) and thin router (`backend/app/routers/themes.py`).
2. Frontend API typing/build issue fixed in `frontend/lib/http.ts` by switching CSRF header handling to the `Headers` API.
3. Frontend API layer started (`frontend/lib/api/*`) with concrete modules:
   - `frontend/lib/api/themes.ts`
   - `frontend/lib/api/options.ts`
   - `frontend/lib/api/pages.ts`
4. `admin/settings` and `admin/themes` are aligned with this API-layer direction.
5. Added shared frontend error formatting (`frontend/lib/error-message.ts`) and wired admin screens to show backend error metadata consistently.
6. Restored the admin health gate route by mounting `admin.router` in `backend/app/main.py` (`/api/admin/ping` is live again).
7. Added sensitive query-string redaction in structured request logs (`backend/app/main.py`).
8. Added an end-to-end MVP smoke script (`backend/scripts/smoke_mvp.py`) covering health, auth/csrf, admin gate, and pages CRUD flow.

## Remaining Gaps to Reach Production MVP
### Backend
1. Legacy cleanup:
   - DONE: removed unused `backend/app/resource_engine/`.
2. Security hardening:
   - DONE: login-rate limiting on `/api/auth/login` (per-IP + per-email sliding window; `429` + `Retry-After`).
   - DONE: explicit CSRF bootstrap endpoint (`GET /api/auth/csrf`) and frontend auto-bootstrap/retry flow.
3. Operational hardening:
   - DONE: structured request logging + `trace_id` correlation middleware + query redaction in `backend/app/main.py`.
   - TODO: add backup/restore docs for SQLite (or finalize Postgres target for production).

### Frontend
1. Complete API client split:
   - DONE this cycle for collections/taxonomies/entries/themes/settings/pages baseline.
   - TODO continue pages/media/templates/menus detail screens.
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
