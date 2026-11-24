"""Build the Coin_Kurd animated sticker packs from the two brand sheets.

The sheets in assets/stickers/src hold the Coin_Kurd robot in every pose the channel needs.  This
cuts each pose out with its own transparency, gives it motion that matches what it shows -- the
eyes really blink, a crash really shakes -- and writes a Telegram video sticker per pose:
512x512 VP9 with alpha, 2s at 30fps, under the 256KB the platform allows.

    python scripts/sticker_build.py <out-dir>

leaves the .webm files and an index.json of emoji next to them.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "stickers", "src")
S = 512
FPS = 30
FRAMES = 60
LIMIT = 256 * 1024

# the sheets are dense collages, so the cuts below were measured once on them
S1_ROWS, S1_COLS = 8, 8


def ease(t):
    return 0.5 - 0.5 * math.cos(2 * math.pi * t)


# ---------------------------------------------------------------- cutting out
def _cuts(prof, n, L, win=42):
    out = [0]
    for k in range(1, n):
        c = int(k * L / n)
        lo, hi = max(1, c - win), min(L - 1, c + win)
        out.append(lo + int(np.argmin(prof[lo:hi])))
    out.append(L)
    return out


def _square(arr, pad=0.06):
    h, w = arr.shape[:2]
    p = int(max(h, w) * pad)
    arr = np.pad(arr, ((p, p), (p, p), (0, 0)))
    h, w = arr.shape[:2]
    s = max(h, w)
    cv = np.zeros((s, s, 4), np.float32)
    cv[(s - h) // 2:(s - h) // 2 + h, (s - w) // 2:(s - w) // 2 + w] = arr
    return Image.fromarray(np.clip(cv, 0, 255).astype(np.uint8), "RGBA").resize((S, S), Image.LANCZOS)


def cut_sheet1(path):
    """Sheet 1 sits on black and its glows overlap, so each cell claims its own area by watershed."""
    a = np.array(Image.open(path).convert("RGB")).astype(np.float32)
    mx = a.max(axis=2)
    core, soft = mx > 100, mx > 20
    H, W = core.shape
    rc = _cuts(ndimage.uniform_filter1d(core.sum(axis=1).astype(float), 5), S1_ROWS, H)
    seeds = np.zeros((H, W), int)
    meta = {}
    k = 0
    for r in range(S1_ROWS):
        y0, y1 = rc[r], rc[r + 1]
        cc = _cuts(ndimage.uniform_filter1d(core[y0:y1].sum(axis=0).astype(float), 5), S1_COLS, W)
        for c in range(S1_COLS):
            x0, x1 = cc[c], cc[c + 1]
            box = np.zeros((H, W), bool)
            box[y0:y1, x0:x1] = True
            s = box & core
            if s.sum() < 120:
                s = box
            k += 1
            seeds[s] = k
            meta[k] = "s1_r%dc%d" % (r, c)
    ind = ndimage.distance_transform_edt(seeds == 0, return_distances=False, return_indices=True)
    own = np.where(soft, seeds[tuple(ind)], 0)
    out = {}
    for i, name in meta.items():
        sel = own == i
        if sel.sum() < 900:
            continue
        ys, xs = np.where(sel)
        sub = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        sub[~sel[ys.min():ys.max() + 1, xs.min():xs.max() + 1]] = 0
        m = sub.max(axis=2)
        al = np.clip((m / 95.0 - 0.05) / 0.95, 0, 1)        # black backing means glow is the alpha
        rgb = np.where(al[..., None] > 0.02, sub / np.maximum(al[..., None], 0.02), 0)
        out[name] = _square(np.concatenate([np.clip(rgb, 0, 255), (al * 255)[..., None]], axis=2))
    return out


def cut_sheet2(path):
    """Sheet 2 already carries alpha and its die-cut borders separate cleanly."""
    b = np.array(Image.open(path)).astype(np.float32)
    m = ndimage.binary_closing(b[:, :, 3] > 60, np.ones((7, 7)))
    lab, n = ndimage.label(m)
    sz = ndimage.sum(m, lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    items = sorted(((objs[i][0].start, objs[i][1].start, i + 1) for i, s in enumerate(sz) if s > 2600),
                   key=lambda t: (round(t[0] / 60), t[1]))
    out = {}
    for k, (_, _, i) in enumerate(items):
        sl = objs[i - 1]
        sub = b[sl].copy()
        sub[:, :, 3] *= ndimage.binary_dilation(lab[sl] == i, np.ones((5, 5)))
        out["s2_%03d" % k] = _square(sub)
    return out


# ---------------------------------------------------------------- motion
def eye_boxes(im):
    """The visor eyes: cyan, paired, side by side. Found once so the robot can blink."""
    a = np.array(im).astype(int)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    m = ndimage.binary_opening((al > 120) & (b > 150) & (g > 120) & (r < 120) & (b - r > 70), np.ones((3, 3)))
    lab, n = ndimage.label(m)
    out = []
    for sl in ndimage.find_objects(lab):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 8 <= h <= 90 and 8 <= w <= 90 and 0.35 <= w / h <= 3.0 and (lab[sl] > 0).sum() > 60:
            out.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop))
    out.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    out = out[:2]
    if len(out) == 2:
        (x0, y0, x1, y1), (X0, Y0, X1, Y1) = out
        if abs((y0 + y1) / 2 - (Y0 + Y1) / 2) > 0.6 * max(y1 - y0, Y1 - Y0):
            out = out[:1]                                   # not a pair, so only one is an eye
    return out


def blink(im, boxes, k):
    """k runs 0 (open) to 1 (shut); the eye squashes onto visor colour taken from just outside it."""
    if k <= 0.02 or not boxes:
        return im
    out = im.copy()
    src = np.array(im)
    for (x0, y0, x1, y1) in boxes:
        p, q = max(2, int((x1 - x0) * 0.12)), max(2, int((y1 - y0) * 0.12))
        X0, Y0, X1, Y1 = max(0, x0 - p), max(0, y0 - q), min(S, x1 + p), min(S, y1 + q)
        w, h = X1 - X0, Y1 - Y0
        if w < 4 or h < 4:
            continue
        patch = im.crop((X0, Y0, X1, Y1))
        rows = np.concatenate([src[max(0, Y0 - q):Y0, X0:X1], src[Y1:min(S, Y1 + q), X0:X1]], axis=0)
        if len(rows) == 0:
            continue
        bg = np.tile(np.median(rows.reshape(-1, 4), axis=0), (h, w, 1)).astype(np.uint8)
        bg[..., 3] = np.array(patch)[..., 3]
        lid = Image.fromarray(bg, "RGBA")
        nh = max(2, int(h * (1 - 0.86 * k)))
        sq = patch.resize((w, nh), Image.LANCZOS)
        lid.paste(sq, (0, (h - nh) // 2), sq)
        out.paste(lid, (X0, Y0))
    return out


def xform(im, sx=1.0, sy=1.0, rot=0.0, dx=0, dy=0):
    t = im.resize((max(8, int(S * sx)), max(8, int(S * sy))), Image.LANCZOS)
    if abs(rot) > 0.05:
        t = t.rotate(rot, Image.BICUBIC, expand=True)
    c = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    c.paste(t, (int((S - t.width) / 2 + dx), int((S - t.height) / 2 + dy)), t)
    return c


def glow(im, colour, amt):
    if amt <= 0.01:
        return im
    al = np.array(im)[..., 3].astype(np.float32) / 255.0
    g = Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))
    layer = Image.new("RGBA", (S, S), colour + (0,))
    layer.putalpha(g.point(lambda v: int(v * amt)))
    return Image.alpha_composite(layer, im)


def ring(im, t, colour):
    o = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(o)
    ph = t % 1.0
    r, a = int(120 + 150 * ph), int(190 * (1 - ph))
    d.ellipse([256 - r, 256 - r, 256 + r, 256 + r], outline=colour + (a,), width=max(2, int(10 * (1 - ph))))
    return Image.alpha_composite(im, o)


def sweep(im, t):
    """A highlight travelling across the metal, for the gold logo."""
    a = np.array(im).astype(np.float32)
    x = np.arange(S)[None, :]
    band = np.repeat(np.exp(-((x - (t * 1.6 - 0.3) * S) ** 2) / (2 * 70.0 ** 2)), S, axis=0)
    a[..., :3] = np.clip(a[..., :3] + band[..., None] * 110, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


_FONT = {}


def _font(sz):
    if sz not in _FONT:
        for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"):
            if os.path.exists(p):
                _FONT[sz] = ImageFont.truetype(p, sz)
                break
        else:
            _FONT[sz] = ImageFont.load_default()
    return _FONT[sz]


def particles(im, t, kind):
    d = ImageDraw.Draw(im)
    rng = np.random.RandomState(7)
    if kind == "confetti":
        for i in range(26):
            x, ph = rng.randint(40, 472), (t + rng.rand()) % 1.0
            y, s = int(40 + ph * 430), rng.randint(5, 11)
            col = [(255, 210, 60), (60, 220, 255), (255, 90, 140), (130, 255, 130)][i % 4]
            d.rectangle([x, y, x + s, y + int(s * 1.5)], fill=col + (int(235 * (1 - ph)),))
    elif kind == "sparkle":
        for _ in range(16):
            ph = (t * 1.4 + rng.rand()) % 1.0
            x, y = rng.randint(50, 462), int(470 - ph * 400)
            r, a = int(3 + 4 * math.sin(math.pi * ph)), int(255 * math.sin(math.pi * ph))
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 228, 120, a))
    elif kind == "tear":
        for _ in range(7):
            ph = (t * 1.3 + rng.rand()) % 1.0
            x, y = rng.randint(150, 362), int(230 + ph * 230)
            r, a = int(5 - 2 * ph), int(240 * (1 - ph))
            d.ellipse([x - r, y - r * 2, x + r, y + r * 2], fill=(120, 210, 255, a))
    elif kind == "zzz":
        for i in range(3):
            ph = (t + i / 3.0) % 1.0
            d.text((int(330 + ph * 60), int(190 - ph * 120)), "Z",
                   fill=(170, 225, 255, int(255 * (1 - ph))), font=_font(int(30 + 22 * ph)))
    elif kind in ("up", "down"):
        for i in range(10):
            ph = (t * 1.6 + i / 10.0) % 1.0
            x = 40 + i * 44
            a = int(200 * math.sin(math.pi * ph))
            if kind == "up":
                y = int(480 - ph * 440)
                d.polygon([(x, y), (x - 9, y + 16), (x + 9, y + 16)], fill=(80, 255, 140, a))
            else:
                y = int(30 + ph * 440)
                d.polygon([(x, y), (x - 9, y - 16), (x + 9, y - 16)], fill=(255, 80, 90, a))
    return im


def frames(base, preset):
    eb = eye_boxes(base)
    out = []
    for i in range(FRAMES):
        t = i / FRAMES
        im = base
        sx = sy = 1.0
        rot = dx = dy = 0
        part = gl = rng = None
        sw = False
        bl = 0.0
        if eb:                                              # every robot blinks once a loop
            w = 0.055
            dd = abs(((t - 0.72 + 0.5) % 1.0) - 0.5)
            if dd < w:
                bl = math.sin(math.pi * (1 - dd / w)) ** 0.6
        p = preset
        if p == "breathe":
            s = 1 + 0.035 * ease(t); sx = sy = s; dy = int(-6 * ease(t))
        elif p == "bounce":
            dy = int(-34 * abs(math.sin(math.pi * t))); sy = 1 - 0.05 * abs(math.sin(2 * math.pi * t)); sx = 2 - sy
        elif p == "laugh":
            k = abs(math.sin(2 * math.pi * t)); sy = 1 + 0.09 * k; sx = 1 - 0.06 * k
            rot = 7 * math.sin(4 * math.pi * t); dy = int(-14 * k)
        elif p == "cry":
            dy = int(10 * ease(t)); rot = 2.5 * math.sin(8 * math.pi * t); part = "tear"; sy = 1 - 0.03 * ease(t)
        elif p == "cheer":
            k = ease(t); sx = sy = 1 + 0.09 * k; dy = int(-26 * k); part = "confetti"; gl = ((255, 215, 90), 0.30 * k)
        elif p == "dance":
            rot = 11 * math.sin(2 * math.pi * t); dy = int(-20 * abs(math.sin(2 * math.pi * t)))
            sx = 1 + 0.03 * math.sin(2 * math.pi * t)
        elif p == "surprise":
            k = ease(t); sx = sy = 1 + 0.13 * k; dx = int(7 * math.sin(14 * math.pi * t) * k)
            bl = 0.0; gl = ((120, 220, 255), 0.30 * k)      # eyes stay wide open in shock
        elif p == "sleepy":
            dy = int(9 * ease(t)); sy = 1 - 0.03 * ease(t); part = "zzz"
            bl = max(bl, 0.55 + 0.45 * math.sin(2 * math.pi * t))
        elif p == "pump":
            dy = int(-26 * ease(t)); sx = sy = 1 + 0.04 * ease(t); part = "up"; gl = ((70, 255, 150), 0.34 * ease(t))
        elif p == "dump":
            dy = int(24 * ease(t)); rot = 3 * math.sin(10 * math.pi * t); part = "down"
            gl = ((255, 70, 80), 0.34 * ease(t))
        elif p == "buy":
            k = ease(t); sx = sy = 1 + 0.08 * k; gl = ((60, 235, 120), 0.45 * k); rng = (70, 245, 130)
        elif p == "sell":
            k = ease(t); sx = sy = 1 + 0.08 * k; gl = ((255, 70, 80), 0.45 * k); rng = (255, 80, 90)
        elif p == "shake":
            dx = int(11 * math.sin(12 * math.pi * t)); rot = 3.5 * math.sin(12 * math.pi * t)
        elif p == "float":
            dx = int(13 * math.sin(2 * math.pi * t)); dy = int(-13 * math.cos(2 * math.pi * t))
            rot = 3 * math.sin(2 * math.pi * t)
        elif p == "spin":
            sx = max(0.12, abs(math.cos(2 * math.pi * t)))
        elif p == "shimmer":
            sw = True; sx = sy = 1 + 0.02 * ease(t)
        elif p == "pulse":
            k = ease(t); gl = ((80, 200, 255), 0.5 * k); sx = sy = 1 + 0.045 * k
        elif p == "sparkle":
            part = "sparkle"; sx = sy = 1 + 0.03 * ease(t); gl = ((255, 225, 120), 0.25 * ease(t))
        elif p == "pop":
            k = ease(t); sx = sy = 1 + 0.10 * k; rot = 4 * math.sin(4 * math.pi * t)
        if bl > 0:
            im = blink(im, eb, bl)
        if sw:
            im = sweep(im, t)
        im = xform(im, sx * 0.93, sy * 0.93, rot, dx, dy)   # 0.93 keeps the motion inside the frame
        if gl:
            im = glow(im, gl[0], gl[1])
        if rng:
            im = ring(im, t, rng)
        if part:
            im = particles(im, t, part)
        out.append(im)
    return out


def encode(fr, dst):
    """VP9 with a real alpha channel; the quality drops only as far as the 256KB cap demands."""
    with tempfile.TemporaryDirectory() as td:
        for i, f in enumerate(fr):
            f.save("%s/f%03d.png" % (td, i))
        for crf in (36, 42, 48, 54):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
                            "-i", "%s/f%%03d.png" % td, "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                            "-b:v", "0", "-crf", str(crf), "-auto-alt-ref", "0", "-an",
                            "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", dst], check=True)
            if os.path.getsize(dst) <= LIMIT:
                return os.path.getsize(dst)
        return os.path.getsize(dst)


# (cut-out, motion, emoji, what it says) -- the order here is the order of the packs
PLAN = [
    ("s1_r0c1", "cheer", "👍", "عالیه"),
    ("s1_r0c2", "pulse", "❤️", "عاشقشم"),
    ("s1_r0c7", "surprise", "❓", "سؤال"),
    ("s1_r1c4", "breathe", "☕", "ریلکس"),
    ("s1_r1c5", "cry", "😭", "گریه"),
    ("s1_r1c7", "shake", "📢", "اعلان"),
    ("s1_r2c0", "pulse", "🔥", "داغ"),
    ("s1_r2c1", "breathe", "😎", "خونسرد"),
    ("s1_r2c2", "sleepy", "😴", "خواب‌آلود"),
    ("s1_r2c3", "pop", "✅", "تأیید"),
    ("s1_r2c4", "shake", "❌", "رد"),
    ("s1_r2c5", "sparkle", "💡", "ایده"),
    ("s1_r2c6", "cheer", "🏆", "قهرمان"),
    ("s1_r2c7", "cheer", "🥇", "جشن"),
    ("s1_r3c4", "shimmer", "👑", "پادشاه"),
    ("s1_r3c5", "pulse", "🧘", "آرامش"),
    ("s1_r3c7", "shake", "🤦", "فیسپالم"),
    ("s1_r4c5", "pulse", "💖", "قلب"),
    ("s1_r5c1", "float", "🦸", "ابرقهرمان"),
    ("s1_r5c2", "bounce", "💪", "قدرت"),
    ("s1_r5c3", "breathe", "🕴️", "حرفه‌ای"),
    ("s1_r7c0", "bounce", "🍿", "تماشاگر"),
    ("s1_r7c1", "laugh", "😂", "خنده"),
    ("s1_r7c2", "pulse", "😍", "عاشق"),
    ("s1_r7c3", "breathe", "♟️", "استراتژی"),
    ("s1_r7c4", "dance", "🏴‍☠️", "دزد دریایی"),
    ("s1_r7c5", "pop", "💎", "HODL"),
    ("s1_r7c6", "dance", "🎉", "رقص"),
    ("s2_009", "shake", "🚨", "هشدار"),
    ("s2_028", "shake", "🔔", "زنگ"),
    ("s2_034", "shake", "⚠️", "خطر"),
    ("s2_047", "bounce", "🎮", "بازی"),
    ("s2_048", "cheer", "🏅", "مدال"),
    ("s2_067", "sparkle", "✨", "جادو"),
    ("s2_069", "bounce", "💬", "پیام"),
    ("s2_071", "bounce", "💭", "گفتگو"),
    ("s2_074", "cheer", "🎓", "آموزش"),
    ("s2_091", "float", "🥷", "ناشناس"),
    ("s2_095", "bounce", "🎁", "هدیه"),
    ("s1_r3c0", "sell", "🔴", "SELL"),
    ("s1_r3c1", "buy", "🟢", "BUY"),
    ("s1_r0c6", "pump", "📈", "صعود"),
    ("s1_r1c1", "cheer", "🚀", "بریم بالا"),
    ("s1_r1c2", "pump", "💻", "تحلیل"),
    ("s1_r3c2", "pump", "📊", "رشد"),
    ("s1_r3c6", "dump", "📉", "ریزش"),
    ("s1_r0c5", "shake", "🐂", "گاو و خرس"),
    ("s1_r4c2", "float", "📜", "گزارش"),
    ("s1_r4c3", "pop", "🎯", "هدف"),
    ("s1_r4c4", "float", "🔭", "رصد"),
    ("s1_r5c0", "pump", "🚀", "موشک"),
    ("s1_r6c1", "pump", "📈", "روند صعودی"),
    ("s1_r6c2", "pulse", "🕯️", "کندل"),
    ("s2_003", "pump", "📈", "نمودار صعودی"),
    ("s2_004", "pulse", "🕯️", "کندل‌ها"),
    ("s2_005", "pump", "🐂", "بازار گاوی"),
    ("s2_006", "dump", "🐻", "بازار خرسی"),
    ("s2_007", "pulse", "📊", "تحلیل"),
    ("s2_010", "pump", "📈", "روند"),
    ("s2_011", "pulse", "📊", "حجم"),
    ("s2_012", "pump", "📶", "رشد"),
    ("s2_013", "pulse", "🖥️", "تابلو"),
    ("s2_014", "float", "↕️", "نوسان"),
    ("s2_017", "pop", "🎚️", "RSI"),
    ("s2_019", "pump", "⬆️", "خرید"),
    ("s2_021", "pop", "🌡️", "شاخص ترس"),
    ("s2_022", "pop", "🎛️", "احساسات"),
    ("s2_024", "pulse", "🟩", "هیت‌مپ"),
    ("s2_031", "pop", "🎯", "تارگت"),
    ("s2_032", "shake", "🛑", "استاپ"),
    ("s2_035", "pop", "⚖️", "تعادل"),
    ("s2_040", "dump", "📉", "افت"),
    ("s2_041", "float", "🛟", "نجات"),
    ("s2_042", "pop", "🔥", "گریدی"),
    ("s2_059", "pump", "📈", "سیگنال"),
    ("s2_060", "pump", "📊", "آمار"),
    ("s2_065", "pump", "📈", "برآورد"),
    ("s2_090", "pump", "🚀", "پامپ"),
    ("s2_094", "pop", "🧩", "استراتژی"),
    ("s1_r1c0", "float", "🟠", "بیت‌کوین"),
    ("s1_r3c3", "sparkle", "🪙", "سکه‌ها"),
    ("s1_r4c6", "sparkle", "💰", "سود"),
    ("s1_r4c7", "float", "🏎️", "سرعت"),
    ("s1_r5c4", "spin", "🌍", "جهانی"),
    ("s1_r5c5", "spin", "🟠", "BTC"),
    ("s1_r5c6", "sparkle", "💵", "نقدینگی"),
    ("s1_r5c7", "breathe", "🧱", "بلاک"),
    ("s1_r6c4", "float", "💠", "اتریوم"),
    ("s1_r6c5", "spin", "🟣", "سولانا"),
    ("s1_r6c6", "spin", "🟡", "بایننس"),
    ("s1_r6c7", "pulse", "⛓️", "بلاکچین"),
    ("s2_000", "spin", "🟠", "بیت‌کوین"),
    ("s2_001", "float", "💠", "اتریوم"),
    ("s2_002", "spin", "🪙", "آلت‌کوین"),
    ("s2_008", "spin", "📡", "رادار"),
    ("s2_015", "pulse", "💧", "استخر نقدینگی"),
    ("s2_016", "float", "🔍", "جستجو"),
    ("s2_018", "spin", "💹", "بازدهی"),
    ("s2_020", "pulse", "🏙️", "بازار"),
    ("s2_023", "spin", "🧭", "قطب‌نما"),
    ("s2_025", "float", "⚖️", "توازن"),
    ("s2_026", "spin", "🥧", "سهم بازار"),
    ("s2_027", "pulse", "👁️", "نظارت"),
    ("s2_029", "pop", "🛡️", "امنیت"),
    ("s2_036", "float", "📜", "قرارداد"),
    ("s2_037", "spin", "⏰", "زمان"),
    ("s2_038", "sparkle", "🪙", "ذخایر"),
    ("s2_043", "spin", "💲", "تتر"),
    ("s2_044", "sparkle", "🌐", "سرمایه جهانی"),
    ("s2_045", "spin", "💱", "تبدیل ارز"),
    ("s2_046", "float", "💵", "دلار"),
    ("s2_058", "spin", "⌛", "تایم‌فریم"),
    ("s2_062", "spin", "⏳", "انتظار"),
    ("s2_080", "spin", "⛓️", "شبکه"),
    ("s2_081", "breathe", "🗓️", "هاوینگ"),
    ("s2_082", "shake", "⛏️", "ماینینگ"),
    ("s2_083", "float", "🧊", "بلاک‌ها"),
    ("s2_084", "spin", "🕸️", "گره‌ها"),
    ("s2_088", "breathe", "🏦", "بانک"),
    ("s2_089", "spin", "🐕", "دوج"),
    ("s2_092", "spin", "🌍", "جهانی"),
    ("s1_r0c0", "shimmer", "🏅", "نشان کوین کورد"),
    ("s1_r6c0", "pulse", "🤖", "هوش مصنوعی"),
    ("s1_r6c3", "shimmer", "⭐", "کوین کورد"),
    ("s1_r7c7", "shimmer", "🏅", "برند"),
    ("s1_r1c6", "pulse", "🔒", "امنیت"),
    ("s2_030", "breathe", "🧮", "محاسبه"),
    ("s2_033", "cheer", "🏆", "جایزه"),
    ("s2_039", "breathe", "🧮", "ماشین‌حساب"),
    ("s2_049", "breathe", "📝", "یادداشت"),
    ("s2_050", "spin", "⚙️", "تنظیمات"),
    ("s2_051", "breathe", "🗺️", "نقشه راه"),
    ("s2_052", "breathe", "📚", "آموزش"),
    ("s2_053", "pulse", "🖥️", "داشبورد"),
    ("s2_054", "breathe", "🤖", "ربات"),
    ("s2_055", "pulse", "🧠", "AI"),
    ("s2_056", "pulse", "🕸️", "شبکه عصبی"),
    ("s2_057", "pulse", "📊", "پنل"),
    ("s2_061", "breathe", "📅", "تقویم"),
    ("s2_063", "pulse", "❤️‍🔥", "سلامت بازار"),
    ("s2_064", "breathe", "📋", "گزارش"),
    ("s2_066", "shake", "🎥", "ویدیو"),
    ("s2_068", "float", "📁", "آرشیو"),
    ("s2_070", "shake", "📣", "اطلاعیه"),
    ("s2_072", "float", "💬", "دیسکورد"),
    ("s2_073", "float", "🗺️", "مسیر"),
    ("s2_077", "spin", "🎞️", "مدیا"),
    ("s2_078", "pulse", "🔐", "رمزنگاری"),
    ("s2_079", "float", "👛", "کیف پول"),
    ("s2_085", "spin", "🎨", "تنوع"),
    ("s2_086", "shake", "🔐", "سیف"),
    ("s2_093", "float", "✈️", "تلگرام"),
    ("s2_096", "breathe", "💻", "کار"),
]


def main():
    out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "assets", "stickers", "build"))
    os.makedirs(out, exist_ok=True)
    pieces = cut_sheet1(os.path.join(SRC, "sheet1.png"))
    pieces.update(cut_sheet2(os.path.join(SRC, "sheet2.png")))
    print("cut %d poses out of the sheets" % len(pieces))
    index, missing = [], []
    for i, (key, preset, emoji, label) in enumerate(PLAN, 1):
        if key not in pieces:
            missing.append(key)
            continue
        name = "%03d.webm" % i
        size = encode(frames(pieces[key], preset), os.path.join(out, name))
        index.append({"file": name, "emoji": emoji, "label": label, "motion": preset})
        print("%3d/%d  %-14s %-9s %6.1fKB" % (i, len(PLAN), key, preset, size / 1024.0))
    json.dump(index, open(os.path.join(out, "index.json"), "w"), ensure_ascii=False, indent=1)
    if missing:
        print("not found on the sheets: %s" % ", ".join(missing), file=sys.stderr)
    big = [x for x in index if os.path.getsize(os.path.join(out, x["file"])) > LIMIT]
    print("wrote %d stickers to %s (%d over the size cap)" % (len(index), out, len(big)))
    return 1 if (missing or big) else 0


if __name__ == "__main__":
    sys.exit(main())
