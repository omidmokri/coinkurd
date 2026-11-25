"""
Downloader: a link from a social network in, the media file itself out, inside the chat.

The member pastes any public link — X, TikTok, Facebook, Twitch, SoundCloud, a Telegram post,
a direct file — and the bot sends the video or the audio back. Everything runs on the bot's own
runner with yt-dlp; nothing is stored and no third-party downloader site is involved.

Two limits shape the whole module and neither can be argued with:

  * A bot may upload 50 MB. So the format is chosen to FIT, not to be the best: the largest
    quality whose size is under the cap wins, and when nothing fits the audio is offered instead.
  * The runner has a datacenter IP. Measured on a GitHub runner (2026-11-25): X/Twitter, TikTok,
    Facebook, Twitch, SoundCloud, Telegram and direct links answer it; YouTube ("sign in to
    confirm you're not a bot"), Instagram, Reddit and Vimeo refuse it without an account cookie.
    Those are not bugs to fix in code — the user is told plainly which site refused and why.

Setting COOKIES_TXT (a Netscape cookies file in the workflow's environment) turns the refusing
sites on; without it the module simply never claims to support them.
"""
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time

from bot_i18n import pick

log = logging.getLogger("refbot.dl")

CAP = 48 * 1024 * 1024                   # Telegram lets a bot upload 50 MB; 48 leaves room for the container
LADDER = (1080, 720, 480, 360, 240)      # tried in turn until one fits under the cap
TIMEOUT = 300                            # a single download may take five minutes, then it is abandoned
COOLDOWN = 20                            # seconds between two downloads by the same member
DAILY = 25                               # downloads per member per day
COOKIES = os.environ.get("COOKIES_TXT") or ""

URL_RE = re.compile(r"https?://[^\s<>\"'()]+", re.I)

# What the runner's own IP can reach, measured rather than assumed.
OPEN = ("x.com", "twitter.com", "tiktok.com", "facebook.com", "fb.watch", "twitch.tv",
        "soundcloud.com", "t.me", "telegram.me", "dailymotion.com", "pinterest.",
        "vk.com", "ok.ru", "bilibili.com", "rumble.com", "odysee.com", "streamable.com",
        "bitchute.com", "9gag.com", "imgur.com", "tumblr.com", "linkedin.com")
NEEDS_COOKIE = {"youtube.com": "YouTube", "youtu.be": "YouTube", "instagram.com": "Instagram",
                "reddit.com": "Reddit", "redd.it": "Reddit", "vimeo.com": "Vimeo"}

