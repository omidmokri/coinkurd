#!/usr/bin/env python3
"""Every coin on the site's coins wall must show its own logo — never a placeholder.

The owner's 3D artwork lives in assets/coin3d/<TICKER>.png. For any coin the channel talks about that has no
3D artwork yet, this script fetches the coin's official logo (CoinGecko, largest market cap for that ticker)
and sets it in a glossy 3D coin, so it sits naturally next to the 3D set:
    data/coinlogo/<TICKER>.png        200x200 transparent PNG
    data/coinlogo/index.json          {"coins": [...tickers with a logo...], "updated_at": ...}
A ticker with no logo anywhere (e.g. a tokenised stock CoinGecko does not list) is simply left off the wall.
Run: python3 scripts/coin_logos.py
"""
import io
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests
from PIL import Image, ImageChops, ImageDraw, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "coinlogo")
HAS3D = os.path.join(ROOT, "assets", "coin3d")
UA = {"User-Agent": "entekhab.net coin logos"}


def coin_frame(logo, rim=(247, 147, 26), white_glyph=False):
    """logo (RGBA) inside a glossy dark coin with a coloured rim; returns 200x200 RGBA"""
    S = 4
    R = 200 * S
    W = R + 40 * S
    c = W // 2
    im = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    sh = Image.new("L", (W, W), 0)
    ImageDraw.Draw(sh).ellipse((c - R // 2 + 6 * S, c - R // 2 + 14 * S, c + R // 2 + 6 * S, c + R // 2 + 14 * S), fill=150)
    im.paste((0, 0, 0, 255), (0, 0), sh.filter(ImageFilter.GaussianBlur(10 * S)))
    dark = tuple(int(v * 0.35) for v in rim)
    ImageDraw.Draw(im).ellipse((c - R // 2, c - R // 2 + 8 * S, c + R // 2, c + R // 2 + 8 * S), fill=dark + (255,))
    y, x = np.mgrid[0:W, 0:W]
    d = np.hypot(x - (c - R * 0.18), y - (c - R * 0.22)) / (R * 0.9)
    base, hi = np.array([14, 16, 18]), np.array([66, 74, 76])
    t = np.clip(1 - d, 0, 1)[..., None]
    face = np.dstack([base + (hi - base) * t, np.full((W, W, 1), 255)]).astype(np.uint8)
    fm = Image.new("L", (W, W), 0)
    ImageDraw.Draw(fm).ellipse((c - R // 2, c - R // 2, c + R // 2, c + R // 2), fill=255)
    im.paste(Image.fromarray(face, "RGBA"), (0, 0), fm)
    ring = Image.new("L", (W, W), 0)
    dr = ImageDraw.Draw(ring)
    dr.ellipse((c - R // 2, c - R // 2, c + R // 2, c + R // 2), fill=255)
    dr.ellipse((c - R // 2 + 9 * S, c - R // 2 + 9 * S, c + R // 2 - 9 * S, c + R // 2 - 9 * S), fill=0)
    g = np.clip(1 - (y - (c - R / 2)) / R, 0.35, 1.0)
    rc = np.dstack([rim[0] * g, rim[1] * g, rim[2] * g, np.full_like(g, 255)]).astype(np.uint8)
    im.paste(Image.fromarray(rc, "RGBA"), (0, 0), ring)
    if white_glyph:
        m = logo.split()[3]
        m = m.crop(m.getbbox())
        gw = int(R * 0.46)
        gm = m.resize((gw, int(m.size[1] * gw / m.size[0])), Image.LANCZOS)
        art = Image.new("RGBA", gm.size, (0, 0, 0, 0))
        col = (np.linspace(255, 200, gm.size[1])[:, None] * np.ones((1, gm.size[0])))
        art = Image.fromarray(np.dstack([col, col, col, np.asarray(gm)]).astype(np.uint8), "RGBA")
    else:
        lg = logo.crop(logo.getbbox() or (0, 0, logo.size[0], logo.size[1]))
        gw = int(R * 0.66)
        sc = gw / max(lg.size)
        art = lg.resize((max(1, int(lg.size[0] * sc)), max(1, int(lg.size[1] * sc))), Image.LANCZOS)
    gx, gy = c - art.size[0] // 2, c - art.size[1] // 2
    sha = Image.new("L", (W, W), 0)
    sha.paste(art.split()[3], (gx + 3 * S, gy + 5 * S))
    im.paste((0, 0, 0, 255), (0, 0), sha.filter(ImageFilter.GaussianBlur(4 * S)).point(lambda v: int(v * 0.6)))
    im.alpha_composite(art, (gx, gy))
    sp = Image.new("L", (W, W), 0)
    ImageDraw.Draw(sp).ellipse((c - R * 0.38, c - R * 0.46, c + R * 0.15, c - R * 0.08), fill=55)
    im.paste((255, 255, 255, 255), (0, 0), ImageChops.multiply(sp.filter(ImageFilter.GaussianBlur(16 * S)), fm))
    out = im.crop(im.getbbox())
    s = max(out.size)
    can = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    can.alpha_composite(out, ((s - out.size[0]) // 2, (s - out.size[1]) // 2))
    return can.resize((200, 200), Image.LANCZOS)


def main_colour(img):
    a = np.asarray(img.convert("RGBA").resize((48, 48))).reshape(-1, 4).astype(float)
    a = a[a[:, 3] > 200][:, :3]
    if not len(a):
        return (247, 147, 26)
    sat = a.max(1) - a.min(1)
    pick = a[sat > 40] if (sat > 40).sum() > 20 else a
    r, g, b = pick.mean(0)
    return (int(r), int(g), int(b))


def gecko_index():
    """ticker -> large image URL, keeping the largest market cap for each ticker"""
    out = {}
    for page in (1, 2, 3):
        try:
            r = requests.get("https://api.coingecko.com/api/v3/coins/markets",
                             params={"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": page},
                             headers=UA, timeout=30)
            r.raise_for_status()
            for c in r.json():
                k = (c.get("symbol") or "").upper()
                if k and k not in out and c.get("image"):
                    out[k] = c["image"].replace("/small/", "/large/").replace("/thumb/", "/large/")
        except Exception as ex:  # noqa: BLE001
            print("coin_logos: coingecko page", page, ex)
        time.sleep(2.5)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = json.load(open(os.path.join(ROOT, "data", "meta.json"), encoding="utf-8"))
    coins = list((meta.get("by_coin") or {}).keys())
    have3d = {f[:-4] for f in os.listdir(HAS3D) if f.endswith(".png")}
    need = [k for k in coins if k not in have3d and not os.path.exists(os.path.join(OUT, k + ".png"))]
    if need:
        idx = gecko_index() if not os.environ.get("NO_NET") else {}
        for k in need:
            url = idx.get(k)
            small = os.path.join(ROOT, "data", "logos", k + ".png")      # the site's own 50 px copy (scripts/logos.py)
            if not url and not os.path.exists(small):
                print("coin_logos: no logo found for", k)
                continue
            try:
                if url:
                    r = requests.get(url, headers=UA, timeout=30)
                    r.raise_for_status()
                    logo = Image.open(io.BytesIO(r.content)).convert("RGBA")
                else:
                    logo = Image.open(small).convert("RGBA")
                coin_frame(logo, main_colour(logo)).save(os.path.join(OUT, k + ".png"), optimize=True)
                print("coin_logos: saved", k)
            except Exception as ex:  # noqa: BLE001
                print("coin_logos:", k, ex)
    have = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith(".png"))
    json.dump({"updated_at": datetime.now(timezone.utc).isoformat(), "coins": have},
              open(os.path.join(OUT, "index.json"), "w"), indent=1)
    missing = [k for k in coins if k not in have3d and k not in have]
    print(f"coin_logos: 3D {len(have3d)}, official {len(have)}, without a logo (kept off the wall): {missing}")


if __name__ == "__main__":
    sys.exit(main())
