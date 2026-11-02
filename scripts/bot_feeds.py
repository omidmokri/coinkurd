"""
Channel feeds → AI summary (Persian + Sorani) → Telegram supergroup topics, bot sections and the site.

  on-chain:  @glassnode, @cryptoquant_kr, @cryptoquant_official   → topic "ئاناڵیزی ئانچین و تحلیل آنچین"
  news:      @cryptoslatenews                                     → topic "اخبار کریپتو - هەواڵی کریپتۆ"
  prices:    the dollar/tether card (bot_iran.card)                → topic "تبدیل ارز"  (refreshed, old card deleted)

Summaries follow the channel's house prompt (title, زمینه / تمرکز / پیامدها / نتیجه‌گیری, four hashtags,
≤1024 characters, no Latin/CJK words, no source names, no trailing full stops). Every output is checked
against those rules in code and regenerated once if it breaks them; outputs that still break them are dropped.
"""
import json
import logging
import os
import re
import subprocess
import threading
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

import ai
import bot_iran as IR

log = logging.getLogger("feeds")

FEEDS = {
    "onchain": ["glassnode", "cryptoquant_kr", "cryptoquant_official"],
    "news": ["cryptoslatenews"],
}
TOPIC_HINTS = {  # words that identify each topic by its name (Persian and Sorani topics are separate)
    "onchain:ckb": ["ئانچین", "ئۆنچەین"],
    "onchain:fa": ["آنچین", "انچین"],
    "news:ckb": ["هەواڵی کریپتۆ", "هه‌واڵی کریپتۆ"],
    "news:fa": ["اخبار کریپتو"],
    "fx": ["تبدیل ارز", "گۆڕینی دراو"],
}
# known topic ids in @Coin_Kurd_Group, e.g. "onchain:fa=47623,onchain:ckb=219340,news:fa=42033,news:ckb=69794,fx=33986"
TOPIC_IDS = os.environ.get("TOPIC_IDS", "")


def env_topics():
    out = {}
    for part in TOPIC_IDS.split(","):
        k, _, v = part.strip().partition("=")
        if k and v.strip().isdigit():
            out[k.strip()] = int(v)
    return out
CHECK_EVERY = int(os.environ.get("FEED_CHECK_EVERY", "600"))      # seconds between channel checks
MAX_PER_CHECK = int(os.environ.get("FEED_MAX_PER_CHECK", "4"))    # new posts summarised per channel per check
FX_EVERY = int(os.environ.get("FX_POST_EVERY", "1800"))           # seconds between price cards in the fx topic
POST_LANGS = [x for x in os.environ.get("GROUP_POST_LANGS", "fa,ckb").split(",") if x]
KEEP = 60                                                        # items kept per feed for the bot and the site

