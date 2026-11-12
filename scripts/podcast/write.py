"""Write the day's four scripts with Gemini, then gate them before any audio is made.

Order: the Persian master is written from facts.json + inputs.json (headlines and the channel's posts); Sorani,
English and Arabic are then written natively FROM the master, so all four carry the same figures.

Gates (a script that fails is rewritten once with the failure spelled out; a language that still fails is held):
  shape     ten sections in the fixed order, each with text; 4-7 key points; title, summary, SEO fields
  facts     every figure in the Persian master traces to facts.json / inputs.json (exact or as rounded), or is a
            date or a generic number of the craft (24 hours, RSI 30/70, ...); sentences that still carry an
            untraceable figure after the rewrite are removed, and the episode is held if that would gut it
  same      every section of every version carries the same figures as the master (qc.compare_sections)
  times     every clock time is the snapshot, an event or the release time, in UTC or the listener's zone
  speakable no Latin letters left in the spoken text of fa / ckb / ar (acronyms go in ⟦shown|spoken⟧ markup;
            short capitals are spelled out by rule as a last resort)
"""
import datetime as dt
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
import labels as LB  # noqa: E402
import qc  # noqa: E402

BR = re.compile(r"⟦([^|⟧]*)\|([^⟧]*)⟧")
TEHRAN = dt.timezone(dt.timedelta(hours=3, minutes=30))

LANG_RULES = {
    "fa": """Persian (Farsi), for Iranian traders. Digits are Persian (۰-۹), thousands separator «٬», decimal «٫»;
percent is written as the word «درصد» after the number. Mark the Persian ezafe with a kasre (ِ) exactly as the style
example does (e.g. «زمانِ تهیه‌یِ این گزارش») — it is stripped from the displayed text and only guides the voice.""",
    "ckb": """Central Kurdish (Sorani), Arabic script, for Kurdish traders. Write natural Sorani as a Kurdish
broadcaster would — not Persian with Kurdish spelling. Digits are Eastern Arabic (٠-٩), thousands «٬», decimal «٫»;
percent is «لەسەدا» BEFORE the number. Use Kurdish month names as in the style example. Never leave a Latin letter in
the spoken text: every acronym or Latin name goes in ⟦shown|spoken⟧ markup, spoken side in Sorani letters.""",
    "en": """English, for an international audience of crypto traders. Digits are ASCII with comma thousands
separators; write "percent" as a word. Clock times are given in UTC, with Tehran time where the master gives it.""",
    "ar": """Modern Standard Arabic, for Arab traders. FULLY vowelled text (tashkeel on every word, as the style
example does) — it is stripped from the displayed text and only guides the voice. Digits are ASCII with comma
thousands separators; percent is «بِالْمِئَةِ». Clock times are given in Mecca time (UTC+3) and UTC.""",
}

