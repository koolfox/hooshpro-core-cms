# shadcn/ui component docs (vendored)

This folder contains a local mirror of the raw markdown docs from:

- `https://ui.shadcn.com/docs/components/<slug>.md`

Why:

- Lets us read the docs inside the repo (every line of the source markdown).
- Powers our editor tooling (variants extraction) without relying on live network access.

## Sync / update

From the repo root:

- `python scripts/sync_shadcn_docs.py`

Output:

- `docs/shadcn/components/<slug>.md`

