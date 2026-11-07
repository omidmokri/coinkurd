# -*- coding: utf-8 -*-
"""Animated shorts and original songs for /kids/.

Nothing here is a media file. An episode is a list of scenes — a set, a camera move,
who is on stage and what they say — and a song is a list of notes. The browser draws
the one and plays the other, which is why both work in all three languages, read out
as a storyboard for anyone who cannot watch, and borrow no music from anybody.

Note data is written in a small notation: "c5:4 e5:4 r:2" is a C, an E and a rest, the
numbers being sixteenths. Drums are 16-character patterns, one character per sixteenth.
"""

CAST_NAMES = {"roj": "رۆژ", "aso": "ئاسۆ", "zip": "زیپ", "fel": "فێڵباز"}

STEPS = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}


def m(name):
    """c4 -> 60, f#3 -> 54"""
    n = STEPS[name[0]]
    i = 1
    if name[i] in "#b":
        n += 1 if name[i] == "#" else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + n


def seq(spec, at=0, vel=1.0):
    """'c5:4 e5:2 r:2' -> [[step, midi, len, vel], ...]"""
    out = []
    for tok in spec.split():
        nm, _, d = tok.partition(":")
        d = int(d or 4)
        if nm != "r":
            out.append([at, m(nm), d, vel])
        at += d
    return out


def drum(pattern, voice, vel=1.0, bars=1):
    """'k..h s..h k..h s..h' with k/s/h for kick, snare and hat"""
    p = pattern.replace(" ", "")
    hit = {"kick": "k", "snare": "s", "hat": "h"}[voice]
    return [[b * 16 + i, 36, 1, vel] for b in range(bars) for i, ch in enumerate(p) if ch == hit]


def song(bpm, bars, tracks, loop=True):
    return {"bpm": bpm, "bars": bars, "loop": loop, "tracks": tracks}


def tr(v, notes, g=1.0):
    return {"v": v, "n": notes, "g": g}


# ------------------------------------------------------------------ the themes
BEAT4 = "k..hs..hk..hs..h"

