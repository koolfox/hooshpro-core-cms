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

- Branch: `feature/02-pages-mvp`
- Feature: `Pages MVP + Public Visual Editing (TipTap)`
- Status: `In progress`

Quick check:

- `git branch --show-current`
- `git status`

---

## 3) Routing Rules (Non-negotiable)

### Frontend Routes

- Public pages: `/(public)/[slug]`
- Auth pages: `/(auth)/login`
- Admin pages: `/(admin)/admin/*`

### Backend Routes

- Auth:
  - POST `/api/auth/login`  -> sets cookie
  - POST `/api/auth/logout` -> clears cookie
  - GET  `/api/auth/me`     -> validates session
  - POST `/api/auth/token`  -> swagger bearer token (no cookie)

- Pages:
  - Admin CRUD:
    - GET    `/api/admin/pages` (pagination + filters)
    - POST   `/api/admin/pages`
    - GET    `/api/admin/pages/{id}`
    - PUT    `/api/admin/pages/{id}`
    - DELETE `/api/admin/pages/{id}`
    - GET    `/api/admin/pages/by-slug/{slug}` (for visual editing on public route)

  - Public:
    - GET `/api/public/pages/{slug}` (published only)

---

## 4) Auth & Session Contract

### Cookie

- Name: `hooshpro_session`
- HttpOnly: True
- SameSite: Lax
- Secure: False in dev, True in prod
- Session length: 14 days

### Security gates

- Backend: every `/api/admin/*` requires auth dependency (real security)
- Frontend: middleware blocks `/admin/*` if cookie missing or invalid (UX + early block)

---

## 5) Next.js API Proxy (dev)

- `next.config.ts` rewrites:
  - `/api/:path*` -> `${API_ORIGIN}/api/:path*`

Env:

- `frontend/.env.local`
  - `API_ORIGIN=http://127.0.0.1:8000`

Important:

- Server Components MUST use absolute URL when fetching backend:
  - use `${API_ORIGIN}/api/...`
- Client components can call `/api/...` (rewrites kicks in)

---

## 6) Data Model (current)

### Page table

- id (int PK)
- title (string)
- slug (unique, indexed)
- status: draft|published
- seo_title, seo_description (nullable)
- blocks_json (TEXT)
- published_at (nullable)
- created_at, updated_at

Reserved slugs:

- admin, login, logout, api, auth

Blocks:

- MVP uses TipTap blocks:
  - `{ version: 2, blocks: [ { type:"tiptap", data:{ doc, html } } ] }`

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
- [x] Feature 01 – Auth/session + admin gate (login/logout/me + middleware)

### In Progress

- [ ] Feature 02 – Pages MVP (CRUD admin + public render + SEO metadata)
- [ ] TipTap visual editing on public route

### Next (parking lot)

- [ ] Media manager (local storage + DB references)
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

- [ ] Install TipTap packages
- [ ] Add /api/admin/pages/by-slug/{slug}
- [ ] Add public page route with TipTap editor
- [ ] Save blocks_json (doc+html) and render html publicly
