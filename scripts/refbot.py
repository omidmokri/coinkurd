"""
Coin_Kurd / Entekhab Telegram bot — runs inside GitHub Actions (no server).

Brings every section of entekhab.net into Telegram (market, brain, coin cards,
scanner, score, news, narratives, calendar, AI council, derivatives, lab,
cycle, on-chain, flows, DNA, track record, indicators, channel archive search)
in Persian, Sorani Kurdish, Kurmanji, Arabic and English, plus price and % alerts, a daily brief,
the referral programme and the group join-gate.

v2 adds: token check by contract address with scam/rug warnings, whale / volume / new-launch /
indicator-signal alerts, portfolio + read-only wallets, wallet follow (copy-trade lite, nothing is
executed), DCA reminders, a position-size calculator, lessons + local regulatory notes, and
Iran-outage readiness (outage detection, ranked proxies with in-Iran feedback, kit + catch-up digest).
The bot never asks for keys and never trades.

Each run long-polls Telegram for RUN_SECONDS, then exits. State (users, points,
alerts, language) lives in a JSON file that the workflow keeps on the
`refbot-state` branch; it is also pushed every STATE_PUSH_EVERY seconds.
"""
import base64
import hashlib
import hmac
import json
import threading
import logging
import os
import re
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bot_data as D  # noqa: E402
import bot_iran as IR  # noqa: E402
import bot_feeds as F  # noqa: E402
import bot_videos as V  # noqa: E402
import bot_deep as DP  # noqa: E402
import bot_hub as HB  # noqa: E402
import bot_clips as CL  # noqa: E402
import bot_proxy as PX  # noqa: E402
import bot_proxy2 as PX2  # noqa: E402
import bot_outage as OU  # noqa: E402
import bot_token as TK  # noqa: E402
import bot_watch as W  # noqa: E402
import bot_learn as LN  # noqa: E402
import bot_academy as AK  # noqa: E402
import bot_psych as PY_  # noqa: E402
import bot_menu as MN  # noqa: E402
import bot_art as ART  # noqa: E402
import bot_fixmedia as FX  # noqa: E402
from bot_i18n import AR, KMR, LANG_NAMES, LANGS, pick, t  # noqa: E402

TOKEN = os.environ.get("REF_BOT_TOKEN") or os.environ.get("TG_BOT_TOKEN") or ""
CHANNEL = os.environ.get("CHANNEL", "@Coin_Kurd")
CHANNEL_LINK = os.environ.get("CHANNEL_LINK", "https://t.me/Coin_Kurd")
GROUP = os.environ.get("GROUP", "@Coin_Kurd_Group").strip()
ADMIN_IDS = {int(x) for x in os.environ.get("ADMIN_IDS", "").split(",") if x.strip().lstrip("-").isdigit()}
REWARD_AT = int(os.environ.get("REWARD_AT") or "5")
REWARD_TEXT = os.environ.get("REWARD_TEXT") or "🎁 تبریک! به {n} دعوت رسیدی. برای دریافت پاداش به ادمین پیام بده."
RUN_SECONDS = int(os.environ.get("RUN_SECONDS", "840"))
STATE = os.environ.get("STATE_PATH", "data/bot/referrals.json")
PUBLIC = os.environ.get("PUBLIC_PATH", "data/bot/leaderboard.json")
STATE_ENC = STATE + ".enc"                               # encrypted at rest: the refbot-state branch is public
STATE_GIT = os.environ.get("STATE_GIT", "")              # dir of a git checkout to push periodically
STATE_PUSH_EVERY = int(os.environ.get("STATE_PUSH_EVERY", "600"))
MAIN_WT = os.environ.get("MAIN_WORKTREE", "")            # checkout of main used to publish feeds to the site
BRIEF_HOUR = int(os.environ.get("BRIEF_HOUR_UTC", "5"))   # 05:00 UTC ≈ 08:30 Tehran
API = f"https://api.telegram.org/bot{TOKEN}/"
MAX_ALERTS = 0            # 0 = no limit; the list below is paged so Telegram's row cap is never the reason to stop
ALERT_PAGE = 18          # alert rows per keyboard page
WATCH_PCT = float(os.environ.get("WATCH_PCT", "1.0"))
WATCH_MIN = 15
LIVE = {}          # (chat_id, message_id) -> {until, uid}
USDT_SERIES = []   # [(ts, price)] for the tether spike watch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("refbot")


# ================================================================== state
# The state holds Telegram ids, names and alerts, and the branch it lives on is public, so it is
# stored encrypted (stdlib only): HMAC-SHA256 in counter mode as the key stream + an HMAC-SHA256 tag
# over version|nonce|ciphertext (encrypt-then-MAC). The key comes from STATE_KEY if set, else from the
# bot token — both are Actions secrets, so nobody reading the branch can decrypt it.
def _state_keys():
    root = (os.environ.get("STATE_KEY") or TOKEN or "").encode()
    if not root:
        return None
    prk = hmac.new(b"entekhab-refbot-state-v1", root, hashlib.sha256).digest()
    return hmac.new(prk, b"enc", hashlib.sha256).digest(), hmac.new(prk, b"mac", hashlib.sha256).digest()


def _keystream(key, nonce, n):
    out = bytearray()
    for ctr in range((n + 31) // 32):
        out += hmac.new(key, nonce + ctr.to_bytes(8, "big"), hashlib.sha256).digest()
    return bytes(out[:n])


def _xor(a, b):
    return (int.from_bytes(a, "big") ^ int.from_bytes(b, "big")).to_bytes(len(a), "big") if a else b""


def seal(plain, keys):
    ek, mk = keys
    nonce = os.urandom(16)
    ct = _xor(plain, _keystream(ek, nonce, len(plain)))
    return b"v1" + nonce + ct + hmac.new(mk, b"v1" + nonce + ct, hashlib.sha256).digest()


def unseal(blob, keys):
    ek, mk = keys
    if len(blob) < 50 or blob[:2] != b"v1":
        raise ValueError("unknown format")
    nonce, ct, tag = blob[2:18], blob[18:-32], blob[-32:]
    if not hmac.compare_digest(tag, hmac.new(mk, b"v1" + nonce + ct, hashlib.sha256).digest()):
        raise ValueError("wrong key or tampered file")
    return _xor(ct, _keystream(ek, nonce, len(ct)))


def load_state():
    s, keys = None, _state_keys()
    if keys and os.path.exists(STATE_ENC):
        try:
            with open(STATE_ENC, encoding="ascii") as f:
                s = json.loads(unseal(base64.b64decode(f.read()), keys).decode("utf-8"))
        except Exception as ex:  # noqa: BLE001 — e.g. the token was rotated without setting STATE_KEY
            bak = f"{STATE_ENC}.{int(time.time())}.unreadable"
            os.replace(STATE_ENC, bak)
            log.error("encrypted state unreadable (%s); kept as %s and starting fresh", ex, bak)
            s = None
    if s is None:                                   # first run, or one-time migration from the old plaintext file
        try:
            with open(STATE, encoding="utf-8") as f:
                s = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            s = {}
    s.setdefault("offset", 0)
    s.setdefault("users", {})   # uid -> {username,name,referrer,joined,created,lang,brief,alerts,rewarded}
    s.setdefault("last_brief", "")
    s.setdefault("proxy", "")
    s.setdefault("watch_last", 0)
    return s


def save_state(s):
    d = os.path.dirname(STATE)
    if d:
        os.makedirs(d, exist_ok=True)
    keys = _state_keys()
    raw = None
    for _ in range(5):                              # a watcher thread may be mid-update; retry a moment later
        try:
            raw = json.dumps(s, ensure_ascii=False, separators=(",", ":"))
            break
        except RuntimeError:
            time.sleep(0.2)
    if raw is None:
        log.warning("state busy; save skipped this round")
        return
    if keys:
        blob = seal(raw.encode("utf-8"), keys)
        tmp = STATE_ENC + ".tmp"
        with open(tmp, "w", encoding="ascii") as f:
            f.write(base64.b64encode(blob).decode("ascii"))
        os.replace(tmp, STATE_ENC)
        if os.path.exists(STATE):                   # the plaintext copy leaves the public branch
            os.remove(STATE)
    else:                                           # local runs without a token
        tmp = STATE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(raw)
        os.replace(tmp, STATE)
    with open(PUBLIC, "w", encoding="utf-8") as f:
        json.dump({"updated": int(time.time()), "reward_at": REWARD_AT, "users": len(s["users"]),
                   "top": [{"name": n, "points": p} for _, n, p in leaderboard(s, 20)]},
                  f, ensure_ascii=False, indent=1)


def push_state():
    if not STATE_GIT:
        return
    try:
        run = lambda *a: subprocess.run(["git", "-C", STATE_GIT, *a], capture_output=True, text=True, timeout=60)
        run("add", "-A")
        if run("diff", "--cached", "--quiet").returncode == 0:
            return
        run("commit", "-q", "-m", f"refbot state {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC")
        r = run("push", "-q", "origin", "HEAD:refbot-state")
        log.info("state pushed (%s)", "ok" if r.returncode == 0 else r.stderr.strip()[:200])
    except Exception as ex:
        log.warning("push_state failed: %s", ex)


def user(s, uid):
    return s["users"].get(str(uid))


def upsert(s, u, referrer=None):
    uid = str(u["id"])
    x = s["users"].get(uid)
    if x is None:
        if referrer is not None and str(referrer) == uid:
            referrer = None
        lc = (u.get("language_code") or "").lower()
        lang = ("en" if lc.startswith("en") else "ar" if lc.startswith("ar")
                else "kmr" if lc in ("ku", "kmr") or lc.startswith("tr") else "fa")
        x = s["users"][uid] = {"username": u.get("username"), "name": u.get("first_name", ""),
                               "referrer": referrer, "joined": False, "created": int(time.time()),
                               "lang": lang}
    else:
        x["username"], x["name"] = u.get("username"), u.get("first_name", "")
    x.setdefault("lang", "fa")
    x.setdefault("alerts", [])
    x.setdefault("brief", False)
    return x


def lang_of(s, uid):
    x = user(s, uid)
    return (x or {}).get("lang", "fa")


def mark_joined(s, uid):
    x = user(s, uid)
    if not x or x["joined"]:
        return None
    x["joined"] = True
    return x["referrer"]


def points(s, uid):
    return sum(1 for x in s["users"].values() if x["referrer"] == uid and x["joined"])


def leaderboard(s, n=10):
    counts = {}
    for x in s["users"].values():
        if x["joined"] and x["referrer"] is not None:
            counts[x["referrer"]] = counts.get(x["referrer"], 0) + 1
    rows = []
    for uid, p in sorted(counts.items(), key=lambda kv: -kv[1])[:n]:
        info = s["users"].get(str(uid), {})
        name = f"@{info['username']}" if info.get("username") else (info.get("name") or str(uid))
        rows.append((uid, name, p))
    return rows


# ================================================================== telegram
def tg(method, **params):
    try:
        r = requests.post(API + method, json=params, timeout=60)
        data = r.json()
        if not data.get("ok") and "message is not modified" not in str(data.get("description")):
            log.warning("%s -> %s", method, data.get("description"))
        return data
    except Exception as ex:
        log.warning("%s failed: %s", method, ex)
        return {"ok": False}


_AMP = re.compile(r"&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);)")


def fix_amp(text):
    """escape bare '&' so Telegram's HTML parser never rejects a message"""
    return _AMP.sub("&amp;", text or "")


def send(chat_id, text, kb=None, preview=False, **kw):
    text = fix_amp(text)
    p = dict(chat_id=chat_id, text=text, parse_mode="HTML",
             link_preview_options={"is_disabled": not preview}, **kw)
    if kb:
        p["reply_markup"] = kb
    return tg("sendMessage", **p)


def edit(chat_id, mid, text, kb=None):
    text = fix_amp(text)
    p = dict(chat_id=chat_id, message_id=mid, text=text, parse_mode="HTML",
             link_preview_options={"is_disabled": True})
    if kb:
        p["reply_markup"] = kb
    r = tg("editMessageText", **p)
    if not r.get("ok") and "not modified" not in str(r.get("description")):
        send(chat_id, text, kb)


def is_member(uid):
    d = tg("getChatMember", chat_id=CHANNEL, user_id=uid)
    return bool(d.get("ok")) and d["result"]["status"] in ("member", "administrator", "creator")


BOT_USERNAME = None


def invite_link(uid):
    return f"https://t.me/{BOT_USERNAME}?start={uid}"


# ================================================================== keyboards
def btn(text, data=None, url=None):
    return {"text": text, "url": url} if url else {"text": text, "callback_data": data}


def kb_main(lang, s=None):
    b = lambda k, d: btn(t(k, lang), d)
    rows = []
    if s is not None and OU.level(s) != "ok":            # Iran outage: the guide goes first
        rows.append([b("b_outage_live", "m:outage")])
    rows += [
        [b("b_irr", "m:irr")],
        [b("b_token", "m:token"), b("b_pf", "m:pf")],
        [b("b_center", "m:center"), b("b_learn", "m:learn")],
        [b("b_proxy", "m:proxy"), b("b_outage", "m:outage")],
        [b("b_market", "m:mkt"), b("b_brain", "m:brain")],
        [b("b_coin", "m:coin"), b("b_opps", "m:opps")],
        [b("b_movers", "m:movers"), b("b_score", "m:score")],
        [b("b_news", "m:news"), b("b_narr", "m:narr")],
        [b("b_events", "m:events"), b("b_council", "m:council")],
        [b("b_deriv", "m:deriv"), b("b_lab", "m:lab")],
        [b("b_cycle", "m:cycle"), b("b_chain", "m:chain")],
        [b("b_flows", "m:flows"), b("b_week", "m:week")],
        [b("b_posts", "m:posts"), b("b_track", "m:track")],
        [b("b_ind", "m:ind"), b("b_alerts", "m:alerts")],
        [b("b_follow", "m:follow"), b("b_dca", "m:dca")],
        [b("b_ref", "m:ref"), b("b_lang", "m:lang")],
        [b("b_predict", "m:predict")],
        [btn(t("b_site", lang), url=D.SITE)],
    ]
    return {"inline_keyboard": rows}


def kb_lab(lang):
    b = lambda k, d: btn(t(k, lang), d)
    return {"inline_keyboard": [
        [b("b_mc", "m:mc"), b("b_mem", "m:mem")],
        [b("b_vol", "m:vol"), b("b_opt", "m:opt")],
        [b("b_xex", "m:xex"), b("b_dev", "m:dev")],
        [b("b_macro", "m:macro"), b("b_dna", "m:dna")],
        [btn(t("b_more", lang), url=D.SITE + "/lab/"), b("b_back", "m:main")]]}


def kb_back(lang, refresh=None, more=None):
    row = []
    if refresh:
        row.append(btn(t("b_refresh", lang), refresh))
    row.append(btn(t("b_back", lang), "m:main"))
    rows = [row]
    if more:
        rows.insert(0, [btn(t("b_more", lang), url=more)])
    return {"inline_keyboard": rows}


def kb_coins(lang):
    pick = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "LINK", "AVAX", "SUI", "LTC", "HYPE"]
    rows = [[btn(c, f"c:{c}") for c in pick[i:i + 4]] for i in range(0, len(pick), 4)]
    return {"inline_keyboard": rows}


