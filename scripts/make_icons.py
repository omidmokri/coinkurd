#!/usr/bin/env python3
"""Glossy tile icons for the home page (categories, library, news) — replaces emoji, which render differently on
every device and clutter the page. Each icon is a small static SVG: a rounded tile in the section's own colour,
a soft top highlight and bottom shade for depth, and a white line glyph. Being files, they are cached once and
used by both the pre-rendered HTML and the page script.   Run: python3 scripts/make_icons.py  -> assets/ic/*.svg
Glyphs are original 24x24 line drawings (some shared with the site header set in chrome.py)."""
import colorsys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "ic")

G = {
    "news": '<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2"/><path d="M7 8h7M7 12h7M7 16h4"/>',
    "bank": '<path d="M3 9.5 12 4l9 5.5"/><path d="M4 9.5h16"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/><path d="M3.5 20.5h17"/>',
    "scale": '<path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7 2.5 13a2.6 2.6 0 0 0 5 0Z"/><path d="m19 7-2.5 6a2.6 2.6 0 0 0 5 0Z"/><path d="M8 21h8"/>',
    "chain": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
    "megaphone": '<path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
    "shield": '<path d="M12 3 4.5 6v6c0 4.9 3.2 8.2 7.5 9 4.3-.8 7.5-4.1 7.5-9V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    "cap": '<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/>',
    "books": '<path d="M4 4h4v16H4z"/><path d="M8 6h4v14H8z"/><path d="m13.5 6.5 3.8-1 3.2 13.5-3.8 1Z"/>',
    "chart": '<path d="M3 3v18h18"/><path d="m6 15 4-4 3 3 6-7"/><path d="M15 7h4v4"/>',
    "target": '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/><path d="m13 11 7.5-7.5M17 3.5h3.5V7"/>',
    "film": '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m3 8 2.5-4.5L21 4l-.5 4"/><path d="m8.5 3.8 2 4M14 3.9l2 4"/>',
    "camera": '<rect x="2.5" y="6.5" width="13" height="11" rx="2"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
    "toolbox": '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8"/><path d="M3 13h18"/><path d="M10 13v2h4v-2"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5Z"/>',
    "music": '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
    "coin": '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.6 0-2.7.8-2.7 2 0 2.8 5.6 1.5 5.6 4.3 0 1.2-1.2 2.1-2.8 2.1-1.2 0-2.3-.6-2.8-1.6"/><path d="M12 6.5v1.3M12 16.2v1.3"/>',
    "gold": '<path d="M3 19h8l-1.5-5h-5Z"/><path d="M13 19h8l-1.5-5h-5Z"/><path d="M8 13h8l-1.5-5h-5Z"/>',
    "cash": '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    "bars": '<path d="M4 20h16"/><path d="M6 20v-6M10.5 20V9M15 20v-8M19.5 20V5"/>',
    "oil": '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z"/><path d="M9.5 15a2.5 2.5 0 0 0 2.5 2.5"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>',
    "star": '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/>',
    "percent": '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    "ship": '<path d="M3 15h18l-2.5 4.5h-13Z"/><path d="M6 15V9h12v6"/><path d="M10 9V5h4v4"/>',
    "swap": '<path d="M4 8h14l-3.5-3.5"/><path d="M20 16H6l3.5 3.5"/>',
    "columns": '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10h14"/><path d="M7 11v6M12 11v6M17 11v6"/><path d="M4 19.5h16"/>',
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    "eyeoff": '<path d="M3 3l18 18"/><path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.9 3.6M6.2 7.4A17 17 0 0 0 2.5 12S6 18 12 18a9.7 9.7 0 0 0 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    "wrench": '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5Z"/>',
}

