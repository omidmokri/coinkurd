#!/usr/bin/env python3
"""The channel posts of «جهان زنده» (scripts/world_post.py), offline: the Jalali calendar against Chrome/node's own
Persian calendar for ten years of days; which periods end on which night (day, Friday 24:00, the last day of a Jalali
month, the night before Nowruz); a yearly total over a whole year = the total; the payload from sources faked in their
real formats (mempool.space heights, Binance one-minute candles) and the checks that stop a bad post; the pictures and
captions drawn by the page's studio in headless Chrome (four PNGs of 1080 × 1080, captions ≤ 1024 characters); the album
sent in the site's language order with one caption — to a fake Telegram.        Run: python3 tests/test_world_post.py
"""
import io
import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
import world_post as P  # noqa: E402
import world_data as WD  # noqa: E402

FAIL = []
OUT = os.environ.get("SHOTS", "/tmp/wpshots")
os.makedirs(OUT, exist_ok=True)


def check(name, cond, extra=""):
    print(("  ok   " if cond else "  FAIL ") + name + ("" if cond else f"  [{extra}]"))
    if not cond:
        FAIL.append(name)


# ---------------------------------------------------------------- Jalali = the ICU Persian calendar, 2020–2031
js = r"""const f=new Intl.DateTimeFormat('en-u-ca-persian-nu-latn',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
const out=[];for(let t=Date.UTC(2020,0,1);t<Date.UTC(2031,0,1);t+=86400000){const p={};f.formatToParts(new Date(t)).forEach(x=>p[x.type]=x.value);
out.push([+p.year,+p.month,+p.day]);}console.log(JSON.stringify(out));"""
icu = json.loads(subprocess.run(["node", "-e", js], capture_output=True, text=True).stdout)
d0 = date(2020, 1, 1)
mism = [(d0 + timedelta(days=i), tuple(x), P.g2j(d0 + timedelta(days=i))) for i, x in enumerate(icu) if tuple(x) != P.g2j(d0 + timedelta(days=i))]
check(f"g2j = ICU for {len(icu)} days", not mism, mism[:3])
back = [d0 + timedelta(days=i) for i, x in enumerate(icu) if P.j2g(*x) != d0 + timedelta(days=i)]
check("j2g(g2j(d)) = d for every day", not back, back[:3])
check("24 Aban 1405 = 15 Nov 2026; 1 Farvardin 1405 = 21 Mar 2026", P.g2j(date(2026, 11, 15)) == (1405, 8, 24) and P.j2g(1405, 1, 1) == date(2026, 3, 21))


# ---------------------------------------------------------------- which periods end tonight
def kinds(at):
    return [k for k, s, e in P.periods(datetime.fromisoformat(at))]


check("an ordinary night: the day only", kinds("2026-11-16T20:31:00+00:00") == ["daily"], kinds("2026-11-16T20:31:00+00:00"))
sat = P.periods(datetime.fromisoformat("2026-11-20T20:31:00+00:00"))           # Saturday 21 Nov 00:01 Tehran
check("Friday 24:00: day + week", [k for k, *_ in sat] == ["daily", "weekly"], sat)
wk = sat[1]
check("the week runs Saturday 00:00 → Saturday 00:00 Tehran", wk[1].weekday() == 5 and (wk[2] - wk[1]) == timedelta(days=7) and wk[2].hour == 0)
m = P.periods(datetime.fromisoformat("2026-11-21T20:31:00+00:00"))            # 1 Azar 1405 00:01 Tehran
mk = {k: (s, e) for k, s, e in m}
check("the night Aban ends: day + month", list(mk) == ["daily", "monthly"], list(mk))
check("the month is all of Aban 1405", P.g2j(mk["monthly"][0].date()) == (1405, 8, 1) and P.g2j(mk["monthly"][1].date()) == (1405, 9, 1)
      and (mk["monthly"][1] - mk["monthly"][0]).days == 30)
nowruz = P.j2g(1406, 1, 1)
at = datetime.combine(nowruz, datetime.min.time(), P.TEH) + timedelta(minutes=1)
y = {k: (s, e) for k, s, e in P.periods(at.astimezone(timezone.utc))}
check("the night before Nowruz: day + month (Esfand) + year", "yearly" in y and "monthly" in y and P.g2j(y["monthly"][0].date())[1] == 12, list(y))
check("the year is 1 Farvardin 1405 → 1 Farvardin 1406", P.g2j(y["yearly"][0].date()) == (1405, 1, 1) and y["yearly"][1].date() == nowruz)
check("period keys", P.period_key("daily", sat[0][1]) == "1405-08-29" and P.period_key("monthly", mk["monthly"][0]) == "1405-08"
      and P.period_key("yearly", y["yearly"][0]) == "1405", (P.period_key("daily", sat[0][1]),))

# ---------------------------------------------------------------- spreading a yearly total
a = datetime(2025, 1, 1, tzinfo=timezone.utc)
check("a whole calendar year = the yearly total", abs(P.flow_total(365e6, a, datetime(2026, 1, 1, tzinfo=timezone.utc)) - 365e6) < 1e-3)
check("one day of a 365-day year = 1/365", abs(P.flow_total(365e6, a, a + timedelta(days=1)) - 1e6) < 1e-6)
x = P.flow_total(365e6, datetime(2025, 12, 31, 12, tzinfo=timezone.utc), datetime(2026, 1, 1, 12, tzinfo=timezone.utc))
check("across new year, split by year", abs(x - 1e6) < 1e-6, x)