def kb_coin(coin, lang):
    return {"inline_keyboard": [
        [btn("🎯", f"co:{coin}"), btn("📰", f"cn:{coin}"), btn("📢", f"cp:{coin}"), btn("🧬", f"cd:{coin}"),
         btn("🔔", f"ca:{coin}"), btn(t("b_refresh", lang)[:2], f"c:{coin}")],
        [btn(t("b_more", lang), url=D.coin_url(coin))], MN.coin_nav(lang)]}


def alert_label(a, lang):
    return IR.L3(IR.ASSET_NAME.get(a["coin"], {"fa": a["coin"]}), lang) if a.get("iran") else a["coin"]


def alert_spec(a, lang):
    """'≥ 80,000' or '±5% (77,000)' for the alert list"""
    if a.get("op") == "±":
        return f"±{a['pct']:g}% ({fmt_alert_price(a, a['ref'])})"
    return f"{'≥' if a['op'] == '>' else '≤'} {fmt_alert_price(a, a['price'])}"


def fmt_alert_price(a, p):
    return IR.toman(p) if a.get("iran") and a["coin"] not in ("XAU", "XAG") else D.fp(p)


def kb_irr(lang, live=False):
    rows = [[btn(t("b_refresh", lang), "m:irr")] + ([] if live else [btn(t("b_live", lang), "live:irr")]),
            [btn(t("b_alerts", lang), "qa:USDT"), btn(t("b_calc", lang), "calc")],
            [btn(t("b_lite", lang), "m:lite"), btn(t("b_proxy", lang), "m:proxy")],
            [btn(t("b_back", lang), "m:main")]]
    return {"inline_keyboard": rows}


def kb_lang():
    return {"inline_keyboard": [[btn(LANG_NAMES["ckb"], "l:ckb"), btn(LANG_NAMES["kmr"], "l:kmr")],
                                [btn(LANG_NAMES["fa"], "l:fa"), btn(LANG_NAMES["ar"], "l:ar")],
                                [btn(LANG_NAMES["en"], "l:en")]]}


def kb_join(lang):
    return {"inline_keyboard": [[btn(t("b_join", lang), url=CHANNEL_LINK)], [btn(t("b_joined", lang), "check")]]}


def kb_ref(uid, lang):
    link = invite_link(uid)
    share = "https://t.me/share/url?" + urllib.parse.urlencode({"url": link, "text": t("share_text", lang)})
    return {"inline_keyboard": [[btn(t("b_share", lang), url=share)],
                                [btn(t("b_top", lang), "m:top"), btn(t("b_back", lang), "m:main")]]}


