"""
«پروندهٔ کوین کورد» — 5 deep posts a day for @Coin_Kurd, researched from the world's leading crypto newsrooms.

Pipeline for every slot:
  1. research  — read the RSS feeds of top global outlets, group the last hours' headlines into stories, and pick
                 the story covered by the MOST outlets (that is what the world is talking about), never one that
                 was already covered; download the full text from up to 4 outlets
  2. synthesis — (owner's "deep research" prompt) facts, numbers, agreeing and opposing views, hidden angle,
                 only from those texts
  3. writing   — (owner's "chief content officer" prompt, Telegram part) one fixed visual/textual theme every time
  4. publish   — branded card (always the same design) + post text in ONE message, exact channel signature
  5. Instagram — reels script, 5–7 carousel slides, caption and hashtags go to the admins' private chat
  6. site      — every post is written to data/deep.json (page /dossier/)
"""
import hashlib
import html
import io
import json
import logging
import os
import re
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import requests

import ai
import bot_feeds as F
import bot_reel as R
from bot_videos import SIG

log = logging.getLogger("deep")

SOURCES = {  # leading global crypto newsrooms (RSS)
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "Cointelegraph": "https://cointelegraph.com/rss",
    "The Block": "https://www.theblock.co/rss.xml",
    "Decrypt": "https://decrypt.co/feed",
    "Bitcoin Magazine": "https://bitcoinmagazine.com/.rss/full/",
    "Blockworks": "https://blockworks.co/feed",
    "CryptoSlate": "https://cryptoslate.com/feed/",
    "The Defiant": "https://thedefiant.io/api/feed",
    "CryptoPotato": "https://cryptopotato.com/feed/",
    "BeInCrypto": "https://beincrypto.com/feed/",
}
SLOTS_UTC = [(5, 30), (8, 30), (11, 30), (14, 30), (17, 30)]   # 09:00 12:00 15:00 18:00 21:00 Iran
WINDOW = 3 * 3600
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
STOP = set("the a an of to in on for and with is are as at by from after over its it this that be will has have new "
           "says said could why how what amid into than more about up down out report crypto market price".split())
RAW = "https://raw.githubusercontent.com/" + os.environ.get("GITHUB_REPOSITORY", "omidmokri/coinkurd") + "/main/"


# ------------------------------------------------------------------ 1. research
def _text(e, *tags):
    for t in tags:
        x = e.find(t)
        if x is not None and (x.text or "").strip():
            return x.text.strip()
    return ""


def fetch_feed(name, url):
    try:
        r = requests.get(url, headers=UA, timeout=25)
        root = ET.fromstring(r.content)
    except Exception as ex:
        log.info("feed %s: %s", name, ex)
        return []
    out = []
    ns_c = "{http://purl.org/rss/1.0/modules/content/}encoded"
    for it in root.iter("item"):
        title = _text(it, "title")
        link = _text(it, "link")
        try:
            ts = parsedate_to_datetime(_text(it, "pubDate")).timestamp()
        except Exception:
            ts = time.time()
        body = _text(it, ns_c, "description")
        body = re.sub(r"<[^>]+>", " ", html.unescape(body))
        out.append({"src": name, "title": html.unescape(title), "link": link, "ts": ts,
                    "body": re.sub(r"\s+", " ", body).strip()[:4000]})
    return out


def words(t):
    return {w for w in re.findall(r"[a-z0-9$]{3,}", t.lower()) if w not in STOP}


def stories(items):
    """greedy clustering of headlines that share key words -> [[item,...]] biggest first"""
    groups = []
    for it in sorted(items, key=lambda x: -x["ts"]):
        w = words(it["title"])
        best, score = None, 0
        for g in groups:
            sc = len(w & g["w"]) / max(1, min(len(w), len(g["w"])))
            if sc > score:
                best, score = g, sc
        if best and score >= 0.4 and len(w & best["w"]) >= 2:
            best["items"].append(it)
            best["w"] |= w
        else:
            groups.append({"w": set(w), "items": [it]})

    def rank(g):
        srcs = {i["src"] for i in g["items"]}
        newest = max(i["ts"] for i in g["items"])
        big = 1.3 if re.search(r"bitcoin|btc|ether|eth|etf|sec|fed|blackrock|stablecoin|hack", " ".join(
            i["title"].lower() for i in g["items"])) else 1.0
        return len(srcs) * big - (time.time() - newest) / 86400
    groups.sort(key=rank, reverse=True)
    return [g["items"] for g in groups]


