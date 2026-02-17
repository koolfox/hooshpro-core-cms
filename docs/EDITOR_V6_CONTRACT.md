# HooshPro Editor V6 Contract (Ordered Backlog)

## Goal
Ship a single, production-safe V6 editor path based on one model:
- `shape + data` atoms
- grouped into `block`
- composed into `frame`

No parallel legacy editor paths.

## Definition of Done (global)
- One canonical schema for save/render/edit.
- Backend rejects invalid trees with deterministic error contract.
- Public render parity with editor output.
- Docs are contract-level and versioned.

## Ordered Execution Backlog

1. Lock canonical V6 schema in `frontend/lib/page-builder.ts` and mirror validation in backend page schemas.
Done when: no legacy fallback is needed during save/render.

2. Add strict backend block-tree validation in `backend/app/services/pages_service.py` and `backend/app/services/templates_service.py`.
Done when: invalid trees are rejected with consistent API errors.

3. Remove V1/V3 compatibility paths (including legacy extract/migration branches).
Done when: all persisted/loaded content is single-version V6.

4. Implement block instances + variants (global master + detach per page) in models/routers/services.
Done when: master updates propagate unless instance is detached.

5. Make header/footer/menu/content the same editable graph in builder and renderer.
Done when: nothing is special-locked by node type.

6. Upgrade layers panel to full constructive hierarchy (`shape` / `data`) in `frontend/components/page-builder/page-outline.tsx`.
Done when: every visual element is selectable/editable from tree.

7. Add breakpoint cascade rules (desktop -> tablet/mobile inheritance + per-node override).
Done when: desktop changes can propagate deterministically.

8. Add layout constraints/autolayout semantics (pin, fill, hug, min/max).
Done when: responsive behavior is deterministic in editor and public render.

9. Fix drag-vanish class permanently via transactional move/drop validation.
Done when: every drag results in valid placement or explicit revert.

10. Ship interaction engine schema/runtime (click/hover/scroll/in-view + effects).
Done when: interactions are editable and reproduced on public render.

11. Expose full Interaction tab in inspector.
Done when: each node supports trigger/action/easing/duration config.

12. Add animation presets and timeline-friendly motion props (opacity/transform/filter/clip).
Done when: block-level motion is comparable to modern site builders.

13. Enforce media_id-first media contract in builder/renderer/media service.
Done when: URL is derived; moving media does not break content links.

14. Extend media metadata + where-used + delete guard.
Done when: referenced media cannot be deleted without clear UX resolution.

15. Add CMS data-binding builder UI (query/sort/filter/field mapping) for collection nodes.
Done when: dynamic sections are configured visually, not by raw JSON.

16. Add template hierarchy resolver (front-page/single/archive/taxonomy) backend + route composition frontend.
Done when: routes auto-resolve the correct template by content type.

17. Complete SEO/publish surface (canonical/OG/image + robots/sitemap + metadata flow).
Done when: crawler output is complete and stable.

18. Add preview/publish workflow (draft token, scheduled publish, publish history).
Done when: publishing is auditable and reversible.

19. Add revisions/version restore for pages/templates/blocks.
Done when: time-travel restore is available and safe.

20. Add RBAC capability matrix (Editor/Publisher/Admin) backend-first.
Done when: permissions are enforced server-side and reflected in admin UI.

21. Add realtime collaboration foundation (presence/comments/selection) with websocket transport.
Done when: two users can co-edit safely without corruption.

22. Add deterministic error contract + telemetry (`error_code`, `trace_id`) backend and frontend mapping.
Done when: production failures are diagnosable end-to-end.

23. Add QA gate (Playwright e2e + backend API tests) for edit/save/render/publish/media/CMS.
Done when: CI blocks regressions.

24. Harden performance (virtualized layers, memoized canvas subtrees, image variants, cache strategy).
Done when: large pages remain responsive.

25. Final cleanup pass (remove dead paths and obsolete admin surfaces after V6 cutover).
Done when: one editor path and one schema remain.

26. Keep docs as contract: update `docs/HOOSHPRO_REFERENCE.md`, `docs/DEVELOPER_ONBOARDING.md`, and this file each feature step.
Done when: a new developer can ship safely in one day.

## Competitive Reality Check
- Completing items 1-20 yields a strong self-hosted alternative (~90-95/100 experience fit).
- Reaching true 99-100 parity requires items 21-24 plus consistent polish/QA discipline.
## Data Storage Strategy (JSON + Markdown)
- Canonical editor persistence stays as JSON graph (`shape/data -> block -> frame`) for deterministic layout/render.
- Markdown is first-class for text payloads and long-form content fields, not for geometry/constraints.
- Optional: store generated Markdown snapshots per revision for human diff/review, while renderer always consumes canonical JSON.

## Progress Snapshot (2026-02-17)
- Item 22 (deterministic error contract + trace telemetry): implemented baseline.
  - Backend: standardized error payload `{ error_code, message, detail, trace_id?, details? }` + `x-trace-id` header in `backend/app/main.py`.
  - Frontend: `ApiError` now carries `errorCode`, `traceId`, and `details` from response body/headers in `frontend/lib/http.ts`.
- Production-readiness gap closed: login endpoint rate limiting (per-IP + per-email sliding window) in `backend/app/routers/auth.py`.
- Item 23 (QA gate) planning updated: CI workflow draft prepared locally; remote push requires Git token with `workflow` scope.

