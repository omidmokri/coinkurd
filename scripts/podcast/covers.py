"""Episode covers per language, rendered from HTML with headless Chrome (real text shaping for
Persian and Arabic). Brand: the owner's own artwork (coin, logo), black and Bitcoin orange.

  cover_<lang>.jpg   1400x1400 (podcast apps' minimum; the site's coin art is 512 px, so no upscaling)
  thumb_<lang>.jpg   320x320, < 200 KB (Telegram audio thumbnail)
  social_<lang>.jpg  1200x630 (link previews, Open Graph)
The "pulse" line is Bitcoin's real daily close for the last 30 days, not decoration.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image

FONTS = os.environ.get("PODCAST_FONTS", "/home/claude/fonts")
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")


def b64(path):
    if path.endswith(".woff2") or path.endswith(".png"):
        return base64.b64encode(open(path, "rb").read()).decode()
    import io                      # any other picture (the site keeps WebP) goes in as PNG
    buf = io.BytesIO()
    Image.open(path).save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def brand_file(brand, stem):
    for ext in (".png", ".webp"):
        if os.path.exists(os.path.join(brand, stem + ext)):
            return os.path.join(brand, stem + ext)
    raise FileNotFoundError(stem)


def font_css():
    f = {
        "Vazirmatn": [("vazirmatn-arabic-400-normal", 400), ("vazirmatn-arabic-800-normal", 800), ("vazirmatn-arabic-900-normal", 900),
                      ("vazirmatn-latin-400-normal", 400), ("vazirmatn-latin-800-normal", 800), ("vazirmatn-latin-900-normal", 900)],
        "Space Grotesk": [("space-grotesk-latin-400-normal", 400), ("space-grotesk-latin-700-normal", 700),
                          ("space-grotesk-latin-ext-400-normal", 400), ("space-grotesk-latin-ext-700-normal", 700)],
        "Archivo Black": [("archivo-black-latin-400-normal", 400), ("archivo-black-latin-ext-400-normal", 400)],
    }
    pkg = {"Vazirmatn": "fontsource-vazirmatn-5.3.0", "Space Grotesk": "fontsource-space-grotesk-5.3.0", "Archivo Black": "fontsource-archivo-black-5.3.0"}
    css = []
    for fam, files in f.items():
        for name, w in files:
            p = os.path.join(FONTS, pkg[fam], "package", "files", name + ".woff2")
            css.append(f"@font-face{{font-family:'{fam}';src:url(data:font/woff2;base64,{b64(p)}) format('woff2');font-weight:{w};}}")
    return "\n".join(css)


def pulse_path(closes, w, h):
    lo, hi = min(closes), max(closes)
    pts = [(i / (len(closes) - 1) * w, h - (c - lo) / (hi - lo or 1) * h) for i, c in enumerate(closes)]
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)


TXT = {
    "fa": dict(dir="rtl", font="Vazirmatn", show="نبض کریپتو", sub="گزارش روزانه بازار و فرصت‌های معاملاتی", badge="فارسی"),
    "ar": dict(dir="rtl", font="Vazirmatn", show="نبض الكريبتو", sub="التقرير اليومي للسوق وفرص التداول", badge="العربية"),
    "ckb": dict(dir="rtl", font="Vazirmatn", show="نەبزی کریپتۆ", sub="ڕاپۆرتی ڕۆژانەی بازاڕ و دەرفەتەکانی مامەڵە", badge="کوردی"),
    "tr": dict(dir="ltr", font="Space Grotesk", show="Kripto Nabız", sub="Günlük piyasa raporu ve işlem fırsatları", badge="Türkçe"),
    "en": dict(dir="ltr", font="Space Grotesk", show="Crypto Intelligence Daily", sub="The daily pulse of the crypto market", badge="English"),
}


def html(lang, sc, w, h, kind, assets, closes, stat):
    t = TXT[lang]
    rtl = t["dir"] == "rtl"
    big = kind == "cover"
    pw, ph = (w * 0.86, h * 0.12) if big else (w * 0.5, h * 0.28)
    path = pulse_path(closes, pw, ph)
    title_size = (150 if len(t["show"]) < 16 else 112) if big else 64
    ep_title = sc.get("display", {}).get("title", sc["title"])
    return f"""<!doctype html><html lang="{lang}" dir="{t['dir']}"><head><meta charset="utf-8"><style>
{assets['fonts']}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{w}px;height:{h}px;background:#000;overflow:hidden}}
body{{font-family:'{t['font']}','Vazirmatn',sans-serif;color:#fff;position:relative}}
.glow{{position:absolute;inset:0;background:radial-gradient(circle at {'50% 38%' if big else ('22% 50%' if not rtl else '78% 50%')}, rgba(247,147,26,.30), rgba(247,147,26,.06) 32%, transparent 60%)}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:{w//14}px {w//14}px}}
.coin{{position:absolute;width:{int(w*0.33) if big else int(h*0.62)}px;{'left:50%;top:9%;transform:translateX(-50%)' if big else (('right' if rtl else 'left')+':6%;top:50%;transform:translateY(-50%)')};filter:drop-shadow(0 0 60px rgba(247,147,26,.45))}}
.pulse{{position:absolute;left:7%;top:42%;{'' if big else 'display:none'}}}
.plabel{{position:absolute;left:7%;top:39%;font-family:'Space Grotesk';font-size:26px;color:#8a8a93;letter-spacing:2px;direction:ltr;{'' if big else 'display:none'}}}
.txt{{position:absolute;{'left:7%;right:7%;bottom:7%' if big else (('left:5%;right:40%' if rtl else 'left:40%;right:5%')+';bottom:9%')};text-align:{'right' if rtl else 'left'}}}
.badge{{display:inline-block;background:#f7931a;color:#000;font-weight:800;border-radius:999px;padding:{'14px 34px' if big else '6px 18px'};font-size:{38 if big else 22}px;margin-bottom:{26 if big else 14}px}}
.show{{font-family:{"'Vazirmatn'" if rtl else "'Archivo Black'"};font-weight:900;font-size:{title_size}px;line-height:1.05;letter-spacing:{'0' if rtl else '-1px'}}}
.show b{{color:#f7931a;font-weight:inherit}}
.sub{{font-size:{46 if big else 24}px;color:#d8d8de;margin-top:{18 if big else 8}px;font-weight:400}}
.ep{{font-size:{40 if big else 24}px;color:#f7931a;margin-top:{30 if big else 12}px;font-weight:800}}
.eptitle{{font-size:28px;color:#fff;margin-top:10px;line-height:1.35;font-weight:600}}
.foot{{position:absolute;{'left:7%;right:7%;top:5%' if big else (('left:5%;right:40%' if rtl else 'left:40%;right:5%')+';top:7%')};display:flex;justify-content:space-between;align-items:center;font-family:'Space Grotesk';font-size:{30 if big else 20}px;color:#9a9aa3;direction:ltr}}
.foot img{{height:{86 if big else 54}px}}
.stat{{font-family:'Space Grotesk';font-weight:700;color:#fff;font-size:{34 if big else 20}px;direction:ltr;margin-top:{14 if big else 8}px;opacity:.9}}
.stat span{{color:#f7931a}}
</style></head><body><div class="grid"></div><div class="glow"></div>
<img class="coin" src="data:image/png;base64,{assets['coin']}">
<div class="plabel">BTC · 30D</div><svg class="pulse" width="{pw:.0f}" height="{ph:.0f}" viewBox="0 0 {pw:.0f} {ph:.0f}"><path d="{path}" fill="none" stroke="#f7931a" stroke-width="{6 if big else 4}" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/></svg>
<div class="foot"><span>entekhab.net · t.me/Coin_Kurd</span><img src="data:image/png;base64,{assets['logo']}"></div>
<div class="txt"><div class="badge">{t['badge']}</div>
<div class="show">{t['show']}</div><div class="sub">{t['sub']}</div>
<div class="ep">{sc['episode_label']} · {sc['date_label']}</div>
{'' if big else f'<div class="eptitle">{ep_title}</div>'}
<div class="stat">BTC <span>${stat['btc']:,.0f}</span> · Fear &amp; Greed <span>{stat['fng']}</span></div></div>
</body></html>"""


def shot(doc, w, h, out_png):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(doc); p = f.name
    subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    f"--window-size={w},{h}", f"--screenshot={out_png}", "--virtual-time-budget=3000", "file://" + p],
                   check=True, capture_output=True)
    os.remove(p)


def make(ep, repo, brand, langs=("fa", "ckb", "en", "ar")):
    facts = json.load(open(os.path.join(ep, "facts.json")))["facts"]
    d = json.load(open(os.path.join(repo, "data", "candles", "BTC_1d.json")))["s"]["BTC"]["1d"]
    closes = [r[4] for r in d[-30:]]
    assets = {"fonts": font_css(), "coin": b64(brand_file(brand, "coin-front")), "logo": b64(brand_file(brand, "logo-hero"))}
    note = {"fa": "۳۰ روز اخیر", "ckb": "٣٠ ڕۆژی ڕابردوو", "ar": "آخر 30 يوماً", "tr": "son 30 gün", "en": "last 30 days"}
    out = {}
    for lang in langs:
        sc = json.load(open(os.path.join(ep, f"script_{lang}.json"), encoding="utf-8"))
        stat = {"btc": facts["BTC.price"]["value"], "fng": facts["fng"]["value"], "note": note[lang]}
        png = os.path.join(ep, f".cover_{lang}.png")
        shot(html(lang, sc, 1400, 1400, "cover", assets, closes, stat), 1400, 1400, png)
        im = Image.open(png).convert("RGB")
        im.save(os.path.join(ep, f"cover_{lang}.jpg"), quality=90, optimize=True, progressive=True)
        im.resize((320, 320), Image.LANCZOS).save(os.path.join(ep, f"thumb_{lang}.jpg"), quality=86, optimize=True)
        os.remove(png)
        png = os.path.join(ep, f".social_{lang}.png")
        shot(html(lang, sc, 1200, 630, "social", assets, closes, stat), 1200, 630, png)
        Image.open(png).convert("RGB").save(os.path.join(ep, f"social_{lang}.jpg"), quality=88, optimize=True, progressive=True)
        os.remove(png)
        out[lang] = [f"cover_{lang}.jpg", f"thumb_{lang}.jpg", f"social_{lang}.jpg"]
    return out


if __name__ == "__main__":
    print(make(sys.argv[1], sys.argv[2], sys.argv[3]))