def story_key(items):
    return hashlib.md5(" ".join(sorted(words(items[0]["title"]))).encode()).hexdigest()[:12]


def pick_story(st, hours=14):
    items = []
    for n, u in SOURCES.items():
        items += [i for i in fetch_feed(n, u) if time.time() - i["ts"] < hours * 3600]
    log.info("deep: %d fresh headlines from %d outlets", len(items), len({i['src'] for i in items}))
    done_words = [set(x) for x in st.get("done_words", [])]
    for g in stories(items):
        w = words(" ".join(i["title"] for i in g))
        if story_key(g) in st.get("done", []):
            continue
        if any(len(w & d) / max(1, min(len(w), len(d))) > 0.5 for d in done_words):
            continue               # same story already covered today/yesterday
        return g
    return None


def dossier(g):
    """full texts from up to 4 different outlets"""
    seen, parts = set(), []
    for it in g:
        if it["src"] in seen:
            continue
        seen.add(it["src"])
        txt, _ = F.article_text(it["link"], limit=4000) if it["link"] else ("", None)
        if len(txt) < len(it["body"]):
            txt = it["body"]
        if len(txt) > 200:
            parts.append(f"[{it['src']}] {it['title']}\n{txt}")
        if len(parts) >= 4:
            break
    return parts


# ------------------------------------------------------------------ 2+3. synthesis and writing
RESEARCH = """تو پژوهشگر و تحلیلگر دادهٔ ارشد بازارهای مالی هستی. متن‌های زیر گزارش رسانه‌های معتبر جهانی دربارهٔ یک رویداد است.
عمیق‌ترین تلفیق ممکن را بساز، فقط از همین متن‌ها، به زبان پارسی و به شکل یادداشت پژوهشی فشرده:
۱. رویداد دقیقاً چیست (چه کسی، چه چیزی، کی، چقدر)
۲. همهٔ عددها، آمارها و داده‌های مشخص متن‌ها (بدون گرد کردن)
۳. زمینه و پیشینه‌ای که متن‌ها می‌گویند
۴. دیدگاه‌های موافق و مخالف و جاهایی که گزارش‌ها با هم فرق دارند
۵. زاویهٔ پنهان: نکته‌ای که از کنار هم گذاشتن گزارش‌ها درمی‌آید و بیشتر رسانه‌ها نگفته‌اند
۶. پیامد برای بیت‌کوین، اتریوم و سرمایه‌گذار معمولی
هیچ ادعایی بدون پشتوانه در متن‌ها ننویس. اگر چیزی در متن‌ها نیست، نگو"""

