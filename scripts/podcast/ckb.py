"""Sorani (Central Kurdish, ckb) reading for the podcast, with the Vekol voice.

The rules follow entekhab.net's own read-aloud (assets/reader.js), so the podcast and the site say
numbers the same way: Kurdish number words, «پۆینت» for the decimal point, «لەسەدا» before a percentage,
Arabic-Indic digits in the written text. Added here for a read programme: clock times
(«کاتژمێر پازدە و حەوت خولەک»), suffixes written straight onto a number («٣٠دایە» → «سیدایە»), and an
independent words-to-number parser used by QC to prove every spoken number says what the digits say.

Vekol-TTS (Revge, CC BY-NC 4.0) is a character model: the input is the letters themselves, folded onto the
model's map, with a pad between characters. Long sentences are read in clause pieces of at most 70
characters, each closed with a period, because a piece ending on a comma makes VITS babble to fill it.
The same voice and the same int8 build serve the site's reader (tts/ckb/vekol.int8.onnx).
"""
import json
import os
import re
import unicodedata

import numpy as np

MODELS = os.environ.get("PODCAST_MODELS", "/home/claude/models")
VEKOL_DIR = os.path.join(MODELS, "vekol")

ONES = ["", "یەک", "دوو", "سێ", "چوار", "پێنج", "شەش", "حەوت", "هەشت", "نۆ"]
TEENS = ["دە", "یازدە", "دوازدە", "سێزدە", "چواردە", "پازدە", "شازدە", "حەڤدە", "هەژدە", "نۆزدە"]
TENS = ["", "", "بیست", "سی", "چل", "پەنجا", "شەست", "حەفتا", "هەشتا", "نەوەد"]
BIG = [(10 ** 12, "تریلیۆن"), (10 ** 9, "ملیار"), (10 ** 6, "ملیۆن"), (1000, "هەزار")]
AND, ZERO, POINT = " و ", "سفر", "پۆینت"

FOLD = {"ص": "س", "ض": "ز", "ط": "ت", "ظ": "ز", "ث": "س", "ذ": "ز", "ء": "ئ", "ك": "ک", "ھ": "ه", "ہ": "ه", "ۀ": "ە", "ة": "ە", "ى": "ی", "ي": "ی", "ﻯ": "ی", "ﺉ": "ئ", "ٸ": "ئ",
        "ؤ": "و", "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ڭ": "گ", "‌": "", "‍": "", "ـ": "",
        "“": '"', "”": '"', "’": "'", "‘": "'", "—": "-", "–": "-", "…": ".", "«": '"', "»": '"',
        "(": "،", ")": "،", "[": "،", "]": "،", "/": " ", "·": "،", ",": "،", ";": "؛", "?": "؟"}
DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


