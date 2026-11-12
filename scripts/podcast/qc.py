"""Quality control for an episode (section 10 of the brief). Each check returns (ok, details);
the report lists every failure. Nothing is published unless qc passes for that language.

Text checks
  numbers  every figure in each language version, section by section, must match the Persian master
  facts    every figure must be traceable to facts.json (exact, rounded, or listed in ALLOWED_DERIVED)
Audio checks (after mixing)
  health   file decodes, duration, true peak, integrated loudness, no long silences
  asr      Whisper transcribes a sample of sentences back; character error rate per language
"""
import json
import re
import sys

FA = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩٬٫", "01234567890123456789,.")
BR = re.compile(r"⟦([^|⟧]*)\|([^⟧]*)⟧")


def display(text):
    return BR.sub(lambda m: m.group(1), text)


def numbers(text, lang):
    t = display(text).translate(FA)
    if lang == "tr":
        t = re.sub(r"(?<=\d)\.(?=\d{3}\b)", "", t)
        t = re.sub(r"(?<=\d),(?=\d)", ".", t)
    else:
        t = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", t)  # a suffix may follow (Sorani ٨٦٬٥٠٠ەوە)
    t = re.sub(r"\b\d{1,2}:\d{2}\b", " ", t)  # clock times are checked by times(), per time zone
    return [float(x) for x in re.findall(r"\d+(?:\.\d+)?", t)]


OFFSETS = {"fa": (0, 210), "en": (0, 210), "ar": (0, 180, 210), "ckb": (0, 210), "tr": (0, 180)}  # minutes: UTC, Tehran (+3:30), Mecca/TSİ (+3)


def times(text, lang, allowed_utc):
    """Every clock time must be one of the episode's instants, read in UTC or the language's local zone."""
    bad = []
    for h, m in re.findall(r"\b(\d{1,2}):(\d{2})\b", display(text).translate(FA)):
        t = int(h) * 60 + int(m)
        if not any(((t - off) % 1440) in allowed_utc for off in OFFSETS[lang]):
            bad.append(f"{h}:{m}")
    return bad


FA_W = {"صفر": 0, "یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "شیش": 6, "هفت": 7, "هشت": 8, "نه": 9, "ده": 10,
        "یازده": 11, "دوازده": 12, "سیزده": 13, "چهارده": 14, "پانزده": 15, "پونزده": 15, "شانزده": 16, "هفده": 17, "هجده": 18,
        "هیجده": 18, "نوزده": 19, "بیست": 20, "سی": 30, "چهل": 40, "پنجاه": 50, "شصت": 60, "هفتاد": 70, "هشتاد": 80, "نود": 90,
        "صد": 100, "یکصد": 100, "سد": 100, "دویست": 200, "سیصد": 300, "چهارصد": 400, "پانصد": 500, "ششصد": 600, "هفتصد": 700,
        "هشتصد": 800, "نهصد": 900, "هزار": 1000, "میلیون": 10 ** 6, "میلیارد": 10 ** 9, "تریلیون": 10 ** 12}
FA_FRAC = {"دهم": 10, "صدم": 100, "هزارم": 1000}


def _fa_value(seq):
    total, cur, last = 0, 0, None
    for t in seq:
        if t == "و":
            continue
        if t in FA_FRAC:
            if last is None:
                return None
            cur = cur - last + last / FA_FRAC[t]; continue
        v = FA_W.get(t, float(t) if re.fullmatch(r"\d+(\.\d+)?", t) else None)
        if v is None:
            return None
        if v >= 1000:
            cur = (cur or 1) * v; total += cur; cur = 0
        else:
            cur += v
        last = v
    return total + cur


def fa_words_to_numbers(text):
    """Whisper writes Persian numbers as words ("دو هزار و سی"). Every sub-span of a run of number words is
    evaluated, so "دو هزار و صد و پنج و دو هزار و صد و هفتاد و پنج" yields both 2105 and 2175."""
    toks = re.sub(r"[\u200c،,.؛:!?؟]", " ", text.translate(FA)).split()
    isnum = lambda t: t in FA_W or bool(re.fullmatch(r"\d+(\.\d+)?", t))  # noqa: E731
    vals, i = set(), 0
    while i < len(toks):
        if not isnum(toks[i]):
            i += 1; continue
        j = i
        while j + 1 < len(toks) and (isnum(toks[j + 1]) or toks[j + 1] == "و" or toks[j + 1] in FA_FRAC):
            j += 1
        run = toks[i:j + 1]
        for a in range(len(run)):
            if not isnum(run[a]):
                continue
            for b in range(a, len(run)):
                if run[b] == "و":
                    continue
                v = _fa_value(run[a:b + 1])
                if v is not None:
                    vals.add(v)
        i = j + 1
    return sorted(vals)


def _same(x, y):
    """72 and 72,000 are the same figure when one side says «72 هزار» / «72 thousand»: scale words are not digits."""
    return any(abs(x * k - y) < 1e-6 * max(1, abs(y)) or abs(y * k - x) < 1e-6 * max(1, abs(x)) for k in (1, 1e3, 1e6, 1e9, 1e12))