THEMES = {
 # bright, curious, the front door of the academy
 "academy": song(104, 4, [
   tr("lead", seq("g4:2 c5:2 e5:2 g5:4 e5:2 d5:4", 0)
             + seq("f4:2 a4:2 c5:2 e5:4 c5:2 b4:4", 16)
             + seq("e4:2 g4:2 b4:2 d5:4 b4:2 a4:4", 32)
             + seq("f4:2 a4:2 c5:4 g4:4 c5:4", 48), .9),
   tr("bass", seq("c3:8 c3:8", 0) + seq("f2:8 f2:8", 16) + seq("e2:8 e2:8", 32) + seq("f2:8 g2:8", 48), .85),
   tr("pad", seq("c4:16", 0) + seq("f3:16", 16) + seq("e3:16", 32) + seq("g3:16", 48), .5),
   tr("kick", drum(BEAT4, "kick", 1, 4)), tr("snare", drum(BEAT4, "snare", .8, 4)),
   tr("hat", drum(BEAT4, "hat", .55, 4)),
 ]),
 # a market: playful, skipping
 "money": song(112, 4, [
   tr("pluck", seq("f4:2 a4:2 c5:2 a4:2 f4:2 a4:2 c5:4", 0)
              + seq("g4:2 b4:2 d5:2 b4:2 g4:2 b4:2 d5:4", 16)
              + seq("a4:2 c5:2 e5:2 c5:2 a4:2 c5:2 e5:4", 32)
              + seq("f4:2 c5:2 a4:2 f4:2 c4:8", 48), .9),
   tr("bass", seq("f2:8 c3:8", 0) + seq("g2:8 d3:8", 16) + seq("a2:8 e3:8", 32) + seq("f2:16", 48), .9),
   tr("kick", drum("k..hk..hs..hk.sh", "kick", 1, 4)),
   tr("snare", drum("k..hk..hs..hk.sh", "snare", .75, 4)),
   tr("hat", drum("k..hk..hs..hk.sh", "hat", .5, 4)),
 ]),
 # the chain: wide, a little mysterious
 "chain": song(96, 4, [
   tr("bell", seq("a4:4 c5:4 e5:4 d5:4", 0) + seq("g4:4 b4:4 d5:4 c5:4", 16)
             + seq("f4:4 a4:4 c5:4 b4:4", 32) + seq("e4:4 g4:4 b4:8", 48), .8),
   tr("pad", seq("a3:16", 0) + seq("g3:16", 16) + seq("f3:16", 32) + seq("e3:16", 48), .6),
   tr("bass", seq("a2:16", 0) + seq("g2:16", 16) + seq("f2:16", 32) + seq("e2:16", 48), .8),
   tr("hat", drum("h.h.h.h.h.h.h.h.", "hat", .35, 4)),
 ]),
 # the guardian: tense, then it resolves
 "safe": song(100, 4, [
   tr("lead", seq("d5:2 d5:2 f5:4 e5:2 d5:2 c5:4", 0)
             + seq("a4:2 a4:2 c5:4 d5:2 c5:2 a4:4", 16)
             + seq("b4:2 b4:2 d5:4 c5:2 b4:2 a4:4", 32)
             + seq("d5:4 f5:4 a5:8", 48), .85),
   tr("bass", seq("d2:8 d2:8", 0) + seq("a2:8 a2:8", 16) + seq("b2:8 b2:8", 32) + seq("d2:16", 48), .9),
   tr("kick", drum("k...k...s...k.k.", "kick", 1, 4)),
   tr("snare", drum("k...k...s...k.k.", "snare", .8, 4)),
   tr("hat", drum("h.h.h.h.h.h.hhh.", "hat", .4, 4)),
 ]),
 # the chart: climbing, steady
 "chart": song(118, 4, [
   tr("pluck", seq("g4:2 b4:2 d5:2 g5:2 d5:2 b4:2 d5:4", 0)
              + seq("c5:2 e5:2 g5:2 e5:2 c5:2 e5:2 g5:4", 16)
              + seq("d5:2 f#5:2 a5:2 f#5:2 d5:2 a4:2 d5:4", 32)
              + seq("g4:2 d5:2 b4:2 g4:2 g4:8", 48), .85),
   tr("bass", seq("g2:8 g2:8", 0) + seq("c3:8 c3:8", 16) + seq("d3:8 d3:8", 32) + seq("g2:16", 48), .9),
   tr("kick", drum("k..hk.khs..hk..h", "kick", 1, 4)),
   tr("snare", drum("k..hk.khs..hk..h", "snare", .7, 4)),
   tr("hat", drum("k..hk.khs..hk..h", "hat", .45, 4)),
 ]),
 # the end of an episode
 "fanfare": song(120, 2, [
   tr("bell", seq("c5:2 e5:2 g5:2 c6:6 g5:2 c6:8", 0), 1),
   tr("bass", seq("c3:8 g2:8", 0) + seq("c3:16", 16), .9),
   tr("snare", drum("s.s.s.s.k.......", "snare", .7, 1)),
 ], loop=False),
}


