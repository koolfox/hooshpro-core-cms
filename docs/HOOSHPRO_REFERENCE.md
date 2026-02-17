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
- Layout primitives (editor/backbone): Radix Themes (`@radix-ui/themes`)
- Auth: Cookie-based session (HttpOnly)

---

## 2) Current Branch (ALWAYS update)

- Branch: `main`
- Feature: `V5 Platform/BaaS Backbone (WordPress-like modules)`
- Status: `In progress` (V5-A core modules wired service-first: collections/options/taxonomies/themes + settings/themes admin UI live)

Quick check:

- `git branch --show-current`
- `git status`

---

## 3) Routing Rules (Non-negotiable)

### Frontend Routes (from code)

- Public pages: `/[slug]`
- SEO metadata routes: `/robots.txt`, `/sitemap.xml`
- Auth page: `/auth/login`
- Admin pages: `/admin`, `/admin/pages`, `/admin/pages/new`, `/admin/pages/[id]`, `/admin/templates`, `/admin/templates/[id]`, `/admin/components`, `/admin/blocks`, `/admin/collections`, `/admin/collections/[id]`, `/admin/entries`, `/admin/taxonomies`, `/admin/taxonomies/[id]`, `/admin/media`, `/admin/themes`, `/admin/settings`
- Homepage: `/` (renders the page with slug from option `reading.front_page_slug`; default `home`; edit at `/?edit=1` when logged in)
- Canonical homepage: `/<front-page-slug>` redirects to `/` (e.g. `/home` -> `/`)
- Public theme: option `appearance.active_theme` (slug; `jeweler` applies `.theme-jeweler`; CSS vars resolved via `/api/public/themes/active`)
- Theme CSS vars: `themes.vars_json` + option `appearance.theme_vars` overrides (JSON like `{"--jeweler-gold":"#c8b79a"}`) injected into public pages
- Public preview override: `?menu=<slug>` and `?footer=<slug>` (temporarily override template menu blocks for previews)
- Internal docs helper: `GET /shadcn/variants?slug=<component>` (extracts CVA variant groups + title/description + exports/deps + Radix doc/API links; prefers local `docs/shadcn/components/*.md` synced via `python scripts/sync_shadcn_docs.py`)

### Backend Routes (from code)

- Health: GET `/health`
- Bootstrap: POST `/api/bootstrap/admin`
- Auth:
  - GET  `/api/auth/csrf`   -> issues/refreshes CSRF cookie + header
  - POST `/api/auth/login`  -> sets cookie
  - POST `/api/auth/logout` -> clears cookie
  - GET  `/api/auth/me`     -> validates session
  - POST `/api/auth/token`  -> swagger bearer token (no cookie)

- Admin:
  - GET `/api/admin/ping`

- Pages:
  - Admin CRUD:
    - GET    `/api/admin/pages` (pagination + filters + sorting via `sort`/`dir`)
    - POST   `/api/admin/pages`
    - GET    `/api/admin/pages/{id}`
    - PUT    `/api/admin/pages/{id}`
    - DELETE `/api/admin/pages/{id}`
    - GET    `/api/admin/pages/by-slug/{slug}` (resolve id for visual editing)

  - Public:
    - GET `/api/public/pages` (published list; pagination for sitemap/feeds)
    - GET `/api/public/pages/{slug}` (published only)

- Menus:
  - Admin (CRUD + items + reorder):
    - GET    `/api/admin/menus` (pagination + q + sorting via `sort`/`dir`)
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
  - GET    `/api/admin/components` (pagination + filters + sorting via `sort`/`dir`)
  - POST   `/api/admin/components`
  - GET    `/api/admin/components/{component_id}`
  - PUT    `/api/admin/components/{component_id}`
  - DELETE `/api/admin/components/{component_id}`

- Blocks (admin only; “sections” composed of components):
  - GET    `/api/admin/blocks` (pagination + q + sorting via `sort`/`dir`)
  - POST   `/api/admin/blocks`
  - GET    `/api/admin/blocks/{block_id}`
  - PUT    `/api/admin/blocks/{block_id}`
  - DELETE `/api/admin/blocks/{block_id}`