WRITE = """نقش تو مدیر ارشد محتوا، روان‌شناس رفتار مخاطب و استراتژیست ویرال‌شدن محتوا در تلگرام برای کانال «کوین کورد» است.
از یادداشت پژوهشی زیر یک پست تلگرامی فوق‌حرفه‌ای بساز که مخاطب را در نگاه اول قفل کند.

قالب ثابت کانال (همیشه دقیقاً همین ترتیب و همین سرتیترها):
خط ۱: 🧠 پروندهٔ کوین کورد
خط ۲: قوی‌ترین قلاب ممکن به‌عنوان تیتر، داخل <b></b> (از بین پنج قلاب روان‌شناسانه‌ای که در ذهنت می‌سازی بهترین را بگذار؛ بدون اغراق دروغ)
━━━━━━━━━━
⚡️ <b>در ۳ ثانیه</b>
یک جملهٔ کوبنده که کل ماجرا را می‌گوید
━━━━━━━━━━
📊 <b>عددهایی که باید بدانی</b>
۳ تا ۴ خط کوتاه با بولت، هر کدام یک عدد واقعی از یادداشت و معنی آن، کلمهٔ کلیدی هر خط داخل <b></b>
━━━━━━━━━━
🔍 <b>چیزی که ۹۰٪ رسانه‌ها نمی‌گویند</b>
۲ تا ۳ خط: همان زاویهٔ پنهان یادداشت
━━━━━━━━━━
⚖️ <b>دو روی سکه</b>
🟢 یک خط دیدگاه موافق یا خوش‌بینانه
🔴 یک خط دیدگاه مخالف یا ریسک
━━━━━━━━━━
🎯 <b>برای کیف پول تو یعنی چه؟</b>
۱ تا ۲ خط کاربردی، بدون توصیهٔ مستقیم خرید یا فروش
━━━━━━━━━━
💬 یک سؤال برای کامنت که بحث راه بیندازد
📌 یک جمله که دلیل ذخیره کردن یا فرستادن پست برای یک دوست را بگوید
خط آخر: دقیقاً چهار هشتگ پارسی

قانون‌های قطعی:
- فقط از یادداشت پژوهشی استفاده کن؛ هیچ عدد یا رویدادی از خودت نساز
- هیچ حرف لاتین ننویس (نام شرکت‌ها و اصطلاحات را به پارسی بنویس، مثلاً بلک‌راک، صندوق قابل معامله، کمیسیون بورس آمریکا)
- هیچ لینک یا نام رسانه ننویس
- فقط از تگ <b> برای برجسته کردن استفاده کن؛ هیچ تگ دیگری نه
- آخر خط‌ها نقطه نگذار
- کل متن بین ۹۰۰ و ۲۲۰۰ کاراکتر
- فقط خود پست را بنویس"""

INSTA = """از یادداشت پژوهشی و پست تلگرامی زیر، بستهٔ اینستاگرام کانال «کوین کورد» را به پارسی بنویس:
🎬 سناریوی ریلز ۱۵ تا ۳۰ ثانیه: برای هر صحنه سه خط «گوینده:» «روی صفحه:» «تصویر و افکت:»
🖼 پست اسلایدی ۶ اسلاید: اسلاید ۱ قلاب، اسلایدهای ۲ تا ۵ ارزش، اسلاید ۶ دعوت به اقدام؛ برای هر اسلاید متن و ایدهٔ گرافیکی
✍️ کپشن تعاملی کوتاه
#️⃣ سه دسته هشتگ: اختصاصی، عمومی، پرطرفدار
🎨 پیشنهاد گرافیکی برای تصویر یا اینفوگرافیک همراه پست تلگرام
فقط از اطلاعات یادداشت استفاده کن"""


def check(text):
    p = []
    if not (900 <= len(text) <= 2600):
        p.append(f"طول متن {len(text)} است؛ باید بین ۹۰۰ و ۲۲۰۰ کاراکتر باشد")
    plain = re.sub(r"</?b>", "", text)
    if re.search(r"[A-Za-z]", plain):
        p.append("این کلمه‌های لاتین را به پارسی بنویس: " + "، ".join(sorted(set(re.findall(r"[A-Za-z]+", plain)))[:8]))
    if re.search(r"<(?!/?b>)", text):
        p.append("فقط تگ <b> مجاز است")
    if len(re.findall(r"#\S+", text)) != 4:
        p.append("دقیقاً چهار هشتگ در خط آخر")
    if not text.startswith("🧠 پروندهٔ کوین کورد"):
        p.append("خط اول باید دقیقاً «🧠 پروندهٔ کوین کورد» باشد")
    if text.count("<b>") != text.count("</b>"):
        p.append("تگ‌های <b> باید بسته شوند")
    return p


def generate(prompt, tokens=2500):
    out = ai.generate(prompt, temperature=0.45, max_tokens=tokens)
    return re.sub(r"^```\w*|```$", "", out.strip()).strip()