T = {
    "screen": {
        "fa": ("⬇️ <b>دانلودر شبکه‌های اجتماعی</b>\n"
               "لینک را بفرست، فایلش را همین‌جا می‌گیری.\n\n"
               "<b>بدون دردسر کار می‌کند:</b>\n"
               "ایکس (توییتر) · تیک‌تاک · فیسبوک · توییچ · ساندکلاد · پست تلگرام · لینک مستقیم\n"
               "و ده‌ها سایت دیگر — فقط لینک را امتحان کن.\n\n"
               "<b>فعلاً نمی‌شود:</b> یوتیوب، اینستاگرام، ردیت و ویمئو؛ این‌ها دانلود از سرور را "
               "مسدود می‌کنند و ورود با حساب می‌خواهند.\n\n"
               "<b>چند نکته:</b>\n"
               "• سقف آپلود ربات‌های تلگرام ۵۰ مگابایت است؛ اگر ویدیو بزرگ‌تر باشد خودکار کیفیت "
               "پایین‌تری که جا شود فرستاده می‌شود.\n"
               "• برای گرفتن فقط صدا، بعد از لینک بنویس <code>صدا</code> یا <code>mp3</code>.\n"
               "• فقط محتوایی را بگیر که حق دانلودش را داری.\n\n"
               "👇 لینک را بفرست"),
        "ckb": ("⬇️ <b>داگرتنی تۆڕە کۆمەڵایەتییەکان</b>\n"
                "لینک بنێرە، فایلەکەی لێرە وەردەگریت.\n\n"
                "<b>بێ کێشە کار دەکات:</b>\n"
                "ئێکس (تویتەر) · تیکتۆک · فەیسبووک · تویچ · ساوندکلاود · پۆستی تێلێگرام · لینکی ڕاستەوخۆ\n"
                "و دەیان ماڵپەڕی تر — تەنها لینکەکە تاقی بکەرەوە.\n\n"
                "<b>ئێستا نابێت:</b> یوتیوب، ئینستاگرام، ڕێدیت و ڤیمیۆ؛ ئەمانە داگرتن لە ڕاژە "
                "ڕێگری دەکەن و چوونەژوورەوە دەخوازن.\n\n"
                "<b>چەند تێبینییەک:</b>\n"
                "• سنووری بارکردنی بۆتەکانی تێلێگرام ٥٠ مێگابایتە؛ ئەگەر ڤیدیۆکە گەورەتر بێت "
                "خۆکارانە کوالیتییەکی نزمتر دەنێردرێت.\n"
                "• بۆ تەنها دەنگ، دوای لینکەکە بنووسە <code>دەنگ</code> یان <code>mp3</code>.\n"
                "• تەنها ئەو ناوەڕۆکە وەربگرە کە مافی داگرتنی هەیە.\n\n"
                "👇 لینک بنێرە"),
        "kmr": ("⬇️ <b>Daxistina torên civakî</b>\n"
                "Girêdanê bişîne, pela wê li vir werdigirî.\n\n"
                "<b>Bê pirsgirêk dixebite:</b>\n"
                "X (Twitter) · TikTok · Facebook · Twitch · SoundCloud · peyama Telegramê · girêdana rasterast\n"
                "û dehan malperên din — tenê girêdanê biceribîne.\n\n"
                "<b>Niha nabe:</b> YouTube, Instagram, Reddit û Vimeo; ev malper daxistina ji "
                "serverê asteng dikin û têketinê dixwazin.\n\n"
                "<b>Çend not:</b>\n"
                "• Sînorê barkirinê yê botên Telegramê 50 MB e; heke vîdyo mezintir be, bi "
                "xweberî qalîteyeke nizmtir tê şandin.\n"
                "• Ji bo tenê deng, piştî girêdanê binivîse <code>mp3</code>.\n"
                "• Tenê naveroka ku mafê te yê daxistinê heye bistîne.\n\n"
                "👇 Girêdanê bişîne"),
        "ar": ("⬇️ <b>مُنزِّل الشبكات الاجتماعية</b>\n"
               "أرسل الرابط، وستحصل على الملف هنا.\n\n"
               "<b>يعمل بلا مشاكل:</b>\n"
               "إكس (تويتر) · تيك توك · فيسبوك · تويتش · ساوندكلاود · منشور تيليغرام · رابط مباشر\n"
               "وعشرات المواقع الأخرى — جرّب الرابط فقط.\n\n"
               "<b>غير متاح حاليًا:</b> يوتيوب وإنستغرام وريديت وفيميو؛ هذه المواقع تمنع التنزيل "
               "من الخوادم وتطلب تسجيل الدخول.\n\n"
               "<b>ملاحظات:</b>\n"
               "• حد الرفع لبوتات تيليغرام ٥٠ ميغابايت؛ إذا كان الفيديو أكبر تُرسل جودة أقل تلقائيًا.\n"
               "• للصوت فقط، اكتب بعد الرابط <code>mp3</code>.\n"
               "• نزّل فقط ما تملك حق تنزيله.\n\n"
               "👇 أرسل الرابط"),
        "en": ("⬇️ <b>Social downloader</b>\n"
               "Send a link, get the file right here.\n\n"
               "<b>Works without trouble:</b>\n"
               "X (Twitter) · TikTok · Facebook · Twitch · SoundCloud · a Telegram post · direct links\n"
               "and dozens of other sites — just try the link.\n\n"
               "<b>Not possible right now:</b> YouTube, Instagram, Reddit and Vimeo. They block "
               "downloads from servers and ask for a signed-in account.\n\n"
               "<b>A few notes:</b>\n"
               "• A Telegram bot may upload 50 MB; a bigger video is sent automatically at the "
               "best quality that fits.\n"
               "• For audio only, write <code>mp3</code> after the link.\n"
               "• Only take content you have the right to download.\n\n"
               "👇 Send the link"),
    },
    "ask": {"fa": "🔗 لینک را بفرست (ایکس، تیک‌تاک، فیسبوک، توییچ، ساندکلاد، تلگرام…).\n"
                  "برای فقط صدا، بعد از لینک بنویس <code>صدا</code>.",
            "ckb": "🔗 لینک بنێرە (ئێکس، تیکتۆک، فەیسبووک، تویچ، ساوندکلاود، تێلێگرام…).\n"
                   "بۆ تەنها دەنگ، دوای لینکەکە بنووسە <code>دەنگ</code>.",
            "kmr": "🔗 Girêdanê bişîne (X, TikTok, Facebook, Twitch, SoundCloud, Telegram…).\n"
                   "Ji bo tenê deng, piştî wê binivîse <code>mp3</code>.",
            "ar": "🔗 أرسل الرابط (إكس، تيك توك، فيسبوك، تويتش، ساوندكلاود، تيليغرام…).\n"
                  "للصوت فقط اكتب بعده <code>mp3</code>.",
            "en": "🔗 Send the link (X, TikTok, Facebook, Twitch, SoundCloud, Telegram…).\n"
                  "For audio only, write <code>mp3</code> after it."},
    "working": {"fa": "⏳ دارم می‌گیرمش… بسته به حجم، تا یکی دو دقیقه طول می‌کشد.",
                "ckb": "⏳ خەریکی وەرگرتنیەتی… بەپێی قەبارە، تا یەک دوو خولەک دەخایەنێت.",
                "kmr": "⏳ Tê daxistin… li gor mezinahiyê, heta du deqeyan dikare bidome.",
                "ar": "⏳ جارٍ التنزيل… قد يستغرق دقيقة أو دقيقتين حسب الحجم.",
                "en": "⏳ Fetching it… depending on size this takes a minute or two."},
    "no_url": {"fa": "🔗 لینک پیدا نکردم. کل لینک را کپی کن و بفرست.",
               "ckb": "🔗 لینکم نەدۆزییەوە. هەموو لینکەکە کۆپی بکە و بینێرە.",
               "kmr": "🔗 Min girêdan nedît. Hemû girêdanê kopî bike û bişîne.",
               "ar": "🔗 لم أجد رابطًا. انسخ الرابط كاملًا وأرسله.",
               "en": "🔗 I found no link. Copy the whole link and send it."},
    "blocked": {"fa": "🚫 {site} دانلود از سرور را مسدود می‌کند و ورود با حساب می‌خواهد، پس این لینک از اینجا نمی‌آید.\n\n"
                      "بقیهٔ شبکه‌ها (ایکس، تیک‌تاک، فیسبوک، توییچ، ساندکلاد، تلگرام) کار می‌کنند.",
                "ckb": "🚫 {site} داگرتن لە ڕاژە ڕێگری دەکات و چوونەژوورەوە دەخوازێت، بۆیە ئەم لینکە لێرەوە نایەت.\n\n"
                       "ئەوانی تر (ئێکس، تیکتۆک، فەیسبووک، تویچ، ساوندکلاود، تێلێگرام) کار دەکەن.",
                "kmr": "🚫 {site} daxistina ji serverê asteng dike û têketinê dixwaze, loma ev girêdan ji vir nayê.\n\n"
                       "Yên din (X, TikTok, Facebook, Twitch, SoundCloud, Telegram) dixebitin.",
                "ar": "🚫 {site} يمنع التنزيل من الخوادم ويطلب تسجيل الدخول، لذا لا يمكن جلب هذا الرابط من هنا.\n\n"
                      "البقية (إكس، تيك توك، فيسبوك، تويتش، ساوندكلاود، تيليغرام) تعمل.",
                "en": "🚫 {site} blocks server-side downloads and wants a signed-in account, so this link can't be fetched here.\n\n"
                      "The rest (X, TikTok, Facebook, Twitch, SoundCloud, Telegram) work."},
    "private": {"fa": "🔒 این پست خصوصی است، حذف شده یا برای همه باز نیست.",
                "ckb": "🔒 ئەم پۆستە تایبەتە، سڕاوەتەوە یان بۆ هەمووان کراوە نییە.",
                "kmr": "🔒 Ev şandî taybet e, hatiye jêbirin an ji bo her kesî vekirî nîne.",
                "ar": "🔒 هذا المنشور خاص أو محذوف أو غير متاح للجميع.",
                "en": "🔒 This post is private, removed, or not open to everyone."},
    "unsupported": {"fa": "🤷 این سایت را نمی‌شناسم. لینک مستقیم فایل را بفرست یا از شبکهٔ دیگری امتحان کن.",
                    "ckb": "🤷 ئەم ماڵپەڕە ناناسم. لینکی ڕاستەوخۆی فایلەکە بنێرە یان تۆڕێکی تر تاقی بکەرەوە.",
                    "kmr": "🤷 Ez vê malperê nas nakim. Girêdana rasterast a pelê bişîne an toreke din biceribîne.",
                    "ar": "🤷 لا أعرف هذا الموقع. أرسل رابطًا مباشرًا للملف أو جرّب شبكة أخرى.",
                    "en": "🤷 I don't know this site. Send a direct file link or try another network."},
    "too_big": {"fa": "📦 حتی پایین‌ترین کیفیت هم از سقف ۵۰ مگابایت تلگرام بزرگ‌تر است.\n"
                      "اگر صدایش کافی است، لینک را با کلمهٔ <code>صدا</code> دوباره بفرست.",
                "ckb": "📦 تەنانەت نزمترین کوالیتیش لە سنووری ٥٠ مێگابایتی تێلێگرام گەورەترە.\n"
                       "ئەگەر دەنگەکەی بەسە، لینکەکە لەگەڵ وشەی <code>دەنگ</code> دووبارە بنێرە.",
                "kmr": "📦 Qalîteya herî nizm jî ji sînorê 50 MB yê Telegramê mezintir e.\n"
                       "Heke deng bes be, girêdanê bi <code>mp3</code> re dîsa bişîne.",
                "ar": "📦 حتى أدنى جودة أكبر من حد الـ٥٠ ميغابايت في تيليغرام.\n"
                      "إن كان الصوت يكفي، أعد إرسال الرابط مع كلمة <code>mp3</code>.",
                "en": "📦 Even the lowest quality is over Telegram's 50 MB limit.\n"
                      "If the audio is enough, send the link again with <code>mp3</code>."},
    "slow": {"fa": "⌛ این یکی خیلی طول کشید و رهایش کردم. اگر ویدیوی بلندی است، صدایش را بگیر.",
             "ckb": "⌛ ئەمە زۆری خایاند و وازم لێهێنا. ئەگەر ڤیدیۆیەکی درێژە، دەنگەکەی وەربگرە.",
             "kmr": "⌛ Ev pir dirêj kişand û min dev jê berda. Heke vîdyoyeke dirêj be, dengê wê bistîne.",
             "ar": "⌛ استغرق هذا وقتًا طويلًا فتوقفت. إن كان فيديو طويلًا، خذ الصوت فقط.",
             "en": "⌛ This took too long and I gave up. If it's a long video, take the audio."},
    "failed": {"fa": "😕 نشد. لینک را یک‌بار دیگر چک کن یا کمی بعد دوباره امتحان کن.",
               "ckb": "😕 نەبوو. جارێکی تر لینکەکە بپشکنە یان دواتر هەوڵ بدەرەوە.",
               "kmr": "😕 Nebû. Girêdanê careke din kontrol bike an paşê dîsa biceribîne.",
               "ar": "😕 لم ينجح. تحقق من الرابط أو أعد المحاولة لاحقًا.",
               "en": "😕 That didn't work. Check the link or try again a little later."},
    "wait": {"fa": "⏱ چند لحظه صبر کن؛ {n} ثانیهٔ دیگر دوباره بفرست.",
             "ckb": "⏱ چەند چرکەیەک چاوەڕێ بکە؛ دوای {n} چرکە دووبارە بنێرە.",
             "kmr": "⏱ Hinekî bisekine; piştî {n} saniyeyan dîsa bişîne.",
             "ar": "⏱ انتظر قليلًا؛ أعد الإرسال بعد {n} ثانية.",
             "en": "⏱ Hold on a moment; send it again in {n} seconds."},
    "quota": {"fa": "📊 سهمیهٔ امروزت ({n} دانلود) تمام شد. فردا دوباره باز می‌شود.",
              "ckb": "📊 بەشی ئەمڕۆت ({n} داگرتن) تەواو بوو. بەیانی دووبارە دەکرێتەوە.",
              "kmr": "📊 Para te ya îro ({n} daxistin) qediya. Sibe dîsa vedibe.",
              "ar": "📊 انتهت حصتك اليوم ({n} تنزيل). تُفتح غدًا من جديد.",
              "en": "📊 Your quota for today ({n} downloads) is used up. It reopens tomorrow."},
    "cap_note": {"fa": "کیفیت کامل از ۵۰ مگابایت بزرگ‌تر بود، این نسخه جا شد.",
                 "ckb": "کوالیتی تەواو لە ٥٠ مێگابایت گەورەتر بوو، ئەم وەشانە جێی بووەوە.",
                 "kmr": "Qalîteya tam ji 50 MB mezintir bû, ev guhertoya ku diguncê hat şandin.",
                 "ar": "الجودة الكاملة تجاوزت ٥٠ ميغابايت، وهذه النسخة مناسبة.",
                 "en": "Full quality was over 50 MB; this version fits."},
}


