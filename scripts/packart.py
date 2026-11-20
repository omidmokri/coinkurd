#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""The Coin Kurd sticker, emoji and GIF artwork: one wordless icon vocabulary, drawn as SVG.

Wordless on purpose — the channel reads in Kurdish, Persian, Arabic and English, and a picture needs no
translation. Every icon is drawn in a 100x100 box so the same drawing serves a 512 px sticker and a 100 px
custom emoji, and every one carries the house look: the gold of entekhab.net on a dark disc, with a glow.

  python3 scripts/packart.py          # writes the sheet and every frame-less preview to /tmp
"""
import os

GOLD_A, GOLD_B, GOLD_C = "#FFE3A6", "#F7A91A", "#C9761A"
UP, DOWN = "#16C784", "#EA3943"
INK, PAPER = "#0B0F19", "#F2EAD9"
CYAN = "#22D3EE"

# name -> (what it is for the owner, the drawing inside the disc, the emoji it answers to)
ICONS = {}


def icon(name, emoji, body, ring=GOLD_B):
    ICONS[name] = {"emoji": emoji, "body": body, "ring": ring}


# ---------------------------------------------------------------- the drawings (100x100)
icon("coin", "🪙", f'''
  <circle cx="50" cy="50" r="28" fill="url(#gold)" stroke="{GOLD_C}" stroke-width="2.5"/>
  <circle cx="50" cy="50" r="22" fill="none" stroke="{GOLD_C}" stroke-width="1.4" opacity=".5"/>
  <path d="M45 28v8M53 28v8M45 64v8M53 64v8" stroke="{INK}" stroke-width="3.6" stroke-linecap="round"/>
  <path d="M40 36h14a7 7 0 0 1 0 14H40zM40 50h16a7.5 7.5 0 0 1 0 15H40z"
        fill="none" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>''')

icon("bull", "🐂", f'''
  <path d="M50 64c-14 0-24-7-30-17-4-7-6-15-6-23 0-3 3-5 6-3 7 4 12 10 15 17 4 8 9 12 15 12s11-4 15-12
           c3-7 8-13 15-17 3-2 6 0 6 3 0 8-2 16-6 23-6 10-16 17-30 17z" fill="url(#gold)"/>
  <path d="M20 24c5 4 9 9 11 15M80 24c-5 4-9 9-11 15" stroke="{GOLD_A}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
  <path d="M50 70l9 14H41z" fill="{UP}"/>''', ring=UP)

icon("bear", "🐻", f'''
  <path d="M26 22c6 10 9 22 9 34M44 18c5 11 7 24 7 36M62 20c4 11 5 23 4 34" fill="none"
        stroke="url(#gold)" stroke-width="9" stroke-linecap="round"/>
  <path d="M22 58c6 10 17 16 29 16s22-6 28-16c-8 4-18 6-28 6s-21-2-29-6z" fill="url(#gold)"/>
  <path d="M50 78l-9 10h18z" fill="{DOWN}"/>''', ring=DOWN)

icon("rocket", "🚀", f'''
  <path d="M50 16c10 9 15 21 15 34v10H35V50c0-13 5-25 15-34z" fill="url(#gold)"/>
  <circle cx="50" cy="41" r="8" fill="{INK}"/><circle cx="50" cy="41" r="4.5" fill="{CYAN}"/>
  <path d="M35 52l-11 16 11-4zM65 52l11 16-11-4z" fill="{GOLD_C}"/>
  <path d="M38 60h24v8H38z" fill="{GOLD_C}" opacity=".7"/>
  <path d="M43 68h14l-7 18z" fill="{DOWN}" class="flame"/>
  <path d="M46 68h8l-4 11z" fill="{GOLD_A}" class="flame"/>''')

icon("bigmove", "🐋", f'''
  <ellipse cx="38" cy="70" rx="22" ry="8" fill="url(#gold)"/>
  <ellipse cx="38" cy="58" rx="19" ry="7" fill="url(#gold)" stroke="{GOLD_C}" stroke-width="1.5"/>
  <ellipse cx="38" cy="47" rx="15" ry="6" fill="url(#gold)" stroke="{GOLD_C}" stroke-width="1.5"/>
  <path d="M20 70v-12M56 70v-12M23 58v-11M53 58v-11" stroke="{GOLD_C}" stroke-width="2.4" opacity=".7"/>
  <path d="M62 44h16M78 44l-7-7M78 44l-7 7" fill="none" stroke="{CYAN}" stroke-width="6"
        stroke-linecap="round" stroke-linejoin="round" class="draw"/>
  <path d="M34 30h10M39 25v10" stroke="{GOLD_A}" stroke-width="3.4" stroke-linecap="round" class="blink"/>''')

icon("candle-up", "🟢", f'''
  <path d="M50 16v12M50 72v12" stroke="{UP}" stroke-width="5" stroke-linecap="round"/>
  <rect x="38" y="28" width="24" height="44" rx="5" fill="{UP}"/>
  <path d="M44 56l6-8 6 8" fill="none" stroke="{PAPER}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>''', ring=UP)

icon("candle-down", "🔴", f'''
  <path d="M50 16v12M50 72v12" stroke="{DOWN}" stroke-width="5" stroke-linecap="round"/>
  <rect x="38" y="28" width="24" height="44" rx="5" fill="{DOWN}"/>
  <path d="M44 44l6 8 6-8" fill="none" stroke="{PAPER}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>''', ring=DOWN)

icon("chart-up", "📈", f'''
  <path d="M24 70l14-14 10 9 20-23" fill="none" stroke="{UP}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="draw"/>
  <path d="M56 32h18v18" fill="none" stroke="{UP}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 78h56" stroke="url(#gold)" stroke-width="4" stroke-linecap="round" opacity=".7"/>''', ring=UP)

icon("chart-down", "📉", f'''
  <path d="M24 32l14 14 10-9 20 23" fill="none" stroke="{DOWN}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="draw"/>
  <path d="M56 70h18V52" fill="none" stroke="{DOWN}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M22 78h56" stroke="url(#gold)" stroke-width="4" stroke-linecap="round" opacity=".7"/>''', ring=DOWN)

icon("bell", "🔔", f'''
  <g class="swing">
  <path d="M50 20a5 5 0 0 1 5 5v2c9 3 14 11 14 21v10l6 8H25l6-8V48c0-10 5-18 14-21v-2a5 5 0 0 1 5-5z" fill="url(#gold)"/>
  <path d="M43 70a7 7 0 0 0 14 0z" fill="{GOLD_C}"/></g>''')

icon("shield", "🛡", f'''
  <path d="M50 18l24 9v20c0 16-10 28-24 33-14-5-24-17-24-33V27z" fill="url(#gold)"/>
  <path d="M38 50l9 9 17-18" fill="none" stroke="{INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>''')

icon("search", "🔎", f'''
  <circle cx="45" cy="45" r="19" fill="none" stroke="url(#gold)" stroke-width="7"/>
  <circle cx="45" cy="45" r="11" fill="{CYAN}" opacity=".25"/>
  <path d="M59 59l16 16" stroke="url(#gold)" stroke-width="9" stroke-linecap="round"/>''')

icon("fire", "🔥", f'''
  <path d="M50 16c10 12 18 20 18 32a18 18 0 1 1-36 0c0-8 4-13 8-18 2 6 5 8 5 8 1-9 3-16 5-22z" fill="url(#gold)" class="flame"/>
  <path d="M50 46c5 6 8 10 8 15a8 8 0 1 1-16 0c0-5 3-9 8-15z" fill="{PAPER}" opacity=".85"/>''')

icon("diamond", "💎", f'''
  <path d="M32 28h36l12 16-30 30-30-30z" fill="url(#gold)"/>
  <path d="M32 28l6 16h24l6-16M20 44h60M50 74L38 44M50 74l12-30" fill="none" stroke="{INK}" stroke-width="2.6" opacity=".55"/>''')

icon("clock", "⏳", f'''
  <circle cx="50" cy="50" r="30" fill="url(#gold)"/>
  <circle cx="50" cy="50" r="24" fill="{INK}"/>
  <path d="M50 28v4M50 68v4M28 50h4M68 50h4" stroke="url(#gold)" stroke-width="3" stroke-linecap="round"/>
  <g class="tick"><path d="M50 50V36" stroke="{PAPER}" stroke-width="5" stroke-linecap="round"/></g>
  <g class="tick2"><path d="M50 50h17" stroke="url(#gold)" stroke-width="4" stroke-linecap="round"/></g>
  <circle cx="50" cy="50" r="3.4" fill="{PAPER}"/>''')

icon("target", "🎯", f'''
  <circle cx="50" cy="50" r="28" fill="none" stroke="url(#gold)" stroke-width="6"/>
  <circle cx="50" cy="50" r="17" fill="none" stroke="url(#gold)" stroke-width="6" opacity=".75"/>
  <circle cx="50" cy="50" r="7" fill="{DOWN}"/>''')

icon("warning", "⚠️", f'''
  <path d="M50 20l32 56H18z" fill="url(#gold)"/>
  <path d="M50 40v20" stroke="{INK}" stroke-width="7" stroke-linecap="round"/>
  <circle cx="50" cy="68" r="4.5" fill="{INK}"/>''')

icon("check", "✅", f'''
  <circle cx="50" cy="50" r="30" fill="{UP}"/>
  <path d="M35 51l11 11 20-24" fill="none" stroke="{PAPER}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" class="draw"/>''', ring=UP)

icon("cross", "❌", f'''
  <circle cx="50" cy="50" r="30" fill="{DOWN}"/>
  <path d="M38 38l24 24M62 38L38 62" stroke="{PAPER}" stroke-width="8" stroke-linecap="round"/>''', ring=DOWN)

icon("sun", "☀️", f'''
  <g class="spin">''' + "".join(
    f'<path d="M50 50 L{50 + 23 * __import__("math").cos((a - 4) * 3.14159 / 180):.1f} '
    f'{50 + 23 * __import__("math").sin((a - 4) * 3.14159 / 180):.1f} '
    f'L{50 + 38 * __import__("math").cos(a * 3.14159 / 180):.1f} '
    f'{50 + 38 * __import__("math").sin(a * 3.14159 / 180):.1f} '
    f'L{50 + 23 * __import__("math").cos((a + 4) * 3.14159 / 180):.1f} '
    f'{50 + 23 * __import__("math").sin((a + 4) * 3.14159 / 180):.1f} Z" fill="url(#gold)"/>'
    for a in range(0, 360, 17)) + f'''</g>
  <circle cx="50" cy="50" r="19" fill="url(#gold)" stroke="{GOLD_C}" stroke-width="2"/>''')

icon("trophy", "🏆", f'''
  <path d="M34 22h32v16a16 16 0 0 1-32 0z" fill="url(#gold)"/>
  <path d="M34 26H24v6a10 10 0 0 0 10 10M66 26h10v6a10 10 0 0 1-10 10" fill="none" stroke="url(#gold)" stroke-width="5"/>
  <path d="M46 54h8v12h-8zM36 66h28v8H36z" fill="{GOLD_C}"/>''')

icon("brain", "🤖", f'''
  <rect x="26" y="34" width="48" height="38" rx="12" fill="url(#gold)"/>
  <circle cx="40" cy="52" r="5.5" fill="{INK}"/><circle cx="60" cy="52" r="5.5" fill="{INK}"/>
  <path d="M42 64h16" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M50 34V22M50 22a5 5 0 1 1 0-.01" fill="none" stroke="url(#gold)" stroke-width="5" stroke-linecap="round" class="blink"/>
  <path d="M20 46v14M80 46v14" stroke="url(#gold)" stroke-width="5" stroke-linecap="round"/>''')

icon("alarm", "🚨", f'''
  <path d="M30 70V52a20 20 0 0 1 40 0v18z" fill="{DOWN}"/>
  <rect x="24" y="70" width="52" height="9" rx="4.5" fill="url(#gold)"/>
  <path d="M50 32V20M24 44l-9-7M76 44l9-7" stroke="url(#gold)" stroke-width="5" stroke-linecap="round" class="blink"/>''', ring=DOWN)


# ---------------------------------------------------------------- the owner's own artwork, on the same disc
# The site's rule is that a coin never appears without its own logo, so the coin stickers carry the 3D coins from
# assets/coin3d/ rather than anything drawn here. The channel's own logo leads both packs, which also makes it
# the pack's cover in Telegram.
import base64

SITE_COINS = [("BTC", "🟠"), ("ETH", "🔷"), ("SOL", "🟪"), ("BNB", "🟡"), ("XRP", "💧"), ("DOGE", "🐕"),
              ("ADA", "🔵"), ("AVAX", "🔺"), ("LINK", "🔗"), ("DOT", "⚪"), ("GOLD", "🥇")]


def _data_uri(path, box=360):
    from PIL import Image
    import io
    im = Image.open(path).convert("RGBA")
    if max(im.size) > box:
        im.thumbnail((box, box), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def art(name, emoji, path, inset=26, cls="shine", ring=GOLD_B):
    """an icon whose middle is one of the owner's own pictures, centred in the disc"""
    uri = _data_uri(os.path.join(ROOT, path))
    w = 100 - inset * 2
    ICONS[name] = {"emoji": emoji, "ring": ring, "body":
                   f'<image href="{uri}" x="{inset}" y="{inset}" width="{w}" height="{w}" '
                   f'preserveAspectRatio="xMidYMid meet" class="{cls}"/>'}


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# the channel's own logo, first in both packs
art("logo", "👑", "assets/logo-hero.webp", inset=14, cls="shine")
for _c, _e in SITE_COINS:
    art(_c.lower(), _e, f"assets/coin3d/{_c}.png", inset=22, cls="shine")

