# HooshPro – Project Reference (Single Source of Truth)

> This file prevents “context loss”.
> Any feature/branch change MUST update this file.

---

## 0) Product Goal (1 sentence)

A simple, professional blog/site builder with admin login + page editor + public rendering (SEO-ready).

---

## 1) Stack (DO NOT drift)

- Backend: FastAPI (Python)
- ORM: SQLAlchemy (Declarative)
- DB: SQLite (single file)
- Frontend: Next.js (TypeScript, App Router)
- UI: Tailwind + shadcn/ui (+ Radix under the hood)
- Auth: Cookie-based session (HttpOnly)

---

## 2) Current Branch (ALWAYS update)

- Branch: `main`
- Feature: `Pages MVP + Public Visual Editing (TipTap) + Media MVP`
- Status: `In progress`

Quick check:

- `git branch --show-current`
- `git status`

---

## 3) Routing Rules (Non-negotiable)

### Frontend Routes (from code)

- Public pages: `/[slug]`
- Auth page: `/auth/login`
- Admin pages: `/admin`, `/admin/pages`, `/admin/media`
- Root health splash: `/`

### Backend Routes (from code)

- Health: GET `/health`
- Bootstrap: POST `/api/bootstrap/admin`
- Auth:
  - POST `/api/auth/login`  -> sets cookie
  - POST `/api/auth/logout` -> clears cookie
  - GET  `/api/auth/me`     -> validates session
  - POST `/api/auth/token`  -> swagger bearer token (no cookie)

- Admin:
  - GET `/api/admin/ping`

- Pages:
  - Admin CRUD:
    - GET    `/api/admin/pages` (pagination + filters)
    - POST   `/api/admin/pages`
    - GET    `/api/admin/pages/{id}`
    - PUT    `/api/admin/pages/{id}`
    - DELETE `/api/admin/pages/{id}`
    - GET    `/api/admin/pages/by-slug/{slug}` (resolve id for visual editing)

  - Public:
    - GET `/api/public/pages/{slug}` (published only)

- Media (admin only):
  - GET  `/api/admin/media` (pagination + q)
  - POST `/api/admin/media/upload`
  - DELETE `/api/admin/media/{media_id}`

- Static media files: `/media/{filename}` (served by FastAPI StaticFiles; media dir auto-created on startup)

---

## 4) Auth & Session Contract

### Cookie

- Name: `hooshpro_session`
- HttpOnly: True
- SameSite: Lax
- Secure: False in dev, True in prod (configurable `COOKIE_SECURE`)
- Session length: 14 days

### Security gates (current)

- Backend: every `/api/admin/*` and media endpoints require `get_current_user` (cookie or bearer token hash lookup with expiry).
- Frontend: `middleware.ts` blocks `/admin/*` if cookie missing or `/api/auth/me` fails; redirects to `/auth/login?next=...`.
- Admin edit mode on public pages is gated server-side; `/[slug]?edit=1` only enables edit UI for valid sessions.

---

## 5) Next.js API Proxy (dev)

- `next.config.ts` rewrites:
  - `/api/:path*` -> `${API_ORIGIN}/api/:path*`
  - `/media/:path*` -> `${API_ORIGIN}/media/:path*`

Env:

- `frontend/.env.local`
  - `API_ORIGIN=http://127.0.0.1:8000`

Important:

- Server Components SHOULD use absolute URL when fetching backend:
  - use `${API_ORIGIN}/api/...`
- Client components can call `/api/...` (rewrite kicks in)

---

## 6) Data Model (current)

### Tables (SQLAlchemy models)

- users: id, email (unique), password_hash, created_at
- sessions: id, user_id -> users, token_hash, expires_at, created_at
- pages: id, title, slug (unique), status (draft|published), seo_title, seo_description, blocks_json (TEXT, default version 1), published_at, created_at, updated_at
- media_assets: id, original_name, stored_name (unique), content_type, size_bytes, created_at

### Migrations

- Alembic baseline (`79769d50d480`) + `fd7afbbbfe44` adds `media_assets`; backend startup runs `upgrade head` (stamps baseline if the DB predates migrations).

Reserved slugs:

- admin, login, logout, media, api, auth