def L(key, lang, **kw):
    s = pick(T[key], lang) or T[key]["en"]
    return s.format(**kw) if kw else s


def find_url(text):
    m = URL_RE.search(text or "")
    if not m:
        return None
    return m.group(0).rstrip(".,;:!?)»”\"'")


def wants_audio(text):
    low = (text or "").lower()
    return any(w in low for w in ("mp3", "audio", "صدا", "صوت", "دەنگ", "deng", "موزیک", "music"))


def blocked_site(url):
    low = (url or "").lower()
    if COOKIES:                                 # with a cookie file those sites answer like any other
        return None
    for host, label in NEEDS_COOKIE.items():
        if host in low:
            return label
    return None


def screen(lang):
    return L("screen", lang)


def allow(x, uid, admin=False):
    """-> (ok, message_key, n). Keeps one member from tying the runner up all day."""
    if admin:
        return True, None, 0
    d = x.setdefault("dl", {})
    today = time.strftime("%Y-%m-%d")
    if d.get("day") != today:
        d["day"], d["n"] = today, 0
    gap = int(COOLDOWN - (time.time() - d.get("at", 0)))
    if gap > 0:
        return False, "wait", gap
    if d.get("n", 0) >= DAILY:
        return False, "quota", DAILY
    return True, None, 0