PROMPT = """✅ شما یک دستیار حرفه‌ای خلاصه‌سازی اخبار هستید.

زبان خروجی:
- به‌صورت پیش‌فرض همیشه به زبان پارسی روان پاسخ بده
- فقط اگر کاربر در پیام خود عدد «2» را ارسال کرد، خروجی را به زبان کوردی سۆرانیی سروشتی بنویس
- در غیر این دو حالت، هرگز زبان را عوض نکن، حتی اگر متن ورودی به زبان دیگری باشد

ساختار خروجی (چه فارسی چه کوردی) دقیقاً باید این‌گونه باشد:
عنوان اصلی جذاب همراه با یک ایموجی

بخش «زمینه» با عنوان کوتاه و لیست یک تا سه موردی

بخش «تمرکز» با عنوان و لیست دو تا سه موردی همراه ایموجی

بخش «پیامدها» با عنوان و لیست دو تا سه موردی همراه ایموجی

بخش «نتیجه‌گیری» با یک جمله کوتاه تحلیلی همراه ایموجی

دقیقاً چهار هاشتگ مرتبط در پایان

قوانین مطلق و بدون استثنا:
- طول کل خروجی، شامل فاصله‌ها، ایموجی‌ها و هاشتگ‌ها، هرگز نباید از ۱۰۲۴ کاراکتر بیشتر شود
- پیش از ارسال، تعداد کاراکترها را بشمار؛ اگر بیشتر از ۱۰۲۴ بود، کوتاه‌تر و فشرده‌تر بازنویسی کن
- نباید تنها از این چهار ایموجی استفاده کنی: 🧐 💡 🔥 😅
- هیچ اشاره‌ای به منبع، لینک یا نام رسانه نکن
- هیچ کلمه انگلیسی یا چینی (و هیچ حرف لاتین، کره‌ای یا ژاپنی) در هیچ خط ظاهر نشود؛ نام ارزها و شاخص‌ها را به فارسی (یا کوردی) بنویس
- تمام خط‌ها باید با واژه فارسی (یا در حالت کوردی، با واژه کوردی) یا ایموجی شروع شوند تا راست‌چین بمانند
- در پایان هیچ خطی نقطه نگذار
- اگر رعایت همه بخش‌ها باعث عبور از سقف کاراکتر شود، اولویت با رعایت سقف کاراکتر است
- فقط از اطلاعات همین متن ورودی استفاده کن؛ هیچ عدد، نام یا واقعیتی از خودت اضافه نکن
- فقط خود متن نهایی را بنویس، بدون هیچ توضیح اضافه

مثال فارسی:
رشد سرمایه‌گذاری غول مدیریت دارایی در استراتژی بیت‌کوین 🧐

زمینه
💡 یکی از بزرگ‌ترین مدیران فعال سرمایه‌گذاری جهان میزان مالکیت خود در سهام شرکت استراتژی را افزایش داده است
🔥 با خرید ۸۰ هزار و ۲۴۰ سهم دیگر، مجموع دارایی این صندوق به حدود ۱ میلیون و ۶۶۰ هزار سهم رسیده است

تمرکز
🧐 ارزش این سرمایه‌گذاری اکنون حدود ۱۶۱ میلیون دلار برآورد می‌شود
💡 افزایش سرمایه‌گذاری در شرکتی با ذخایر قابل‌توجه بیت‌کوین، نشانه تداوم توجه سرمایه‌گذاران نهادی به این بازار است

پیامدها
💡 ورود سرمایه نهادهای بزرگ می‌تواند جذابیت سهام شرکت‌های دارای ذخایر بیت‌کوین را افزایش دهد
🧐 تداوم این روند می‌تواند پذیرش بیت‌کوین در میان سرمایه‌گذاران سنتی را تقویت کند

نتیجه‌گیری
🧐 افزایش سرمایه‌گذاری این صندوق نشان می‌دهد علاقه نهادهای مالی بزرگ به شرکت‌های دارای راهبرد مبتنی بر بیت‌کوین همچنان پابرجاست

#بیتکوین #استراتژی #سرمایه_گذاری #بازار_رمزارز

مثال کوردی سۆرانی:
📈 چوار نیشانەی سەرەکی لە بازاڕی هاوین

پاشبنەما
نیشانەکانی ئۆنچەین بۆ تێگەیشتن لە جووڵەی کڕین و فرۆشتن
کۆگای ئاڵوگۆڕ بەردەوام دابەزیوە

سەرەکی
🐳 ڕێژەی نەهەنگەکان لە ئاڵوگۆڕ بەرز ماوەتەوە
⚖️ کۆبوونەوەی درێژخایەنەکان بەردەوامە

ئاکامەکان
📉 نەبوونی فرۆشتنی ترسناک لە بازاڕ
📈 پێویستە جووڵەی نەهەنگەکان بە وردی چاودێری بکرێت

کۆتایی
داتاکانی ئۆنچەین نیشانی نەبوونی فرۆشتنی گەورە دەدەن بەڵام جووڵەی نەهەنگەکان پێویستی بە چاودێرییە 📊

#بیتکۆین #نیشانەکان #بازاڕ #ئۆنچەین
"""

LATIN_CJK = re.compile(r"[A-Za-z぀-ヿ㐀-鿿가-힯]")