# silver has no artwork of its own on the site, so it is drawn here in the same manner as the rest
icon("silver", "🥈", f'''
  <path d="M26 60h48l6 14H20z" fill="url(#silver)" stroke="#8A94A6" stroke-width="1.6"/>
  <path d="M32 44h36l5 14H27z" fill="url(#silver)" stroke="#8A94A6" stroke-width="1.6"/>
  <path d="M38 28h24l5 14H33z" fill="url(#silver)" stroke="#8A94A6" stroke-width="1.6"/>
  <path d="M40 32h18M34 48h26M28 64h30" stroke="#FFFFFF" stroke-width="2" opacity=".45" stroke-linecap="round"/>''',
     ring="#C7CDD8")

icon("calendar", "📅", f'''
  <rect x="20" y="26" width="60" height="54" rx="9" fill="url(#gold)"/>
  <rect x="26" y="40" width="48" height="34" rx="5" fill="{INK}"/>
  <path d="M34 20v12M66 20v12" stroke="url(#gold)" stroke-width="7" stroke-linecap="round"/>
  <circle cx="38" cy="52" r="4" fill="url(#gold)"/><circle cx="50" cy="52" r="4" fill="url(#gold)" opacity=".5"/>
  <circle cx="62" cy="52" r="4" fill="{DOWN}" class="blink"/>
  <circle cx="38" cy="64" r="4" fill="url(#gold)" opacity=".5"/><circle cx="50" cy="64" r="4" fill="url(#gold)" opacity=".5"/>''')