def charge(x):
    d = x.setdefault("dl", {})
    d["at"] = time.time()
    d["n"] = d.get("n", 0) + 1


def _run(args, timeout=TIMEOUT):
    base = ["yt-dlp", "--no-warnings", "--no-playlist", "--socket-timeout", "25", "--retries", "2"]
    if COOKIES:
        base += ["--cookies", COOKIES]
    return subprocess.run(base + args, capture_output=True, text=True, timeout=timeout)


def probe(url):
    """-> (info, error_key). Metadata only, so a refusal costs seconds instead of minutes."""
    try:
        p = _run(["-J", url], timeout=90)
    except subprocess.TimeoutExpired:
        return None, "slow"
    if p.returncode == 0 and p.stdout.strip():
        try:
            return json.loads(p.stdout), None
        except Exception:
            return None, "failed"
    err = (p.stderr or "").lower()
    if "unsupported url" in err:
        return None, "unsupported"
    if ("sign in" in err or "cookies" in err or "authentication" in err or "logged-in" in err
            or "login required" in err or "empty media response" in err):
        return None, "blocked"
    if "private" in err or "unavailable" in err or "not found" in err or "removed" in err:
        return None, "private"
    log.warning("probe %s -> %s", url, (p.stderr or "")[-200:])
    return None, "failed"