def problems(text):
    """rule violations a reader would notice; [] = publishable"""
    p = []
    if len(text) > 1024:
        p.append(f"طول {len(text)} کاراکتر است و باید زیر ۱۰۲۴ باشد")
    if LATIN_CJK.search(text):
        bad = sorted(set(re.findall(r"[A-Za-z]+|[぀-ヿ㐀-鿿가-힯]+", text)))[:8]
        p.append("این کلمه‌های غیرفارسی را حذف یا ترجمه کن: " + "، ".join(bad))
    tags = re.findall(r"#\S+", text)
    if len(tags) != 4:
        p.append(f"باید دقیقاً چهار هاشتگ در پایان باشد (الان {len(tags)} است)")
    if re.search(r"(https?://|t\.me|@\w)", text):
        p.append("هیچ لینک یا نام منبعی نباید باشد")
    return p


def tidy(text):
    text = re.sub(r"^```\w*|```$", "", text.strip()).strip()
    lines = [ln.rstrip().rstrip(".۔").rstrip() for ln in text.split("\n")]
    out, blank = [], 0
    for ln in lines:                     # collapse runs of blank lines
        blank = blank + 1 if not ln else 0
        if blank <= 1:
            out.append(ln)
    return "\n".join(out).strip()


def summarize(source_text, lang):
    """-> text that passes problems(), or None"""
    if not ai.available():
        return None
    msg = source_text.strip()[:3500] + ("\n\n2" if lang == "ckb" else "")
    prompt = PROMPT + "\n\nمتن ورودی کاربر:\n" + msg
    last = None
    for attempt in range(3):
        try:
            out = tidy(ai.generate(prompt, temperature=0.3, max_tokens=1200))
        except Exception as ex:  # quota, network
            log.warning("ai failed: %s", ex)
            return None
        pr = problems(out)
        if not pr:
            return out
        last = out
        prompt = (PROMPT + "\n\nمتن ورودی کاربر:\n" + msg + "\n\nپاسخ قبلی تو این مشکل‌ها را داشت؛ دوباره و درست بنویس:\n- "
                  + "\n- ".join(pr) + "\n\nپاسخ قبلی:\n" + out)
    log.info("dropped summary after retries: %s", problems(last or "")[:2])
    return None


# ------------------------------------------------------------------ state helpers
def feed_state(s):
    f = s.setdefault("feeds", {})
    f.setdefault("seen", {})          # channel -> last processed post id
    for chs in FEEDS.values():        # all keys exist up front, so the worker thread never resizes dicts
        for ch in chs:
            f["seen"].setdefault(ch, None)
    f.setdefault("items", {"onchain": [], "news": []})
    f.setdefault("last_check", 0)
    f.setdefault("last_fx", 0)
    f.setdefault("fx_msg", None)
    s.setdefault("topics", {})        # kind -> message_thread_id
    return f


def learn_topic(s, msg):
    """remember topic ids from messages posted inside forum topics (the topic name rides on reply_to_message)"""
    th = msg.get("message_thread_id")
    if not th or not msg.get("is_topic_message"):
        return None
    name = ""
    rt = msg.get("reply_to_message") or {}
    if rt.get("forum_topic_created"):
        name = rt["forum_topic_created"].get("name", "")
    if msg.get("forum_topic_created"):
        name = msg["forum_topic_created"].get("name", "")
    for kind, hints in TOPIC_HINTS.items():
        if name and any(h.lower() in name.lower() for h in hints):
            if s.setdefault("topics", {}).get(kind) != th:
                s["topics"][kind] = th
                log.info("learned topic %s = %s (%s)", kind, th, name)
                return kind
    return None


def _post_id(url):
    m = re.search(r"/(\d+)$", url or "")
    return int(m.group(1)) if m else 0


def article_text(url, limit=3500):
    """-> (main text, og:image) of a linked article, so a one-line headline post is summarised from facts"""
    try:
        r = requests.get(url, headers=IR.UA, timeout=20)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        og = soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "twitter:image"})
        img = og.get("content") if og and (og.get("content") or "").startswith("http") else None
        for t in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
            t.decompose()
        root = soup.find("article") or soup
        paras = [p.get_text(" ", strip=True) for p in root.find_all("p")]
        txt = "\n".join(p for p in paras if len(p) > 60)
        return txt[:limit], img
    except Exception:
        return "", None


def read_posts(channel):
    """-> [(id, iso, text, links, photos)] oldest→newest"""
    return [(pid, iso, (text or "").strip(), links, photos)
            for iso, text, pid, links, photos in IR.read_channel_full(channel) if pid]


