"""Voice track for one language: sentence-by-sentence synthesis with measured timings.

Output (in the episode folder):
  voice_<lang>.wav    44.1 kHz mono, speech only, with the pauses of a read programme
  timeline_<lang>.json  every sentence with start/end (seconds), its section, its display text
"""
import json
import os
import re
import statistics
import sys

import numpy as np
import soundfile as sf
import soxr

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ckb  # noqa: E402
import textnorm  # noqa: E402
import tts  # noqa: E402

SR = 44100
PAUSE = {"sentence": 0.30, "para": 0.65, "section": 0.9}
BR = re.compile(r"⟦([^|⟧]*)\|([^⟧]*)⟧")

# One coordinated but distinct identity per language; chosen by the intelligibility test (qc_voices.json)
VOICE = {
    # Persian was read a fifth faster than the others and it cost intelligibility: on 2026-11-21 the listening test
    # put it at 0.36 against a limit of 0.35 and the Persian version was held out of the episode that went to the
    # channel. Back to near-normal pace — a little longer to listen to, and understood.
    "fa": dict(backend="piper", folder="vits-piper-fa_IR-ganji_adabi-medium", sid=0, speed=1.05),
    "ar": dict(backend="piper", folder="vits-piper-ar_JO-kareem-medium", sid=0, speed=1.4),
    "ckb": dict(backend="vekol", folder="vekol", sid=0, speed=1.0),   # Vekol-TTS edge, the site's own Sorani voice
    "en": dict(backend="kokoro", folder="kokoro-en-v0_19", sid=1, speed=1.0),
}

FA_DISPLAY = {"اِم‌اِس‌سی‌آی": "MSCI", "آر‌اس‌آی": "RSI", "آی‌بیت": "IBIT", "اوکی‌ایکس": "OKX",
              "اس‌اند‌پی ۵۰۰": "S&P 500", "انتخاب دات نت": "entekhab.net", "استاک‌تو‌فلو": "استاک‌تو‌فلو (S2F)"}


def display_text(text, lang):
    t = BR.sub(lambda m: m.group(1), text)
    if lang == "fa":
        t = t.replace("ه‌یِ", "هٔ").replace("ِ", "")
        for k, v in FA_DISPLAY.items():
            t = t.replace(k, v)
    if lang == "ar":
        t = textnorm.strip_diacritics(t)
    return t


def speech_text(text, lang):
    if lang == "ckb":
        return ckb.normalize(BR.sub(lambda m: m.group(2), text))
    return textnorm.normalize(BR.sub(lambda m: m.group(2), text), lang)


def sentences(par, lang):
    parts = re.split(r"(?<=[.!?؟])\s+", par.strip())
    return [p for p in parts if p.strip()]


_vekol = None


def synth(text, lang):
    global _vekol
    if lang == "ckb":
        if _vekol is None:
            _vekol = ckb.Vekol()
        unknown = _vekol.unknown(text)
        if unknown:
            raise ValueError(f"Vekol cannot read {unknown!r} in: {text[:80]}")
        a, sr = _vekol.sentence(text)
    else:
        a, sr = tts.synth(text, voice=VOICE[lang])
    a = soxr.resample(a, sr, SR, quality="VHQ")
    # trim the model's own leading/trailing silence so our pauses are exact
    thr = 0.01 * (np.abs(a).max() or 1)
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx):
        a = a[max(0, idx[0] - int(0.02 * SR)): idx[-1] + int(0.06 * SR)]
    return a.astype(np.float32)


def pace(a, text):
    """Seconds of audio for each character of the spoken text."""
    return (len(a) / SR) / max(1, len(text))


def say(text, lang, paces):
    """Synthesize one sentence, and catch the times the voice stops early.

    Every so often a sentence comes back as a fraction of the audio it needs — the opening words and then nothing.
    It is not the text: the same sentence reads perfectly on the next attempt. On 2026-11-21 it put half-spoken
    sentences into the Persian track, and the listening test, hearing speech that stops mid-sentence, reported a
    phonetic error of 0.46 and held the Persian version out of the episode.

    So each sentence is measured against the pace of the ones already read in this track, which calibrates itself to
    the language and the voice, and anything far short of it is read again. The first few sentences have nothing to
    compare against and are taken as they come.
    """
    a = synth(text, lang)
    if len(paces) < 5:
        return a
    floor = 0.55 * statistics.median(paces)
    for _ in range(2):
        if pace(a, text) >= floor:
            return a
        b = synth(text, lang)
        print(f"  {lang}: re-read a sentence that stopped early "
              f"({pace(a, text):.4f} s/char against {floor:.4f}): {text[:60]}")
        if pace(b, text) > pace(a, text):
            a = b
    if pace(a, text) < floor:
        print(f"::warning::{lang}: a sentence still reads short after two more attempts: {text[:80]}")
    return a


def build(ep, lang):
    sc = json.load(open(os.path.join(ep, f"script_{lang}.json"), encoding="utf-8"))
    chunks, timeline, t = [], [], 0.0
    paces = []
    for si, sec in enumerate(sc["sections"]):
        sec_start = t
        for pi, par in enumerate(sec["paras"]):
            for s in sentences(par, lang):
                spoken = speech_text(s, lang)
                a = say(spoken, lang, paces)
                paces.append(pace(a, spoken))
                timeline.append({"section": sec["id"], "para": pi, "start": round(t, 3), "end": round(t + len(a) / SR, 3),
                                 "text": display_text(s, lang), "spoken": speech_text(s, lang)})
                chunks.append(a); t += len(a) / SR
                gap = np.zeros(int(PAUSE["sentence"] * SR), np.float32); chunks.append(gap); t += len(gap) / SR
            gap = np.zeros(int((PAUSE["para"] - PAUSE["sentence"]) * SR), np.float32); chunks.append(gap); t += len(gap) / SR
        timeline.append({"section_mark": sec["id"], "title": sec["title"], "start": round(sec_start, 3), "end": round(t, 3)})
    voice = np.concatenate(chunks)
    sf.write(os.path.join(ep, f"voice_{lang}.wav"), voice, SR, subtype="PCM_16")
    words = sum(len(x["text"].split()) for x in timeline if "text" in x)
    meta = {"lang": lang, "voice": VOICE[lang], "duration": round(len(voice) / SR, 2), "words": words,
            "wpm": round(words / (len(voice) / SR) * 60, 1), "timeline": timeline}
    json.dump(meta, open(os.path.join(ep, f"timeline_{lang}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return meta


if __name__ == "__main__":
    ep = sys.argv[1]
    for lang in sys.argv[2:]:
        m = build(ep, lang)
        print(lang, "duration %.1fs" % m["duration"], "words", m["words"], "wpm", m["wpm"])
