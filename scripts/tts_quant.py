#!/usr/bin/env python3
"""Shrink the read-aloud voices to int8 and measure what that costs in sound.

    python3 scripts/tts_quant.py check     # CI experiment: variants, sizes, distortion, WAVs to listen to
    python3 scripts/tts_quant.py build     # used by fetch_tts.py: write the chosen int8 models

Dynamic int8 quantisation stores Conv/MatMul weights as 8-bit, ~4x smaller, and onnxruntime-web's
CPU (WASM) kernels run them directly. It is lossy, so before shipping we render the same sentences
with the original and each int8 variant and compare them:
  - noise switched off (noise_scale = noise_w = 0) so VITS is deterministic and any difference is
    the quantisation, not the sampler
  - duration ratio (int8 / fp32): timing drift means the duration predictor was hurt
  - log-mel spectral distance in dB over aligned frames: ~1-2 dB is inaudible, >4 dB starts to buzz
Natural-noise WAVs of both are written for listening, because numbers do not hear hiss.
"""
import gzip
import io
import json
import os
import sys
import wave

import numpy as np
import onnxruntime as ort

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.environ.get("TTS_CACHE") or os.path.expanduser("~/.cache/entekhab-tts")
OUT = os.path.join(ROOT, "tts_check")

FA_TEXTS = [
    "ارزش بازار هشتصد و پنجاه میلیون دلاری همچنان نود و هفت درصد پایین‌تر از سقف تاریخی خود است.",
    "قیمت بیت‌کوین به نود و هفت هزار و پانصد دلار رسید و شاخص قدرت نسبی روی هفتاد و دو است.",
    "قبل از هر معامله، حد ضرر را مشخص کنید و بیش از دو درصد سرمایه را در خطر نگذارید.",
]
CKB_TEXTS = [
    "نرخی بیتکۆین گەیشتە نەوەد و حەوت هەزار و پێنجسەد دۆلار.",
    "پێش هەر مامەڵەیەک، ستۆپ لۆس دیاری بکە.",
    "بازاڕ ئەمڕۆ هێمنە و قەبارەی مامەڵە کەم بووەتەوە.",
]

VARIANTS = {
    "u8": dict(weight="QUInt8", per_channel=False),
    "s8pc": dict(weight="QInt8", per_channel=True),
}


def quantize(src, dst, weight="QUInt8", per_channel=False):
    from onnxruntime.quantization import QuantType, quantize_dynamic
    quantize_dynamic(src, dst, weight_type=getattr(QuantType, weight), per_channel=per_channel)
    return dst


def ids_fa(text, cfg):
    from piper_phonemize import phonemize_espeak, phoneme_ids_espeak
    out = []
    for sent in phonemize_espeak(text, cfg["espeak"]["voice"]):
        out += phoneme_ids_espeak(sent)
    return out


def ids_ckb(text, cfg):
    import unicodedata
    pm = cfg["phoneme_id_map"]
    seq = [pm["^"][0], pm["_"][0]]
    for ch in unicodedata.normalize("NFD", text):
        if ch in pm:
            seq += [pm[ch][0], pm["_"][0]]
    return seq + [pm["$"][0]]


def run(sess, ids, cfg, natural):
    inf = cfg.get("inference", {})
    ns, ls, nw = inf.get("noise_scale", .667), inf.get("length_scale", 1.0), inf.get("noise_w", .8)
    if not natural:
        ns = nw = 0.0
    feeds = {"input": np.array([ids], dtype=np.int64), "input_lengths": np.array([len(ids)], dtype=np.int64),
             "scales": np.array([ns, ls, nw], dtype=np.float32)}
    if cfg.get("num_speakers", 1) > 1:
        feeds["sid"] = np.array([0], dtype=np.int64)
    if natural:
        np.random.seed(7)
    return sess.run(None, feeds)[0].squeeze().astype(np.float32)


def logmel(a, sr, n_fft=1024, hop=256, n_mels=80):
    if len(a) < n_fft:
        a = np.pad(a, (0, n_fft - len(a)))
    frames = np.lib.stride_tricks.sliding_window_view(a, n_fft)[::hop] * np.hanning(n_fft)
    spec = np.abs(np.fft.rfft(frames, axis=1)) ** 2
    hz = lambda m: 700 * (10 ** (m / 2595) - 1)
    mel = lambda f: 2595 * np.log10(1 + f / 700)
    pts = hz(np.linspace(mel(0), mel(sr / 2), n_mels + 2))
    bins = np.floor((n_fft + 1) * pts / sr).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for m in range(1, n_mels + 1):
        l, c, r = bins[m - 1], bins[m], bins[m + 1]
        if c > l: fb[m - 1, l:c] = (np.arange(l, c) - l) / (c - l)
        if r > c: fb[m - 1, c:r] = (r - np.arange(c, r)) / (r - c)
    return 10 * np.log10(spec @ fb.T + 1e-10)