def kb_alerts(s, uid, lang, page=0):
    """alerts are unlimited, so the delete buttons are paged — Telegram allows ~100 keyboard rows"""
    x = user(s, uid) or {}
    sub = x.get("brief")
    rows = [[btn(t("b_sub_off" if sub else "b_sub_on", lang), "brief")],
            [btn(t("b_watch_off" if x.get("watch") else "b_watch_on", lang), "watch")]]
    al = list(enumerate(x.get("alerts", []), 1))
    ta = [("T%d" % i, f"td:{i}", f"${a['s']} ±{a['pct']:g}%") for i, a in enumerate(x.get("talerts", []), 1)]
    items = [(str(i), f"ad:{i}", f"{alert_label(a, lang)} {alert_spec(a, lang)}") for i, a in al] + ta
    pages = max(1, -(-len(items) // ALERT_PAGE))
    page = max(0, min(page, pages - 1))
    for lab, cb, txt in items[page * ALERT_PAGE:(page + 1) * ALERT_PAGE]:
        rows.append([btn(f"🗑 {lab}. {txt}"[:60], f"{cb}.{page}")])
    if pages > 1:
        back, fwd = ("▶", "◀") if lang in ("fa", "ckb", "ar") else ("◀", "▶")
        nav = []
        if page:
            nav.append(btn(back, f"ap:{page - 1}"))
        nav.append(btn(t("alert_page", lang, p=page + 1, n=pages), "noop"))
        if page < pages - 1:
            nav.append(btn(fwd, f"ap:{page + 1}"))
        rows.append(nav)
    rows.append([btn(t("b_back", lang), "m:main")])
    return {"inline_keyboard": rows}


# ================================================================== sections
SECTIONS = {
    "mkt": (D.sec_market, "/dashboard/"), "brain": (D.sec_brain, "/dashboard/"),
    "opps": (D.sec_opps, "/dashboard/"), "movers": (D.sec_movers, "/dashboard/"),
    "score": (D.sec_score, "/coins/"), "news": (D.sec_news, "/"), "narr": (D.sec_narr, "/dashboard/"),
    "events": (D.sec_events, "/dashboard/"), "council": (D.sec_council, "/lab/"),
    "deriv": (D.sec_deriv, "/terminal/"), "cycle": (D.sec_cycle, "/lab/"), "chain": (D.sec_chain, "/terminal/"),
    "flows": (D.sec_flows, "/terminal/"), "week": (D.sec_week, "/"), "track": (D.sec_track, "/status/"),
    "ind": (D.sec_ind, "/indicators/"), "posts": (D.sec_posts, "/"),
    "mc": (D.sec_mc, "/lab/"), "mem": (D.sec_mem, "/lab/"), "vol": (D.sec_vol, "/lab/"),
    "opt": (D.sec_opt, "/lab/"), "xex": (D.sec_xex, "/lab/"), "dev": (D.sec_dev, "/lab/"),
    "macro": (D.sec_macro, "/lab/"), "dna": (D.sec_dna, "/dna/"),
}
LAB = {"mc", "mem", "vol", "opt", "xex", "dev", "macro", "dna"}


def market_age_min():
    try:
        iso = (D.load("market") or {}).get("updated_at")
        dt = datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - dt).total_seconds() / 60
    except Exception:
        return None


def render(s, uid, key, page=0):
    """-> (text, keyboard) for a menu key, laid out by bot_menu (8-section home, 4 sub-menus, standard nav)"""
    lang = lang_of(s, uid)
    x = user(s, uid) or {}
    if key == "main":
        lvl = OU.level(s)
        out_btn = btn(t("b_outage_live", lang), "m:outage") if lvl != "ok" else None
        text, rows = MN.home(x, lang, MN.status_line(lang, market_age_min(), lvl), out_btn)
        return text, {"inline_keyboard": rows}
    if key in MN.GROUPS:
        text, rows = MN.group(key, lang)
        return text, {"inline_keyboard": rows}
    text, kb = _render(s, uid, key)
    if x:
        MN.recent(x, key)
    return MN.decorate(key, text, kb, lang, x if x else None)


def _render(s, uid, key):
    """section content; navigation is added by render()"""
    lang = lang_of(s, uid)
    x = user(s, uid) or {}
    if key == "mkt":
        try:
            body = D.sec_market(lang)
        except Exception:
            log.exception("market failed")
            body = t("no_data", lang)
        return (MN.L(MN.T["intro_mkt"], lang) + "\n\n" + body,
                {"inline_keyboard": [[btn(MN.name("irr", lang), "m:irr"), btn(MN.name("lite", lang), "m:lite")],
                                     [btn(t("b_refresh", lang), "m:mkt"), btn(t("b_more", lang), url=D.SITE + "/dashboard/")]]})
    if key == "irr":
        try:
            card = IR.bot_board(lang) or IR.card(lang)
            try:
                warn = OU.banner(s, lang)
            except Exception:
                warn = ""
            return ((warn + "\n\n") if warn else "") + card, kb_irr(lang)
        except Exception:
            log.exception("irr card failed")
            return t("no_data", lang), kb_back(lang)
    if key == "lite":
        try:
            text = OU.compact(lang, D)
        except Exception:
            log.exception("lite card failed")
            text = t("no_data", lang)
        return text, kb_back(lang, refresh="m:lite")
    if key == "proxy":
        try:
            text, rows = PX2.section(s, lang, D.e, isp=x.get("isp"))
        except Exception:
            log.exception("proxy2 section failed; falling back to v1")
            try:
                text, rows = PX.section(s, lang, D.e)
            except Exception:
                log.exception("proxy section failed")
                text, rows = (D.e(s["proxy"]) if s.get("proxy") else t("proxy_none", lang)), []
        kb = kb_back(lang, refresh="m:proxy")
        kb["inline_keyboard"] = rows + kb["inline_keyboard"]
        return text, kb
    if key == "outage":
        text = OU.section(s, lang)
        kb = {"inline_keyboard": [
            [btn(t("b_proxy", lang), "m:proxy"), btn(OU.L(OU.T["b_compact"], lang), "m:lite")],
            [btn(OU.L(OU.T["sub_off" if x.get("kit") else "sub_on"], lang), "ot:kit")],
            [btn(t("b_learn", lang), "m:learn"), btn(t("b_back", lang), "m:main")]]}
        return text, kb
    if key == "token":
        x["await"] = "ca"
        return MN.L(MN.T["intro_token"], lang), kb_back(lang)
    if key == "pf":
        try:
            text = W.pf_view(x, lang, D, IR, cached_only=True)
        except Exception:
            log.exception("portfolio failed")
            text = t("no_data", lang)
        return MN.L(MN.T["intro_pf"], lang) + "\n\n" + text, kb_back(lang, refresh="m:pf")
    if key == "center":
        kb = {"inline_keyboard": W.center_rows(x, lang, bool(x.get("kit")))}
        return MN.L(MN.T["intro_center"], lang), kb
    if key == "follow":
        text, rows = W.follow_view(s, x, lang)
        return text, {"inline_keyboard": rows + [[btn(t("b_back", lang), "m:main")]]}
    if key == "dca":
        return W.dca_view(x, lang, D) + "\n\n" + W.L(W.T["size_help"], lang), kb_back(lang)
    if key == "learn":
        text, rows = LN.menu(lang)
        return text, {"inline_keyboard": rows + [[btn(t("b_back", lang), "m:main")]]}
    if key == "predict":
        text, rows = HB.section(s, uid)
        kb = kb_back(lang, refresh="m:predict", more=D.SITE + "/predict/")
        kb["inline_keyboard"] = rows + kb["inline_keyboard"]
        return text, kb
    if key == "lab":
        return f"🧪 <b>{t('b_lab', lang)[2:]}</b>", kb_lab(lang)
    if key == "coin":
        return t("ask_coin", lang), kb_coins(lang)
    if key == "lang":
        return t("choose_lang", lang), kb_lang()
    if key == "ref":
        return t("ref_text", lang, goal=REWARD_AT, link=invite_link(uid), p=points(s, uid)), kb_ref(uid, lang)
    if key == "top":
        return format_top(s, lang), kb_back(lang)
    if key == "alerts":
        x = user(s, uid) or {}
        head = f"🔔 <b>{t('b_alerts', lang)[2:]}</b>"
        if not x.get("alerts"):
            head += "\n" + t("alert_none", lang)
        return head + "\n\n" + t("alert_usage", lang), kb_alerts(s, uid, lang, page)
    if key == "news":
        return news_list(s, lang)
    if key in SECTIONS:
        fn, path = SECTIONS[key]
        try:
            text = fn(lang)
            if key in ("chain", "news"):
                feed = F.section(s, "onchain" if key == "chain" else "news", lang, n=2)
                if feed:
                    sep = "\n\n━━━━━━━━━━\n\n"
                    text = D.cut(sep.join(D.e(x) for x in feed) + sep + text, 4000)
        except Exception:
            log.exception("section %s failed", key)
            text = t("no_data", lang)
        if key == "posts":
            text += "\n\n" + t("search_hint", lang)
        if key in LAB:
            return text, {"inline_keyboard": [[btn(t("b_refresh", lang), "m:" + key)]]}
        return text, kb_back(lang, refresh="m:" + key, more=D.SITE + path)
    return t("menu_title", lang), kb_main(lang)


# ------------------------------------------------------------------ news: Persian titles -> full text with picture
def news_items(s):
    deep = [{"id": "d" + x["id"], "fa": re.sub(r"</?b>", "", x["fa"]).split("\n", 1)[-1].strip(), "img": x.get("img"),
             "at": x["at"], "deep": True} for x in (s.get("deep") or {}).get("posts", [])[:4]]
    feed = [x for x in F.feed_state(s)["items"].get("news", []) if x.get("fa")]
    return deep + feed


def news_title(it, lang):
    txt = (it.get("ckb") if lang == "ckb" else None) or it["fa"]
    first = next((ln.strip() for ln in txt.split("\n") if ln.strip()), "")
    return ("🧠 " if it.get("deep") else "📰 ") + (first[:58] + "…" if len(first) > 60 else first)


def news_list(s, lang):
    items = news_items(s)[:14]
    head = {"ckb": "📰 <b>هەواڵەکانی کریپتۆ</b>\nلەسەر هەر هەواڵێک دابگرە بۆ خوێندنەوەی تەواو لەگەڵ وێنە",
            }.get(lang, "📰 <b>اخبار کریپتو</b>\nروی هر خبر بزن تا متن کامل همراه با تصویرش باز شود")
    if not items:
        return head + "\n\n" + t("no_data", lang), kb_back(lang, refresh="m:news", more=D.SITE + "/crypto-news/")
    rows = [[btn(news_title(it, lang), "nw:" + str(it["id"])[:56])] for it in items]
    kb = kb_back(lang, refresh="m:news", more=D.SITE + "/crypto-news/")
    kb["inline_keyboard"] = rows + kb["inline_keyboard"]
    return head, kb


def news_open(s, chat_id, nid, lang):
    it = next((x for x in news_items(s) if str(x["id"])[:56] == nid), None)
    if not it:
        return send(chat_id, t("no_data", lang))
    txt = (it.get("ckb") if lang == "ckb" else None) or it["fa"]
    if it.get("deep"):
        txt = txt[:1000]
    img = it.get("img") or it.get("photo")
    if img and img.startswith("/"):
        img = D.SITE + img
    page = D.SITE + ("/dossier/" if it.get("deep") else "/crypto-news/")
    kb = {"inline_keyboard": [[btn("🔙 " + ("گەڕانەوە بۆ هەواڵەکان" if lang == "ckb" else "بازگشت به اخبار"), "m:news"),
                               btn("🌐 " + ("لە ماڵپەڕ" if lang == "ckb" else "در سایت"), url=page)]]}
    return group_send(chat_id, D.cut(D.e(txt), 1020), kb=kb, photo=img)


def format_top(s, lang):
    rows = leaderboard(s)
    if not rows:
        return t("top_empty", lang)
    medals = ["🥇", "🥈", "🥉"]
    out = [t("top_title", lang), ""]
    for i, (_, name, p) in enumerate(rows):
        out.append(f"{medals[i] if i < 3 else str(i + 1) + '.'} {D.e(name)} — <b>{p}</b>")
    return "\n".join(out)


def coin_card(s, uid, sym):
    lang = lang_of(s, uid)
    try:
        text = D.sec_coin(sym, lang)
    except Exception:
        log.exception("coin card failed")
        text = None
    if not text:
        return t("unknown_coin", lang) + D.e(sym.upper()), kb_coins(lang)
    coin = D.find_coin(sym)["coin"]
    try:
        usdt = IR.snapshot().get("usdt")
        px = D.live_prices().get(coin, (D.find_coin(coin).get("price"),))[0]
        if usdt and px:
            label = pick({"fa": "به تومان", "ckb": "بە تمەن", "en": "in toman"}, lang)
            text = text.replace("\n", f"\n💵 {label}: ≈ {IR.toman(px * usdt)}\n", 1)
    except Exception:
        pass
    return text, kb_coin(coin, lang)


# ================================================================== referral flow
_BANNER_ID = {}          # Telegram file_id of the uploaded banner, reused after the first upload


def welcome(chat_id, lang):
    """banner (drawn by bot_art from the site logo) + welcome text, once per /start; the home screen stays short"""
    cap = MN.L(MN.T["welcome"], lang)
    links = {"inline_keyboard": MN.links_rows(lang)}           # channel, group, guide/site, X, Instagram
    if _BANNER_ID.get("id"):
        r = tg("sendPhoto", chat_id=chat_id, photo=_BANNER_ID["id"], caption=cap, parse_mode="HTML", reply_markup=links)
    else:
        img = ART.banner(BOT_USERNAME or "Kurd_kurdistan_bot")
        r = _post_with_retry("sendPhoto", {"chat_id": chat_id, "caption": cap, "parse_mode": "HTML",
                                           "reply_markup": json.dumps(links)},
                             files={"photo": ("banner.jpg", img, "image/jpeg")}) if img else {"ok": False}
        try:
            _BANNER_ID["id"] = r["result"]["photo"][-1]["file_id"]
        except Exception:
            pass
    if not r.get("ok"):
        send(chat_id, cap, links)


def after_verified(s, uid, chat_id, edit_mid=None):
    referrer = mark_joined(s, uid)
    if referrer is not None:
        p = points(s, referrer)
        rl = lang_of(s, referrer)
        send(referrer, t("ref_new", rl, p=p))
        r = user(s, referrer)
        if p >= REWARD_AT and r is not None and not r.get("rewarded"):
            r["rewarded"] = True
            send(referrer, REWARD_TEXT.format(n=REWARD_AT))
            for a in ADMIN_IDS:
                nm = f"@{r['username']}" if r.get("username") else r.get("name")
                send(a, f"🎁 reward reached: {D.e(nm)} (id <code>{referrer}</code>) — {p} invites")
    welcome(chat_id, lang_of(s, uid))
    text, kb = render(s, uid, "main")
    if edit_mid:
        edit(chat_id, edit_mid, text, kb)
    else:
        send(chat_id, text, kb)


# ================================================================== alerts & brief
def parse_alert(args, s, uid):
    lang = lang_of(s, uid)
    x = user(s, uid)
    parts = args.split()
    if len(parts) == 2 and parts[0].lower() in ("del", "rm", "حذف") and parts[1].isdigit():
        i = int(parts[1]) - 1
        if 0 <= i < len(x["alerts"]):
            x["alerts"].pop(i)
            return t("alert_del", lang)
        return t("alert_none", lang)
    if len(parts) != 2:
        return t("alert_usage", lang)
    sym, val = parts
    pc = W.parse_pct(val)
    if pc:
        return add_pct_alert(s, uid, sym, *pc)
    price = IR.num(val)
    if price is None:
        return t("alert_usage", lang)
    if MAX_ALERTS and len(x["alerts"]) >= MAX_ALERTS:
        return t("alert_max", lang)
    key = IR.resolve_asset(sym)
    if key:
        now = IR.asset_price(key)
        if not now:
            return t("no_data", lang)
        op = ">" if price > now else "<"
        a = {"coin": key, "price": price, "op": op, "at": int(time.time()), "iran": True}
        x["alerts"].append(a)
        return t("alert_set", lang, coin=alert_label(a, lang), op="≥" if op == ">" else "≤",
                 price=fmt_alert_price(a, price), now=fmt_alert_price(a, now))
    c = D.find_coin(sym)
    if not c:
        return t("unknown_coin", lang) + D.e(sym.upper())
    if MAX_ALERTS and len(x["alerts"]) >= MAX_ALERTS:
        return t("alert_max", lang)
    now = D.live_prices().get(c["coin"], (c.get("price"), 0))[0]
    if not now:
        return t("no_data", lang)
    op = ">" if price > now else "<"
    x["alerts"].append({"coin": c["coin"], "price": price, "op": op, "at": int(time.time())})
    return t("alert_set", lang, coin=c["coin"], op="≥" if op == ">" else "≤", price=D.fp(price), now=D.fp(now))


def add_pct_alert(s, uid, sym, sign, pct):
    """'+5%' / '-5%' / '±5%' alert relative to the price right now"""
    lang = lang_of(s, uid)
    x = user(s, uid)
    if MAX_ALERTS and len(x["alerts"]) >= MAX_ALERTS:
        return t("alert_max", lang)
    key = IR.resolve_asset(sym)
    if key:
        now = IR.asset_price(key)
        coin, iran = key, True
    else:
        c = D.find_coin(sym)
        if not c:
            return t("unknown_coin", lang) + D.e(sym.upper())
        coin, iran = c["coin"], False
        now = D.live_prices().get(coin, (c.get("price"), 0))[0]
    if not now:
        return t("no_data", lang)
    a = W.pct_alert(coin, now, sign, pct, iran=iran)
    x["alerts"].append(a)
    spec = f"{sign}{pct:g}%" + ("" if sign == "±" else f" → {fmt_alert_price(a, a['price'])}")
    return t("alert_pct_set", lang, coin=alert_label(a, lang), spec=spec, now=fmt_alert_price(a, now))


def quick_alert_kb(coin, lang):
    """one-tap alerts under a coin card / the tether board"""
    steps = ["+1", "-1", "±2"] if coin in IR.ASSETS else ["+5", "-5", "±10"]
    return {"inline_keyboard": [[btn(f"{p}%", f"qa:{coin}:{p}") for p in steps],
                                [btn(t("qa_custom", lang), f"qc:{coin}")], MN.nav_row("alerts", lang)]}


_last_alert_check = [0.0]


def check_alerts(s):
    if time.time() - _last_alert_check[0] < 60:
        return False
    _last_alert_check[0] = time.time()
    if not any(x.get("alerts") for x in s["users"].values()):
        return False
    px = D.live_prices()
    need_ir = any(a.get("iran") for x in s["users"].values() for a in x.get("alerts", []))
    snap = IR.snapshot() if need_ir else {}
    changed = False
    for uid, x in s["users"].items():
        keep = []
        lang = x.get("lang", "fa")
        for a in x.get("alerts", []):
            if a.get("iran"):
                now = IR.asset_price(a["coin"], snap)
            else:
                now = (px.get(a["coin"]) or (None,))[0]
            if a.get("op") == "±":
                hit = W.pct_hit(a, now)
            else:
                hit = now is not None and ((a["op"] == ">" and now >= a["price"]) or (a["op"] == "<" and now <= a["price"]))
            if hit:
                kb = ({"inline_keyboard": [[btn(t("b_irr", lang), "m:irr")]]} if a.get("iran")
                      else {"inline_keyboard": [[btn("🪙 " + a["coin"], f"c:{a['coin']}")]]})
                if a.get("pct") and a.get("ref"):
                    msg = t("alert_pct_hit", lang, coin=alert_label(a, lang), pct=f"{(now / a['ref'] - 1) * 100:+.2f}",
                            ref=fmt_alert_price(a, a["ref"]), now=fmt_alert_price(a, now))
                else:
                    msg = t("alert_hit", lang, coin=alert_label(a, lang), price=fmt_alert_price(a, a["price"]),
                            now=fmt_alert_price(a, now))
                send(int(uid), msg, kb)
                changed = True
            else:
                keep.append(a)
        x["alerts"] = keep
    return changed


def _post_with_retry(method, data, files=None, tries=3):
    """Bot API call that waits out Telegram's per-group rate limit (429 retry_after) instead of dropping the post"""
    r = {"ok": False}
    for _ in range(tries):
        try:
            if files:
                r = requests.post(API + method, data=data, files=files, timeout=90).json()
            else:
                r = requests.post(API + method, json=data, timeout=60).json()
        except Exception as ex:
            r = {"ok": False, "description": str(ex)}
        if r.get("ok"):
            return r
        wait = (r.get("parameters") or {}).get("retry_after")
        if wait:
            time.sleep(min(int(wait) + 1, 90))
            continue
        break
    log.warning("%s -> %s", method, r.get("description"))
    return r


def _image_bytes(url):
    try:
        g = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0 (CoinKurdBot)"})
        if g.ok and len(g.content) > 2000 and len(g.content) < 9_500_000:
            return g.content
    except Exception:
        pass
    return None


def group_send(chat_id, text, kb=None, plain=False, photo=None, video=None, **kw):
    """post to the group; with a picture the summary becomes its caption (summaries are ≤1024 chars, the caption limit).
    The picture is downloaded and uploaded by the bot, because Telegram cannot fetch t.me CDN links itself."""
    body = fix_amp(D.e(text) if plain else text)
    if video:                                    # bytes of an mp4 made by the bot (bot_reel)
        data = {"chat_id": chat_id, "caption": body, "parse_mode": "HTML", "supports_streaming": "true"}
        data.update({k: v for k, v in kw.items() if v is not None})
        if kb:
            data["reply_markup"] = json.dumps(kb)
        return _post_with_retry("sendVideo", data, files={"video": ("coin_kurd.mp4", video, "video/mp4")})
    if photo:
        img = photo if isinstance(photo, bytes) else _image_bytes(photo)
        if img:
            data = {"chat_id": chat_id, "caption": body, "parse_mode": "HTML"}
            data.update({k: v for k, v in kw.items() if v is not None})
            if kb:
                data["reply_markup"] = json.dumps(kb)
            r = _post_with_retry("sendPhoto", data, files={"photo": ("chart.jpg", img)})
            if r.get("ok"):
                return r
        log.info("picture unavailable for this post; sending text only")
    data = {"chat_id": chat_id, "text": body, "parse_mode": "HTML", "link_preview_options": {"is_disabled": True}}
    data.update({k: v for k, v in kw.items() if v is not None})
    if kb:
        data["reply_markup"] = kb
    return _post_with_retry("sendMessage", data)


def channel_poll(chat_id, question, options):
    return _post_with_retry("sendPoll", {"chat_id": chat_id, "question": question[:300],
                                         "options": [{"text": o[:100]} for o in options], "is_anonymous": True})


def group_delete(chat_id, mid):
    return tg("deleteMessage", chat_id=chat_id, message_id=mid)


_last_tick = [0.0]


def minute_jobs(s):
    """every ~60s: tether spike watch + live message refresh"""
    if time.time() - _last_tick[0] < 60:
        return False
    _last_tick[0] = time.time()
    changed = False
    watchers = [(uid, x.get("lang", "fa")) for uid, x in s["users"].items() if x.get("watch")]
    if watchers or LIVE:
        p = IR.snapshot().get("usdt")
        now = time.time()
        if p:
            USDT_SERIES.append((now, p))
            del USDT_SERIES[:-40]
            window = [(ts, v) for ts, v in USDT_SERIES if now - ts <= WATCH_MIN * 60]
            if watchers and len(window) >= 3 and now - s.get("watch_last", 0) > 30 * 60:
                lo = min(window, key=lambda kv: kv[1])
                hi = max(window, key=lambda kv: kv[1])
                first, last = (lo, hi) if lo[0] < hi[0] else (hi, lo)
                pct = (last[1] / first[1] - 1) * 100
                if abs(pct) >= WATCH_PCT:
                    s["watch_last"] = now
                    changed = True
                    mins = max(1, round((last[0] - first[0]) / 60))
                    for uid, lang in watchers:
                        d = pick({"fa": "جهش" if pct > 0 else "سقوط", "ckb": "بەرزبوونەوە" if pct > 0 else "کەوتن",
                             "en": "up" if pct > 0 else "down"}, lang)
                        send(int(uid), t("watch_hit", lang, dir=d, pct=f"{pct:+.2f}", mins=mins,
                                         p0=IR.toman(first[1]), p1=IR.toman(last[1])),
                             {"inline_keyboard": [[btn(t("b_irr", lang), "m:irr")]]})
    for key, info in list(LIVE.items()):
        if time.time() > info["until"]:
            LIVE.pop(key, None)
            continue
        lang = lang_of(s, info["uid"])
        try:
            edit(key[0], key[1], (IR.bot_board(lang) or IR.card(lang)) + "\n\n" + t("live_on", lang), kb_irr(lang, live=True))
        except Exception:
            log.exception("live refresh failed")
    return changed


def maybe_brief(s):
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    if now.hour < BRIEF_HOUR or s.get("last_brief") == today:
        return False
    subs = [(uid, x.get("lang", "fa")) for uid, x in s["users"].items() if x.get("brief")]
    s["last_brief"] = today
    cache = {}
    for uid, lang in subs:
        if lang not in cache:
            cache[lang] = D.daily_brief(lang)
        send(int(uid), cache[lang], {"inline_keyboard": [[btn(t("b_back", lang), "m:main")]]})
        time.sleep(0.05)
    log.info("daily brief sent to %d users", len(subs))
    return True


# ================================================================== v2 helpers
def rows_kb(rows, lang=None):
    return {"inline_keyboard": rows} if rows else None


def send_rows(uid, text, rows=None):
    """used by the background watchers (bot_watch / bot_token)"""
    r = send(uid, text, rows_kb(rows))
    time.sleep(0.04)
    return r


def token_reply(chat_id, addr, lang, mid=None):
    tg("sendChatAction", chat_id=chat_id, action="typing")
    text, rows = TK.card(addr, lang, D.e)
    kb = {"inline_keyboard": rows + [[btn(MN.name("token", lang), "m:token"), btn(MN.L(MN.T["b_home"], lang), "m:main")]]}
    return edit(chat_id, mid, D.cut(text, 4000), kb) if mid else send(chat_id, D.cut(text, 4000), kb)


def launch_send(subs, addr):
    cache = {}
    for uid, x in subs:
        lang = x.get("lang", "fa")
        if lang not in cache:
            text, rows = TK.card(addr, lang, D.e)
            body = (TK.L(TK.LAUNCH["head"], lang) + "\n" + text + "\n\n" +
                    TK.L(TK.LAUNCH["why"], lang, liq=TK._usd(TK.LAUNCH_MIN_LIQ)) + "\n" + TK.L(TK.LAUNCH["warn"], lang))
            cache[lang] = (D.cut(body, 4000), rows)
        text, rows = cache[lang]
        send_rows(int(uid), text, rows)


def outage_push(s, kind, level):
    """kit when an outage starts, digest when it ends — to users who opted in (Telegram queues it if they're cut off)"""
    targets = [(uid, x) for uid, x in list(s["users"].items()) if x.get("kit")]
    cache = {}
    for uid, x in targets:
        lang = x.get("lang", "fa")
        if lang not in cache:
            if kind == "kit":
                links = PX2.best_links(s, 6)
                cache[lang] = (OU.L(OU.T["kit_push"], lang) + "\n\n" + "\n".join(links) + "\n\n" + OU.L(OU.T["kit"], lang))
            else:
                cache[lang] = OU.digest(s, lang, D)
        send_rows(int(uid), D.cut(cache[lang], 4000), [[btn(t("b_proxy", lang), "m:proxy"), btn(t("b_irr", lang), "m:irr")]])
    log.info("outage %s sent to %d users", kind, len(targets))


def notify_admins(text):
    for a in ADMIN_IDS:
        send(a, text)


def watch_loop(s):
    """background watchers; each job keeps its own interval and never blocks the update loop"""
    jobs = [
        ("outage", lambda: OU.check(s, notify_admins, lambda kind, lvl: outage_push(s, kind, lvl))),
        ("proxies", lambda: bool(PX2.refresh(s)) and False),
        ("token_alerts", lambda: TK.check_alerts(s, send_rows)),
        ("whales", lambda: W.scan_whales(s, D, send_rows)),
        ("volume", lambda: W.scan_volume(s, send_rows)),
        ("signals", lambda: W.scan_signals(s, D, send_rows)),
        ("follows", lambda: W.scan_follows(s, D, send_rows)),
        ("dca", lambda: W.dca_due(s, D, send_rows)),
        ("launches", lambda: TK.scan_launches(s, launch_send)),
    ]
    while True:
        for name, fn in jobs:
            try:
                if fn():
                    F.DIRTY.set()
            except Exception:
                log.exception("watch job %s failed", name)
        time.sleep(20)


def admin_v2(s, chat_id, cmd, arg):
    """admin commands added in v2; -> True if handled"""
    if cmd == "/addproxy":
        links = PX2.LINK.findall(arg)
        d = PX2.px(s)
        for u in links:
            if u not in d["own"]:
                d["own"].append(u)
        d["own"] = d["own"][-8:]
        send(chat_id, f"🛡 own proxies: {len(d['own'])}" + ("" if links else "\nusage: /addproxy https://t.me/proxy?server=…"))
        return True
    if cmd == "/delproxy":
        d = PX2.px(s)
        if arg == "all":
            d["own"] = []
        elif arg.isdigit() and 1 <= int(arg) <= len(d["own"]):
            d["own"].pop(int(arg) - 1)
        send(chat_id, "🛡 own proxies:\n" + ("\n".join(f"{i}. {u}" for i, u in enumerate(d["own"], 1)) or "—"))
        return True
    if cmd == "/trust":
        tr = s.setdefault("trusted", [])
        parts = arg.split(maxsplit=2)
        if len(parts) >= 2 and parts[0] == "add" and W.chain_of(parts[1]):
            tr.append({"a": parts[1], "label": (parts[2] if len(parts) > 2 else W.short(parts[1]))[:30]})
        elif len(parts) == 2 and parts[0] == "del" and parts[1].isdigit() and 1 <= int(parts[1]) <= len(tr):
            tr.pop(int(parts[1]) - 1)
        send(chat_id, "⭐️ trusted wallets (users can follow them):\n" +
             ("\n".join(f"{i}. {w['label']} <code>{w['a']}</code>" for i, w in enumerate(tr, 1)) or "—") +
             "\n\n/trust add ADDRESS label · /trust del N")
        return True
    if cmd == "/outage" and arg:
        v = OU.set_manual(s, arg.lower(), notify_admins, lambda kind, lvl: outage_push(s, kind, lvl))
        send(chat_id, f"🛰 outage mode: {v}" if v else "usage: /outage on | degraded | off | auto")
        return True
    if cmd == "/outagekit":
        everyone = arg == "all"
        n = 0
        for k, x2 in list(s["users"].items()):
            if not (everyone or x2.get("kit") or x2.get("isp")):
                continue
            lang = x2.get("lang", "fa")
            links = PX2.best_links(s, 6)
            send_rows(int(k), D.cut(OU.L(OU.T["kit_push"], lang) + "\n\n" + "\n".join(links) + "\n\n" + OU.L(OU.T["kit"], lang), 4000),
                      [[btn(t("b_proxy", lang), "m:proxy")]])
            n += 1
        send(chat_id, f"🧰 kit sent to {n} users" + ("" if everyone else " (opted-in / operator set; '/outagekit all' = everyone)"))
        return True
    return False


# ================================================================== handlers
def repost_video(msg):
    """admin forwards a video (e.g. one too big for the web preview) -> house-prompt caption -> channel"""
    chat = msg["chat"]["id"]
    src = (msg.get("caption") or "").strip()
    if len(src) < 25:
        return send(chat, "⚠️ این فیلم متن کافی ندارد؛ فیلم را همراه متنش فوروارد کن")
    cap = F.summarize(src, "fa", limit=1024 - CL.SIG_LEN - 2)
    if not cap:
        return send(chat, "⚠️ متن مطابق قانون‌های پرامپت ساخته نشد؛ دوباره امتحان کن")
    fid = (msg.get("video") or msg.get("document"))["file_id"]
    body = fix_amp(D.e(cap) + "\n\n" + CL.SIG)
    key = "video" if msg.get("video") else "document"
    r = _post_with_retry("sendVideo" if key == "video" else "sendDocument",
                         {"chat_id": CHANNEL, key: fid, "caption": body, "parse_mode": "HTML", "supports_streaming": True})
    send(chat, "✅ در کانال منتشر شد" if r.get("ok") else "⚠️ انتشار نشد: " + D.e(str(r.get("description"))))


def handle_private(s, msg):
    if msg["from"]["id"] in ADMIN_IDS and (msg.get("video") or (msg.get("document") or {}).get("mime_type", "").startswith("video")):
        threading.Thread(target=repost_video, args=(msg,), daemon=True).start()
        return send(msg["chat"]["id"], "🎬 دریافت شد؛ متنش طبق پرامپت ساخته و در کانال منتشر می‌شود…")
    u, uid, chat_id = msg["from"], msg["from"]["id"], msg["chat"]["id"]
    text = (msg.get("text") or "").strip()
    cmd, _, arg = text.partition(" ")
    cmd = cmd.split("@")[0].lower()
    arg = arg.strip()

    if cmd == "/start":
        ref = int(arg) if arg.isdigit() else None
        x = upsert(s, u, ref)
        if not x["joined"]:
            if is_member(uid):
                return after_verified(s, uid, chat_id)
            return send(chat_id, t("join_first", x["lang"]), kb_join(x["lang"]))
        welcome(chat_id, x["lang"])
        return send(chat_id, *render(s, uid, "main"))

    x = upsert(s, u)
    lang = x["lang"]
    if not x["joined"] and uid not in ADMIN_IDS:
        if is_member(uid):
            mark_joined(s, uid)
        else:
            return send(chat_id, t("join_first", lang), kb_join(lang))

    aw = x.pop("await", None)
    if aw == "pyemo" and text and not text.startswith("/"):
        x["await"] = None
        x.setdefault("py", {}).setdefault("emo", []).append({"t": int(time.time()), "s": text[:160]})
        return send(chat_id, "🌊 ثبت شد. همین ثبت ساده، خودش رفتار را تغییر می‌دهد.", kb_back(lang))
    if aw == "report" and text and not text.startswith("/"):
        if time.time() - x.get("report_at", 0) < 600 and uid not in ADMIN_IDS:   # one report per 10 min
            return send(chat_id, LN.L(LN.M["report_ok"], lang), kb_back(lang))
        x["report_at"] = time.time()
        who = f"@{u.get('username')}" if u.get("username") else D.e(u.get("first_name", ""))
        for a in ADMIN_IDS:
            send(a, f"🚩 <b>scam report</b> from {who} (<code>{uid}</code>)\n\n{D.e(text[:3000])}")
        return send(chat_id, LN.L(LN.M["report_ok"], lang), kb_back(lang))
    if text and not text.startswith("/"):
        addr = TK.detect(text)
        if addr and (aw == "ca" or len(text.split()) <= 3):
            return token_reply(chat_id, addr, lang)

    v2 = {"/token": "token", "/check": "token", "/ca": "token", "/pf": "pf", "/portfolio": "pf", "/center": "center", "/follow": "follow",
          "/dca": "dca", "/learn": "learn", "/outage": "outage", "/lite": "lite", "/safety": "learn"}
    if cmd in ("/check", "/ca", "/token") and arg:
        addr = TK.detect(arg)
        return token_reply(chat_id, addr, lang) if addr else send(chat_id, TK.L(TK.H["ask"], lang))
    if cmd == "/pf" and arg:
        return send(chat_id, W.pf_cmd(x, arg, lang, D) or W.pf_view(x, lang, D, IR, cached_only=True), kb_back(lang, refresh="m:pf"))
    if cmd == "/wallet":
        return send(chat_id, W.wallet_cmd(x, arg, lang), kb_back(lang, refresh="m:pf"))
    if cmd in ("/follow", "/unfollow") and arg:
        addr = arg.split()[0]
        if cmd == "/unfollow":
            if addr not in (x.get("follow") or []):
                return send(chat_id, LN.L({"fa": "این آدرس را دنبال نمی‌کنی.", "ckb": "شوێنی ئەم ناونیشانە ناکەویت.",
                                          "kmr": "Tu vê navnîşanê naşopînî.", "ar": "أنت لا تتابع هذا العنوان.",
                                          "en": "You don't follow this address."}, lang))
            return send(chat_id, W.unfollow(x, addr, lang), kb_back(lang))
        return send(chat_id, W.follow(x, addr, lang), kb_back(lang))
    if cmd == "/dca" and arg:
        return send(chat_id, W.dca_cmd(x, arg, lang, D), kb_back(lang))
    if cmd == "/size":
        return send(chat_id, W.size(arg, lang, D), kb_back(lang))
    if cmd in ("/rules", "/law"):
        text2, rows = LN.regulation(lang)
        return send(chat_id, text2, rows_kb(rows))
    if cmd in ("/academy", "/akademi", "/course"):
        text2, rows = LN.academy(lang)
        return send(chat_id, text2, rows_kb(rows))
    if cmd in ("/local", "/regional"):
        text2, rows = LN.local_news(D, lang)
        return send(chat_id, text2, rows_kb(rows))
    if cmd == "/report":
        if arg:
            x["await"] = "report"
            return handle_private(s, {**msg, "text": arg})
        x["await"] = "report"
        return send(chat_id, LN.L(LN.M["report_ask"], lang))
    if uid in ADMIN_IDS and admin_v2(s, chat_id, cmd, arg):
        return None
    if cmd in v2:
        return send(chat_id, *render(s, uid, v2[cmd]))

    simple = {"/menu": "main", "/market": "mkt", "/brain": "brain", "/opps": "opps", "/news": "news",
              "/score": "score", "/narratives": "narr", "/calendar": "events", "/council": "council",
              "/lab": "lab", "/derivatives": "deriv", "/cycle": "cycle", "/chain": "chain", "/flows": "flows",
              "/week": "week", "/posts": "posts", "/track": "track", "/indicators": "ind", "/invite": "ref",
              "/top": "top", "/lang": "lang", "/alerts": "alerts", "/dna": "dna"}
    if cmd in simple:
        if cmd == "/dna" and arg:
            return send(chat_id, D.sec_dna(lang, arg.upper()), kb_back(lang, more=D.SITE + "/dna/"))
        return send(chat_id, *render(s, uid, simple[cmd]))
    if cmd in ("/dollar", "/usdt", "/tether", "/irr", "/dolar"):
        return send(chat_id, *render(s, uid, "irr"))
    if cmd == "/calc":
        parts = arg.split()
        amt = IR.num(parts[0]) if parts else None
        if not amt:
            return send(chat_id, t("calc_usage", lang))
        unit = "usdt" if len(parts) > 1 and IR.resolve_asset(parts[1]) == "USDT" else "toman"
        return send(chat_id, IR.calc(lang, amt, unit), kb_irr(lang))
    if cmd == "/watch":
        x["watch"] = not x.get("watch")
        return send(chat_id, t("watch_on" if x["watch"] else "watch_off", lang))
    if cmd == "/proxy":
        return send(chat_id, *render(s, uid, "proxy"))
    if cmd in ("/help", "/start_help"):
        return send(chat_id, t("help", lang) + "\n\n" + t("help2", lang), kb_back(lang))
    if cmd == "/coin":
        return send(chat_id, *(coin_card(s, uid, arg) if arg else render(s, uid, "coin")))
    if cmd == "/search":
        if not arg:
            return send(chat_id, t("search_hint", lang))
        return send(chat_id, D.sec_posts(lang, query=arg, n=12), kb_back(lang))
    if cmd == "/alert":
        return send(chat_id, parse_alert(arg, s, uid), kb_alerts(s, uid, lang))
    if cmd == "/brief":
        x["brief"] = not x.get("brief")
        return send(chat_id, t("brief_on" if x["brief"] else "brief_off", lang))
    if cmd == "/id":
        return send(chat_id, f"user_id: <code>{uid}</code>")

    # admin
    if uid in ADMIN_IDS:
        if cmd == "/stats":
            us = list(s["users"].values())
            return send(chat_id, "📊 <b>Bot stats</b>\n"
                        f"users: {len(us)}\nverified members: {sum(1 for x in us if x['joined'])}\n"
                        f"joined via invite: {sum(1 for x in us if x['joined'] and x['referrer'] is not None)}\n"
                        f"new 24h: {sum(1 for x in us if x['created'] > time.time() - 86400)}\n"
                        f"daily-brief subs: {sum(1 for x in us if x.get('brief'))}\n"
                        f"active alerts: {sum(len(x.get('alerts', [])) for x in us)}\n"
                        f"langs: " + ", ".join(f"{l} {sum(1 for x in us if x.get('lang') == l)}" for l in LANGS))
        if cmd == "/export":
            lines = ["id,username,name,referrer,joined,points,lang,brief"]
            for k, x2 in s["users"].items():
                lines.append(f"{k},{x2.get('username') or ''},{(x2.get('name') or '').replace(',', ' ')},"
                             f"{x2['referrer'] or ''},{int(x2['joined'])},{points(s, int(k))},{x2.get('lang')},{int(bool(x2.get('brief')))}")
            requests.post(API + "sendDocument", data={"chat_id": chat_id},
                          files={"document": ("users.csv", "﻿" + "\n".join(lines))}, timeout=60)
            return
        if cmd == "/setproxy":
            s["proxy"] = arg[:3500]
            return send(chat_id, "🛡 proxy text " + ("saved" if arg else "cleared") + ".")
        if cmd == "/promote":
            rep = promote(s, force=True) or []
            return send(chat_id, "📣 " + ("\n".join(rep) or "nothing posted"))
        if cmd == "/broadcast":
            src = msg.get("reply_to_message")
            if not src:
                return send(chat_id, "Reply to a message with /broadcast to copy it to every bot user.")
            n = 0
            for k in list(s["users"]):
                r = tg("copyMessage", chat_id=int(k), from_chat_id=chat_id, message_id=src["message_id"])
                n += bool(r.get("ok"))
                time.sleep(0.05)
            return send(chat_id, f"📣 sent to {n}/{len(s['users'])}")

    # free text: coin symbol or search
    if text and not text.startswith("/"):
        low = text.lower()
        if any(k in low for k in ("دلار", "تتر", "usdt", "dollar", "tether", "دۆلار", "تەتەر", "یورو", "سکه", "طلا", "درهم", "لیر")):
            return send(chat_id, *render(s, uid, "irr"))
        word = text.split()[0]
        if len(text.split()) == 1 and 2 <= len(word) <= 12 and D.find_coin(word):
            return send(chat_id, *coin_card(s, uid, word))
        return send(chat_id, D.sec_posts(lang, query=text[:60], n=10), kb_back(lang))
    return send(chat_id, *render(s, uid, "main"))


def handle_callback(s, cb):
    uid, data = cb["from"]["id"], cb.get("data", "")
    chat_id, mid = cb["message"]["chat"]["id"], cb["message"]["message_id"]
    x = upsert(s, cb["from"])
    lang = x["lang"]
    ans = lambda text=None, alert=False: tg("answerCallbackQuery", callback_query_id=cb["id"],
                                            **({"text": text, "show_alert": alert} if text else {}))
    if data.startswith("pv:"):                       # prediction vote (bot menu or the channel post)
        _, rid, opt = data.split(":")
        ans(HB.vote(s, cb["from"], rid, opt), True)
        if cb["message"]["chat"].get("type") == "private":
            return edit(chat_id, mid, *render(s, uid, "predict"))
        return None
    if data == "check":
        if is_member(uid):
            ans(t("verified", lang))
            return after_verified(s, uid, chat_id, edit_mid=mid)
        return ans(t("not_joined", lang), True)
    if not x["joined"] and uid not in ADMIN_IDS:
        if is_member(uid):
            mark_joined(s, uid)
        else:
            ans(t("not_joined", lang), True)
            return edit(chat_id, mid, t("join_first", lang), kb_join(lang))
    if data.startswith("pf:"):                       # proxy report from inside Iran: 👍 / 👎
        _, pxid, good = (data.split(":") + ["", ""])[:3]
        ok = PX2.vote(s, uid, x.get("isp"), pxid, good == "1")
        ans(PX2.L(PX2.T["thanks" if ok else "dup"], lang), not ok)
        if ok and not x.get("isp") and not x.get("isp_asked"):   # ask the operator once, it sharpens the ranking
            x["isp_asked"] = True
            return send(chat_id, PX2.L(PX2.T["isp_ask"], lang), {"inline_keyboard": PX2.isp_keyboard(lang)})
        return None
    if data.startswith("ta:"):
        _, addr, pct = (data.split(":") + ["", "", "20"])[:3]
        ans()
        return send(chat_id, TK.add_alert(x, addr, float(pct or 20), lang))
    if data == "noop":
        return ans()
    if data.startswith("fv:"):
        key = data[3:]
        on = MN.toggle_fav(x, key)
        ans(MN.L(MN.T["fav_added" if on else "fav_removed"], lang))
        return edit(chat_id, mid, *render(s, uid, key))
    ans()
    kind, _, val = data.partition(":")
    if kind == "tk":
        return token_reply(chat_id, val, lang, mid=mid)
    if kind == "td" and val.replace(".", "", 1).isdigit():
        n_, _, pg = val.partition(".")
        i = int(n_) - 1
        if 0 <= i < len(x.get("talerts", [])):
            x["talerts"].pop(i)
        return edit(chat_id, mid, *render(s, uid, "alerts", int(pg or 0)))
    if data == "px:isp":
        return edit(chat_id, mid, PX2.L(PX2.T["isp_ask"], lang), {"inline_keyboard": PX2.isp_keyboard(lang)})
    if data == "px:share":
        return send(chat_id, PX2.share_text(s, lang, x.get("isp")))
    if kind == "isp" and val in PX2.ISPS:
        x["isp"] = val
        return edit(chat_id, mid, *render(s, uid, "proxy"))
    if kind == "sb":
        W.toggle(x, val)
        return edit(chat_id, mid, *render(s, uid, "center"))
    if data == "ot:kit":
        W.toggle(x, "kit")
        return edit(chat_id, mid, *render(s, uid, "outage"))
    if kind == "fw" and val.isdigit():
        tr = s.get("trusted") or []
        i = int(val) - 1
        if 0 <= i < len(tr):
            (W.unfollow if tr[i]["a"] in (x.get("follow") or []) else W.follow)(x, tr[i]["a"], lang)
        return edit(chat_id, mid, *render(s, uid, "follow"))
    if kind == "db" and val.isdigit():
        msg = W.dca_log(x, int(val), lang, D)
        return edit(chat_id, mid, msg or t("no_data", lang))
    if kind == "ln" and val.isdigit():
        text, rows = LN.lesson(int(val), lang)
        return edit(chat_id, mid, text, rows_kb(rows))
    if kind == "lg":
        text, rows = LN.regulation(lang, val)
        return edit(chat_id, mid, text, rows_kb(rows))
    if kind == "lc":
        text, rows = LN.local_news(D, lang)
        return edit(chat_id, mid, text, rows_kb(rows))
    if kind == "la":
        text, rows = LN.academy(lang)
        return edit(chat_id, mid, text, rows_kb(rows))
    if kind == "ak":                                  # آکادمی داخل ربات: درس، آزمون و پیشرفت
        text, rows = AK.route(x, val, lang)
        return edit(chat_id, mid, text, rows_kb(rows))
    if kind == "py":                                  # روان‌شناسی معامله: آموزش، چک‌این و ثبت هیجان
        text, rows = PY_.route(x, val, lang)
        return edit(chat_id, mid, text, rows_kb(rows))
    if kind == "lr":
        x["await"] = "report"
        return send(chat_id, LN.L(LN.M["report_ask"], lang))
    if kind == "qa":
        coin, _, spec = val.partition(":")
        if not spec:
            key = IR.resolve_asset(coin)
            now = IR.asset_price(key) if key else D.live_prices().get(coin, (None,))[0]
            a = {"coin": coin, "iran": bool(key)}
            return edit(chat_id, mid, t("qa_head", lang, c=alert_label(a, lang), p=fmt_alert_price(a, now) if now else "—"),
                        quick_alert_kb(coin, lang))
        pc = W.parse_pct(spec + "%")
        return send(chat_id, add_pct_alert(s, uid, coin, *pc) if pc else t("alert_usage", lang), kb_alerts(s, uid, lang))
    if kind == "qc":
        return send(chat_id, t("alert_usage", lang).replace("BTC", val))
    if kind == "m":
        return edit(chat_id, mid, *render(s, uid, val))
    if kind == "l" and val in LANGS:
        x["lang"] = val
        text, kb = render(s, uid, "main")
        return edit(chat_id, mid, t("lang_set", val) + "\n\n" + text, kb)
    if kind == "c":
        return edit(chat_id, mid, *coin_card(s, uid, val))
    if kind == "nw":
        return news_open(s, chat_id, val, lang)
    back = {"inline_keyboard": [[btn("🪙 " + val, f"c:{val}")], MN.coin_nav(lang)]}
    if kind == "co":
        return edit(chat_id, mid, D.sec_opps(lang, coin=val), back)
    if kind == "cn":
        return edit(chat_id, mid, *news_list(s, lang))
    if kind == "cp":
        return edit(chat_id, mid, D.sec_posts(lang, coin=val), back)
    if kind == "cd":
        return edit(chat_id, mid, D.sec_dna(lang, coin=val), back)
    if kind == "ca":
        now = D.live_prices().get(val, (None,))[0]
        return send(chat_id, t("qa_head", lang, c=val, p=D.fp(now)), quick_alert_kb(val, lang))
    if kind == "ap" and val.isdigit():
        return edit(chat_id, mid, *render(s, uid, "alerts", int(val)))
    if data == "noop":
        return None
    if kind == "ad" and val.replace(".", "", 1).isdigit():
        n_, _, pg = val.partition(".")
        i = int(n_) - 1
        if 0 <= i < len(x["alerts"]):
            x["alerts"].pop(i)
        return edit(chat_id, mid, *render(s, uid, "alerts", int(pg or 0)))
    if data == "live:irr":
        LIVE[(chat_id, mid)] = {"until": time.time() + 15 * 60, "uid": uid}
        return edit(chat_id, mid, (IR.bot_board(lang) or IR.card(lang)) + "\n\n" + t("live_on", lang), kb_irr(lang, live=True))
    if data == "calc":
        return send(chat_id, t("calc_usage", lang))
    if data == "watch":
        x["watch"] = not x.get("watch")
        text, kb = render(s, uid, "alerts")
        return edit(chat_id, mid, t("watch_on" if x["watch"] else "watch_off", lang) + "\n\n" + text, kb)
    if data == "brief":
        x["brief"] = not x.get("brief")
        text, kb = render(s, uid, "alerts")
        return edit(chat_id, mid, t("brief_on" if x["brief"] else "brief_off", lang) + "\n\n" + text, kb)


def is_target_group(chat):
    if GROUP.lstrip("-").isdigit():
        return str(chat["id"]) == GROUP
    return (chat.get("username") or "").lower() == GROUP.lstrip("@").lower()


def handle_group(s, msg):
    u = msg.get("from") or {}
    chat = msg["chat"]
    if not GROUP or not is_target_group(chat):
        return
    kind = F.learn_topic(s, msg)
    if kind:
        for a in ADMIN_IDS:
            send(a, f"✅ topic «{kind}» linked (thread {msg.get('message_thread_id')}) — the bot will post there.")
    text = (msg.get("text") or "").strip()
    if text.split("@")[0].startswith("/settopic") and u.get("id") in ADMIN_IDS:
        arg = text.split(maxsplit=1)[1].strip().lower() if len(text.split()) > 1 else ""
        th = msg.get("message_thread_id")
        if arg in ("onchain", "news", "fx", "onchain:fa", "onchain:ckb", "news:fa", "news:ckb") and th:
            s.setdefault("topics", {})[arg] = th
            send(chat["id"], f"✅ {arg} → this topic", message_thread_id=th)
        else:
            send(chat["id"], "usage (inside the topic): /settopic onchain:fa | onchain:ckb | news:fa | news:ckb | fx", message_thread_id=th)
        return
    if u.get("is_bot") or u.get("id") in ADMIN_IDS:
        return
    if (msg.get("text") or "").split("@")[0] == "/id":
        send(chat["id"], f"chat_id: <code>{chat['id']}</code>", reply_to_message_id=msg["message_id"])
        return
    if is_member(u["id"]):
        return
    tg("deleteMessage", chat_id=chat["id"], message_id=msg["message_id"])
    name = f'<a href="tg://user?id={u["id"]}">{D.e(u.get("first_name", "user"))}</a>'
    extra = {"message_thread_id": msg["message_thread_id"]} if msg.get("message_thread_id") else {}
    send(chat["id"], "\n".join(t("gate", lg, name=name) for lg in ("fa", "ckb", "kmr")),
         {"inline_keyboard": [[btn(t("b_join", "ckb"), url=CHANNEL_LINK)]]}, **extra)


def handle_update(s, up):
    if "message" in up:
        m = up["message"]
        if "from" not in m:
            return
        if m["chat"]["type"] == "private":
            handle_private(s, m)
        elif m["chat"]["type"] in ("group", "supergroup"):
            handle_group(s, m)
    elif "callback_query" in up:
        handle_callback(s, up["callback_query"])


# ================================================================== bot announcement (channel + group)
PROMO_KEY = "promo_v2"
PROMO_TEXT = (
    "🤖 <b>ربات رسمی Coin_Kurd فعال شد:</b> @{bot}\n"
    "💵 قیمت لحظه‌ای دلار، تتر، طلا و کریپتو + هشدار قیمت و درصدی\n"
    "🔎 بررسی توکن با آدرس قرارداد (CA) و هشدار اسکم/راگ\n"
    "🐋 هشدار نهنگ، جهش حجم و لانچ‌های جدید (فیلترشده)\n"
    "💼 پورتفولیو، خرید پله‌ای (DCA) و محاسبهٔ حجم معامله\n"
    "🛡 پروکسی اضطراری و حالت قطعی اینترنت ایران\n"
    "📚 آموزش شروع امن و قوانین عراق، اقلیم و ایران\n"
    "🌐 فارسی · کوردی سۆرانی · Kurmancî · العربية · English\n"
    "رایگان — ربات هیچ‌وقت کلید خصوصی یا رمز نمی‌خواهد.\n\n"
    "🤖 <b>بۆتی فەرمی Coin_Kurd چالاک کرا:</b> @{bot}\n"
    "💵 نرخی ڕاستەوخۆی دۆلار، تەتەر، زێڕ و کریپتۆ + ئاگاداری نرخ\n"
    "🔎 پشکنینی تۆکن بە ناونیشانی گرێبەست و ئاگاداری فێڵ\n"
    "🐋 ئاگاداری نەهەنگ، قەبارە و لانچی نوێ\n"
    "🛡 پرۆکسی فریاکەوتن · 📚 فێربوونی دەستپێکی ئارام\n"
    "بەخۆڕایی — بۆت هەرگیز کلیلی تایبەت یان وشەی نهێنی داوا ناکات.")


def promote(s, force=False):
    """post the bot announcement (with a Start button) to the channel and the group and pin it — once, or again on /promote"""
    if s.get(PROMO_KEY) and not force:
        return None
    text = PROMO_TEXT.format(bot=BOT_USERNAME)
    kb = {"inline_keyboard": [[btn("▶️ شروع ربات · دەستپێکردنی بۆت · Start", url=f"https://t.me/{BOT_USERNAME}?start=promo")]]}
    report = []
    for target in (CHANNEL, GROUP):
        if not target:
            continue
        r = tg("sendMessage", chat_id=target, text=text, parse_mode="HTML", reply_markup=kb,
               link_preview_options={"is_disabled": True})
        if not r.get("ok"):
            report.append(f"{target}: send failed — {r.get('description')}")
            continue
        mid = (r.get("result") or {}).get("message_id")
        p = tg("pinChatMessage", chat_id=target, message_id=mid, disable_notification=False)
        report.append(f"{target}: posted #{mid}, " + ("pinned" if p.get("ok") else f"pin failed — {p.get('description')}"))
    s[PROMO_KEY] = int(time.time())
    notify_admins("📣 bot announcement\n" + "\n".join(report))
    return report


# ================================================================== setup
COMMANDS = {
    "fa": [("dollar", "قیمت دلار و تتر به تومان"), ("calc", "ماشین‌حساب تتر"), ("watch", "هشدار جهش تتر"),
           ("menu", "منوی اصلی"), ("coin", "تحلیل کوین — /coin BTC"), ("market", "وضعیت بازار"),
           ("brain", "مغز بازار"), ("opps", "فرصت‌های اسکنر"), ("news", "اخبار"), ("search", "جستجو در آرشیو کانال"),
           ("alert", "هشدار قیمت — /alert BTC 80000"), ("brief", "گزارش روزانه"), ("invite", "دعوت و پاداش"),
           ("lang", "زبان"), ("help", "راهنما")],
    "ckb": [("dollar", "نرخی دۆلار و تەتەر"), ("calc", "ژمێرەری تەتەر"), ("watch", "ئاگاداری تەتەر"),
            ("menu", "لیستی سەرەکی"), ("coin", "شیکاری دراو — /coin BTC"), ("market", "دۆخی بازاڕ"),
            ("brain", "مێشکی بازاڕ"), ("opps", "دەرفەتەکان"), ("news", "هەواڵ"), ("search", "گەڕان لە ئەرشیڤ"),
            ("alert", "ئاگاداری نرخ"), ("brief", "ڕاپۆرتی ڕۆژانە"), ("invite", "بانگهێشت و خەڵات"),
            ("lang", "زمان"), ("help", "ڕێنمایی")],
    "en": [("dollar", "Dollar & tether in toman"), ("calc", "Tether calculator"), ("watch", "Tether spike alert"),
           ("menu", "Main menu"), ("coin", "Coin card — /coin BTC"), ("market", "Market overview"),
           ("brain", "Market brain"), ("opps", "Scanner opportunities"), ("news", "News"), ("search", "Search the archive"),
           ("alert", "Price alert — /alert BTC 80000"), ("brief", "Daily brief"), ("invite", "Invite & earn"),
           ("lang", "Language"), ("help", "Help")],
}
V2_COMMANDS = {
    "fa": [("check", "بررسی توکن با آدرس قرارداد"), ("center", "مرکز هشدارها"), ("pf", "پورتفولیو"),
           ("proxy", "پروکسی اضطراری"), ("outage", "حالت قطعی اینترنت"), ("learn", "آموزش و قوانین"), ("academy", "آکادمی کریپتو و مسیر یادگیری"),
           ("dca", "خرید پله‌ای"), ("size", "محاسبهٔ حجم معامله")],
    "ckb": [("check", "پشکنینی تۆکن"), ("center", "ناوەندی ئاگادارییەکان"), ("pf", "پۆرتفۆلیۆ"),
            ("proxy", "پرۆکسی فریاکەوتن"), ("outage", "دۆخی پچڕانی ئینتەرنێت"), ("learn", "فێربوون و یاساکان"), ("academy", "ئەکادیمیای کریپتۆ"),
            ("dca", "کڕینی پلەیی"), ("size", "قەبارەی مامەڵە")],
    "en": [("check", "Token check by contract address"), ("center", "Alert centre"), ("pf", "Portfolio"),
           ("proxy", "Emergency proxies"), ("outage", "Internet-outage mode"), ("learn", "Lessons & local rules"), ("academy", "Crypto academy & learning path"),
           ("dca", "DCA plans"), ("size", "Position size")],
    "kmr": [("check", "Kontrola tokenê"), ("center", "Navenda hişyariyan"), ("pf", "Portfolyo"),
            ("proxy", "Proxyên awarte"), ("outage", "Rewşa qutbûnê"), ("learn", "Perwerde û qanûn"), ("academy", "Akademiya kriptoyê"),
            ("dca", "DCA"), ("size", "Mezinahiya bazirganiyê")],
    "ar": [("check", "فحص رمز بعنوان العقد"), ("center", "مركز التنبيهات"), ("pf", "المحفظة"),
           ("proxy", "بروكسي الطوارئ"), ("outage", "وضع انقطاع الإنترنت"), ("learn", "التعلم والقوانين"), ("academy", "أكاديمية الكريبتو"),
           ("dca", "الشراء الدوري"), ("size", "حجم الصفقة")],
}
COMMANDS["kmr"] = [(c, KMR.get(d, d)) for c, d in COMMANDS["en"]]
COMMANDS["ar"] = [(c, AR.get(d, d)) for c, d in COMMANDS["en"]]
for _lg, _extra in V2_COMMANDS.items():
    _have = {c for c, _ in COMMANDS[_lg]}
    COMMANDS[_lg] = COMMANDS[_lg][:3] + [e for e in _extra if e[0] not in _have] + COMMANDS[_lg][3:]


def setup_commands():
    for lang, cmds in COMMANDS.items():
        p = {"commands": [{"command": c, "description": d} for c, d in cmds]}
        if lang == "fa":
            tg("setMyCommands", **p)                       # default (also used by Sorani clients)
        elif lang in ("kmr", "en", "ar"):
            tg("setMyCommands", language_code={"kmr": "ku"}.get(lang, lang), **p)


def setup_profile(s):
    """name / about / description per language; sent only when the texts change (setMyName is rate-limited)"""
    prof = MN.profile(REWARD_AT)
    digest = hashlib.sha1(json.dumps(prof, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    if s.get("profile_hash") == digest:
        return
    ok = True
    for code, p in prof.items():
        lc = {"language_code": code} if code else {}
        for method, field, value in (("setMyName", "name", p["name"]), ("setMyShortDescription", "short_description", p["short"]),
                                     ("setMyDescription", "description", p["desc"])):
            r = tg(method, **{field: value}, **lc)
            ok &= bool(r.get("ok"))
            if (r.get("parameters") or {}).get("retry_after"):
                log.warning("%s rate-limited; will retry next run", method)
                return
    if ok:
        s["profile_hash"] = digest
        log.info("bot profile updated")


# ================================================================== main loop
def main():
    global BOT_USERNAME
    if not TOKEN:
        log.error("REF_BOT_TOKEN missing")
        return 1
    me = tg("getMe")
    if not me.get("ok"):
        log.error("bad token")
        return 1
    BOT_USERNAME = me["result"]["username"]
    tg("deleteWebhook")
    setup_commands()
    s = load_state()
    try:
        setup_profile(s)
    except Exception:
        log.exception("profile setup failed")
    log.info("running as @%s for %ss, %d users", BOT_USERNAME, RUN_SECONDS, len(s["users"]))
    F.start(s, group_send, group_delete, GROUP, MAIN_WT)
    V.start(s, group_send, CHANNEL, sorted(ADMIN_IDS), MAIN_WT)
    DP.start(s, group_send, CHANNEL, sorted(ADMIN_IDS), MAIN_WT)
    HB.start(s, group_send, edit, CHANNEL, MAIN_WT, DP.push_files)
    CL.start(s, group_send, CHANNEL)
    FX.start(s, _post_with_retry, fix_amp, CHANNEL, MAIN_WT, DP.push_files, sorted(ADMIN_IDS),
             lambda chat, text: group_send(chat, text), V.SIG, F.DIRTY)   # one-time repair of broken pictures
    threading.Thread(target=watch_loop, args=(s,), name="watch-v2", daemon=True).start()
    try:
        if promote(s):
            save_state(s)
    except Exception:
        log.exception("bot announcement failed")
    for name in ("market", "brain", "posts_lite"):   # warm cache
        D.load(name)
    deadline = time.time() + RUN_SECONDS
    last_push, handled, dirty = time.time(), 0, False
    while time.time() < deadline:
        d = tg("getUpdates", offset=s["offset"], timeout=25, allowed_updates=["message", "callback_query"])
        if d.get("ok"):
            for up in d["result"]:
                s["offset"] = up["update_id"] + 1
                try:
                    handle_update(s, up)
                    handled += 1
                except Exception:
                    log.exception("update %s failed", up["update_id"])
                dirty = True
        else:
            time.sleep(5)
        try:
            dirty |= check_alerts(s)
            dirty |= minute_jobs(s)
            if F.DIRTY.is_set():
                F.DIRTY.clear()
                dirty = True
            dirty |= maybe_brief(s)
        except Exception:
            log.exception("periodic job failed")
        if dirty:
            save_state(s)
            dirty = False
        if time.time() - last_push > STATE_PUSH_EVERY:
            push_state()
            last_push = time.time()
    save_state(s)
    log.info("done: %d updates handled", handled)
    return 0


if __name__ == "__main__":
    sys.exit(main())
