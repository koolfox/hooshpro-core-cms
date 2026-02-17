# HooshPro – Developer Onboarding

This doc explains how the codebase is structured and how to add new backend APIs + frontend admin CRUD screens without guessing.

If you change routes, schema, or features, also update `docs/HOOSHPRO_REFERENCE.md`.

V6 contract + ordered execution backlog: `docs/EDITOR_V6_CONTRACT.md`.

---

## Quick Start (dev)

Prereqs:

- Python 3.10+ (backend uses modern type hints; the repo’s `backend/.venv` is the supported way to run).

Backend:

- `cd backend`
- Activate venv:
  - Windows: `.\.venv\Scripts\activate`
  - macOS/Linux: `source .venv/bin/activate`
- `python -m uvicorn app.main:app --reload`

Troubleshooting:

- If you see a startup error about Alembic being required, you are not running inside the backend venv. Activate the venv and retry (`cd backend; .\\.venv\\Scripts\\activate; python -m uvicorn app.main:app --reload`).

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
- `HOOSHPRO_LOGIN_RATE_WINDOW_SECONDS` (default `300`)
- `HOOSHPRO_LOGIN_RATE_MAX_PER_IP` (default `20`)
- `HOOSHPRO_LOGIN_RATE_MAX_PER_EMAIL` (default `8`)

---

## Repo Map (where things live)

### Backend (`backend/app`)

- `main.py`: FastAPI app setup (CORS, StaticFiles, router includes).
- `models.py`: SQLAlchemy models (authoritative DB schema).
- `db.py`: engine/session, Alembic auto-upgrade on startup, seeding defaults.
- `deps.py`: auth dependency `get_current_user` (cookie or bearer token).
- `routers/`: route modules (FastAPI routers).
- `services/`: domain service layer (business rules + DB interactions); routers stay thin and map exceptions to HTTP.
- `schemas/`: Pydantic request/response schemas + validation helpers.
  - Collections (dynamic content): `routers/collections.py` + `schemas/content.py`
  - Site options: `routers/options.py` + `schemas/option.py` (WordPress-like “settings/options”)
  - Taxonomies/terms: `routers/taxonomies.py` + `schemas/taxonomy.py` (categories/tags/custom)
  - Themes: `routers/themes.py` + `schemas/theme.py` (CSS variable tokens; public resolver `/api/public/themes/active`)

Migrations:

- `backend/alembic/`: Alembic environment + versioned migrations.
- Startup runs Alembic `upgrade head` automatically (`backend/app/db.py`).

### Frontend (`frontend`)

- `app/`: Next.js App Router routes.
  - `app/admin/*`: admin screens
  - `app/[slug]`: public page render + `?edit=1` admin edit mode
- `components/`: UI + feature components
  - `components/admin/*`: reusable admin list shell + table
  - `components/client-only.tsx`: SSR-safe wrapper for client-only widgets (prevents hydration mismatches)
  - `components/page-builder/*`: page builder (dnd-kit drag/drop + resize + inspector + renderer)
  - `components/ui/*`: shadcn/ui primitives
