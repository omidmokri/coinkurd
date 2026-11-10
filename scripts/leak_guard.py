#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Leak guard — this repository is PUBLIC, so it must never contain the source of the closed (invite-only) indicators.

The closed scripts live only on TradingView (protected) and in the owner's PRIVATE engine repository; the site only ever
receives their outputs (data/live.json, data/engine.json, data/signals.json). This check runs before every deploy and stops
the deploy if anything that looks like indicator source code has entered the site:

  • any Pine Script file (*.pine) or Pine header line (//@version=N) anywhere in the published tree
  • a private-engine package (engine/indicators/…) copied into this repository
  • data/engine.json carrying anything other than the whitelisted output fields

Run:  python scripts/leak_guard.py        (exit 1 = leak found, the deploy must not continue)
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "node_modules", "tts", "__pycache__"}
TEXT = (".html", ".js", ".json", ".py", ".md", ".txt", ".css", ".xml", ".yml", ".yaml", ".webmanifest", ".java", ".pine", ".sh")
PINE = re.compile(r"^\s*//\s*@version\s*=\s*\d", re.M)
SELF = os.path.relpath(os.path.abspath(__file__), ROOT)
ENGINE_KEYS = {"ind", "tv_sym", "sym", "tf", "price", "t", "f"}


def main():
    bad = []
    for d, dirs, files in os.walk(ROOT):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        rel_d = os.path.relpath(d, ROOT)
        if re.search(r"(^|/)engine/indicators(/|$)", rel_d):
            bad.append(f"{rel_d}/ — private engine modules must stay in the private repository")
            dirs[:] = []
            continue
        for fn in files:
            p = os.path.join(d, fn)
            rel = os.path.relpath(p, ROOT)
            if rel == SELF:
                continue
            if fn.lower().endswith(".pine"):
                bad.append(f"{rel} — Pine source file")
                continue
            if not fn.lower().endswith(TEXT):
                continue
            try:
                if os.path.getsize(p) > 25_000_000:
                    continue
                txt = open(p, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            m = PINE.search(txt)
            if m:
                line = txt.count("\n", 0, m.start()) + 1
                bad.append(f"{rel}:{line} — Pine Script header (//@version=)")
    eng = os.path.join(ROOT, "data", "engine.json")
    if os.path.exists(eng):
        try:
            e = json.load(open(eng, encoding="utf-8"))
            if set(e) - {"updated_at", "states", "note"}:
                bad.append(f"data/engine.json — unexpected top-level keys {sorted(set(e) - {'updated_at', 'states', 'note'})}")
            for i, s in enumerate(e.get("states") or []):
                extra = set(s) - ENGINE_KEYS
                long_ = [k for k, v in (s.get("f") or {}).items() if isinstance(v, (str, list, dict)) and len(str(v)) > 64]
                if extra or long_:
                    bad.append(f"data/engine.json state {i} — not an output-only record ({sorted(extra) + long_})")
                    break
        except Exception as x:  # noqa: BLE001
            bad.append(f"data/engine.json — unreadable ({x})")
    if bad:
        print("LEAK GUARD: possible indicator source in the public site — deploy stopped:")
        for b in bad[:50]:
            print("  ✗", b)
        sys.exit(1)
    print("leak guard: clean (no indicator source in the published tree)")


if __name__ == "__main__":
    main()
