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
- Feature: `Pages MVP + Public Visual Editing (Components + Blocks) + Media MVP`
- Status: `In progress`

Quick check:

- `git branch --show-current`
- `git status`

---

## 3) Routing Rules (Non-negotiable)

### Frontend Routes (from code)

- Public pages: `/[slug]`
- Auth page: `/auth/login`
- Admin pages: `/admin`, `/admin/pages`, `/admin/pages/new`, `/admin/pages/[id]`, `/admin/templates`, `/admin/templates/[id]`, `/admin/components`, `/admin/blocks`, `/admin/media`
- Legacy (hidden from sidebar): `/admin/menus`, `/admin/footers`
- Homepage: `/` (renders the page with slug `home`; edit at `/?edit=1` when logged in)
- Canonical homepage: `/home` redirects to `/`
- Public preview override: `?menu=<slug>` and `?footer=<slug>` (temporarily override template menu blocks for previews)
- Internal docs helper: `GET /shadcn/variants?slug=<component>` (fetches shadcn `.md` docs and extracts CVA variant groups for the editor)

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

- Menus:
  - Admin (CRUD + items + reorder):
    - GET    `/api/admin/menus` (pagination + q)
    - POST   `/api/admin/menus`
    - GET    `/api/admin/menus/{menu_id}`
    - PUT    `/api/admin/menus/{menu_id}`
    - DELETE `/api/admin/menus/{menu_id}`
    - GET    `/api/admin/menus/{menu_id}/items`
    - POST   `/api/admin/menus/{menu_id}/items`
    - PUT    `/api/admin/menus/{menu_id}/items/{item_id}`
    - DELETE `/api/admin/menus/{menu_id}/items/{item_id}`
    - PUT    `/api/admin/menus/{menu_id}/items/reorder`
  - Public:
    - GET `/api/public/menus/{slug}` (renders published page links + custom links)

- Components (admin only; used by page editor):
  - GET    `/api/admin/components` (pagination + filters)
  - POST   `/api/admin/components`
  - GET    `/api/admin/components/{component_id}`
  - PUT    `/api/admin/components/{component_id}`
  - DELETE `/api/admin/components/{component_id}`

- Blocks (admin only; “sections” composed of components):
  - GET    `/api/admin/blocks` (pagination + q)
  - POST   `/api/admin/blocks`
  - GET    `/api/admin/blocks/{block_id}`
  - PUT    `/api/admin/blocks/{block_id}`
  - DELETE `/api/admin/blocks/{block_id}`

- Media (admin only):
  - GET  `/api/admin/media` (pagination + q + `folder_id` filter; `folder_id=0` = root)
  - POST `/api/admin/media/upload` (multipart; accepts `folder_id` form field; `0` = root)
  - DELETE `/api/admin/media/{media_id}`
  - PUT `/api/admin/media/{media_id}` (move media to folder; `{ folder_id: number }`, `0` = root)

- Media folders (admin only):
  - GET    `/api/admin/media/folders`
  - POST   `/api/admin/media/folders`
  - PUT    `/api/admin/media/folders/{folder_id}`
  - DELETE `/api/admin/media/folders/{folder_id}` (only if empty)

- Templates (admin only; used by page editor):
  - GET    `/api/admin/templates` (pagination + q)
  - POST   `/api/admin/templates`
  - GET    `/api/admin/templates/{template_id}`
  - PUT    `/api/admin/templates/{template_id}`
  - DELETE `/api/admin/templates/{template_id}`

- Templates (public; used by public renderer):
  - GET `/api/public/templates/{slug}`

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
- page_templates: id, slug (unique), title, description, menu, footer, definition_json (TEXT), created_at, updated_at
- menus: id, slug (unique), title, description, created_at, updated_at
- menu_items: id, menu_id -> menus, type (page|link), label, page_id -> pages (nullable), href (nullable), order_index, created_at, updated_at
- media_folders: id, name, parent_id -> media_folders, created_at, updated_at
- media_assets: id, folder_id -> media_folders (nullable), original_name, stored_name (unique), content_type, size_bytes, created_at
- components: id, slug (unique), title, type, description, data_json, created_at, updated_at
- blocks: id, slug (unique), title, description, definition_json, created_at, updated_at

### Migrations

- Alembic baseline (`79769d50d480`) + `fd7afbbbfe44` adds `media_assets` + `03628574cad2` adds `components`/`blocks` + `9a6b2c1d4e8f` adds `media_folders` + `media_assets.folder_id` + `5c3d2a1b9f0e` adds `page_templates` + `8f7c2d1a0b3e` adds `menus` + `menu_items` + `b1c2d3e4f5a6` adds `page_templates.footer` + `c4e5f6a7b8c9` adds `page_templates.definition_json`; backend startup runs `upgrade head` (if tables exist but `alembic_version` is missing, it stamps baseline for baseline-only DBs, otherwise stamps head to avoid recreating tables) and seeds defaults on startup.

Reserved slugs:

- admin, login, logout, media, api, auth

Blocks:

- Legacy: `{ version: 1, blocks: [ { type:'hero' }, { type:'paragraph' } ] }`
- TipTap V2 (legacy): `{ version: 2, blocks: [ { id, type:'tiptap', data:{ doc, html } }, ... ] }`
- Page Builder V3 (current): `{ version: 3, template:{ id, menu, footer }, layout:{ rows:[ { id, settings:{ columns }, columns:[ { id, blocks:[ { id, type, data }, ... ] } ] } ] } }`
  - Grid is rows → columns → **components**; rich text is just one component type (`type: "editor"`).
  - Row `settings.columns`: supports `1..12`; columns are adjustable via shadcn `Resizable` and stored in `row.settings.sizes` (percentage weights).
  - Row `settings.wrapper`: optional section wrapper (`none` | `card`) that wraps the row content (useful for “structural” containers without nesting blocks yet).
  - Column `settings.wrapper`: optional wrapper (`none` | `card`) that wraps a single column’s content (lets structural containers “host” components without nested block trees).
  - Public rendering is responsive: mobile stacks to 1 column; desktop uses `sizes` for column width ratios.
  - Drag/drop reorder uses dnd-kit (rows + columns + components).
  - Builder UI modes: `Clean UI` (dashed row/column frames; controls/settings on hover) vs `Detailed UI` (controls always visible); Outline lives in a separate right sidebar in edit mode (keeps the canvas clean).
  - Builder is client-mounted (renders a placeholder until mounted) to avoid SSR hydration mismatches with dnd-kit/Radix.
  - Component types (current): `editor`, `image`, `button`, `card`, `separator`, `shadcn` (`data.component` + optional `data.props`; shadcn variants are loaded from docs via `GET /shadcn/variants` and surfaced in editor settings), plus template blocks `slot` (page content placeholder) and `menu` (`data.menu` + `data.kind: top|footer`).
  - Pages render through templates: the selected template’s `definition_json` is rendered and its `slot` is replaced by the page’s own rows/columns; `?menu`/`?footer` can override template `menu` blocks for previews.

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
- [x] Theme toggle in admin header (system/light/dark)
- [x] TipTap visual editing on public route (wiring complete; edit gated by session)
- [x] Media manager MVP (images: upload/list/search/delete + folders/subfolders + drag/drop move + icons/details view)
- [x] Page builder grid (rows/columns/components) + drag/drop reorder (dnd-kit)
- [x] Components/Blocks foundation (DB + admin CRUD + editor pickers)
- [x] Page templates foundation (DB + admin CRUD + page settings wiring)
- [x] Menu manager foundation (DB + admin drag/drop builder + public rendering)
- [x] Admin list template: numbered pagination (top+bottom) + URL query param state

### In Progress

- [ ] Feature 02 – Pages MVP (CRUD admin + public render + SEO metadata)
  - Admin list/create/delete implemented with slug validation and filters.
  - Public `/[slug]` renders the V3 grid via `PageRenderer` and mounts `PublicPageClient`.
  - Admin visual editing flow is wired to `/[slug]` with session gating.
- [ ] Pages polishing (SEO metadata completeness + editor templates)

### Next (parking lot)

- [ ] TipTap image upload integration
- [ ] Theme/swatch system (parking lot): `https://github.com/jln13x/ui.jln.dev`
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
- [ ] Verify page builder drag/drop reorder (rows + columns + components) + save
- [ ] Verify components list CRUD + component picker uses DB entries
- [ ] Create a sample Block and verify “Insert block” works
- [ ] Verify template/menu selection shows correct public top nav
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
- Components list: `frontend/app/admin/components/page.tsx`
- Blocks list: `frontend/app/admin/blocks/page.tsx`
- Media library: `frontend/app/admin/media/page.tsx`
- Menus builder: `frontend/app/admin/menus/page.tsx`
- Footers builder: `frontend/app/admin/footers/page.tsx`

---

## 12) Unified Shell (sidebar-16)

- Sidebar primitives (shadcn `sidebar-16`): `frontend/components/ui/sidebar.tsx`
- Shell header: `frontend/components/site-header.tsx`
- Shell navigation: `frontend/components/app-sidebar.tsx`
- Admin layout uses the shell: `frontend/app/admin/layout.tsx`
- Public edit mode uses the same shell when `?edit=1`: `frontend/app/[slug]/page-client.tsx`

---

## 13) Page Builder (V3 grid)

- Schema + parsing/serialization: `frontend/lib/page-builder.ts`
- Builder UI (grid + dnd-kit): `frontend/components/page-builder/page-builder.tsx`
- Outline (tree view): `frontend/components/page-builder/page-outline.tsx` (rendered as right sidebar in edit mode)
- Component picker modal (DB-backed): `frontend/components/page-builder/block-picker-dialog.tsx`
- Block picker modal (DB-backed sections): `frontend/components/page-builder/block-template-picker-dialog.tsx`
- Resizable panels (shadcn): `frontend/components/ui/resizable.tsx` (used for column sizing)
- Public top nav (menu): `frontend/components/public/public-top-nav.tsx`
- Editor block (TipTap + floating toolbar): `frontend/components/editor-block.tsx`
- Media picker dialog (used by components): `frontend/components/media/media-picker-dialog.tsx`
- shadcn docs URL helper: `frontend/lib/shadcn-docs.ts`
- shadcn variant extractor: `frontend/lib/shadcn-variants.ts` + `frontend/hooks/use-shadcn-variants.ts` + `frontend/app/shadcn/variants/route.ts`
- shadcn Alert primitive: `frontend/components/ui/alert.tsx` (used by component previews / shadcn rendering)
- Public edit client mounts the builder in `?edit=1`: `frontend/app/[slug]/page-client.tsx`

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
