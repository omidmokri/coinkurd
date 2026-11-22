#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Find a Persian woman's voice for the morning report, by measurement rather than by a model card's word.

Why this exists. Every Persian voice the podcast can already use is a man's: the official Piper set is amir,
ganji, ganji_adabi, gyro and reza_ibrahim, and all five are male. The owner asked for a woman reading the
morning report and a man reading the evening one, so a voice has to come from somewhere else. Two things then
have to be settled before a voice goes anywhere near the channel, and neither can be taken on trust:

  is it really a woman's voice   model cards are written by hand and get this wrong — one of the candidates
                                 below is described as a female voice and in the same breath says it was
                                 trained on the male dataset. So the reading is measured: the median
                                 fundamental frequency of the voiced frames. The owner's own two samples read
                                 195.1 Hz (woman) and 113.5 Hz (man), which is the scale used here.
  can it be understood           the podcast already holds a version back when a listener cannot follow it, by
                                 transcribing the audio and measuring the error against the script. The same
                                 test runs here, so a new voice is judged exactly as the present ones were.

Nothing is installed into the daily job by running this: it writes a report and stops. Choosing a voice stays a
decision for a person to make from the numbers.

    python3 scripts/podcast/voicetest.py --out /tmp/voices        # all candidates
    python3 scripts/podcast/voicetest.py --only female-vits
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# The sentences are the podcast's own: the opening it reads every day, a line thick with figures (where a weak
# voice falls apart), and the weather paragraph the owner sent, which is plain prose for comparison.
SENTENCES = [
    "سلام و وقت بخیر. اینجا «نبض کریپتو» است؛ گزارشِ روزانه‌یِ بازارِ رمزارزها از انتخاب دات نت.",
    "بیت‌کوین با ثبت پنجاه و نه هزار و سیصد و پنج دلار و چهار و چهار دهم درصد رشد در بیست و چهار ساعت گذشته معامله می‌شود.",
    "بر اساس گزارش سازمان هواشناسی، بارش باران و برف در بیشتر استان‌های شمالی و غربی کشور تا پایان هفته ادامه خواهد داشت.",
]

# Each candidate says where it comes from and under what terms, because the licence decides whether it may be
# used at all. "coqui" models are PyTorch and run on the processor; no graphics card is involved.
CANDIDATES = [
    # The 2022-23 Coqui models were measured first. They scored well for intelligibility and the owner found them
    # unusable by ear: a reading can be perfectly clear and still sound like a machine, which CER does not catch.
    # They stay in the list so the comparison keeps its floor, but the ones that matter are below.
    dict(key="female-vits", repo="Kamtera/persian-tts-female-vits", kind="coqui",
         licence="openrail", note="2023 VITS; clear but mechanical, rejected by ear"),
    dict(key="female1-vits", repo="Kamtera/persian-tts-female1-vits", kind="coqui",
         licence="unknown", note="2023 VITS; clearest of the old set, still rejected by ear"),
    # A newer Persian VITS, trained on the Piper base model. It ships ONNX, which is what the podcast already
    # runs through sherpa-onnx, and it has seven speakers, so each is read and measured on its own.
    dict(key="alifthi", repo="alifthi/persian-TTS", kind="piper-onnx", speakers=7,
         licence="see model card; trained only on data allowing commercial use", note="2026 VITS, Piper ONNX"),
    # The newest of them, and the one the owner's ear is most likely to accept: a 2026 model with voice cloning
    # that runs on the processor. Its own repository carries the reference clips, one woman and one man, so the
    # morning and evening readings come from the same model without anyone's voice being borrowed.
    dict(key="pocket-woman", repo="mehdi-hf/pocket-tts-farsi-v2", kind="pocket",
         prompt="samples/prompt_hello.wav", licence="cc-by-nc-4.0",
         note="2026 Pocket-TTS, 109M, woman's reference clip"),
    dict(key="pocket-man", repo="mehdi-hf/pocket-tts-farsi-v2", kind="pocket",
         prompt="samples/prompt_news_paragraph.wav", licence="cc-by-nc-4.0",
         note="2026 Pocket-TTS, 109M, man's reference clip"),
]


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw).stdout