# ------------------------------------------------------------------ numbers
def _u100(n):
    if n < 10:
        return ONES[n]
    if n < 20:
        return TEENS[n - 10]
    t, r = TENS[n // 10], n % 10
    return t + AND + ONES[r] if r else t


def _u1000(n):
    if n < 100:
        return _u100(n)
    h, r = divmod(n, 100)
    hw = "سەد" if h == 1 else ONES[h] + "سەد"
    return hw + AND + _u100(r) if r else hw


def spell(n):
    """Integer to Sorani words, exactly as the site's reader says it."""
    if n == 0:
        return ZERO
    parts = []
    for div, word in BIG:
        if n >= div:
            q, n = divmod(n, div)
            parts.append(word if (q == 1 and div == 1000) else f"{_u1000(q)} {word}")
    if n:
        parts.append(_u1000(n))
    return AND.join(parts)


def _one_by_one(s):
    return " ".join(ZERO if d == "0" else ONES[int(d)] for d in s)


def number_words(tok):
    """'73071' -> words; '1.2' -> 'یەک پۆینت دوو'; '0.05' reads the fraction digit by digit (site rule)."""
    if "." in tok:
        a, b = tok.split(".", 1)
        fb = _one_by_one(b) if (b.startswith("0") or len(b) > 3) else spell(int(b))
        return f"{spell(int(a))} {POINT} {fb}"
    return spell(int(tok)) if len(tok) <= 15 else _one_by_one(tok)


def clock_words(h, m):
    h, m = int(h), int(m)
    if m == 0:
        return spell(h)
    if m == 30:
        return f"{spell(h)} و نیو"
    return f"{spell(h)} و {spell(m)} خولەک"


NUM = re.compile(r"(\d+(?:\.\d+)?)([^\W\d_]*)")  # a suffix written onto the number stays attached


def normalize(text):
    """Display text (markup already resolved to its spoken side) -> what Vekol reads."""
    t = text.translate(DIGITS)
    t = t.replace("٬", ",").replace("٫", ".")
    t = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", t)                       # 73,071 -> 73071
    t = re.sub(r"(?<!\d)(\d{1,2}):(\d{2})(?!\d)", lambda m: clock_words(m.group(1), m.group(2)), t)
    t = re.sub(r"(\d+(?:\.\d+)?)\s?[%٪]", r"لەسەدا \1", t)              # 5% -> لەسەدا 5 (script writes it so already)
    t = NUM.sub(lambda m: number_words(m.group(1)) + m.group(2), t)
    t = "".join(FOLD.get(c, c) for c in t)
    t = re.sub(r"[A-Za-z]+", " ", t)                                      # never reached for the podcast: QC flags Latin
    t = re.sub(r"\s+", " ", t)
    return re.sub(r"\s+([.،؛:!؟])", r"\1", t).strip()


# ------------------------------------------------------------------ Sorani words -> numbers (QC, independent of spell)
_W = {w: i for i, w in enumerate(ONES) if w}
_W.update({w: 10 + i for i, w in enumerate(TEENS)})
_W.update({w: 10 * i for i, w in enumerate(TENS) if w})
_W.update({"سەد": 100, ZERO: 0})
_W.update({ONES[h] + "سەد": 100 * h for h in range(2, 10)})
_BIGW = {w: d for d, w in BIG}


def words_value(words):
    """'حەفتا و سێ هەزار و حەفتا و یەک' -> 73071; 'یەک پۆینت دوو' -> 1.2. None if it is not a number."""
    toks = [w for w in words.split() if w != "و"]
    if not toks:
        return None
    if POINT in toks:
        i = toks.index(POINT)
        a = words_value(" ".join(toks[:i]))
        frac = toks[i + 1:]
        if a is None or not frac:
            return None
        if all(w in ONES[1:] + [ZERO] for w in frac) and len(frac) > 1:
            digits = "".join("0" if w == ZERO else str(ONES.index(w)) for w in frac)
        else:
            b = words_value(" ".join(frac))
            if b is None:
                return None
            digits = str(int(b))
        return float(f"{int(a)}.{digits}")
    total, cur = 0, 0
    for w in toks:
        if w in _BIGW:
            total += (cur or 1) * _BIGW[w]; cur = 0
        elif w in _W:
            cur += _W[w]
        else:
            return None
    return total + cur


def check_numbers(display):
    """Every number in the written sentence -> (value, spoken words, value parsed back from the words)."""
    t = display.translate(DIGITS).replace("٬", ",").replace("٫", ".")
    t = re.sub(r"(?<=\d),(?=\d{3}(?!\d))", "", t)
    t = re.sub(r"(?<!\d)\d{1,2}:\d{2}(?!\d)", " ", t)
    out = []
    for tok in re.findall(r"\d+(?:\.\d+)?", t):
        w = number_words(tok)
        out.append((float(tok), w, words_value(w)))
    return out


# ------------------------------------------------------------------ chunks
CLAUSE = re.compile(r"(?<=[،؛:])")


def pieces(sentence, maxlen=70):
    """A sentence Vekol reads in one pass, or clause pieces <= maxlen each closed with a period."""
    s = sentence.strip()
    if len(s) <= maxlen:
        return [s]
    out, buf = [], ""
    for part in CLAUSE.split(s):
        if buf and len(buf) + len(part) > maxlen:
            out.append(buf); buf = part
        else:
            buf += part
    if buf.strip():
        out.append(buf)
    fixed = []
    for c in out:  # a clause still too long: break at the last space before the limit
        c = c.strip()
        while len(c) > maxlen + 15:
            cut = c.rfind(" ", 0, maxlen)
            cut = cut if cut > maxlen * 0.4 else maxlen
            fixed.append(c[:cut]); c = c[cut:].strip()
        fixed.append(c)
    return [c.rstrip("،؛:.؟!\"").strip() + ("؟" if c.rstrip().endswith("؟") else ".") for c in fixed if c.strip()]


# ------------------------------------------------------------------ Vekol
class Vekol:
    """Vekol-TTS edge (int8, the site's build). Returns float32 at 22,050 Hz."""
    SCALES = [0.667, 1.0, 0.35]   # noise, length, noise_w: the model card's values
    RATE = 0.075                  # seconds per character, from the model's own helper

    def __init__(self, model=None, config=None, length_scale=1.0, threads=None):
        import onnxruntime as ort
        pick = lambda *names: next((os.path.join(VEKOL_DIR, n) for n in names if os.path.exists(os.path.join(VEKOL_DIR, n))),  # noqa: E731
                                   os.path.join(VEKOL_DIR, names[0]))
        model = model or pick("model.onnx", "vekol.int8.onnx")          # full precision first (CI), the site's int8 build otherwise
        config = config or pick("model.onnx.json", "vekol.onnx.json")
        self.cfg = json.load(open(config, encoding="utf-8"))
        assert self.cfg.get("phoneme_type") == "text", "expected Vekol's character map"
        self.pm = self.cfg["phoneme_id_map"]
        self.sr = self.cfg["audio"]["sample_rate"]
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads or os.cpu_count() or 2
        self.sess = ort.InferenceSession(model, so, providers=["CPUExecutionProvider"])
        self.scales = np.array([self.SCALES[0], length_scale, self.SCALES[2]], dtype=np.float32)
        self.pad, self.bos, self.eos = self.pm["_"][0], self.pm["^"][0], self.pm["$"][0]

    def unknown(self, text):
        """Characters the model would drop (QC: must be empty)."""
        return sorted({c for c in unicodedata.normalize("NFD", text) if c not in self.pm and not unicodedata.combining(c)})

    def ids(self, text):
        seq = [self.bos, self.pad]
        for ch in unicodedata.normalize("NFD", text):
            if ch in self.pm:
                seq += [self.pm[ch][0], self.pad]
        return np.array([seq + [self.eos]], dtype=np.int64)

    def _denoise(self, a, reduce_db=16):
        from scipy.signal import stft, istft
        _, _, Z = stft(a, self.sr, nperseg=1024, noverlap=768)
        mag, ph = np.abs(Z), np.angle(Z)
        noise = np.percentile(mag, 10, axis=1, keepdims=True)
        g = 10 ** (-reduce_db / 20)
        mask = g + (1 - g) * np.clip((mag / (noise + 1e-9) - 1.0) / 2.0, 0, 1)
        _, y = istft(mag * mask * np.exp(1j * ph), self.sr, nperseg=1024, noverlap=768)
        return y[:len(a)].astype(np.float32)

    def _trim(self, a, gap=0.35, edge=0.06, th=0.02):
        n = int(0.02 * self.sr)
        env = np.convolve(np.abs(a), np.ones(n) / n, "same")
        loud = env > th * (env.max() or 1)
        if not loud.any():
            return a
        first, last = np.where(loud)[0][[0, -1]]
        i = last
        while i > first:   # a tail after a long silence is a hallucination: cut it
            if not loud[i]:
                j = i
                while j > first and not loud[j]:
                    j -= 1
                if (i - j) / self.sr > gap:
                    last = j
                i = j
            else:
                i -= 1
        return a[max(0, first - int(edge * self.sr)): min(len(a), last + int(edge * self.sr))]

    def piece(self, text, tries=3):
        """One short piece. VITS durations are random and a render can tack on a babble tail; babble only adds
        length, so re-render up to `tries` times and keep the shortest, stopping once it fits the length the
        character count predicts."""
        cap = len(text) * self.RATE * float(self.scales[1]) + 1.2
        best = None
        for _ in range(tries):
            ids = self.ids(text)
            a = self.sess.run(None, {"input": ids, "input_lengths": np.array([ids.shape[1]], dtype=np.int64),
                                     "scales": self.scales, "sid": np.array([0], dtype=np.int64)})[0].squeeze()
            a = self._trim(self._denoise(a.astype(np.float32)))
            if best is None or len(a) < len(best):
                best = a
            if len(best) / self.sr <= cap:
                break
        return best

    def sentence(self, speech, clause_gap=0.13):
        parts = pieces(speech)
        out = []
        for i, p in enumerate(parts):
            out.append(self.piece(p))
            if i < len(parts) - 1:
                out.append(np.zeros(int(clause_gap * self.sr), np.float32))
        return np.concatenate(out), self.sr