- `lib/`:
  - `lib/http.ts`: `apiFetch()` wrapper (cookie + 401 redirect). Throws `ApiError` with `status`, `errorCode`, `traceId`, and `details`; message prefers backend JSON (`message`/`detail`) when present.
  - For unsafe methods (`POST`/`PUT`/`PATCH`/`DELETE`), it auto-sends `X-CSRF-Token` from the `csrftoken` cookie (required by backend CSRF middleware for cookie-session requests).
  - Backend errors include `x-trace-id` header + JSON `{ error_code, message, detail, trace_id?, details? }` for correlation.
  - Frontend clients can bootstrap CSRF explicitly via `GET /api/auth/csrf` before first unsafe request.
  - `lib/types.ts`: frontend API types (keep aligned with backend outputs)
  - `lib/error-message.ts`: shared UI error formatter (includes backend `error_code` + `trace_id` tags from `ApiError`)
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
- **Page builder (V6) is the canonical content format (HARDCUT)**
  - `version: 6`
  - `template` + `canvas` + `layout.nodes[]`
  - Nodes use per-breakpoint frames: `frames.{mobile|tablet|desktop}.{x,y,w,h,z?}` (px); overlap is allowed.
  - Nodes can be nested via `nodes[]` (frames are relative to the parent node).
  - Editor constraints: drag/resize clamps to parent bounds; the root canvas allows infinite vertical growth (so pages can extend downward).
  - Editor UX: if a drop lands outside the current viewport, the editor auto-focuses the moved node (prevents “lost” nodes).
  - Editor UX: visible grid (minor/major) + rulers (top/left); `canvas.snapPx` controls drag/resize snapping.
  - Viewport: **Frames view** shows Desktop/Tablet/Mobile side-by-side; only the active breakpoint is editable (click a frame to switch, or use the toolbar toggle).
  - Editor navigation: `Ctrl/Cmd + wheel` zoom to cursor; `Space + drag` pans the viewport; toolbar has zoom controls.
  - Editor UX: Figma-style layout (Layers/Assets left, Canvas center, Inspector right, bottom toolbar). Small screens: Layers uses a Sheet, Inspector uses a Popover.
  - Selection: click selects, `Shift` adds, `Ctrl/Cmd` toggles, drag on empty canvas marquee-selects; drag a node to move it (text inputs/contenteditable don’t initiate drag).
  - Layers panel: search + rename + hide + collapse; drag-reorder updates `z` within siblings (no lock; everything is editable).
    - Layers reflect the real node hierarchy (`frame`/`shape`/`text`/`image`/etc); Inspector fields depend on the selected node type (geometry vs content).
  - Z-order: Inspector “Order” buttons + `Ctrl/Cmd + [` / `Ctrl/Cmd + ]` (add `Shift` for send-to-back/bring-to-front).
  - Hydration: wrap dnd-kit-heavy UI in `ClientOnly` (`frontend/components/client-only.tsx`) to avoid SSR hydration mismatches (Radix/dnd-kit ids).
  - Locked decisions (C B A 1PX HARDCUT): hybrid overlap + breakpoint frames + edit on real pages + 1px snap + V6 is canonical.
  - Parser still accepts legacy `version 1/2/3` inputs for compatibility; serializer outputs V6.
  - Template-in-canvas editing: on public `?edit=1`, “Show chrome” composes the active template (menu + slot + footer) into the canvas, and the `slot` becomes a live frame containing the page nodes.
    - V5: template nodes are editable by default (no lock); Save also persists the active template definition when modified.
    - “Hide chrome” focuses on page-only editing (slot content only).
    - “Clone as variant”: clones the active template and switches the page to the clone (safe per-page customization without affecting other pages using the original).
- **Menus/footers are template blocks**
  - Use `menu` blocks inside templates (top/footer kind).
  - Optional: embed `data.items` to render without fetching a DB menu.
  - For full primitives editing, use “Convert menu to shapes + text” in the Inspector on a selected `menu` node.
- **Primitives-first editing**
  - The editor inserts common items as primitives by default (e.g. buttons/cards become `shape` + `text`), and provides Inspector actions to convert legacy nodes to primitives when needed.
- **Site options**
  - Public routes use `reading.front_page_slug` to decide what page renders at `/`.
  - Admin edits options in `/admin/settings` (backed by `options` table).
  - Public theming:
    - `appearance.active_theme` chooses the public theme slug (e.g. `jeweler` → `.theme-jeweler`).
    - `/api/public/themes/active` resolves the active theme and returns merged CSS variables (theme base + `appearance.theme_vars` overrides), injected into the public root element (`frontend/app/[slug]/page-client.tsx`).

---

## Platform Doc

- High-level “BaaS/backbone” overview: `docs/PLATFORM_BACKBONE.md`

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
  - `GET /api/admin/<resource>?limit=&offset=&q=&sort=&dir=` (sorting is optional but recommended for all list endpoints)
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
- Collections + entries: `frontend/app/admin/collections/page.tsx`, `frontend/app/admin/entries/page.tsx`
- List + dedicated editor route: `frontend/app/admin/templates/page.tsx` + `frontend/app/admin/templates/[id]/page.tsx`

