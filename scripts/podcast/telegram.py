"""The day's Telegram post: ONE album in @Coin_Kurd with the four audio versions together.

Each audio carries its own caption in its own language, opening with the language's tag (🟢 فارسی, ☀️ کوردی,
🔵 English, 🟠 العربية) — and the audio's player title starts with the same tag — so a listener sees at once which
file is which. The last caption ends with the warning line, four hashtags and the channel's usual signature.

build()   -> the album plan (captions, titles, files), checked against Telegram's limits; written to telegram.json
publish() -> sendMediaGroup through the channel's own bot (GitHub Actions only). Refuses a language whose QC failed,
             refuses to post an episode twice, and verifies the answer (one message per audio).
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labels as LB  # noqa: E402

SIG = ('<a href="https://t.me/+QdxOfpXU3tdhOTA0">🅲🅾️🅸🅽 🅺🆄🆁🅳 </a>👾<a href="https://discord.gg/BewcJHRBZ">Discord</a> '
       '🎥<a href="https://www.youtube.com/channel/UCUzxNwejhNtSGaOZaI2ku5w">Youtube</a> '
       '📸<a href="https://www.instagram.com/coin_kurd">Instagram</a> 💬<a href="https://twitter.com/omid_mokri">X</a>')
TAGS = "#نبض_کریپتو #پادکست #بیت_کوین #کوین_کورد"
CHANNEL = os.environ.get("PODCAST_CHAT", "@Coin_Kurd")

L = {
    "fa": dict(inside="📌 در این قسمت:", page="🔗 متن کامل، فصل‌ها و منابع:", warn="⚠️ تحلیل و اطلاع‌رسانی است، نه توصیهٔ مالی.",
               length="⏱ {m} دقیقه"),
    "ckb": dict(inside="📌 لەم ئەڵقەیەدا:", page="🔗 دەقی تەواو، بەشەکان و سەرچاوەکان:", warn="⚠️ شیکاری و زانیارییە، نەک ئامۆژگاریی دارایی.",
                length="⏱ {m} خولەک"),
    "en": dict(inside="📌 In this episode:", page="🔗 Transcript, chapters and sources:", warn="⚠️ Analysis and information, not financial advice.",
               length="⏱ {m} min"),
    "ar": dict(inside="📌 في هذه الحلقة:", page="🔗 النص الكامل والفصول والمصادر:", warn="⚠️ تحليل ومعلومات، وليس نصيحة مالية.",
               length="⏱ {m} دقيقة"),
}
LIMIT = 1024


def visible(h):
    return len(html.unescape(re.sub(r"<[^>]+>", "", h)))


def e(s):
    return html.escape(str(s), quote=False)


def caption(sc, lang, url, minutes, last=False, n_points=4):
    t = L[lang]
    d = sc.get("display", sc)
    tail = ""
    if last:
        tail = f"\n\n{t['warn']}\n{TAGS}\n{SIG}"
    for n in range(n_points, 1, -1):
        pts = "\n".join(f"• {e(p)}" for p in d["key_points"][:n])
        h = (f"{LB.TAG[lang]} | 🎙 <b>{e(sc['show'])}</b> · {e(sc['episode_label'])}\n"
             f"📅 {e(sc['date_label'])} · {t['length'].format(m=LB.digits(minutes, lang))}\n\n"
             f"<b>{e(d['title'])}</b>\n\n{t['inside']}\n{pts}\n\n{t['page']} {url}{tail}")
        if visible(h) <= LIMIT:
            return h
    raise ValueError(f"{lang}: caption over {LIMIT} characters even with two points")


def build(ep, langs, base_url="https://entekhab.net"):
    langs = [l for l in LB.LANGS if l in langs]
    items = []
    for i, lang in enumerate(langs):
        sc = json.load(open(os.path.join(ep, f"script_{lang}.json"), encoding="utf-8"))
        mx = json.load(open(os.path.join(ep, f"mix_{lang}.json"), encoding="utf-8"))
        url = f"{base_url}/podcast/{sc['date']}/#{lang}"
        cap = caption(sc, lang, url, round(mx["duration"] / 60), last=(i == len(langs) - 1))
        items.append({"lang": lang, "caption": cap, "chars": visible(cap), "file": f"podcast_{lang}.mp3", "thumb": f"thumb_{lang}.jpg",
                      "title": f"{LB.TAG[lang]} · {sc['show']} · {sc['date']}", "performer": "Coin Kurd · entekhab.net",
                      "duration": int(round(mx["duration"]))})
    plan = {"chat": CHANNEL, "method": "sendMediaGroup", "items": items}
    json.dump(plan, open(os.path.join(ep, "telegram.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return plan


def check_bot(token, chat=CHANNEL):
    """Read-only: the token works and the bot may post audio in the channel."""
    import requests
    api = f"https://api.telegram.org/bot{token}"
    me = requests.get(f"{api}/getMe", timeout=30).json()
    if not me.get("ok"):
        return False, f"getMe: {me.get('description')}"
    ch = requests.get(f"{api}/getChat", params={"chat_id": chat}, timeout=30).json()
    if not ch.get("ok"):
        return False, f"getChat: {ch.get('description')}"
    mem = requests.get(f"{api}/getChatMember", params={"chat_id": ch["result"]["id"], "user_id": me["result"]["id"]}, timeout=30).json()
    r = mem.get("result") or {}
    can = r.get("status") == "creator" or (r.get("status") == "administrator" and r.get("can_post_messages", True))
    return bool(can), f"bot @{me['result'].get('username')} is {r.get('status')} in {ch['result'].get('title')}"


def publish(ep, token, plan, qc_ok, already=None):
    """Post the album once. Returns the message ids. `already` is the ledger entry if one exists."""
    import requests
    if already:
        raise RuntimeError(f"already posted: {already}")
    items = [it for it in plan["items"] if qc_ok.get(it["lang"])]
    if not items:
        raise RuntimeError("no language passed QC")
    if len(items) == 1:
        raise RuntimeError("one language only: album needs two or more items")  # handled by caller with sendAudio
    files, media = {}, []
    for i, it in enumerate(items):
        files[f"a{i}"] = (it["file"], open(os.path.join(ep, it["file"]), "rb"), "audio/mpeg")
        files[f"t{i}"] = (it["thumb"], open(os.path.join(ep, it["thumb"]), "rb"), "image/jpeg")
        media.append({"type": "audio", "media": f"attach://a{i}", "thumbnail": f"attach://t{i}", "caption": it["caption"],
                      "parse_mode": "HTML", "title": it["title"], "performer": it["performer"], "duration": it["duration"]})
    r = requests.post(f"https://api.telegram.org/bot{token}/sendMediaGroup",
                      data={"chat_id": plan["chat"], "media": json.dumps(media, ensure_ascii=False)}, files=files, timeout=600)
    j = r.json()
    if not j.get("ok") or len(j.get("result", [])) != len(items):
        raise RuntimeError(f"Telegram refused the album: {j.get('error_code')} {j.get('description')}")
    return [m["message_id"] for m in j["result"]]


def publish_single(ep, token, plan, item):
    import requests
    with open(os.path.join(ep, item["file"]), "rb") as a, open(os.path.join(ep, item["thumb"]), "rb") as t:
        r = requests.post(f"https://api.telegram.org/bot{token}/sendAudio",
                          data={"chat_id": plan["chat"], "caption": item["caption"], "parse_mode": "HTML", "title": item["title"],
                                "performer": item["performer"], "duration": item["duration"]},
                          files={"audio": (item["file"], a, "audio/mpeg"), "thumbnail": (item["thumb"], t, "image/jpeg")}, timeout=600)
    j = r.json()
    if not j.get("ok"):
        raise RuntimeError(f"Telegram refused the audio: {j.get('error_code')} {j.get('description')}")
    return [j["result"]["message_id"]]