icon("news", "📰", f'''
  <rect x="18" y="26" width="56" height="50" rx="7" fill="url(#gold)"/>
  <path d="M74 36h8v32a8 8 0 0 1-8 8z" fill="{GOLD_C}"/>
  <path d="M26 36h26v14H26z" fill="{INK}"/>
  <path d="M26 56h40M26 64h40M58 38h8M58 46h8" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>''')

icon("live", "📡", f'''
  <circle cx="50" cy="56" r="11" fill="{DOWN}" class="blink"/>
  <path d="M33 39a24 24 0 0 0 0 34M67 39a24 24 0 0 1 0 34" fill="none" stroke="url(#gold)"
        stroke-width="6" stroke-linecap="round"/>
  <path d="M23 29a37 37 0 0 0 0 54M77 29a37 37 0 0 1 0 54" fill="none" stroke="url(#gold)"
        stroke-width="5" stroke-linecap="round" opacity=".6"/>''', ring=DOWN)


# The order the packs are built in: the channel's logo first, so it becomes the pack's cover, then the coins the
# site follows (and the two metals), then the market icons. The files are numbered so this order survives on disk.
ORDER = (["logo"] + [c.lower() for c, _ in SITE_COINS] + ["silver"]
         + [n for n in ICONS if n not in {"logo", "silver"} and n not in {c.lower() for c, _ in SITE_COINS}])


