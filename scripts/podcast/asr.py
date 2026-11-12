"""Speech recognition used only for quality control: transcribe synthesized audio back to text and
measure how much of the script a listener (here: Whisper large-v3-turbo) can actually understand."""
import os
import re
import unicodedata

import numpy as np

MODELS = os.environ.get("PODCAST_MODELS", "/home/claude/models")
_rec = {}


def recognizer(lang):
    import sherpa_onnx
    if lang in _rec:
        return _rec[lang]
    d = os.path.join(MODELS, "sherpa-onnx-whisper-turbo")
    r = sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=os.path.join(d, "turbo-encoder.int8.onnx"), decoder=os.path.join(d, "turbo-decoder.int8.onnx"),
        tokens=os.path.join(d, "turbo-tokens.txt"), language=lang, task="transcribe",
        num_threads=int(os.environ.get("ASR_THREADS", str(os.cpu_count() or 2))), tail_paddings=-1)
    _rec[lang] = r
    return r


def resample(x, sr, to=16000):
    if sr == to:
        return x.astype(np.float32)
    n = int(round(len(x) * to / sr))
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def transcribe(samples, sr, lang):
    """Whisper reads at most 30 s at a time: callers pass sentence-sized clips."""
    r = recognizer(lang)
    s = r.create_stream()
    x = resample(samples, sr)
    pad = np.zeros(int(16000 * 0.6), dtype=np.float32)  # Whisper drops the last word without trailing silence
    s.accept_waveform(16000, np.concatenate([pad, x, pad, pad]))
    r.decode_stream(s)
    return s.result.text.strip()


_AR_DIAC = re.compile(r"[ً-ْٰـ]")


def norm(text, lang):
    t = unicodedata.normalize("NFKC", text)
    t = t.replace("‌", " ").replace("‏", "").replace("‎", "")
    t = _AR_DIAC.sub("", t)
    t = t.replace("ي", "ی").replace("ك", "ک") if lang == "fa" else t
    if lang == "ar":
        t = re.sub("[إأآا]", "ا", t).replace("ة", "ه").replace("ى", "ي")
    if lang == "tr":
        t = t.replace("İ", "i").replace("I", "ı")
    t = t.lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _lev(a, b):
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


_FA_PHON = str.maketrans({"ص": "س", "ث": "س", "ذ": "ز", "ض": "ز", "ظ": "ز", "ط": "ت", "ح": "ه", "غ": "ق", "ع": "ا", "ء": "", "ئ": "ی", "ؤ": "و", "أ": "ا", "آ": "ا", "ة": "ه"})


def phon(text, lang):
    """Spelling-blind form: Persian/Arabic letters that sound the same are merged, so a recogniser's
    spelling choice (صندوق / سندوق) is not counted as a pronunciation error."""
    t = norm(text, lang)
    if lang in ("fa", "ar"):
        t = t.translate(_FA_PHON)
        t = re.sub(r"ه(?=\s|$)", "", t)  # final silent heh / ta marbuta
    return t


def cer(ref, hyp, lang):
    r, h = phon(ref, lang).replace(" ", ""), phon(hyp, lang).replace(" ", "")
    return _lev(r, h) / max(1, len(r))


def wer(ref, hyp, lang):
    r, h = norm(ref, lang).split(), norm(hyp, lang).split()
    return _lev(r, h) / max(1, len(r))