- Collections (content types + fields + entries):
  - Admin content types:
    - GET    `/api/admin/content-types` (pagination + q + sorting via `sort`/`dir`)
    - POST   `/api/admin/content-types`
    - GET    `/api/admin/content-types/{type_id}`
    - PUT    `/api/admin/content-types/{type_id}`
    - DELETE `/api/admin/content-types/{type_id}`
  - Admin fields:
    - GET    `/api/admin/content-types/{type_id}/fields`
    - POST   `/api/admin/content-types/{type_id}/fields`
    - PUT    `/api/admin/content-types/{type_id}/fields/{field_id}`
    - DELETE `/api/admin/content-types/{type_id}/fields/{field_id}`
    - PUT    `/api/admin/content-types/{type_id}/fields/reorder`
  - Admin entries:
    - GET    `/api/admin/entries` (`type`, `status`, `q`, `sort`, `dir`, pagination)
    - POST   `/api/admin/entries`
    - GET    `/api/admin/entries/{entry_id}`
    - PUT    `/api/admin/entries/{entry_id}`
    - DELETE `/api/admin/entries/{entry_id}`
  - Public entries:
    - GET `/api/public/entries/{type_slug}` (published only)
    - GET `/api/public/entries/{type_slug}/{entry_slug}` (published only)

- Options:
  - Admin:
    - GET    `/api/admin/options` (pagination + q + `keys` CSV + sorting via `sort`/`dir`)
    - GET    `/api/admin/options/{key}`
    - PUT    `/api/admin/options/{key}` (upsert; `{ value: any }`)
    - DELETE `/api/admin/options/{key}`
  - Public:
    - GET `/api/public/options` (`keys` CSV; allowlisted keys only: `general.*`, `reading.*`, `appearance.active_theme`, `appearance.theme_vars`)

- Themes:
  - Admin CRUD:
    - GET    `/api/admin/themes` (pagination + q + sorting via `sort`/`dir`)
    - POST   `/api/admin/themes`
    - GET    `/api/admin/themes/{id}`
    - PUT    `/api/admin/themes/{id}`
    - DELETE `/api/admin/themes/{id}`
  - Public:
    - GET `/api/public/themes/active` (resolves active theme from options + merges `appearance.theme_vars` overrides)
    - GET `/api/public/themes/{slug}`

- Taxonomies:
  - Admin taxonomies:
    - GET    `/api/admin/taxonomies` (pagination + q + sorting via `sort`/`dir`)
    - POST   `/api/admin/taxonomies`
    - GET    `/api/admin/taxonomies/{taxonomy_id}`
    - PUT    `/api/admin/taxonomies/{taxonomy_id}`
    - DELETE `/api/admin/taxonomies/{taxonomy_id}` (also deletes terms + relationships)
  - Admin terms:
    - GET    `/api/admin/taxonomies/{taxonomy_id}/terms` (pagination + q + sorting via `sort`/`dir`)
    - POST   `/api/admin/taxonomies/{taxonomy_id}/terms`
    - PUT    `/api/admin/taxonomies/{taxonomy_id}/terms/{term_id}`
    - DELETE `/api/admin/taxonomies/{taxonomy_id}/terms/{term_id}`
  - Admin entry term assignment:
    - GET `/api/admin/entries/{entry_id}/terms`
    - PUT `/api/admin/entries/{entry_id}/terms` (replace; `{ term_ids: number[] }`)
  - Public:
    - GET `/api/public/taxonomies/{taxonomy_slug}/terms`

- Media (admin only):
  - GET  `/api/admin/media` (pagination + q + `folder_id` filter; `folder_id=0` = root; sorting via `sort`/`dir`)
  - POST `/api/admin/media/upload` (multipart; accepts `folder_id` form field; `0` = root)
  - DELETE `/api/admin/media/{media_id}`
  - PUT `/api/admin/media/{media_id}` (move media to folder; `{ folder_id: number }`, `0` = root)

- Media (public):
  - GET `/api/public/media/{media_id}` (resolve a media id to a URL + metadata)

- Media folders (admin only):
  - GET    `/api/admin/media/folders`
  - POST   `/api/admin/media/folders`
  - PUT    `/api/admin/media/folders/{folder_id}`
  - DELETE `/api/admin/media/folders/{folder_id}` (only if empty)

