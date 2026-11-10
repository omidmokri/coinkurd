#!/usr/bin/env python3
"""Tell Bing (and through it DuckDuckGo and Yahoo) about new post pages right away, via IndexNow.

The key file /79b8346b44b1444b9911efe52e98cfc0.txt sits at the site root (the key comes from the owner's OpenSEO
project). Each run submits the post pages not sent before: /p/<id>/ plus /en/p/<id>/ and /ckb/p/<id>/ when that
translation exists. data/indexnow.json keeps the ids already sent, so nothing is submitted twice. The first run sends
the newest 1,000 posts and the main pages. Google does not use IndexNow; it reads the sitemap.

Runs in update.yml before "Commit data", so the state file is committed with the rest of data/.
"""
import json
import os
from datetime import datetime, timezone

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY = "79b8346b44b1444b9911efe52e98cfc0"
HOST = "entekhab.net"
STATE = os.path.join(ROOT, "data", "indexnow.json")
HUBS = ["/", "/dashboard/", "/derivatives/", "/dca/", "/strategy-lab/", "/regime/", "/leaderboard/", "/terminal/",
        "/library/", "/learn/", "/academy/", "/encyclopedia/", "/tools/", "/whales/", "/track-record/"]


def main():
    try:
        st = json.load(open(STATE, encoding="utf-8"))
    except Exception:  # noqa: BLE001
        st = {"sent": []}
    sent = set(st.get("sent") or [])
    posts = json.load(open(os.path.join(ROOT, "data", "posts.json"), encoding="utf-8"))
    posts.sort(key=lambda p: p.get("date") or "", reverse=True)
    first = not sent
    todo = [p for p in posts[:1000 if first else 300] if str(p["id"]) not in sent]
    urls = [f"https://{HOST}{u}" for u in HUBS] if first else []
    for p in todo:
        urls.append(f"https://{HOST}/p/{p['id']}/")
        for lg in ("en", "ckb"):
            t = (p.get("tr") or {}).get(lg)
            if isinstance(t, dict) and t.get("text"):
                urls.append(f"https://{HOST}/{lg}/p/{p['id']}/")
    if not urls:
        print("indexnow: nothing new")
        return
    try:
        r = requests.post("https://api.indexnow.org/indexnow", timeout=30,
                          json={"host": HOST, "key": KEY, "keyLocation": f"https://{HOST}/{KEY}.txt", "urlList": urls[:10000]})
        ok = r.status_code in (200, 202)
        print(f"indexnow: {len(urls)} URLs → HTTP {r.status_code}")
    except Exception as e:  # noqa: BLE001
        print("indexnow: request failed:", str(e)[:120])
        ok = False
    if ok:   # only remember what was accepted; a failed run is retried next time
        sent |= {str(p["id"]) for p in todo}
        keep = [str(p["id"]) for p in posts if str(p["id"]) in sent][:3000]
        json.dump({"updated_at": datetime.now(timezone.utc).isoformat(), "sent": keep}, open(STATE, "w", encoding="utf-8"))


if __name__ == "__main__":
    main()