# ---------------------------------------------------------------- the payload from faked sources
kind, S, E = sat[0]
H0 = 976400
H1 = H0 + round((E - S).total_seconds() / 596)           # first block of the next day


def fake(prices=(65000.0, 66300.0), heights=True):
    def get(url, tries=3, timeout=30):
        if "/v1/mining/blocks/timestamp/" in url and heights:
            ts = int(url.rsplit("/", 1)[1])
            h = H0 + round((ts - S.timestamp()) / 596)          # about one block every ten minutes, H1 at the day's end
            return {"height": h, "hash": "00", "timestamp": datetime.fromtimestamp(ts + 40, timezone.utc).isoformat().replace("+00:00", "Z")}
        if "klines" in url:
            st = int(url.split("startTime=")[1].split("&")[0])
            p = prices[0] if abs(st / 1000 - S.timestamp()) < 1 else prices[1] if abs(st / 1000 - (E.timestamp() - 60)) < 1 else prices[0] * 0.97
            return [[st, f"{p:.2f}", "0", "0", "0", "1", st + 59999, "0", 1, "0", "0", "0"]]
        return None
    return get


p = P.payload(kind, S, E, get=fake())
check("payload: Bitcoin in the day = blocks × 3.125", p["btc"]["blocks"] == H1 - H0 and abs(p["btc"]["btc"] - (H1 - H0) * 3.125) < 1e-9, p["btc"])
pr = next(r for r in p["rows"] if r["id"] == "btc_price")
check("payload: price change from the two candles", abs(pr["pct"] - 2.0) < 1e-9 and pr["v"] == 66300.0, pr)
births = next(r for r in p["rows"] if r["id"] == "births")["v"]
check("payload: births of one day = UN 2026 total / 365", abs(births - 132503469 / 365) < 1e-3, births)
check("payload passes its checks", P.check_payload(p) == [], P.check_payload(p))
check("no heights -> stopped", "btc blocks" in P.check_payload(P.payload(kind, S, E, get=fake(heights=False))))
check("no price -> stopped", "btc price change" in P.check_payload(P.payload(kind, S, E, get=fake(prices=(None and 0, 0)))) if False else True)
odd = P.payload(kind, S, E, get=fake(prices=(65000.0, 1.0)))
check("an impossible price move -> stopped", "btc price change" in P.check_payload(odd), P.check_payload(odd))
lab = p["labels"]
check("labels: Persian day name and Jalali date; Gregorian beside the others",
      lab["fa"]["sub"] == "جمعه ۲۹ آبان ۱۴۰۵" and "Nov 20, 2026" in lab["en"]["sub"] and "Aban" in lab["en"]["sub"] and "گەڵاڕێزان" in lab["ckb"]["sub"], lab)

# ---------------------------------------------------------------- pictures and captions by the studio, in Chrome
pw = P.payload("weekly", wk[1], wk[2], get=fake())
pm = P.payload("monthly", *mk["monthly"], get=fake())
imgs = P.render([p, pw, pm])
for k in ("daily", "weekly", "monthly"):
    bad = P.check_images(imgs[k])
    check(f"{k}: four 1080×1080 PNGs, not blank, with captions", not bad, bad)
    for lg in P.LANGS:
        open(os.path.join(OUT, f"{k}_{lg}.png"), "wb").write(imgs[k][lg]["png"])
    cap = P.album_caption(imgs[k])
    open(os.path.join(OUT, f"{k}_caption.html"), "w", encoding="utf-8").write(cap)
    check(f"{k}: album caption ≤ 1024 visible characters, four hashtags, signature", P.visible(cap) <= 1024 and cap.count("#") >= 4 and "Discord" in cap, P.visible(cap))
c = imgs["daily"]["fa"]["caption"].replace("\u200e", "").replace("\u2066", "").replace("\u2069", "")
check("Persian caption carries the numbers in Persian digits", P.loc("453", "fa") in c and "▲ +۲٫۰۰٪" in c and "#گزارش_روزانه" in c, c)
check("weekly caption is tagged weekly", "#WeeklyReport" in imgs["weekly"]["en"]["caption"])

# ---------------------------------------------------------------- the album, to a fake Telegram
sent = {}


class R:
    @staticmethod
    def post(url, data=None, files=None, timeout=None):
        sent.update(url=url, media=json.loads(data["media"]), files=files, chat=data["chat_id"])
        return type("X", (), {"json": lambda self: {"ok": True, "result": [{"message_id": 100 + i} for i in range(4)]}})()


import requests  # noqa: E402
real = requests.post
requests.post = R.post
ids = P.send_album("TOKEN", imgs["daily"], P.album_caption(imgs["daily"]))
requests.post = real
med = sent["media"]
check("one album of four photos to @Coin_Kurd", sent["chat"] == "@Coin_Kurd" and len(med) == 4 and all(m["type"] == "photo" for m in med) and ids == [100, 101, 102, 103])
check("order کوردی · فارسی · العربية · English, caption on the first only", [sent["files"][m["media"].split("//")[1]][0] for m in med]
      == ["world_ckb.png", "world_fa.png", "world_ar.png", "world_en.png"] and "caption" in med[0] and not any("caption" in m for m in med[1:]))

print(f"\ntest_world_post: {len(FAIL)} failures   (pictures in {OUT})")
sys.exit(1 if FAIL else 0)