- Templates (admin only; used by page editor):
  - GET    `/api/admin/templates` (pagination + q + sorting via `sort`/`dir`)
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
- Secure: False in dev, True in prod (env `HOOSHPRO_COOKIE_SECURE=1`)
- Session length: 14 days

### Security gates (current)

- Backend: every `/api/admin/*` and media endpoints require `get_current_user` (cookie or bearer token hash lookup with expiry).
- CSRF: double-submit token (`csrftoken` cookie + `X-CSRF-Token` header) is enforced for unsafe methods on cookie-authenticated requests; bearer-token requests are exempt.
- Auth routes: `/api/auth/csrf` bootstraps/refreshes CSRF cookie + header, `/api/auth/login` sets both session + CSRF cookies, `/api/auth/me` backfills CSRF cookie for older sessions, `/api/auth/logout` clears both cookies.
- Frontend: `frontend/proxy.ts` blocks `/admin/*` if cookie missing or `/api/auth/me` fails; redirects to `/auth/login?next=...`.
- Frontend API calls use `apiFetch()` which auto-sends `X-CSRF-Token` from `csrftoken` cookie on unsafe requests.
- Login endpoint rate limiting is enabled (per-IP + per-email sliding window) and returns `429` with `Retry-After` when exceeded.
- API error contract is standardized: `{ error_code, message, detail, trace_id?, details? }` and `x-trace-id` response header for correlation.
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
- content_types: id, slug (unique), title, description, created_at, updated_at
- content_fields: id, content_type_id -> content_types, slug (unique per type), label, field_type, required, options_json, order_index, created_at, updated_at
- content_entries: id, content_type_id -> content_types, title, slug (unique per type), status (draft|published), order_index, data_json, published_at, created_at, updated_at
- options: id, key (unique), value_json, created_at, updated_at
- themes: id, slug (unique), title, description, vars_json, created_at, updated_at
- taxonomies: id, slug (unique), title, description, hierarchical (bool), created_at, updated_at
- terms: id, taxonomy_id -> taxonomies, parent_id -> terms (nullable), slug (unique per taxonomy), title, description, created_at, updated_at
- term_relationships: id, term_id -> terms, content_entry_id -> content_entries, created_at (unique term_id+content_entry_id)

### Migrations

- Alembic baseline (`79769d50d480`) + `fd7afbbbfe44` adds `media_assets` + `03628574cad2` adds `components`/`blocks` + `9a6b2c1d4e8f` adds `media_folders` + `media_assets.folder_id` + `5c3d2a1b9f0e` adds `page_templates` + `8f7c2d1a0b3e` adds `menus` + `menu_items` + `b1c2d3e4f5a6` adds `page_templates.footer` + `c4e5f6a7b8c9` adds `page_templates.definition_json` + `e599ea19ac34` adds `content_types`/`content_fields`/`content_entries` + `f2a0b6c8d9e1` adds `options` + `a9c1d3e5f7b9` adds taxonomies/terms + `c7d8e9f0a1b2` adds `themes`; backend startup runs `upgrade head` (if tables exist but `alembic_version` is missing, it stamps baseline for baseline-only DBs, otherwise stamps head to avoid recreating tables) and seeds defaults on startup.

Reserved slugs:

- admin, login, logout, media, api, auth

Blocks:

