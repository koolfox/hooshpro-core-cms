# HooshPro WordPress-Competitor Status (Execution Contract)

Date: 2026-02-21
Branch: `main-pushable`

## Current Score
- Product MVP foundation: `68/100`
- WordPress-class parity: `36/100`

## Checklist Status (Done / Partial / Missing)

### Schema Stability
- Canonical editor/content schema: `Partial`
- Strict backend validation for saved docs: `Partial`
- Deterministic migration tooling for each schema change: `Missing`

### Publishing Workflow
- Draft/Published/Scheduled: `Partial` (`draft|published` exists; scheduled missing)
- Preview tokens for unpublished content: `Missing`
- Revisions + restore: `Missing`
- Publish audit log: `Missing`

### Core Content System
- First-class Pages: `Done`
- First-class Posts: `Missing` (no dedicated `posts` model/module)
- Custom content types + field schemas: `Done`
- Taxonomies + archives: `Partial` (taxonomy APIs exist; frontend archives/resolvers incomplete)
- Slug/permalink manager + redirects: `Missing`

### Editor/Renderer Parity
- Same style resolver in editor/public: `Done`
- No editor-only layout mutations: `Partial`
- Breakpoint inheritance + interaction states: `Done`
- Zero data-loss drag/move/resize: `Partial`

### Theme/Template Engine
- DB-backed themes: `Done`
- Template hierarchy resolver (home/single/archive/taxonomy/search/404): `Missing`
- Template assignment per content type: `Partial`
- Reusable global block variants: `Partial`

### Media System
- `media_id`-first references: `Partial`
- Alt/caption/focal metadata: `Missing`
- Where-used dependency graph: `Missing`
- Delete guard on referenced assets: `Missing`
- Image variants/optimization pipeline: `Missing`

### Navigation & Site Structure
- Menu builder with nested items: `Partial` (CRUD/reorder exists; deep nesting UX/contracts incomplete)
- Header/footer editable graph nodes: `Partial`
- Global assignment by template/theme: `Partial`

### Security & Permissions
- RBAC (Admin/Editor/Author/Publisher): `Missing`
- Capability checks backend-first: `Partial` (`admin` gate exists, granular caps missing)
- CSRF/session hardening: `Done`
- Login throttling + audit trails: `Partial` (throttling exists, audits missing)

### Extensibility
- Internal hooks/events/services contract: `Missing`
- Registry for admin menus/routes/blocks/field types: `Partial`
- Versioned extension API: `Missing`

### Interoperability
- WordPress import (WXR + media remap): `Missing`
- Export APIs (JSON/Markdown/static): `Partial`
- WP-like REST compatibility adapter: `Missing`

### Reliability/Ops
- Backups + restore drill: `Missing`
- Structured errors (`error_code`, `trace_id`): `Partial`
- Metrics/logging/health checks: `Partial`
- CI/CD migration safety gates: `Missing`

### QA/Release Discipline
- API tests for CRUD/auth/rbac: `Partial`
- E2E for edit/save/publish/media/preview: `Partial`
- Performance budgets: `Missing`
- Release checklist + rollback procedure: `Partial`

## Ordered Execution Roadmap (Consecutive Loops)

### Loop 1 (Stability First)
1. Freeze V6 schema and remove legacy `v1/v3/shadcn` fallback save/load paths.
2. Enforce backend validator parity for pages/templates; reject invalid trees with stable error codes.
3. Close editor/render parity gaps and drag-vanish edge cases.

### Loop 2 (Publishing Core)
1. Add preview token table + signed preview endpoints.
2. Add revisions tables for pages/templates/blocks + restore endpoints.
3. Add redirects table + slug-change redirect creation.

### Loop 3 (WordPress Core Surface)
1. Add first-class posts module (model/service/router/admin UI).
2. Complete archive routes (`/blog`, `/category/[slug]`, `/tag/[slug]`) + metadata.
3. Add template hierarchy resolver with deterministic precedence.

### Loop 4 (Media + Permissions)
1. Add media metadata fields (`alt`, `caption`, `focal_x`, `focal_y`).
2. Add where-used graph + delete guard in service and UI.
3. Add RBAC roles/capabilities with backend-first guards across admin APIs.

### Loop 5 (Release Gates)
1. Add API + E2E CI gates for edit/save/publish/media/preview.
2. Add backup/restore scripts and restore drill doc.
3. Lock release readiness checklist and rollback runbook.

## Immediate Implementation Chunk (Now In Progress)
- Inspector: added desktop action to sync current style state to both tablet/mobile breakpoints in one click.
