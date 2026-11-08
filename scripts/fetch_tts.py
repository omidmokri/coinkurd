#!/usr/bin/env python3
"""Fetch the read-aloud voices and runtimes into tts/ so the site serves them itself.

entekhab.net's reader (assets/reader.js) speaks Persian, Sorani and English inside the visitor's
own browser: no text ever leaves the device, which keeps the privacy page's promise. Most
devices ship no Persian or Sorani voice at all (a Windows Chrome has neither), so the site
carries its own:

    tts/ort/    onnxruntime-web, the WASM engine that runs the voice models   (npm, MIT)
    tts/piper/  piper_phonemize: espeak-ng in WASM, turns Persian into phonemes (npm, MIT)
    tts/fa/     Piper fa_IR "amir" medium voice, int8                         (rhasspy/piper-voices)
    tts/ckb/    Vekol-TTS Sorani edge voice, int8 — CC-BY-NC 4.0, credited in the UI (RevgeAI/vekol-tts-ckb-edge)

Shrunk for Iranian connections (what a visitor downloads, gzip as Pages sends it):
    Persian  ~72 MB -> ~18 MB   Kurdish  ~75 MB -> ~20 MB
  - both voices are dynamically quantised to int8 (scripts/tts_quant.py, QUInt8 per-tensor). Measured
    on 2026-11-08 with DTW-aligned log-mel distance: int8 vs original 3.1-3.6 dB (fa) and 1.8-2.2 dB
    (ckb), below the 4.0-4.7 / 3.5-3.8 dB between two renders of the ORIGINAL voice itself.
  - piper_phonemize's espeak-ng data ships 113 language dictionaries (17 MB); only fa_dict is kept
    (18.1 MB -> ~1.1 MB). The Emscripten package metadata inside the loader is rewritten to match.
Every served file's byte size goes into manifest.json; the reader keys its cache on it, so a
changed file is fetched again and the stale copy is dropped from the visitor's device.

Why the site hosts them: the CSP pins connect-src to 'self', and a CDN or Hugging Face may be
unreachable for part of the audience; GitHub Pages already is reachable for them.

Nothing here is committed (see .gitignore). Both deploy workflows run this before uploading the
Pages artifact, with ~/.cache/entekhab-tts cached between runs, so the ~190 MB is downloaded once, not per deploy.
Every file is checked against a pinned size and digest; a mismatch fails loudly instead of
shipping a corrupt or swapped model. A pin of None means "not yet known": the file is accepted,
its digest is printed, and it should be pinned from that log.

Run:  python3 scripts/fetch_tts.py
"""
import gzip
import hashlib
import io
import json
import re
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
# Hugging Face pins (MODEL_CARD, Vekol) were taken from the first CI fetch on 2026-11-08.
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
     264, ("sha256", "0d7d315699945ac830162f82d485d79af51a33081a7649e8992726bd4bba2384")),
    ("vekol.onnx",
     f"{HF}/RevgeAI/vekol-tts-ckb-edge/resolve/main/model.onnx",
     77071526, ("sha256", "92a30317e6e9a5bf7f61cca4e6f37d7ecff495677169e83e085757760c033f39")),
    ("vekol.onnx.json",
     f"{HF}/RevgeAI/vekol-tts-ckb-edge/resolve/main/model.onnx.json",
     1690, ("sha256", "fb13ff182624e8519979b44dcc178634a29ef6bb55bb718368b1fc678601cba1")),
    (f"onnxruntime-web-{ORT_VER}.tgz",
     f"{NPM}/onnxruntime-web/-/onnxruntime-web-{ORT_VER}.tgz",
     34586352, ("sha256", "bdccdb9fbb9ab537247c0c734e9b1d2b1b338b4f2a09faa58f0dc1cfa27c312c")),
    (f"piper-wasm-{PIPER_WASM_VER}.tgz",
     f"{NPM}/@diffusionstudio/piper-wasm/-/piper-wasm-{PIPER_WASM_VER}.tgz",
     9204429, ("sha256", "e5be7f15b3ec42b09fca3616db2ce3e2cf83faacc9c291c400ccf48a9d85c803")),
]

