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
from PIL import Image, ImageChops, ImageDraw, ImageFilter      # Pillow only: the CI has no numpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "coinlogo")
HAS3D = os.path.join(ROOT, "assets", "coin3d")
UA = {"User-Agent": "entekhab.net coin logos"}


def _vgrad(w, h, top, bottom):
    """vertical colour gradient image (RGBA)"""
    m = Image.linear_gradient("L").resize((w, h))
    return Image.composite(Image.new("RGBA", (w, h), bottom + (255,)), Image.new("RGBA", (w, h), top + (255,)), m)


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
    # face: radial light from the upper left
    rg = Image.radial_gradient("L").resize((int(R * 1.8), int(R * 1.8)))          # 0 centre -> 255 edge
    lightmask = Image.new("L", (W, W), 255)
    lightmask.paste(rg, (int(c - R * 0.18 - R * 0.9), int(c - R * 0.22 - R * 0.9)))
    face = Image.composite(Image.new("RGBA", (W, W), (14, 16, 18, 255)), Image.new("RGBA", (W, W), (66, 74, 76, 255)), lightmask)
    fm = Image.new("L", (W, W), 0)
    ImageDraw.Draw(fm).ellipse((c - R // 2, c - R // 2, c + R // 2, c + R // 2), fill=255)
    im.paste(face, (0, 0), fm)
    ring = Image.new("L", (W, W), 0)
    dr = ImageDraw.Draw(ring)
    dr.ellipse((c - R // 2, c - R // 2, c + R // 2, c + R // 2), fill=255)
    dr.ellipse((c - R // 2 + 9 * S, c - R // 2 + 9 * S, c + R // 2 - 9 * S, c + R // 2 - 9 * S), fill=0)
    rimimg = Image.new("RGBA", (W, W), rim + (255,))
    rimimg.paste(_vgrad(W, R, rim, tuple(int(v * 0.35) for v in rim)), (0, c - R // 2))
    im.paste(rimimg, (0, 0), ring)
    if white_glyph:
        m = logo.split()[3]
        m = m.crop(m.getbbox())
        gw = int(R * 0.46)
        gm = m.resize((gw, int(m.size[1] * gw / m.size[0])), Image.LANCZOS)
        art = _vgrad(gm.size[0], gm.size[1], (255, 255, 255), (200, 200, 200))
        art.putalpha(gm)
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
    px = [p for p in img.convert("RGBA").resize((48, 48)).getdata() if p[3] > 200]
    if not px:
        return (247, 147, 26)
    vivid = [p for p in px if max(p[:3]) - min(p[:3]) > 40]
    pick = vivid if len(vivid) > 20 else px
    n = len(pick)
    return tuple(int(sum(p[i] for p in pick) / n) for i in range(3))


ALIAS = {"MATIC": "POL"}          # renamed coins: the channel still says MATIC


def search_logo(sym):
    """CoinGecko search for tickers outside the top 750 (exact symbol, best ranked)"""
    if os.environ.get("NO_NET"):
        return None
    try:
        r = requests.get("https://api.coingecko.com/api/v3/search", params={"query": sym}, headers=UA, timeout=30)
        r.raise_for_status()
        hits = [c for c in r.json().get("coins", []) if (c.get("symbol") or "").upper() == sym and c.get("large")]
        hits.sort(key=lambda c: c.get("market_cap_rank") or 10 ** 9)
        time.sleep(2)
        return hits[0]["large"] if hits else None
    except Exception as ex:  # noqa: BLE001
        print("coin_logos: search", sym, ex)
        return None


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
            url = idx.get(ALIAS.get(k, k)) or search_logo(ALIAS.get(k, k))
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
