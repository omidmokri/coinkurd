# -*- coding: utf-8 -*-
"""⚖️ مقایسهٔ دو ارز در ربات — the same ten measures and the same DNA similarity the /compare/ pages show.

Both sides read data/dna.json, so a comparison in the bot and the matching page on the site can never
disagree. Nothing here is computed differently for Telegram; only the presentation is.
"""
import logging

import reality_common as R

log = logging.getLogger("cmp")
SITE = "https://entekhab.net"
TOP = 12

ROWS = [("price", {"fa": "قیمت (دلار)", "ckb": "نرخ (دۆلار)", "en": "Price (USD)"}, 0, 6),
        ("ret7", {"fa": "بازده ۷ روز ٪", "ckb": "گەڕانەوەی ٧ ڕۆژ ٪", "en": "7-day return %"}, 1, 1),
        ("ret30", {"fa": "بازده ۳۰ روز ٪", "ckb": "گەڕانەوەی ٣٠ ڕۆژ ٪", "en": "30-day return %"}, 1, 1),
        ("ret90", {"fa": "بازده ۹۰ روز ٪", "ckb": "گەڕانەوەی ٩٠ ڕۆژ ٪", "en": "90-day return %"}, 1, 1),
        ("vol30", {"fa": "نوسان ۳۰ روزه ٪", "ckb": "ئاڵۆزیی ٣٠ ڕۆژ ٪", "en": "30-day volatility %"}, -1, 1),
        ("taker7", {"fa": "سهم خریداران ٪", "ckb": "پشکی کڕیاران ٪", "en": "Taker buy share %"}, 1, 1),
        ("funding_ann", {"fa": "فاندینگ سالانه ٪", "ckb": "فاندینگی ساڵانە ٪", "en": "Annualised funding %"}, 0, 1),
        ("commits30", {"fa": "کامیت‌های ۳۰ روز", "ckb": "کۆمیتی ٣٠ ڕۆژ", "en": "Commits, 30 days"}, 1, 0),
        ("corr_btc", {"fa": "همبستگی با بیت‌کوین", "ckb": "پەیوەندی لەگەڵ بیتکۆین", "en": "Correlation with BTC"}, 0, 2),
        ("from_high", {"fa": "فاصله از سقف ٪", "ckb": "دووری لە لوتکە ٪", "en": "Distance from the high %"}, 1, 1)]

GENE = {"liquidity": {"fa": "نقدشوندگی", "ckb": "ئاسانیی فرۆشتن", "en": "Liquidity"},
        "volatility": {"fa": "نوسان", "ckb": "ئاڵۆزی", "en": "Volatility"},
        "flow": {"fa": "جریان خریداران", "ckb": "ڕۆیشتنی کڕیاران", "en": "Buyer flow"},
        "sentiment": {"fa": "احساسات خبری", "ckb": "هەستی هەواڵ", "en": "News sentiment"},
        "attention": {"fa": "توجه رسانه‌ای", "ckb": "سەرنجی میدیا", "en": "Media attention"},
        "leverage": {"fa": "اهرم", "ckb": "لیڤەرج", "en": "Leverage"},
        "developers": {"fa": "توسعه‌دهندگان", "ckb": "گەشەپێدەران", "en": "Developers"},
        "momentum": {"fa": "مومنتوم", "ckb": "مۆمێنتۆم", "en": "Momentum"}}

T = {"title": {"fa": "⚖️ مقایسهٔ دو ارز", "ckb": "⚖️ بەراوردی دوو دراو", "en": "⚖️ Compare two coins"},
     "pick1": {"fa": "ارز اول را انتخاب کن:", "ckb": "دراوی یەکەم هەڵبژێرە:", "en": "Pick the first coin:"},
     "pick2": {"fa": "حالا ارز دوم را انتخاب کن:", "ckb": "ئێستا دراوی دووەم هەڵبژێرە:", "en": "Now pick the second coin:"},
     "sim": {"fa": "شباهت DNA", "ckb": "لێکچوونی DNA", "en": "DNA similarity"},
     "score": {"fa": "امتیاز معیارها", "ckb": "خاڵی پێوەرەکان", "en": "Measures won"},
     "genes": {"fa": "ژن‌ها (۰ تا ۱۰۰)", "ckb": "جینەکان (٠ تا ١٠٠)", "en": "Genes (0 to 100)"},
     "note": {"fa": "برندهٔ هر سطر فقط بر پایهٔ همان معیار است. این مقایسه آموزشی است و توصیهٔ مالی نیست.",
              "ckb": "براوەی هەر ڕیزێک تەنیا بەپێی هەمان پێوەرە. ئەمە فێرکارییە و ئامۆژگاریی دارایی نییە.",
              "en": "Each row's winner is decided on that measure alone. Educational, not financial advice."},
     "none": {"fa": "دادهٔ DNA هنوز آماده نیست.", "ckb": "داتای DNA ئامادە نییە.", "en": "The DNA data is not ready yet."}}
