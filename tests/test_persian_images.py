"""
Guards for the 4 Nov 2026 picture bug (reversed / disconnected Persian letters) and the owner's image rules.

    python tests/test_persian_images.py

1. no file in scripts/ may shadow a pip package used for Persian shaping (bidi.py did, and broke every image)
2. shaping self-test passes and every Persian string is verified before drawing
3. the card is 1080×1350, contains the official logo pixel-for-pixel (only scaled down), and the channel name
   appears once (footer)
4. no environment repeats until all 20 were used; the colour system never repeats twice in a row
5. a reel renders slides in the same size
"""
import io
import json
import os
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
os.chdir(ROOT)

from PIL import Image  # noqa: E402

import infocard as IC  # noqa: E402

ok = True


def check(cond, name):
    global ok
    print(("PASS " if cond else "FAIL ") + name)
    ok &= bool(cond)


# 1. shadowing
shadow = {"bidi.py", "arabic_reshaper.py", "PIL.py", "requests.py", "fontTools.py"}
check(not shadow & set(os.listdir(os.path.join(ROOT, "scripts"))), "no module in scripts/ shadows a shaping package")

# 2. shaping
check(IC.mode() in ("raqm", "basic"), f"Persian shaper available ({IC.mode()})")
check(IC._selftest(), "joined-letter self-test")
check(IC.verify(IC.clean("سرقت ۱۳۳ میلیون دلاری از بانک غول‌پیکر")) == [], "verify() accepts correct Persian")
check(IC.clean("ارزش ۱.۶۱ تریلیون") == "ارزش ۱٫۶۱ تریلیون", "Persian decimal separator")

# 3. card
MK = {"rows": [{"sym": "BTC", "fa": "بیت‌کوین", "price": 80569.0, "chg": 5.77},
               {"sym": "ETH", "fa": "اتریوم", "price": 2429.0, "chg": -1.2},
               {"sym": "SOL", "fa": "سولانا", "price": 96.0, "chg": 6.0}],
      "series": [(80000 + i * 10, 80100 + i * 10, 79900 + i * 10, 80050 + i * 10) for i in range(48)],
      "at": datetime(2026, 11, 5, 5, 31, tzinfo=timezone.utc), "src": "test"}
post = json.load(open(os.path.join(ROOT, "data", "deep.json")))["items"][0]["fa"]
content = IC.parse_dossier(post)
check(content["title"] and content["hero"], "dossier parsed (title + hero number)")
theme = IC.pick_theme({}, seed=1)
jpg = IC.render(content, theme, mk=MK)
im = Image.open(io.BytesIO(jpg))
check(im.size == (1080, 1350), "card is 1080×1350")

# golden logo rule: opaque logo pixels in the card == the original file scaled down (nothing else changed)
lg = Image.open(IC.LOGO).convert("RGBA")
s = 150 / lg.height
lg = lg.resize((round(lg.width * s), 150), Image.LANCZOS)
bg = IC.background(theme)
IC._hud(theme, bg)
bg.alpha_composite(lg, (IC.M - 6, 34))
ref = bg.convert("RGB").crop((IC.M - 6, 34, IC.M - 6 + lg.width, 184))
got = im.convert("RGB").crop((IC.M - 6, 34, IC.M - 6 + lg.width, 184))
ra, ga = ref.tobytes(), got.tobytes()
diff = sum(abs(x - y) for x, y in zip(ra, ga)) / len(ra)
check(diff <= 3, f"logo pasted unchanged (mean JPEG difference {diff:.2f} of 255)")
names = [x for x in (content["title"], content["badge"], content["card_head"], *content["card"], *content["term"])
         if "کوین کورد" in x]
check(not names and IC.CHANNEL.count("کوین کورد") == 1, "channel name only in the footer")

# 4. uniqueness
hist = {}
envs = [IC.pick_theme(hist, seed=i)["env"] for i in range(20)]
check(len(set(envs)) == 20, "20 different environments before any repeat")
pals = hist["pals"]
check(all(a != b for a, b in zip(pals, pals[1:])), "colour system never repeats twice in a row")

# 5. refusal: without a shaper nothing is drawn
saved = IC._mode["v"]
IC._mode["v"] = None
try:
    IC.render(content, theme, mk=MK)
    check(False, "render refuses without Persian shaping")
except IC.TextError:
    check(True, "render refuses without Persian shaping")
IC._mode["v"] = saved

# 6. reel slide
sl = IC.slide(theme, IC.parse_summary("تیتر آزمایشی 🧐\n\nزمینه\n💡 یک خط زمینه\n\nتمرکز\n🔥 خط تمرکز\n\n#الف #ب #پ #ت"),
              "زمینه", ["یک خط زمینه"], 2, 3)
check(sl.size == (1080, 1350), "reel slide is 1080×1350")

print("ALL OK" if ok else "SOME CHECKS FAILED")
sys.exit(0 if ok else 1)