def write_post(parts):
    notes = generate(RESEARCH + "\n\nمتن‌ها:\n\n" + "\n\n".join(parts)[:14000], 3000)
    if len(notes) < 300:
        return None, None
    prompt = WRITE + "\n\nیادداشت پژوهشی:\n" + notes
    for _ in range(3):
        post = generate(prompt)
        post = "\n".join(ln.rstrip().rstrip(".") for ln in post.split("\n")).strip()
        pr = check(post)
        if not pr:
            return post, notes
        prompt = WRITE + "\n\nیادداشت پژوهشی:\n" + notes + "\n\nپست قبلی این مشکل‌ها را داشت؛ درستش کن:\n- " + "\n- ".join(pr) + "\n\nپست قبلی:\n" + post
    log.info("deep post dropped: %s", check(post)[:2])
    return None, notes


# ------------------------------------------------------------------ 4. card (one fixed design for every dossier)
def card(post):
    """the same Coin_Kurd dossier frame every time: badge, headline, 3-second summary, footer (720x900, 4:5)"""
    from PIL import Image, ImageDraw
    lines = [re.sub(r"</?b>", "", x).strip() for x in post.split("\n")]
    title = R.EMOJI.sub("", lines[1] if len(lines) > 1 else lines[0]).strip()
    quick = ""
    for i, ln in enumerate(lines):
        if "در ۳ ثانیه" in ln and i + 1 < len(lines):
            quick = R.EMOJI.sub("", lines[i + 1]).strip()
            break
    W, H = 720, 900
    im = Image.new("RGB", (W, H), R.BG)
    d = ImageDraw.Draw(im)
    for y in range(H):                                   # soft vertical glow
        c = int(18 * (1 - y / H))
        d.line([(0, y), (W, y)], fill=(R.BG[0] + c, R.BG[1] + c, R.BG[2] + c + 4))
    d.rectangle([0, 0, W, 12], fill=R.ACC)
    try:
        lg = Image.open(R.LOGO).convert("RGBA")
        lg.thumbnail((170, 110))
        im.paste(lg, (36, 40), lg)
    except Exception:
        pass
    fb = R.font(32)
    s = R.shape("🧠 پروندهٔ کوین کورد".replace("🧠 ", ""))
    bw = fb.getlength(s) + 40
    d.rounded_rectangle([W - 36 - bw, 60, W - 36, 116], 16, fill=R.ACC)
    d.text((W - 56 - fb.getlength(s), 64), s, font=fb, fill=R.BG)
    y = 200
    for size in (54, 48, 42):
        ft = R.font(size)
        tl = R.wrap(title, ft, W - 90)
        if len(tl) <= 4:
            break
    for ln in tl[:4]:
        sh = R.shape(ln)
        d.text((W - 45 - ft.getlength(sh), y), sh, font=ft, fill=R.FG)
        y += int(size * 1.45)
    y += 20
    d.rectangle([W - 45 - 90, y, W - 45, y + 6], fill=R.ACC)
    y += 36
    fq = R.font(34)
    for ln in R.wrap(quick, fq, W - 90)[:5]:
        sh = R.shape(ln)
        d.text((W - 45 - fq.getlength(sh), y), sh, font=fq, fill=(200, 206, 216))
        y += 52
    d.rectangle([0, H - 90, W, H], fill=(20, 24, 32))
    ff = R.font(28)
    s = R.shape("کوین کورد") + "  ·  t.me/Coin_Kurd"
    d.text(((W - ff.getlength(s)) / 2, H - 66), s, font=ff, fill=R.ACC)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return buf.getvalue()


# ------------------------------------------------------------------ 5/6. publish, site
def push_files(worktree, files, msg):
    """files: {repo_path: bytes|str} -> True when on origin/main"""
    if not worktree:
        return False
    git = lambda *a: subprocess.run(["git", "-C", worktree, *a], capture_output=True, text=True, timeout=120)
    try:
        git("fetch", "-q", "origin", "main")
        git("reset", "-q", "--hard", "origin/main")
        for p, data in files.items():
            full = os.path.join(worktree, p)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            open(full, "wb").write(data if isinstance(data, bytes) else data.encode())
            git("add", p)
        git("commit", "-q", "-m", msg)
        for _ in range(4):
            if git("push", "-q", "origin", "HEAD:main").returncode == 0:
                return True
            git("fetch", "-q", "origin", "main")
            git("rebase", "-q", "-X", "theirs", "origin/main")
    except Exception:
        log.exception("push failed")
    return False


