"""Speech synthesis for the daily podcast.

Backends
  piper   Piper/VITS voices run with sherpa-onnx (offline, open licences). Default for fa / ar / tr.
  kokoro  Kokoro-82M (Apache-2.0) run with sherpa-onnx. Default for en.

Every voice is a folder under MODELS (downloaded from the k2-fsa/sherpa-onnx GitHub release
"tts-models"); nothing is fetched at synthesis time.
"""
import glob
import os
import subprocess

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


# ---------------------------------------------------------------- Pocket-TTS, the 2026 Persian reading
# Why this is here. Every Piper Persian voice is a man's and all of them read like a machine; the owner heard
# the older open voices and rejected them, and he was right to - a reading can score well for intelligibility
# and still be unpleasant to listen to, which is the thing the error rate cannot measure.
#
# This model clones a voice from a short clip and runs on the processor, so the daily job needs no graphics
# card. Two things about it are easy to get wrong and both fail quietly:
#   * it does NOT read Persian script. Handed Persian letters it maps each to the unknown token and emits
#     end-of-speech at once, producing silence with no error at all. The text goes through the author's own
#     grapheme-to-phoneme model first.
#   * the reference clip must be five seconds or less. Longer, and the model reads on from the clip's own
#     words instead of the text it was given - fluent, in the right voice, and not what you asked for.
# Its licence is cc-by-nc-4.0, which the owner has decided fits this site's non-commercial use.
POCKET_REPO = "mehdi-hf/pocket-tts-farsi-v2"
POCKET_G2P = "mehdi-hf/Homo-GE2PE-Persian-HF"
POCKET_PHONEMES = str.maketrans({"/": "a", "a": "A", "@": "?", "$": "S", "c": "C"})
POCKET_PROMPT_SECONDS = 5.0
POCKET_CHUNK_CHARS = 70          # past about 21 tokens generations stop terminating and repeat themselves
POCKET_PAUSE = 0.25


def _pocket_bits():
    if "pocket_bits" not in _cache:
        import importlib.util
        import torch
        from huggingface_hub import hf_hub_download
        from transformers import AutoTokenizer, T5ForConditionalGeneration
        spec = importlib.util.spec_from_file_location("normalize_fa", hf_hub_download(POCKET_REPO, "normalize_fa.py"))
        norm = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(norm)
        _cache["pocket_bits"] = (torch, AutoTokenizer.from_pretrained(POCKET_G2P),
                                 T5ForConditionalGeneration.from_pretrained(POCKET_G2P).eval(), norm)
    return _cache["pocket_bits"]


def pocket_phonemise(text):
    """Persian script -> the romanised phonemes this model reads, by its author's own recipe."""
    torch, tok, g2p, norm = _pocket_bits()
    text = norm.normalize_for_model(text)        # without this the G2P drops digits and the figure vanishes
    text = text.replace("\u061f", "").replace("?", "")   # that mark would otherwise become a glottal stop
    enc = tok([text], add_special_tokens=False, return_tensors="pt")
    with torch.no_grad():
        out = g2p.generate(**enc, num_beams=5, max_length=512, early_stopping=True)
    raw = tok.batch_decode(out, skip_special_tokens=True)[0].strip()
    return raw.translate(POCKET_PHONEMES).replace("1", "")   # the 1 marks the ezafe and is not for the model


def _pocket_chunks(ph):
    words, out, cur = ph.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > POCKET_CHUNK_CHARS:
            out.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        out.append(cur)
    return out


def _pocket_state(prompt_path):
    key = ("pocket_state", prompt_path)
    if key not in _cache:
        from pocket_tts import TTSModel
        if "pocket_model" not in _cache:
            _cache["pocket_model"] = TTSModel.load_model(POCKET_REPO)
        model = _cache["pocket_model"]
        cut = os.path.join(os.path.dirname(prompt_path), ".prompt5.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", prompt_path, "-t", str(POCKET_PROMPT_SECONDS), cut],
                       check=True)
        _cache[key] = model.get_state_for_audio_prompt(cut)
    return _cache["pocket_model"], _cache[key]


def synth_pocket(text, prompt_path):
    model, state = _pocket_state(prompt_path)
    sr = model.sample_rate
    gap = np.zeros(int(POCKET_PAUSE * sr), dtype=np.float32)
    parts = []
    for piece in _pocket_chunks(pocket_phonemise(text)):
        a = model.generate_audio(state, piece).numpy().astype(np.float32).reshape(-1)
        cap = len(piece.split()) * 1.1 + 3.0     # a generation that never stops runs to the cap and repeats
        if len(a) / sr > cap:
            a = model.generate_audio(state, piece).numpy().astype(np.float32).reshape(-1)
        parts.append(a)
        parts.append(gap)
    if not parts:
        raise RuntimeError("pocket-tts: the phoneme stage produced nothing to read")
    return np.concatenate(parts[:-1]), sr


def synth(text, lang=None, voice=None):
    """Return (float32 mono samples, sample_rate) for one sentence or short paragraph."""
    v = dict(VOICES[lang]) if voice is None else voice
    if v.get("backend") == "pocket":
        return synth_pocket(text, v["prompt"])
    tts = _engine(v["backend"], v["folder"])
    a = tts.generate(text, sid=v.get("sid", 0), speed=v.get("speed", 1.0))
    return np.asarray(a.samples, dtype=np.float32), a.sample_rate