# ------------------------------------------------------------------ the songs
# the chorus repeats, so the lyric lines carry the bar they start on
SONGS = [
 {
  "id": "twelve", "world": "safe", "age": "both", "icon": "🛡️",
  "t": ("ترانهٔ دوازده کلمه", "گۆرانیی دوازدە وشە", "The Twelve Words Song"),
  "goal": ("به‌یادسپردن اینکه عبارت بازیابی به هیچ‌کس گفته نمی‌شود — حتی به «پشتیبانی».",
           "لەبیرکردنی ئەوەی ڕستەی گەڕاندنەوە بە هیچ کەس ناوترێت — تەنانەت بە «پشتیوانی».",
           "Remembering that the recovery phrase goes to nobody — not even to “support”."),
  "style": ("پاپ کودکانه، ۱۰۰ ضرب در دقیقه، شاد اما قاطع", "پۆپی منداڵانە، ١٠٠ لێدان لە خولەکێکدا، خۆش بەڵام بڕیاردەر",
            "Children's pop, 100 BPM, cheerful but firm"),
  "inst": ("سینث لید، باس نرم، درام ساده، زنگ", "سینسی لید، باسی نەرم، درامی سادە، زەنگ",
           "Lead synth, soft bass, simple drums, bells"),
  "cast": ["roj", "zip"],
  "music": "twelve",
  "lines": [
   # bar, is-chorus, (fa, ckb, en)
   (0, 0, ("یکی پیام داد: جایزه بردی!", "کەسێک نامەی نارد: خەڵاتت برد!", "Someone wrote: you’ve won a prize!")),
   (2, 0, ("گفتم صبر کن، عجله نکن", "وتم ڕاوەستە، پەلە مەکە", "I said: hold on, what’s the rush?")),
   (4, 0, ("هر کی بگه زود، زود، زود", "هەر کەس بڵێت زوو، زوو، زوو", "Anyone shouting quick, quick, quick —")),
   (6, 0, ("همون‌جا بوی تله میاد", "هەر لەوێ بۆنی تەڵە دێت", "that’s the smell of a trap.")),
   (8, 1, ("دوازده کلمه، مالِ منه", "دوازدە وشە، هی منە", "Twelve little words, they’re only mine,")),
   (10, 1, ("روی کاغذ، نه توی گوشی", "لەسەر کاغەز، نەک لە مۆبایل", "on paper, never on a phone.")),
   (12, 1, ("به هیچ‌کس، به هیچ‌کس نمی‌گم", "بە هیچ کەس، بە هیچ کەس ناڵێم", "I’ll never tell, I’ll never tell —")),
   (14, 1, ("نه به دوست، نه به پشتیبانی", "نە بە هاوڕێ، نە بە پشتیوانی", "not to a friend, not to “support”.")),
  ],
 },
 {
  "id": "scarce", "world": "money", "age": "kid", "icon": "🪙",
  "t": ("ترانهٔ کم‌یاب و فراوان", "گۆرانیی کەم و زۆر", "The Scarce and Plentiful Song"),
  "goal": ("فهمیدن اینکه قیمت از «چقدر هست» و «چند نفر می‌خواهند» ساخته می‌شود.",
           "تێگەیشتن لەوەی نرخ لە «چەندە هەیە» و «چەند کەس دەیەوێت» دروست دەبێت.",
           "Understanding that price is made of “how much there is” and “how many want it”."),
  "style": ("ریتم شاد و ساده، ۱۱۲ ضرب در دقیقه", "ڕیتمی خۆش و سادە، ١١٢ لێدان لە خولەکێکدا", "Bright and simple, 112 BPM"),
  "inst": ("پلاک، باس، درام سبک", "پلاک، باس، درامی سووک", "Pluck, bass, light drums"),
  "cast": ["roj", "zip"],
  "music": "scarce",
  "lines": [
   (0, 0, ("شن زیاده، شن ارزونه", "لم زۆرە، لم هەرزانە", "Sand is plenty, sand is cheap,")),
   (2, 0, ("الماس کمه، الماس گرونه", "ئەڵماس کەمە، ئەڵماس گرانە", "diamonds are few, diamonds are dear.")),
   (4, 1, ("کم‌یاب و خواستنی، گرون می‌شه", "کەم و خواستراو، گران دەبێت", "Scarce and wanted goes up high,")),
   (6, 1, ("فراوون و بی‌خواهان، ارزون می‌شه", "زۆر و بێ‌داواکار، هەرزان دەبێت", "plenty and unwanted comes right down.")),
  ],
 },
]