- Legacy: `{ version: 1, blocks: [ { type:'hero' }, { type:'paragraph' } ] }`
- TipTap V2 (legacy): `{ version: 2, blocks: [ { id, type:'tiptap', data:{ doc, html } }, ... ] }`
- Page Builder V6 (current / HARDCUT): `{ version: 6, template:{ id, menu, footer }, canvas:{ snapPx, widths:{ mobile, tablet, desktop }, minHeightPx }, layout:{ nodes:[ PageNode ] } }`
  - Hybrid canvas grid: nodes have `frames` (`x/y/w/h` in px + optional `z`); overlap is allowed.
  - Responsive is breakpoint-based: every node stores **3 frames** (`mobile/tablet/desktop`), Framer-like.
  - Nesting: any node may include `nodes: PageNode[]` (frames are relative to the parent node).
  - “Structural” containers:
    - `frame` nodes are always containers; they can be configured as Radix Themes layout primitives via `data.layout` (`box|flex|grid|container|section`) + `data.props` (JSON).
      - Radix Themes docs: `https://www.radix-ui.com/themes/docs/overview/layout` (and `/components/*` pages for each primitive).
      - The editor canvas and public renderer both wrap children inside the chosen Radix layout primitive (so the backbone structure is visible while editing).
      - `data.props` supports Radix “responsive object” values; `asChild` is ignored for `frame` nodes (frames can host multiple children).
      - `data.clip: true` enables “Clip contents” (children are clipped to the frame bounds).
    - `shape` nodes are also containers (rect/ellipse/line/arrow/etc). This is the base “Figma primitives” unit: wrap shapes inside shapes and place `text` / `image` nodes inside any shape/frame.
    - Backend validation parity: only `frame` and `shape` nodes are allowed to own positioned child `nodes` trees; other node types must stay leaf nodes.
    - Some `shadcn` components are treated as containers when metadata marks them `canWrapChildren`.
    - `shadcn` blocks can also include legacy `children: PageBlock[]` (non-positioned) for special cases like Accordion.
  - DnD + resize: dnd-kit with `snapPx=1` (1px snap) on drag/resize.
  - Anti-lost: if a drag/drop lands outside the current viewport, the editor auto-focuses the moved node so it never “vanishes” off-screen.
  - Transactional drop safety: move/drop commits only when the resulting tree is valid (parent is a real container, node exists exactly once); otherwise it auto-reverts.
  - Drop rejection feedback: when a drop is reverted, the canvas shows a short in-editor status badge with the reason.
  - Smart alignment: live guides + snapping to parent/sibling edges/centers (Figma-style) and keyboard nudge (arrows; Shift = 10×).
  - Locked editor decisions (C B A 1PX HARDCUT): hybrid overlap + breakpoint frames + edit on real page + 1px snap + V6 is canonical.
  - Editor surface: admins edit **on the real page** (`/?edit=1`, `/[slug]?edit=1`) when session is valid; otherwise it renders as public view.
  - Editor UX: Figma-style layout (Insert/Layers left dock, Canvas center, Inspector right, bottom toolbar). Small screens: Layers uses a Sheet, Inspector uses a Popover; zoom/breakpoints are in the toolbar “View” menu.
  - Editor navigation: `Ctrl/Cmd + wheel` zoom to cursor; `Space + drag` pans the viewport; toolbar controls don’t zoom with the canvas.
  - Selection: click selects, `Shift` adds, `Ctrl/Cmd` toggles, and drag on empty canvas marquee-selects.
  - Layers panel: Layers/Assets tabs + search + rename + hide + collapse; drag-reorder updates `z` within siblings; selecting a layer scrolls it into view and opens the Inspector on small screens.
    - Layers reflect the real node hierarchy (`frame`/`shape`/`text`/`image`/etc). Inspector fields depend on the selected node type (geometry vs content).
  - Insert panel:
    - Tabs: `Blocks` (section templates) and `Libraries` (component presets).
    - Blocks are grouped into categories (`Pages`, `Navigation`, `Heroes`, `Features`, `CMS`, `Embeds`) based on slug heuristics (temporary until categories are DB-backed).
  - Z-order: Inspector “Order” buttons + `Ctrl/Cmd + [` / `Ctrl/Cmd + ]` (add `Shift` for send-to-back/bring-to-front).
  - Next editor backlog (Figma-tier): copy/paste + undo/redo history + multi-drag (move selection as a group) + spacing guides.
  - Public rendering does not auto-inject a page title; if a visible title is needed it should be added as a component (e.g. `editor`/`shadcn/typography`). `pages.title` remains authoritative for admin lists + SEO metadata defaults.
  - Parser still upgrades legacy `version 1/2/3` content for compatibility; serializer now outputs V6.
  - Component/node types: `frame` (Radix Themes layout host), `shape` (container + optional `data.href`), `text` (data node; typography variants), `image` (supports `media_id`), `editor` (TipTap), `button`, `card`, `separator`, `collection-list` (dynamic entries grid), `shadcn` (`data.component` + `data.props`), plus template blocks `slot` and `menu` (`data.menu` + `data.kind: top|footer`).
    - `menu` blocks can optionally embed items: `data.items: [{ id, label, href }]` (preferred; public rendering uses embedded items without fetching); use “Convert menu to shapes + text” in Inspector for full primitives editing.
    - `button`/`card`/supported `shadcn/*` nodes can also be converted to primitives from the Inspector; the editor inserts common items as primitives by default so their internal layers are editable.
    - `collection-list` pulls from `GET /api/public/entries/{type_slug}` and can optionally resolve image fields via `GET /api/public/media/{media_id}`.
  - Templates render through `slot`: template `definition_json` renders top/footer `menu` nodes and a `slot`; page content is rendered into that slot (and can be preview-overridden via `?menu` / `?footer`).
  - Public view passes the page state into the template renderer to auto-size the `slot` and push any nodes below it (e.g. footer) under the content (prevents overlap).
  - Public edit mode (`?edit=1`) uses a composed canvas when “Show chrome” is enabled (template nodes + a live `slot` frame containing the page nodes).
    - V5: template nodes are editable by default (no lock); Save persists template changes when modified.
    - “Hide chrome” focuses on page-only editing (slot content only).
    - “Clone as variant” (Page settings): clones the active template and switches this page to the clone (safe per-page customization without affecting other pages).