def stems():
    return [(f"{i:02d}-{n}", n) for i, n in enumerate(ORDER)]


def svg(name, size=512, animated=True):
    """one icon as a whole SVG document: the dark disc, the gold ring, the drawing, the glow"""
    it = ICONS[name]
    anim = ANIM if animated else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 100 100">
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{GOLD_A}"/><stop offset=".5" stop-color="{GOLD_B}"/><stop offset="1" stop-color="{GOLD_C}"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#F4F7FB"/><stop offset=".5" stop-color="#C7CDD8"/><stop offset="1" stop-color="#8A94A6"/>
  </linearGradient>
  <radialGradient id="disc" cx=".5" cy=".38" r=".75">
    <stop offset="0" stop-color="#1A2235"/><stop offset="1" stop-color="{INK}"/>
  </radialGradient>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<style>{anim}</style>
<g class="all">
  <circle cx="50" cy="50" r="47" fill="url(#disc)"/>
  <circle cx="50" cy="50" r="47" fill="none" stroke="{it['ring']}" stroke-width="3" opacity=".9"/>
  <circle cx="50" cy="50" r="43" fill="none" stroke="{it['ring']}" stroke-width="1" opacity=".35"/>
  <g filter="url(#glow)">{it['body']}</g>
</g></svg>'''


# Every animation is a loop that reads at any single frame, so a still of it is never half-drawn.
ANIM = """
.all{animation:breathe 2s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
.all{transform-origin:50px 50px}
.swing{animation:swing 2s ease-in-out infinite;transform-origin:50px 24px}
@keyframes swing{0%,100%{transform:rotate(-11deg)}50%{transform:rotate(11deg)}}
.spin{animation:spin 2s linear infinite;transform-origin:50px 50px}
@keyframes spin{to{transform:rotate(360deg)}}
.flame{animation:flick 1s ease-in-out infinite;transform-origin:50px 70px}
@keyframes flick{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.86)}}
.blink{animation:blink 1s steps(2,end) infinite}
@keyframes blink{50%{opacity:.25}}
.spout{animation:spout 2s ease-in-out infinite;transform-origin:44px 34px}
@keyframes spout{0%,100%{transform:scale(.8);opacity:.6}50%{transform:scale(1.15);opacity:1}}
.tick{animation:tick 2s steps(8,end) infinite;transform-origin:50px 50px}
.tick2{animation:tick 2s linear infinite;transform-origin:50px 50px}
@keyframes tick{to{transform:rotate(360deg)}}
.shine{animation:shine 2s ease-in-out infinite;transform-origin:50px 50px}
@keyframes shine{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.06);filter:brightness(1.18)}}
.draw{stroke-dasharray:90;animation:draw 2s ease-in-out infinite}
@keyframes draw{0%,45%{stroke-dashoffset:0}62%{stroke-dashoffset:90}100%{stroke-dashoffset:0}}
"""
LOOP = 2.0          # seconds: the length of every file, and what each animation divides into

if __name__ == "__main__":
    out = "/tmp/packart"
    os.makedirs(out, exist_ok=True)
    for n in ICONS:
        open(os.path.join(out, n + ".svg"), "w", encoding="utf-8").write(svg(n))
    print(f"{len(ICONS)} icons ->", out)