# the two songs, as notes
THEMES["twelve"] = song(100, 4, [
  tr("lead", seq("d5:2 e5:2 f5:2 e5:2 d5:4 a4:4", 0)
            + seq("d5:2 e5:2 f5:2 g5:2 f5:4 e5:4", 16)
            + seq("a5:4 g5:2 f5:2 e5:4 d5:4", 32)
            + seq("f5:2 e5:2 d5:4 a4:4 d5:4", 48), .95),
  tr("bass", seq("d2:8 a2:8", 0) + seq("b2:8 f2:8", 16) + seq("g2:8 a2:8", 32) + seq("d2:16", 48), .9),
  tr("pad", seq("d4:16", 0) + seq("f4:16", 16) + seq("g4:16", 32) + seq("a4:16", 48), .4),
  tr("kick", drum("k..hs..hk..hs.kh", "kick", 1, 4)),
  tr("snare", drum("k..hs..hk..hs.kh", "snare", .8, 4)),
  tr("hat", drum("k..hs..hk..hs.kh", "hat", .45, 4)),
])
THEMES["scarce"] = song(112, 2, [
  tr("pluck", seq("c5:2 c5:2 g4:2 c5:2 e5:4 c5:4", 0)
             + seq("f4:2 f4:2 a4:2 c5:2 g4:8", 16), .95),
  tr("bass", seq("c3:8 g2:8", 0) + seq("f2:8 g2:8", 16), .9),
  tr("kick", drum("k..hk..hs..hk..h", "kick", 1, 2)),
  tr("snare", drum("k..hk..hs..hk..h", "snare", .75, 2)),
  tr("hat", drum("k..hk..hs..hk..h", "hat", .45, 2)),
])


# ------------------------------------------------------------------ the episodes
def L(who, fa, ckb, en, side="l", sfx=None):
    d = {"who": who, "t": (fa, ckb, en), "side": side}
    if sfx:
        d["sfx"] = sfx
    return d


def S(bg, cast, lines, cam=None):
    return {"bg": bg, "cast": cast, "lines": lines, "cam": cam or [1, 0, 0]}


ROJ_L = {"who": "roj", "at": [95, 292], "s": 1.9, "act": "idle"}
ROJ_R = {"who": "roj", "at": [655, 292], "s": 1.9, "act": "idle"}
ZIP_R = {"who": "zip", "at": [690, 312], "s": 1.7, "act": "idle"}
ZIP_L = {"who": "zip", "at": [120, 312], "s": 1.7, "act": "idle"}
ZIP_M = {"who": "zip", "at": [390, 312], "s": 1.7, "act": "idle"}   # clear of the glowing phone
ASO_L = {"who": "aso", "at": [85, 282], "s": 2.0, "act": "idle"}
FEL_R = {"who": "fel", "at": [645, 282], "s": 2.0, "act": "idle"}


def act(c, a):
    d = dict(c)
    d["act"] = a
    return d