COMMON = """You write one daily episode of the crypto-market podcast «{show}», published on entekhab.net and the Telegram
channel Coin_Kurd. A professional voice synthesiser reads your text aloud, so write for the ear: clear sentences,
one idea per sentence, no lists, no bullet characters, no emojis, no URLs, no markdown.

ABSOLUTE RULES
1. Use ONLY the numbers in FACTS and INPUTS (exact, or rounded in the obvious way: 73,071 may become "about 73 thousand").
   Never invent a price, level, percentage, date, count or quote. If a fact is missing, leave the point out.
2. News: report only items from INPUTS. Name the outlet(s) that reported each. Prefer items several outlets report,
   and the channel's own posts. Never present an old item as new. Never write anything you cannot attribute.
3. Every figure is written with digits (never spelled in words), so it can be checked automatically.
4. Calendar dates are written as ⟦shown|spoken⟧ markup: the shown side with digits, the spoken side in words,
   e.g. ⟦12 November|the twelfth of November⟧. Acronyms and Latin names in fa/ckb/ar text are written the same way:
   ⟦MSCI|<letters spelled in the language>⟧. Nothing else uses the markup.
5. Not financial advice: describe levels, scenarios and risks; never tell the listener to buy or sell.
   In the technical section, give for BTC a bullish and a bearish scenario, each with the level that cancels it.
6. Times: the data snapshot was taken at {snap_tehran} Tehran time ({snap_utc} UTC). Events come with their times in
   FACTS. The next episode is published tomorrow at 19:00 Tehran time (15:30 UTC). Use only these instants.

STRUCTURE — exactly these ten sections, in this order, with these ids:
open (greeting, show name, today's date as given below, headline of the day; 2-3 paragraphs)
market (market overview: BTC, ETH, total cap, dominance, breadth, fear & greed, notable movers; 4-5 paragraphs)
news (3-5 most important stories; for each: what happened, who reported it, why it matters to a trader; 5-7 paragraphs)
technical (BTC structure, moving averages, RSI, support/resistance from FACTS, two scenarios with invalidation, ETH; 5-7 paragraphs)
fundamental (derivatives: funding, long/short, liquidations; macro: stocks, gold, yields; Iran: USDT and dollar in toman, price gap; 3-4 paragraphs)
opportunities (what the site's scanner found and its tested record; today's warnings; risk management; 3-5 paragraphs)
calendar (upcoming events with their times; a past reaction if FACTS gives one; 2-4 paragraphs)
lesson (one short educational point tied to today's market; 3 paragraphs)
summary (four numbered points and the main scenario; 5-6 short paragraphs)
outro (when the next episode comes, where to find the full text and the other language versions, not-financial-advice line; 2 paragraphs)

Length: about {words} words in total.

TODAY: {date_label}. Episode: {episode_label}. Show: «{show}».

Return JSON only:
{{"title": "...", "seo_title": "... (max 70 chars)", "meta_description": "... (max 160 chars)",
  "summary": "3 sentences", "key_points": ["5 to 7 short points, each with its figures"],
  "sections": [{{"id": "open", "paras": ["...", "..."]}}, ... all ten ...],
  "news_used": ["ids of the INPUTS news items and URLs of the channel posts you used"]}}
"""

MASTER = """{common}
LANGUAGE: {rules}

STYLE EXAMPLE (an earlier episode — copy its tone, markup and number style; NEVER reuse any of its facts or numbers):
{style}

FACTS (today's numbers with their sources):
{facts}

INPUTS (today's headlines, with the outlets that carried them, and the channel's posts of the last day):
{inputs}
"""

VERSION = """{common}
You are writing the {lang_name} version. It is NOT a translation: write it natively for {lang_name} listeners, from
the Persian master below. Keep every fact and every figure of the master, section by section, and add none.
The Persian master expresses Iranian toman prices and Tehran times; keep them (and add the listener's own time zone
where the language rules say so).
LANGUAGE: {rules}

STYLE EXAMPLE in {lang_name} (an earlier episode — copy its tone, markup and number style; NEVER reuse its facts):
{style}

PERSIAN MASTER (today's episode):
{master}
"""

FIX = """
YOUR PREVIOUS ANSWER FAILED THESE CHECKS — return the whole JSON again with them fixed and nothing else changed:
{problems}
"""

# numbers of the craft, always allowed: windows, indicator thresholds and periods, small counts, years
GENERIC = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 20, 21, 24, 25, 26, 30, 36, 48, 50, 60, 70, 72, 80, 90, 100, 200,
           365, 1000, 2024, 2025, 2026, 2027, 1403, 1404, 1405, 1406}


