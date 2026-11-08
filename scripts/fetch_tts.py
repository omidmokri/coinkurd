#!/usr/bin/env python3
"""Fetch the read-aloud voices and runtimes into tts/ so the site serves them itself.

entekhab.net's reader (assets/reader.js) speaks Persian, Sorani and English inside the visitor's
own browser: no text ever leaves the device, which keeps the privacy page's promise. Most
devices ship no Persian or Sorani voice at all (a Windows Chrome has neither), so the site
carries its own:

    tts/ort/    onnxruntime-web, the WASM engine that runs the voice models   (npm, MIT)
    tts/piper/  piper_phonemize: espeak-ng in WASM, turns Persian into phonemes (npm, MIT)
    tts/fa/     Piper fa_IR "amir" medium voice                               (rhasspy/piper-voices)
    tts/ckb/    Vekol-TTS Sorani edge voice — CC-BY-NC 4.0, credited in the UI (RevgeAI/vekol-tts-ckb-edge)

Why the site hosts them: the CSP pins connect-src to 'self', and a CDN or Hugging Face may be
unreachable for part of the audience; GitHub Pages already is reachable for them.

Nothing here is committed (see .gitignore). Both deploy workflows run this before uploading the
Pages artifact, with ~/.cache/entekhab-tts cached between runs, so the ~190 MB is downloaded once, not per deploy.
Every file is checked against a pinned size and digest; a mismatch fails loudly instead of
shipping a corrupt or swapped model. A pin of None means "not yet known": the file is accepted,
its digest is printed, and it should be pinned from that log.

Run:  python3 scripts/fetch_tts.py
"""
import hashlib
import io
import json
import os
import shutil
import sys
import tarfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tts")
# download cache, OUTSIDE the repo: the Pages artifact uploads "." and must not carry a second copy
DL = os.environ.get("TTS_CACHE") or os.path.expanduser("~/.cache/entekhab-tts")

HF = "https://huggingface.co"
NPM = "https://registry.npmjs.org"

ORT_VER = "1.31.1"
PIPER_WASM_VER = "1.0.0"

# (cache name, url, size in bytes or None, (algo, digest) or None)
# npm pins were cross-checked against the registry's own sha512 integrity on 2026-11-08.
FILES = [
    ("fa_IR-amir-medium.onnx",
     f"{HF}/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx",
     63531379, ("md5", "7c0598c9726427869e1e86447b333539")),
    ("fa_IR-amir-medium.onnx.json",
     f"{HF}/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium/fa_IR-amir-medium.onnx.json",
     4958, ("md5", "48c5e81f5aa4e1c5eba3dda0be403b58")),
    ("fa_IR-amir-medium.MODEL_CARD",
     f"{HF}/rhasspy/piper-voices/resolve/main/fa/fa_IR/amir/medium/MODEL_CARD",
     None, None),
    ("vekol.onnx",
     f"{HF}/RevgeAI/vekol-tts-ckb-edge/resolve/main/model.onnx",
     None, None),
    ("vekol.onnx.json",
     f"{HF}/RevgeAI/vekol-tts-ckb-edge/resolve/main/model.onnx.json",
     None, None),
    (f"onnxruntime-web-{ORT_VER}.tgz",
     f"{NPM}/onnxruntime-web/-/onnxruntime-web-{ORT_VER}.tgz",
     34586352, ("sha256", "bdccdb9fbb9ab537247c0c734e9b1d2b1b338b4f2a09faa58f0dc1cfa27c312c")),
    (f"piper-wasm-{PIPER_WASM_VER}.tgz",
     f"{NPM}/@diffusionstudio/piper-wasm/-/piper-wasm-{PIPER_WASM_VER}.tgz",
     9204429, ("sha256", "e5be7f15b3ec42b09fca3616db2ce3e2cf83faacc9c291c400ccf48a9d85c803")),
]

# what ends up served, as (cache name or tgz member, served path)
PLACE = {
    "fa_IR-amir-medium.onnx": "fa/amir.onnx",
    "fa_IR-amir-medium.onnx.json": "fa/amir.onnx.json",
    "fa_IR-amir-medium.MODEL_CARD": "fa/MODEL_CARD.txt",
    "vekol.onnx": "ckb/vekol.onnx",
    "vekol.onnx.json": "ckb/vekol.onnx.json",
}
TGZ = {
    f"onnxruntime-web-{ORT_VER}.tgz": {
        "package/dist/ort.wasm.min.mjs": "ort/ort.wasm.min.mjs",
        "package/dist/ort-wasm-simd-threaded.mjs": "ort/ort-wasm-simd-threaded.mjs",
        "package/dist/ort-wasm-simd-threaded.wasm": "ort/ort-wasm-simd-threaded.wasm",
    },
    f"piper-wasm-{PIPER_WASM_VER}.tgz": {
        "package/build/piper_phonemize.js": "piper/piper_phonemize.js",
        "package/build/piper_phonemize.wasm": "piper/piper_phonemize.wasm",
        "package/build/piper_phonemize.data": "piper/piper_phonemize.data",
    },
}


