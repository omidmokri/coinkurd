#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Photoreal backdrop for the channel cards, painted by the Gemini image model.

The owner's brief asks for a "Cyberpunk Financial Intelligence Dashboard" with cinematic depth,
3D volume and a fresh environment every time. A drawing library cannot reach that look — and an
image model cannot be trusted with Persian text, real prices or the brand logo. So the work splits:

  * the model paints the ENVIRONMENT ONLY — no text, no numbers, no charts, no logo, no people
  * scripts/infocard.py draws on top everything that has to be exact: the verified Persian
    typography, the live Binance figures and the pixel-perfect logo

That is the brief's own §7 ("if the model cannot render Persian, keep the text out of the image and
add it with a separate typography tool"), and it keeps §4 (no invented data) and §5 (the logo is
never redrawn) true by construction.

When the key is missing, the model is slow, the quota is spent or the answer is not an image, the
procedural scene in infocard.py is used instead and the post loses nothing.
"""
import hashlib
import io
import json
import logging
import os
import random
import time

import requests

log = logging.getLogger("aiart")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(os.environ.get("REALITY_DATA_DIR") or os.path.join(ROOT, "data"), "art")
BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODELS = ("gemini-3-pro-image-preview", "gemini-nano-banana-2.1", "gemini-2.5-flash-image")
W, H = 1080, 1350
TIMEOUT = int(os.environ.get("AIART_TIMEOUT", "90"))
DAILY = int(os.environ.get("AIART_DAILY", "40"))        # a hard ceiling so art can never eat the text quota
_dead = set()


def key():
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        return k
    g = os.environ.get("COIN_KURD_API_KEY", "").strip()
    return g if g.startswith(("AIza", "AQ.")) else ""


def available():
    return bool(key()) and os.environ.get("AIART", "1") != "0"


# ------------------------------------------------------------------ the brief, as the model sees it
PALETTE_WORDS = {
    "A": "electric cyan and hot magenta", "B": "magenta and deep violet",
    "C": "emerald green and cyan", "D": "warm gold and amber",
    "E": "violet and electric blue", "F": "electric blue and pale ice",
    "G": "crimson red and orange", "H": "lime green and teal",
}
SHOT = ("a low three-quarter hero angle", "a wide establishing angle", "a slight top-down angle",
        "a centred one-point perspective", "a long lens looking down a corridor of light")

NEGATIVE = ("Absolutely no writing of any kind: no letters, no words, no numbers, no digits, no captions, "
            "no labels, no logos, no watermark, no signage, no user interface text, no charts with values, "
            "no tickers, no price readouts. No people, no faces, no hands. "
            "Leave the upper quarter and the lower sixth of the frame calm, dark and uncluttered.")


def prompt(env, pal, seed):
    rnd = random.Random(seed)
    return (
        f"Ultra premium cinematic 3D render, 8K quality, vertical 4:5 composition. "
        f"Subject: the interior of a {env} — a cyberpunk financial-intelligence environment. "
        f"Neon colour system: {PALETTE_WORDS.get(pal, 'electric cyan and magenta')}, on a near-black background. "
        f"Camera: {rnd.choice(SHOT)}, with real depth of field and volumetric haze. "
        f"Glassmorphism surfaces, holographic light panels with no readable content, blockchain lattice, "
        f"floating digital particles, reflective wet floor, rim lighting and cinematic bloom. "
        f"Rich in the middle of the frame, quiet at the top and bottom so an overlay can sit there. "
        f"{NEGATIVE}")


# ------------------------------------------------------------------ budget
def _budget_path():
    return os.path.join(CACHE, "budget.json")


def _take_budget():
    """one slot per picture per day; the counter lives beside the cache so a restart cannot reset it"""
    today = time.strftime("%Y-%m-%d", time.gmtime())
    try:
        os.makedirs(CACHE, exist_ok=True)
        b = {}
        if os.path.exists(_budget_path()):
            b = json.load(open(_budget_path(), encoding="utf-8"))
        if b.get("day") != today:
            b = {"day": today, "n": 0}
        if b["n"] >= DAILY:
            return False
        b["n"] += 1
        json.dump(b, open(_budget_path(), "w", encoding="utf-8"))
        return True
    except Exception:                                   # a broken counter must not stop the post
        log.info("art budget unreadable; letting this one through")
        return True


# ------------------------------------------------------------------ the call
def _ask(model, text):
    r = requests.post(
        f"{BASE}/{model}:generateContent",
        headers={"x-goog-api-key": key(), "Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": text}]}],
              "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "4:5"}}},
        timeout=TIMEOUT)
    if r.status_code in (400, 404):                     # wrong model name or no image support on this key
        raise LookupError(f"{model}: {r.status_code} {r.text[:160]}")
    r.raise_for_status()
    for p in (r.json().get("candidates") or [{}])[0].get("content", {}).get("parts", []):
        d = p.get("inlineData") or p.get("inline_data")
        if d and d.get("data"):
            import base64
            return base64.b64decode(d["data"])
    raise ValueError(f"{model}: no image part in the answer")


def _fit(raw):
    """whatever came back becomes exactly 1080×1350, cropped from the centre"""
    from PIL import Image
    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    sw, sh = im.size
    s = max(W / sw, H / sh)
    im = im.resize((max(W, int(sw * s + 0.5)), max(H, int(sh * s + 0.5))), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def scene(t):
    """theme dict → a 1080×1350 RGBA backdrop, or None to fall back to the drawn scene"""
    if not available():
        return None
    env, pal, seed = t.get("env", ""), t.get("pal", "A"), t.get("seed", 0)
    cid = hashlib.sha256(f"{env}|{pal}|{seed}".encode()).hexdigest()[:16]
    path = os.path.join(CACHE, cid + ".jpg")
    if os.path.exists(path):                            # the slides of one post share a theme, so one picture
        try:
            from PIL import Image
            return Image.open(path).convert("RGBA")
        except Exception:
            os.remove(path)
    if not _take_budget():
        log.info("art budget for today is spent; drawing the scene instead")
        return None
    text = prompt(env, pal, seed)
    for m in MODELS:
        if m in _dead:
            continue
        try:
            im = _fit(_ask(m, text))
            os.makedirs(CACHE, exist_ok=True)
            im.convert("RGB").save(path, "JPEG", quality=92, optimize=True)
            log.info("backdrop painted by %s for %s/%s", m, env, pal)
            return im
        except LookupError as ex:
            log.info("%s unavailable (%s); trying the next model", m, ex)
            _dead.add(m)
        except Exception as ex:
            log.warning("backdrop failed on %s: %s", m, ex)
            break
    return None


if __name__ == "__main__":                              # python scripts/aiart.py "Neo Tokyo Megacity" A 7
    import sys
    logging.basicConfig(level=logging.INFO)
    th = {"env": sys.argv[1] if len(sys.argv) > 1 else "Neo Tokyo Megacity",
          "pal": sys.argv[2] if len(sys.argv) > 2 else "A",
          "seed": int(sys.argv[3]) if len(sys.argv) > 3 else 1}
    print("key:", "yes" if key() else "no")
    print("prompt:\n", prompt(th["env"], th["pal"], th["seed"]))
    im = scene(th)
    print("result:", im.size if im else "none — the drawn scene will be used")
