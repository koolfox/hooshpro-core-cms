# DaisyUI Styling Analysis for HooshPro Editor

## Source Snapshot
- Raw source copied from: `https://daisyui.com/llms.txt`
- Local copy: `docs/daisyui/llms.txt`
- Notes: daisyUI v5 guidance, class contracts, theme variables, and component syntax/rules.

## Current Codebase Reality (Verified)
- DaisyUI plugin is already enabled in `frontend/app/globals.css` using `@plugin "daisyui"`.
- Editor nodes support style overrides via `node.style` in `frontend/lib/page-builder.ts`.
- Style keys are sanitized and breakpoint/state-aware in `frontend/lib/node-style.ts`.
- Public render resolves those styles in `frontend/components/page-builder/page-renderer.tsx`.
- Legacy `shadcn` node type still exists in schema for backward compatibility.

## How DaisyUI Should Drive Styling in This Editor
DaisyUI works best when each editable node carries:
1. Semantic component class (`navbar`, `card`, `btn`, `menu`, `hero`, etc.)
2. Optional part/modifier classes (`collapse-title`, `btn-primary`, `menu-horizontal`, etc.)
3. Tailwind utility classes for spacing/layout fine-tuning (`px-6`, `rounded-full`, `gap-4`)
4. Theme-driven colors (`bg-base-100`, `text-base-content`, `bg-primary`, etc.)

This matches your shape+data model:
- **Shape** = container/structure classes + layout + border/radius/background
- **Data** = text/media/link/content payload rendered inside the shape
- **Block** = reusable composition of shape+data nodes

## Node-Type to DaisyUI Mapping (Practical)

| Editor node type | Primary DaisyUI classes | Recommended style knobs |
|---|---|---|
| `frame` | `card`, `hero`, `navbar`, `footer`, `mockup-window`, `rounded-box` | display/flex/grid, padding, radius, border, shadow, background |
| `shape` | `rounded-box`, `mask`, `divider`, `skeleton`, `bg-*`/`border-*` | width/height, fill/background, stroke/border, radius, opacity |
| `text` | `prose`, `text-*`, `font-*`, `link`, `label` | font size/weight/line-height, color, alignment, spacing |
| `button` | `btn`, `btn-primary`, `btn-secondary`, `btn-outline`, `btn-wide` | size, variant, radius, padding, hover/active states |
| `menu` | `navbar`, `menu`, `menu-horizontal`, `menu-vertical` | alignment, gap, active state, container radius/background |
| `image` | `avatar`, `mask`, `rounded-box`, `skeleton` (loading) | fit/position/radius, border, shadow, responsive constraints |
| `card` | `card`, `card-body`, `card-title` | spacing hierarchy, media slot, CTA variants |
| `collection-list` | `list`, `table`, `timeline`, `stats` (depending template) | column count, item gap, sort/filter UI states |

## Inspector Design Guidance (Based on DaisyUI Contracts)
Expose these controls per selected node:
- Theme: `data-theme` picker (light, dark, corporate, luxury, autumn, custom)
- Component class: free text + quick presets (`navbar`, `card`, `hero`, `btn`, `menu`)
- Variant toggles: color (`primary`, `secondary`, `accent`, `neutral`), size (`xs`..`xl`), style (`outline`, `ghost`, `soft`, etc. when applicable)
- Layout: display/flex/grid, direction, wrap, justify, align, gap
- Box model: width/height/min/max, margin, padding
- Surface: background, border width/style/color, radius, shadow, opacity
- Typography: font family/size/weight/line-height/letter spacing/text transform
- Interaction states: hover/active/focus class overrides and transitions

## Example: Pill Navigation Like Your Reference Image
Use a menu wrapper frame with:
- Wrapper classes: `navbar bg-base-200 rounded-full px-6 py-3 shadow-sm`
- Logo area: `flex items-center gap-3`
- Link list: `menu menu-horizontal gap-6 text-base-content`
- CTA button: `btn btn-warning rounded-full px-8`

This can be fully built from existing node types (`frame` + `image/text` + `menu` + `button`) if class-level control is exposed cleanly in inspector.

## Migration Advice for Consistency
- Prefer DaisyUI classes as first layer of styling.
- Keep `node.style` inline CSS for precise overrides only.
- Keep colors semantic (`base-*`, `primary`, `secondary`, etc.) so themes switch reliably.
- Phase out remaining `shadcn` node semantics by converting legacy nodes to `frame/shape/text/button/image/menu` primitives.

## Immediate Next Implementation Chunk
1. Add `className` input + preset chips to every node inspector section (not only frame/text).
2. Add per-node `data-theme` selector and apply it in editor + renderer.
3. Add quick presets for `navbar`, `hero`, `card`, `footer`, `cta`, `menu` blocks using DaisyUI class bundles.
4. Keep public render parity by applying exactly the same class pipeline in editor and renderer.