def expand(text, links, photos):
    """short posts (headline + link) get their linked article appended; the article image is used if the post has none.
    -> (text, photo_url)"""
    photo = photos[0] if photos else None
    if links and (len(text) < 400 or not photo):
        extra, img = article_text(links[0])
        if extra and len(text) < 400:
            text = text + "\n\n" + extra
        photo = photo or img
    return text, photo


# ------------------------------------------------------------------ main job
def run(s, send_fn, delete_fn, group_id, admin_ids=()):
    """called from the bot loop; returns True if state changed"""
    f = feed_state(s)
    changed = False
    now = time.time()
    topics = s.get("topics", {})

    # 1) price card in the fx topic
    if group_id and topics.get("fx") and now - f["last_fx"] > FX_EVERY:
        f["last_fx"] = now
        changed = True
        try:
            snap = IR.snapshot()
            if not (snap.get("usdt") or snap.get("exchanges")):
                raise RuntimeError("no price data; skip this round")
            card = IR.card("fa")
            r = send_fn(group_id, card, None, message_thread_id=topics["fx"])
            if r.get("ok"):
                if f.get("fx_msg"):
                    delete_fn(group_id, f["fx_msg"])
                f["fx_msg"] = r["result"]["message_id"]
        except Exception as ex:
            log.info("fx post skipped: %s", ex)

    if now - f["last_check"] < CHECK_EVERY:
        return changed
    f["last_check"] = now
    changed = True

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    backfill = f.get("backfill_day") != today          # once a day: also pick up every post published earlier today
    f["backfill_day"] = today
    for kind, channels in FEEDS.items():
        for ch in channels:
            posts = read_posts(ch)
            if not posts:
                log.info("feed %s: no posts readable", ch)
                continue
            todays = [p for p in posts if (p[1] or "")[:10] == today]
            if f["seen"].get(ch) is None:
                f["seen"][ch] = posts[-1][0] - 1
            if backfill and todays:
                f["seen"][ch] = min(f["seen"][ch], todays[0][0] - 1)
            done = {it["id"] for it in f["items"].get(kind, [])}
            new = [p for p in posts if p[0] > f["seen"][ch] and f"{ch}/{p[0]}" not in done][:MAX_PER_CHECK]
            for pid, iso, text, links, photos in new:
                f["seen"][ch] = max(f["seen"][ch], pid)
                text, photo = expand(text, links, photos)
                if len(text) < 60:
                    continue
                item = {"id": f"{ch}/{pid}", "kind": kind, "at": iso, "made": datetime.now(timezone.utc).isoformat(),
                        "photo": photo, "posted": False}
                for lang in ("fa", "ckb"):
                    out = summarize(text, lang)
                    if out:
                        item[lang] = out
                if not item.get("fa"):
                    continue
                f["items"][kind] = sorted([item] + f["items"][kind], key=lambda x: x.get("at") or "", reverse=True)[:KEEP]
                log.info("feed %s/%s summarised (%s)%s", ch, pid, ",".join(k for k in ("fa", "ckb") if item.get(k)),
                         " +photo" if photo else "")
            if not new and f["seen"][ch] < posts[-1][0] and not any(p[0] > f["seen"][ch] for p in posts if f"{ch}/{p[0]}" not in done):
                f["seen"][ch] = posts[-1][0]
    publish(s, f, topics, group_id, send_fn)
    return changed


def find_photo(item_id):
    """picture of an already-summarised post (items made before pictures were stored)"""
    ch, _, pid = item_id.partition("/")
    for p_id, iso, text, links, photos in read_posts(ch):
        if str(p_id) == pid:
            return expand(text, links, photos)[1]
    return None


PUBLISH_PER_LOOP = int(os.environ.get("FEED_PUBLISH_PER_LOOP", "6"))