---

## 7) How to Run (dev)

### Backend

- `cd backend`
- Requires Python 3.10+ (use the repo venv).
- Activate venv:
  - Windows: `.\.venv\Scripts\activate`
  - macOS/Linux: `source .venv/bin/activate`
- `python -m uvicorn app.main:app --reload`

First-run seed (empty DB only):

- Backend startup runs Alembic `upgrade head` + `seed_defaults()` (see `backend/app/db.py`).
- If there are no pages yet, it seeds a “Jeweler” starter site:
  - Template: `jeweler` (top menu + slot + footer menu)
  - Theme: `.theme-jeweler` (dark luxury palette) applied when template slug is `jeweler` (see `frontend/app/globals.css`; enforced via `frontend/app/[slug]/page-client.tsx`)
  - Fonts (jeweler): Inter + Cinzel loaded via `frontend/app/layout.tsx`
  - Menus: `jeweler-main` (one-page anchors: `#top`, `#products`, `#services`, `#contact`), `jeweler-footer`
  - Pages (published): `home` (renders at `/`), `shop`, `about`, `contact`, `privacy`, `terms`
  - Collection: `products` (sample entries) + `collection-list` block usage
  - Blocks: `jeweler-hero`, `jeweler-tiles`, `jeweler-split`, `jeweler-banner` (derived from seeded `/` sections)
  - Seed media assets are copied into `HOOSHPRO_MEDIA_DIR/seed/jeweler/*` on first run

### Frontend

- `cd frontend`
- `npm run dev`

---

## 8) Feature Log (keep short)

### Done