1) Add/update frontend types
- Edit `frontend/lib/types.ts` to match backend response models.

2) Create the admin route file
- Add `frontend/app/admin/<resource>/page.tsx`.
- Standard pattern:
  - Parse URL state: `page`, `q`, filters, and list sorting (`sort` + `dir`) via `useSearchParams()`
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
  - Component insertion is 2-step (pick → configure → insert): `frontend/components/page-builder/block-picker-dialog.tsx`
    - Configure step also supports “Save as preset” (creates a new DB component variant) for Figma-like reuse.
  - Block insertion (section templates) uses: `frontend/components/page-builder/block-template-browser.tsx`
    - Used by the editor Insert panel (Blocks tab) and the dialog wrapper: `frontend/components/page-builder/block-template-picker-dialog.tsx`.
    - Blocks are grouped into categories (`Pages`, `Navigation`, `Heroes`, `Features`, `CMS`, `Embeds`) via slug heuristics (temporary until DB-backed).
  - Shared props/config UI: `frontend/components/components/component-data-editor.tsx`
    - For `type: "shadcn"` presets, the canonical data shape is `{ "component": "<slug>", "props": { ... } }` (flat legacy props are still accepted for back-compat).
    - shadcn “Quick settings” (component-specific friendly fields): `frontend/lib/shadcn-specs.ts`

3) Rendering/preview
- Public render: `frontend/components/page-builder/page-renderer.tsx`
- Component preview cards: `frontend/components/components/component-preview.tsx`
  - If the component needs server-fetched data for SEO (dynamic lists), also update:
    - `frontend/app/page.tsx` and `frontend/app/[slug]/page.tsx` (server prefetch + pass-through props)

Optional defaults:

- Seed a default preset in `backend/app/db.py` (so it appears in the picker).

### Radix Themes layout primitives (backbone frames)

Frames can be configured to render Radix Themes layout primitives (`Box`, `Flex`, `Grid`, `Container`, `Section`) via `frame.data.layout` + `frame.data.props`.

Docs (recommended reading for editor/backbone work):

- Layout overview: `https://www.radix-ui.com/themes/docs/overview/layout`
- `Box`: `https://www.radix-ui.com/themes/docs/components/box`
- `Flex`: `https://www.radix-ui.com/themes/docs/components/flex`
- `Grid`: `https://www.radix-ui.com/themes/docs/components/grid`
- `Container`: `https://www.radix-ui.com/themes/docs/components/container`
- `Section`: `https://www.radix-ui.com/themes/docs/components/section`

If you need the authoritative prop names + allowed enum values, refer to the package types:

- `frontend/node_modules/@radix-ui/themes/dist/esm/components/box.props.d.ts`
- `frontend/node_modules/@radix-ui/themes/dist/esm/components/flex.props.d.ts`
- `frontend/node_modules/@radix-ui/themes/dist/esm/components/grid.props.d.ts`
- `frontend/node_modules/@radix-ui/themes/dist/esm/components/container.props.d.ts`
- `frontend/node_modules/@radix-ui/themes/dist/esm/components/section.props.d.ts`
- Shared layout/margin/padding props:
  - `frontend/node_modules/@radix-ui/themes/dist/esm/props/layout.props.d.ts`
  - `frontend/node_modules/@radix-ui/themes/dist/esm/props/margin.props.d.ts`
  - `frontend/node_modules/@radix-ui/themes/dist/esm/props/padding.props.d.ts`

---

## Verification Checklist (before merging)

- Backend: `python -m compileall backend/app`
- API smoke: `python backend/scripts/smoke_api.py --base-url http://127.0.0.1:8000`
- MVP smoke: `python backend/scripts/smoke_mvp.py --base-url http://127.0.0.1:8000`
- Frontend: `npm run lint` and `npm run build` (in `frontend/`)
- Smoke tests:
  - `/auth/login` works
  - `/admin` redirects without session
  - `/admin` works after login
  - `/api/admin/*` returns 401 without session cookie
  - `/?edit=1` works for admin and can save a page