def _size(f):
    return f.get("filesize") or f.get("filesize_approx") or 0


def has_ffmpeg():
    """Checked per call, not at import: the bot's runner installs ffmpeg in the background."""
    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def pick_format(info, audio_only, merge):
    """The best quality that still fits the upload cap.

    Without ffmpeg nothing can be merged, so only progressive formats — one file already
    carrying its audio — are asked for. That is the difference between a working download
    and 'ERROR: ffprobe and ffmpeg not found'."""
    if audio_only:
        return "ba/b"
    formats = [f for f in (info.get("formats") or []) if f.get("vcodec") not in (None, "none")]
    if merge:
        pool = formats
    else:
        pool = [f for f in formats if f.get("acodec") not in (None, "none")]
    best_audio = min((_size(f) for f in (info.get("formats") or [])
                      if f.get("acodec") not in (None, "none") and f.get("vcodec") in (None, "none")
                      and _size(f)), default=0)
    heights = [f.get("height") or 0 for f in pool]
    if not pool or not any(heights):
        return "b" if not merge else "bv*+ba/b"      # a plain file, or a source that lists no heights
    for h in LADDER:
        fits = [f for f in pool if (f.get("height") or 0) <= h]
        if not fits:
            continue
        known = [f for f in fits if _size(f)]
        if known:
            # a progressive file carries its own audio; a video-only one still needs the audio track
            smallest = min(_size(f) + (0 if f.get("acodec") not in (None, "none") else best_audio)
                           for f in known)
            if smallest > CAP:
                continue
        return ("bv*[height<=%d]+ba/b[height<=%d]" % (h, h)) if merge else "b[height<=%d]" % h
    return None