# what ends up served, as (cache name or tgz member, served path)
PLACE = {
    "fa_IR-amir-medium.onnx.json": "fa/amir.onnx.json",
    "fa_IR-amir-medium.MODEL_CARD": "fa/MODEL_CARD.txt",
    "vekol.onnx.json": "ckb/vekol.onnx.json",
}
# int8 voices: (source in the download cache, served path). Quantised once, cached next to the source.
QUANT = {
    "fa_IR-amir-medium.onnx": "fa/amir.int8.onnx",
    "vekol.onnx": "ckb/vekol.int8.onnx",
}
ORT_PIN = "1.31.1"   # onnxruntime used to quantise (deploy workflows install exactly this); same as the web runtime
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

    # ---- int8 voices (see tts_quant.py for the measurements behind this choice) ----
    for src, rel in QUANT.items():
        q = os.path.join(DL, src.replace(".onnx", f".u8-ort{ORT_PIN}.onnx"))
        if not os.path.exists(q):
            import onnxruntime
            if onnxruntime.__version__ != ORT_PIN:
                sys.exit(f"quantise with onnxruntime {ORT_PIN}, found {onnxruntime.__version__}")
            from onnxruntime.quantization import QuantType, quantize_dynamic
            print(f"  quantise {src} -> int8")
            quantize_dynamic(os.path.join(DL, src), q + ".part", weight_type=QuantType.QUInt8, per_channel=False)
            os.replace(q + ".part", q)
        dst = os.path.join(OUT, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(q, dst)
        print(f"  int8    {rel}: {os.path.getsize(dst) / 1e6:.1f} MB (from {os.path.getsize(os.path.join(DL, src)) / 1e6:.1f} MB)")

    # ---- piper_phonemize: Persian-only espeak data, ES-module loader ----
    # The reader's module worker imports the loader, so it is served as an ES module that exports the
    # factory. Its Emscripten metadata (file offsets inside the .data package) is rewritten for the
    # subset. New names (.fa.*) so no visitor pairs a cached full package with the new offsets.
    pj = os.path.join(OUT, "piper/piper_phonemize.js")
    pd = os.path.join(OUT, "piper/piper_phonemize.data")
    with open(pj, encoding="utf-8") as f:
        src = f.read()
    with open(pd, "rb") as f:
        data = f.read()
    assert "var createPiperPhonemize" in src
    m = re.search(r'loadPackage\((\{"files":.*?\})\)', src, re.S)
    meta = json.loads(m.group(1))
    assert meta["remote_package_size"] == len(data), "piper package metadata does not match its data"
    keep = [f for f in meta["files"] if not f["filename"].endswith("_dict") or f["filename"].endswith("/fa_dict")]
    assert any(f["filename"].endswith("/fa_dict") for f in keep), "fa_dict missing from piper package"
    out, files = bytearray(), []
    for f in keep:
        g = dict(f); g["start"] = len(out); out += data[f["start"]:f["end"]]; g["end"] = len(out); files.append(g)
    meta2 = dict(meta, files=files, remote_package_size=len(out))
    src2 = src[:m.start(1)] + json.dumps(meta2, separators=(",", ":")) + src[m.end(1):]
    with open(os.path.join(OUT, "piper/piper_phonemize.fa.mjs"), "w", encoding="utf-8") as f:
        f.write(src2 + "\nexport default createPiperPhonemize;\n")
    with open(os.path.join(OUT, "piper/piper_phonemize.fa.data"), "wb") as f:
        f.write(out)
    # Checked 2026-11-08 in Chrome: the subset gives phoneme ids identical to the full package
    # on five Persian sentences (149-257 ids each), so only the Persian build is served.
    os.remove(pj); os.remove(pd)
    print(f"  piper   {len(meta['files'])} -> {len(files)} files, {len(data) / 1e6:.1f} MB -> {len(out) / 1e6:.2f} MB")

    # sanity: the two voice configs must be the shapes reader.js expects
    fa = json.load(open(os.path.join(OUT, "fa/amir.onnx.json"), encoding="utf-8"))
    ck = json.load(open(os.path.join(OUT, "ckb/vekol.onnx.json"), encoding="utf-8"))
    assert fa["espeak"]["voice"] == "fa", fa["espeak"]
    assert ck.get("phoneme_type") == "text" and "phoneme_id_map" in ck, "vekol config changed shape"

    # ---- manifest: paths, exact byte sizes (cache keys) and what each voice costs on the wire ----
    def rel(p):
        return "/tts/" + p
    def size(p):
        return os.path.getsize(os.path.join(OUT, p))
    def wire(p):                          # gzip, as GitHub Pages sends these files
        with open(os.path.join(OUT, p), "rb") as f:
            return len(gzip.compress(f.read(), 6))
    served = ["ort/ort-wasm-simd-threaded.wasm", "ort/ort.wasm.min.mjs", "ort/ort-wasm-simd-threaded.mjs",
              "piper/piper_phonemize.fa.mjs", "piper/piper_phonemize.wasm", "piper/piper_phonemize.fa.data",
              "fa/amir.int8.onnx", "fa/amir.onnx.json", "ckb/vekol.int8.onnx", "ckb/vekol.onnx.json"]
    manifest = {
        "v": 2,
        "ort": {"base": "/tts/ort/", "wasm": rel("ort/ort-wasm-simd-threaded.wasm"), "version": ORT_VER},
        "piper": {"js": rel("piper/piper_phonemize.fa.mjs"), "wasm": rel("piper/piper_phonemize.wasm"),
                  "data": rel("piper/piper_phonemize.fa.data")},
        "fa": {"model": rel("fa/amir.int8.onnx"), "config": rel("fa/amir.onnx.json"), "voice": "Piper fa_IR amir (medium, int8)"},
        "ckb": {"model": rel("ckb/vekol.int8.onnx"), "config": rel("ckb/vekol.onnx.json"), "voice": "Vekol-TTS by Revge (CC BY-NC 4.0, int8)"},
        "sizes": {rel(p): size(p) for p in served},
        "wire": {
            "ort": wire("ort/ort-wasm-simd-threaded.wasm"),
            "fa": wire("fa/amir.int8.onnx") + wire("piper/piper_phonemize.fa.data") + wire("piper/piper_phonemize.wasm"),
            "ckb": wire("ckb/vekol.int8.onnx"),
        },
    }
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    w = manifest["wire"]
    print(f"tts: a visitor downloads Persian {(w['fa'] + w['ort']) / 1e6:.1f} MB, Kurdish {(w['ckb'] + w['ort']) / 1e6:.1f} MB (gzip)")

    print("tts: model card for the Persian voice:")
    print(open(os.path.join(OUT, "fa/MODEL_CARD.txt"), encoding="utf-8", errors="replace").read())
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f"tts: served total {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
