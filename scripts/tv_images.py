#!/usr/bin/env python3
"""Downloads the publication chart image of every indicator in data/indicators.json that has no local copy yet
(assets/tv-<id>.webp + assets/tv-<id>-sm.webp). Only TradingView's public preview image is fetched — never any script source."""
import io
import json
import os
import sys

import requests
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")


def main():
    items = json.load(open(os.path.join(ROOT, "data", "indicators.json"), encoding="utf-8"))["items"]
    made = 0
    for it in items:
        tv = it["tv"]
        big, sm = os.path.join(A, f"tv-{tv}.webp"), os.path.join(A, f"tv-{tv}-sm.webp")
        if os.path.exists(big) and os.path.exists(sm):
            continue
        url = f"https://s3.tradingview.com/{tv[0].lower()}/{tv}_big.png"
        try:
            r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0 entekhab.net"})
            r.raise_for_status()
            im = Image.open(io.BytesIO(r.content)).convert("RGB")
        except Exception as ex:  # noqa: BLE001
            print("skip", tv, ex)
            continue
        w, h = im.size
        for path, width in ((big, 1227), (sm, 640)):
            tw = min(width, w)
            im.resize((tw, round(h * tw / w)), Image.LANCZOS).save(path, "WEBP", quality=80, method=6)
        made += 1
        print("ok", tv, w, h)
    print("images made", made)


if __name__ == "__main__":
    sys.exit(main())