def f0_median(wav_path):
    """Median fundamental frequency over the voiced frames — the pitch a listener hears as the speaker's range."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", wav_path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, "<i2").astype(np.float64) / 32768.0
    sr, w, hop, out = 16000, 640, 160, []
    for i in range(0, max(0, len(x) - w), hop):
        fr = x[i:i + w]
        if np.sqrt(np.mean(fr ** 2)) < 0.02:
            continue
        fr = fr - fr.mean()
        c = np.correlate(fr, fr, "full")[w - 1:]
        if c[0] <= 0:
            continue
        c = c / c[0]
        a, b = sr // 400, sr // 60
        if b >= len(c):
            continue
        seg = c[a:b]
        k = int(np.argmax(seg))
        if seg[k] < 0.35:
            continue
        out.append(sr / (a + k))
    return float(np.median(out)) if out else 0.0, len(out)


def reads_as(hz):
    """The owner's own samples: 195.1 Hz for the woman, 113.5 Hz for the man. The gap between them is wide,
    so a voice landing in the middle is reported as unclear rather than guessed at."""
    if not hz:
        return "no voiced speech found"
    if hz >= 165:
        return "a woman's range"
    if hz <= 145:
        return "a man's range"
    return "between the two — listen before deciding"


def synth_coqui(repo, text, out_wav, cache):
    """Read one sentence with a Coqui model from Hugging Face, on the processor."""
    from TTS.utils.synthesizer import Synthesizer
    from huggingface_hub import hf_hub_download

    key = repo.replace("/", "__")
    if key not in cache:
        files = json.loads(sh(["python3", "-c",
                               "import json,huggingface_hub as h;print(json.dumps([f.rfilename for f in "
                               f"h.HfApi().model_info('{repo}', files_metadata=False).siblings]))"]))
        ckpt = next((f for f in files if f.endswith(".pth") and "checkpoint" in f.lower()), None) \
            or next((f for f in files if f.endswith(".pth")), None)
        cfg = next((f for f in files if f.endswith("config.json")), None)
        if not ckpt or not cfg:
            raise RuntimeError(f"{repo}: no checkpoint and config pair among {files[:12]}")
        # current coqui-tts takes these by name only
        cache[key] = Synthesizer(tts_checkpoint=hf_hub_download(repo, ckpt),
                                 tts_config_path=hf_hub_download(repo, cfg), use_cuda=False)
    wav = cache[key].tts(text)
    cache[key].save_wav(wav, out_wav)


# ---------------------------------------------------------------- Pocket-TTS (Persian), read on the processor
# This model does NOT take Persian script. Handed Persian letters it maps every one to the unknown token and
# emits end-of-speech at once: silence, with no error raised. So the text goes through a grapheme-to-phoneme
# stage first, and the notation its author specifies is followed exactly. Everything below is from the model
# card, not guessed: the translation table, dropping the question mark before G2P (that mark otherwise becomes
# a glottal stop nobody said), stripping the ezafe marker when driving the model directly, the five-second cap
# on the voice prompt, and splitting long text into short chunks because generations stop terminating past
# about 21 tokens.
G2P_REPO = "mehdi-hf/Homo-GE2PE-Persian-HF"
TO_PHONEMES = str.maketrans({"/": "a", "a": "A", "@": "?", "$": "S", "c": "C"})
PROMPT_SECONDS = 5.0          # longer and the model continues the prompt's own words instead of yours
CHUNK_CHARS = 70              # keeps a chunk inside the band where generations terminate
PAUSE = 0.25                  # seconds of silence joining the chunks


def _pocket_g2p(cache, repo):
    if "g2p" not in cache:
        import torch
        from transformers import AutoTokenizer, T5ForConditionalGeneration
        from huggingface_hub import hf_hub_download
        import importlib.util
        norm_path = hf_hub_download(repo, "normalize_fa.py")      # the author's own normaliser, shipped with the model
        spec = importlib.util.spec_from_file_location("normalize_fa", norm_path)
        norm = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(norm)
        tok = AutoTokenizer.from_pretrained(G2P_REPO)
        g2p = T5ForConditionalGeneration.from_pretrained(G2P_REPO).eval()
        cache["g2p"] = (torch, tok, g2p, norm)
    return cache["g2p"]


def phonemise(text, cache, repo):
    torch, tok, g2p, norm = _pocket_g2p(cache, repo)
    text = norm.normalize_for_model(text)          # spells numbers out; G2P drops digits silently without this
    text = text.replace("\u061f", "").replace("?", "")
    enc = tok([text], add_special_tokens=False, return_tensors="pt")
    with torch.no_grad():
        out = g2p.generate(**enc, num_beams=5, max_length=512, early_stopping=True)
    raw = tok.batch_decode(out, skip_special_tokens=True)[0].strip()
    # the "1" marks the ezafe and is for a chunker to read; the model itself must not see it
    return raw.translate(TO_PHONEMES).replace("1", "")


def _chunks(ph):
    """Short pieces, cut on word boundaries. Long chunks run away and repeat themselves."""
    words, out, cur = ph.split(), [], ""
    for w in words:
        if cur and len(cur) + 1 + len(w) > CHUNK_CHARS:
            out.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        out.append(cur)
    return out


def synth_pocket(repo, prompt_file, text, out_wav, cache):
    import numpy as np
    import soundfile as sf
    from huggingface_hub import hf_hub_download
    from pocket_tts import TTSModel

    key = "pocket::" + repo
    if key not in cache:
        cache[key] = TTSModel.load_model(repo)
    model = cache[key]

    pk = "prompt::" + repo + prompt_file
    if pk not in cache:
        raw = hf_hub_download(repo, prompt_file)
        cut = os.path.join(os.path.dirname(raw), "prompt5.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-t", str(PROMPT_SECONDS), cut], check=True)
        cache[pk] = model.get_state_for_audio_prompt(cut)
    state = cache[pk]

    sr = model.sample_rate
    parts, gap = [], np.zeros(int(PAUSE * sr), dtype=np.float32)
    for piece in _chunks(phonemise(text, cache, repo)):
        audio = model.generate_audio(state, piece)
        a = audio.numpy().astype(np.float32).reshape(-1)
        # a generation that never stops runs to the cap and repeats itself; one retry usually terminates
        cap = len(piece.split()) * 1.1 + 3.0
        if len(a) / sr > cap:
            a = model.generate_audio(state, piece).numpy().astype(np.float32).reshape(-1)
        parts.append(a)
        parts.append(gap)
    if not parts:
        raise RuntimeError("the phoneme stage produced nothing to read")
    sf.write(out_wav, np.concatenate(parts[:-1]), sr)


def _piper_tokens():
    """The symbol table that ships with a Piper voice already on this machine."""
    import glob
    roots = [os.environ.get("PODCAST_MODELS", "/home/claude/models"), "/home/claude/models"]
    for r in roots:
        for d in sorted(glob.glob(os.path.join(r, "vits-piper-*"))):
            t = os.path.join(d, "tokens.txt")
            if os.path.exists(t):
                return t
    return ""


def _espeak_dir():
    """The espeak-ng data that ships with the podcast's own voices, wherever it already sits."""
    import glob
    roots = [os.environ.get("PODCAST_MODELS", "/home/claude/models"), "/home/claude/models"]
    for r in roots:
        hits = glob.glob(os.path.join(r, "vits-piper-*", "espeak-ng-data")) or \
                glob.glob(os.path.join(r, "*", "espeak-ng-data"))
        if hits:
            return hits[0]
    return ""


