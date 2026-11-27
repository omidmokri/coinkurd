#!/usr/bin/env python3
"""
The typefaces of the site's languages, self-hosted: scripts/pro_langs.py FONT says which face each language uses;
this script fetches those faces once from Google Fonts (all SIL Open Font License) and writes them under
assets/fonts/lang/, so a visitor's browser never asks Google for anything (Google Fonts is slow or blocked on many
Iranian connections).

Written:
  assets/fonts/lang/<face>/<subset>[-<weight>].woff2 Google's slices of each face, as Google cuts them (a browser
                                                     downloads a slice only when the page has a letter in its range)
  assets/fonts/lang/<face>.css                       their @font-face rules, font-display: swap
  assets/fonts/lang/labels/<face>.woff2              each face cut to the letters of the language names it sets in
                                                     the language panel (a few kB each)
  assets/fonts/lang/labels.css                       the panel's @font-face rules ("EKL <face>"), loaded when the panel
                                                     opens, never before
  assets/fonts/lang/OFL.txt                          the licence the faces ship under

Run after adding a language or changing FONT:  python3 scripts/build_lang_fonts.py
Check (tests, no network):                     python3 scripts/build_lang_fonts.py --check
"""
import hashlib
import json
import os
import re
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pro_langs as P  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "fonts", "lang")
API = "https://fonts.googleapis.com/css2"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
LABEL_WEIGHT = 500
FACE_RE = re.compile(r"/\*\s*([a-z0-9-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", re.S)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def faces():
    """{face: set of subsets} over every language"""
    out = {}
    for code, f in P.FONT.items():
        if f["family"] and f["family"] not in P.SITE_FACES:
            out.setdefault(f["family"], set()).update(f["subsets"])
    return out


def labels():
    """{face: the letters of every language name it sets in the panel}"""
    out = {}
    for r in P.LANGS:
        face = P.FONT[r[0]]["family"] or P.LABEL_FACE[r[0]]
        out.setdefault(face, set()).update(r[1])
    return {k: "".join(sorted(v)) for k, v in out.items()}


def page_faces(face, subsets):
    weights = ";".join(str(w) for w in (400, 700))
    css = get(API + "?family=" + urllib.parse.quote(face) + ":wght@" + weights + "&display=swap").decode()
    rules, slug = [], P.font_slug(face)
    os.makedirs(os.path.join(OUT, slug), exist_ok=True)
    for old in os.listdir(os.path.join(OUT, slug)):
        os.remove(os.path.join(OUT, slug, old))
    by = {}                                     # subset -> {weight: (url, unicode-range)}
    for subset, body in FACE_RE.findall(css):
        if subset in subsets:
            w = re.search(r"font-weight:\s*(\d+)", body).group(1)
            rng = re.search(r"unicode-range:\s*([^;]+);", body)
            by.setdefault(subset, {})[w] = (re.search(r"url\((https://[^)]+)\)", body).group(1), rng.group(1).strip() if rng else "")
    for subset, ws in sorted(by.items()):
        # a variable face is one file for every weight: kept once, declared for the whole range
        groups = [(" ".join(sorted(ws)), next(iter(ws.values())), subset)] if len({u for u, _ in ws.values()}) == 1 \
            else [(w, ws[w], subset + "-" + w) for w in sorted(ws)]
        for weight, (src, rng), stem in groups:
            with open(os.path.join(OUT, slug, stem + ".woff2"), "wb") as fh:
                fh.write(get(src))
            rules.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;"
                         "src:url(%s%s/%s.woff2) format('woff2');%s}" % (face, weight, P.FONT_DIR, slug, stem,
                                                                        ("unicode-range:" + rng + ";") if rng else ""))
    missing = set(subsets) - set(s for s, _ in FACE_RE.findall(css))
    if missing:
        sys.exit(face + ": Google has no slice " + ", ".join(sorted(missing)))
    with open(os.path.join(OUT, slug + ".css"), "w", encoding="utf-8") as fh:
        fh.write("/* " + face + " (SIL OFL 1.1), self-hosted; WRITTEN BY scripts/build_lang_fonts.py */\n" + "\n".join(rules) + "\n")


def label_face(face, text):
    css = get(API + "?family=" + urllib.parse.quote(face) + ":wght@" + str(LABEL_WEIGHT) + "&text="
              + urllib.parse.quote(text) + "&display=swap").decode()
    src = re.search(r"url\((https://[^)]+)\)", css).group(1)
    os.makedirs(os.path.join(OUT, "labels"), exist_ok=True)
    with open(os.path.join(OUT, "labels", P.font_slug(face) + ".woff2"), "wb") as fh:
        fh.write(get(src))


def labels_css():
    return ("/* the language panel's names, each in its own face cut to its own letters; WRITTEN BY scripts/build_lang_fonts.py */\n"
            + "\n".join("@font-face{font-family:'EKL %s';font-weight:%d;font-display:swap;src:url(%slabels/%s.woff2) format('woff2')}"
                        % (face, LABEL_WEIGHT, P.FONT_DIR, P.font_slug(face)) for face in sorted(labels())) + "\n")


def manifest():
    """what the files were made from: --check compares it, so a changed FONT or a new language name is caught"""
    return json.dumps({"faces": {k: sorted(v) for k, v in sorted(faces().items())},
                       "labels": {k: hashlib.sha1(v.encode()).hexdigest()[:12] for k, v in sorted(labels().items())}},
                      ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def check():
    bad = []
    man = os.path.join(OUT, "manifest.json")
    if not os.path.exists(man) or open(man, encoding="utf-8").read() != manifest():
        bad.append("assets/fonts/lang/manifest.json is out of date")
    for face in faces():
        if not os.path.exists(os.path.join(OUT, P.font_slug(face) + ".css")):
            bad.append("no " + P.font_slug(face) + ".css")
    for face in labels():
        if not os.path.exists(os.path.join(OUT, "labels", P.font_slug(face) + ".woff2")):
            bad.append("no label face for " + face)
    return bad


def main():
    if "--check" in sys.argv:
        bad = check()
        for b in bad:
            print("OUT OF DATE:", b, "— run python3 scripts/build_lang_fonts.py")
        sys.exit(1 if bad else 0)
    os.makedirs(OUT, exist_ok=True)
    for face, subsets in sorted(faces().items()):
        page_faces(face, subsets)
        print("page face", face, sorted(subsets))
    for face, text in sorted(labels().items()):
        label_face(face, text)
        print("label face", face, len(text), "letters")
    with open(os.path.join(OUT, "labels.css"), "w", encoding="utf-8") as fh:
        fh.write(labels_css())
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as fh:
        fh.write(manifest())
    lic = os.path.join(ROOT, "assets", "fonts", "OFL.txt")
    if os.path.exists(lic):
        with open(lic, encoding="utf-8") as a, open(os.path.join(OUT, "OFL.txt"), "w", encoding="utf-8") as b:
            b.write("The faces in this folder are each © their authors and licensed under the SIL Open Font License 1.1:\n"
                    + ", ".join(sorted(faces() | {f: 0 for f in labels()})) + ".\n\n" + a.read())


if __name__ == "__main__":
    main()
