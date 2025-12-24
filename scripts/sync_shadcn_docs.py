from __future__ import annotations

import argparse
import re
import sys
import urllib.request
from pathlib import Path


DEFAULT_DOCS_BASE = "https://ui.shadcn.com/docs/components"


def repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_shadcn_slugs_from_frontend() -> list[str]:
    """
    Parses `frontend/lib/shadcn-docs.ts` to avoid duplicating the slug list.
    """
    path = repo_root() / "frontend" / "lib" / "shadcn-docs.ts"
    text = path.read_text(encoding="utf-8")

    m = re.search(
        r"SHADCN_COMPONENT_DOC_SLUGS\s*=\s*\[(?P<body>.*?)\]\s*as const",
        text,
        flags=re.DOTALL,
    )
    if not m:
        raise RuntimeError(f"Failed to parse slugs from {path}")

    body = m.group("body")
    slugs = re.findall(r'"([^"]+)"', body)
    slugs = [s.strip().lower() for s in slugs if s.strip()]
    if not slugs:
        raise RuntimeError(f"No slugs found in {path}")
    return slugs


def fetch(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "hooshpro-sync-shadcn-docs/1.0",
            "Accept": "text/markdown,text/plain,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Sync shadcn/ui component markdown docs into the repo.")
    parser.add_argument(
        "--base",
        default=DEFAULT_DOCS_BASE,
        help=f"Docs base URL (default: {DEFAULT_DOCS_BASE})",
    )
    parser.add_argument(
        "--out",
        default=str(repo_root() / "docs" / "shadcn" / "components"),
        help="Output directory for downloaded .md files",
    )
    parser.add_argument(
        "--slugs",
        nargs="*",
        default=None,
        help="Optional subset of component slugs (default: all known slugs)",
    )
    parser.add_argument(
        "--fail-fast",
        action="store_true",
        help="Stop on first failure (default: continue and report failures)",
    )

    args = parser.parse_args(argv)

    try:
        all_slugs = load_shadcn_slugs_from_frontend()
    except Exception as e:
        print(str(e), file=sys.stderr)
        return 2

    slugs = [s.strip().lower() for s in (args.slugs or []) if s.strip()]
    if slugs:
        unknown = sorted(set(slugs) - set(all_slugs))
        if unknown:
            print(f"Unknown slugs: {', '.join(unknown)}", file=sys.stderr)
            return 2
    else:
        slugs = all_slugs

    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    failures: list[tuple[str, str]] = []

    for slug in slugs:
        url = f"{args.base.rstrip('/')}/{slug}.md"
        dest = out_dir / f"{slug}.md"
        try:
            data = fetch(url)
            dest.write_bytes(data)
            print(f"OK  {slug} -> {dest.relative_to(repo_root())}")
        except Exception as e:
            failures.append((slug, str(e)))
            print(f"ERR {slug}: {e}", file=sys.stderr)
            if args.fail_fast:
                return 1

    if failures:
        print("", file=sys.stderr)
        print("Failed:", file=sys.stderr)
        for slug, msg in failures:
            print(f"- {slug}: {msg}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

