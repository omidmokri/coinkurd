#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""/today/ — the daily spine: one page that ties the site's tools together for the last 24 hours.

Everything comes from data files other scripts already compute: brain.json (what moved and why), friction.json
(Iran friction), scanlog.json + scanaudit.json (scanner findings of the last 24h with each pattern's tested record),
posts.json (the channel's posts). A section with no data says so; nothing is estimated here.
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pages as BP  # noqa: E402
import build_reality as BR  # noqa: E402
import build_trackrecord as TR  # noqa: E402
import reality_common as R  # noqa: E402

e = BP.e
L = R.L
WINDOW_H = 24
MAX_POSTS = 12
MAX_FIND = 15

S = {
    "title": L("امروز در بازار", "ئەمڕۆ لە بازاڕ", "Today in the market"),
    "lead": L("خلاصهٔ ۲۴ ساعت گذشته در یک صفحه: بازار چه کرد، اصطکاک ایران، یافته‌های اسکنر با کارنامهٔ آزموده‌شان، پست‌های کانال و کلاس امشب.",
              "پوختەی ٢٤ کاتژمێری ڕابردوو لە یەک پەڕەدا: بازاڕ چی کرد، گیروگرفتی ئێران، دۆزینەوەکانی سکانەر لەگەڵ تۆماری تاقیکراوەیان، پۆستەکانی کەناڵ و وانەی ئەمشەو.",
              "The last 24 hours on one page: what the market did, Iran friction, scanner findings with their tested record, the channel's posts and tonight's class."),
    "desc": L("گزارش روزانهٔ بازار کریپتو برای تریدرهای ایرانی و کرد — همه از دادهٔ واقعی.",
              "ڕاپۆرتی ڕۆژانەی بازاڕی کریپتۆ بۆ بازرگانانی ئێرانی و کورد — هەمووی لە داتای ڕاستەقینە.",
              "Daily crypto market brief for Iranian and Kurdish traders — all from real data."),
    "mkt": L("بازار چه کرد و چرا", "بازاڕ چی کرد و بۆچی", "What moved and why"),
    "btc": L("بیت‌کوین ۲۴س", "بیتکۆین ٢٤ک", "Bitcoin 24h"), "fng": L("ترس و طمع", "ترس و تەماح", "Fear & greed"),
    "brd": L("کوین‌های مثبت / منفی", "دراوە ئەرێنی / نەرێنی", "Coins up / down"),
    "mov": L("بیشترین حرکت", "زۆرترین جووڵە", "Biggest movers"),
    "ai": L("خلاصهٔ خودکار (ماشینی؛ اعدادش با داده چک می‌شود)", "پوختەی خۆکار (ئامێری؛ ژمارەکانی لەگەڵ داتا پشکنراون)",
            "Automatic summary (machine-written; its numbers are checked against the data)"),
    "more_mkt": L("آرشیو گزارش‌های روزانه", "ئەرشیفی ڕاپۆرتە ڕۆژانەکان", "Daily report archive"),
    "fr": L("اصطکاک ایران امروز", "گیروگرفتی ئێران ئەمڕۆ", "Iran friction today"),
    "fr_s": L("شاخص اصطکاک", "پێوەری گیروگرفت", "Friction score"), "usdt": L("تتر (تومان)", "تەتەر (تمەن)", "USDT (toman)"),
    "gap": L("فاصلهٔ قیمت بیت‌کوین در ایران", "جیاوازی نرخی بیتکۆین لە ئێران", "Bitcoin price gap in Iran"),
    "more_fr": L("جزئیات اصطکاک", "وردەکاری گیروگرفت", "Friction details"),
    "sc": L("یافته‌های اسکنر در ۲۴ ساعت گذشته", "دۆزینەوەکانی سکانەر لە ٢٤ کاتژمێری ڕابردوو", "Scanner findings in the last 24 hours"),
    "sc_l": L("کنار هر یافته، نتیجهٔ آزمون همان الگو در گذشته (بعد از یافته در برابر ساعت‌های دیگر). این‌ها پیشنهاد خرید یا فروش نیستند.",
              "لە تەنیشت هەر دۆزینەوەیەک، ئەنجامی تاقیکردنەوەی هەمان نەخش لە ڕابردوودا. ئەمانە پێشنیاری کڕین یان فرۆشتن نین.",
              "Next to each finding, how that pattern tested in the past (after findings vs other hours). These are not buy or sell calls."),
    "c_coin": L("کوین", "دراو", "Coin"), "c_pat": L("الگو", "نەخش", "Pattern"), "c_dir": L("جهت", "ئاراستە", "Direction"),
    "c_rec": L("کارنامهٔ الگو", "تۆماری نەخش", "Pattern's record"),
    "bull": L("صعودی", "بەرزبوونەوە", "up"), "bear": L("نزولی", "دابەزین", "down"),
    "sc_none": L("در ۲۴ ساعت گذشته یافتهٔ تازه‌ای ثبت نشده.", "لە ٢٤ کاتژمێری ڕابردوودا دۆزینەوەی نوێ تۆمار نەکراوە.", "No new findings in the last 24 hours."),
    "sc_more": L("{n} یافتهٔ دیگر", "{n} دۆزینەوەی تر", "{n} more"),
    "more_sc": L("آزمون کامل اسکنر", "تاقیکردنەوەی تەواوی سکانەر", "Full scanner test"),
    "po": L("پست‌های کانال در ۲۴ ساعت گذشته", "پۆستەکانی کەناڵ لە ٢٤ کاتژمێری ڕابردوو", "Channel posts in the last 24 hours"),
    "po_none": L("در ۲۴ ساعت گذشته پستی منتشر نشده.", "لە ٢٤ کاتژمێری ڕابردوودا پۆست بڵاو نەکراوەتەوە.", "No posts in the last 24 hours."),
    "po_rec": L("پست‌ها کمکی می‌کنند؟ کارنامهٔ آزموده‌شده", "پۆستەکان یارمەتیدەرن؟ تۆماری تاقیکراوە", "Do posts help? The tested record"),
    "cl": L("کلاس امشب", "وانەی ئەمشەو", "Tonight's class"),
    "cl_t": L("هر شب ساعت ۲۰:۰۰ به وقت تهران، کلاس زندهٔ کوین کورد در دیسکورد.",
              "هەموو شەوێک کاتژمێر ٢٠:٠٠ بە کاتی تاران، وانەی ڕاستەوخۆی کۆین کورد لە دیسکۆرد.",
              "Every night at 20:00 Tehran time, the live Coin Kurd class on Discord."),
    "cl_in": L("شروع تا", "دەستپێک تا", "Starts in"), "h": L("ساعت", "کاتژمێر", "h"), "m": L("دقیقه", "خولەک", "min"),
    "nd": L("هنوز داده‌ای نیست.", "هێشتا داتا نییە.", "No data yet."),
    "at": L("به‌روز شده", "نوێکراوە", "updated"),
}


def s(k, lg, **kw):
    t = S[k].get(lg) or S[k]["fa"]
    return t.format(**kw) if kw else t


def _t(iso):
    try:
        return R.parse_iso(iso)
    except Exception:  # noqa: BLE001
        return None


def recent(items, now, key, hours=WINDOW_H):
    """items whose timestamp `key` falls in (now - hours, now], newest first"""
    lo = now - dt.timedelta(hours=hours)
    out = []
    for x in items or []:
        t = _t(x.get(key))
        if t is not None and lo < t <= now:
            out.append((t, x))
    out.sort(key=lambda p: p[0], reverse=True)
    return [x for _, x in out]


def tested(pat, audit, lg):
    v = (audit.get("patterns") or {}).get(pat)
    if not v:
        return f"<span class='mut'>{e(s('nd', lg))}</span>"
    vd = v.get("verdict", "too_few")
    cls = "ok" if vd == "better" else "bad" if vd == "worse" else ""
    return (f"<span class='tr-chip {cls}'>{e(TR.s('sv_' + vd, lg))}</span> "
            f"<small class='mut'>{TR.pct(v.get('obs'), lg)} / {TR.pct(v.get('mid'), lg)} · p {TR.pv(v.get('p'), lg)}</small>")


def more(href, k, lg):
    return f"<p class='note'><a href='{href}'>{e(s(k, lg))} ←</a></p>"


def kpi(label, val):
    return f"<div class='td-k'><small>{label}</small><b>{val}</b></div>"


def build(now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    brain = R.load("brain.json", {}) or {}
    fr = R.load("friction.json", {}) or {}
    scan = (R.load("scanlog.json", {}) or {}).get("items") or []
    audit = R.load("scanaudit.json", {}) or {}
    posts = R.load("posts.json", []) or []
    excl = set(str(x) for x in (R.load("exclude_posts.json", []) or []) if not isinstance(x, dict))
    finds = recent(scan, now, "t")
    todays = [p for p in recent(posts, now, "date") if str(p.get("id")) not in excl]

    def b(lg):
        h = (f"<div class='meta'><a href='/'>{e(BR.s('home', lg))}</a> / {e(s('title', lg))}</div>"
             f"<h1>{e(s('title', lg))}</h1><p class='rc-lead'>{e(s('lead', lg))}</p>"
             f"<p class='note'>{BR.fdate(now.isoformat(), lg, True)}</p>")
        # market
        rg, rf = brain.get("regime") or {}, brain.get("report_facts") or {}
        if rg:
            br = rg.get("breadth") or {}
            k = kpi(e(s("btc", lg)), TR.pct(rg.get("btc_chg24"), lg))
            if rf.get("fng") is not None:
                k += kpi(e(s("fng", lg)), BR.nf(rf.get("fng"), lg))
            if br.get("n"):
                k += kpi(e(s("brd", lg)), f"<bdi dir='ltr'>{BR.nf(br.get('up_pct'), lg, pct=True)} / {BR.nf(br.get('down_pct'), lg, pct=True)}</bdi>")
            inner = f"<div class='td-ks'>{k}</div>"
            mv = (brain.get("movers") or [])[:6]
            if mv:
                inner += (f"<p><b>{e(s('mov', lg))}:</b> " + " · ".join(
                    f"<a href='/coins/{e(str(m.get('coin', '')).lower())}/'>{e(m.get('coin', ''))}</a> {TR.pct(m.get('chg24'), lg, 1)}"
                    for m in mv) + "</p>")
            rep = (brain.get("report") or {}).get(lg) or {}
            if rep.get("body"):
                body = "".join(f"<li>{e(x.lstrip('•').strip())}</li>" for x in rep["body"].split("\n") if x.strip())
                inner += (f"<details class='td-ai'><summary>{e(s('ai', lg))} · {BR.fdate(brain.get('report_at'), lg, True)}</summary>"
                          f"<p><b>{e(rep.get('headline', ''))}</b></p><ul>{body}</ul></details>")
            h += BR.sec(e(s("mkt", lg)), inner + more("/daily/", "more_mkt", lg))
        else:
            h += BR.sec(e(s("mkt", lg)), f"<p class='note'>{e(s('nd', lg))}</p>")
        # friction
        if fr.get("score") is not None:
            p, pa = fr.get("prices") or {}, fr.get("paper") or {}
            k = kpi(e(s("fr_s", lg)), f"{BR.nf(fr.get('score'), lg, 1)} <small>{e(BR.s('lvl.' + (fr.get('level') or 'green'), lg))}</small>")
            if p.get("usdt"):
                k += kpi(e(s("usdt", lg)), BR.nf(p.get("usdt") / 10, lg))
            if pa.get("gap_pct") is not None:
                k += kpi(e(s("gap", lg)), TR.pct(pa.get("gap_pct"), lg))
            h += BR.sec(e(s("fr", lg)), f"<div class='td-ks'>{k}</div>" + more("/iran-friction/", "more_fr", lg))
        else:
            h += BR.sec(e(s("fr", lg)), f"<p class='note'>{e(s('nd', lg))}</p>")
        # scanner
        if finds:
            rows = []
            for f in finds[:MAX_FIND]:
                nm = (TR.SCN.get(f.get("type")) or {}).get(lg) or f.get("type", "")
                rows.append(f"<tr><td><a href='/coins/{e(str(f.get('coin', '')).lower())}/'>{e(f.get('coin', ''))}</a></td><td>{e(nm)}</td>"
                            f"<td>{e(s(f.get('dir') if f.get('dir') in ('bull', 'bear') else 'bull', lg))}</td><td>{tested(f.get('type'), audit, lg)}</td></tr>")
            inner = BR.table([e(s("c_coin", lg)), e(s("c_pat", lg)), e(s("c_dir", lg)), e(s("c_rec", lg))], rows, "tr-tbl")
            if len(finds) > MAX_FIND:
                inner += f"<p class='note'>{e(s('sc_more', lg, n=BR.nf(len(finds) - MAX_FIND, lg)))}</p>"
        else:
            inner = f"<p class='note'>{e(s('sc_none', lg))}</p>"
        h += BR.sec(e(s("sc", lg)), inner + more("/track-record/#scanner", "more_sc", lg), lead=e(s("sc_l", lg)))
        # posts
        if todays:
            li = "".join(f"<li><a href='{e(p.get('url', ''))}' rel='noopener' target='_blank'><bdi dir='auto'>{e((p.get('title') or '')[:110])}</bdi></a> "
                         f"<small class='mut'>{BR.fdate(p.get('date'), lg, True)}</small></li>" for p in todays[:MAX_POSTS])
            inner = f"<ul class='td-po'>{li}</ul>"
        else:
            inner = f"<p class='note'>{e(s('po_none', lg))}</p>"
        h += BR.sec(e(s("po", lg)), inner + more("/track-record/", "po_rec", lg))
        # class
        h += BR.sec(e(s("cl", lg)), f"<p>{e(s('cl_t', lg))}</p><p class='td-cd' data-h='{e(s('h', lg))}' data-m='{e(s('m', lg))}'>"
                    f"{e(s('cl_in', lg))}: <b class='td-cdv'>—</b></p>")
        h += BR.updated(lg, brain.get("updated_at"))
        return h

    js = ("(function(){function u(){var n=new Date(),t=new Date(n.getTime());"
          "t.setUTCHours(16,30,0,0);if(t<=n)t.setUTCDate(t.getUTCDate()+1);var d=Math.round((t-n)/60000);"
          "document.querySelectorAll('.td-cd').forEach(function(p){var v=p.querySelector('.td-cdv');"
          "v.textContent=Math.floor(d/60)+' '+p.dataset.h+' '+(d%60)+' '+p.dataset.m;});}u();setInterval(u,30000);})();")
    body = BR.finish("", BR.tri(b)) + f"<script>{js}</script>"
    css = (".td-ks{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}.td-k{flex:1 1 140px;background:var(--card);border:1px solid var(--line);"
           "border-radius:16px;padding:12px 14px}.td-k small{display:block;opacity:.75}.td-k b{font-size:1.35em}"
           ".td-ai{margin-top:8px}.td-ai summary{cursor:pointer;color:var(--acc)}.td-po li{margin:6px 0}.td-cd b{color:var(--acc)}")
    extra = f"<style>{BR.RCSS}{TR.CSS}{css}</style>"
    return BP.page("today/", s("title", "fa") + " — " + s("desc", "fa"), s("desc", "fa"), body, extra)


def main():
    url = build()
    BR.add_to_sitemap([url])
    print("today page:", url)


if __name__ == "__main__":
    main()
