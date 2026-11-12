"""Voice track for one language: sentence-by-sentence synthesis with measured timings.

Output (in the episode folder):
  voice_<lang>.wav    44.1 kHz mono, speech only, with the pauses of a read programme
  timeline_<lang>.json  every sentence with start/end (seconds), its section, its display text
"""
import json
import os
import re
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
    "fa": dict(backend="piper", folder="vits-piper-fa_IR-ganji_adabi-medium", sid=0, speed=1.2),
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


def build(ep, lang):
    sc = json.load(open(os.path.join(ep, f"script_{lang}.json"), encoding="utf-8"))
    chunks, timeline, t = [], [], 0.0
    for si, sec in enumerate(sc["sections"]):
        sec_start = t
        for pi, par in enumerate(sec["paras"]):
            for s in sentences(par, lang):
                a = synth(speech_text(s, lang), lang)
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