def _with_metadata(model_path, conf):
    """Write the values sherpa-onnx reads into a copy of the ONNX file, taken from the voice's config.json."""
    import onnx
    audio = conf.get("audio") or {}
    inference = conf.get("inference") or {}
    want = {"model_type": "vits",
            "sample_rate": str(audio.get("sample_rate") or conf.get("sample_rate") or 22050),
            "add_blank": "1" if conf.get("add_blank", True) else "0",
            "n_speakers": str(conf.get("num_speakers") or 1),
            "comment": "piper",
            "language": (conf.get("espeak") or {}).get("voice") or conf.get("language") or "fa",
            "voice": (conf.get("espeak") or {}).get("voice") or "fa",
            "noise_scale": str(inference.get("noise_scale", 0.667)),
            "length_scale": str(inference.get("length_scale", 1.0)),
            "noise_w": str(inference.get("noise_w", 0.8))}
    m = onnx.load(model_path)
    have = {p.key for p in m.metadata_props}
    if "sample_rate" in have:
        return model_path, {"already": "the file carried its own metadata"}
    for k, v in want.items():
        if k not in have:
            e = m.metadata_props.add()
            e.key, e.value = k, str(v)
    out = model_path.replace(".onnx", ".meta.onnx")
    onnx.save(m, out)
    return out, want