EPISODES = [
 {
  "id": "ep-money", "world": "money", "icon": "🪙", "music": "money", "age": "both",
  "t": ("بازارِ سیبِ طلایی", "بازاڕی سێوی زێڕین", "The Golden Apple Market"),
  "logline": ("رۆژ و زیپ به بازار می‌روند و می‌فهمند چرا یک سیب از هزار سیب گران‌تر است.",
              "ڕۆژ و زیپ دەچنە بازاڕ و تێدەگەن بۆچی سێوێک لە هەزار سێو گرانترە.",
              "Roj and Zip go to the market and work out why one apple costs more than a thousand."),
  "scenes": [
   S("market", [act(ROJ_L, "wave"), ZIP_R], [
     L("roj", "خوش اومدی به بازار، زیپ! امروز می‌فهمیم قیمت از کجا میاد.",
             "بەخێربێیت بۆ بازاڕ، زیپ! ئەمڕۆ دەزانین نرخ لە کوێوە دێت.",
             "Welcome to the market, Zip! Today we find out where a price comes from.", "l", "pop"),
     L("zip", "رۆژ! چرا این یک سیب طلایی اینقدر گرونه؟",
             "ڕۆژ! بۆچی ئەم یەک سێوە زێڕینە ئەوەندە گرانە؟",
             "Roj! Why is this one golden apple so expensive?", "r", "tap")]),
   S("market", [act(ROJ_L, "point"), ZIP_R], [
     L("roj", "بشمار. تو کلِ بازار فقط سه تا سیب طلایی هست.",
             "بیژمێرە. لە هەموو بازاڕدا تەنها سێ سێوی زێڕین هەیە.",
             "Count them. In the whole market there are only three golden apples.", "l", "step"),
     L("zip", "یک… دو… سه! فقط سه تا؟",
             "یەک… دوو… سێ! تەنها سێ دانە؟", "One… two… three! Only three?", "r", "pop")],
     [1.25, -40, -10]),
   S("market", [ROJ_L, act(ZIP_R, "shock")], [
     L("roj", "و همه‌شون رو می‌خوان. کم‌یاب به‌علاوهٔ خواستنی می‌شه گران.",
             "و هەموویان دەیانەوێت. کەم لەگەڵ خواستراو دەبێتە گران.",
             "And everyone wants one. Scarce plus wanted makes expensive.", "l"),
     L("zip", "پس اگه کسی نخوادش چی؟", "کەواتە ئەگەر کەس نەیەوێت چی؟",
             "So what if nobody wants it?", "r")]),
   S("market", [act(ROJ_L, "point"), ZIP_R], [
     L("roj", "اون‌وقت ارزون می‌شه. ببین، یک گاری پر سیبِ معمولی رسید.",
             "ئەو کاتە هەرزان دەبێت. سەیرکە، عەرەبانەیەکی پڕ سێوی ئاسایی گەیشت.",
             "Then it gets cheap. Look — a whole cart of ordinary apples just arrived.", "l", "whoosh"),
     L("zip", "اوه! حالا سیب معمولی همه‌جا هست و قیمتش افتاد.",
             "ئۆو! ئێستا سێوی ئاسایی لە هەموو شوێنێکە و نرخی کەوت.",
             "Oh! Now ordinary apples are everywhere and the price fell.", "r")]),
   S("market", [ROJ_L, ZIP_R], [
     L("roj", "قیمت جاییه که خریدار و فروشنده دست می‌دن. نه بالاتر، نه پایین‌تر.",
             "نرخ ئەو شوێنەیە کە کڕیار و فرۆشیار دەست دەدەن. نە بەرزتر، نە نزمتر.",
             "A price is where a buyer and a seller shake hands. No higher, no lower.", "l")],
     [1.1, 0, -10]),
   S("market", [ROJ_L, act(ZIP_R, "wave")], [
     L("zip", "فهمیدم! پس ارزش بازار یعنی قیمتِ یکی ضربدر تعدادِ همه.",
             "تێگەیشتم! کەواتە بەهای بازاڕ واتە نرخی یەکێک لە ژمارەی هەموویان.",
             "I’ve got it! Market cap is the price of one times how many there are.", "r", "good"),
     L("roj", "آفرین زیپ. حالا یک سؤال برای دفعهٔ بعد: دفتری که پاک نمی‌شه چیه؟",
             "دەست خۆش زیپ. ئێستا پرسیارێک بۆ جاری داهاتوو: ئەو دەفتەرەی ناسڕدرێتەوە چییە؟",
             "Well done, Zip. A question for next time: what is a ledger nobody can erase?", "l", "magic")]),
  ],
 },
 {
  "id": "ep-chain", "world": "chain", "icon": "⛓️", "music": "chain", "age": "both",
  "t": ("دفترِ هزار نسخه", "دەفتەری هەزار وێنە", "The Thousand-Copy Ledger"),
  "logline": ("ئاسۆ به زیپ نشان می‌دهد چرا نمی‌شود یک صفحه از بلاک‌چین را یواشکی عوض کرد.",
              "ئاسۆ بە زیپ نیشان دەدات بۆچی ناکرێت بە دزییەوە لاپەڕەیەکی بلۆکچەین بگۆڕدرێت.",
              "Aso shows Zip why you cannot quietly change one page of a blockchain."),
  "scenes": [
   S("chain", [act(ASO_L, "wave"), ZIP_R], [
     L("aso", "اینجا دفترِ بزرگه، زیپ. هزاران نفر عینِ همین دفتر رو دارن.",
             "لێرە دەفتەرە گەورەکەیە، زیپ. هەزاران کەس هەمان دەفتەریان هەیە.",
             "This is the big ledger, Zip. Thousands of people hold the very same one.", "l", "magic"),
     L("zip", "یعنی اگه من یک صفحه رو عوض کنم…", "واتە ئەگەر من لاپەڕەیەک بگۆڕم…",
             "So if I change one page…", "r")]),
   S("chain", [ASO_L, act(ZIP_R, "point")], [
     L("zip", "بذار امتحان کنم! این عدد رو عوض می‌کنم…",
             "با تاقی بکەمەوە! ئەم ژمارەیە دەگۆڕم…", "Let me try! I’ll change this number…", "r", "tap"),
     L("aso", "ببین چی شد — همهٔ بلاک‌های بعدی قرمز شدن.",
             "سەیرکە چی ڕوویدا — هەموو بلۆکەکانی دواتر سوور بوون.",
             "Look what happened — every later block turned red.", "l", "alarm")],
     [1.2, -30, 0]),
   S("chain", [act(ASO_L, "point"), ZIP_R], [
     L("aso", "هر بلاک با «اثر انگشتِ» بلاک قبلی قفل شده. اسمش هشه.",
             "هەر بلۆکێک بە «پەنجەمۆری» بلۆکی پێشووەوە قوفڵ کراوە. ناوی هاشە.",
             "Each block is locked by the previous block’s fingerprint. It’s called a hash.", "l"),
     L("zip", "یعنی اگه یک حرف عوض بشه، اثر انگشت هم عوض می‌شه؟",
             "واتە ئەگەر یەک پیت بگۆڕێت، پەنجەمۆریش دەگۆڕێت؟",
             "So if one letter changes, the fingerprint changes too?", "r")]),
   S("chain", [ASO_L, ZIP_R], [
     L("aso", "کاملاً عوض می‌شه. برای همین هیچ‌کس نمی‌تونه یواشکی چیزی رو دست بزنه.",
             "بە تەواوی دەگۆڕێت. لەبەر ئەوە کەس ناتوانێت بە دزییەوە دەست لە شتێک بدات.",
             "Completely. That is why nobody can touch anything quietly.", "l", "good")],
     [1.15, 20, -20]),
   S("chain", [act(ASO_L, "point"), ZIP_R], [
     L("aso", "و یک چیز دیگه: هر کیف پول دو کلید داره.",
             "و شتێکی دیکە: هەر جزدانێک دوو کلیلی هەیە.",
             "One more thing: every wallet has two keys.", "l"),
     L("zip", "یکی رو به همه می‌دم تا برام بفرستن…",
             "یەکێکیان دەدەمە هەموو کەس تا بۆم بنێرن…",
             "One I give to everyone so they can send to me…", "r"),
     L("aso", "و اون یکی رو هرگز به هیچ‌کس نمی‌دی. هرگز.",
             "و ئەوی دیکە هەرگیز بە هیچ کەس نادەیت. هەرگیز.",
             "And the other you never give to anyone. Never.", "l", "alarm")]),
   S("chain", [ASO_L, act(ZIP_R, "wave")], [
     L("zip", "پس مالک بودن یعنی دونستنِ اون کلید!",
             "کەواتە خاوەن بوون واتە زانینی ئەو کلیلە!",
             "So owning something means knowing that key!", "r", "good"),
     L("aso", "درسته. و دفعهٔ بعد یاد می‌گیریم چطور ازش محافظت کنیم.",
             "ڕاستە. و جاری داهاتوو فێر دەبین چۆن بیپارێزین.",
             "Exactly. And next time we learn how to protect it.", "l", "magic")]),
  ],
 },
 {
  "id": "ep-safe", "world": "safe", "icon": "🛡️", "music": "safe", "age": "both",
  "t": ("شبِ پیامِ ناشناس", "شەوی نامەی نەناسراو", "The Night of the Unknown Message"),
  "logline": ("یک پیام شبانه، یک جایزهٔ رایگان، و یک شخصیت که دوازده کلمه را می‌خواهد.",
              "نامەیەکی شەوانە، خەڵاتێکی بێبەرامبەر، و کەسێک کە دوازدە وشەکە دەوێت.",
              "A message at night, a free prize, and someone who wants the twelve words."),
  "scenes": [
   S("night", [act(ZIP_M, "idle")], [
     L("zip", "دیروقته… یه پیام اومد. «تبریک! تو برنده شدی.»",
             "درەنگە… نامەیەک هات. «پیرۆزە! تۆ بردت.»",
             "It’s late… a message arrived. “Congratulations! You’ve won.”", "l", "alarm")]),
   S("night", [ZIP_M, act(FEL_R, "wave")], [
     L("fel", "سلام دوست کوچولو! یک جایزهٔ بزرگ برات دارم. فقط این لینک رو بزن.",
             "سڵاو هاوڕێی بچووک! خەڵاتێکی گەورەم بۆت هەیە. تەنها لەم بەستەرە بدە.",
             "Hello little friend! I have a big prize for you. Just tap this link.", "r", "whoosh"),
     L("zip", "ولی… من که تو هیچ مسابقه‌ای شرکت نکردم.",
             "بەڵام… من لە هیچ پێشبڕکێیەکدا بەشدار نەبووم.",
             "But… I never entered any competition.", "l")]),
   S("night", [act(ZIP_M, "shock"), FEL_R], [
     L("roj", "زیپ، صبر کن! من اومدم.", "زیپ، ڕاوەستە! من هاتم.", "Zip, wait! I’m here.", "l", "good")],
     [1.1, 0, 0]),
   S("night", [ZIP_M, act(FEL_R, "point")], [
     L("fel", "فقط دوازده کلمه‌ات رو بفرست تا جایزه رو واریز کنم. من از پشتیبانی‌ام.",
             "تەنها دوازدە وشەکەت بنێرە تا خەڵاتەکە بنێرم. من لە پشتیوانییەوەم.",
             "Just send me your twelve words and I’ll transfer the prize. I’m from support.", "r", "alarm"),
     L("roj", "هیچ پشتیبانیِ واقعی هیچ‌وقت دوازده کلمه رو نمی‌پرسه. هیچ‌وقت.",
             "هیچ پشتیوانییەکی ڕاستەقینە هەرگیز دوازدە وشەکە داوا ناکات. هەرگیز.",
             "No real support team ever asks for the twelve words. Not ever.", "l")]),
   S("night", [ZIP_M, act(FEL_R, "shock")], [
     L("fel", "فقط پنج دقیقه وقت داری! زود باش، زود!",
             "تەنها پێنج خولەکت هەیە! خێرا بکە، خێرا!",
             "You have only five minutes! Hurry, hurry!", "r", "alarm"),
     L("roj", "و همین عجله، خودش نشانهٔ سومه. سود قطعی، عجله، و درخواست کلید.",
             "و هەر ئەم پەلەکردنە، خۆی نیشانەی سێیەمە. قازانجی دڵنیا، پەلە، و داواکردنی کلیل.",
             "And the rush is the third sign. Guaranteed profit, urgency, and “send your key”.", "l")]),
   S("night", [act(ZIP_M, "wave"), act(FEL_R, "walk")], [
     L("zip", "پس جواب من اینه: نه. و می‌رم به یک بزرگ‌تر می‌گم.",
             "کەواتە وەڵامی من ئەمەیە: نەخێر. و دەچم بە گەورەیەک دەڵێم.",
             "Then my answer is: no. And I’m telling a grown-up.", "l", "good"),
     L("roj", "عالی بود. دوازده کلمه فقط روی کاغذ، و فقط مالِ خودت.",
             "نایاب بوو. دوازدە وشە تەنها لەسەر کاغەز، و تەنها هی خۆت.",
             "Perfect. Twelve words, on paper only, and yours alone.", "l", "magic")]),
  ],
 },
 {
  "id": "ep-chart", "world": "chart", "icon": "📈", "music": "chart", "age": "both",
  "t": ("کوهستانِ کندل‌ها", "چیای کەندیلەکان", "The Mountains of Candles"),
  "logline": ("هر کوه یک کندل است، و رد پاها روی آن‌ها اسمش روند است.",
              "هەر چیایەک کەندیلێکە، و شوێن پێیەکان لەسەریان ناوی ڕەوتە.",
              "Every mountain is a candle, and the footprints across them are called a trend."),
  "scenes": [
   S("peaks", [act(ASO_L, "point"), ZIP_R], [
     L("aso", "هر کدوم از این کوه‌ها یک کندله: داستانِ یک ساعت یا یک روز.",
             "هەریەکە لەم چیایانە کەندیلێکە: چیرۆکی کاتژمێرێک یان ڕۆژێک.",
             "Each of these mountains is a candle: the story of one hour or one day.", "l", "magic"),
     L("zip", "چرا بعضی‌هاشون سبزن و بعضی‌هاشون قرمز؟",
             "بۆچی هەندێکیان سەوزن و هەندێکیان سوورن؟",
             "Why are some green and some red?", "r")]),
   S("peaks", [ASO_L, ZIP_R], [
     L("aso", "سبز یعنی آخرش بالاتر از اولش بسته شد. قرمز یعنی پایین‌تر.",
             "سەوز واتە لە کۆتاییدا لە سەرەتای بەرزتر داخرا. سوور واتە نزمتر.",
             "Green means it closed above where it opened. Red means below.", "l"),
     L("zip", "و اون خط‌های نازک بالا و پایین؟", "و ئەو هێڵە باریکانەی سەرەوە و خوارەوە؟",
             "And those thin lines above and below?", "r")],
     [1.3, -20, 10]),
   S("peaks", [act(ASO_L, "point"), ZIP_R], [
     L("aso", "سایه‌ها. یعنی قیمت تا اونجا رفت، ولی نتونست اونجا بمونه.",
             "سێبەرەکان. واتە نرخ تا ئەوێ چوو، بەڵام نەیتوانی لەوێ بمێنێتەوە.",
             "The wicks. Price went that far, but could not stay there.", "l"),
     L("zip", "پس هر کندل می‌گه کی برنده شد!", "کەواتە هەر کەندیلێک دەڵێت کێ بردی!",
             "So every candle says who won!", "r", "good")]),
   S("peaks", [ASO_L, act(ZIP_R, "point")], [
     L("aso", "حالا به قله‌ها نگاه کن. هر قله از قبلی بلندتره؟",
             "ئێستا سەیری لووتکەکان بکە. هەر لووتکەیەک لە پێشوو بەرزترە؟",
             "Now look at the peaks. Is each one higher than the last?", "l"),
     L("zip", "آره! و دره‌ها هم بالاتر میان.", "بەڵێ! و دۆڵەکانیش بەرزتر دێن.",
             "Yes! And the dips are rising too.", "r"),
     L("aso", "اسمش روند صعودیه. برعکسش می‌شه نزولی.",
             "ناوی ڕەوتی سەرکەوتووە. پێچەوانەکەی دەبێتە داکەوتوو.",
             "That is an uptrend. The other way round is a downtrend.", "l", "good")]),
   S("peaks", [act(ASO_L, "point"), ZIP_R], [
     L("aso", "و این خطِ صاف؟ قیمت چند بار بهش خورد و برگشت. سقفه — مقاومت.",
             "و ئەم هێڵە ڕاستە؟ نرخ چەند جار لێی دا و گەڕایەوە. سەقفە — بەربەست.",
             "And this flat line? Price hit it again and again and turned back. A ceiling: resistance.", "l"),
     L("zip", "و اگه بشکنه؟", "و ئەگەر بشکێت؟", "And if it breaks?", "r")],
     [1.2, 30, -20]),
   S("peaks", [ASO_L, act(ZIP_R, "wave")], [
     L("aso", "اون‌وقت همون سقف، اغلب می‌شه کفِ بعدی. نقش‌ها عوض می‌شن.",
             "ئەو کاتە هەمان سەقف، زۆرجار دەبێتە بنی دواتر. ڕۆڵەکان دەگۆڕێن.",
             "Then that ceiling often becomes the next floor. The roles swap.", "l", "magic"),
     L("zip", "کوهستان رو یاد گرفتم! حالا بریم بازی کنیم.",
             "چیاکەم فێربوو! ئێستا با بچین یاری بکەین.",
             "I’ve learned the mountains! Now let’s go and play.", "r", "good")]),
  ],
 },
]
