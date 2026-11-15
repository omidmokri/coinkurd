#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IndexNow: tell Bing, Yandex, Seznam, Naver (and others on the protocol) about new or changed pages right after each run.
The key file /<KEY>.txt is served from the repository root. State (last submitted post id / day) lives in data/indexnow.json
so it is committed with the rest of the data. Never fails the workflow.
"""
import json
import os
from datetime import datetime, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get("SITE_URL", "https://entekhab.net").rstrip("/")
HOST = SITE.split("//", 1)[-1]
KEY = "197870bb53d43dc52a81b786cd3a140e"
STATE = os.path.join(ROOT, "data", "indexnow.json")


def daily_pages():
    """once a day: the coin pages (their prices change every run) and the live market in each language whose page text
    is translated (scripts/pro_l10n.py) — so Bing and Yandex refresh them, not only new posts"""
    out = [f"{SITE}/coins/", f"{SITE}/market/"]
    try:
        m = json.load(open(os.path.join(ROOT, "data", "market.json"), encoding="utf-8"))
        out += [f"{SITE}/coins/{c['coin'].lower()}/" for c in (m.get("coins") or [])[:60] if c.get("coin")]
    except Exception:  # noqa: BLE001
        pass
    d = os.path.join(ROOT, "data", "pro_l10n")
    try:
        for f in sorted(os.listdir(d)):
            if f.endswith(".json") and not f.startswith("_"):
                s = (json.load(open(os.path.join(d, f), encoding="utf-8")).get("s") or {})
                if "seo.title" in s and "seo.desc" in s:
                    out.append(f"{SITE}/market/{f[:-5]}/")
    except Exception:  # noqa: BLE001
        pass
    return out


def main():
    try:
        posts = json.load(open(os.path.join(ROOT, "data", "posts.json"), encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"indexnow: no posts ({e})")
        return
    st = json.load(open(STATE, encoding="utf-8")) if os.path.exists(STATE) else {}
    last_id = int(st.get("last_id") or 0)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = []
    new = sorted((p for p in posts if int(p.get("id") or 0) > last_id and p.get("q") != "low"), key=lambda p: int(p["id"]))
    for p in new[-200:]:
        urls.append(f"{SITE}/p/{p['id']}/")
        tr = p.get("tr") or {}
        for lg in ("en", "ckb"):
            if isinstance(tr.get(lg), dict) and tr[lg].get("text"):
                urls.append(f"{SITE}/{lg}/p/{p['id']}/")
    if st.get("last_day") != today:
        urls += [f"{SITE}/", f"{SITE}/daily/{today}/", f"{SITE}/daily/", f"{SITE}/fear-greed/", f"{SITE}/sitemap.xml"]
        urls += daily_pages()
    if not urls:
        print("indexnow: nothing new")
        return
    try:
        r = requests.post("https://api.indexnow.org/indexnow", json={"host": HOST, "key": KEY, "keyLocation": f"{SITE}/{KEY}.txt", "urlList": urls[:1000]},
                          headers={"Content-Type": "application/json; charset=utf-8"}, timeout=20)
        ok = r.status_code in (200, 202)
        print(f"indexnow: {len(urls)} urls -> HTTP {r.status_code}")
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"indexnow: failed ({e})")
    if ok:
        st = {"last_id": max([last_id] + [int(p["id"]) for p in new]), "last_day": today, "at": datetime.now(timezone.utc).isoformat(), "n": len(urls)}
        json.dump(st, open(STATE, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main()