def synth_piper_onnx(repo, sid, text, out_wav, cache):
    """Read one sentence with a Piper-format ONNX voice, through sherpa-onnx — the very runtime the podcast
    already uses, so a voice that works here needs nothing new added to the daily job."""
    import sherpa_onnx
    import soundfile as sf
    from huggingface_hub import hf_hub_download

    key = repo.replace("/", "__")
    if key not in cache:
        files = json.loads(sh(["python3", "-c",
                               "import json,huggingface_hub as h;print(json.dumps([f.rfilename for f in "
                               f"h.HfApi().model_info('{repo}').siblings]))"]))
        onnx = next((f for f in files if f.endswith(".onnx") and "onnx/" in f), None) \
            or next((f for f in files if f.endswith(".onnx")), None)
        tokens = next((f for f in files if f.endswith("tokens.txt")), None)
        cfg = next((f for f in files if f.endswith(".onnx.json")), None) \
            or next((f for f in files if f.rsplit("/", 1)[-1] == "config.json"), None)
        if not onnx:
            raise RuntimeError(f"{repo}: no .onnx among {files[:14]}")
        model = hf_hub_download(repo, onnx)
        data_dir = ""
        tok = hf_hub_download(repo, tokens) if tokens else ""
        if not tok:
            # sherpa-onnx reads a Piper symbol table of SINGLE characters only: handed "aɪ 161" it stops with
            # "Error when reading tokens". The table that ships with the podcast's own Piper voice is the one it
            # accepts, and this voice is a fine-tune of the same Piper base, so it shares that table. If the two
            # ever disagreed the reading would come out as nonsense, and the CER below is what would show it.
            tok = _piper_tokens()
        if not tok and cfg:
            conf = json.load(open(hf_hub_download(repo, cfg), encoding="utf-8"))
            ids = conf.get("phoneme_id_map") or {}
            if ids:
                tok = os.path.join(os.path.dirname(model), "tokens.txt")
                with open(tok, "w", encoding="utf-8") as fh:
                    for sym, n in sorted(ids.items(), key=lambda kv: kv[1][0]):
                        if len(sym) == 1:
                            fh.write(f"{sym} {n[0]}\n")
        # A plain Piper export carries none of the metadata sherpa-onnx reads ("'sample_rate' does not exist in
        # the metadata"), so it is written in from the voice's own config.json. Nothing is invented: every value
        # comes from that file.
        meta = {}
        if cfg:
            conf = json.load(open(hf_hub_download(repo, cfg), encoding="utf-8"))
            model, meta = _with_metadata(model, conf)
        cache[key + "::meta"] = meta
        # A Piper voice speaks through espeak-ng. The podcast's own Persian voices ship that data, so it is
        # borrowed from whichever of them is already on the machine rather than fetched again.
        data_dir = _espeak_dir()
        if not data_dir:
            raise RuntimeError("espeak-ng data not found beside the podcast's voices; cannot read Piper phonemes")
        mc = sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=model, lexicon="", tokens=tok, data_dir=data_dir),
            num_threads=2, provider="cpu")
        cache[key] = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=mc, max_num_sentences=1))
    a = cache[key].generate(text, sid=sid, speed=1.0)
    n = len(a.samples) if a.samples is not None else 0
    if n == 0 or not a.sample_rate:
        # soundfile would only say "Internal" here. Say what actually came back, and what the engine was told,
        # so one run is enough to see whether the fault is the voice, the speaker number or the phonemes.
        raise RuntimeError(f"the engine returned {n} samples at {a.sample_rate} Hz for speaker {sid}; "
                           f"metadata written: {cache.get(key + '::meta')}")
    sf.write(out_wav, a.samples, a.sample_rate)