# ------------------------------------------------------------------ helpers
def compact(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"), default=str)


def all_text(sc):
    parts = [sc.get("title", ""), sc.get("summary", "")] + list(sc.get("key_points", []))
    for s in sc.get("sections", []):
        parts += s.get("paras", [])
    return " ".join(parts)


def shape_problems(sc):
    p = []
    ids = [s.get("id") for s in sc.get("sections", [])]
    if ids != list(LB.SECTION_IDS):
        p.append(f"sections must be exactly {list(LB.SECTION_IDS)} in that order; got {ids}")
    for s in sc.get("sections", []):
        if not s.get("paras") or not all(isinstance(x, str) and x.strip() for x in s["paras"]):
            p.append(f"section {s.get('id')} has an empty paragraph")
    for k in ("title", "seo_title", "meta_description", "summary"):
        if not str(sc.get(k, "")).strip():
            p.append(f"missing {k}")
    if not 4 <= len(sc.get("key_points", [])) <= 8:
        p.append("key_points must have 5 to 7 items")
    if re.search(r"https?://|[*#]{2,}|^\s*[-•]", all_text(sc), re.M):
        p.append("no URLs, markdown or bullet characters in the text")
    return p


def values(obj, out):
    """Every number inside a JSON value, and every number written inside its strings."""
    if isinstance(obj, bool) or obj is None:
        return out
    if isinstance(obj, (int, float)):
        out.add(float(obj))
    elif isinstance(obj, str):
        for x in qc.numbers(obj, "en"):
            out.add(x)
    elif isinstance(obj, dict):
        for v in obj.values():
            values(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            values(v, out)
    return out


def allowed(facts, inputs, day):
    base = values(facts, set()) | values(inputs, set()) | set(map(float, GENERIC))
    for d in (day, day + dt.timedelta(days=1), day - dt.timedelta(days=1)):
        jy, jm, jd = LB.to_jalali(d)
        base |= {float(d.day), float(d.month), float(d.year), float(jy), float(jm), float(jd)}
    # round "psychological" levels near today's prices (70,000 for BTC; 2,000 for ETH), never far from the price
    for sym, step in (("BTC", 1000), ("ETH", 50)):
        p = (facts.get("facts", {}).get(f"{sym}.price") or {}).get("value")
        if p:
            k0 = int(p * 0.8 // step)
            base |= {float(k * step) for k in range(k0, int(p * 1.2 // step) + 2)}
    pool = set()
    for v in base:
        for scale in (1, 1e3, 1e6, 1e9, 1e12, 0.01, 100):
            pool.add(abs(v / scale))
    return pool


def traceable(x, pool):
    """x as written (digits) is some allowed value, exactly or as rounded to the precision written."""
    s = repr(x)
    dec = len(s.split(".")[1]) if "." in s and not s.endswith(".0") else 0
    for v in pool:
        if dec and round(v, dec) == round(x, dec):
            return True
        if not dec:
            if round(v) == x:
                return True
            for k in (1, 2, 3):
                if x % (10 ** k) == 0 and round(v, -k) == x:
                    return True
        if dec == 0 and abs(v - x) < 1e-9:
            return True
    return False


def untraceable(sc, pool):
    bad = []
    for s in sc["sections"]:
        for par in s["paras"]:
            for sent in re.split(r"(?<=[.!?؟])\s+", par):
                miss = [x for x in qc.numbers(sent, "fa") if not traceable(x, pool)]
                if miss:
                    bad.append((s["id"], sent, miss))
    for kp in sc.get("key_points", []):
        miss = [x for x in qc.numbers(kp, "fa") if not traceable(x, pool)]
        if miss:
            bad.append(("key_points", kp, miss))
    return bad


LETTERS = {
    "fa": dict(A="ای", B="بی", C="سی", D="دی", E="ای", F="اف", G="جی", H="اچ", I="آی", J="جی", K="کی", L="ال", M="ام", N="ان",
               O="او", P="پی", Q="کیو", R="آر", S="اس", T="تی", U="یو", V="وی", W="دبلیو", X="ایکس", Y="وای", Z="زد"),
    "ckb": dict(A="ئەی", B="بی", C="سی", D="دی", E="ئی", F="ئێف", G="جی", H="ئێچ", I="ئای", J="جەی", K="کەی", L="ئێڵ", M="ئێم",
                N="ئێن", O="ئۆ", P="پی", Q="کیو", R="ئاڕ", S="ئێس", T="تی", U="یو", V="ڤی", W="دەبڵیو", X="ئێکس", Y="وای", Z="زێد"),
    "ar": dict(A="إيه", B="بي", C="سي", D="دي", E="إي", F="إف", G="جي", H="إتش", I="آي", J="جيه", K="كيه", L="إل", M="إم", N="إن",
               O="أو", P="بي", Q="كيو", R="آر", S="إس", T="تي", U="يو", V="في", W="دبليو", X="إكس", Y="واي", Z="زد"),
}


def spoken(text):
    return BR.sub(lambda m: m.group(2), text)


def fix_latin(sc, lang):
    """Capital abbreviations left outside markup (e.g. 'ETF') are wrapped and spelled by rule; any other Latin word in
    the spoken text is reported (the model is asked to rewrite it)."""
    if lang == "en":
        return []
    L = LETTERS[lang]
    sep = "‌" if lang == "fa" else " "

    def wrap(m):
        w = m.group(0)
        return f"⟦{w}|{sep.join(L[c] for c in w)}⟧"
    left = []
    for s in sc["sections"]:
        new = []
        for par in s["paras"]:
            out, last = [], 0
            for m in BR.finditer(par):        # only outside existing markup
                out.append(re.sub(r"\b[A-Z]{2,6}\b", wrap, par[last:m.start()])); out.append(m.group(0)); last = m.end()
            out.append(re.sub(r"\b[A-Z]{2,6}\b", wrap, par[last:]))
            par = "".join(out)
            new.append(par)
            lat = re.findall(r"[A-Za-z][A-Za-z&.'-]*", spoken(par))
            if lat:
                left.append((s["id"], sorted(set(lat))))
        s["paras"] = new
    return left


def finalize_fields(sc, lang, day, n):
    show, full = LB.SHOW[lang]
    titles = dict(zip(LB.SECTION_IDS, LB.SECTION_TITLES[lang]))
    sc.update({"lang": lang, "dir": LB.DIR[lang], "show": show, "show_full": full,
               "episode_label": LB.episode_label(n, lang), "date_label": LB.date_label(day, lang), "date": day.isoformat()})
    for s in sc["sections"]:
        s["title"] = titles[s["id"]]
    return sc


# ------------------------------------------------------------------ the writer
class Writer:
    def __init__(self, gen=None, words=2000):
        if gen is None:
            import ai
            gen = lambda prompt: ai.generate(prompt, as_json=True, temperature=0.4, max_tokens=32000, tries=3, timeout=300)  # noqa: E731
        self.gen = gen
        self.words = words
        self.style = json.load(open(os.path.join(HERE, "style.json"), encoding="utf-8"))
        self.log = []

    def common(self, lang, ctx):
        return COMMON.format(show=LB.SHOW[lang][0], snap_tehran=ctx["snap_tehran"], snap_utc=ctx["snap_utc"],
                             words=self.words if lang == "fa" else f"{self.words} (as long as the master)",
                             date_label=LB.date_label(ctx["day"], lang), episode_label=LB.episode_label(ctx["n"], lang))

    def ask(self, prompt, check, what):
        sc, problems = None, None
        for attempt in (1, 2):
            p = prompt + (FIX.format(problems="\n".join(f"- {x}" for x in problems)) if problems else "")
            try:
                sc = self.gen(p)
            except Exception as ex:  # noqa: BLE001
                self.log.append(f"{what}: attempt {attempt} failed: {ex!r}")
                problems = [f"the answer was not valid JSON ({ex!r})"]
                sc = None
                continue
            problems = check(sc)
            self.log.append(f"{what}: attempt {attempt}: {len(problems)} problem(s)" + (f": {problems[:6]}" if problems else ""))
            if not problems:
                return sc, []
        return sc, problems or ["no answer"]

    def master(self, facts, inputs, ctx):
        pool = allowed(facts, inputs, ctx["day"])
        st = compact(self.style["fa"])
        prompt = MASTER.format(common=self.common("fa", ctx), rules=LANG_RULES["fa"], style=st,
                               facts=compact(facts["facts"]), inputs=compact(inputs))

        def check(sc):
            p = shape_problems(sc)
            if p:
                return p
            p += [f"untraceable figure(s) {m} in: {sent[:160]}" for _, sent, m in untraceable(sc, pool)][:12]
            p += [f"time not allowed: {t}" for t in qc.times(all_text(sc), "fa", ctx["allowed_utc"])]
            p += [f"Latin left in spoken text of section {sid}: {w}" for sid, w in fix_latin(sc, "fa")]
            return p
        sc, problems = self.ask(prompt, check, "fa")
        if sc and problems and not shape_problems(sc):
            sc, problems = self.prune(sc, pool, ctx)
        return sc, problems

    def prune(self, sc, pool, ctx):
        """Last resort for the master: drop the sentences that still carry an untraceable figure."""
        bad = untraceable(sc, pool)
        if len(bad) > 4:
            return sc, [f"{len(bad)} sentences with untraceable figures"]
        drop = {sent for _, sent, _ in bad}
        for s in sc["sections"]:
            paras = []
            for par in s["paras"]:
                kept = [x for x in re.split(r"(?<=[.!?؟])\s+", par) if x not in drop]
                if kept:
                    paras.append(" ".join(kept))
            s["paras"] = paras
        sc["key_points"] = [k for k in sc["key_points"] if k not in drop]
        self.log.append(f"fa: pruned {len(drop)} sentence(s) with untraceable figures")
        left = shape_problems(sc) + [f"time {t}" for t in qc.times(all_text(sc), "fa", ctx["allowed_utc"])]
        left += [f"Latin in {sid}: {w}" for sid, w in fix_latin(sc, "fa")]
        return sc, left

    def version(self, lang, master, ctx):
        prompt = VERSION.format(common=self.common(lang, ctx), lang_name=LB.LANG_NAME[lang] if lang != "ckb" else "Central Kurdish (Sorani)",
                                rules=LANG_RULES[lang], style=compact(self.style[lang]), master=compact(
                                    {k: master[k] for k in ("title", "summary", "key_points", "sections")}))

        def check(sc):
            p = shape_problems(sc)
            if p:
                return p
            diffs = qc.compare_sections({"fa": master, lang: sc})
            p += [f"section {d['section']}: figures only in the master {d['only_in_master']}, only in yours {d['only_in_this']}"
                  for d in diffs]
            p += [f"time not allowed: {t}" for t in qc.times(all_text(sc), lang, ctx["allowed_utc"])]
            p += [f"Latin left in spoken text of section {sid}: {w}" for sid, w in fix_latin(sc, lang)]
            return p
        return self.ask(prompt, check, lang)


def context(facts, day, n, release_utc):
    snap = dt.datetime.fromisoformat(facts["meta"]["snapshot_utc"])
    allowed_utc = {snap.hour * 60 + snap.minute, release_utc.hour * 60 + release_utc.minute}
    for e in facts["facts"].get("events.next", {}).get("value", []) or []:
        t = dt.datetime.strptime(e["utc"], "%Y-%m-%d %H:%M")
        allowed_utc.add(t.hour * 60 + t.minute)
    return {"day": day, "n": n, "allowed_utc": allowed_utc, "snap_utc": snap.strftime("%H:%M"),
            "snap_tehran": snap.astimezone(TEHRAN).strftime("%H:%M")}


def write_all(ep, day, n, release_utc, gen=None, langs=("ckb", "en", "ar")):
    facts = json.load(open(os.path.join(ep, "facts.json"), encoding="utf-8"))
    inputs = json.load(open(os.path.join(ep, "inputs.json"), encoding="utf-8"))
    ctx = context(facts, day, n, release_utc)
    w = Writer(gen)
    report = {"held": {}, "log": w.log}
    fa, problems = w.master(facts, inputs, ctx)
    if problems:
        report["held"] = {l: f"Persian master failed: {problems[:5]}" for l in ("fa",) + tuple(langs)}
        json.dump(report, open(os.path.join(ep, "write_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        return report
    finalize_fields(fa, "fa", day, n)
    json.dump(fa, open(os.path.join(ep, "script_fa.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for lang in langs:
        sc, problems = w.version(lang, fa, ctx)
        if problems:
            report["held"][lang] = problems[:6]
            continue
        finalize_fields(sc, lang, day, n)
        json.dump(sc, open(os.path.join(ep, f"script_{lang}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(report, open(os.path.join(ep, "write_report.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return report
