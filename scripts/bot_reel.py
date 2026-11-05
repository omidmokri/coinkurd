"""
Coin_Kurd short videos (vertical 720x1280, ~25s, MP4) made by the bot itself from a Persian summary and
real price data — so the channel posts its own downloadable clips instead of links to other people's videos.

make_reel(text, series=None, label="", hist=None, mk=None) -> mp4 bytes (1080×1350) or None
"""
import logging
import os
import re
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

log = logging.getLogger("reel")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets", "fonts", "Vazirmatn-Bold.ttf")
LOGO = os.path.join(ROOT, "assets", "logo-hero.webp")
W, H = 720, 1280
BG, FG, ACC, MUTED = (11, 14, 20), (240, 242, 246), (247, 147, 26), (150, 160, 175)
EMOJI = re.compile(r"[\U0001F000-\U0001FFFF☀-➿⬀-⯿️‍⃣]")

import infocard as IC   # shared Persian shaping + the Coin_Kurd infographic engine


def shape(s):
    """Persian text ready to draw (raqm or arabic_reshaper+python-bidi); raises IC.TextError if impossible"""
    return IC.shape(IC.clean(s) if IC.is_rtl(s) else s)


def font(size):
    return IC.font(size)


def wrap(text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if f.getlength(shape(t)) <= width or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def frame(title, lines, idx, total, series=None, label=""):
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 10], fill=ACC)
    d.rectangle([0, 10, int(W * idx / total), 18], fill=(90, 60, 20))
    try:
        lg = Image.open(LOGO).convert("RGBA")
        lg.thumbnail((260, 160))
        im.paste(lg, ((W - lg.width) // 2, 50), lg)
    except Exception:
        pass
    y = 240
    ft = font(46)
    for ln in wrap(title, ft, W - 90)[:3]:
        s = shape(ln)
        d.text((W - 45 - ft.getlength(s), y), s, font=ft, fill=ACC)
        y += 64
    y += 30
    fb = font(36)
    for para in lines:
        for ln in wrap(para, fb, W - 100)[:5]:
            if y > H - 260:
                break
            s = shape(ln)
            d.text((W - 50 - fb.getlength(s), y), s, font=fb, fill=FG)
            y += 54
        y += 22
    if series and len(series) > 5:
        top, bot, l, r = H - 470, H - 230, 50, W - 50
        if y < top - 10:
            lo, hi = min(series), max(series)
            pts = [(l + i * (r - l) / (len(series) - 1), bot - (v - lo) / ((hi - lo) or 1) * (bot - top))
                   for i, v in enumerate(series)]
            d.line(pts, fill=ACC, width=5)
            fs = font(28)
            for txt, yy in ((f"{hi:,.0f}", top - 36), (f"{lo:,.0f}", bot + 8)):
                d.text((l, yy), txt, font=fs, fill=MUTED)
            if label:
                s = shape(label)
                d.text((r - fs.getlength(s), top - 36), s, font=fs, fill=MUTED)
    fs = font(30)
    s = shape("کوین کورد") + "  ·  t.me/Coin_Kurd"
    d.text(((W - fs.getlength(s)) / 2, H - 110), s, font=fs, fill=MUTED)
    return im


def slides(text):
    """house-prompt summary -> [(title, [paragraphs])]"""
    raw = [EMOJI.sub("", x).strip(" -•🔹") for x in text.split("\n")]
    raw = [x.strip() for x in raw if x.strip() and not x.strip().startswith("#")]
    if not raw:
        return []
    title, rest = raw[0], raw[1:]
    heads = ("زمینه", "تمرکز", "پیامدها", "نتیجه‌گیری", "نتیجه گیری", "پاشخان", "ناوەڕۆک", "کاریگەری", "ئەنجام")
    groups, cur = [], None
    for x in rest:
        if x in heads or (len(x) < 14 and any(x.startswith(h) for h in heads)):
            cur = [x, []]
            groups.append(cur)
        elif cur:
            cur[1].append(x)
        else:
            cur = ["", [x]]
            groups.append(cur)
    out = [(title, [])]
    for h, ps in groups:
        if ps:
            out.append((h or title, ps[:3]))
    return out[:6]


def make_reel(text, series=None, label="", seconds=4, hist=None, mk=None):
    """house-prompt summary -> MP4 (1080×1350): slide 1 is the full infographic, then one slide per section,
    all in the same visual identity. None when the Persian text cannot be rendered correctly."""
    if not os.path.exists(FONT) or IC.mode() is None:
        log.warning("reel skipped: Persian shaping unavailable")
        return None
    content = IC.parse_summary(text)
    secs = [(h, ps) for h, ps in content.get("sections", []) if ps][:5]
    if not secs:
        return None
    theme = IC.pick_theme(hist)
    try:
        first = Image.open(__import__("io").BytesIO(IC.render(content, theme, mk=mk)))
        frames = [first] + [IC.slide(theme, content, h, ps, i + 2, len(secs) + 1) for i, (h, ps) in enumerate(secs)]
    except IC.TextError as ex:
        log.warning("reel skipped, Persian text check failed: %s", ex)
        return None
    with tempfile.TemporaryDirectory() as td:
        n = len(frames)
        for i, im in enumerate(frames):
            im.convert("RGB").save(f"{td}/f{i:02d}.png")
        lst = "".join(f"file 'f{i:02d}.png'\nduration {seconds + (2 if i == 0 else 0)}\n" for i in range(n)) + f"file 'f{n - 1:02d}.png'\n"
        open(f"{td}/l.txt", "w").write(lst)
        out = f"{td}/reel.mp4"
        total = n * seconds + 2
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{td}/l.txt",
               "-f", "lavfi", "-t", str(total), "-i", "anullsrc=r=44100:cl=stereo",
               "-vf", "fps=25,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
               "-c:a", "aac", "-shortest", "-movflags", "+faststart", out]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=240)
        if r.returncode != 0 or not os.path.exists(out):
            log.warning("ffmpeg failed: %s", r.stderr[-300:])
            return None
        return open(out, "rb").read()
