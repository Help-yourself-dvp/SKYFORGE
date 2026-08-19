#!/usr/bin/env python3
"""Build a single offline HTML preview from Vite dist output."""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT_DIR = ROOT / "preview"
OUT = OUT_DIR / "skyforge.html"


def read(p: pathlib.Path) -> str:
    return p.read_text(encoding="utf-8")


def main() -> int:
    html_path = DIST / "index.html"
    if not html_path.exists():
        print("dist/index.html missing — run npm run build first", file=sys.stderr)
        return 1
    html = read(html_path)
    js_files = sorted((DIST / "assets").glob("*.js"))
    css_files = sorted((DIST / "assets").glob("*.css"))
    if not js_files:
        print("no JS bundle in dist/assets", file=sys.stderr)
        return 1
    js = read(js_files[0])
    css = "\n".join(read(p) for p in css_files)

    html = re.sub(r'<link[^>]+href="[^"]+\.css"[^>]*>', "", html)
    html = re.sub(r'<script[^>]+src="[^"]+\.js"[^>]*></script>', "", html)
    if css:
        html = html.replace("</head>", f"<style>\n{css}\n</style>\n</head>")
    html = html.replace("</body>", f"<script type=\"module\">\n{js}\n</script>\n</body>")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