def _digest(path, algo):
    h = hashlib.new(algo)
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _ok(path, size, pin):
    if not os.path.exists(path):
        return False
    if size is not None and os.path.getsize(path) != size:
        return False
    if pin is not None and _digest(path, pin[0]) != pin[1]:
        return False
    return True


def fetch(name, url, size, pin):
    dst = os.path.join(DL, name)
    if _ok(dst, size, pin):
        print(f"  cached  {name}")
        return dst
    print(f"  fetch   {name}  <- {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "entekhab-site-build"})
    tmp = dst + ".part"
    with urllib.request.urlopen(req, timeout=300) as r, open(tmp, "wb") as f:
        shutil.copyfileobj(r, f, 1 << 20)
    got = os.path.getsize(tmp)
    if size is not None and got != size:
        os.remove(tmp)
        sys.exit(f"SIZE MISMATCH {name}: expected {size}, got {got}")
    if pin is not None:
        d = _digest(tmp, pin[0])
        if d != pin[1]:
            os.remove(tmp)
            sys.exit(f"DIGEST MISMATCH {name}: expected {pin[0]} {pin[1]}, got {d}")
    os.replace(tmp, dst)
    if pin is None:
        print(f"  UNPINNED {name}: size={got} sha256={_digest(dst, 'sha256')}  <- pin this")
    return dst


def main():
    os.makedirs(DL, exist_ok=True)
    print("tts: fetching voices and runtimes")
    for name, url, size, pin in FILES:
        fetch(name, url, size, pin)

    for name, rel in PLACE.items():
        dst = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(DL, name), dst)

    for tgz, members in TGZ.items():
        with tarfile.open(os.path.join(DL, tgz), "r:gz") as t:
            for member, rel in members.items():
                dst = os.path.join(OUT, rel)
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                src = t.extractfile(member)
                if src is None:
                    sys.exit(f"MISSING {member} in {tgz}")
                with open(dst, "wb") as f:
                    shutil.copyfileobj(src, f)

    # sanity: the two voice configs must be the shapes reader.js expects
    fa = json.load(open(os.path.join(OUT, "fa/amir.onnx.json"), encoding="utf-8"))
    ck = json.load(open(os.path.join(OUT, "ckb/vekol.onnx.json"), encoding="utf-8"))
    assert fa["espeak"]["voice"] == "fa", fa["espeak"]
    assert ck.get("phoneme_type") == "text" and "phoneme_id_map" in ck, "vekol config changed shape"

    # the manifest reader.js reads for sizes (shown in the one-time download prompt) and versions
    def sz(rel):
        return os.path.getsize(os.path.join(OUT, rel))
    manifest = {
        "ort": {"base": "/tts/ort/", "bytes": sz("ort/ort-wasm-simd-threaded.wasm") + sz("ort/ort.wasm.min.mjs")
                + sz("ort/ort-wasm-simd-threaded.mjs"), "version": ORT_VER},
        "fa": {"model": "/tts/fa/amir.onnx", "config": "/tts/fa/amir.onnx.json",
               "bytes": sz("fa/amir.onnx") + sz("piper/piper_phonemize.data") + sz("piper/piper_phonemize.wasm"),
               "voice": "Piper fa_IR amir (medium)"},
        "ckb": {"model": "/tts/ckb/vekol.onnx", "config": "/tts/ckb/vekol.onnx.json",
                "bytes": sz("ckb/vekol.onnx"), "voice": "Vekol-TTS by Revge (CC BY-NC 4.0)"},
        "piper": {"js": "/tts/piper/piper_phonemize.js", "wasm": "/tts/piper/piper_phonemize.wasm",
                  "data": "/tts/piper/piper_phonemize.data"},
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    print("tts: model card for the Persian voice:")
    print(open(os.path.join(OUT, "fa/MODEL_CARD.txt"), encoding="utf-8", errors="replace").read())
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f"tts: served total {total / 1e6:.1f} MB")
    print("tts: manifest", json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()