def publish(st, post, notes, g, send_fn, channel, admins, worktree):
    pid = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    img = card(post)
    img_path = f"data/deepimg/{pid}.jpg"
    body = post + "\n\n" + SIG
    r = {"ok": False}
    if push_files(worktree, {img_path: img}, "chore: dossier card"):
        time.sleep(5)
        r = send_fn(channel, body, link_preview_options={
            "url": RAW + img_path, "prefer_large_media": True, "show_above_text": True})
    if not r.get("ok"):                          # fallback: card as photo, text below
        r = send_fn(channel, "🧠", photo=img)
        if r.get("ok"):
            r = send_fn(channel, body)
    if not r.get("ok"):
        log.warning("dossier not posted: %s", r.get("description"))
        return False
    item = {"id": pid, "at": datetime.now(timezone.utc).isoformat(), "fa": post, "img": "/" + img_path,
            "outlets": sorted({i["src"] for i in g})}
    st.setdefault("posts", []).insert(0, item)
    del st["posts"][60:]
    site = {"updated_at": item["at"], "items": st["posts"]}
    push_files(worktree, {"data/deep.json": json.dumps(site, ensure_ascii=False, indent=1)}, "chore: dossier for site")
    F.rebuild_site()
    try:
        pack = generate(INSTA + "\n\nیادداشت پژوهشی:\n" + (notes or "") + "\n\nپست تلگرام:\n" + post, 3000)
        for a in admins:
            send_fn(a, "📦 <b>بستهٔ اینستاگرام پروندهٔ امروز</b>\n\n" + html.escape(pack[:3900], quote=False))
    except Exception as ex:
        log.info("insta pack failed: %s", ex)
    return True


def run_slot(s, st, send_fn, channel, admins, worktree):
    if not ai.available():
        return False
    for _ in range(3):
        g = pick_story(st)
        if not g:
            return False
        st.setdefault("done", []).append(story_key(g))
        st.setdefault("done_words", []).append(sorted(words(" ".join(i["title"] for i in g))))
        del st["done"][:-200]
        del st["done_words"][:-30]
        parts = dossier(g)
        if len(parts) < 1:
            continue
        post, notes = write_post(parts)
        if post:
            return publish(st, post, notes, g, send_fn, channel, admins, worktree)
    return False


def tick(s, send_fn, channel, admins, worktree):
    st = s.setdefault("deep", {})
    st.setdefault("slots", {})
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    for h, m in SLOTS_UTC:
        key = f"{day}:{h}"
        age = (now - now.replace(hour=h, minute=m, second=0, microsecond=0)).total_seconds()
        if st["slots"].get(key) or age < 0 or age > WINDOW:
            continue
        st["slots"][key] = "busy"
        ok = run_slot(s, st, send_fn, channel, admins, worktree)
        st["slots"][key] = "ok" if ok else "fail"
        for k in list(st["slots"]):
            if k[:10] < day:
                del st["slots"][k]
        log.info("dossier %s -> %s", key, ok)
        return True
    if not st.get("first"):                       # first start: publish one dossier right away
        st["first"] = day
        ok = run_slot(s, st, send_fn, channel, admins, worktree)
        log.info("dossier first -> %s", ok)
        return True
    return False


def start(s, send_fn, channel, admins, worktree=""):
    def loop():
        time.sleep(60)
        while True:
            try:
                if tick(s, send_fn, channel, admins, worktree):
                    F.DIRTY.set()
            except Exception:
                log.exception("deep error")
            time.sleep(60)

    th = threading.Thread(target=loop, name="deep", daemon=True)
    th.start()
    return th
