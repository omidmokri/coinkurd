"""
Every page of the site in the bot: section "pages" («🗺 همهٔ صفحات سایت»). Built from the site's own menu
(scripts/chrome.py NAV + the battle page), so a page added to the menu appears here with no second edit.
Each page opens inside Telegram (Web App); RSS and the archive anchors open in the browser.
Read-only: nothing is stored or sent.            Self-test: python3 scripts/bot_pages.py
"""
import chrome as C
from bot_i18n import pick

SITE = "https://entekhab.net"
TXT = {
    "title": {"fa": "🗺 <b>همهٔ صفحات سایت</b>", "ckb": "🗺 <b>هەموو پەڕەکانی ماڵپەڕ</b>", "kmr": "🗺 <b>Hemû rûpelên malperê</b>",
              "ar": "🗺 <b>كل صفحات الموقع</b>", "en": "🗺 <b>Every page of the site</b>"},
    "body": {"fa": "{n} صفحه در {c} بخش؛ هر دکمه همان صفحه را داخل تلگرام باز می‌کند:", "ckb": "{n} پەڕە لە {c} بەشدا؛ هەر دوگمەیەک پەڕەکە لەناو تێلێگرام دەکاتەوە:",
             "kmr": "{n} rûpel di {c} beşan de; her bişkok rûpelê di Telegramê de vedike:", "ar": "{n} صفحة في {c} أقسام؛ كل زر يفتح الصفحة داخل تيليغرام:",
             "en": "{n} pages in {c} sections; each button opens the page inside Telegram:"},
}


def pages():
    out = []
    for c in C.NAV:
        out.append((c["t"], [(h, t) for h, ic, t, _ in c["items"]]))
    out.append((C.L("نبرد", "شەڕ", "Battle"), [(C.BATTLE[0], C.BATTLE[2])]))
    return out


def L(d, lang):
    return pick(d, lang)


def section(lang, load=None):
    ps = pages()
    n = sum(len(x) for _, x in ps)
    lines = [L(TXT["title"], lang), L(TXT["body"], lang).format(n=n, c=len(ps))]
    for t, items in ps:
        lines.append(f"\n<b>{L(t, lang)}</b>: " + " · ".join(L(x, lang) for _, x in items))
    return "\n".join(lines)[:4000]


def open_rows(lang):
    rows, row = [], []
    for _, items in pages():
        for h, t in items:
            url = SITE + h
            web = h.startswith("/") and "#" not in h and not h.endswith(".xml")
            row.append({"text": L(t, lang)[:40], **({"web_app": {"url": url}} if web else {"url": url})})
            if len(row) == 2:
                rows.append(row)
                row = []
    if row:
        rows.append(row)
    return rows


if __name__ == "__main__":
    bad = 0
    for lang in ("fa", "ckb", "kmr", "ar", "en"):
        rows = open_rows(lang)
        btn = [b for r in rows for b in r]
        n = sum(len(x) for _, x in pages())
        if len(btn) != n or len(btn) > 99 or any(not b["text"] for b in btn):
            print("FAIL", lang, len(btn), n); bad += 1
        if not any(b.get("web_app", {}).get("url") == SITE + "/world/" for b in btn):
            print("FAIL", lang, "world missing"); bad += 1
        if len(section(lang)) > 4000:
            print("FAIL", lang, "long"); bad += 1
    print(f"bot_pages self-test: {bad} failures ({n} pages)")
    raise SystemExit(1 if bad else 0)