FA_D = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")


def _lg(lang):
    return lang if lang in ("fa", "ckb", "en") else "fa"


def _n(v, lg, dp=1):
    if v is None:
        return "—"
    if dp == 6 and isinstance(v, (int, float)):     # a price: decimals by size, not a fixed six
        dp = 0 if abs(v) >= 1000 else 2 if abs(v) >= 1 else 4 if abs(v) >= 0.01 else 8
    s = f"{v:,.{dp}f}" if isinstance(v, (int, float)) else str(v)
    if lg == "en":
        return s
    return s.translate(FA_D).replace(".", "٫")


def _dna():
    return (R.load("dna.json", {}) or {}).get("coins") or {}


def top_coins():
    """the same twelve the site builds pages for — by 30-day quote volume"""
    d = _dna()
    return [c for c, _ in sorted(d.items(), key=lambda kv: -(kv[1].get("raw", {}).get("qvol30") or 0))][:TOP]


def ask(lang="fa", first=None):
    lg = _lg(lang)
    head = f"<b>{T['title'][lg]}</b>\n\n"
    if not top_coins():
        return head + T["none"][lg], []
    if first:
        rows = [(c, f"cm:{first}:{c}") for c in top_coins() if c != first]
        return head + T["pick2"][lg], rows
    return head + T["pick1"][lg], [(c, f"cm:{c}") for c in top_coins()]


def compare(a, b, lang="fa"):
    """the comparison itself — ten measures, then the eight genes, exactly as the page lays them out"""
    lg = _lg(lang)
    d = _dna()
    A, B = d.get(a), d.get(b)
    if not A or not B:
        return T["none"][lg]
    shared = [g for g in A.get("genes", {}) if A["genes"][g] is not None and (B.get("genes") or {}).get(g) is not None]
    sim = None
    if shared:
        dist = (sum((A["genes"][g] - B["genes"][g]) ** 2 for g in shared) / len(shared)) ** 0.5
        sim = round((1 - dist / 100) * 100)
    out, wa, wb = [], 0, 0
    for k, lab, direction, dp in ROWS:
        va, vb = A.get("raw", {}).get(k), B.get("raw", {}).get(k)
        ma = mb = ""
        if direction and va is not None and vb is not None and va != vb:
            if (va > vb) == (direction > 0):
                ma, wa = " ✅", wa + 1
            else:
                mb, wb = " ✅", wb + 1
        out.append(f"• {lab[lg]}\n   {a}: <b>{_n(va, lg, dp)}</b>{ma}   ·   {b}: <b>{_n(vb, lg, dp)}</b>{mb}")
    gl = [f"• {GENE.get(g, {}).get(lg, g)} — {a}: {_n(A['genes'][g], lg, 0)} · {b}: {_n((B.get('genes') or {}).get(g), lg, 0)}"
          for g in A.get("genes", {})]
    head = (f"<b>{T['title'][lg]}: {a} / {b}</b>\n\n"
            f"{T['sim'][lg]}: <b>{_n(sim, lg, 0)}{'%' if lg == 'en' else '٪'}</b>  ·  {T['score'][lg]}: <b>{a} {_n(wa, lg, 0)} : {_n(wb, lg, 0)} {b}</b>\n\n")
    tail = (f"\n\n<b>{T['genes'][lg]}</b>\n" + "\n".join(gl) +
            f"\n\nℹ️ {T['note'][lg]}\n🔗 {SITE}/compare/{a.lower()}-vs-{b.lower()}/")
    return head + "\n".join(out) + tail
