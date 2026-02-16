# HooshPro – Platform Backbone (Internal BaaS)

HooshPro is evolving from “a CMS” into an internal, single-tenant platform that can power multiple data-driven projects.

The goal is to keep each *project feature* as a **module** (CMS, Media, Collections, Taxonomies, Themes, Users/Roles) while sharing one consistent API contract and one reusable admin CRUD system.

If you change contracts/endpoints, update `docs/HOOSHPRO_REFERENCE.md`.

---

## Core Principles

- **Single-tenant**: one workspace; keep the design clean and simple.
- **Contracts over screens**: every admin screen maps to a backend resource contract.
- **Consistent list endpoints**: pagination + search + sorting everywhere.
- **Modules, not one-offs**: new capability = backend router + frontend admin section + docs update.

---

## Architecture (text diagram)

Frontend (Next.js)

- `frontend/app/[slug]` public render + `?edit=1` editing
- `frontend/app/admin/*` admin modules (Pages, Media, Collections, etc.)
- `frontend/components/admin/*` reusable list/table shell
- `frontend/hooks/use-api-list.ts` list fetching + loading/error

Backend (FastAPI)

- `backend/app/core/*` shared platform utilities (auth, errors, list params, etc.)
- `backend/app/services/*` domain services (business rules + DB access) used by thin routers
- `backend/app/routers/*` feature modules (pages, media, themes, etc.)
- `backend/app/models.py` authoritative schema
- Alembic migrations in `backend/alembic/versions/*`

---

## “Resource” Contract (what every module should provide)

Admin CRUD endpoints (typical):

- `GET    /api/admin/<resource>?limit=&offset=&q=&sort=&dir=`
- `POST   /api/admin/<resource>`
- `GET    /api/admin/<resource>/{id}`
- `PUT    /api/admin/<resource>/{id}`
- `DELETE /api/admin/<resource>/{id}`

Rules:

- `limit` clamped (1–200)
- `offset >= 0`
- `q` is optional and should search “reasonable” text fields
- `sort` and `dir` must be allowlisted per resource
- All admin routes must require `get_current_user` (cookie sessions)

---

## Adding a New Module (backend + admin)

Backend:

1) Add model(s) in `backend/app/models.py`
2) Add Alembic migration in `backend/alembic/versions/*`
3) Add schemas in `backend/app/schemas/<module>.py`
4) Add router in `backend/app/routers/<module>.py`
5) Wire router in `backend/app/main.py`

Frontend:

1) Add types in `frontend/lib/types.ts`
2) Add route in `frontend/app/admin/<module>/page.tsx`
3) Add sidebar entry in `frontend/components/app-sidebar.tsx`

Docs:

- Update routes/tables in `docs/HOOSHPRO_REFERENCE.md`