def fetch(url, audio_only=False):
    """-> dict(ok, path, kind, title, duration, width, height, size, capped) or dict(ok=False, err=<key>)"""
    info, err = probe(url)
    if err:
        return {"ok": False, "err": err}
    merge = has_ffmpeg()
    fmt = pick_format(info, audio_only, merge)
    if not fmt:
        return {"ok": False, "err": "too_big"}
    full = max((f.get("height") or 0) for f in (info.get("formats") or [{}])) or 0
    tmp = tempfile.mkdtemp(prefix="ckdl_")
    out = os.path.join(tmp, "m.%(ext)s")
    args = ["-f", fmt, "--max-filesize", str(CAP), "-o", out, url]
    if audio_only and merge:                     # mp3 needs ffmpeg; without it the native audio is sent
        args = ["-f", fmt, "-x", "--audio-format", "mp3", "--audio-quality", "5",
                "--max-filesize", str(CAP), "-o", out, url]
    elif not audio_only and merge:
        args[1:1] = ["--merge-output-format", "mp4"]
    try:
        p = _run(args)
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp, ignore_errors=True)
        return {"ok": False, "err": "slow"}
    files = [os.path.join(tmp, f) for f in os.listdir(tmp)] if os.path.isdir(tmp) else []
    files = [f for f in files if os.path.isfile(f) and os.path.getsize(f) > 0]
    if p.returncode != 0 or not files:
        shutil.rmtree(tmp, ignore_errors=True)
        low = (p.stderr or "").lower()
        if "file is larger" in low or "max-filesize" in low:
            return {"ok": False, "err": "too_big"}
        log.warning("fetch %s -> %s", url, (p.stderr or "")[-250:])
        return {"ok": False, "err": "failed"}
    path = max(files, key=os.path.getsize)
    size = os.path.getsize(path)
    if size > CAP:
        shutil.rmtree(tmp, ignore_errors=True)
        return {"ok": False, "err": "too_big"}
    got = 0
    if not audio_only:
        try:                                     # the height actually delivered, for the caption
            q = _run(["--no-download", "-f", fmt, "--print", "%(height)s", url], timeout=60)
            got = int((q.stdout or "0").strip().splitlines()[-1])
        except Exception:
            got = 0
    return {"ok": True, "path": path, "dir": tmp, "size": size,
            "kind": "audio" if audio_only else "video",
            "title": (info.get("title") or "")[:200],
            "uploader": (info.get("uploader") or info.get("channel") or "")[:80],
            "duration": int(info.get("duration") or 0),
            "width": info.get("width") or 0, "height": got or info.get("height") or 0,
            "capped": bool(full and got and got < full)}


def human(n):
    return "%.1f MB" % (n / 1024 / 1024) if n >= 1024 * 1024 else "%d KB" % (n / 1024)


def caption(res, lang, site):
    bits = []
    if res.get("title"):
        bits.append("<b>%s</b>" % res["title"].replace("<", "&lt;").replace(">", "&gt;"))
    meta = [site]
    if res.get("height"):
        meta.append("%dp" % res["height"])
    if res.get("duration"):
        meta.append("%d:%02d" % (res["duration"] // 60, res["duration"] % 60))
    meta.append(human(res["size"]))
    bits.append("<i>" + " · ".join(meta) + "</i>")
    if res.get("capped"):
        bits.append("ℹ️ " + L("cap_note", lang))
    return "\n".join(bits)


def site_of(url):
    m = re.search(r"https?://(?:www\.|m\.|mobile\.)?([^/]+)", url or "")
    return m.group(1) if m else "link"


def cleanup(res):
    if res and res.get("dir"):
        shutil.rmtree(res["dir"], ignore_errors=True)