def intelligibility(wav_path, text):
    """How much of the script a listener gets back, using the podcast's own transcriber and its own error measure."""
    try:
        import asr
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", wav_path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                             capture_output=True, check=True).stdout
        x = np.frombuffer(raw, "<i2").astype(np.float32) / 32768.0
        hyp = asr.transcribe(x, 16000, "fa")
        return round(asr.cer(text, hyp, "fa"), 3), hyp
    except Exception as exc:                      # the transcriber is heavy; a voice is still worth reporting without it
        return None, f"(not measured: {exc.__class__.__name__})"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="/tmp/voices")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cache, report = {}, []

    jobs = []
    for c in CANDIDATES:
        if a.only and c["key"] != a.only:
            continue
        # a model with several speakers is measured one speaker at a time: they are different voices
        for sid in range(c.get("speakers", 1)):
            j = dict(c)
            if c.get("speakers", 1) > 1:
                j["key"] = f"{c['key']}-s{sid}"
                j["speaker"] = sid
            jobs.append(j)

    for c in jobs:
        row = dict(c, sentences=[])
        try:
            for i, s in enumerate(SENTENCES):
                w = os.path.join(a.out, f"{c['key']}_{i}.wav")
                if c["kind"] == "piper-onnx":
                    synth_piper_onnx(c["repo"], c.get("speaker", 0), s, w, cache)
                elif c["kind"] == "pocket":
                    synth_pocket(c["repo"], c["prompt"], s, w, cache)
                else:
                    synth_coqui(c["repo"], s, w, cache)
                hz, frames = f0_median(w)
                cer, hyp = intelligibility(w, s)
                dur = float(sh(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "default=nw=1:nk=1", w]).strip())
                row["sentences"].append(dict(i=i, wav=os.path.basename(w), f0=round(hz, 1), frames=frames,
                                             reads_as=reads_as(hz), cer=cer, seconds=round(dur, 2),
                                             heard=hyp[:120] if isinstance(hyp, str) else hyp))
            hzs = [s["f0"] for s in row["sentences"] if s["f0"]]
            row["f0_median"] = round(float(np.median(hzs)), 1) if hzs else 0.0
            row["reads_as"] = reads_as(row["f0_median"])
            cers = [s["cer"] for s in row["sentences"] if s["cer"] is not None]
            row["cer_mean"] = round(sum(cers) / len(cers), 3) if cers else None
            row["ok"] = True
        except Exception as exc:
            row.update(ok=False, error=f"{exc.__class__.__name__}: {exc}")
        report.append(row)
        print(json.dumps(row, ensure_ascii=False)[:400], flush=True)

    path = os.path.join(a.out, "report.json")
    json.dump({"reference": {"owner_female_hz": 195.1, "owner_male_hz": 113.5},
               "candidates": report}, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\n" + "=" * 72)
    for r in report:
        if r.get("ok"):
            print(f"{r['key']:<14} {r['f0_median']:>6.1f} Hz  {r['reads_as']:<34} "
                  f"CER {r['cer_mean'] if r['cer_mean'] is not None else '—'}   licence {r['licence']}")
        else:
            print(f"{r['key']:<14} failed: {r['error'][:90]}")
    print(f"\nwritten to {path}")
    # A run where nothing could be read is a failed run. Reporting success would put a green tick on an empty
    # report, and the next person to look would believe the voices had been tested.
    good = [r for r in report if r.get("ok")]
    if not good:
        print("no candidate could be read; see the errors above", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
