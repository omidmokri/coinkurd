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
        if not tok and cfg:
            # Piper keeps its symbol table inside the json; sherpa-onnx wants it as a file
            conf = json.load(open(hf_hub_download(repo, cfg), encoding="utf-8"))
            ids = conf.get("phoneme_id_map") or {}
            if ids:
                tok = os.path.join(os.path.dirname(model), "tokens.txt")
                with open(tok, "w", encoding="utf-8") as fh:
                    for sym, n in sorted(ids.items(), key=lambda kv: kv[1][0]):
                        fh.write(f"{sym} {n[0]}\n")
        mc = sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=model, lexicon="", tokens=tok, data_dir=data_dir),
            num_threads=2, provider="cpu")
        cache[key] = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=mc, max_num_sentences=1))
    a = cache[key].generate(text, sid=sid, speed=1.0)
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
