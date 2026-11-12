"""Download the podcast's voices and the QC recogniser into $PODCAST_MODELS (CI caches the folder).

  fa   Piper fa_IR ganji_adabi        (k2-fsa/sherpa-onnx GitHub release, tts-models)
  ar   Piper ar_JO kareem             (same)
  en   Kokoro en v0.19, voice af_bella (same)
  ckb  Vekol-TTS edge (RevgeAI, Hugging Face) — the same voice the site's reader uses; full-precision model,
       pinned to the size and SHA-256 that scripts/fetch_tts.py pins
  qc   Whisper large-v3-turbo int8    (k2-fsa/sherpa-onnx GitHub release, asr-models)
"""
import hashlib
import os
import subprocess
import sys
import tarfile
import urllib.request

MODELS = os.environ.get("PODCAST_MODELS", os.path.expanduser("~/podcast-models"))
GH = "https://github.com/k2-fsa/sherpa-onnx/releases/download"
TARS = ["tts-models/vits-piper-fa_IR-ganji_adabi-medium", "tts-models/vits-piper-ar_JO-kareem-medium",
        "tts-models/kokoro-en-v0_19", "asr-models/sherpa-onnx-whisper-turbo"]
HF = "https://huggingface.co/RevgeAI/vekol-tts-ckb-edge/resolve/main"
VEKOL = [("model.onnx", 77071526, "92a30317e6e9a5bf7f61cca4e6f37d7ecff495677169e83e085757760c033f39"),
         ("model.onnx.json", 1690, "fb13ff182624e8519979b44dcc178634a29ef6bb55bb718368b1fc678601cba1")]


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def get(url, dst):
    subprocess.run(["curl", "-sSfL", "--retry", "4", "--retry-delay", "5", "--max-time", "1800", "-o", dst, url], check=True)


def main():
    os.makedirs(MODELS, exist_ok=True)
    for n in TARS:
        name = os.path.basename(n)
        if os.path.isdir(os.path.join(MODELS, name)):
            print("cached", name); continue
        tmp = os.path.join(MODELS, name + ".tar.bz2")
        get(f"{GH}/{n}.tar.bz2", tmp)
        with tarfile.open(tmp) as t:
            t.extractall(MODELS, filter="data")
        os.remove(tmp)
        print("got", name)
    d = os.path.join(MODELS, "vekol")
    os.makedirs(d, exist_ok=True)
    for f, size, digest in VEKOL:
        dst = os.path.join(d, f)
        if not (os.path.exists(dst) and os.path.getsize(dst) == size and sha256(dst) == digest):
            get(f"{HF}/{f}", dst + ".part")
            if os.path.getsize(dst + ".part") != size or sha256(dst + ".part") != digest:
                sys.exit(f"Vekol {f}: size or digest does not match the pin")
            os.replace(dst + ".part", dst)
        print("ok vekol", f)


if __name__ == "__main__":
    main()