def publish(s, f, topics, group_id, send_fn):
    """post today's not-yet-posted items to their topic, oldest first, each with its picture"""
    if not group_id:
        return
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not f.get("photo_fix_v1"):                    # today's items went out without pictures once: post them again with pictures
        f["photo_fix_v1"] = today
        for kind in ("onchain", "news"):
            for it in f["items"].get(kind, []):
                if (it.get("at") or "")[:10] == today:
                    it["posted"] = False
    budget = PUBLISH_PER_LOOP
    for kind in ("onchain", "news"):
        if not any(topics.get(k) for k in (kind, f"{kind}:fa", f"{kind}:ckb")):
            continue
        for it in sorted(f["items"].get(kind, []), key=lambda x: x.get("at") or ""):
            if it.get("posted", True) is True and "posted" in it:
                continue
            if (it.get("at") or "")[:10] != today:
                it["posted"] = True                     # older than today: never flood the topic with backlog
                continue
            if budget <= 0:
                return
            if not it.get("photo"):
                it["photo"] = find_photo(it["id"])
            ok = True
            for lang in POST_LANGS:
                th = topics.get(f"{kind}:{lang}") or topics.get(kind)
                if it.get(lang) and th and lang not in it.get("sent", []):
                    r = send_fn(group_id, it[lang], None, message_thread_id=th, plain=True, photo=it.get("photo"))
                    if r.get("ok"):
                        it.setdefault("sent", []).append(lang)
                        it.setdefault("msgs", []).append(r["result"]["message_id"])
                    else:
                        ok = False
                    time.sleep(3.5)                     # stay under Telegram's ~20 messages/minute per group
            if ok:
                it["posted"] = True
            budget -= 1


# ------------------------------------------------------------------ site export (data/onchain.json, data/cryptonews.json on main)
SITE_FILES = {"onchain": "onchain.json", "news": "cryptonews.json"}
_last_site = [0.0]


def export_site(s, worktree, every=900):
    """write the feeds into a checkout of main and push; the site picks them up on its next build"""
    if not worktree or time.time() - _last_site[0] < every:
        return
    _last_site[0] = time.time()
    f = feed_state(s)
    git = lambda *a: subprocess.run(["git", "-C", worktree, *a], capture_output=True, text=True, timeout=120)
    try:
        git("fetch", "-q", "origin", "main")
        git("reset", "-q", "--hard", "origin/main")
        wrote = False
        for kind, fn in SITE_FILES.items():
            items = [{k: v for k, v in it.items() if k in ("id", "at", "made", "fa", "ckb", "photo")} for it in f["items"].get(kind, [])]
            path = os.path.join(worktree, "data", fn)
            body = {"updated_at": datetime.now(timezone.utc).isoformat(), "items": items}
            old = None
            try:
                old = json.load(open(path, encoding="utf-8")).get("items")
            except Exception:
                pass
            if old != items:
                json.dump(body, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
                wrote = True
        if not wrote:
            return
        git("add", "data/onchain.json", "data/cryptonews.json")
        git("commit", "-q", "-m", "chore: on-chain & news feed for site")
        for _ in range(4):
            r = git("push", "-q", "origin", "HEAD:main")
            if r.returncode == 0:
                log.info("site feeds pushed")
                return
            git("fetch", "-q", "origin", "main")
            git("rebase", "-q", "-X", "theirs", "origin/main")
        log.warning("site feed push failed: %s", r.stderr[:200])
    except Exception:
        log.exception("export_site failed")


def section(s, kind, lang, n=3):
    """latest summaries for the bot (fa or ckb; other languages see Persian)"""
    items = feed_state(s)["items"].get(kind, [])[:n]
    key = "ckb" if lang == "ckb" else "fa"
    return [it.get(key) or it.get("fa") for it in items if it.get(key) or it.get("fa")]


# ------------------------------------------------------------------ background worker
DIRTY = threading.Event()


def start(s, send_fn, delete_fn, group_id, worktree=""):
    """run feeds + site export in a daemon thread so slow AI/HTTP calls never block the bot's replies"""
    feed_state(s)
    s.setdefault("topics", {})

    s["topics"].update(env_topics())

    def loop():
        while True:
            try:
                if run(s, send_fn, delete_fn, group_id):
                    DIRTY.set()
                export_site(s, worktree)
            except Exception:
                log.exception("feed worker error")
            time.sleep(20)

    th = threading.Thread(target=loop, name="feeds", daemon=True)
    th.start()
    return th
