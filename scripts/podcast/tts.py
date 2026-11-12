"""Speech synthesis for the daily podcast.

Backends
  piper   Piper/VITS voices run with sherpa-onnx (offline, open licences). Default for fa / ar / tr.
  kokoro  Kokoro-82M (Apache-2.0) run with sherpa-onnx. Default for en.

Every voice is a folder under MODELS (downloaded from the k2-fsa/sherpa-onnx GitHub release
"tts-models"); nothing is fetched at synthesis time.
"""
import glob
import os

import numpy as np

MODELS = os.environ.get("PODCAST_MODELS", "/home/claude/models")

# One coordinated but distinct voice identity per language (chosen by the intelligibility test in qc.py).
VOICES = {
    "fa": dict(backend="piper", folder="vits-piper-fa_IR-gyro-medium", sid=0, speed=1.0),
    "ar": dict(backend="piper", folder="vits-piper-ar_JO-kareem-medium", sid=0, speed=1.0),
    "tr": dict(backend="piper", folder="vits-piper-tr_TR-fahrettin-medium", sid=0, speed=1.0),
    "en": dict(backend="kokoro", folder="kokoro-en-v0_19", sid=6, speed=1.0),  # am_michael
}

_cache = {}


def _engine(backend, folder):
    import sherpa_onnx
    key = (backend, folder)
    if key in _cache:
        return _cache[key]
    d = os.path.join(MODELS, folder)
    threads = int(os.environ.get("TTS_THREADS", str(os.cpu_count() or 2)))
    if backend == "piper":
        onnx = [p for p in glob.glob(os.path.join(d, "*.onnx")) if not p.endswith(".int8.onnx")][0]
        mc = sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=onnx, lexicon="", tokens=os.path.join(d, "tokens.txt"),
                data_dir=os.path.join(d, "espeak-ng-data"),
                noise_scale=0.667, noise_scale_w=0.8, length_scale=1.0),
            num_threads=threads, provider="cpu")
    elif backend == "kokoro":
        mc = sherpa_onnx.OfflineTtsModelConfig(
            kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                model=os.path.join(d, "model.onnx"), voices=os.path.join(d, "voices.bin"),
                tokens=os.path.join(d, "tokens.txt"), data_dir=os.path.join(d, "espeak-ng-data")),
            num_threads=threads, provider="cpu")
    else:
        raise ValueError(backend)
    tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=mc, max_num_sentences=1))
    _cache[key] = tts
    return tts


def synth(text, lang=None, voice=None):
    """Return (float32 mono samples, sample_rate) for one sentence or short paragraph."""
    v = dict(VOICES[lang]) if voice is None else voice
    tts = _engine(v["backend"], v["folder"])
    a = tts.generate(text, sid=v.get("sid", 0), speed=v.get("speed", 1.0))
    return np.asarray(a.samples, dtype=np.float32), a.sample_rate