# key -> (glyph, colour). cat-* = archive categories (data/meta.json), lib-* = library shelves, nw-* = news topics
ICONS = {
    "cat-technical": ("chart", "#22d3ee"), "cat-signal": ("target", "#f472b6"), "cat-etf_institutional": ("bank", "#a78bfa"),
    "cat-regulation": ("scale", "#fbbf24"), "cat-security": ("shield", "#f87171"), "cat-onchain": ("chain", "#34d399"),
    "cat-education": ("cap", "#60a5fa"), "cat-products": ("books", "#fb923c"), "cat-community": ("megaphone", "#e879f9"),
    "cat-news": ("news", "#94a3b8"),
    "lib-film": ("film", "#f472b6"), "lib-doc": ("camera", "#22d3ee"), "lib-book": ("books", "#f7931a"), "lib-tool": ("toolbox", "#a78bfa"),
    "lib-free": ("cap", "#4ade80"), "lib-bio": ("compass", "#fbbf24"), "lib-song": ("music", "#f87171"),
    "nw-sec_coinkurd": ("star", "#f7931a"), "nw-sec_crypto": ("coin", "#f59e0b"), "nw-sec_economy": ("columns", "#38bdf8"),
    "nw-f_gold": ("gold", "#eab308"), "nw-f_fx": ("cash", "#22c55e"), "nw-f_stock": ("bars", "#60a5fa"), "nw-f_oil": ("oil", "#64748b"),
    "nw-f_crypto": ("coin", "#f59e0b"), "nw-f_news": ("news", "#94a3b8"),
    "nw-security": ("shield", "#f87171"), "nw-regulation": ("scale", "#fbbf24"), "nw-etf_institutional": ("bank", "#a78bfa"),
    "nw-onchain": ("chain", "#34d399"), "nw-technical": ("chart", "#22d3ee"), "nw-news": ("news", "#94a3b8"),
    "nw-w_rates": ("percent", "#f472b6"), "nw-w_stocks": ("bars", "#60a5fa"), "nw-w_commod": ("oil", "#d97706"), "nw-w_fx": ("swap", "#22c55e"),
    "nw-w_trade": ("ship", "#38bdf8"), "nw-w_macro": ("globe", "#818cf8"),
    "nw-tab-fa": ("news", "#f7931a"), "nw-tab-en": ("globe", "#22d3ee"), "nw-tab-w": ("bank", "#a78bfa"),
    "ui-star": ("star", "#f7931a"), "ui-eye": ("eye", "#64748b"), "ui-eyeoff": ("eyeoff", "#64748b"), "ui-coin": ("coin", "#f3c969"),
}


def shade(hexc, f):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, lt, s = colorsys.rgb_to_hls(r, g, b)
    lt = max(0, min(1, lt * f))
    r, g, b = colorsys.hls_to_rgb(h, lt, min(1, s * 1.05))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def svg(glyph, col):
    top, bot = shade(col, 1.18), shade(col, 0.62)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
        '<defs>'
        f'<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bot}"/></linearGradient>'
        '<linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
        '<radialGradient id="r" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>'
        '</defs>'
        '<rect x="6" y="9" width="52" height="52" rx="15" fill="#000" opacity=".35"/>'
        '<rect x="5" y="5" width="54" height="54" rx="15" fill="url(#b)"/>'
        '<rect x="5" y="5" width="54" height="54" rx="15" fill="url(#r)"/>'
        '<path d="M20 5h24a15 15 0 0 1 15 15v2c-8-4-18-6-27-6S13 18 5 22v-2A15 15 0 0 1 20 5Z" fill="url(#h)"/>'
        '<rect x="5.5" y="5.5" width="53" height="53" rx="14.5" fill="none" stroke="#fff" stroke-opacity=".28"/>'
        f'<g transform="translate(15 15.5) scale(1.42)" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" transform-origin="0 0">'
        f'<g transform="translate(0 .7)">{glyph}</g></g>'
        f'<g transform="translate(15 15) scale(1.42)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{glyph}</g>'
        '</svg>')


def main():
    os.makedirs(OUT, exist_ok=True)
    for k, (g, c) in ICONS.items():
        open(os.path.join(OUT, k + ".svg"), "w").write(svg(G[g], c))
    print(f"icons: {len(ICONS)} written to assets/ic/")


if __name__ == "__main__":
    main()
