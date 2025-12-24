# HooshPro – Developer Onboarding

This doc explains how the codebase is structured and how to add new backend APIs + frontend admin CRUD screens without guessing.

If you change routes, schema, or features, also update `docs/HOOSHPRO_REFERENCE.md`.

---

## Quick Start (dev)

Backend:

- `cd backend`
- Activate venv:
  - Windows: `.\.venv\Scripts\activate`
  - macOS/Linux: `source .venv/bin/activate`
- `python -m uvicorn app.main:app --reload`

Frontend:

- `cd frontend`
- `npm run dev`

Notes:

- Frontend proxies `/api/*` and `/media/*` to the backend via `frontend/next.config.ts`.
- Admin is protected by `frontend/proxy.ts` (Next.js 16 “Proxy/Middleware”) and a server-side check in `frontend/app/admin/layout.tsx`.

---

## Environment Variables (common)

Frontend:

- `frontend/.env.local`: `API_ORIGIN=http://127.0.0.1:8000`

Backend (optional overrides):

- `HOOSHPRO_DB_FILE` (SQLite file path; default `backend/data/hooshpro.db`)
- `HOOSHPRO_MEDIA_DIR` (uploads dir; default `backend/media`)
- `HOOSHPRO_COOKIE_SECURE` (`1` in prod/HTTPS)
- `HOOSHPRO_COOKIE_SAMESITE` (`lax` | `strict` | `none`)

---

## Repo Map (where things live)

### Backend (`backend/app`)

- `main.py`: FastAPI app setup (CORS, StaticFiles, router includes).
- `models.py`: SQLAlchemy models (authoritative DB schema).
- `db.py`: engine/session, Alembic auto-upgrade on startup, seeding defaults.
- `deps.py`: auth dependency `get_current_user` (cookie or bearer token).
- `routers/`: route modules (FastAPI routers).
- `schemas/`: Pydantic request/response schemas + validation helpers.

Migrations:

- `backend/alembic/`: Alembic environment + versioned migrations.
- Startup runs Alembic `upgrade head` automatically (`backend/app/db.py`).

### Frontend (`frontend`)

- `app/`: Next.js App Router routes.
  - `app/admin/*`: admin screens
  - `app/[slug]`: public page render + `?edit=1` admin edit mode
- `components/`: UI + feature components
  - `components/admin/*`: reusable admin list shell + table
  - `components/page-builder/*`: page builder (dnd-kit + resizable + editor)
  - `components/ui/*`: shadcn/ui primitives
- `lib/`:
  - `lib/http.ts`: `apiFetch()` wrapper (cookie + 401 redirect)
  - `lib/types.ts`: frontend API types (keep aligned with backend outputs)
  - `lib/page-builder.ts`: page builder schema + parse/serialize
- `hooks/use-api-list.ts`: generic list fetching hook (pagination/filter pages)

---

## shadcn/ui docs (vendored)

We keep a local mirror of the raw shadcn/ui markdown docs so devs can read every line and so editor tooling can extract variants without relying on the network.

- Docs live in: `docs/shadcn/components/*.md`
- Sync script: `python scripts/sync_shadcn_docs.py` (from repo root)
- Variants endpoint (used by the component editor): `GET /shadcn/variants?slug=<component>`
  - Prefers local `docs/shadcn/components/<slug>.md` when available
  - Falls back to fetching `https://ui.shadcn.com/docs/components/<slug>.md`

---

## Core Contracts (don’t break these)

- **Routing**
  - Frontend admin routes: `/admin/*`
  - Backend admin APIs: `/api/admin/*` (must require `get_current_user`)
  - Backend public APIs: `/api/public/*` (no auth)
- **Page builder (V3) is the canonical content format**
  - `version: 3`
  - `layout.rows[] -> columns[] -> blocks[]`
  - Structural shadcn blocks can contain `children[]` and act like containers.
- **Menus/footers are template blocks**
  - Use `menu` blocks inside templates (top/footer kind).
  - Optional: embed `data.items` to render without fetching a DB menu.

---

## Add a New Backend Resource (CRUD API)

Example reference implementation: `backend/app/routers/components.py`.

1) Add/extend the DB model
- Edit `backend/app/models.py`.

2) Add Alembic migration
- From `backend/`:
  - `alembic revision --autogenerate -m "add <resource>"`
  - Review the generated file in `backend/alembic/versions/*`.

3) Add Pydantic schemas
- Create `backend/app/schemas/<resource>.py` with:
  - `Create`, `Update`, `Out`, `ListOut`
  - Validation helpers (slug rules, etc.) if needed

4) Add router
- Create `backend/app/routers/<resource>.py`
- Use:
  - `router = APIRouter(tags=["<resource>"])`
  - `db: OrmSession = Depends(get_db)`
  - `user: User = Depends(get_current_user)` for all admin endpoints
- Typical admin endpoints:
  - `GET /api/admin/<resource>?limit=&offset=&q=`
  - `POST /api/admin/<resource>`
  - `GET /api/admin/<resource>/{id}`
  - `PUT /api/admin/<resource>/{id}`
  - `DELETE /api/admin/<resource>/{id}`

5) Wire router into the app
- Add `from app.routers import <resource>` and `app.include_router(<resource>.router)` in `backend/app/main.py`.

6) Update the Single Source of Truth
- Add endpoints + table changes to `docs/HOOSHPRO_REFERENCE.md`.

---

## Add a New Admin CRUD Page (frontend)

Examples:

- List+dialog: `frontend/app/admin/components/page.tsx`, `frontend/app/admin/blocks/page.tsx`
- List + dedicated editor route: `frontend/app/admin/templates/page.tsx` + `frontend/app/admin/templates/[id]/page.tsx`

1) Add/update frontend types
- Edit `frontend/lib/types.ts` to match backend response models.

2) Create the admin route file
- Add `frontend/app/admin/<resource>/page.tsx`.
- Standard pattern:
  - Parse URL state: `page`, `q`, and filters via `useSearchParams()`
  - Keep state stable in the URL via `router.replace(...)`
  - Fetch lists via `useApiList()` (build query string with `limit` + `offset`)
  - Render via `AdminListPage` and optionally `AdminDataTable`
  - Use shadcn `Dialog`/`AlertDialog` for create/edit/delete confirmations
  - Call the API via `apiFetch()` and pass `nextPath` for good redirects on 401

3) Add it to the admin sidebar
- Edit `frontend/components/app-sidebar.tsx`.

4) Update the Single Source of Truth
- Add the new frontend route in `docs/HOOSHPRO_REFERENCE.md`.

---

## Add a New “Builder Component” Type (page editor)

You usually need to touch 3 layers:

1) Data model (what gets saved)
- `frontend/lib/page-builder.ts` (types + parse/serialize)

2) Editor behavior (how it’s edited)
- `frontend/components/page-builder/page-builder.tsx`
  - Create block from component preset
  - Settings UI
  - DnD + container behaviors

3) Rendering/preview
- Public render: `frontend/components/page-builder/page-renderer.tsx`
- Component preview cards: `frontend/components/components/component-preview.tsx`

Optional defaults:

- Seed a default preset in `backend/app/db.py` (so it appears in the picker).

---

## Verification Checklist (before merging)

- Backend: `python -m compileall backend/app`
- Frontend: `npm run lint` and `npm run build` (in `frontend/`)
- Smoke tests:
  - `/auth/login` works
  - `/admin` redirects without session
  - `/admin` works after login
  - `/api/admin/*` returns 401 without session cookie
  - `/?edit=1` works for admin and can save a page