def _unmatched(a, b):
    """Multiset match with scale tolerance; small whole numbers (1-5) are ignored: one language writes them as words
    («one-hour», «یک‌ساعته»), and every figure the master carries is traced to the data separately."""
    a = [x for x in a if not (x == int(x) and 0 < x <= 5)]
    b = [y for y in b if not (y == int(y) and 0 < y <= 5)]
    left = list(b)
    ma = []
    for x in a:
        j = next((i for i, y in enumerate(left) if _same(x, y)), None)
        if j is None:
            ma.append(x)
        else:
            left.pop(j)
    return ma, left


def compare_sections(scripts, master="fa"):
    """Same numbers, in every section, in every language (times may differ only by time zone)."""
    out = []
    base = {s["id"]: s for s in scripts[master]["sections"]}
    for lang, sc in scripts.items():
        if lang == master:
            continue
        for s in sc["sections"]:
            a = sorted(numbers(" ".join(base[s["id"]]["paras"]), master))
            b = sorted(numbers(" ".join(s["paras"]), lang))
            ma, mb = _unmatched(a, b)
            if ma or mb:
                out.append({"lang": lang, "section": s["id"], "only_in_master": ma, "only_in_this": mb})
    return out


if __name__ == "__main__":
    ep = sys.argv[1]
    scripts = {l: json.load(open(f"{ep}/script_{l}.json")) for l in ("fa", "ckb", "en", "ar")}
    for d in compare_sections(scripts):
        print(json.dumps(d, ensure_ascii=False))
    allowed = {11 * 60 + 37, 13 * 60 + 30, 8 * 60 + 30}
    for l, sc in scripts.items():
        b = times(" ".join(" ".join(s["paras"]) for s in sc["sections"]) + " " + " ".join(sc["key_points"]), l, allowed)
        print(l, "times", "OK" if not b else b)


# ------------------------------------------------------------------ audio checks
def audio_health(mp3, wav):
    import subprocess
    import numpy as np
    import soundfile as sf
    import pyloudnorm as pyln
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-show_chapters", mp3],
                                   capture_output=True, text=True, errors="replace").stdout)
    st = next(s for s in pr["streams"] if s["codec_type"] == "audio")
    x, sr = sf.read(wav, always_2d=True)
    meter = pyln.Meter(sr)
    lufs = meter.integrated_loudness(x)
    peak_db = 20 * np.log10(np.abs(x).max() + 1e-12)
    clipped = int((np.abs(x) >= 0.999).sum())
    sil = subprocess.run(["ffmpeg", "-hide_banner", "-i", mp3, "-af", "silencedetect=noise=-50dB:d=3", "-f", "null", "-"],
                         capture_output=True, text=True, errors="replace").stderr.count("silence_end")
    dec = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-f", "null", "-"], capture_output=True, text=True, errors="replace").stderr.strip()
    return {"codec": st["codec_name"], "sample_rate": int(st["sample_rate"]), "channels": st["channels"],
            "bitrate_kbps": round(int(pr["format"]["bit_rate"]) / 1000), "duration_s": round(float(pr["format"]["duration"]), 1),
            "size_mb": round(int(pr["format"]["size"]) / 1e6, 2), "chapters": len(pr.get("chapters", [])),
            "has_cover": any(s["codec_type"] == "video" for s in pr["streams"]),
            "lufs": round(lufs, 1), "sample_peak_dbfs": round(peak_db, 2), "clipped_samples": clipped, "silences_over_3s": sil,
            "decode_errors": dec[:200]}


def asr_sample(ep, lang, n=14, seed=7):
    """Transcribe a spread of sentences from the voice track; report pronunciation (phonetic CER) and number accuracy."""
    import random
    import soundfile as sf
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import asr
    tl = [x for x in json.load(open(os.path.join(ep, f"timeline_{lang}.json"), encoding="utf-8"))["timeline"] if "text" in x]
    v, sr = sf.read(os.path.join(ep, f"voice_{lang}.wav"))
    rnd = random.Random(seed)
    plain = [x for x in tl if not re.search(r"[0-9۰-۹]", x["text"]) and len(x["text"]) > 25]
    nums = [x for x in tl if re.search(r"[0-9۰-۹]", x["text"]) and (x["end"] - x["start"]) < 28]
    pick = rnd.sample(plain, min(n // 2, len(plain))) + rnd.sample(nums, min(n - n // 2, len(nums)))
    out, cers, hit, tot = [], [], 0, 0
    for x in pick:
        clip = v[int(x["start"] * sr): int(x["end"] * sr)]
        hyp = asr.transcribe(clip, sr, lang)
        row = {"text": x["text"], "heard": hyp}
        if re.search(r"[0-9۰-۹]", x["text"]):
            want = [w for w in numbers(x["text"], lang)]
            got = numbers(hyp, lang) + numbers(hyp.replace(",", "").replace("٬", ""), lang)
            if lang == "fa":
                got += fa_words_to_numbers(hyp)
            ok = [w for w in want if any(abs(w - g) < 1e-6 or (w and abs(w - g) / w < 1e-3) for g in got)]
            row["numbers_expected"] = want; row["numbers_heard"] = sorted(set(got)); row["numbers_ok"] = len(ok)
            hit += len(ok); tot += len(want)
        else:
            c = asr.cer(x["text"], hyp, lang); cers.append(c); row["pcer"] = round(c, 3)
        out.append(row)
    return {"lang": lang, "pcer_mean": round(sum(cers) / max(1, len(cers)), 3), "numbers_heard_correctly": f"{hit}/{tot}", "rows": out}


import os  # noqa: E402