Blocks:

- Legacy: `{ version: 1, blocks: [ { type:'hero' }, { type:'paragraph' } ] }`
- TipTap MVP: `{ version: 2, blocks: [ { id, type:'tiptap', data:{ doc, html } }, ... ] }` (multi-section; order matters; `id` is used for drag/drop)

---

## 7) How to Run (dev)

### Backend

- `cd backend`
- `uvicorn app.main:app --reload`

### Frontend

- `cd frontend`
- `npm run dev`

---

## 8) Feature Log (keep short)

### Done

- [x] Feature 00 – Repo setup + baseline
- [x] Feature 01 – Auth/session + admin gate (login/logout/me + middleware + admin ping)
- [x] Admin shell UI (shadcn `sidebar-16`) shared by admin + public edit mode
- [x] TipTap visual editing on public route (wiring complete; edit gated by session)
- [x] Media manager MVP (images: upload/list/search/delete + migration + editor picker)
- [x] Page editor sections (multi-block) + drag/drop reorder (dnd-kit)

### In Progress

- [ ] Feature 02 – Pages MVP (CRUD admin + public render + SEO metadata)
  - Admin list/create/delete implemented with slug validation and filters.
  - Public `/[slug]` renders sanitized TipTap blocks and mounts `PublicPageClient`.
  - Admin visual editing flow is wired to `/[slug]` with session gating.
- [ ] Pages polishing (SEO metadata completeness + editor templates)

### Next (parking lot)

- [ ] TipTap image upload integration
- [ ] Block palette (shadcn blocks)
- [ ] RBAC (later)

---

## 9) Merge Discipline (no exceptions)

Per feature:

1) small commits
2) update this file (branch + status + endpoints)
3) smoke test list:
   - /login works
   - /admin redirects without valid session
   - /admin works after login
   - /api/admin/* returns 401 without cookie
   - /[slug]?edit=1 works for admin
4) merge

---

## 10) Current TODO (next 1–3 hours)

- [ ] Verify `/[slug]?edit=1` flow end-to-end (admin gating + save)
- [ ] Verify page editor drag/drop reorder + multi-section save
- [ ] Verify middleware/admin layout redirect behavior with expired sessions
- [ ] Verify Alembic startup upgrade on existing DB
- [ ] Verify media drag/drop + TipTap media picker end-to-end

---

## 11) Admin CRUD Template (reusable)

Use this pattern for any new admin resource (pages, media, users, etc.):

- Data fetch hook: `frontend/hooks/use-api-list.ts`
- Page shell (header + filters + pagination): `frontend/components/admin/admin-list-page.tsx`
- Table helper (optional): `frontend/components/admin/admin-data-table.tsx`

Existing examples:

- Pages list: `frontend/app/admin/pages/page.tsx`
- Media library: `frontend/app/admin/media/page.tsx`

---

## 12) Unified Shell (sidebar-16)

- Sidebar primitives (shadcn `sidebar-16`): `frontend/components/ui/sidebar.tsx`
- Shell header: `frontend/components/site-header.tsx`
- Shell navigation: `frontend/components/app-sidebar.tsx`
- Admin layout uses the shell: `frontend/app/admin/layout.tsx`
- Public edit mode uses the same shell when `?edit=1`: `frontend/app/[slug]/page-client.tsx`

---

## 13) Editor (TipTap MVP)

- TipTap editor (toolbar + Blocks sheet): `frontend/components/tiptap-editor.tsx`
- Media picker dialog (insert images): `frontend/components/media/media-picker-dialog.tsx`
- Public edit client (legacy v1 -> TipTap fallback + multi-section + drag/drop via dnd-kit): `frontend/app/[slug]/page-client.tsx`

---

## 14) V2 "Pro / Superior" Plan (Webflow-like)

### V2 North Star

A block-based visual builder where admins can design pages visually, manage media, run a blog + collections, preview safely, and publish SEO-ready pages—fast, stable, and extendable.

### Guiding Principles

1. **Block-first**: everything is blocks + schemas + predictable rendering.
2. **Editor UX is the product**: shadcn/ui + Radix + shadcn blocks, polished defaults, minimal custom CSS.
3. **Strong contracts**: typed API + strict validation; frontend never "guesses".
4. **Secure by default**: admin-only features must be enforced on backend.
5. **Extensible, not generic**: add capabilities via registries (blocks/fields) not ad-hoc screens.

### V2 Contracts To Lock First (Non‑negotiable)

- Block schema is the single source of truth: every block has stable `id`, `type`, `data`, and `settings` (layout/spacing/visibility) validated server-side.
- Media references by `media_id` (not URLs) inside blocks; public rendering resolves URLs and metadata (alt/caption).
- Consistent API error shape + validation rules mirrored (backend authoritative; frontend UX validation only).

---

### Pillars of V2

---

#### Pillar 1) Visual Page Builder

**Goal**: Edit pages on the page (or dedicated editor route) with a real builder experience.

**Must-have features**:

- **Block Palette**: insert/search blocks from sidebar
- **Drag & Drop**: reorder blocks + nesting where appropriate
- **Block Settings Panel** (right sidebar): spacing, alignment, background, container width, etc.
- **Inline Text Editing** (TipTap) for rich content blocks
- **Undo/Redo**, keyboard shortcuts, autosave + manual save
- **Draft/Publish/Unpublish** + "Last saved" indicators
- **Preview Modes**: desktop/tablet/mobile widths
- **Templates**: starter pages
- **Reusable Sections ("Symbols")**: global components reusable across pages
- **Section Locking**: protect certain global components from edits
- **Per-block Visibility Rules**: e.g., only show on mobile

---

#### Pillar 2) Media Manager

**Goal**: Upload/select media reliably, reuse across pages, and keep output optimized.

**Must-have features**:

- **Upload + Library + Search/Filter**
- **Folders/Tags** for organization
- **Asset Metadata**: alt text, caption, focal point
- **Image Optimization Pipeline**: resize variants, webp/avif (optional)
- **Safe References**: blocks reference media by `media_id` via popup picker
- **Deletion Rules**: prevent delete if referenced, move to trash for recovery

---

### Phased Delivery (each phase ships)

---

#### Phase A — V2 Baseline Hardening

- Backend: migrations-only DB lifecycle, consistent errors/logging, CSRF strategy for cookie auth, Postgres-ready config (keep SQLite dev).
- Exit: DB recreates from migrations; all admin-only actions enforced server-side; predictable error responses.

#### Phase B — Visual Builder Core

- Frontend: block registry + renderer + editor canvas; palette (search/insert), inspector (settings), autosave + manual save, preview breakpoints, undo/redo, drag/drop reorder (+ limited nesting).
- Backend: page save validates blocks + settings; draft preview mode (backend-enforced).
- Exit: admin can build and publish a real homepage via blocks with safe preview.

#### Phase C — Media Manager Pro

- Backend: asset metadata (alt/caption/focal), folders/tags, "where used" + safe deletion rules, optimization pipeline (variants; webp/avif optional), storage: dev local / prod S3-compatible + CDN URLs.
- Frontend: media library with filters/folders; blocks bind by `media_id`.
- Exit: pages contain optimized images with correct alt text and stable references.

#### Phase D — Collections / Custom Content Types

- Backend: content types/fields/entries (validation + slugs + status), minimal relations, CRUD + filtering APIs.
- Frontend: admin CRUD uses the same template; blocks can bind to collections ("grid", "featured", "dynamic list").
- Exit: a "Projects" collection powers a dynamic section on a page.

#### Phase E — Workflow + Versions

- Backend: `page_versions`, audit log, RBAC (Admin/Editor/Publisher), signed preview links for drafts, restore flow.
- Frontend: version history UI + role-based controls.
- Exit: safe team editing with accountability + rollback.

#### Phase F — SEO/Perf Release

- Frontend: SSR/ISR strategy locked, metadata/OG/canonical, `sitemap.xml` + `robots.txt`, redirects management, caching plan.
- Exit: production checklist passes (SEO correctness + fast render + stable routing).

---

### Admin "Template" Evolution (to scale beyond Pages/Media)

Keep the generic list pattern, then add a "resource registry" so each admin section declares: columns, filters, form schema, endpoints, and permissions (prevents ad-hoc screens).