- [x] Feature 00 – Repo setup + baseline
- [x] Feature 01 – Auth/session + admin gate (login/logout/me + proxy + admin ping)
- [x] Admin shell UI (shadcn `sidebar-16`) shared by admin + public edit mode
- [x] Theme toggle in admin header (system/light/dark)
- [x] TipTap visual editing on public route (wiring complete; edit gated by session)
- [x] Media manager MVP (images: upload/list/search/delete + folders/subfolders + drag/drop move + icons/details view)
- [x] Page builder V6 canvas serializer (nodes + frames) + drag/drop + resize (dnd-kit)
- [x] Components/Blocks foundation (DB + admin CRUD + editor pickers)
- [x] Page templates foundation (DB + admin CRUD + page settings wiring)
- [x] Menu rendering via template blocks (`menu` component supports embedded items; no dedicated admin menus/footers UI)
- [x] Admin list template: numbered pagination (top+bottom) + URL query param state
- [x] Collections/Entries MVP (Content Types + Fields + Entries + dynamic `collection-list` component)
- [x] V5-A: Site options (DB `options` + `/admin/settings`; front page slug controls `/`)
- [x] V5-A: Taxonomies (DB `taxonomies/terms/term_relationships` + `/admin/taxonomies`; entry term assignment API)
- [x] V5-A: Themes (DB `themes` + `/admin/themes`; public resolver `/api/public/themes/active` merges overrides)
- [x] Starter site seed (“Jeweler”): template + menus + pages + products collection + sample media
- [x] Editor reliability pass: debounced autosave, `Ctrl/Cmd+S`, unsaved-changes unload guard, and last-saved/ autosave status badges
- [x] Editor history controls: bounded undo/redo stack with shortcuts (`Ctrl/Cmd+Z`, `Shift+Ctrl/Cmd+Z`, `Ctrl+Y`) + toolbar actions
- [x] Editor shell polish pass: top context strip (tool/mode/selection), grid visibility toggle, and refined dock/canvas visual styling
- [x] Editor focus/panel controls: left/right dock visibility toggles, focus mode, and keyboard shortcuts (`I` insert, `L` layers, `G` grid, `\` focus)
- [x] Backend builder contract validation: Pages/Templates/Blocks validate persisted builder JSON (graph-only v4/v6 accepted for writes; invalid docs return 422)
- [x] SEO baseline routes: dynamic `/robots.txt` and `/sitemap.xml` + backend published-pages list endpoint (`GET /api/public/pages`)
- [x] API observability/security hardening: structured request logs + standardized error payload (`error_code` + `trace_id`) + login rate limiting (`429` + `Retry-After`)

### In Progress

- [ ] Feature 02 – Pages MVP (CRUD admin + public render + SEO metadata)
  - Admin list/create/delete implemented with slug validation and filters.
  - Public `/[slug]` renders the V6 canvas via `PageRenderer` and mounts `PublicPageClient`.
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

## 15) V5 – WordPress-Like CMS (Core Parity)

V5 goal: replicate WordPress core concepts/UX using HooshPro’s existing foundation (FastAPI + Next.js + DB-backed editor), without aiming for 3rd-party WP theme/plugin binary compatibility.

### WordPress → HooshPro mapping (target)

- **Pages** → `pages` (keep; rendered at `/[slug]`; `/` renders `reading.front_page_slug` and `/<front-page-slug>` redirects to `/`)
- **Posts (blog)** → a built-in Collection: `posts` (entries with status + publish dates)
- **Custom Post Types** → `content_types` + `entries` (already implemented)
- **Custom Fields / postmeta** → `content_fields` + `entries.data_json` (already implemented; may add per-entry meta later)
- **Taxonomies (categories/tags/custom)** → implemented: `taxonomies`, `terms`, `term_relationships` (optional `term_meta` later)
- **Menus** → `menus` + `menu_items` (already implemented)
- **Media Library** → `media_assets` + `media_folders` (already implemented)
- **Themes** → V5 add: DB-backed `themes` (tokens/fonts/css vars) + template assignment; keep `page_templates` for layout/slots
- **Template hierarchy (front-page/single/archive/taxonomy)** → V5 add: route-level resolver choosing template by rule
- **Users/Roles/Capabilities** → V5 add RBAC tables + capability gates; keep cookie sessions
- **Settings/Options** → implemented: `options` key/value (site title, front page slug, posts page slug, active theme, etc.)
- **Revisions** → V5 add: version tables for pages/entries/templates/blocks
- **Plugins** → V5 internal “modules” registry (backend + frontend) for feature flags and extensibility (not WP plugin marketplace compatibility)

### V5 non-negotiable contracts

- **Single-tenant platform**: HooshPro is an internal BaaS/backbone (one workspace) that can power multiple projects/modules.
- **Breaking changes allowed (V5)**: API/schema refactors are allowed while the backbone is being built; keep this file updated and migrate frontend/backend together.
- **Single content contract**: everything public-rendered comes from a DB “document” (page/entry) resolved by slug/permalink rules.
- **Taxonomies are first-class**: terms attach to entries/pages and can drive public archive routes.
- **Theme is data**: colors/typography/spacing tokens live in DB and compile to CSS variables; templates reference tokens.
- **Backend authoritative validation**: slugs, reserved routes, taxonomy integrity, permissions.
- **Capability-based security**: admin UI visibility is not security; backend enforces.

### Proposed phases (shippable)

- **V5-A (Core WP primitives)**: `options` + taxonomies + themes done; built-in `posts` collection next.
- **V5-B (Blog + archives)**: `/blog`, `/blog/[slug]`, `/category/[slug]`, `/tag/[slug]` with SEO metadata + canonical.
- **V5-C (RBAC + revisions)**: roles/caps + revision history + restore.
- **V5-D (Customizer UX)**: theme editor (tokens/fonts), template assignment UI, preview links.
- **V5-E (Module registry)**: internal plugins/modules, migration hooks, admin menu registry.

## 10) Current TODO (next 1–3 hours)

- [ ] Verify `/[slug]?edit=1` flow end-to-end (admin gating + save)
- [ ] Verify page builder drag/drop + nesting + resize (V6 canvas) + save
- [ ] Verify components list CRUD + component picker uses DB entries
- [ ] Create a sample Block and verify “Insert block” works
- [ ] Verify template/menu selection shows correct public top nav
- [ ] Verify proxy/admin layout redirect behavior with expired sessions
- [ ] Verify Alembic startup upgrade on existing DB
- [ ] Verify media drag/drop + TipTap media picker end-to-end
- [ ] Create a sample Collection + Entries and render with `collection-list`

---

## 10.1) Developer Onboarding (must-read)

- Onboarding guide (repo structure + how to add APIs/admin CRUD): `docs/DEVELOPER_ONBOARDING.md`
- V6 execution contract + ordered backlog: `docs/EDITOR_V6_CONTRACT.md`

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
- Collections: `frontend/app/admin/collections/page.tsx`
- Entries: `frontend/app/admin/entries/page.tsx`

---

## 12) Unified Shell (sidebar-16)

- Sidebar primitives (shadcn `sidebar-16`): `frontend/components/ui/sidebar.tsx`
- Shell header: `frontend/components/site-header.tsx`
- Shell navigation: `frontend/components/app-sidebar.tsx`
- Admin layout uses the shell: `frontend/app/admin/layout.tsx`
- Public edit mode uses the same shell when `?edit=1`: `frontend/app/[slug]/page-client.tsx`

---

## 13) Page Builder (V6 canvas)

- Schema + parsing/serialization: `frontend/lib/page-builder.ts`
- Builder UI (canvas + dnd-kit): `frontend/components/page-builder/page-builder.tsx`
- Outline (tree view + selection): `frontend/components/page-builder/page-outline.tsx` (left panel on desktop; Sheet on small screens; click selects + scrolls + opens Inspector; supports collapse/hide/rename and z-order reordering)
- Component picker modal (DB-backed): `frontend/components/page-builder/block-picker-dialog.tsx` (two-step: pick → configure → insert; configure can “Save as preset”)
- Component data/props editor (used by admin + picker): `frontend/components/components/component-data-editor.tsx`
- shadcn quick-props specs (powers “Quick settings”): `frontend/lib/shadcn-specs.ts` (start here to make a shadcn component feel “Figma-like”)
- Block picker modal (DB-backed sections): `frontend/components/page-builder/block-template-picker-dialog.tsx`
- Viewport: Frames view renders Desktop/Tablet/Mobile side-by-side; only the active breakpoint is editable (click a frame or use the toolbar toggle).
- Public top nav (menu): `frontend/components/public/public-top-nav.tsx`
- Editor block (TipTap + floating toolbar): `frontend/components/editor-block.tsx`
- Media picker dialog (used by components): `frontend/components/media/media-picker-dialog.tsx`
- shadcn docs URL helper: `frontend/lib/shadcn-docs.ts`
- shadcn variant extractor: `frontend/lib/shadcn-variants.ts` + `frontend/hooks/use-shadcn-variants.ts` + `frontend/app/shadcn/variants/route.ts`
- shadcn Alert primitive: `frontend/components/ui/alert.tsx` (used by component previews / shadcn rendering)
- Public edit client mounts the builder in `?edit=1`: `frontend/app/[slug]/page-client.tsx`
  - In edit mode, the active template is composed into the canvas (menu + slot + footer) and **everything is editable** (no template lock). Use “Hide chrome” if you want to focus on slot/page content only.

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