def mel_distance_db(a, b, sr):
    """RMS log-mel difference after DTW alignment. Without alignment a 2 % duration change shifts
    late frames by several hops and the 'distance' measures timing, not timbre."""
    A, B = logmel(a, sr), logmel(b, sr)
    floor = max(A.max(), B.max()) - 60
    A, B = np.maximum(A, floor), np.maximum(B, floor)
    D = np.sqrt(((A[:, None, :] - B[None, :, :]) ** 2).mean(axis=2))
    n, m = D.shape
    C = np.full((n + 1, m + 1), np.inf); C[0, 0] = 0
    for i in range(1, n + 1):
        Ci, Cp, Di = C[i], C[i - 1], D[i - 1]
        for j in range(1, m + 1):
            Ci[j] = Di[j - 1] + min(Cp[j], Ci[j - 1], Cp[j - 1])
    i, j, path = n, m, []
    while i > 0 and j > 0:
        path.append(D[i - 1, j - 1])
        k = int(np.argmin([C[i - 1, j - 1], C[i - 1, j], C[i, j - 1]]))
        i, j = (i - 1, j - 1) if k == 0 else (i - 1, j) if k == 1 else (i, j - 1)
    return float(np.mean(path))


def save_wav(path, a, sr):
    a = a / (np.abs(a).max() or 1) * 0.9
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def gz_mb(path):
    buf = io.BytesIO()
    with open(path, "rb") as f, gzip.GzipFile(fileobj=buf, mode="wb", compresslevel=6) as g:
        g.write(f.read())
    return buf.tell() / 1e6


def check():
    os.makedirs(OUT, exist_ok=True)
    langs = {
        "fa": (os.path.join(CACHE, "fa_IR-amir-medium.onnx"), os.path.join(CACHE, "fa_IR-amir-medium.onnx.json"), FA_TEXTS, ids_fa),
        "ckb": (os.path.join(CACHE, "vekol.onnx"), os.path.join(CACHE, "vekol.onnx.json"), CKB_TEXTS, ids_ckb),
    }
    report = {}
    for lang, (src, cfgp, texts, idf) in langs.items():
        cfg = json.load(open(cfgp, encoding="utf-8"))
        sr = cfg["audio"]["sample_rate"]
        base = ort.InferenceSession(src, providers=["CPUExecutionProvider"])
        r = report[lang] = {"fp32_mb": os.path.getsize(src) / 1e6, "fp32_gz_mb": gz_mb(src)}
        ref_det, ref_nat = [], []
        for i, t in enumerate(texts):
            ids = idf(t, cfg)
            ref_det.append(run(base, ids, cfg, False))
            a = run(base, ids, cfg, True); ref_nat.append(a)
            save_wav(os.path.join(OUT, f"{lang}_{i + 1}_original.wav"), a, sr)
        # baseline: two natural renders of the ORIGINAL (different sampler seeds) differ by this much
        # already, and listeners hear both as "the same voice"
        def nat(seed, ids):
            np.random.seed(seed)
            inf = cfg.get("inference", {})
            feeds = {"input": np.array([ids], dtype=np.int64), "input_lengths": np.array([len(ids)], dtype=np.int64),
                     "scales": np.array([inf.get("noise_scale", .667), inf.get("length_scale", 1.0), inf.get("noise_w", .8)], dtype=np.float32)}
            if cfg.get("num_speakers", 1) > 1:
                feeds["sid"] = np.array([0], dtype=np.int64)
            return base.run(None, feeds)[0].squeeze().astype(np.float32)
        r["baseline_two_original_renders_db"] = [round(mel_distance_db(nat(1, idf(t, cfg)), nat(2, idf(t, cfg)), sr), 2) for t in texts]
        r["original_det_vs_natural_db"] = [round(mel_distance_db(ref_det[i], ref_nat[i], sr), 2) for i in range(len(texts))]
        for name, kw in VARIANTS.items():
            dst = os.path.join(OUT, f"{lang}_{name}.onnx")
            quantize(src, dst, **kw)
            q = ort.InferenceSession(dst, providers=["CPUExecutionProvider"])
            durs, dists = [], []
            for i, t in enumerate(texts):
                ids = idf(t, cfg)
                d = run(q, ids, cfg, False)
                durs.append(len(d) / max(1, len(ref_det[i])))
                dists.append(mel_distance_db(ref_det[i], d, sr))
                save_wav(os.path.join(OUT, f"{lang}_{i + 1}_{name}.wav"), run(q, ids, cfg, True), sr)
            r[name] = {"mb": os.path.getsize(dst) / 1e6, "gz_mb": gz_mb(dst),
                       "duration_ratio": [round(x, 3) for x in durs], "mel_dist_db": [round(x, 2) for x in dists]}
    json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    {"check": check}[sys.argv[1] if len(sys.argv) > 1 else "check"]()
